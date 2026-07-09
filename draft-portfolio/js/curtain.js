// Phase 1 animation: the stick figure leans into the curtain and pushes it
// off-screen to the left, revealing the landing beneath. Auto-plays on load.
window.Curtain = (function () {
  function play(opts) {
    opts = opts || {};
    const onDone = typeof opts.onDone === 'function' ? opts.onDone : function () {};
    const curtain = document.getElementById('curtain');
    if (!curtain) { onDone(); return; }

    const finish = () => {
      curtain.style.pointerEvents = 'none';
      curtain.style.visibility = 'hidden';
      onDone();
    };

    // Reduced motion: no slide, just uncover immediately (page stays usable).
    if (opts.reduce || !window.gsap) {
      finish();
      return;
    }

    const gsap = window.gsap;
    const figure = document.getElementById('stick-figure');
    const arm = curtain.querySelector('.arm-push');

    const tl = gsap.timeline({ onComplete: finish });

    // brief hold so the geo text/clock register
    tl.to({}, { duration: 0.5 });

    // wind-up: lean toward the curtain
    if (figure) {
      tl.to(figure, { rotation: -7, x: -6, duration: 0.35, ease: 'power2.out' }, '>');
    }
    // shove: figure straightens/pushes while the whole curtain slides left
    if (figure) {
      tl.to(figure, { rotation: 2, duration: 0.9, ease: 'power2.in' }, '>');
    }
    if (arm) {
      tl.to(arm, { attr: { x2: 2, y2: 108 }, duration: 0.9, ease: 'power2.in' }, '<');
    }
    tl.to(curtain, { xPercent: -100, duration: 1.05, ease: 'power3.inOut' }, '<0.05');

    return tl;
  }

  return { play };
})();
