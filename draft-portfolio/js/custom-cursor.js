// Phase 2: custom arrow cursor that follows the mouse (native cursor hidden in CSS).
// Single element, lerped toward the pointer for a slight trailing feel.
// This is NOT the removed goo/metaball paint-trail — just one follower.
window.CustomCursor = (function () {
  function init() {
    const el = document.getElementById('cursor');
    if (!el) return;
    if (window.matchMedia('(hover: none)').matches) return; // touch: leave native cursor

    let tx = -100, ty = -100;   // target (pointer)
    let cx = -100, cy = -100;   // current (rendered)
    let seen = false;

    window.addEventListener('mousemove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!seen) { cx = tx; cy = ty; seen = true; }
    }, { passive: true });

    // hide when the pointer leaves the window
    window.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) el.style.opacity = '0';
    });
    window.addEventListener('mouseover', () => { el.style.opacity = '1'; });

    function loop() {
      cx += (tx - cx) * 0.35;
      cy += (ty - cy) * 0.35;
      // tip of the arrow sits at svg ~(1,1); nudge so it lands on the pointer
      el.style.transform = 'translate(' + (cx - 1) + 'px,' + (cy - 1) + 'px)';
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  return { init };
})();
