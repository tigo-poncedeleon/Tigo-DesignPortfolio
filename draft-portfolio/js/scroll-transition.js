// Phase 3: scroll-linked transition, one pinned scrub timeline on #stage.
//   Segment A (0 -> ~0.49): landing letters fling out to the edges, wavy + staggered.
//   Segment B (0 -> 0.45):  portrait fades out.
//   Gate (0.55):            reveal #nav-page (strictly after the letters have gone).
//   Segment C (0.58 -> 1):  nav words assemble, entering from alternating sides.
// Fully reversible under scrubbing. Reduced motion -> plain crossfade.
window.ScrollTransition = (function () {
  function init(opts) {
    opts = opts || {};
    if (!window.gsap || !window.ScrollTrigger) return;
    const gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);

    const nav = document.getElementById('nav-page');

    // ---- Reduced motion: crossfade landing -> nav over the pin distance ----
    if (opts.reduce) {
      gsap.set(nav, { autoAlpha: 0 });
      const tl = gsap.timeline({
        scrollTrigger: { trigger: '#stage', start: 'top top', end: '+=1000', scrub: true, pin: true },
      });
      tl.to('#landing', { autoAlpha: 0, duration: 0.5 }, 0);
      tl.set(nav, { autoAlpha: 1 }, 0.5);
      tl.to(nav, { autoAlpha: 1, duration: 0.5 }, 0.5);
      tl.eventCallback('onUpdate', () => {
        const done = tl.progress() > 0.9;
        nav.classList.toggle('nav-live', done);
        nav.style.pointerEvents = done ? 'auto' : 'none';
      });
      return;
    }

    const letters = gsap.utils.toArray('#landing .letter');
    const n = letters.length;

    // Deterministic fan-out (no live measurement mid-transform): left half exits
    // left, right half exits right; magnitude grows toward the ends; wavy y.
    const dir = (i) => (i < n / 2 ? -1 : 1);
    const spread = (i) => {
      const half = n / 2;
      const d = Math.abs(i - (half - 0.5)) / half; // 0 at center -> ~1 at ends
      return 0.55 + 0.45 * d;
    };

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#stage',
        start: 'top top',
        end: '+=1600',
        scrub: 1,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;
          window.__swayEnabled = p < 0.001;
          const live = p > 0.985;
          nav.classList.toggle('nav-live', live);
          nav.style.pointerEvents = live ? 'auto' : 'none';
        },
      },
    });

    // Segment A — letters fling out toward nearest edge, wavy stagger
    tl.to(letters, {
      x: (i) => dir(i) * window.innerWidth * spread(i),
      y: (i) => Math.sin(i * 0.9) * 120,
      rotation: (i) => dir(i) * (18 + (i % 5) * 6),
      autoAlpha: 0,
      ease: 'power2.in',
      duration: 0.3,
      stagger: { each: 0.012, from: 'center' },
    }, 0);

    // Segment B — portrait fades out (wrap covers the mobile-face fallback too)
    tl.to('.portrait-wrap', { autoAlpha: 0, ease: 'none', duration: 0.45 }, 0);

    // Segment C — nav words assemble from alternating sides.
    // Explicit set + to (not from) so it stays deterministic under scrubbing.
    const offX = (i) => (i % 2 === 0 ? -1 : 1) * window.innerWidth * 0.6;
    tl.set('#nav-page .navword', { x: offX, autoAlpha: 0 }, 0);
    // Gate — nav container becomes visible only after the letters are fully gone
    tl.set(nav, { autoAlpha: 1 }, 0.55);
    tl.to('#nav-page .navword', {
      x: 0,
      autoAlpha: 1,
      ease: 'power3.out',
      duration: 0.32,
      stagger: { each: 0.04, from: 'edges' },
    }, 0.58);
  }

  return { init };
})();
