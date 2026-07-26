// Play page pager + wheel paging — the same mechanics as js/work.js:
// vertical wheel gestures advance the HORIZONTAL snap scroller one game at
// a time, and the active dot tracks whichever game is snapped into view.
(() => {
  const scroller = document.getElementById('play-scroll');
  const slides = Array.from(document.querySelectorAll('.play-slide'));
  const dots = Array.from(document.querySelectorAll('.play-dot'));
  if (!scroller || !slides.length || dots.length !== slides.length) return;

  const prefersReduced =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // One page per vertical gesture — deltas accumulate within a gesture
  // (>150ms gap = new one) and each gesture fires at most once. The games
  // never see wheel events, so this can't fight pong/snake input.
  let lastWheel = 0;
  let acc = 0;
  let fired = false;
  scroller.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;  // native horizontal
    e.preventDefault();
    const now = performance.now();
    if (now - lastWheel > 150) { acc = 0; fired = false; }
    lastWheel = now;
    acc += e.deltaY;
    if (fired || Math.abs(acc) < 30) return;
    fired = true;
    const i = Math.round(scroller.scrollLeft / scroller.clientWidth);
    const next = Math.min(Math.max(i + (acc > 0 ? 1 : -1), 0), slides.length - 1);
    if (next === i) return;
    slides[next].scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      inline: 'start',
    });
  }, { passive: false });

  const setCurrent = (id) => {
    dots.forEach((dot) => {
      if (dot.getAttribute('href') === '#' + id) dot.setAttribute('aria-current', 'page');
      else dot.removeAttribute('aria-current');
    });
    // mirror the game into the URL (replace, never push) so refresh
    // and back/forward land on the board the visitor actually saw
    if (window.__hashReady && location.hash.slice(1) !== id && (location.hash || id !== slides[0].id)) {
      history.replaceState(null, '', '#' + id);
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setCurrent(e.target.id); });
    },
    { root: document.getElementById('play-scroll'), threshold: 0.6 }
  );
  slides.forEach((s) => observer.observe(s));

    // restore a deep link deterministically — the native anchor scroll can
    // lose the race against the snap scroller and the scroll-spy; only
    // after settling does the spy start mirroring the hash back
    const target = slides.find((s) => '#' + s.id === location.hash);
    if (target) target.scrollIntoView({ behavior: 'instant', inline: 'start' });
    setTimeout(() => { window.__hashReady = true; }, 600);

})();
