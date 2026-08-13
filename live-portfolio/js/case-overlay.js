// The case doors — a case study is a PAGE now, not an overlay.
//
// This file used to build a fixed frame over the card and load the story
// into an iframe, so a case could open without leaving index.html. It read
// well and it cost too much: a same-origin iframe is a SECOND full document
// in the same renderer, and the two of them together — plus the stack of
// viewport-sized composited layers the overlay needed — put the page over
// Chrome's tile-memory budget. Past that line Chrome stops rastering and
// simply does not draw: "tile memory limits exceeded, some content may not
// draw". Zooming made it worse, not better, because raster scale is
// devicePixelRatio x zoom, so zooming IN asks for more memory. Measured:
// ~190 megapixels of layers on the overlay path against 73.6 for the very
// same case study as its own page, which throws no warnings at any zoom.
//
// So the doors just open. Every link to a case study is already a real
// <a href> to a real page; all that is left here is the two things the
// overlay was doing that are still worth having:
//
//   · on the work grid — prime the page behind a door on hover, so the
//     click lands on a document the cache already has;
//   · on a case study — the × in the corner, and Escape, back to the work
//     you came from.
//
// Everything else the browser does better than we did: Back is Back,
// the URL is a real URL you can send someone, and there is only ever one
// document alive at a time.
(() => {
  if (window.matchMedia('(max-width: 700px)').matches) return;   // phones already navigated

  const CASES = {
    vicino:    { href: 'vicino.html',    thumb: '.work-img-vicino' },
    pantrypal: { href: 'pantrypal.html', thumb: '.work-img-pantry' },
    nextlevel: { href: 'nextlevel.html', thumb: '.work-img-drone' },
  };

  // ---- old links keep working. ?case=<id> was the overlay's URL for two
  // years of bookmarks, shared links and saved tab records; it now means
  // "the case page", so send it there rather than dropping the reader on
  // the home page wondering where the story went. replace(), not assign(),
  // so Back does not bounce off the redirect.
  const legacy = new URLSearchParams(location.search).get('case');
  if (legacy && CASES[legacy] && document.querySelector('.work-stage')) {
    location.replace(CASES[legacy].href + location.hash);
    return;
  }

  // ---- on the work grid: hovering a door primes the page behind it
  // (the tabs.js idiom). The href is the real one now, so the prefetch and
  // the navigation are the same URL and the cache actually hits.
  if (document.querySelector('.work-stage')) {
    const primed = new Set();
    Object.keys(CASES).forEach((k) => {
      const t = document.querySelector(CASES[k].thumb);
      if (!t) return;
      t.addEventListener('pointerover', () => {
        const href = CASES[k].href;
        if (primed.has(href)) return;
        primed.add(href);
        const l = document.createElement('link');
        l.rel = 'prefetch';
        l.as = 'document';
        l.href = href;
        document.head.appendChild(l);
      }, { passive: true });
    });
  }

  // ---- on a case study: the way back.
  // The rail and the chrome's own back arrow were always here; this is the
  // × in the story's corner, in the same place it has always been, so the
  // habit still works. It prefers history.back() when we came from this
  // site — that returns the work grid to the exact row you left it on —
  // and falls back to the grid itself when the case was opened cold.
  const stage = document.querySelector('.case-stage');
  if (!stage || document.documentElement.classList.contains('is-embed')) return;

  const back = () => {
    let sameSite = false;
    try {
      sameSite = !!document.referrer &&
        new URL(document.referrer).origin === location.origin &&
        !/(vicino|pantrypal|nextlevel)\.html/.test(document.referrer);
    } catch (err) { /* opaque referrer — take the long way */ }
    if (sameSite) history.back();
    else location.href = 'index.html#work';
  };

  const btn = document.createElement('button');
  btn.className = 'case-x';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Back to work');
  btn.innerHTML =
    '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" aria-hidden="true">' +
      '<path d="M7 7 L19 19" /><path d="M19 7 L7 19" /></svg>';
  btn.addEventListener('click', back);
  document.body.appendChild(btn);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    // not while a dialog of our own is up — those close themselves first
    if (document.documentElement.className.match(/theater-open|ai-open/)) return;
    const t = e.target;
    if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName) || (t && t.isContentEditable)) return;
    e.preventDefault();
    back();
  });
})();
