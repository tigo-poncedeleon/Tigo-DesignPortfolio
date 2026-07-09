// Phase 3: scroll-linked LETTER MORPH. Instead of the landing letters flying off
// the screen, each of the 15 name letters travels to the position of a nav letter
// ("about work play ai" — also 15 letters) and crossfades into it at arrival, so
// the original letters appear to seamlessly become the nav words. The subtitle
// letters converge inward and fade; the portrait fades out.
// One pinned, scrubbed timeline — fully reversible.
window.ScrollTransition = (function () {
  function init(opts) {
    opts = opts || {};
    if (!window.gsap || !window.ScrollTrigger) return;
    const gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);
    const nav = document.getElementById('nav-page');

    // ---- Reduced motion: plain crossfade landing -> nav ----
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

    const build = () => {
      const nameLetters = gsap.utils
        .toArray('#landing .name .letter')
        .filter((el) => !el.classList.contains('space'));
      const subLetters = gsap.utils
        .toArray('#landing .subtitle .letter')
        .filter((el) => !el.classList.contains('space'));
      const navLetters = gsap.utils.toArray('#nav-page .navletter');

      // Nav container visible, but each nav letter individually hidden until the
      // crossfade at the end (so nothing shows behind the landing meanwhile).
      gsap.set(nav, { autoAlpha: 1 });
      nav.style.pointerEvents = 'none';
      gsap.set(navLetters, { autoAlpha: 0 });

      const center = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      };
      const vwCenter = window.innerWidth / 2;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#stage', start: 'top top', end: '+=1600',
          scrub: 1, pin: true, anticipatePin: 1,
          onUpdate: (self) => {
            const p = self.progress;
            window.__swayEnabled = p < 0.001;
            const live = p > 0.98;
            nav.classList.toggle('nav-live', live);
            nav.style.pointerEvents = live ? 'auto' : 'none';
          },
        },
      });

      // Hero morph: name letter i -> nav letter i, then crossfade at arrival.
      const n = Math.min(nameLetters.length, navLetters.length);
      for (let i = 0; i < n; i++) {
        const a = center(nameLetters[i]);
        const b = center(navLetters[i]);
        tl.to(nameLetters[i], {
          x: b.x - a.x, y: b.y - a.y,
          ease: 'power2.inOut', duration: 0.82,
        }, 0);
        // crossfade — traveler out, nav letter in, at the same spot
        tl.to(nameLetters[i], { autoAlpha: 0, duration: 0.16, ease: 'none' }, 0.8);
        tl.to(navLetters[i], { autoAlpha: 1, duration: 0.16, ease: 'none' }, 0.82);
      }
      // any leftover nav letters (if counts ever differ) just fade in at the end
      for (let i = n; i < navLetters.length; i++) {
        tl.to(navLetters[i], { autoAlpha: 1, duration: 0.16 }, 0.82);
      }

      // Subtitle letters converge toward center and fade out early.
      subLetters.forEach((el, i) => {
        const a = center(el);
        tl.to(el, {
          x: (vwCenter - a.x) * 0.65,
          y: -30 - (i % 6) * 5,
          autoAlpha: 0,
          ease: 'power2.in', duration: 0.45,
        }, 0);
      });

      // Portrait fades out as the letters travel.
      tl.to('.portrait-wrap', { autoAlpha: 0, ease: 'none', duration: 0.55 }, 0);
    };

    // Measure after webfonts load so letter positions are exact.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(build);
    } else {
      build();
    }
  }

  return { init };
})();
