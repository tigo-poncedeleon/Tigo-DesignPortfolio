// Phase 2: hover-sway. Each landing glyph shifts subtly AWAY from the cursor,
// scaled by proximity. Writes only the inner .glyph transform, so it never
// contends with the GSAP scroll-exit that owns the outer .letter.
// Disabled during the scroll transition via window.__swayEnabled, and off on
// touch / reduced-motion.
window.TextSway = (function () {
  const RADIUS = 120;   // px falloff
  const MAX = 6;        // px max displacement — deliberately subtle

  function init(opts) {
    opts = opts || {};
    if (opts.reduce || window.matchMedia('(hover: none)').matches) return;

    const glyphs = Array.from(document.querySelectorAll('.landing .glyph'));
    if (!glyphs.length) return;

    window.__swayEnabled = true;
    let mx = -9999, my = -9999;

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
    }, { passive: true });

    const state = glyphs.map(() => ({ x: 0, y: 0 }));

    function loop() {
      const active = window.__swayEnabled !== false;
      for (let i = 0; i < glyphs.length; i++) {
        let targetX = 0, targetY = 0;
        if (active) {
          const r = glyphs[i].getBoundingClientRect();
          const gx = r.left + r.width / 2;
          const gy = r.top + r.height / 2;
          const dx = gx - mx, dy = gy - my;
          const dist = Math.hypot(dx, dy);
          if (dist < RADIUS && dist > 0.001) {
            const force = (1 - dist / RADIUS) * MAX;
            targetX = (dx / dist) * force;
            targetY = (dy / dist) * force;
          }
        }
        const s = state[i];
        s.x += (targetX - s.x) * 0.15;
        s.y += (targetY - s.y) * 0.15;
        glyphs[i].style.transform = 'translate(' + s.x.toFixed(2) + 'px,' + s.y.toFixed(2) + 'px)';
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  return { init };
})();
