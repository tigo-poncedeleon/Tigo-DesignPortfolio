// Horizontal slide transitions between the 4 main pages.
// Must be loaded from <head> (not body) so the pagereveal listener registers
// before the event fires, and so @view-transition picks up the direction class.
// @view-transition { navigation: auto } lives in style.css so it's available
// before any JS runs.

const PAGE_ORDER = ['index.html', 'work.html', 'about.html', 'ai.html'];

function pageIndex(url) {
  const name = new URL(url, location.href).pathname.split('/').pop() || 'index.html';
  return PAGE_ORDER.indexOf(name);
}

// pagereveal fires early — before DOMContentLoaded — so must be registered here in <head>
window.addEventListener('pagereveal', e => {
  const dir = sessionStorage.getItem('slideDir');

  // Apply the correct burger menu state synchronously before the new-page snapshot
  // is taken. The View Transitions API captures the new page AFTER this handler
  // runs, so synchronous DOM changes here are included in the snapshot. This makes
  // the old-page and new-page mobile-nav snapshots identical, so the frozen group
  // shows no visual change — the nav stays perfectly still during the slide.
  const header = document.querySelector('.mobile-header');
  if (header && sessionStorage.getItem('menuOpen') === '1') {
    // Suppress transitions so elements snap to their open positions instantly
    [header, ...header.querySelectorAll('*')].forEach(el => {
      el.style.transition = 'none';
    });
    document.body.classList.add('menu-open');
  }

  if (!dir || !e.viewTransition) return;

  document.documentElement.dataset.transition = dir === '1' ? 'forward' : 'backward';
  window.__trailPaused = true;

  // Re-enable transitions after the snapshot so the burger button still animates
  // when the user manually presses it.
  e.viewTransition.ready.then(() => {
    if (header) {
      [header, ...header.querySelectorAll('*')].forEach(el => {
        el.style.transition = '';
      });
    }
  });

  e.viewTransition.finished.then(() => {
    delete document.documentElement.dataset.transition;
    sessionStorage.removeItem('slideDir');
    window.__trailPaused = false;
  });
});

// Before navigating: record direction so the incoming page knows which way to slide.
// If the cursor trail is active, retract it first so the view-transition snapshot
// captures a blank canvas (prevents trail artifact during the slide).
document.addEventListener('click', e => {
  const link = e.target.closest('a[href]');
  if (!link) return;
  const from = pageIndex(location.href);
  const to   = pageIndex(link.href);
  if (from === -1 || to === -1 || from === to) return;
  sessionStorage.setItem('slideDir', Math.sign(to - from));

  if (typeof window.__trailRetract === 'function') {
    e.preventDefault();
    window.__trailRetract(() => { location.href = link.href; });
  }
  // else: natural navigation (mobile / reduced-motion — trail not loaded)
});
