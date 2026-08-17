// Play — one screen of live tiles. A light spy keeps the hash + rail honest
// while the grid is on screen; the tiles themselves are the theater's
// business (js/theater.js), and the games idle inside them untouched.
(() => {
  const slide = document.getElementById('play');
  if (!slide) return;

  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      window.dispatchEvent(new CustomEvent('shell:section', { detail: { id: 'play' } }));
      if (window.__hashReady && location.hash !== '#play') {
        history.replaceState(null, '', '#play');
      }
    }),
    { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
  );
  io.observe(slide);

  // deep links — including the retired slide ids (#pong / #snake / #flappy),
  // which live on as the tiles' ids — land on the grid. A pixel-exact tab
  // restore (js/shell.js) outranks the section jump.
  const wanted = location.hash && location.hash.length > 1 &&
    document.querySelector(location.hash);
  // …at the rail's own resting place, and HELD there while the page finishes
  // assembling (Shell.land). block:'start' put the grid's top edge under the
  // sticky strip, and landing once left it wherever the intro's last reflow
  // pushed it — neither is where clicking Play in the rail leaves it.
  if (wanted && slide.contains(wanted) && !window.__pixelRestore) {
    if (window.Shell && window.Shell.land) window.Shell.land(slide);
    else slide.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  setTimeout(() => { window.__hashReady = true; }, 600);
})();
