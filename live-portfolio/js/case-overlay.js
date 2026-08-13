// The case overlay — clicking a work thumbnail expands the case study
// over the page instead of navigating away. The story loads in an iframe
// (the two case stylesheets share ~40 colliding class names — isolation
// IS the design; the page inside runs ?embed=1, which stands its shell
// down and bridges Escape/links back here via postMessage).
//
// State rides the URL: ?case=<id>, pushed as a real history entry so the
// browser's Back closes the overlay, and picked up by the tab record via
// ShellTabs.remember() — a tab restored later reopens exactly this case.
(() => {
  const root = document.documentElement;
  const shell = document.getElementById('shell');
  const card = document.getElementById('shell-card');
  const workStage = document.querySelector('.work-stage');
  if (!shell || !card || !workStage) return;                 // index only
  if (window.matchMedia('(max-width: 700px)').matches) return;  // phones navigate

  const CASES = {
    vicino:    { href: 'vicino.html',    title: 'Vicino AI',  thumb: '.work-img-vicino' },
    pantrypal: { href: 'pantrypal.html', title: 'PantryPal',  thumb: '.work-img-pantry' },
    nextlevel: { href: 'nextlevel.html', title: 'Next Level', thumb: '.work-img-drone' },
  };
  const byHref = (path) =>
    Object.keys(CASES).find((k) => CASES[k].href === path) || null;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- built once, appended to the shell (unscaled space) ----
  const wrap = document.createElement('div');
  wrap.className = 'case-overlay';
  wrap.id = 'case-overlay';
  wrap.hidden = true;
  // The case opens in the TAB YOU ARE IN — the tab simply takes the case's
  // name while it is up. The × in the corner is the way back, and the
  // frame reads as the page itself: no shadow, no floating card, and it
  // reaches up behind the chrome strip exactly as .shell-card does, so the
  // hole cut for the active tab shows the case's own surface.
  wrap.innerHTML =
    '<div class="case-veil"></div>' +
    '<div class="case-frame" role="region" aria-label="Case study">' +
      '<iframe class="case-doc" id="case-doc" title="Case study"></iframe>' +
      '<button class="case-x" type="button" aria-label="Close case study">' +
        '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round" aria-hidden="true">' +
          '<path d="M7 7 L19 19" /><path d="M19 7 L7 19" /></svg>' +
      '</button>' +
    '</div>';
  shell.appendChild(wrap);
  const frame = wrap.querySelector('.case-frame');
  const doc = wrap.querySelector('.case-doc');
  const xBtn = wrap.querySelector('.case-x');

  let openId = null;
  let parkedY = null;          // the page's scroll while it is collapsed
  let pushed = false;             // did WE push the ?case history entry
  let hideTimer = 0;

  const param = () => new URLSearchParams(location.search).get('case');
  const hrefWith = (id) => {
    const u = new URL(location.href);
    if (id) u.searchParams.set('case', id);
    else u.searchParams.delete('case');
    return (u.pathname.split('/').pop() || 'index.html') + u.search + u.hash;
  };
  const rememberTab = () => {
    if (window.ShellTabs && window.ShellTabs.remember) window.ShellTabs.remember();
  };

  const open = (id, opts) => {
    opts = opts || {};
    const c = CASES[id];
    if (!c || openId === id) return;
    openId = id;
    clearTimeout(hideTimer);
    wrap.hidden = false;
    wrap.classList.remove('is-doc-ready');
    const want = c.href + '?embed=1' + (opts.chapter ? '#' + opts.chapter : '');
    if (doc.getAttribute('src') !== want) doc.src = want;
    // The page behind collapses to nothing while the case is up (shell.css
    // html.case-open) so the compositor is not holding tiles for a
    // six-thousand-pixel document nobody can see. Its height is what was
    // carrying the scroll position, so keep that here and hand it back on
    // close — the reader returns to the same row of the work grid.
    parkedY = window.scrollY;
    root.classList.add('case-open');
    card.setAttribute('inert', '');
    // the rail lights Work (the cases left the tree); the tab wears the name
    if (window.Shell && window.Shell.setPage) window.Shell.setPage('work', c.title);

    // The case simply opens. There WAS a FLIP here — the thumbnail flew up
    // and swelled to fill the card while the story loaded behind it, and it
    // read as the picture glitching rather than as a transition. The story
    // fades up on its own load event instead; nothing scales, nothing flies.
    requestAnimationFrame(() => wrap.classList.add('is-open'));
    // focus the story itself, not a close button — arrow keys and space
    // should scroll the case the moment it lands, exactly as on the page
    doc.focus({ preventScroll: true });
  };

  const close = (opts) => {
    opts = opts || {};
    if (!openId) return;
    const c = CASES[openId];
    openId = null;
    root.classList.remove('case-open');
    // the page has its height back this frame; put the reader back on it
    // before anything paints
    if (parkedY != null) { window.scrollTo(0, parkedY); parkedY = null; }
    card.removeAttribute('inert');
    if (window.Shell && window.Shell.setPage) window.Shell.setPage('work', 'Work');
    wrap.classList.remove('is-open');

    const link = document.querySelector(c.thumb);
    hideTimer = setTimeout(() => {
      wrap.hidden = true;
      // a parked iframe keeps its rAF loops running — let it go
      doc.removeAttribute('src');
      wrap.classList.remove('is-doc-ready');
    }, opts.instant || reduced() ? 0 : 260);
    if (link) link.focus({ preventScroll: true });
  };

  // ---- the case opens IN THIS TAB, over the page you were on. ?case= is
  // pushed as a real history entry, so the browser's Back leaves it too,
  // and the tab record remembers it for a restore.
  const openWithHistory = (id, chapter) => {
    history.pushState(null, '', hrefWith(id));
    pushed = true;
    open(id, { chapter: chapter });
    rememberTab();
  };
  // ---- the way back: the ×, Escape, or a link out of the story. A pushed
  // entry has to be POPPED rather than replaced, or Back walks straight
  // into the case again.
  const requestClose = () => {
    if (!openId) return;
    const wasPushed = pushed;
    pushed = false;
    close();
    if (wasPushed) history.back();
    else history.replaceState(null, '', hrefWith(null));
    rememberTab();
  };

  window.addEventListener('popstate', () => {
    const id = param();
    if (id && CASES[id]) {
      if (openId !== id) { pushed = false; open(id, { instant: true }); }
    } else if (openId) {
      pushed = false;
      close();
    }
  });

  // scroll the story inside the frame to a chapter (same-origin)
  const scrollDocTo = (chapter) => {
    try {
      const el = doc.contentDocument && doc.contentDocument.getElementById(chapter);
      if (el) el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    } catch (err) { /* frame mid-load — the #hash on src covers it */ }
  };

  // ---- every link to a case page opens here instead: the three work
  // thumbnails, the rail's case rows and their chapter kids, the NOW row.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.closest('#case-overlay')) return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (url.origin !== location.origin) return;
    const id = byHref(url.pathname.split('/').pop());
    if (!id) return;
    e.preventDefault();
    const chapter = url.hash.slice(1);
    if (openId === id) { if (chapter) scrollDocTo(chapter); return; }
    if (openId) close({ instant: true });          // sibling case via the rail
    openWithHistory(id, chapter);
  });

  // a same-page section link while a case is up (the rail stays live):
  // FOLLOW it in this tab rather than closing the tab — a link is a link,
  // and the tab simply becomes the page it went to. Capture phase, so the
  // shell's own delegate then scrolls a document that is scrollable again.
  document.addEventListener('click', (e) => {
    if (!openId) return;
    const a = e.target.closest('a[href]');
    if (!a || a.closest('#case-overlay')) return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    requestClose();
  }, true);

  // ---- the bridge from inside the frame (shell.js EMBED branch) ----
  window.addEventListener('message', (e) => {
    if (e.source !== doc.contentWindow) return;
    const m = e.data || {};
    // Escape pressed INSIDE the story. This bridge is load-bearing, not a
    // nicety: focus lands on the iframe so the keys scroll the case, which
    // means the parent's own keydown listener never sees that press.
    if (m.t === 'case:close') { requestClose(); return; }
    if (m.t !== 'case:nav' || typeof m.href !== 'string') return;
    const path = m.href.split('#')[0].split('?')[0];
    const hash = m.href.split('#')[1] || '';
    const id = byHref(path);
    if (id) {                                      // a sibling case study
      close({ instant: true });
      openWithHistory(id, hash);
    } else if (path === 'work.html' || path === 'index.html') {
      requestClose();                              // "back to work" — we're here
      if (hash) {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
      }
    } else {
      requestClose();
      location.assign(m.href);
    }
  });

  // the × closes the case. Nothing inside a story opens over it any more
  // — the Vicino board and its design-system documents open in their own
  // tabs — so there is no inner layer to close first.
  xBtn.addEventListener('click', requestClose);
  // Escape while focus is still on THIS document (before the frame takes
  // it, or after clicking the shell) — the in-frame press arrives as the
  // `case:close` message above instead.
  document.addEventListener('keydown', (e) => {
    if (!openId || e.key !== 'Escape') return;
    e.preventDefault();
    requestClose();
  });

  doc.addEventListener('load', () => {
    if (openId && doc.getAttribute('src')) wrap.classList.add('is-doc-ready');
  });

  // hovering a door primes the document behind it (the tabs.js idiom) —
  // the URL matches the iframe src exactly so the cache is warm
  const primed = new Set();
  const prime = (href) => {
    if (primed.has(href)) return;
    primed.add(href);
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.as = 'document';
    l.href = href;
    document.head.appendChild(l);
  };
  Object.keys(CASES).forEach((k) => {
    const t = document.querySelector(CASES[k].thumb);
    if (t) t.addEventListener('pointerover',
      () => prime(CASES[k].href + '?embed=1'), { passive: true });
  });

  // ---- deep link / tab restore: arrived with ?case already in the URL
  const initial = param();
  if (initial && CASES[initial]) open(initial, { instant: true });

  // for the tab system: reconcile the overlay to the current URL, no
  // animation, no history writes (js/tabs.js drives this on tab switches)
  window.CaseOverlay = {
    get openId() { return openId; },
    sync: () => {
      const id = param();
      if (id && CASES[id]) { if (openId !== id) { close({ instant: true }); open(id, { instant: true }); } }
      else if (openId) { pushed = false; close({ instant: true }); }
    },
  };
})();
