// The browser's side of Canvas's Live Run: the calls to the site's relay
// (api/canvas.js), which asks Gemini, and nothing about the board.
//
// canvas.html loads this only when Live Run is chosen in the menu under
// the board's name, so a visitor to the test run never fetches it. Once
// the relay takes the password, canvas.html hands window.VicinoLive to
// the board (VicinoCanvas.setLive), and the board's runs ask it for real
// pictures and clips in place of its timers. Three things happen here and
// nowhere else:
//
//   - the board's model names (the shipped board's own menu: flux-2-pro,
//     veo3.1 and the rest) are mapped to the Gemini model that answers
//     for each, since Gemini is the one account behind the relay; the
//     image names are spread over Gemini's three image models, so the
//     choice still changes the speed and the finish
//   - every picture the board sends on (a reference image, a video's first
//     frame) is redrawn as a JPEG no wider than 1280, so a frame returned
//     as a two-megabyte PNG crosses back in a few hundred KB, well under
//     the 4.5 MB a Vercel function accepts
//   - a clip is asked for, then asked after every five seconds until it is
//     made, then fetched in the parts the relay hands it back in (its
//     response is capped at 4.5 MB too) and joined into one Blob
//
// The password is kept in this browser's storage, so a demo on Tigo's own
// laptop or phone opens without it; the board name's menu forgets it.
(() => {
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  // A copy of the site on this machine has no /api of its own, so it asks
  // production's, which lets localhost in (as js/chat.js does). The page
  // may point it elsewhere with window.CANVAS_ENDPOINT, read at each call
  // so a test can set it after load; never from the address, since a link
  // that named an endpoint would be a link that collects the passcode.
  const endpoint = () => window.CANVAS_ENDPOINT ||
    (LOCAL ? 'https://www.tigoponcedeleon.com/api/canvas' : '/api/canvas');
  const KEY = 'vc.live.pass';
  const BACKEND = {
    'flux-2-pro': 'gemini-3-pro-image',
    'gpt-image-2': 'gemini-3-pro-image',
    'ideogram-v3': 'gemini-3.1-flash-image',
    'recraft-v4': 'gemini-3.1-flash-lite-image',
    'veo3.1': 'gemini-omni-1.2-flash',
    'kling3.0': 'gemini-omni-1.2-flash',
    'seedance2.0': 'gemini-omni-1.2-flash',
  };
  const backend = (name, kind) => BACKEND[name] ||
    (kind === 'video' ? 'gemini-omni-1.2-flash' : 'gemini-3.1-flash-image');
  const POLL_MS = 5000;
  const GIVE_UP_MS = 10 * 60 * 1000;

  const stored = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  let pass = stored();

  class LiveError extends Error {
    constructor(message, code) { super(message); this.code = code; }
  }

  const forget = () => {
    pass = '';
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing kept */ }
  };

  const call = async (route, opts) => {
    const o = opts || {};
    let res;
    try {
      res = await fetch(endpoint() + '?route=' + route + (o.query || ''), {
        method: o.method || 'POST',
        headers: Object.assign({ 'x-canvas-pass': pass },
          o.body ? { 'content-type': 'application/json' } : {}),
        body: o.body ? JSON.stringify(o.body) : undefined,
      });
    } catch (e) {
      throw new LiveError('The relay could not be reached', 'offline');
    }
    if (res.ok) return res;
    let said = {};
    try { said = await res.json(); } catch (e) { /* a body that was not JSON */ }
    // a password the relay no longer takes is forgotten, so the next Live
    // Run asks for it again rather than failing every run in the same way
    if (res.status === 401) forget();
    throw new LiveError(said.message || 'The relay answered ' + res.status,
      said.error || String(res.status));
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const toJpeg = async (blob, max) => {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, (max || 1280) / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    const jpg = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    const data = await new Promise((r, x) => {
      const f = new FileReader();
      f.onload = () => r(String(f.result).split(',')[1]);
      f.onerror = () => x(f.error);
      f.readAsDataURL(jpg);
    });
    return { data: data, mime: 'image/jpeg' };
  };

  // with no code, the one this browser kept is checked again: a passcode
  // changed on Vercel since then is found out at load, not at Run
  const unlock = async (code) => {
    pass = String(code == null ? pass : code).trim();
    if (!pass) throw new LiveError('Enter the password', 'passcode');
    await call('unlock');
    try { localStorage.setItem(KEY, pass); } catch (e) { /* kept for this visit only */ }
  };

  // pictures sent as references are drawn smaller when there are many,
  // so ten of them still cross in well under Vercel's 4.5 MB
  const sizeFor = (count) => (count > 3 ? 768 : 1280);
  const image = async (o) => {
    const list = (o.images || []).slice(0, 10);
    const refs = await Promise.all(list.map((b) => toJpeg(b, sizeFor(list.length))));
    const res = await call('image', { body: {
      model: backend(o.model, 'image'), prompt: o.prompt, aspect: o.aspect, images: refs,
    } });
    return { blob: await res.blob(), model: o.model };
  };

  const video = async (o, onTick) => {
    const frame = o.image ? await toJpeg(o.image) : null;
    const refList = (o.refs || []).slice(0, 6);
    const refs = await Promise.all(refList.map((b) => toJpeg(b, 768)));
    const res = await call('video', { body: {
      model: backend(o.model, 'video'), prompt: o.prompt, aspect: o.aspect, seconds: o.seconds,
      resolution: o.resolution, image: frame, refs: refs,
    } });
    const id = (await res.json()).id;
    const q = '&id=' + encodeURIComponent(id);
    const started = Date.now();
    let misses = 0;
    for (;;) {
      await sleep(POLL_MS);
      if (Date.now() - started > GIVE_UP_MS) {
        throw new LiveError('The clip took more than ten minutes', 'slow');
      }
      let s;
      try {
        s = await (await call('video', { method: 'GET', query: q })).json();
        misses = 0;
      } catch (e) {
        // one slow or dropped poll is not a failed clip: the clip is still
        // being made on Google's side, so ask again, up to a point
        if (e.code === 'passcode' || ++misses > 3) throw e;
        continue;
      }
      if (onTick) onTick(s.status, Date.now() - started);
      if (s.status === 'failed') throw new LiveError(s.message || 'This clip could not be made', 'declined');
      if (s.status !== 'completed') continue;
      const parts = [];
      for (let i = 0; i < s.parts; i++) {
        parts.push(await (await call('video', { method: 'GET', query: q + '&part=' + i })).blob());
      }
      return { blob: new Blob(parts, { type: s.mime || 'video/mp4' }), model: o.model };
    }
  };

  // the AI Workflow Builder's plan for a request: { reply, nodes, edges }
  // the selected nodes ride along as context the plan may wire from
  const plan = async (message, context) => (await call('plan', { body: { message: message, context: context || [] } })).json();

  window.VicinoLive = {
    has: () => !!pass,
    unlock: unlock,
    forget: forget,
    image: image,
    video: video,
    plan: plan,
  };
})();
