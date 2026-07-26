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

  // ---- the chapter stack: one-screen wheel paging DOWN the sections,
  // the sidebar menu tracking the current one (Figma 1436:260) + a
  // .revealed class per slide for the entrance ----
  const scroller = document.getElementById('about-scroll');
  const slides = Array.from(document.querySelectorAll('.about-slide'));
  const dots = Array.from(document.querySelectorAll('.menu-item'));

  // ?reveal=1 — screenshot-harness hook: skip the entrances everywhere
  if (new URLSearchParams(location.search).has('reveal')) {
    slides.forEach((s) => s.classList.add('revealed'));
  }

  // ≤700px the chapters unroll into one document scroll (see about.css) —
  // no wheel paging, no sidebar chrome, no thread; the shared site-nav
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
    const prefersReduced =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    let lastWheel = 0;
    let acc = 0;
    let fired = false;
    scroller.addEventListener('wheel', (e) => {
      if (e.target.closest('.compose')) return;             // writing, not paging
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;  // sideways = noise
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheel > 150) { acc = 0; fired = false; }
      lastWheel = now;
      acc += e.deltaY;
      if (fired || Math.abs(acc) < 30) return;
      fired = true;
      const i = Math.round(scroller.scrollTop / scroller.clientHeight);
      const next = Math.min(Math.max(i + (acc > 0 ? 1 : -1), 0), slides.length - 1);
      if (next === i) return;
      slides[next].scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth',
        block: 'start',
      });
    }, { passive: false });

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
    // lose the race against the snap scroller and the scroll-spy; only
    // after settling does the spy start mirroring the hash back
    const target = slides.find((s) => '#' + s.id === location.hash);
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    setTimeout(() => { window.__hashReady = true; }, 600);

  }

  // ============================================================
  // THE MAP — skills chapter. Every pairing below is a thing that actually
  // shipped; nothing here is filler. The curves are drawn from the nodes'
  // OWN layout positions (offsetLeft/offsetTop, not getBoundingClientRect —
  // those come back multiplied by stage-fit's scale and would put the ink
  // in the wrong place), so the diagram re-solves itself if the type,
  // the copy, or the frame ever changes.
  // ============================================================
  const MAP_LINKS = [
    ['research',  ['pantry', 'uchicago']],
    ['wireframe', ['pantry', 'vicino']],
    ['ixd',       ['pantry', 'vicino', 'site']],
    ['mvp',       ['pantry', 'nextlevel']],
    ['usability', ['pantry', 'uchicago']],
    ['figma',     ['pantry', 'vicino', 'nextlevel']],
    ['adobe',     ['nextlevel']],
    ['react',     ['vicino']],
    ['web',       ['site', 'nextlevel', 'uchicago']],
    ['python',    ['uchicago']],
    ['csharp',    ['rogue']],
    ['git',       ['site', 'vicino', 'rogue']],
  ];

  const mapEl = document.getElementById('craft-map');
  const linkSvg = document.getElementById('map-links');
  if (mapEl && linkSvg) {
    const NS = 'http://www.w3.org/2000/svg';
    const nodes = new Map();
    mapEl.querySelectorAll('.map-node').forEach((n) => nodes.set(n.dataset.node, n));

    // node -> the links touching it, and the nodes on their far side
    const wires = [];
    const touching = new Map();
    const note = (key, wire, other) => {
      if (!touching.has(key)) touching.set(key, { wires: [], others: [] });
      touching.get(key).wires.push(wire);
      touching.get(key).others.push(other);
    };

    function draw() {
      const W = mapEl.offsetWidth;
      const H = mapEl.offsetHeight;
      linkSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      // a node's port: skills hand off from their right edge, projects
      // receive on their left
      const port = (el, side) => {
        let x = el.offsetLeft, y = el.offsetTop;
        for (let p = el.offsetParent; p && p !== mapEl; p = p.offsetParent) {
          x += p.offsetLeft; y += p.offsetTop;
        }
        return { x: side === 'right' ? x + el.offsetWidth : x, y: y + el.offsetHeight / 2 };
      };
      wires.forEach(({ path, from, to }) => {
        const a = port(nodes.get(from), 'right');
        const b = port(nodes.get(to), 'left');
        // a flat S: the control points reach horizontally, so every curve
        // leaves and arrives level and the bundle reads as one weave
        const dx = Math.max((b.x - a.x) * 0.46, 60);
        path.setAttribute('d',
          `M${a.x} ${a.y} C${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`);
      });
    }

    let i = 0;
    MAP_LINKS.forEach(([skill, projects]) => {
      projects.forEach((project) => {
        if (!nodes.has(skill) || !nodes.has(project)) return;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('class', 'map-link');
        // the draw-in works in stroke-dash units, so the path has to declare
        // its length as 1 — without this, dasharray:1 means ONE PIXEL and
        // every link renders as a dotted hairline
        path.setAttribute('pathLength', '1');
        path.style.setProperty('--i', i++);
        linkSvg.appendChild(path);
        const wire = { path, from: skill, to: project };
        wires.push(wire);
        note(skill, wire, project);
        note(project, wire, skill);
      });
    });

    draw();
    // the type settles a frame or two after first paint, and a stale port
    // would leave the ink hanging off its node
    requestAnimationFrame(draw);
    window.addEventListener('resize', draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);

    const clear = () => {
      mapEl.classList.remove('is-active');
      nodes.forEach((n) => n.classList.remove('is-on', 'is-dim'));
      wires.forEach((w) => w.path.classList.remove('is-on'));
    };
    const light = (key) => {
      const hit = touching.get(key);
      if (!hit) return;
      mapEl.classList.add('is-active');
      const on = new Set([key, ...hit.others]);
      nodes.forEach((n, k) => {
        n.classList.toggle('is-on', on.has(k));
        n.classList.toggle('is-dim', !on.has(k));
      });
      wires.forEach((w) => {
        const lit = hit.wires.includes(w);
        // restart the ink animation rather than letting a half-drawn path
        // linger from the last node the cursor was on
        w.path.classList.remove('is-on');
        if (lit) { void w.path.getBoundingClientRect(); w.path.classList.add('is-on'); }
      });
    };

    nodes.forEach((n, key) => {
      n.addEventListener('pointerenter', () => light(key));
      n.addEventListener('focus', () => light(key));
      n.addEventListener('blur', clear);
    });
    mapEl.addEventListener('pointerleave', clear);
  }

  // ============================================================
  // THE ROUTE — resume chapter. One panel, refilled by whichever stop is
  // current, so the detail never jumps around the frame. The skills listed
  // per posting are read straight off MAP_LINKS above — the Craft map and
  // this chapter are two views of one graph, and inverting the edges here
  // means they can never fall out of step.
  // ============================================================
  const POSTS = {
    nextlevel: { n: '04', role: 'Founding Visual Designer', co: 'Next Level Drone Cleaning',
      date: 'Summer 2025',
      sum: 'The complete visual identity for an early-stage drone-tech startup — brand, logo suite, and the marketing site, built with the founder.' },
    uchicago: { n: '03', role: 'UX Researcher', co: 'University of Chicago',
      date: 'Autumn 2025',
      sum: 'An empirical study of interface homogenization across six AI-generated web apps, and the paper on what it means for human-centered design.' },
    pantry: { n: '02', role: 'Product Designer', co: 'PantryPal',
      date: 'Winter 2025\u201326',
      sum: 'End-to-end design of an AI recipe app, from research through a production-ready prototype; task completion up 40% across testing rounds.' },
    vicino: { n: '01', role: 'UX Engineer Intern', co: 'Vicino AI',
      date: 'Summer 2026',
      sum: 'Agentic generation and analytics for an AI marketing platform, and a Figma-to-React component library used across feature pages.' },
  };
  // reading order along the road, west to east
  const ROUTE_ORDER = ['nextlevel', 'uchicago', 'pantry', 'vicino'];
  const SKILL_NAMES = {
    research: 'User Research', wireframe: 'Wireframing', ixd: 'Interaction Design',
    mvp: 'MVP Scoping', usability: 'Usability Testing', figma: 'Figma',
    adobe: 'Adobe Creative Cloud', react: 'React', web: 'HTML / CSS / JS',
    python: 'Python', csharp: 'C#', git: 'Git',
  };

  const routeEl = document.getElementById('route');
  const postEl = document.getElementById('post');
  if (routeEl && postEl) {
    const stops = Array.from(routeEl.querySelectorAll('.route-stop'));
    const segs = Array.from(routeEl.querySelectorAll('.route-seg'));
    const field = (id) => document.getElementById(id);
    // invert the map's edges: which skills did this posting take?
    const skillsFor = (post) => MAP_LINKS
      .filter(([, projects]) => projects.includes(post))
      .map(([skill]) => SKILL_NAMES[skill])
      .filter(Boolean);

    let current = 'vicino';
    function show(post) {
      if (post === current) return;
      current = post;
      const p = POSTS[post];
      const i = ROUTE_ORDER.indexOf(post);
      stops.forEach((s) => s.classList.toggle('is-on', s.dataset.post === post));
      // the road behind the current stop is the road already travelled
      segs.forEach((seg, k) => seg.classList.toggle('is-travelled', k < i));
      postEl.classList.add('is-swapping');
      setTimeout(() => {
        field('post-num').textContent = p.n;
        field('post-role').textContent = p.role;
        field('post-co').textContent = p.co;
        field('post-date').textContent = p.date;
        field('post-sum').textContent = p.sum;
        field('post-skills').innerHTML = skillsFor(post)
          .map((name) => '<span>' + name + '</span>').join('');
        postEl.classList.remove('is-swapping');
      }, 190);
    }

    stops.forEach((stop) => {
      stop.addEventListener('pointerenter', () => show(stop.dataset.post));
      stop.addEventListener('focus', () => show(stop.dataset.post));
      stop.addEventListener('click', () => show(stop.dataset.post));
    });

    // paint the resting state (the newest posting) without the swap beat
    field('post-skills').innerHTML = skillsFor('vicino')
      .map((name) => '<span>' + name + '</span>').join('');
    segs.forEach((seg) => seg.classList.add('is-travelled'));
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
