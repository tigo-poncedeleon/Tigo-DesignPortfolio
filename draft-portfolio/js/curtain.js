// Phase 1 animation: the stick figure walks from the right edge across to the
// left, pushing the black curtain off the left edge and revealing the content
// behind it. Slow (~7s) and auto-plays on load.
//
// The figure is on its own layer ABOVE the curtain (drawn dark), and the
// curtain's right edge is glued to the figure via clip-path each frame, so it
// always looks like the figure is shoving the black wall leftward.
window.Curtain = (function () {
  const WALK_DURATION = 7;   // seconds, full traversal
  const STEP = 0.5;          // seconds per half-stride

  function play(opts) {
    opts = opts || {};
    const onDone = typeof opts.onDone === 'function' ? opts.onDone : function () {};
    const curtain = document.getElementById('curtain');
    const figure = document.getElementById('stick-figure');

    if (!curtain) { onDone(); return; }

    const finish = () => {
      curtain.style.pointerEvents = 'none';
      curtain.style.visibility = 'hidden';
      if (figure) figure.style.display = 'none';
      onDone();
    };

    // Reduced motion / no GSAP: uncover instantly (page stays usable).
    if (opts.reduce || !window.gsap || !figure) {
      finish();
      return;
    }

    const gsap = window.gsap;
    const vw = window.innerWidth;
    const figW = figure.offsetWidth || 180;

    // ---- Infinite walk cycle (legs + arms in opposite phase, body bob) ----
    const cycles = [];
    const swing = (sel, from, to, origin) =>
      gsap.fromTo(sel, { rotation: from }, {
        rotation: to, duration: STEP, ease: 'sine.inOut',
        yoyo: true, repeat: -1, svgOrigin: origin,
      });

    cycles.push(swing('#leg-front', 20, -20, '92 166'));
    cycles.push(swing('#leg-back', -20, 20, '92 166'));
    cycles.push(swing('#arm-back', 14, -14, '92 82'));   // back arm swings with the walk
    cycles.push(gsap.to('#fig-bob', {
      y: -6, duration: STEP / 2, ease: 'sine.inOut', yoyo: true, repeat: -1,
    }));
    // #arm-front stays extended (the hand pressed against the curtain).

    // ---- Master traversal: figure right -> left; the curtain's edge is glued
    // to the figure's HAND, so it looks pushed by the hand, not the head. ----
    const hand = document.getElementById('arm-front');
    const setClip = () => {
      const r = (hand || figure).getBoundingClientRect();
      const edge = r.left + 6;                     // black meets the hand (slight press)
      const inset = Math.max(0, vw - edge);
      curtain.style.clipPath = 'inset(0 ' + inset + 'px 0 0)';
    };

    gsap.fromTo(figure,
      { x: vw },                                    // start off the right edge
      {
        x: -figW,                                   // exit off the left edge
        duration: WALK_DURATION,
        ease: 'none',                               // steady walking pace
        onUpdate: setClip,
        onComplete: () => { cycles.forEach((c) => c.kill()); finish(); },
      });
    setClip();
  }

  return { play };
})();
