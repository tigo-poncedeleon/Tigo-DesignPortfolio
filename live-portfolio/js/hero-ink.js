// Hero ink — a pen on the home screen, asleep until you ask for it.
//
// It draws nothing on arrival. Click once and the pen comes down; from then
// on the cursor leaves a hairline of orange behind it and the ink STAYS.
// Click again and the pen lifts. Two clicks clear the page. Nobody is told
// any of this — the whole thing is a room you only find by trying the door,
// which is the point: a visitor who never clicks never sees a mark, and the
// hero is exactly as quiet as it was designed to be.
//
// Canvas rather than SVG on purpose: the stroke accumulates for as long as
// the visitor wanders, and a growing path element would cost more with
// every segment while a canvas costs the same forever.
(() => {
  // desktop mice only — a finger has no trail to leave, and a
  // reduced-motion visitor asked for stillness
  const able = window.matchMedia(
    '(hover: hover) and (pointer: fine) and (min-width: 701px)');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  const LIFT = 900;        // ms of stillness that starts a fresh stroke
  const FAST = 2.4;        // px/ms — the speed at which the line runs thinnest
  const WIDE = 1.5;        // px — a slow, considered stroke
  const FINE = 0.7;        // px — a quick one
  const WIPE = 420;        // ms for two clicks to dissolve the page
  const HOLD = 0.5;        // fraction of the way to Work the ink stays whole

  // the pen never writes over an overlay, and never over another page
  const BUSY = ['ai-open', 'case-open', 'theater-open'];

  function boot() {
    const stage = document.getElementById('home');
    if (!stage || !able.matches || still.matches) return;

    const layer = document.createElement('div');
    layer.className = 'ink-field';
    layer.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    canvas.className = 'ink-sheet';
    layer.appendChild(canvas);
    document.body.appendChild(layer);
    const ctx = canvas.getContext('2d');
    // --ember, not --orange: the pen keeps its hue on the greyscale home,
    // where --orange is black. The one thing the cursor leaves behind is
    // the one thing on the page that is allowed to be warm.
    const ink = getComputedStyle(document.documentElement)
      .getPropertyValue('--ember').trim() || '#f54e00';

    // ---- WHAT IS KEPT IS THE STROKE, NOT THE PIXELS.
    //
    // The drawing belongs to the page, and the page moves: opening the rail
    // slides the card right and stage-fit scales the stage down to what is
    // left, and a window resize does both at once. Ink that stayed put would
    // come unstuck from the thing it was drawn on — a line through the middle
    // of the name would end up beside it.
    //
    // A canvas cannot be moved without resampling it, and resampling a
    // resampling is how a hairline turns to fog: three trips of the rail and
    // the orange has gone soft. So the marks are held as GEOMETRY — every
    // segment in the hero's own coordinates, where x is a fraction of the
    // stage's width — and the sheet is redrawn from them whenever the stage
    // moves. Nothing is ever resampled, so the hundredth reflow is as sharp
    // as the first, and it is proportional by construction: the same
    // fractions against a different box.
    const marks = [];                   // {ax,ay,cx,cy,bx,by,w} per segment
    // ~3 minutes of unbroken scribbling, after which the oldest marks fall
    // off the back. It bounds both the memory and the redraw: a reflow
    // strokes every mark, and that has to stay inside a frame of the rail's
    // slide even for someone who has been at it since they arrived.
    const CAP = 12000;

    const hero = () => {                // the stage's box, in the sheet's coords
      const s = stage.getBoundingClientRect(), c = canvas.getBoundingClientRect();
      return { x: s.left - c.left, y: s.top - c.top, w: s.width };
    };
    let mine = hero();                  // the box the marks are drawn against

    let rect = null;
    // A reflow has to redraw every mark inside one frame of the rail's
    // slide, and a stroke() per segment does not: three thousand of them
    // cost 25ms, which is a frame and a half. So the marks are bucketed by
    // width — the pen's width is quantised on the way in, to a step finer
    // than a screen can show — and each bucket goes down as ONE path. That
    // is a dozen strokes for a drawing of any size. Order does not matter:
    // it is all one flat orange, so nothing is composited over anything.
    // The bucketing survives between repaints; only drawing invalidates it.
    let batched = null;
    const batch = () => {
      const by = new Map();
      for (let i = 0; i < marks.length; i++) {
        const m = marks[i];
        let a = by.get(m.w);
        if (!a) by.set(m.w, a = []);
        a.push(m);
      }
      batched = [...by.entries()];
      return batched;
    };

    const repaint = () => {
      const dpr = window.devicePixelRatio || 1;
      const k = mine.w;                 // hero-fractions → CSS px
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      if (!marks.length || !k) return;
      ctx.save();
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * mine.x, dpr * mine.y);
      const groups = batched || batch();
      for (let g = 0; g < groups.length; g++) {
        const list = groups[g][1];
        ctx.beginPath();
        for (let i = 0; i < list.length; i++) {
          const m = list[i];
          ctx.moveTo(m.ax, m.ay);
          ctx.quadraticCurveTo(m.cx, m.cy, m.bx, m.by);
        }
        ctx.lineWidth = groups[g][0];
        ctx.stroke();
      }
      ctx.restore();
    };

    // Sizing the backing store from the layer's own rect × DPR keeps a
    // hairline honestly one hairline wide, and pointer coords are then just
    // client minus rect — no scale division anywhere.
    const measure = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      rect = r;
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w; canvas.height = h;               // this clears it
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);            // draw in CSS px
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = ink;
      mine = hero();
      repaint();                                         // …and back it comes
    };
    measure();

    // The stage moves on the signal everything else on the card moves on:
    // shell:fit, which the card's ResizeObserver fires every frame of the
    // rail's slide, of a seam drag and of a window resize. Every one of
    // those frames is a full, exact redraw — carrying the sheet on a bitmap
    // for the length of the slide was tried and measured no faster, since
    // at this size the cost is putting four million pixels down rather than
    // the paths that describe them, and a redraw is the version that is
    // still sharp when it lands.
    const reflow = () => {
      const to = hero();
      if (!to.w) return;
      if (Math.abs(to.x - mine.x) < 0.05 && Math.abs(to.y - mine.y) < 0.05
          && Math.abs(to.w - mine.w) < 0.05) return;
      lift();                           // no stroke is drawn across a move
      mine = to;
      repaint();
    };
    window.addEventListener('resize', () => { measure(); reflow(); }, { passive: true });
    window.addEventListener('shell:fit', reflow);
    window.addEventListener('shell:rail', reflow);

    // ---- when the pen may write at all
    let down = false;                // ASLEEP until someone clicks
    const busy = () => BUSY.some((c) => document.documentElement.classList.contains(c));
    const strip = document.getElementById('shell-chrome');
    const side = document.getElementById('shell-side');
    const edge = () => {
      const r = side && side.getBoundingClientRect();
      return r ? Math.max(0, r.right) : 0;
    };
    const open = () => down && !busy() &&
      stage.classList.contains('hint-ready') &&   // the name types first
      !stage.classList.contains('is-scrolled');   // and Work is not the page
    // the page itself, and nothing else: the strip's cream covers that band,
    // so ink laid up there would be stored invisibly and then slide into
    // view the moment the page scrolled
    const over = (e) => {
      if (!rect || e.clientX < edge() || e.clientX > rect.right) return false;
      if (e.clientY > rect.bottom) return false;
      const floor = strip ? strip.getBoundingClientRect().bottom : 0;
      return e.clientY >= floor;
    };

    // ---- the pen. Segments are drawn through the midpoints of the last
    // three samples, which is what turns a polyline of pointer events into
    // a curve, and the width eases toward a speed-derived target so a quick
    // flick runs fine and a slow wander runs full.
    let p0 = null, p1 = null, width = WIDE, lastAt = 0;
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const lift = () => { p0 = p1 = null; };

    document.addEventListener('pointermove', (e) => {
      if (!open() || !over(e)) { lift(); return; }

      const now = e.timeStamp || performance.now();
      const since = now - lastAt;         // read BEFORE the clock moves on
      lastAt = now;
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      // a cursor that has rested is starting a new stroke, not continuing
      // the old one — otherwise the pen rules a line across the whole card
      if (since > LIFT) lift();

      if (!p0) { p0 = p; return; }
      if (!p1) { p1 = p; return; }

      const speed = Math.hypot(p.x - p1.x, p.y - p1.y) / Math.max(since, 1);
      const target = WIDE - (WIDE - FINE) * Math.min(speed / FAST, 1);
      width += (target - width) * 0.3;    // eased, so the line has no steps

      const a = mid(p0, p1), b = mid(p1, p);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(p1.x, p1.y, b.x, b.y);   // p1 is the control point
      ctx.lineWidth = width;
      ctx.stroke();

      // the same segment, kept as geometry against the hero's box: x and y
      // as fractions of the stage's width (one divisor for both, or the
      // drawing would stretch when the card changes shape), and the width
      // with them, so the line thickens and thins with the type it crosses
      const k = mine.w || 1;
      marks.push({
        ax: (a.x - mine.x) / k, ay: (a.y - mine.y) / k,
        cx: (p1.x - mine.x) / k, cy: (p1.y - mine.y) / k,
        bx: (b.x - mine.x) / k, by: (b.y - mine.y) / k,
        // quantised to 1/20000 of the stage — a sixteenth of a pixel at any
        // size the card is ever laid out at, and it is what lets a whole
        // drawing redraw in a dozen strokes (see batch())
        w: Math.round((width / k) * 20000) / 20000,
      });
      if (marks.length > CAP) marks.splice(0, marks.length - CAP);
      batched = null;

      p0 = p1; p1 = p;
    }, { passive: true });

    document.addEventListener('pointerleave', lift);

    // ---- two clicks: the page dissolves. Painted out rather than cleared,
    // so the ink leaves the way it arrived — as a fade, not a cut.
    let wiping = 0;
    const dissolve = () => {
      lift();
      if (wiping) return;
      // the marks go first, the pixels fade after them: from here on there
      // is nothing left to redraw, so a reflow mid-fade finds an empty page
      marks.length = 0;
      batched = null;
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min((t - t0) / WIPE, 1);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);          // device px, whole layer
        if (p < 1) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = 'rgba(0,0,0,' + (0.05 + p * 0.25).toFixed(3) + ')';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);  // the last trace
        }
        ctx.restore();
        wiping = p < 1 ? requestAnimationFrame(step) : 0;
      };
      wiping = requestAnimationFrame(step);
    };

    // ---- one click: the pen comes down, or goes back up. Anything a
    // visitor can actually press is somebody else's click. [role] and
    // [tabindex] are the load-bearing pair: the chrome's tabs are role="tab"
    // SPANS, so an element-name list would toggle the pen on every switch.
    const spare = (e) => !e.target.closest(
      'a, button, input, textarea, select, label, summary, ' +
      '[role], [tabindex], [contenteditable], .side-grip');

    document.addEventListener('click', (e) => {
      if (busy() || stage.classList.contains('is-scrolled')) return;
      if (!over(e) || !spare(e)) return;
      down = !down;
      lift();
    });

    document.addEventListener('dblclick', (e) => {
      if (busy() || stage.classList.contains('is-scrolled')) return;
      if (!over(e) || !spare(e)) return;
      dissolve();
    });

    // ---- letting go. The drawing rides the page: anchored at the
    // document's origin, so scrolling carries it up and off on its own, and
    // it thins out over the second half of the trip so the last of it goes
    // as Work lands. Nothing is destroyed — scroll back up and the drawing
    // is where you left it, pen still down if you left it down.
    const work = document.querySelector('.work-stage');
    let raf = 0;
    const travel = () => {
      raf = 0;
      const y = window.scrollY;
      const to = work ? work.getBoundingClientRect().top + y : window.innerHeight;
      const from = to * HOLD;
      const p = Math.min(Math.max((y - from) / Math.max(to - from, 1), 0), 1);
      canvas.style.opacity = (1 - p).toFixed(3);
      rect = canvas.getBoundingClientRect();   // the sheet travels with the page
    };
    window.addEventListener('scroll', () => {
      if (!raf) raf = requestAnimationFrame(travel);
    }, { passive: true });
    travel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
