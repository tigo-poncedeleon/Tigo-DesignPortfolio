// The portrait engine — sampler, hedcut baker, and the look-at-cursor loop.
//
// Lifted verbatim out of js/about.js so the rail's 26px head and the about
// page's 330px one are the SAME renderer at two sizes. The constants that
// were about.js's are still about.js's; nothing here decides how a portrait
// should look, only how to make one.
//
// It is not a stipple: each line is a filled RIBBON — a top edge and a
// reversed bottom edge closed into one polygon — whose thickness tracks the
// tone underneath, broken wherever the silhouette breaks. The sine wobble on
// each centreline is what makes it read hand-engraved rather than printed.
//
// The sampler is resolution-independent, so one pass over the source feeds
// any number of bakes at any size.
window.Portrait = (() => {
  const SRC = 'Media/face_cutout.webp';
  const SRC_W = 930, SRC_H = 1185;
  const ALPHA_CUTOFF = 0.35;
  const TONE_GAMMA = 1.15;
  const TONE_LOW_PCT = 0.04;
  const TONE_HIGH_PCT = 0.97;
  const INK = '#141414';

  let img = null;                 // the decoded source, once
  let loading = null;             // the in-flight promise, so nine callers share one fetch
  let dead = false;               // a tainted canvas (file://) kills the module, not each page
  const samples = new Map();      // sampleWidth → S

  const load = () => {
    if (img) return Promise.resolve(img);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => { img = el; resolve(el); };
      el.onerror = reject;
      el.src = SRC;
    });
    return loading;
  };

  /* ---- sampling: tone + silhouette, percentile-stretched ---- */
  const sample = (width) => {
    if (samples.has(width)) return samples.get(width);
    const w = width;
    const h = Math.round(w * (SRC_H / SRC_W));
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0, w, h);
    const data = octx.getImageData(0, 0, w, h).data;   // throws on a tainted canvas

    const raw = new Float32Array(w * h);
    const inside = new Uint8Array(w * h);
    const insideVals = [];
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      const a = data[p + 3] / 255;
      const lum = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
      const d = 1 - lum;
      raw[i] = d;
      if (a > ALPHA_CUTOFF) { inside[i] = 1; insideVals.push(d); }
    }
    insideVals.sort((a, b) => a - b);
    const lo = insideVals[Math.floor(insideVals.length * TONE_LOW_PCT)] || 0;
    const hi = insideVals[Math.floor(insideVals.length * TONE_HIGH_PCT)] || 1;
    const S = { w, h, raw, inside, lo, hi: Math.max(hi, lo + 1e-3) };
    samples.set(width, S);
    return S;
  };

  const toneAt = (S, u, v) => {
    let x = (u * S.w) | 0, y = (v * S.h) | 0;
    if (x < 0) x = 0; else if (x >= S.w) x = S.w - 1;
    if (y < 0) y = 0; else if (y >= S.h) y = S.h - 1;
    const idx = y * S.w + x;
    if (!S.inside[idx]) return -1;
    let t = (S.raw[idx] - S.lo) / (S.hi - S.lo);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    return Math.pow(t, TONE_GAMMA);
  };

  /* ---- the baker ---- */
  const bake = (o) => {
    const S = sample(o.sampleW);
    const TEX_W = o.texW;
    const TEX_H = Math.round(TEX_W * (SRC_H / SRC_W));
    const off = document.createElement('canvas');
    off.width = TEX_W; off.height = TEX_H;
    const octx = off.getContext('2d');

    // an opaque page-coloured silhouette base, so the ribbons sit on
    // solid ground rather than on whatever is behind the canvas
    const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#fdfdfd';
    octx.save();
    octx.drawImage(img, 0, 0, TEX_W, TEX_H);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = bg;
    octx.fillRect(0, 0, TEX_W, TEX_H);
    octx.restore();

    octx.fillStyle = INK;
    const spacing = TEX_H / o.nLines;
    const maxThick = spacing * o.maxThickFrac;
    const k = (2 * Math.PI) / o.waveLen;

    for (let li = 0; li < o.nLines; li++) {
      const baseY = (li + 0.5) * spacing;
      const v = (li + 0.5) / o.nLines;
      const phase = li * 0.9;
      let top = null, bot = null;

      const flush = () => {
        if (!top || top.length < 2) { top = bot = null; return; }
        octx.beginPath();
        octx.moveTo(top[0][0], top[0][1]);
        for (let i = 1; i < top.length; i++) octx.lineTo(top[i][0], top[i][1]);
        for (let i = bot.length - 1; i >= 0; i--) octx.lineTo(bot[i][0], bot[i][1]);
        octx.closePath();
        octx.fill();
        top = bot = null;
      };

      for (let x = 0; x <= TEX_W; x += o.step) {
        const t = toneAt(S, x / TEX_W, v);
        if (t < 0) { flush(); continue; }
        const cy = baseY + o.waveAmp * Math.sin(x * k + phase);
        const half = (o.minThick + t * (maxThick - o.minThick)) / 2;
        if (!top) { top = []; bot = []; }
        top.push([x, cy - half]);
        bot.push([x, cy + half]);
      }
      flush();
    }
    return off;
  };

  const paint = (canvas, tex) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tex, 0, 0, tex.width, tex.height, 0, 0, canvas.width, canvas.height);
  };

  /* ============================================================
     Look-at-cursor — ONE registry, one mousemove, one rAF for the whole
     page. About.html runs the big face and the rail head off the same
     loop rather than two of them.
     ============================================================ */
  const targets = [];
  let started = false;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const look = (el, o) => {
    if (reduced()) {
      el.style.transform = 'perspective(' + o.perspective + 'px) rotateY(0.12rad)';
      return;
    }
    targets.push({ el: el, o: o, tx: 0, ty: 0, rx: 0, ry: 0, last: -Infinity });
    if (started) return;
    started = true;

    window.addEventListener('mousemove', (e) => {
      const now = performance.now();
      targets.forEach((t) => {
        const r = t.el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        let nx, ny;
        if (t.o.normalise === 'viewport') {
          // a fixed half-viewport. The rail head sits ~30px from the left
          // edge, and the own-side rule below would make 30px of mouse
          // travel a full turn — twitchy at that size.
          nx = (e.clientX - cx) / (window.innerWidth * 0.5);
          ny = (e.clientY - cy) / (window.innerHeight * 0.5);
        } else {
          // normalise by the room on the cursor's OWN side, so either
          // screen edge reaches the full turn even off-centre
          const runX = e.clientX < cx ? cx : Math.max(1, window.innerWidth - cx);
          const runY = e.clientY < cy ? cy : Math.max(1, window.innerHeight - cy);
          nx = (e.clientX - cx) / runX;
          ny = (e.clientY - cy) / runY;
        }
        t.tx = Math.max(-1, Math.min(1, nx)) * t.o.maxY;
        t.ty = Math.max(-1, Math.min(1, ny)) * t.o.maxX;
        t.last = now;
      });
    });

    (function loop() {
      const now = performance.now();
      targets.forEach((t) => {
        if (now - t.last > t.o.idleDelay) {
          const s = now / 1000;
          t.tx = Math.sin(s * t.o.idleSpeedY) * t.o.idleAmpY;
          t.ty = Math.sin(s * t.o.idleSpeedX) * t.o.idleAmpX;
        }
        t.rx += (t.tx - t.rx) * t.o.lerp;
        t.ry += (t.ty - t.ry) * t.o.lerp;
        // CSS rotateX runs opposite to the three.js convention — flip it
        t.el.style.transform = 'perspective(' + t.o.perspective + 'px) rotateY(' +
          t.rx + 'rad) rotateX(' + -t.ry + 'rad)';
      });
      requestAnimationFrame(loop);
    })();
  };

  /* ---- render a baked texture into a canvas, loading the source first ---- */
  const render = (canvas, opts) =>
    load().then(() => paint(canvas, bake(opts)));

  /* ============================================================
     The rail's 26px head.

     The rail face is the about face at 1/8 the size, and getting it to
     LOOK like the same engraving is a question of one ratio: lines per
     displayed pixel. About draws 150 ribbons into 842 device px — 0.18 of
     a line per pixel — and that is what makes its ribbons read as ribbons.
     Match the ratio and the small one reads the same way; miss it and the
     ribbons collapse into grey mud, which is exactly what 168 lines over
     102px did.

     WAVE_AMP stays zero: the 26px wavelength falls below the Nyquist limit
     of a 1px step at this texture width, so the hand-engraved wobble
     cannot be drawn, only aliased.

     And it is CACHED. Without this a 10-35ms blocking bake would run on
     nine pages instead of one; with it, eight of nine loads in a session
     are a ~1ms drawImage that never even fetches the source. The one
     write happens in idle time, never on a critical frame.
     ============================================================ */
  const MINI = {
    sampleW: 260,
    texW: 380,
    // 48 lines, not 150. The about face draws 150 ribbons over 842 device
    // px — 0.18 lines per pixel. Matching that RATIO is what makes the two
    // look like the same engraving: at 102px tall the rail face wants ~48,
    // and the 168 it started with was nine times too dense, which is why
    // it read as mud rather than as line art.
    nLines: 48,
    step: 1,
    minThick: 0.35,
    maxThickFrac: 0.70,
    waveAmp: 0,
    waveLen: 26,
  };
  const CACHE_KEY = 'shell.avatar';
  const CACHE_V = 2;

  // What is cached is the PAINTED 52x66 canvas, not the 312x398 texture —
  // ~2KB instead of ~40KB, and the warm path is then a single drawImage of
  // exactly the pixels the slot needs.
  const readCache = () => {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      return (c && c.v === CACHE_V && c.png) ? c : null;
    } catch (err) { return null; }
  };

  const idle = (fn) => (window.requestIdleCallback
    ? window.requestIdleCallback(fn, { timeout: 1200 })
    : setTimeout(fn, 1));

  const mini = (canvas, onDone) => {
    if (dead || !canvas || !canvas.getContext) return;
    const done = () => { if (onDone) onDone(); };

    const hit = readCache();
    if (hit) {
      const el = new Image();
      el.onload = () => {                 // the warm path: one drawImage, and
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
        canvas.getContext('2d').drawImage(el, 0, 0, canvas.width, canvas.height);
        done();                           // the 89KB source is never fetched
      };
      el.onerror = () => { try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {} };
      el.src = hit.png;
      return;
    }

    load().then(() => idle(() => {
      try {
        paint(canvas, bake(MINI));        // getImageData throws on a tainted
      } catch (err) {                     // canvas (file://) — kill the module
        dead = true;                      // so eight more pages don't retry
        return;
      }
      done();
      try {
        const png = canvas.toDataURL('image/png');
        if (png.length < 40000) {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ v: CACHE_V, png: png }));
        }
      } catch (err) { /* quota or private mode — we just bake again next page */ }
    })).catch(() => { dead = true; });
  };

  // The rail face is the about page's face, resized and pinned — the SAME
  // look constants, so it turns as far and as freely as the big one does.
  // Only the perspective scales with the box: 900px is tuned for a 330px
  // face, and at 44px it would flatten the turn to nothing.
  const MINI_LOOK = {
    maxY: 1.45,            // rad ~ 83 deg, about's full range
    maxX: 0.8,             // rad ~ 46 deg
    perspective: 260,
    lerp: 0.06,            // about's damping exactly
    idleDelay: 400,
    idleAmpY: 0.06,
    idleAmpX: 0.03,
    idleSpeedY: 0.5,
    idleSpeedX: 0.4,
  };

  return {
    isDead: () => dead,
    kill: () => { dead = true; },
    load, sample, bake, paint, render, look, mini,
    MINI_LOOK: MINI_LOOK,
  };
})();
