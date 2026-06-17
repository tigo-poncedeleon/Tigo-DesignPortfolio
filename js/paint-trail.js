// "Paint-through-the-screen" cursor trail.
// A full-viewport canvas painted white under mix-blend-mode:difference, so the
// stroke is the per-pixel inverse of whatever is on screen. Soft radial stamps are
// interpolated along the cursor path and fused into liquid metaballs by an SVG goo
// filter. The painting is PERMANENT: stamps accumulate on the canvas and are never
// cleared or healed, so the trail stays for the life of the page. Each page load
// starts blank (navigating to about/work resets it); a light/dark toggle never
// touches the canvas, so the existing painting persists and just re-inverts.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(max-width: 1024px)').matches) return; // disabled on mobile for performance

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
  const BRUSH_R = 13;     // stroke radius
  const SAMPLE = 3;       // mark spacing along the path (small = continuous)

  let rawX = 0, rawY = 0, hasCursor = false;
  let spX = 0, spY = 0;            // smoothed paint position
  let lastX = 0, lastY = 0;        // last stamped point (for interpolation)
  let haveStamp = false;
  let running = false;
  let lastMove = -Infinity;
  const IDLE_MS = 250;             // pause the loop once the cursor is still this long

  function onMove(e) {
    rawX = e.clientX;
    rawY = e.clientY;
    hasCursor = true;
    lastMove = performance.now();
    if (!running) {
      // resuming from idle: snap to the cursor and lift the "pen" so we don't
      // paint a streak connecting the old spot to wherever the cursor reappeared
      spX = rawX; spY = rawY;
      haveStamp = false;
      running = true;
      requestAnimationFrame(frame);
    }
  }

  function onLeave() { hasCursor = false; }

  // Don't register the cursor until the homepage intro animations are done: the
  // intro typing (signalled by `body.loaded`) AND the text scramble
  // (`window.__textScrambleActive`). Other pages have no intro/scramble, so the
  // trail starts immediately there.
  function startWhenReady() {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
  }

  if (!document.getElementById('intro')) {
    startWhenReady();
  } else {
    const afterLoaded = () => {
      // defer one task so the scramble (which also keys off `loaded`) has run and
      // flipped its flag on, then poll until it finishes
      setTimeout(function poll() {
        if (!window.__textScrambleActive) startWhenReady();
        else setTimeout(poll, 50);
      }, 0);
    };
    if (document.body.classList.contains('loaded')) {
      afterLoaded();
    } else {
      const obs = new MutationObserver(() => {
        if (document.body.classList.contains('loaded')) {
          obs.disconnect();
          afterLoaded();
        }
      });
      obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function stamp(x, y, r) {
    const d = r * 1.9 * 2; // sprite spans the full feathered diameter
    ctx.drawImage(sprite, x - d / 2, y - d / 2, d, d);
  }

  function frame() {
    // ease the paint position toward the cursor and stamp the new segment
    spX += (rawX - spX) * 0.35;
    spY += (rawY - spY) * 0.35;

    if (!haveStamp) {
      stamp(spX, spY, BRUSH_R);
      lastX = spX; lastY = spY; haveStamp = true;
    } else {
      // interpolate dense stamps along the path for a continuous stroke
      const dist = Math.hypot(spX - lastX, spY - lastY);
      if (dist >= SAMPLE) {
        const n = Math.ceil(dist / SAMPLE);
        for (let k = 1; k <= n; k++) {
          const f = k / n;
          stamp(lastX + (spX - lastX) * f, lastY + (spY - lastY) * f, BRUSH_R);
        }
        lastX = spX; lastY = spY;
      }
    }

    // No clear, no heal — the painting is permanent and accumulates on the canvas.
    // Pause the loop once the cursor has been still a moment and we've caught up to
    // it (or it left the window); the next mousemove resumes it.
    const idle = performance.now() - lastMove > IDLE_MS;
    const settled = Math.hypot(rawX - spX, rawY - spY) < 0.5;
    if ((idle && settled) || !hasCursor) { running = false; return; }
    requestAnimationFrame(frame);
  }
})();
