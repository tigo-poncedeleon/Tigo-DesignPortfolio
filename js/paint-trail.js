// "Paint-through-the-screen" cursor trail.
// A full-viewport canvas painted white under mix-blend-mode:difference, so the
// stroke is the per-pixel inverse of whatever is on screen. Reuses the about-page
// blob mechanism: soft radial stamps interpolated along the cursor path, fused
// into liquid metaballs by an SVG goo filter, slowly healing away (quicksand).
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ---- Inject goo filter (distinct id so about.html's #goo is untouched) ----
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML =
    '<defs><filter id="goo-trail" color-interpolation-filters="sRGB">' +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>' +
    '<feColorMatrix in="blur" mode="matrix" ' +
    'values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo"/>' +
    '</filter></defs>';
  document.body.appendChild(svg);

  // ---- Canvas ---------------------------------------------------------------
  const canvas = document.createElement('canvas');
  canvas.id = 'paint-trail-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(DPR, DPR);
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- Pre-baked feathered brush sprite (white core -> transparent edge) ----
  const sprite = document.createElement('canvas');
  const SPRITE = 128;
  sprite.width = sprite.height = SPRITE;
  const sCtx = sprite.getContext('2d');
  const sGrad = sCtx.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
  sGrad.addColorStop(0,    'rgba(255,255,255,1)');
  sGrad.addColorStop(0.45, 'rgba(255,255,255,1)');
  sGrad.addColorStop(1,    'rgba(255,255,255,0)');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, SPRITE, SPRITE);

  // ---- Trail state ----------------------------------------------------------
  const trail = [];
  const BRUSH_R = 13;     // stroke radius
  const HEAL = 0.10;      // px shed per frame (~2-3s to fully heal = quicksand)
  const SAMPLE = 3;       // mark spacing along the path (small = continuous)
  const MAX_MARKS = 700;

  let rawX = -9999, rawY = -9999, hasCursor = false;
  let spX = 0, spY = 0;          // smoothed paint position
  let spInit = false;
  let running = false;
  let lastMove = -Infinity;
  const IDLE_MS = 250;           // stop adding marks once the cursor is still this long

  window.addEventListener('mousemove', e => {
    rawX = e.clientX;
    rawY = e.clientY;
    if (!spInit) { spX = rawX; spY = rawY; spInit = true; }
    hasCursor = true;
    lastMove = performance.now();
    if (!running) { running = true; requestAnimationFrame(frame); }
  });

  window.addEventListener('mouseleave', () => { hasCursor = false; });

  function stamp(x, y, r) {
    const d = r * 1.9 * 2; // sprite spans the full feathered diameter
    ctx.drawImage(sprite, x - d / 2, y - d / 2, d, d);
  }

  function frame() {
    const moving = hasCursor && (performance.now() - lastMove < IDLE_MS);

    // smooth the paint position toward the raw cursor
    if (moving) {
      spX += (rawX - spX) * 0.35;
      spY += (rawY - spY) * 0.35;

      // interpolate marks densely along the path for a continuous stroke
      const last = trail[trail.length - 1];
      if (!last) {
        trail.push({ x: spX, y: spY, r: BRUSH_R });
      } else {
        const dist = Math.hypot(spX - last.x, spY - last.y);
        if (dist >= SAMPLE) {
          const n = Math.ceil(dist / SAMPLE);
          for (let k = 1; k <= n; k++) {
            const f = k / n;
            trail.push({
              x: last.x + (spX - last.x) * f,
              y: last.y + (spY - last.y) * f,
              r: BRUSH_R,
            });
          }
          while (trail.length > MAX_MARKS) trail.shift();
        }
      }
    }

    // quicksand healing: every mark slowly shrinks back to nothing
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].r -= HEAL;
      if (trail[i].r <= 0.5) trail.splice(i, 1);
    }

    ctx.clearRect(0, 0, W, H);
    for (const m of trail) stamp(m.x, m.y, m.r);

    // idle once nothing is left to draw and the cursor has gone still;
    // the next mousemove restarts the loop
    if (trail.length === 0 && !moving) {
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  }
})();
