// The shell — populates the mini-browser chrome and sidebar.
//
// Every page ships the same six-element skeleton (see css/shell.css for
// the frame math); the skeleton is sized by CSS alone, so the window is
// already the right shape on the very first paint and only its CONTENTS
// arrive a frame later. That one-frame gap is not a flash to hide — it
// is frame zero of the entrance (js/typewriter.js drives the timing on
// the home page; everywhere else the chrome and sidebar just light up).
//
// The sidebar absorbs BOTH of the site's old nav levels: the five-word
// site-nav and the per-page chapter rails (.about-menu / .case-menu).
// One tree, page → section → chapter, so there is exactly one place
// that knows the shape of the site.
//
// The precedent is js/nav-touch.js: chrome that is identical on every
// page is generated once here rather than hand-synced across nine files.
(() => {
  const shell = document.getElementById('shell');
  if (!shell) return;

  const root = document.documentElement;
  const chrome = document.getElementById('shell-chrome');
  const side = document.getElementById('shell-side');
  let page = shell.dataset.page || 'home';
  let title = shell.dataset.title || 'Home';

  // ---- embed mode: this document is inside the case overlay's iframe on
  // index.html (?embed=1 → html.is-embed, set pre-paint in <head>). The
  // page is CONTENT there, not a window: no chrome, no rail, no AI sheet.
  // Load-bearing, not cosmetic — the iframe shares sessionStorage with its
  // parent, so if tabs.js mounted here its reconcile() would overwrite the
  // parent's active-tab record with this frame's URL and corrupt the strip.
  const EMBED = root.classList.contains('is-embed');

  // scroll restoration is OURS: the tab records carry the exact pixel
  // (js/tabs.js state.y) and the browser's own restore would race it
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // ---- the icon vocabulary: the site's own 26-box line glyphs, lifted
  // from js/nav-touch.js, about.html and the two case studies so the rail
  // speaks in shapes the visitor has already seen.
  // No width/height: CSS owns the box, so a glyph can never be the wrong
  // size again. pathLength is injected rather than hand-written into thirty
  // path strings — with it, the site's existing self-draw idiom (dasharray 1
  // + dashoffset 1 → 0) applies to every glyph in the rail at once.
  const svg = (paths, weight) =>
    '<svg viewBox="0 0 26 26" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="' + (weight || 2.2) + '" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    paths.replace(/<(path|circle|rect|line|ellipse|polyline)(?=[\s/>])/g,
                  '<$1 pathLength="1"') + '</svg>';

  const G = {
    // chrome
    rail: '<rect x="3.5" y="4.5" width="19" height="17" rx="3.5" />' +
          '<path d="M10.5 4.5 V21.5" />',
    back: '<path d="M15.5 5.5 L8 13 L15.5 20.5" />',
    fwd:  '<path d="M10.5 5.5 L18 13 L10.5 20.5" />',
    plus: '<path d="M13 6 V20" /><path d="M6 13 H20" />',
    twist: '<path d="M10 6.5 L16.5 13 L10 19.5" />',
    // pages (js/nav-touch.js)
    home: '<path d="M4 12.5 L13 5 L22 12.5" /><path d="M6.5 11 V20.5 H19.5 V11" />' +
          '<path d="M10.5 20.5 V14.8 H15.5 V20.5" />',
    about: '<circle cx="13" cy="9" r="4" />' +
           '<path d="M5.5 21 C5.5 16.4, 9 14.6, 13 14.6 C17 14.6, 20.5 16.4, 20.5 21" />',
    work: '<rect x="4" y="8" width="18" height="12.5" rx="2.5" />' +
          '<path d="M9.3 8 V6.2 C9.3 5.2, 9.8 4.7, 10.8 4.7 H15.2 C16.2 4.7, 16.7 5.2, 16.7 6.2 V8" />' +
          '<path d="M4 13.2 H22" />',
    play: '<path d="M8 5.5 L20 13 L8 20.5 Z" />',
    ai: '<path d="M13 4 V22" /><path d="M5.5 8.5 L20.5 17.5" /><path d="M20.5 8.5 L5.5 17.5" />',
    // about's chapters (about.html)
    bio: '<path d="M13 6 C10.5 4, 6 4, 4 5.5 V20.5 C6 19, 10.5 19, 13 21 C15.5 19, 20 19, 22 20.5 V5.5 C20 4, 15.5 4, 13 6 Z" />' +
         '<path d="M13 6 V21" />',
    skills: '<rect x="8" y="3.5" width="10" height="19" rx="5" /><path d="M13 8 V11.5" />',
    resume: '<rect x="6" y="3.5" width="14" height="19" rx="2.5" /><path d="M9.5 9.5 H16.5" />' +
            '<path d="M9.5 13 H16.5" /><path d="M9.5 16.5 H13.5" />',
    contact: '<rect x="3.5" y="5.5" width="19" height="15" rx="2.5" />' +
             '<path d="M4.5 7.5 L13 14.5 L21.5 7.5" />',
    // the case studies' chapters (pantrypal.html / nextlevel.html)
    overview: '<circle cx="13" cy="13" r="9.5" /><circle cx="13" cy="13" r="4" />',
    problem: '<circle cx="11" cy="11" r="6.5" /><path d="M15.8 15.8 L22 22" />',
    solution: '<path d="M4 20 C 9 20, 9 7, 14 7 C 18 7, 17 14, 22 13" />' +
              '<path d="M19 10.5 L22 13 L19 16" />',
    process: '<rect x="4" y="4.5" width="12" height="10" rx="2" />' +
             '<rect x="10" y="11.5" width="12" height="10" rx="2" />',
    craft: '<circle cx="13" cy="13" r="9.5" /><circle cx="9" cy="10.5" r="1.4" />' +
           '<circle cx="13.5" cy="8" r="1.4" /><circle cx="17" cy="11" r="1.4" />',
    results: '<path d="M4 22 H22" /><path d="M5 18 L11 12 L15 15 L21 7" />' +
             '<path d="M17.5 7 H21 V10.5" />',
    story: '<path d="M13 3.5 C 8.7 3.5, 5.5 6.7, 5.5 10.6 C 5.5 15.6, 13 22.5, 13 22.5 ' +
           'C 13 22.5, 20.5 15.6, 20.5 10.6 C 20.5 6.7, 17.3 3.5, 13 3.5 Z" />' +
           '<circle cx="13" cy="10.6" r="2.8" />',
    discovery: '<rect x="3.5" y="4.5" width="19" height="13" rx="4" />' +
               '<path d="M9.5 17.5 L8.5 22.5 L14 17.5" /><path d="M8.5 9.5 H17.5" />' +
               '<path d="M8.5 13 H14.5" />',
    mark: '<circle cx="13" cy="13" r="9.5" />' +
          '<path d="M5.5 15.5 C 8 13, 10.5 17.5, 13 15 C 15.5 12.5, 18 17, 20.5 14.5" />',
    rollout: '<rect x="3.5" y="5" width="19" height="12.5" rx="2" /><path d="M13 17.5 V21.5" />' +
             '<path d="M8.5 21.5 H17.5" />',
    // the three boards
    pong: '<path d="M5.5 8.5 V17.5" /><path d="M20.5 8.5 V17.5" /><circle cx="13" cy="13" r="1.9" />',
    snake: '<path d="M5 8 H14.5 A3.2 3.2 0 0 1 14.5 14.4 H11.5 A3.2 3.2 0 0 0 11.5 20.8 H21" />',
    flappy: '<path d="M4.5 15.5 C 8 9.5, 13.5 9.5, 16.5 13.5" />' +
            '<path d="M16.5 13.5 L21.5 10.5 L20.5 17 Z" />',
    // the work. Each is the brand reduced to the one shape that carries
    // it: Vicino's diagonal band with a triangle at either end, a tomato
    // for the cooking app, a quadcopter for the drone company.
    vicino: '<path d="M4.5 20.5 V13.5 L11 17 Z" />' +
            '<path d="M21.5 5.5 V12.5 L15 9 Z" />' +
            '<path d="M4.5 13.5 L21.5 5.5" />' +
            '<path d="M4.5 20.5 L21.5 12.5" />',
    // a bigger body and a wide-spread calyx: two curled leaves closed into
    // a loop read as a ring, and a single stem reads as an apple. Four
    // prongs is what makes it a tomato.
    tomato: '<circle cx="13" cy="15.4" r="7.6" />' +
            '<path d="M13 7.8 L8 5.4" /><path d="M13 7.8 L18 5.4" />' +
            '<path d="M13 7.8 L10.4 3.5" /><path d="M13 7.8 L15.6 3.5" />',
    // rotors as rings, not filled ellipses — at 18px a flattened ellipse
    // merges with the arm holding it and the whole thing becomes a blob
    drone:  '<circle cx="13" cy="13" r="2.9" />' +
            '<path d="M11 11 L8.8 8.8" /><path d="M15 11 L17.2 8.8" />' +
            '<path d="M11 15 L8.8 17.2" /><path d="M15 15 L17.2 17.2" />' +
            '<circle cx="6.7" cy="6.7" r="2.8" /><circle cx="19.3" cy="6.7" r="2.8" />' +
            '<circle cx="6.7" cy="19.3" r="2.8" /><circle cx="19.3" cy="19.3" r="2.8" />',
    // elsewhere
    link: '<path d="M4.5 16.5 L16.5 4.5" /><path d="M6.5 4.5 H16.5 V14.5" />',
  };

  // The social marks are STROKED, not filled — same 26 box, same weight,
  // same pathLength, so they draw themselves on hover like every other
  // glyph in the rail. Each keeps the one feature that makes it
  // recognisable and drops everything else: LinkedIn is the square with
  // the in, GitHub the cat silhouette reduced to its head and tail,
  // Letterboxd its three overlapping discs, Goodreads its serif g.
  const SOCIAL = {
    li: '<rect x="3.5" y="3.5" width="19" height="19" rx="3.5" />' +
        '<path d="M8 11 V18" /><circle cx="8" cy="7.6" r="1.2" />' +
        '<path d="M12.5 18 V11" />' +
        '<path d="M12.5 14 C12.5 11.8, 18 11.2, 18 14.6 V18" />',
    gh: '<path d="M16.2 22 V18.6 C16.2 17.5, 15.8 16.7, 15.3 16.3 ' +
        'C18.4 16 21.2 14.9, 21.2 10.4 C21.2 9.1, 20.7 8, 19.9 7.2 ' +
        'C20 6.9, 20.4 5.7, 19.8 4.1 C19.8 4.1, 18.8 3.8, 16.6 5.3 ' +
        'C15.6 5, 14.3 4.9, 13 4.9 C11.7 4.9, 10.4 5, 9.4 5.3 ' +
        'C7.2 3.8, 6.2 4.1, 6.2 4.1 C5.6 5.7, 6 6.9, 6.1 7.2 ' +
        'C5.3 8, 4.8 9.1, 4.8 10.4 C4.8 14.9, 7.6 16, 10.7 16.3 ' +
        'C10.3 16.7, 9.9 17.3, 9.8 18.2" />' +
        '<path d="M9.8 18.2 C7.8 19.1, 6.4 18.2, 5.6 16.9" />',
    lb: '<circle cx="7" cy="13" r="5.2" /><circle cx="13" cy="13" r="5.2" />' +
        '<circle cx="19" cy="13" r="5.2" />',
    // a lowercase g: the bowl, and the stem that hooks under it
    gr: '<circle cx="11" cy="10.5" r="5" />' +
        '<path d="M16 6 V16.6 C16 20.1, 13.6 22, 10.6 22 ' +
        'C8.5 22, 7.1 21.1, 6.5 19.7" />',
  };

  // ============================================================
  // The site, as a tree. This is the ONLY place that knows its shape.
  //   id    — matches a page's data-page, so the current row and its
  //           ancestors can be lit without any JS guessing
  //   sec   — matches a section id, for the scroll-spy to light
  //   mark  — a real brand image instead of a line glyph
  // ============================================================
  const TREE = [
    // No sub-sections: the pages grew single-screen grids, so the rail does
    // not enumerate what a screen already shows. The three CASE STUDIES are
    // the exception, and they are back. They are not sections of Work — they
    // are their own pages, the longest and best things on the site, and with
    // them out of the tree the persistent nav could not reach them at all:
    // you had to land on Work and pick a card. Everything they need was
    // still here waiting — ANCESTORS maps all three to work, openChain
    // expands the trail, and vicino/tomato/drone were drawn for exactly
    // these three rows and had been sitting unused ever since.
    { label: 'pages', rows: [
      { id: 'home', href: 'index.html#home', text: 'Home', icon: 'home' },
      { id: 'work', href: 'index.html#work', text: 'Work', icon: 'work', kids: [
        { id: 'vicino', href: 'vicino.html', text: 'Vicino AI', icon: 'vicino' },
        { id: 'pantrypal', href: 'pantrypal.html', text: 'Pantry Pal', icon: 'tomato' },
        { id: 'nextlevel', href: 'nextlevel.html', text: 'Next Level', icon: 'drone' },
      ] },
      // Play sits before About, matching the order the page scrolls in —
      // the rail's job is to be a map of the document, so when the document
      // reorders, this does too (the nav thread reads its sections straight
      // off these rows, so it follows for free)
      { id: 'play', href: 'index.html#play', text: 'Play', icon: 'play' },
      { id: 'about', href: 'index.html#bio', text: 'About', icon: 'about' },
    ] },
    { label: 'elsewhere', rows: [
      { href: 'PoncedeLeon-Resume.pdf', text: 'Resume', icon: 'resume', ext: true },
      { href: 'mailto:tigoponcedeleon@gmail.com', text: 'Email', icon: 'contact' },
      { href: 'https://www.linkedin.com/in/tigoponcedeleon/', text: 'LinkedIn',
        brand: 'li', ext: true },
      { href: 'https://github.com/tigo-poncedeleon', text: 'GitHub',
        brand: 'gh', ext: true },
      { href: 'https://letterboxd.com/tigomiamigo/', text: 'Letterboxd',
        brand: 'lb', ext: true },
      { href: 'https://www.goodreads.com/user/show/98420895-tigo', text: 'Goodreads',
        brand: 'gr', ext: true },
    ] },
  ];

  // A page's tab favicon is the glyph it already wears in the rail. Derived
  // from TREE rather than hand-listed, so a new page cannot end up with a
  // sidebar icon and a different tab icon.
  const flatten = (rows) => rows.reduce((acc, r) =>
    acc.concat([r], r.kids ? flatten(r.kids) : []), []);
  let ROWS = null;
  const FAVICON = {};                    // built once, not on every repaint
  const rows = () => {
    if (!ROWS) ROWS = TREE.reduce((acc, g) => acc.concat(flatten(g.rows || [])), []);
    return ROWS;
  };
  const faviconFor = (id) => {
    if (FAVICON[id]) return FAVICON[id];
    const r = rows().find((x) => x.id === id);
    FAVICON[id] = svg(G[(r && r.icon) || 'link'], 2.1);
    return FAVICON[id];
  };

  // the chain of ids that must be open for the current page to be visible
  const ANCESTORS = { vicino: ['work'], pantrypal: ['work'], nextlevel: ['work'] };
  const openChain = new Set([page].concat(ANCESTORS[page] || []));

  // ---- what the visitor last opened, remembered for the session only:
  // a rail that stays exactly as you left it across a page load is the
  // whole point of a persistent sidebar
  const OPEN_KEY = 'shell.open';
  let opened;
  let hadStored = false;
  try {
    const raw = sessionStorage.getItem(OPEN_KEY);
    hadStored = raw !== null;
    opened = new Set(JSON.parse(raw || '[]'));
  } catch (err) { opened = new Set(); }
  // First visit of the session: Work arrives OPEN. A twisty that hides the
  // three case studies makes a visitor hunt for the one thing they came to
  // read — and it would hand the rail back the hole under it. Only the
  // FIRST visit, though: once the session has a stored state, whatever the
  // visitor last chose wins, closed included.
  if (!hadStored) opened.add('work');
  openChain.forEach((id) => opened.add(id));
  const saveOpen = () => {
    try {
      sessionStorage.setItem(OPEN_KEY, JSON.stringify(Array.from(opened)));
    } catch (err) { /* private mode — the rail just forgets */ }
  };

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  // ============================================================
  // Chrome
  // ============================================================
  const buildChrome = () => {
    if (!chrome) return;
    chrome.innerHTML =
      '<div class="chrome-left">' +
        '<button class="chrome-btn" type="button" data-act="rail" ' +
          'aria-label="Toggle sidebar">' + svg(G.rail) + '</button>' +
      '</div>' +
      '<div class="chrome-tabs" id="chrome-tabs">' +
        '<button class="chrome-btn" type="button" data-act="back" ' +
          'aria-label="Back">' + svg(G.back) + '</button>' +
        '<button class="chrome-btn" type="button" data-act="fwd" ' +
          'aria-label="Forward">' + svg(G.fwd) + '</button>' +
        '<span class="tab-list" id="tab-list"></span>' +
      '</div>' +
      // where the visitor is, and the time there, at the strip's far end —
      // a button, because it opens the globe (js/globe.js)
      '<div class="chrome-right">' +
        '<button class="chrome-place" type="button" data-globe ' +
          'aria-label="Where you are">' +
          '<span class="now-dot" aria-hidden="true"></span>' +
          '<span class="chrome-place-city" data-clock="state">Oregon</span>' +
          '<span class="chrome-place-time" data-clock="time">--:--:-- --</span>' +
        '</button>' +
      '</div>';

    // the strip's own contents belong to js/tabs.js
    if (window.ShellTabs) {
      window.ShellTabs.mount(document.getElementById('tab-list'),
        { page: page, title: title, icon: faviconFor, plus: svg(G.plus) });
    }

    // back is honest about whether there is anywhere to go; forward has no
    // API to ask, so it stays live and simply does nothing at the end
    // (Trail.wire below owns both buttons' enabled state now — it knows
    // about the page's own trail as well as the browser's history.)

    chrome.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.act === 'back') Trail.back();
      else if (btn.dataset.act === 'fwd') Trail.fwd();
      else if (btn.dataset.act === 'rail') toggleRail();
      // NOT the + — it lives inside the tab strip, and js/tabs.js owns
      // every click in there. Handling it here too opened two tabs.
    });

    buildJump();
    Trail.wire();
  };

  // ============================================================
  // The trail — the shell's own back and forward.
  //
  // The browser's history cannot answer "the last section I was in", and it
  // is not supposed to: the scroll spies move the hash with replaceState on
  // purpose, because pushing an entry per section would fill the history
  // with a hundred stops on one scroll and make the browser's own Back
  // useless. So the two chrome buttons walk a trail of their OWN — the
  // places you have actually been on this page — and hand off to real
  // history only at its ends, where a case study or another tab lives.
  //
  // A place is recorded once it has been HELD, not the instant it is
  // touched: scrolling from Home to About passes through Work and Play, and
  // a trail that logged the fly-past would make Back a stutter through
  // sections nobody stopped at.
  // ============================================================
  const Trail = (() => {
    const HOLD = 700;                  // ms a section must be held to count
    let list = [];                     // [{ id, y }]
    let at = -1;                       // where in the trail we are
    let pending = 0, walking = false;

    const back = chrome && chrome.querySelector('[data-act="back"]');
    const fwd = chrome && chrome.querySelector('[data-act="fwd"]');

    const paint = () => {
      // Back is honest: live when the trail has somewhere behind it, or
      // when real history does. Forward the same, plus its own end.
      if (back) back.disabled = !(at > 0 || history.length > 1);
      if (fwd) fwd.disabled = at < 0 || at >= list.length - 1;
    };

    // record a place, once it has been held
    const note = (id) => {
      if (walking) return;
      clearTimeout(pending);
      pending = setTimeout(() => {
        const here = { id: id, y: window.scrollY };
        if (at >= 0 && list[at] && list[at].id === id) { list[at] = here; return; }
        // a new place taken from the middle of the trail truncates the
        // forward half, exactly as a browser does
        list = list.slice(0, at + 1);
        list.push(here);
        at = list.length - 1;
        paint();
      }, HOLD);
    };

    const goTo = (entry) => {
      const el = document.getElementById(entry.id);
      walking = true;
      if (el) {
        window.scrollTo({ top: restY(el), behavior: reduced() ? 'auto' : 'smooth' });
      } else {
        window.scrollTo({ top: entry.y, behavior: reduced() ? 'auto' : 'smooth' });
      }
      // let the spies settle before the trail listens again, or the arrival
      // records itself as a new place and Back walks in circles
      setTimeout(() => { walking = false; paint(); }, 900);
    };

    return {
      wire: () => {
        window.addEventListener('shell:section', (e) => {
          if (window.__restoring) return;
          note(e.detail.id);
        });
        paint();
      },
      back: () => {
        // a case study or a game is an overlay on TOP of the page: leaving
        // it is what Back means while one is up, and that is real history
        if (root.className.match(/case-open|theater-open/)) { history.back(); return; }
        if (at > 0) { at -= 1; goTo(list[at]); paint(); return; }
        history.back();                // off the end of our trail: the browser's
      },
      fwd: () => {
        if (at >= 0 && at < list.length - 1) { at += 1; goTo(list[at]); paint(); return; }
        history.forward();
      },
    };
  })();

  // ---- With the rail closed the site has no visible nav at all, so the +
  // grows one: hover it and the pages drop down, ready to be scrolled to.
  // ONLY with the rail closed — open, the rail is right there saying the
  // same thing, and a second copy of it under the + would be clutter
  // answering a question nobody has.
  //
  // The rows are real links to the same hrefs the rail uses, so the shell's
  // own click delegation scrolls them; this menu adds an affordance, not a
  // second navigation system.
  const buildJump = () => {
    if (!chrome || chrome.querySelector('.chrome-jump')) return;
    const pages = TREE.find((g) => g.label === 'pages');
    if (!pages) return;

    const menu = document.createElement('div');
    menu.className = 'chrome-jump';
    menu.hidden = true;
    menu.innerHTML = pages.rows.map((r) =>
      '<a class="jump-row" href="' + esc(r.href) + '" data-page="' + esc(r.id) + '">' +
        '<span class="jump-ico">' + svg(G[r.icon] || G.home) + '</span>' +
        '<span>' + esc(r.text) + '</span>' +
      '</a>').join('');
    chrome.appendChild(menu);

    let hideT = 0;
    const show = () => {
      if (!root.classList.contains('rail-closed')) return;
      clearTimeout(hideT);
      const plus = chrome.querySelector('.chrome-new');
      if (!plus) return;
      const p = plus.getBoundingClientRect();
      const c = chrome.getBoundingClientRect();
      menu.hidden = false;
      // hang it off the + and keep it inside the window
      const w = menu.offsetWidth || 176;
      const x = Math.min(p.left - c.left, c.width - w - 10);
      menu.style.left = Math.max(8, x) + 'px';
      requestAnimationFrame(() => menu.classList.add('is-lit'));
    };
    const hide = () => {
      clearTimeout(hideT);
      hideT = setTimeout(() => {
        menu.classList.remove('is-lit');
        setTimeout(() => { menu.hidden = true; }, 180);
      }, 120);
    };

    chrome.addEventListener('pointerover', (e) => {
      if (e.target.closest('.chrome-new')) show();
      else if (!e.target.closest('.chrome-jump')) hide();
    });
    chrome.addEventListener('pointerleave', hide);
    menu.addEventListener('pointerenter', () => clearTimeout(hideT));
    menu.addEventListener('click', hide);
    // opening the rail takes the menu's reason for existing away with it
    window.addEventListener('shell:rail', hide);
  };

  // ---- the rail: closed means CLOSED, and its width belongs to the visitor
  const RAIL_KEY = 'shell.rail';
  const WIDTH_KEY = 'shell.railw';
  // 150, down from 180: the old floor existed because the place chip shared
  // the rail's column and had to fit beside the toggle. It sits at the far
  // end of the strip now, so the rail answers only to its own rows.
  const MIN = 150, MAX = 420;

  // A hard floor, computed rather than guessed: the rail may never be
  // narrower than the chrome's own left cluster, or the seam would cut
  // straight through the location and the time it sits above. Measured
  // from the chip's NATURAL width (scrollWidth) rather than its current
  // one — the chip ellipsises as the rail narrows, so using its rendered
  // width would let the floor chase itself down.
  // (floorW retired with the move: it measured the toggle PLUS the place
  // chip, because both had to fit inside the rail's column. Only the toggle
  // lives there now, and 44px of it never threatens MIN.)

  // ONE FRAME. The rail toggle used to be a FLIP: snap the layout, glide a
  // compositor transform over it, swap the zoom back in at rest — plus a
  // cross-document handshake so a case study in the overlay rode the same
  // clock. It was correct on paper and measured clean, and it never once
  // stopped looking broken: every ride had to keep four things in step (the
  // rail's slide, the card's reflow, the stage's zoom, the overlay frame's
  // edge), and each fix for one of them desynced another.
  //
  // So there is no ride. The class flips, the layout lands, the zoom lands,
  // the reading line is held — all in the SAME frame, in this one task.
  // Nothing animates, so nothing can fall out of step; the only thing the
  // eye can catch is a single clean change of size, which reads as fast
  // rather than as broken. (The rail's own width/margin transitions are
  // gone from shell.css for the same reason.)
  const toggleRail = () => {
    const next = !root.classList.contains('rail-closed');
    const side = document.querySelector('.shell-side');
    const eased = side && !reduced() && window.innerWidth > 700;
    const from = eased ? side.getBoundingClientRect().left : 0;

    root.classList.toggle('rail-closed', next);
    try { localStorage.setItem(RAIL_KEY, next ? '1' : '0'); } catch (err) { /* private mode */ }
    window.dispatchEvent(new Event('shell:rail'));
    // this document's stage: new scale + the reading-line hold, now
    if (window.__shellFit) window.__shellFit();

    // …and now the ONE thing that eases: the rail itself, sliding between
    // where it was and where it now is. A plain FLIP on a single element —
    // no zoom, no reflow, no second document, nothing to fall out of step
    // with. That is the whole difference from the version that had to be
    // deleted: the layout is already final and correct when this starts,
    // so the glide is pure compositor work and cannot desync from anything.
    // The page keeps its size the instant you click; the panel takes 0.3s
    // to get out of (or into) the way, which is the part the eye wanted.
    if (eased) {
      const dx = from - side.getBoundingClientRect().left;
      if (dx) {
        side.getAnimations().forEach((a) => {
          if (a.transitionProperty === 'transform') a.cancel();
        });
        side.style.transition = 'none';
        side.style.transform = 'translateX(' + dx + 'px)';
        void side.offsetWidth;                     // commit the start pose
        // TRANSFORM ONLY — no opacity in this transition. Animating opacity
        // makes the layer non-opaque, and both Chrome and Firefox drop
        // subpixel (LCD) text antialiasing on a non-opaque layer: every
        // label in the rail goes thin and grainy for the length of the
        // slide and then snaps crisp, which is exactly the "scratchy, not
        // crisp" this reads as — in BOTH browsers, which is how we know it
        // was never the tile-memory story. The rail's background is opaque,
        // so a pure translate keeps the text rendering at full quality the
        // whole way across.
        side.style.transition = 'transform var(--t-glide) var(--ease-glide)';
        side.style.transform = '';
        const clear = () => { side.style.transition = side.style.transform = ''; };
        side.addEventListener('transitionend', (e) => {
          if (e.target === side && e.propertyName === 'transform') clear();
        }, { once: true });
        setTimeout(clear, 450);       // transitionend has no delivery guarantee
      }
    }
    // and a case study open in the overlay, in the same frame — same
    // origin, so it re-fits itself here rather than a beat later off its
    // own ResizeObserver (that beat was the "adjusts, then jumps")
    const caseDoc = document.getElementById('case-doc');
    if (caseDoc && caseDoc.getAttribute('src')) {
      try {
        const w = caseDoc.contentWindow;
        if (w && w.__shellFit) w.__shellFit();
      } catch (err) { /* cross-origin or not ready — its own RO covers it */ }
    }
  };
  try {
    if (localStorage.getItem(RAIL_KEY) === '1') root.classList.add('rail-closed');
    const w = parseFloat(localStorage.getItem(WIDTH_KEY));
    if (w >= MIN && w <= MAX) root.style.setProperty('--shell-rail', w + 'px');
  } catch (err) { /* private mode — the rail just starts at its default */ }

  // Dragging the seam resizes the rail, and the card reflows underneath in
  // the same frame — stage-fit is watching the card with a ResizeObserver,
  // so the stage rescales continuously rather than snapping when you let go.
  const wireGrip = (grip) => {
    let id = null;
    grip.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      // capture keeps the drag alive if the pointer outruns the 1px line
      try { grip.setPointerCapture(id); } catch (err) { /* no live pointer */ }
      root.classList.add('rail-dragging');
      e.preventDefault();
    });
    grip.addEventListener('pointermove', (e) => {
      if (id === null) return;
      const w = Math.max(MIN, Math.min(MAX,
        e.clientX - shell.getBoundingClientRect().left));
      root.style.setProperty('--shell-rail', w + 'px');
    });
    const end = () => {
      if (id === null) return;
      try { grip.releasePointerCapture(id); } catch (err) { /* already gone */ }
      id = null;
      root.classList.remove('rail-dragging');
      try {
        localStorage.setItem(WIDTH_KEY,
          parseFloat(getComputedStyle(root).getPropertyValue('--shell-rail')));
      } catch (err) { /* private mode — the width just forgets */ }
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    // double-click the seam to put it back where it started
    grip.addEventListener('dblclick', () => {
      root.style.removeProperty('--shell-rail');
      try { localStorage.removeItem(WIDTH_KEY); } catch (err) { /* fine */ }
    });
  };

  // ============================================================
  // Sidebar
  // ============================================================
  const rowHTML = (row) => {
    const kids = row.kids && row.kids.length;
    const key = row.id || row.text;
    const isOpen = kids && opened.has(key);
    const icon = svg(row.brand ? SOCIAL[row.brand] : (G[row.icon] || G.link),
      row.brand ? 1.7 : 1.9);

    // the twisty is a SIBLING of the link, never inside it — a button
    // nested in an anchor is invalid and gets re-parented by the parser
    let h = '<div class="side-node" data-key="' + esc(key) + '">' +
      '<div class="side-row">' +
        (kids
          ? '<button class="side-tw" type="button" aria-expanded="' + (isOpen ? 'true' : 'false') +
            '" aria-label="Toggle ' + esc(row.text) + ' sections">' + svg(G.twist, 2.4) + '</button>'
          : '<span class="side-tw is-empty" aria-hidden="true"></span>') +
        '<a class="side-link" href="' + esc(row.href) + '"' +
          (row.id ? ' data-page="' + esc(row.id) + '"' : '') +
          (row.sec ? ' data-sec="' + esc(row.sec) + '"' : '') +
          (row.ext ? ' target="_blank" rel="noopener"' : '') + '>' +
          '<span class="side-ico">' + icon + '</span>' +
          '<span class="side-text">' + esc(row.text) + '</span>' +
          (row.meta ? '<span class="side-meta">' + esc(row.meta) + '</span>' : '') +
        '</a>' +
      '</div>';

    if (kids) {
      h += '<div class="side-kids"' + (isOpen ? '' : ' hidden') + '>' +
        row.kids.map(rowHTML).join('') + '</div>';
    }
    return h + '</div>';
  };

  // ---- NOW: what is actually happening.
  //
  // It used to sit at the TOP, dressed as a nav group, and it answered the
  // question "what is Tigo doing" with a school crest linking out to the
  // College's catalogue of majors — biography, not status, and the one row
  // in the rail that sent you off the site to read a list of other people's
  // degrees. Three things changed.
  //
  // WHAT it says: the present-tense job, and the sentence a visitor scanning
  // a portfolio is actually scanning for. Both facts expire, which is what
  // makes them a NOW rather than a second identity block.
  //
  // WHERE it points: inward. The role opens its own case study — the now
  // line is the shortest path into the best work on the site — and the
  // availability line opens the mailbox.
  //
  // WHERE it sits: the foot, above the ask chip. Status belongs at the
  // bottom of a rail with navigation above it, and parking it there gives
  // the column a weighted floor instead of a long fall to the chip.
  //
  // The dot is the accent the phoenix took over and then outgrew: at 6px it
  // is a live indicator, which is exactly what this block is.
  const statusHTML = () =>
    '<section class="side-status">' +
      '<h2 class="side-label">now</h2>' +
      '<a class="st-row" href="vicino.html">' +
        '<span class="st-dot" aria-hidden="true"></span>' +
        '<span class="st-lines">' +
          '<span class="st-lead">UX Engineer Intern</span>' +
          '<span class="st-sub">Vicino, Inc.</span>' +
        '</span>' +
      '</a>' +
      '<a class="st-row is-ahead" href="mailto:tigoponcedeleon@gmail.com">' +
        '<span class="st-dot" aria-hidden="true"></span>' +
        '<span class="st-lines">' +
          '<span class="st-lead">open to full-time</span>' +
          '<span class="st-sub">starting summer 2027</span>' +
        '</span>' +
      '</a>' +
    '</section>';

  const buildSide = () => {
    if (!side) return;
    let n = 0;
    const groups = TREE.map((g) =>
      // the label doubles as the group's name in the DOM — js/nav-progress.js
      // finds the pages group by it rather than by position in the tree
      '<section class="side-group" data-group="' + esc(g.label) + '" ' +
        'style="--n:' + (n++) + '">' +
        '<h2 class="side-label">' + esc(g.label) + '</h2>' +
        g.rows.map(rowHTML).join('') +
      '</section>').join('');

    side.innerHTML =
      '<a class="side-id" href="index.html#home">' +
        '<span class="side-id-text">' +
          '<span class="side-name">Tigo Ponce de León</span>' +
          '<span class="side-role">product design engineer</span>' +
        '</span>' +
      '</a>' +
      '<nav class="side-scroll" id="side-scroll" aria-label="Site">' + groups + '</nav>' +
      '<div class="side-foot">' +
        statusHTML() +
        '<a class="ask-pill" id="ask-pill" href="ai.html">' +
          svg(G.ai, 2) +
          '<span class="ask-label">ask my ai</span>' +
          '<span class="ask-kbd" aria-hidden="true">⌘K</span>' +
        '</a>' +
      '</div>';

    // the current page, and every ancestor it hangs from, wear the accent.
    // The case studies left the tree, so on their standalone pages the
    // accent falls back to the section they belong to (Work).
    let cur = side.querySelector('.side-link[data-page="' + page + '"]');
    if (!cur && ANCESTORS[page]) {
      cur = side.querySelector('.side-link[data-page="' + ANCESTORS[page][0] + '"]');
    }
    if (cur) {
      cur.setAttribute('aria-current', 'page');
      cur.closest('.side-row').classList.add('is-current');
    }
    openChain.forEach((id) => {
      const link = side.querySelector('.side-link[data-page="' + id + '"]');
      if (link && link !== cur) link.closest('.side-row').classList.add('is-trail');
    });
    // a page that has no sections keeps the accent on itself; one that does
    // will hand it down as soon as its scroll-spy reports a section

    // twisties toggle without navigating; everything else is a real link
    side.addEventListener('click', (e) => {
      const tw = e.target.closest('.side-tw');
      if (!tw || tw.classList.contains('is-empty')) return;
      e.stopPropagation();
      const node = tw.closest('.side-node');
      const kids = node.querySelector(':scope > .side-kids');
      const nowOpen = kids.hidden;
      kids.hidden = !nowOpen;
      tw.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
      if (nowOpen) opened.add(node.dataset.key);
      else opened.delete(node.dataset.key);
      saveOpen();
    });
  };

  // ============================================================
  // The AI overlay
  //
  // The chat used to be a page you had to leave the site to reach. It is
  // a sheet now, rising from the ask pill, reachable from anywhere. The
  // panel markup below is verbatim what ai.html used to hold — and the
  // sheet deliberately keeps id="ai-stage" and class="ai-stage", because
  // every .ai-stage.revealed selector in ai.css (the entrance, the
  // spark's draw-in) and the lookup in ai-chat.js then keep working
  // untouched. One decision, forty edits saved.
  // ============================================================
  const AI_PANEL =
    '<div class="ai-panel" id="ai-panel">' +
      '<div class="ai-scroll" id="ai-scroll"></div>' +
      // answers are announced here once complete — the word-by-word visual
      // reveal stays quiet for screen readers
      '<p class="sr-only" id="ai-live" aria-live="polite"></p>' +
      // empty-state spark: a hand-drawn asterisk in a dotted orbit that
      // draws itself in, and bows out on the first question
      '<div class="ai-empty" id="ai-empty" aria-hidden="true">' +
        '<svg class="ai-spark" width="120" height="120" viewBox="0 0 120 120">' +
          '<circle class="guide" cx="60" cy="60" r="52" />' +
          '<g fill="none" stroke="#5b5a53" stroke-width="2.2" stroke-linecap="round">' +
            '<path class="ray s1" pathLength="1" d="M60 22 L60 46" />' +
            '<path class="ray s1" pathLength="1" d="M60 98 L60 74" />' +
            '<path class="ray s2" pathLength="1" d="M92.9 41 L72.1 53" />' +
            '<path class="ray s2" pathLength="1" d="M27.1 79 L47.9 67" />' +
            '<path class="ray s3" pathLength="1" d="M27.1 41 L47.9 53" />' +
            '<path class="ray s3" pathLength="1" d="M92.9 79 L72.1 67" />' +
          '</g>' +
          '<circle class="spark-dot" cx="60" cy="60" r="5.5" />' +
        '</svg>' +
        '<p>ask me anything about Tigo &mdash; or start with a chip</p>' +
      '</div>' +
      '<div class="ai-dock" aria-hidden="true"></div>' +
      '<div class="ai-prompts" id="ai-prompts">' +
        '<button class="prompt-chip" type="button">Hobbies?</button>' +
        '<button class="prompt-chip" type="button">Your toolset?</button>' +
        '<button class="prompt-chip" type="button">Tell me your background!</button>' +
        '<button class="prompt-chip" type="button">What is your design philosophy?</button>' +
      '</div>' +
      // a chosen photo waits here, above the bar, until the next send
      '<div class="ai-attach-row" id="ai-attach-row" hidden></div>' +
      // the persona menu rises from the toggle that opens it
      '<div class="ai-persona-menu" id="ai-persona-menu" hidden>' +
        ['friendly|warm &amp; to the point',
         'whimsical|answers with a wink',
         'suspicious|trusts no question'].map((row) => {
          const p = row.split('|');
          return '<button class="persona-row" type="button" data-persona="' + p[0] + '">' +
            '<span class="persona-name">' + p[0] + '</span>' +
            '<span class="persona-desc">' + p[1] + '</span>' +
            '<svg class="persona-check" viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
              'stroke="currentColor" stroke-width="2.5" stroke-linecap="round" ' +
              'stroke-linejoin="round"><path d="M20 6 L9 17 L4 12" /></svg>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<form class="ai-inputbar" id="ai-inputbar">' +
        '<input class="ai-input" id="ai-input" type="text" aria-label="Ask about Tigo" ' +
          'placeholder="ask me anything!" autocomplete="off" />' +
        '<div class="ai-tools">' +
          // how it answers: friendly is the house voice, the other two are moods
          '<button class="ai-tool ai-persona" id="ai-persona" type="button" ' +
            'aria-haspopup="menu" aria-expanded="false" aria-label="Choose a mood">' +
            '<span class="persona-label" id="ai-persona-label">friendly</span>' +
            '<svg class="persona-chev" viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
              'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" ' +
              'stroke-linejoin="round"><path d="M6 10 L12 15.5 L18 10" /></svg>' +
          '</button>' +
          // dictation — ai-chat.js hides this button when the browser cannot listen
          '<button class="ai-tool ai-mic" id="ai-mic" type="button" hidden ' +
            'aria-label="Ask out loud" aria-pressed="false">' +
            '<svg class="mic-glyph" viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
              'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
              'stroke-linejoin="round">' +
              '<path d="M12 3 a3 3 0 0 1 3 3 V12 a3 3 0 0 1-6 0 V6 a3 3 0 0 1 3-3 z" />' +
              '<path d="M18.5 11.5 a6.5 6.5 0 0 1-13 0" /><path d="M12 18 V21" />' +
            '</svg>' +
            '<span class="mic-eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
          '</button>' +
          // a photo for context — the answer can look at what you are looking at
          '<button class="ai-tool ai-add" id="ai-add" type="button" ' +
            'aria-label="Add a photo">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
              'stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
              '<path d="M12 5 V19" /><path d="M5 12 H19" />' +
            '</svg>' +
          '</button>' +
        '</div>' +
        // the send: a small circle at the bar's end, quiet until there is
        // something to send, then filled with the accent (ai-chat.js flips
        // .is-ready on the bar). Drawn at the glyph set's own 2.2 stroke —
        // the old block was a 7.5-stroke arrow on a 70px grey slab.
        '<button class="ai-send" type="submit" aria-label="Send">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
            'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
            'stroke-linejoin="round">' +
            '<path d="M12 19 V5.5" /><path d="M6 11.5 L12 5.5 L18 11.5" />' +
          '</svg>' +
        '</button>' +
        '<input type="file" id="ai-file" accept="image/*" hidden />' +
      '</form>' +
    '</div>';

  const buildAI = () => {
    const wrap = document.createElement('div');
    wrap.className = 'ai-overlay';
    wrap.id = 'ai-overlay';
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="ai-scrim" id="ai-scrim"></div>' +
      '<div class="ai-stage is-overlay" id="ai-stage" role="dialog" aria-modal="true" ' +
        'aria-label="Ask my AI">' +
        '<header class="ai-sheet-head">' +
          svg(G.ai, 2) +
          '<span class="ai-sheet-title">ask my ai</span>' +
          '<p id="ai-sub">powered by Claude Haiku 4.5</p>' +
          '<button class="ai-x" type="button" aria-label="Close">' +
            svg('<path d="M7 7 L19 19" /><path d="M19 7 L7 19" />', 2) +
          '</button>' +
        '</header>' +
        AI_PANEL +
      '</div>';
    shell.appendChild(wrap);
  };

  // ============================================================
  // Section navigation
  //
  // Sidebar links are always FULL hrefs (pantrypal.html#craft, never a
  // bare #craft) so the identical tree can be emitted on all nine pages
  // and every row stays crawlable and cmd-clickable. When the href
  // happens to point at the page you are already on, this intercepts.
  // ============================================================
  const SCROLLERS = '.about-scroll, .case-scroll, .work-scroll, .play-scroll';
  const SLIDES = '.about-slide, .case-slide, .work-slide, .play-slide, .work-card, .play-card';
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================================
  // Where a section should COME TO REST
  //
  // block:'start' put a section's top edge at the top of the window, which
  // is the wrong answer for this site: every stage is built as its content
  // plus a floor (--stage-floor, styles.css), so a short section landed
  // pinned high with all of its leftover air pooled underneath. Work read
  // as 60px of sky over the title and 280 of nothing under the monitor.
  //
  // So aim at the INK, not the box. A stage's own air — the 40px above its
  // title, the 150 of floor below its last row — is spacing BETWEEN
  // sections, not part of the thing you asked to look at; centring the box
  // centres that air instead of the words. The ink is the union of the
  // section's own children (its title pair and whatever it introduces),
  // and it is that union we put in the middle of the reading area.
  //
  // Two things stay honest: the reading area starts under the sticky chrome
  // strip, not at y=0, and a section that already fills the window has no
  // middle to find, so it lands its top edge at the top instead. That
  // second rule is what keeps Home and About where they belong — the hero
  // is a full screen that centres itself, and its "scroll" cue sits on the
  // floor on purpose, so reading it as ink would drag the whole page down.
  // ============================================================
  const chromeH = () => (chrome ? chrome.getBoundingClientRect().height : 0);

  const inkOf = (el) => {
    const box = el.getBoundingClientRect();
    let top = Infinity, bottom = -Infinity;
    Array.prototype.forEach.call(el.children, (kid) => {
      // the frost strip and the screen-reader heading are not ink
      if (kid.hidden || kid.classList.contains('sr-only') ||
          kid.classList.contains('nav-frost')) return;
      const r = kid.getBoundingClientRect();
      if (r.height < 1) return;
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    });
    if (!isFinite(top) || bottom - top < 1) return { top: box.top, height: box.height };
    // never claim more than the section itself owns
    return {
      top: Math.max(top, box.top),
      height: Math.min(bottom, box.bottom) - Math.max(top, box.top),
    };
  };

  const restY = (el) => {
    const head = chromeH();
    const view = window.innerHeight - head;           // the reading area
    const box = el.getBoundingClientRect();
    const clamp = (y) => Math.round(Math.min(Math.max(y, 0),
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight)));

    // the 1px slack matters: a stage sized to exactly one screen of card
    // (--hero-h, scaled back up by zoom) can measure 859.99 against a 860
    // reading area, and a hair's rounding must not flip it to "centre me"
    if (box.height >= view - 1) return clamp(box.top + window.scrollY - head);

    const ink = inkOf(el);
    return clamp(ink.top + window.scrollY - head - (view - ink.height) / 2);
  };

  const markCurrent = (id) => {
    if (!side) return;
    side.querySelectorAll('.side-row.is-here').forEach((r) => r.classList.remove('is-here'));
    // only the section is looked for INSIDE the current page's own subtree,
    // so pantrypal's "process" never lights nextlevel's
    const scope = (side.querySelector('.side-row.is-current') || side).closest('.side-node') || side;
    const link = id && scope.querySelector('.side-link[data-sec="' + id + '"]');
    if (link) link.closest('.side-row').classList.add('is-here');
    // one chip at a time, the site's rule everywhere: when a section is
    // lit the page row steps back to plain accent text
    const scroll = document.getElementById('side-scroll');
    if (scroll) scroll.classList.toggle('has-here', !!link);
    const label = document.querySelector('.chrome-tab.is-active .tab-label');
    if (label) {
      label.innerHTML = esc(title) +
        (link ? ' <span class="tab-sec">/ ' + esc(link.querySelector('.side-text').textContent) +
          '</span>' : '');
    }
  };

  const goToSection = (target, hash) => {
    const scroller = target.closest(SCROLLERS);
    const behavior = reduced() ? 'auto' : 'smooth';

    // Ask whether it ACTUALLY scrolls sideways, not whether overflow-x is
    // unset: the vertical decks are plain flow now (the document scrolls
    // them), and `overflow-x: visible` would otherwise read as horizontal.
    if (scroller && scroller.scrollWidth > scroller.clientWidth + 1) {
      // HORIZONTAL (work, play): scroll-snap-stop:always halts a smooth
      // multi-slide scrollIntoView at the FIRST snap point, so drive the
      // scroller directly — and jump outright when it is more than one
      // slide away, since a snapped crawl through the middle reads as a bug
      const kids = Array.from(scroller.children).filter((el) => el.matches(SLIDES));
      const i = kids.indexOf(target);
      if (i < 0) return;
      const from = Math.round(scroller.scrollLeft / scroller.clientWidth);
      scroller.scrollTo({
        left: i * scroller.clientWidth,
        behavior: Math.abs(i - from) > 1 ? 'auto' : behavior,
      });
    } else {
      window.scrollTo({ top: restY(target), behavior: behavior });
    }

    // the deep-link race the observers guard against is over by definition
    // once a visitor has clicked something
    window.__hashReady = true;
    if (location.hash !== hash) history.replaceState(null, '', hash);
    markCurrent(hash.slice(1));           // optimistic; the spy confirms shortly
  };

  const wireNav = () => {
    if (!side) return;
    side.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const url = new URL(a.getAttribute('href'), location.href);
      if (url.pathname !== location.pathname || !url.hash) return;   // a real navigation
      const target = document.querySelector(url.hash);
      if (!target) return;
      e.preventDefault();
      goToSection(target, url.hash);
    });

    // back/forward, and any anchor the delegate above does not own.
    // No re-entrancy: goToSection uses replaceState, which never fires this.
    window.addEventListener('hashchange', () => {
      const el = location.hash && document.querySelector(location.hash);
      if (el && el.matches(SLIDES)) goToSection(el, location.hash);
    });

    // The five scroll-spies each own their page's hash and always did;
    // they simply say out loud where they landed. One-directional — the
    // shell never writes history except from goToSection above — so the
    // pages keep working with shell.js absent, the same posture as
    // nav-touch.js. Duplicating five IntersectionObservers here would
    // mean two sources of truth that disagree at threshold boundaries.
    window.addEventListener('shell:section', (e) => {
      // an instant tab-restore jump sets the spies off; while it settles
      // they must not clobber the record we just restored FROM
      if (window.__restoring) return;
      markCurrent(e.detail.id);
      // the spy has just moved the hash with replaceState; let the tab
      // record follow, so leaving and coming back lands where you were
      if (window.ShellTabs && window.ShellTabs.remember) window.ShellTabs.remember();
    });

    // ---- a tab switch lands here (js/tabs.js go): reconcile the overlays
    // to the URL and jump to the tab's exact scroll, INSTANTLY — switching
    // tabs must feel like switching documents, never like navigating one.
    window.addEventListener('shell:restore', (e) => {
      window.__restoring = true;
      window.__hashReady = true;
      if (window.CaseOverlay) window.CaseOverlay.sync();
      if (window.Theater) window.Theater.sync();
      const t = e.detail && e.detail.tab;
      const y = t && t.state && typeof t.state.y === 'number' ? t.state.y : null;
      if (y !== null) {
        window.scrollTo({ top: y, behavior: 'instant' });
      } else {
        const el = location.hash && document.querySelector(location.hash);
        // the same resting place a click would have chosen (restY), so a tab
        // with no remembered scroll opens on the section, not near it
        const top = el ? restY(el) : 0;
        window.scrollTo({ top: top < 100 ? 0 : top, behavior: 'instant' });
      }
      // re-derive the page from where we LANDED, synchronously — the stage
      // observer will confirm later, but markCurrent below writes the tab
      // label from `title`, which is stale until setPage runs
      const mid = window.innerHeight / 2;
      const hit = stages.find(([, el]) => {
        const r = el.getBoundingClientRect();
        return r.top <= mid && r.bottom >= mid;
      });
      // …unless a case overlay just claimed the page for its own row
      if (hit && !(window.CaseOverlay && window.CaseOverlay.openId)) setPage(hit[0], hit[2]);
      markCurrent(location.hash ? location.hash.slice(1) : null);
      clearTimeout(window.__restoreTimer);
      window.__restoreTimer = setTimeout(() => { window.__restoring = false; }, 180);
    });
    window.addEventListener('shell:progress', (e) => {
      const kids = side.querySelector('.side-row.is-current')
        && side.querySelector('.side-row.is-current').closest('.side-node')
             .querySelector(':scope > .side-kids');
      if (kids) kids.style.setProperty('--p', e.detail.p);
    });
  };

  // ---- the ask pill and the AI row are real links to ai.html; when the
  // overlay is available they open it instead. Progressive enhancement,
  // the same posture as the section links.
  const wireAI = () => {
    const openIt = (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (!window.AIChat) return;
      e.preventDefault();
      window.AIChat.open();
    };
    const pill = document.getElementById('ask-pill');
    if (pill) pill.addEventListener('click', openIt);
    const row = side && side.querySelector('.side-link[data-page="ai"]');
    if (row) row.addEventListener('click', openIt);

    document.addEventListener('keydown', (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
      if (!window.AIChat) return;
      e.preventDefault();
      if (window.AIChat.isOpen()) window.AIChat.close();
      else window.AIChat.open();
    });
  };

  if (!EMBED) {
    buildChrome();
    buildSide();
    buildAI();

    const grip = document.createElement('div');
    grip.className = 'side-grip';
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-orientation', 'vertical');
    grip.title = 'Drag to resize · double-click to reset';
    shell.appendChild(grip);
    wireGrip(grip);
    wireNav();
    wireAI();

    // ---- a real page load: land on the exact pixel this tab remembered
    // (banked by pagehide / remember in js/tabs.js). Runs before the reveal
    // rAFs, so there is no flash of the top of the page; the deep-link
    // section jumps in the scroll spies stand down when they see the flag.
    const t0 = window.ShellTabs && window.ShellTabs.activeTab && window.ShellTabs.activeTab();
    if (t0 && t0.state && typeof t0.state.y === 'number' && t0.state.y > 0) {
      window.__pixelRestore = true;
      window.scrollTo(0, t0.state.y);
      // scripts after this one (timeline.js) re-lay the bio spread and can
      // shift the target — assert the pixel once more on the first frame
      requestAnimationFrame(() => window.scrollTo(0, t0.state.y));
    }
  } else {
    // ---- the bridge back to the parent frame. Registered at load time,
    // AFTER every parse-time listener on this document, so a page overlay
    // that owns Escape (nextlevel's .look preventDefaults it) always gets
    // the first press; an unclaimed press closes the whole case frame.
    window.addEventListener('load', () => {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          parent.postMessage({ t: 'case:close' }, '*');
        }
      });
    });
    // cross-page links leave through the parent (hash-only links keep
    // working inside the frame); modified clicks stay real navigations
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === '_blank') return;
      const url = new URL(a.getAttribute('href'), location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      parent.postMessage({ t: 'case:nav',
        href: (url.pathname.split('/').pop() || 'index.html') + url.search + url.hash }, '*');
    });
  }

  // ---- light up. The home page hands this to the typewriter so the name
  // types before the furniture arrives; every other page just appears.
  const lightUp = () => {
    if (chrome) chrome.classList.add('is-lit');
    if (side) side.classList.add('is-lit');
  };
  if (root.classList.contains('intro-pending')) {
    window.addEventListener('shell:intro-done', lightUp, { once: true });
  } else {
    lightUp();
  }

  // ---- ONE PAGE. Home, About, Work, Play and AI are sections of a single
  // document, so the rail's PAGE row has to move as you scroll the same way
  // its section row already does. Each top-level stage reports itself; the
  // accent and the tab label follow. On the case studies, which are still
  // their own files, there is only one stage and this never fires. ----
  const setPage = (id, label) => {
    if (id === page && label === title) return;
    page = id;
    title = label;
    side.querySelectorAll('.side-row.is-current').forEach((r) => r.classList.remove('is-current'));
    side.querySelectorAll('.side-link[aria-current]').forEach((a) => a.removeAttribute('aria-current'));
    const cur = side.querySelector('.side-link[data-page="' + id + '"]');
    if (cur) {
      cur.setAttribute('aria-current', 'page');
      cur.closest('.side-row').classList.add('is-current');
    }
    const lbl = document.querySelector('.chrome-tab.is-active .tab-label');
    if (lbl) lbl.textContent = title;
  };

  const STAGES = [['home', '#home', 'Home'], ['work', '.work-stage', 'Work'],
                  ['about', '.about-stage', 'About'], ['play', '.play-stage', 'Play']];
  const stages = STAGES.map(([id, sel, label]) => [id, document.querySelector(sel), label])
                       .filter(([, el]) => el);
  if (stages.length > 1 && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const hit = stages.find(([, el]) => el === e.target);
        if (hit) setPage(hit[0], hit[2]);
      });
    }, { threshold: 0.01, rootMargin: '-45% 0px -45% 0px' });
    stages.forEach(([, el]) => io.observe(el));
  }

  // ---- the seam: ONE hairline along everything the card's edge does.
  // It runs in from the right along the strip's floor, climbs the active tab,
  // comes back down, turns the card's corner and carries on to the foot of the
  // window — because the tab is a HOLE in the cream, and no border can follow
  // a hole.
  //
  // Both halves are strokes in the same SVG, and that is the point. The
  // vertical run was a 1px box on the grip for a while, and a CSS box and an
  // SVG stroke are two different renderings of the same intention: the box
  // began half a pixel below where the arc's cap ended, and painted crisp
  // where the arc was antialiased. Two strokes from one measurement meet at a
  // single coordinate instead — the arc's last point IS the edge's first.
  // It stays a separate path only so the stretch you can actually drag can
  // answer the pointer on its own. ----
  let seamPath = null;
  let seamEdge = null;
  const drawSeam = (c, t, r, fl, fr) => {
    if (!chrome || !shell) return;
    if (!seamPath) {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'shell-seam');
      svg.setAttribute('aria-hidden', 'true');
      seamPath = document.createElementNS(NS, 'path');
      seamEdge = document.createElementNS(NS, 'path');
      seamEdge.setAttribute('class', 'seam-edge');
      svg.appendChild(seamPath);
      svg.appendChild(seamEdge);
      chrome.insertAdjacentElement('afterend', svg);
    }
    const card = document.getElementById('shell-card');
    if (!card || !c.width) {
      seamPath.removeAttribute('d');
      seamEdge.removeAttribute('d');
      return;
    }
    const k = card.getBoundingClientRect();
    // half-pixel offsets: a 1px stroke centred ON the boundary would straddle
    // two pixel columns and render as a 2px smudge
    const F = Math.round(c.bottom) - 0.5;        // the strip's floor
    const L = Math.round(k.left) + 0.5;          // the card's left edge
    const R = Math.max(0, parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0);
    // the far right edge, in along the floor, over the tab, round the corner.
    // With no tab to climb it is simply the floor.
    let d = 'M' + Math.round(c.right) + ' ' + F;
    if (t) {
      const tl = Math.round(t.left) + 0.5;
      const tr = Math.round(t.right) - 0.5;
      const tt = Math.round(t.top) + 0.5;
      // the clip's own silhouette, traversed right-to-left — which is why
      // every sweep flag here is the opposite of the one above
      d += ' H' + (tr + fr) +
           ' A' + fr + ' ' + fr + ' 0 0 1 ' + tr + ' ' + (F - fr) +
           ' V' + (tt + r) +
           ' A' + r + ' ' + r + ' 0 0 0 ' + (tr - r) + ' ' + tt +
           ' H' + (tl + r) +
           ' A' + r + ' ' + r + ' 0 0 0 ' + tl + ' ' + (tt + r) +
           ' V' + (F - fl) +
           ' A' + fl + ' ' + fl + ' 0 0 1 ' + (tl - fl) + ' ' + F;
    }
    d += ' H' + (L + R);
    if (R > 0) d += ' A' + R + ' ' + R + ' 0 0 0 ' + L + ' ' + (F + R);
    seamPath.setAttribute('d', d);
    // …and on down the rail's edge from the exact point the arc landed on.
    // Only while there IS a rail: closed, the card's left edge is the window's,
    // and a hairline drawn along the outside of the screen means nothing.
    if (k.left > 1) seamEdge.setAttribute('d', 'M' + L + ' ' + (F + R) +
                                               ' V' + Math.ceil(window.innerHeight));
    else seamEdge.removeAttribute('d');
  };

  // ---- the hole in the strip: the tab's own silhouette, cut out of the
  // cream so the card behind shows through it. Rounded top corners, standing
  // on the strip's floor — not a rectangle to the top of the screen. The
  // measurement has to happen AFTER the tabs are laid out, which is why the
  // tab itself is observed and not just the strip. ----
  const fitTabHole = () => {
    if (!chrome) return;
    const tab = chrome.querySelector('.chrome-tab.is-active');
    const c = chrome.getBoundingClientRect();
    if (!tab || !c.width) {
      chrome.style.removeProperty('--strip-clip');
      drawSeam(c, null);
      return;
    }
    const t = tab.getBoundingClientRect();
    const x = +(t.left - c.left).toFixed(1);
    const y = +(t.top - c.top).toFixed(1);
    const w = +t.width.toFixed(1);
    const W = +c.width.toFixed(1);
    const H = +c.height.toFixed(1);
    const r = Math.min(parseFloat(getComputedStyle(tab).borderTopLeftRadius) || 9, w / 2);
    if (w < 2) {
      chrome.style.removeProperty('--strip-clip');
      drawSeam(c, null);
      return;
    }
    const F = H;
    // The hole is the tab's silhouette INCLUDING the flare: a concave
    // fillet at each foot widens the cut down onto the strip's floor, so
    // page content scrolling up behind the strip travels through the
    // flares exactly as it travels through the tab. (These used to be
    // opaque quarter-disc squares painted next to the hole — which is why
    // scrolling content hit a hard corner there.)
    const fl = Math.max(0, Math.min(9, x));            // left fillet radius
    const fr = Math.max(0, Math.min(9, W - (x + w)));  // right fillet radius
    // the strip, then the flared tab subtracted from it (evenodd)
    const path =
      'M0 0 H' + W + ' V' + F + ' H0 Z ' +
      'M' + (x - fl) + ' ' + F +
      ' A' + fl + ' ' + fl + ' 0 0 0 ' + x + ' ' + (F - fl) +
      ' V' + (y + r) +
      ' A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y +
      ' H' + (x + w - r) +
      ' A' + r + ' ' + r + ' 0 0 1 ' + (x + w) + ' ' + (y + r) +
      ' V' + (F - fr) +
      ' A' + fr + ' ' + fr + ' 0 0 0 ' + (x + w + fr) + ' ' + F +
      ' Z';
    chrome.style.setProperty('--strip-clip', '"' + path + '"');
    // the mouth is wider than the tab by a flare at each foot — the seam
    // drawn under the tab reaches out by exactly these to meet the cream
    chrome.style.setProperty('--flare-l', fl + 'px');
    chrome.style.setProperty('--flare-r', fr + 'px');
    drawSeam(c, t, r, fl, fr);
  };
  // RETIRED. This hit-tested fourteen points across the tab's label on every
  // scroll frame to catch page content sliding behind it, and turned the
  // label orange when it did. Content still passes behind — but the label
  // now rides a pill of the page's own surface (.tab-id in shell.css), so it
  // is never in the type's way to begin with. A plate that is always right
  // beats a colour change that has to be recomputed every frame.
  //
  // CRITICAL: do NOT call classList.remove('is-over') unconditionally.
  // Chromium fires a MutationObserver record for remove() even when the
  // token is absent (oldValue === newValue). The tab-list observer below
  // used to react to that by calling remove() again → infinite rAF loop,
  // continuous clip-path restyles, and the Vicino case study "glitching"
  // while you scrolled. Clear once, only if worn; never from scroll/MO.
  const clearTabOver = () => {
    const tab = chrome && chrome.querySelector('.chrome-tab.is-over');
    if (tab) tab.classList.remove('is-over');
  };
  window.__shellTabOver = clearTabOver;

  window.__shellTabHole = fitTabHole;
  const watchTabHole = () => {
    fitTabHole();
    clearTabOver();
    if (!chrome) return;
    // js/tabs.js repaints with box.innerHTML, so EVERY tab node is replaced on
    // every open, close and switch — observing a tab element directly leaves
    // the observer holding a detached node and the hole frozen where the old
    // active tab used to be. Watch the LIST instead, which survives, and
    // re-measure on any change to it.
    const list = document.getElementById('tab-list') || chrome;
    if ('MutationObserver' in window) {
      let holeRaf = 0;
      new MutationObserver(() => {
        if (holeRaf) return;
        holeRaf = requestAnimationFrame(() => { holeRaf = 0; fitTabHole(); });
      }).observe(list, { childList: true, subtree: true, attributes: true,
                         attributeFilter: ['class'] });
    }
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => fitTabHole());
      ro.observe(chrome);
      ro.observe(list);
      // …and the CARD, which the clip never needed but the seam does: its left
      // edge is where the line turns the corner. The card is the only thing
      // that moves when the rail slides — including the intro's slide-in,
      // after which the seam would otherwise still be drawn against the
      // screen's edge, where the card was while the rail was held out.
      const card = document.getElementById('shell-card');
      if (card) ro.observe(card);
    }
    // The corner itself ARRIVES: the card's radius transitions 0 → 10px as the
    // frame assembles around the name (html.intro-run in shell.css). A resize
    // is the only thing that re-measures the seam, the rail lands in one frame,
    // and that frame is the one where the corner is still square — so the seam
    // read a radius of 0, drew a square corner over a round card, and never
    // looked again. Measure once more when the corner lands.
    const card = document.getElementById('shell-card');
    if (card) {
      card.addEventListener('transitionend', (e) => {
        if (/radius/.test(e.propertyName)) fitTabHole();
      });
    }
  };
  requestAnimationFrame(watchTabHole);        // after the strip has laid out
  const refitChrome = () => fitTabHole();
  window.addEventListener('resize', refitChrome, { passive: true });
  window.addEventListener('shell:fit', refitChrome);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refitChrome);

  window.Shell = { get page() { return page; }, get title() { return title; },
                   lightUp, toggleRail, markCurrent, fitTabHole, setPage };
})();
