// Work — one screen of doors. The stage fades in, the tiles rise in turn
// (CSS stagger off .revealed), and a light spy keeps the hash + rail honest
// while the grid is on screen. The doors themselves are case-overlay's
// business (js/case-overlay.js).
(() => {
  const stage = document.querySelector('.work-stage');
  if (stage) requestAnimationFrame(() => stage.classList.add('revealed'));

  const slide = document.getElementById('work');
  if (!slide) return;

  // ?reveal=1 — screenshot-harness hook: skip the entrances
  if (new URLSearchParams(location.search).has('reveal')) {
    slide.classList.add('revealed');
  }

  const MOBILE = window.matchMedia('(max-width: 700px)').matches;

  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('revealed');
      if (MOBILE) return;
      // the sidebar hears where the page is; the hash mirrors it (replace,
      // never push) so refresh and back/forward land on the grid
      window.dispatchEvent(new CustomEvent('shell:section', { detail: { id: 'work' } }));
      if (window.__hashReady && location.hash !== '#work') {
        history.replaceState(null, '', '#work');
      }
    }),
    MOBILE ? { threshold: 0.15 } : { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
  );
  io.observe(slide);

  // deep links — including the retired slide ids (#vicino / #pantrypal /
  // #drone), which live on as the cards' ids — land on the grid.
  // A pixel-exact tab restore (js/shell.js) outranks the section jump.
  //
  // NOT scrollIntoView({block:'start'}): that puts the slide's top edge at
  // y=0, which is UNDER the sticky chrome strip — the title lands tucked
  // behind the tab bar, 40px short of where the rail's own Work link leaves
  // it. Aim at the same rest position the rail does: the strip's floor.
  //
  // …and it has to be re-laid, because the browser's own anchor jump for
  // #vicino / #pantrypal / #drone (those ids are real elements INSIDE the
  // grid) re-runs after this file does — at load, and again once the late
  // images give the card its final height — and each time it drags the
  // heading off the top. So hold the landing until the visitor takes over:
  // the first real input (wheel, touch, key) hands the scroll back for good.
  const land = () => {
    const head = document.getElementById('shell-chrome');
    const y = slide.getBoundingClientRect().top + window.scrollY -
      (head ? head.offsetHeight : 0);
    window.scrollTo({ top: Math.max(0, Math.round(y)), behavior: 'instant' });
  };
  const wanted = location.hash && location.hash.length > 1 &&
    document.querySelector(location.hash);
  if (wanted && slide.contains(wanted) && !window.__pixelRestore) {
    // Re-land on a slow poll rather than every frame. Per-frame is worse
    // here, not better: it races the browser's own fragment scroll and the
    // two trade the page back and forth. A tick every 100ms lands AFTER each
    // of them has had its say, and keeps landing while the layout is still
    // settling — on a first visit the intro types for a second or more and
    // only then does the rail slide in, which changes the card's scale,
    // which changes --hero-h, which is this slide's own height.
    // The deadline cannot be a fixed one. On a first visit the grid does not
    // reach its resting place until the intro has assembled: the rail slides
    // in at the very end, which re-scales the card, which re-measures
    // --hero-h — this slide's own height — and drops the grid another 40px
    // as the chrome strip takes its place in the flow. Each event that can
    // still move it pushes the deadline out; a visitor who scrolls in the
    // meantime takes the page back on the first touch.
    // `intro-pending` is the honest signal for "the grid is still moving":
    // it is on the root from before first paint and comes off when the intro
    // has assembled. A deadline alone expires seconds early on a cold visit,
    // which is exactly how the landing ended up 8px short of the strip.
    const root = document.documentElement;
    const stop = performance.now() + 8000;        // never poll forever
    let held = true;
    let until = performance.now() + 1200;
    const timer = setInterval(() => {
      const now = performance.now();
      const settling = root.classList.contains('intro-pending');
      if (!held || now > stop || (!settling && now > until)) { release(); return; }
      land();
    }, 100);
    function release() { held = false; clearInterval(timer); }
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) =>
      window.addEventListener(t, release, { once: true, passive: true }));
    const extend = (ms) => { until = Math.max(until, performance.now() + ms); };
    window.addEventListener('load', () => extend(400));
    window.addEventListener('shell:fit', () => extend(400));
    window.addEventListener('shell:intro-done', () => extend(1600));
    land();
  }
  setTimeout(() => { window.__hashReady = true; }, 600);
})();
