// Work page — stage fade-in, pager-dot tracking, and vertical-wheel → page
// translation for the HORIZONTAL snap scroller. Horizontal trackpad swipes
// scroll natively (CSS snap does the rest); a vertical wheel/swipe advances
// exactly one slide per gesture.
(() => {
  const stage = document.querySelector('.work-stage');
  if (stage) requestAnimationFrame(() => stage.classList.add('revealed'));

  const scroller = document.getElementById('work-scroll');
  const slides = Array.from(document.querySelectorAll('.work-slide'));
  const dots = Array.from(document.querySelectorAll('.work-dot'));
  if (!scroller || !slides.length || dots.length !== slides.length) return;

  const prefersReduced =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ?reveal=1 — screenshot-harness hook: skip the entrances
  if (new URLSearchParams(location.search).has('reveal')) {
    slides.forEach((s) => s.classList.add('revealed'));
  }

  // ≤700px the carousel unrolls into one vertical document scroll (see
  // work.css): no wheel-paging, no dot pager — each project just rises in
  // as it enters the viewport
  if (window.matchMedia('(max-width: 700px)').matches) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('revealed');
      }),
      { threshold: 0.15 }
    );
    slides.forEach((s) => io.observe(s));
    return;
  }

  // One page per vertical gesture. Deltas ACCUMULATE within a gesture (a
  // >150ms gap starts a new one) and the page turns once the running total
  // crosses the threshold — so a slow deliberate scroll still moves, a
  // mouse-wheel notch (~100) fires immediately, and trackpad inertia can't
  // multi-advance because each gesture fires at most once.
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
    // the sidebar hears where the page is. Emitted BEFORE the
    // __hashReady gate below, so the rail never lags the scroll.
    window.dispatchEvent(new CustomEvent('shell:section', { detail: { id: id } }));
    dots.forEach((dot) => {
      if (dot.getAttribute('href') === '#' + id) dot.setAttribute('aria-current', 'page');
      else dot.removeAttribute('aria-current');
    });
    // mirror the project into the URL (replace, never push) so refresh
    // and back/forward land on the slide the visitor actually saw
    if (window.__hashReady && location.hash.slice(1) !== id && (location.hash || id !== slides[0].id)) {
      history.replaceState(null, '', '#' + id);
    }
  };

  // a slide majority-visible in the scroller = the current project
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setCurrent(e.target.id); });
    },
    { root: document.getElementById('work-scroll'), threshold: 0.6 }
  );
  slides.forEach((s) => observer.observe(s));

    // restore a deep link deterministically — the native anchor scroll can
    // lose the race against the snap scroller and the scroll-spy; only
    // after settling does the spy start mirroring the hash back
    const target = slides.find((s) => '#' + s.id === location.hash);
    if (target) target.scrollIntoView({ behavior: 'instant', inline: 'start' });
    setTimeout(() => { window.__hashReady = true; }, 600);

})();
