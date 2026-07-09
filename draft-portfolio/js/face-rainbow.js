// Phase 2: rainbow filter on the portrait — fades in on hover, auto-rotates the
// hue, fades out on leave. Ported verbatim from working-portfolio/index.js.
window.FaceRainbow = (function () {
  function init() {
    const headCanvas = document.getElementById('head-canvas');
    if (!headCanvas) return;
    let rafId = null, intensity = 0, hue = 0, active = false;

    function tick() {
      intensity = active
        ? Math.min(1, intensity + 0.04)
        : Math.max(0, intensity - 0.04);
      hue = (hue + 2) % 360;

      headCanvas.style.filter = intensity > 0.001
        ? `sepia(${intensity}) saturate(${intensity * 5}) hue-rotate(${hue}deg)`
        : '';

      rafId = (intensity > 0 || active) ? requestAnimationFrame(tick) : null;
    }

    headCanvas.addEventListener('mouseenter', () => {
      active = true;
      if (!rafId) rafId = requestAnimationFrame(tick);
    });
    headCanvas.addEventListener('mouseleave', () => {
      active = false;
      if (!rafId) rafId = requestAnimationFrame(tick);
    });
  }

  return { init };
})();
