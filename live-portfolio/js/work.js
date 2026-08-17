// Work — one screen of doors, on the page. Nothing fades or rises: the
// section has no entrance (css/styles.css), so all this file does is spy —
// keeping the hash and the rail honest while the grid is in view. The doors
// themselves are case-overlay's business (js/case-overlay.js).
(() => {
  const slide = document.getElementById('work');
  if (!slide) return;

  const MOBILE = window.matchMedia('(max-width: 700px)').matches;

  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting || MOBILE) return;
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
  // behind the tab bar, short of where the rail's own Work link leaves it.
  // Ask the rail where it would leave it, and hold the page there while the
  // rest of it assembles: Shell.land, which is this file's own poller moved
  // somewhere About and Play could reach it too.
  //
  // …on a laptop. ≤700px Work is a SCREEN you tap to, not a place you
  // scroll to: js/mobile.js puts it at the top of the document on arrival
  // and there is no chrome strip to land under, so the poller would spend
  // eight seconds re-asserting a scroll of zero.
  const wanted = !MOBILE && location.hash && location.hash.length > 1 &&
    document.querySelector(location.hash);
  if (wanted && slide.contains(wanted) && !window.__pixelRestore) {
    if (window.Shell && window.Shell.land) window.Shell.land(slide);
    else slide.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  setTimeout(() => { window.__hashReady = true; }, 600);
})();
