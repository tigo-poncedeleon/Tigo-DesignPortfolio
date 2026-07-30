// About page — stage fade-in, plus the hedcut portrait: the EXACT pipeline
// from working-portfolio/js/line-portrait.js. A regular photo
// (Media/face_cutout.webp) is baked at runtime into an engraving on an
// offscreen 2D canvas — ~150 roughly-horizontal ink ribbons whose
// THICKNESS encodes tone, percentile-normalized so skin reads light —
// then shown on a visible canvas that tilts toward the cursor with the
// original's exact motion (no three.js here; the site stays zero-dep, so
// the old curved-plane renderer becomes a CSS perspective tilt).
(() => {
  const stage = document.querySelector('.about-stage');
  if (stage) requestAnimationFrame(() => stage.classList.add('revealed'));

  // ---- the chapter stack: natural scroll down the sections, the
  // sidebar menu tracking the current one (Figma 1436:260) + a
  // .revealed class per slide for the entrance ----
  const scroller = document.getElementById('about-scroll');
  const slides = Array.from(document.querySelectorAll('.about-slide'));
  const dots = Array.from(document.querySelectorAll('.menu-item'));

  // ?reveal=1 — screenshot-harness hook: skip the entrances everywhere
  if (new URLSearchParams(location.search).has('reveal')) {
    slides.forEach((s) => s.classList.add('revealed'));
  }

  // ≤700px the chapters unroll into one document scroll (see about.css) —
  // no sidebar chrome, no thread; the shared site-nav
  // bottom bar (styles.css) is the mobile nav. Slides reveal via a plain
  // viewport observer instead.
  const MOBILE = window.matchMedia('(max-width: 700px)').matches;

  if (MOBILE && slides.length) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('revealed');
      }),
      { threshold: 0.12 }
    );
    slides.forEach((s) => io.observe(s));
  } else if (scroller && slides.length && dots.length === slides.length) {
    // ---- the sidebar chip: ONE flat pill that glides between the menu
    // words — following the cursor while it's in the menu, resting on the
    // current chapter otherwise (the home pill's manner, turned vertical) ----
    const menu = document.querySelector('.about-menu');
    const glass = menu ? menu.querySelector('.menu-glass') : null;
    let hovered = null;
    const place = (item) => {
      if (!glass || !item) return;
      glass.style.setProperty('--gt', item.offsetTop + 'px');
      glass.style.setProperty('--gw', item.offsetWidth + 'px');
      glass.style.setProperty('--gh', item.offsetHeight + 'px');
    };
    const settle = () =>
      place(hovered || dots.find((d) => d.classList.contains('is-current')));
    if (glass) {
      settle();
      // transitions switch on one frame AFTER the first placement, so the
      // chip materialises in place instead of flying in from the corner
      requestAnimationFrame(() =>
        requestAnimationFrame(() => glass.classList.add('is-ready')));
      menu.addEventListener('pointerover', (e) => {
        const item = e.target.closest('.menu-item');
        if (item) { hovered = item; place(item); }
      });
      menu.addEventListener('pointerleave', () => { hovered = null; settle(); });
      menu.addEventListener('focusin', (e) => {
        const item = e.target.closest('.menu-item');
        if (item) place(item);
      });
      menu.addEventListener('focusout', settle);
    }

    // ---- the reading thread: map how far down the chapters we are onto
    // --p (the orange stitch on the hairline), and let the bio's scroll
    // hint bow out once the visitor has moved ----
    const thread = document.querySelector('.about-thread');
    let threadRaf = 0;
    const trackScroll = () => {
      threadRaf = 0;
      const max = scroller.scrollHeight - scroller.clientHeight;
      if (thread) {
        thread.style.setProperty('--p', max ? scroller.scrollTop / max : 0);
      }
      if (stage) stage.classList.toggle('is-scrolled', scroller.scrollTop > 40);
    };
    scroller.addEventListener('scroll', () => {
      if (!threadRaf) threadRaf = requestAnimationFrame(trackScroll);
    }, { passive: true });
    trackScroll();

    const setCurrent = (id) => {
      dots.forEach((dot) => {
        const on = dot.getAttribute('href') === '#' + id;
        if (on) dot.setAttribute('aria-current', 'page');
        else dot.removeAttribute('aria-current');
        dot.classList.toggle('is-current', on);
      });
      if (!hovered) settle();           // the chip drifts to the new chapter
    
      // mirror the chapter into the URL (replace, never push) so refresh
      // and back/forward land where the reader actually was
      if (window.__hashReady && location.hash.slice(1) !== id && (location.hash || id !== slides[0].id)) {
        history.replaceState(null, '', '#' + id);
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setCurrent(e.target.id);
            e.target.classList.add('revealed');
          }
        });
      },
      { root: scroller, threshold: 0.6 }
    );
    slides.forEach((s) => observer.observe(s));

    // restore a deep link deterministically — the native anchor scroll can
    // lose the race against the scroll-spy; only after settling does the
    // spy start mirroring the hash back
    const target = slides.find((s) => '#' + s.id === location.hash);
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    setTimeout(() => { window.__hashReady = true; }, 600);

  }

  // ---- the letter: the visitor leaves their address on the from line
  // and the FormSubmit relay delivers the message straight to Tigo's
  // inbox (their address rides along as the reply-to). The old mailto
  // survives only as the fallback when the relay can't be reached. ----
  const compose = document.getElementById('compose');
  if (compose) {
    const draft = document.getElementById('compose-body');
    const from = document.getElementById('compose-from');
    const status = document.getElementById('compose-status');
    const button = compose.querySelector('.compose-send');
    const RELAY = 'https://formsubmit.co/ajax/tigoponcedeleon@gmail.com';
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const RESTING = status.textContent;
    let resetTimer = 0;

    const say = (msg, cls) => {
      status.textContent = msg;
      status.classList.remove('is-error', 'is-sent');
      if (cls) status.classList.add(cls);
      clearTimeout(resetTimer);
      if (msg !== RESTING) {
        resetTimer = setTimeout(() => say(RESTING), 4000);
      }
    };

    compose.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = draft.value.trim();
      const email = from.value.trim();
      if (!text) {
        say('write a little something first', 'is-error');
        draft.focus({ preventScroll: true });
        return;
      }
      if (!EMAIL_RE.test(email)) {
        say('add your email so I can reply', 'is-error');
        from.focus({ preventScroll: true });
        return;
      }
      button.disabled = true;
      say('sending…');
      try {
        const res = await fetch(RELAY, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            email,
            message: text,
            _replyto: email,
            _subject: 'Portfolio message',
            _template: 'table',
            _captcha: 'false',
          }),
        });
        if (!res.ok) throw new Error('relay said ' + res.status);
        await res.json();
        say('sent — thank you', 'is-sent');
        // the arrow launches out of the chip and slips back in (css)
        button.classList.add('is-sent-anim');
        setTimeout(() => button.classList.remove('is-sent-anim'), 850);
        draft.value = '';
      } catch {
        // never lose the letter: hand it to their mail app instead
        say('mail service unreachable — opened your mail app instead', 'is-error');
        window.location.href = 'mailto:tigoponcedeleon@gmail.com?body=' +
          encodeURIComponent(text);
      } finally {
        button.disabled = false;
      }
    });
  }

  const view = document.getElementById('about-face');
  const fallback = document.querySelector('.about-portrait img');
  if (!view || !view.getContext) return;
  const vctx = view.getContext('2d');

  // ---- line-portrait.js knobs, verbatim (light-mode path) ------------------
  const SRC = 'Media/face_cutout.webp';
  const SRC_W = 930, SRC_H = 1185;
  const SAMPLE_W = 320;
  const TEX_W = 1024;
  const TEX_H = Math.round(TEX_W * (SRC_H / SRC_W));
  const N_LINES = 150;
  const STEP = 2;
  const MIN_THICK = 0.7;
  const MAX_THICK_FRAC = 0.92;
  const WAVE_AMP = 0.8;
  const WAVE_LEN = 26;
  const ALPHA_CUTOFF = 0.35;
  const TONE_GAMMA = 1.15;
  const TONE_LOW_PCT = 0.04;
  const TONE_HIGH_PCT = 0.97;
  const INK = '#141414';
  // full-screen look range: the far edge of the screen turns the head to
  // a near-profile (83° / 46°) — hard-capped below 90°, where a flat
  // plane would mirror-invert (the "flip" this replaces)
  const MAX_Y = 1.45;         // rad ≈ 83°
  const MAX_X = 0.8;          // rad ≈ 46°
  const LERP = 0.06;
  const IDLE_DELAY = 400;
  const IDLE_AMP_Y = 0.06;
  const IDLE_AMP_X = 0.03;
  const IDLE_SPEED_Y = 0.5;
  const IDLE_SPEED_X = 0.4;

  // ---- source sampling (verbatim) ------------------------------------------
  let S = null;
  let srcImg = null;

  function buildSamples(img) {
    const w = SAMPLE_W;
    const h = Math.round(w * (SRC_H / SRC_W));
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0, w, h);
    const data = octx.getImageData(0, 0, w, h).data;

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
    S = { w, h, raw, inside, lo, hi: Math.max(hi, lo + 1e-3) };
  }

  function toneAt(u, v) {
    let x = (u * S.w) | 0, y = (v * S.h) | 0;
    if (x < 0) x = 0; else if (x >= S.w) x = S.w - 1;
    if (y < 0) y = 0; else if (y >= S.h) y = S.h - 1;
    const idx = y * S.w + x;
    if (!S.inside[idx]) return -1;
    let t = (S.raw[idx] - S.lo) / (S.hi - S.lo);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    return Math.pow(t, TONE_GAMMA);
  }

  // ---- hedcut baker (verbatim, minus the dark-mode branch) -----------------
  const off = document.createElement('canvas');
  off.width = TEX_W; off.height = TEX_H;
  const octx = off.getContext('2d');

  function bakeTexture() {
    octx.clearRect(0, 0, TEX_W, TEX_H);
    if (!S) return off;

    // opaque page-coloured silhouette base (identical on the page; kept
    // from the original so the ribbons sit on solid ground)
    if (srcImg) {
      const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#fdfdfd';
      octx.save();
      octx.drawImage(srcImg, 0, 0, TEX_W, TEX_H);
      octx.globalCompositeOperation = 'source-in';
      octx.fillStyle = bg;
      octx.fillRect(0, 0, TEX_W, TEX_H);
      octx.restore();
    }

    octx.fillStyle = INK;
    const spacing = TEX_H / N_LINES;
    const maxThick = spacing * MAX_THICK_FRAC;
    const k = (2 * Math.PI) / WAVE_LEN;

    for (let li = 0; li < N_LINES; li++) {
      const baseY = (li + 0.5) * spacing;
      const v = (li + 0.5) / N_LINES;
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

      for (let x = 0; x <= TEX_W; x += STEP) {
        const t = toneAt(x / TEX_W, v);
        if (t < 0) { flush(); continue; }
        const cy = baseY + WAVE_AMP * Math.sin(x * k + phase);
        const half = (MIN_THICK + t * (maxThick - MIN_THICK)) / 2;
        if (!top) { top = []; bot = []; }
        top.push([x, cy - half]);
        bot.push([x, cy + half]);
      }
      flush();
    }
    return off;
  }

  function paint() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = view.clientWidth, h = view.clientHeight;
    view.width = Math.round(w * dpr);
    view.height = Math.round(h * dpr);
    vctx.clearRect(0, 0, view.width, view.height);
    vctx.drawImage(off, 0, 0, TEX_W, TEX_H, 0, 0, view.width, view.height);
  }

  // ---- look-at-cursor (line-portrait.js motion, CSS-rendered) --------------
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // click the face and it takes a full spin — one revolution, then back
  // to quietly watching the cursor
  const figEl = document.querySelector('.about-portrait');
  if (figEl && !reduceMotion) {
    figEl.addEventListener('click', () => {
      if (figEl.classList.contains('is-spun')) return;
      figEl.classList.add('is-spun');
      figEl.addEventListener('animationend',
        () => figEl.classList.remove('is-spun'), { once: true });
    });
  }
  let targetRotX = 0, targetRotY = 0;
  let rotX = 0, rotY = 0;
  let lastMoveTime = -Infinity;

  if (!reduceMotion) {
    window.addEventListener('mousemove', (e) => {
      const r = view.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // normalise the cursor's offset by the room available on ITS side of
      // the face, so either screen edge = the full (sub-90°) turn
      const runX = e.clientX < cx ? cx : Math.max(1, window.innerWidth - cx);
      const runY = e.clientY < cy ? cy : Math.max(1, window.innerHeight - cy);
      const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / runX));
      const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / runY));
      targetRotY = nx * MAX_Y;
      targetRotX = ny * MAX_X;
      lastMoveTime = performance.now();
    });

    (function loop() {
      const now = performance.now();
      if (now - lastMoveTime > IDLE_DELAY) {
        const t = now / 1000;
        targetRotY = Math.sin(t * IDLE_SPEED_Y) * IDLE_AMP_Y;
        targetRotX = Math.sin(t * IDLE_SPEED_X) * IDLE_AMP_X;
      }
      rotY += (targetRotY - rotY) * LERP;
      rotX += (targetRotX - rotX) * LERP;
      // CSS rotateX runs opposite to the three.js convention — flip it
      view.style.transform =
        'perspective(900px) rotateY(' + rotY + 'rad) rotateX(' + -rotX + 'rad)';
      requestAnimationFrame(loop);
    })();
  } else {
    view.style.transform = 'perspective(900px) rotateY(0.12rad)';
  }

  // ---- boot ----------------------------------------------------------------
  const img = new Image();
  img.onload = () => {
    srcImg = img;
    buildSamples(img);
    bakeTexture();
    paint();
    if (fallback) fallback.style.display = 'none';
  };
  img.src = SRC;
})();
