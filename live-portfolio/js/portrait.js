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
//
// Every geometry knob a caller passes in is in CSS PIXELS OF THE FINISHED
// FACE, not in texture px. That is what lets the engraving survive a big
// monitor: the texture is sized from the box it is going into, so a knob
// meaning "a quarter-pixel hairline" means that at every size, instead of
// meaning it only at the one fixed texture width it was tuned against.
window.Portrait = (() => {
  const SRC = 'Media/face_cutout.webp';
  const SRC_W = 930, SRC_H = 1185;
  const ALPHA_CUTOFF = 0.35;
  const TONE_GAMMA = 1.15;
  const TONE_LOW_PCT = 0.04;
  const TONE_HIGH_PCT = 0.97;
  const INK = '#141414';

  // Bake at twice the canvas and box-filter down exactly once. Drawing the
  // ribbons near their final size and halving is what antialiases them; the
  // old fixed 1024px texture resampled 5:1 into a 185px box, and a ribbon
  // thinner than the output pixel it lands in is where the beating came from.
  const SS = 2;
  const MAX_TEX = 2400;      // a ceiling for memory, never reached at these sizes
  const MAX_SCALE = 4;       // device px per layout px: dpr x stage zoom, capped
  // CSS px per ribbon. 1.8 rather than a round 2 so that the snap below lands
  // on a TWO device-pixel pitch at both of the stage's scales (1.0 and 1.25)
  // and on four at 2x — the density the face reads softest and most
  // photographic at. Three device px is a legible engraving too, but a harder,
  // more ruled one, and the art direction here is friendly.
  const PITCH = 1.8;

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

  /* ---- how many real pixels this canvas actually gets ----

     `zoom` is the trap. css/shell.css scales the whole stage with
     `zoom: var(--card-scale)` — up to 1.25 on a wide monitor — and zoom does
     NOT show up in clientWidth, which stays in the element's own unscaled
     grid px. Sizing the buffer off clientWidth alone therefore paints 148px
     of pixels into a 185px box on every large screen, and on a 1x display
     (which is what most big external monitors are) that lands under one
     device pixel per ribbon.

     getBoundingClientRect WOULD carry the zoom, but this canvas wears the
     look-at-cursor transform, so its rect is a rotated bounding box rather
     than the box we paint into. Walking the ancestors and multiplying their
     zooms is the reading that stays true while the head is turned. */
  const zoomOf = (el) => {
    let z = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const v = parseFloat(getComputedStyle(n).zoom);
      if (v && v !== 1) z *= v;
    }
    return z;
  };

  const measure = (canvas, o) => {
    if (!canvas.clientWidth || !canvas.clientHeight) return null;
    // EXACTLY the device pixels this canvas covers — dpr through the stage's
    // zoom. Not the old min(dpr, 2): any mismatch between the buffer and the
    // box hands the browser a rescale on the way to the screen, and rescaling
    // ribbons is the one thing this whole file is arranged to avoid.
    const scale = Math.min((window.devicePixelRatio || 1) * zoomOf(canvas), MAX_SCALE);
    const w = Math.round(canvas.clientWidth * scale);
    const h = Math.round(canvas.clientHeight * scale);

    // THE FIX. The ribbon pitch is a WHOLE NUMBER OF DEVICE PIXELS. Left
    // fractional, every ribbon lands on a different sub-pixel phase, the
    // phases drift against the pixel grid, and the drift shows up as bands of
    // alternating heavy and light lines rolling down the face — the moire
    // that made this look dirty on a big monitor. Snapped, every ribbon
    // rasterises identically and tone is carried by thickness alone, which is
    // what a hedcut is. It also means the count follows the box: a face given
    // more pixels gets more lines, never finer ones than it can show.
    // Two device px is the floor: one is a ribbon that cannot vary its
    // thickness at all, which is a stripe, not an engraving.
    const pitch = Math.max(2, Math.round((o.pitch || PITCH) * scale));
    const nLines = Math.max(1, Math.floor(h / pitch));
    return {
      w: w, h: h, scale: scale, pitch: pitch, nLines: nLines,
      top: Math.round((h - nLines * pitch) / 2),   // the remainder, split evenly
    };
  };

  /* ---- the baker ---- */
  const bake = (o, g) => {
    const S = sample(o.sampleW);
    // The texture is an exact WHOLE multiple of the buffer — not a fixed
    // 1024px sheet resampled 5:1 into a 185px box, which is how ribbons
    // thinner than the pixel they landed in used to get mangled. Whole, so
    // the snapped pitch above stays snapped all the way down.
    const ss = g.w * SS <= MAX_TEX ? SS : 1;
    const TEX_W = g.w * ss, TEX_H = g.h * ss;
    const off = document.createElement('canvas');
    off.width = TEX_W; off.height = TEX_H;
    const octx = off.getContext('2d');

    // CSS px → texture px. Every knob crosses this on the way in, which is
    // what makes the engraving size-independent.
    const u = g.scale * ss;

    // an opaque page-coloured silhouette base, so the ribbons sit on
    // solid ground rather than on whatever is behind the canvas
    const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#f6f6f6';
    octx.save();
    octx.drawImage(img, 0, 0, TEX_W, TEX_H);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = bg;
    octx.fillRect(0, 0, TEX_W, TEX_H);
    octx.restore();

    octx.fillStyle = INK;
    const spacing = g.pitch * ss;        // whole device px x whole supersample
    const topPad = g.top * ss;
    const maxThick = spacing * o.maxThickFrac;
    const minThick = o.minThick * u;
    const waveAmp = o.waveAmp * u;
    const step = Math.max(1, o.step * u);
    const k = (2 * Math.PI) / (o.waveLen * u);

    for (let li = 0; li < g.nLines; li++) {
      const baseY = topPad + (li + 0.5) * spacing;
      const v = baseY / TEX_H;      // where the ribbon actually sits, not its index
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

      for (let x = 0; x <= TEX_W; x += step) {
        const t = toneAt(S, x / TEX_W, v);
        if (t < 0) { flush(); continue; }
        const cy = baseY + waveAmp * Math.sin(x * k + phase);
        const half = (minThick + t * (maxThick - minThick)) / 2;
        if (!top) { top = []; bot = []; }
        top.push([x, cy - half]);
        bot.push([x, cy + half]);
      }
      flush();
    }
    return off;
  };

  // Halving repeatedly averages every source pixel into the result instead of
  // throwing away the ones between output pixels. The texture is baked at
  // exactly SS x the canvas, so in the normal case this runs once and lands
  // on the buffer's own size — a clean box filter, and the drawImage after it
  // is 1:1. The >= is what makes that exact case halve rather than fall
  // through to a smoothed 2:1 resample.
  const shrink = (tex, w, h) => {
    let src = tex;
    while (src.width >= w * 2 && src.height >= h * 2 && src.width > w) {
      const half = document.createElement('canvas');
      half.width = Math.max(w, Math.round(src.width / 2));
      half.height = Math.max(h, Math.round(src.height / 2));
      const hc = half.getContext('2d');
      hc.imageSmoothingEnabled = true;
      hc.imageSmoothingQuality = 'high';
      hc.drawImage(src, 0, 0, half.width, half.height);
      src = half;
    }
    return src;
  };

  // Returns whether it actually painted. A canvas with no layout box (its
  // section is display:none — on a phone About is a SCREEN you tap to, so
  // that is the normal state at load) has nothing to paint INTO, and the
  // caller has to be able to tell that apart from a finished portrait:
  // about.js hides the pre-baked fallback webp on success, and hiding it
  // over an empty canvas is a hole where the face should be.
  const paint = (canvas, tex, g) => {
    if (!g || !g.w || !g.h) return false;
    canvas.width = g.w;
    canvas.height = g.h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, g.w, g.h);
    const src = shrink(tex, g.w, g.h);
    ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, g.w, g.h);
    return true;
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
    load().then(() => {
      const g = measure(canvas, opts);
      if (!g) return false;                       // no box yet — nothing to paint into
      return paint(canvas, bake(opts, g), g);
    });

  /* ---- and keep it that way. The stage rescales on every window resize
     (js/stage-fit.js) and the dpr changes when the window is dragged to a
     second monitor; both leave the buffer sized for a face that is no longer
     there. Re-bake when the size it WOULD get differs from the size it has,
     debounced so a drag is one bake at the end and not sixty on the way. ---- */
  const watched = [];
  let watching = false;
  let refitTimer = 0;

  const refit = () => {
    refitTimer = 0;
    watched.forEach((entry) => {
      if (!entry.el.isConnected) return;
      const g = measure(entry.el, entry.opts);
      if (!g || (g.w === entry.el.width && g.h === entry.el.height)) return;
      paint(entry.el, bake(entry.opts, g), g);
    });
  };

  const watch = (canvas, opts) => {
    watched.push({ el: canvas, opts: opts });
    if (watching) return;
    watching = true;
    const schedule = () => {
      clearTimeout(refitTimer);
      refitTimer = setTimeout(refit, 150);
    };
    window.addEventListener('resize', schedule);
    // the stage's own scale step — it lands after the resize settles, and a
    // rail drag changes it with no resize at all
    window.addEventListener('shell:fit', schedule);
  };

  // The rail's face is DRAWN now, not rendered (see FACE_SVG in
  // js/shell.js) — but it watches the cursor on these, the about page's
  // own look constants, so the two heads move identically. Only the
  // perspective scales with the box: 900px is tuned for a 330px face and
  // would flatten the turn to nothing at 56.
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
    load, sample, measure, bake, paint, render, watch, look,
    MINI_LOOK: MINI_LOOK,
  };
})();
