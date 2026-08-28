// The shell — populates the sidebar, and the sidebar is the whole frame.
//
// THE STRIP IS GONE. The site wore a mini-browser for a while: a chrome
// strip of tabs above an L of furniture, with back/forward, a tab per
// place you had been, and the location chip at its far end. Every one of
// those was a second copy of something the browser already draws two
// centimetres higher — its own tabs, its own back button, its own address
// — and the strip's whole cost was paid in the machinery under it: a clip
// path re-cut on every mutation, a seam drawn in SVG because a hole in a
// strip cannot take a border, a per-tab scroll record in sessionStorage,
// and an entire second history model (the trail) built because the scroll
// spies had to replaceState. All of it is deleted.
//
// What is left is the thing that was carrying the site anyway: ONE RAIL.
// It holds identity, the tree, what is happening now, and — at its foot —
// where the visitor is, on a globe (js/globe.js) that used to be a
// popover hanging off the strip and is simply part of the column now.
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
  const side = document.getElementById('shell-side');
  let page = shell.dataset.page || 'home';
  let title = shell.dataset.title || 'Home';

  // ---- embed mode: this document is inside the case overlay's iframe on
  // index.html (?embed=1 → html.is-embed, set pre-paint in <head>). The
  // page is CONTENT there, not a window: no rail, no AI sheet, no dock.
  const EMBED = root.classList.contains('is-embed');

  // ---- scroll restoration is OURS, and it rides HISTORY.STATE now.
  //
  // It used to ride the tab strip: each tab banked its own scrollY and the
  // shell put you back on it. That was always the wrong place for it — the
  // pixel belongs to the history ENTRY, not to a strip of our own drawing —
  // and with the strip gone the right answer is also the shorter one. The
  // browser's automatic restore cannot be left on: the scroll spies
  // replaceState the hash constantly, and the three pages that land their
  // own deep links (work.js, about.js, play-pager.js) would race it.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // ---- Bank the pixel into the current entry.
  //
  // Throttled to twice a second, and that number is not taste: Safari
  // throws a SecurityError after ~100 history writes in 30 seconds, and the
  // five scroll-spies are ALREADY replaceState-ing the hash as you read. A
  // per-frame bank would spend the whole allowance in under two seconds and
  // take the spies down with it. Half a second is finer than anyone can
  // notice on a restore and costs 60 writes a minute.
  const write = () => {
    if (window.__restoring) return;
    try {
      history.replaceState(Object.assign({}, history.state, { y: window.scrollY }),
                           '', location.href);
    } catch (err) { /* rate-limited, or private mode — skip this one */ }
  };
  let bankT = 0;
  const bank = () => {
    if (bankT) return;
    bankT = setTimeout(() => { bankT = 0; write(); }, 500);
  };
  window.addEventListener('scroll', bank, { passive: true });
  // …and outright on the way out, because there is no later
  window.addEventListener('pagehide', () => { clearTimeout(bankT); bankT = 0; write(); });

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

  // (faviconFor retired with the tab strip: it turned a page id into the
  // glyph a tab wore, and nothing but a tab ever asked for that. The rail
  // builds its own glyphs straight off TREE in rowHTML.)

  // the chain of ids that must be open for the current page to be visible
  const ANCESTORS = { vicino: ['work'], pantrypal: ['work'], nextlevel: ['work'] };
  const openChain = new Set([page].concat(ANCESTORS[page] || []));

  // ---- what the visitor last opened, remembered for the session only:
  // a rail that stays exactly as you left it across a page load is the
  // whole point of a persistent sidebar
  const OPEN_KEY = 'shell.open';
  let opened;
  try {
    opened = new Set(JSON.parse(sessionStorage.getItem(OPEN_KEY) || '[]'));
  } catch (err) { opened = new Set(); }
  // Work arrives CLOSED. The rail's first job is to show the shape of the
  // site — five pages, one screen, nothing pre-unpacked — and three case
  // studies spilled under Work on arrival made the column read as eight
  // peers before you had asked for any of them. The twisty is right there,
  // and openChain below still forces Work open whenever you are actually
  // reading a case study, so the row you are on is never hidden.
  openChain.forEach((id) => opened.add(id));
  const saveOpen = () => {
    try {
      sessionStorage.setItem(OPEN_KEY, JSON.stringify(Array.from(opened)));
    } catch (err) { /* private mode — the rail just forgets */ }
  };

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');


  // ============================================================
  // RETIRED WITH THE STRIP — the trail, and the jump menu.
  //
  // The TRAIL was the shell's own back and forward: a list of the sections
  // you had actually HELD for 700ms, walked by two buttons in the strip,
  // handing off to real history at either end. It existed because the
  // scroll spies replaceState the hash on purpose (an entry per section
  // would put a hundred stops in the browser's history on one scroll), so
  // the browser's Back could not answer "the last section I was in".
  //
  // It is gone with the buttons that drove it. Nothing is lost that the
  // browser does not already do better one row higher: Back still leaves a
  // case study, still leaves the game theater, still walks between pages —
  // and within the one page, "back" was never a question anyone asked of a
  // scroll. What the trail cost was a second, invisible history model that
  // had to be kept in step with the real one.
  //
  // The JUMP MENU was the pages, hung off the + while the rail was shut —
  // an affordance that only existed because closing the rail left the site
  // with no visible navigation at all. The rail's own reopen button
  // (.rail-open, below) answers that in one click instead of teaching a
  // second navigation system that appears under one condition.
  // ============================================================

  // ---- the rail: closed means CLOSED, and its width belongs to the visitor
  //
  // …but the rail ARRIVES OPEN. Collapsed is remembered for the SESSION
  // only, which is the scope the twisties already use (OPEN_KEY above) and
  // for the same reason: closing the rail is something you do while you are
  // reading, not a preference you are setting for good. Kept in
  // localStorage it outlived the visit — one click, once, and every visit
  // after it opened the site with no navigation showing at all. Inside a
  // session it still stays exactly as you left it across every page load,
  // which is the whole point of a persistent sidebar; a new visit gets the
  // map. The dragged WIDTH is a different animal — that IS a preference,
  // and it hides nothing, so it stays in localStorage.
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
    const tool = document.querySelector('.side-tool[data-act="rail"]');
    if (tool) {
      tool.setAttribute('aria-label', next ? 'Show sidebar' : 'Hide sidebar');
      tool.title = tool.getAttribute('aria-label');
    }
    try { sessionStorage.setItem(RAIL_KEY, next ? '1' : '0'); } catch (err) { /* private mode */ }
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
  };
  try {
    if (sessionStorage.getItem(RAIL_KEY) === '1') root.classList.add('rail-closed');
    // the retired key, swept as we pass: anyone who collapsed the rail while
    // it lived in localStorage would otherwise carry that one click forever
    // in storage we no longer read
    localStorage.removeItem(RAIL_KEY);
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
  // WHERE it sits: the foot. Status belongs at the bottom of a rail with
  // navigation above it, and parking it there gives the column a weighted
  // floor instead of a long fall to nothing.
  //
  // The dot is a marker, not a light: the same grey as the place dot in the
  // chrome, filled for the present and hollow for the not-yet. It used to be
  // orange and breathing, which spent an accent and a running animation to
  // say what the word "now" above it already says.
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

  // (GONE 2026-08-24: REST and ASKS — the resting label and the four
  // questions the ghost writer typed. They belonged to the rail's ask
  // blank; the corner dock replaced them, and the hero composer has now
  // replaced the dock. The chips in index.html are what became of the
  // four questions. The typewriter idiom survives where it started, on
  // the hero's name — js/typewriter.js.)

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
      // ---- the toggle, and it sits ABOVE the letterhead rather than
      // beside it. Beside it was the obvious place and it does not fit:
      // the rail's 168 is a MEASURED floor (see the top of css/shell.css)
      // — the width at which nothing in the column ellipsises — so a
      // button on the name's row would cut the name. On its own row it
      // costs nothing but 28px of height, and it lands on the same left
      // inset every glyph in the rail uses.
      //
      // It is also the same PLACE the reopen button takes when the rail is
      // shut (.rail-open, appended to the shell below). Open or closed,
      // the toggle is in the top-left corner of the frame and does not
      // move; only the surface behind it changes.
      // …and the toggle shares its row with WHERE YOU ARE: the region the
      // visitor is reading from and the local time there, which opens the
      // globe on hover (js/globe.js) out into the page beside the rail.
      //
      // It has been three places in a day — the far end of the chrome
      // strip, the foot of this column drawn permanently, and a floating
      // pill over the hero — and this is the one that costs nothing. The
      // head row already existed for the toggle and was 120px of empty
      // cream to its right; the clock is the only thing on the site quiet
      // enough to sit in it. No dot: that was the strip's "you are here"
      // marker, and a ticking clock does not need one.
      //
      // `data-clock` is an attribute contract, not an id — js/frame-clock.js
      // finds its targets by attribute precisely so this pair can move
      // between the strip, the corner and this row without the clock ever
      // knowing that it has.
      '<div class="side-tools">' +
        '<button class="side-tool" type="button" data-act="rail" ' +
          'aria-label="Hide sidebar" title="Hide sidebar">' + svg(G.rail, 1.9) + '</button>' +
        '<button class="side-place" type="button" data-globe ' +
          'aria-label="Where you are">' +
          '<span class="side-place-city" data-clock="state">&nbsp;</span>' +
          '<span class="side-place-time" data-clock="time">--:--</span>' +
        '</button>' +
      '</div>' +
      // ============================================================
      // The letterhead — a name and a role, and nothing else.
      //
      // It held the ask blank underneath it for a while: one asterisk and
      // a rotating question on a dotted rule, the AI's quiet door. That
      // went, then a corner pill took its place, and now the composer is
      // the home screen itself. The rule that killed all three is the
      // same one: the AI is ONE door, and a site with one door does not
      // put a second, quieter copy of it in the rail.
      //
      // So the rail is identity, in the one material it speaks
      // everywhere: ink on the bone, no surface, no box.
      //
      // It IS a link — but home, which is the one thing a wordmark in the
      // top-left corner has always meant. That is not the rule it used to
      // break: "a name set as plain type must not be a trapdoor into a
      // dialog" was about the AI sheet opening out of a line of identity,
      // which nobody expects. Going home is what everybody expects, and
      // on the home page itself the rail delegate glides it back up to
      // the hero rather than reloading the document (wireNav). The AI's
      // doors are the dock and ⌘K, and neither of them is this.
      '<a class="ask-chip" id="ask-chip" href="index.html#home">' +
        '<span class="side-id-text">' +
          '<span class="side-name">Tigo Ponce de León</span>' +
          '<span class="side-role">product design engineer</span>' +
        '</span>' +
      '</a>' +
      '<nav class="side-scroll" id="side-scroll" aria-label="Site">' + groups + '</nav>' +
      '<div class="side-foot">' +
        statusHTML() +
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
      const tool = e.target.closest('.side-tool');
      if (tool && tool.dataset.act === 'rail') { toggleRail(); return; }
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
  // The AI sheet is GONE, and with it the dock that opened it.
  //
  // The chat is the home page now: it lives in index.html inside #home,
  // as markup rather than as a template string here, because a template
  // in this file earns its place by being identical on nine documents
  // and this one would render on exactly one. What used to stand here —
  // AI_PANEL, buildAI(), buildDock() and the filled ink pill in the
  // card's corner — went with it.
  //
  // ⌘K still works everywhere. It is a door to the composer now rather
  // than a toggle for a sheet: on Home it rests the hero and puts the
  // caret in the field, and on a case study it is a real navigation
  // home. See wireAsk().
  // ============================================================

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

  // ---- The home page answers to TWO spellings of one URL: the host serves
  // index.html at '/', and the rail's hrefs are deliberately full paths
  // (index.html#work, so the identical tree can be emitted on all nine
  // documents and every row stays crawlable and cmd-clickable). Comparing
  // the raw pathnames therefore answered "different document" for every
  // section link on the site's own front door — '/' is not '/index.html' —
  // and each click fell straight through to a real page load. That is the
  // whole of the bug this fixes: no glide and no centring, because nothing
  // below ever ran; what the visitor got was the browser's own fragment
  // jump, which parks a section's top edge behind the chrome strip. Fold
  // the two spellings into one before asking whether they match.
  const norm = (p) => p.replace(/(^|\/)index\.html$/, '$1');
  const samePage = (a, b) => norm(a) === norm(b);

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
  // One thing stays honest: a section that already fills the window has no
  // middle to find, so it lands its top edge at the top instead. That rule
  // is what keeps Home and About where they belong — the hero is a full
  // screen that centres itself, and its "scroll" cue sits on the floor on
  // purpose, so reading it as ink would drag the whole page down.
  //
  // (The reading area used to START below the sticky strip, so every
  // measurement here carried a `head` of 40. The strip is gone and the card
  // runs to y=0, so the reading area is simply the window.)
  // ============================================================

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
    const view = window.innerHeight;                  // the reading area
    const box = el.getBoundingClientRect();
    const clamp = (y) => Math.round(Math.min(Math.max(y, 0),
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight)));

    // the 1px slack matters: a stage sized to exactly one screen of card
    // (--hero-h, scaled back up by zoom) can measure 859.99 against a 860
    // reading area, and a hair's rounding must not flip it to "centre me"
    if (box.height >= view - 1) return clamp(box.top + window.scrollY);

    const ink = inkOf(el);
    return clamp(ink.top + window.scrollY - (view - ink.height) / 2);
  };

  // ============================================================
  // …and STAYING there.
  //
  // An arrival — a deep link, or the rail followed from another document —
  // lands while the page is still assembling. The intro types, the rail
  // then slides in, which re-scales the card, which re-measures --hero-h,
  // moves the section out from under the scroll that just aimed at it. So
  // the landing is re-asserted on a slow poll until the page stops moving,
  // and the visitor's first real input takes the scroll back for good.
  //
  // A tick every 100ms rather than every frame: per-frame races the
  // browser's own fragment scroll for ids INSIDE the section (#vicino,
  // #pantrypal, #drone are real elements in the Work grid) and the two
  // trade the page back and forth. 100ms lands after each has had its say.
  //
  // This was js/work.js's alone, which is why arriving at Work put it where
  // the rail puts it and arriving at Play or About did not — those two
  // landed once, early, and kept whatever the assembling page did to them
  // afterwards. One implementation, one resting place.
  // ============================================================
  const land = (el) => {
    if (!el) return;
    const root = document.documentElement;
    const put = () => window.scrollTo({ top: restY(el), behavior: 'instant' });
    const stop = performance.now() + 8000;          // never poll forever
    let held = true;
    let until = performance.now() + 1200;
    // The deadline cannot be a fixed one, and `intro-pending` is the honest
    // signal for "still moving": it is on the root from before first paint
    // and comes off when the intro has assembled. A deadline alone expires
    // seconds early on a cold visit. Each event that can still shift the
    // page pushes it out.
    const timer = setInterval(() => {
      const now = performance.now();
      const settling = root.classList.contains('intro-pending');
      if (!held || now > stop || (!settling && now > until)) { release(); return; }
      put();
    }, 100);
    function release() { held = false; clearInterval(timer); }
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) =>
      window.addEventListener(t, release, { once: true, passive: true }));
    const extend = (ms) => { until = Math.max(until, performance.now() + ms); };
    window.addEventListener('load', () => extend(400));
    window.addEventListener('shell:fit', () => extend(400));
    window.addEventListener('shell:intro-done', () => extend(1600));
    put();
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
      if (!samePage(url.pathname, location.pathname) || !url.hash) return;  // a real navigation
      const target = document.querySelector(url.hash);
      if (!target) return;
      e.preventDefault();
      goToSection(target, url.hash);
    });

    // ---- the same courtesy for anchors inside the PAGE, not just the
    // sidebar. A cover's "try the working canvas" pointed at a chapter and
    // got the browser's instant jump, because html has scroll-behavior:auto
    // (shell.css — the decks set it deliberately) and this delegate used to
    // stop at the rail. Scoped exactly like the hashchange handler below:
    // same document, and the target must BE a slide, so cross-page links,
    // target=_blank exhibits and modified clicks all fall through. ----
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || side.contains(a)) return;                      // the rail is handled above
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== '_self') return;
      const url = new URL(a.getAttribute('href'), location.href);
      if (!samePage(url.pathname, location.pathname) || !url.hash) return;
      const target = document.querySelector(url.hash);
      if (!target || !target.matches(SLIDES)) return;
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
      // the spy has just moved the hash with replaceState, which drops the
      // banked pixel with the old entry's state — put it back
      bank();
    });

    window.addEventListener('shell:progress', (e) => {
      const kids = side.querySelector('.side-row.is-current')
        && side.querySelector('.side-row.is-current').closest('.side-node')
             .querySelector(':scope > .side-kids');
      if (kids) kids.style.setProperty('--p', e.detail.p);
    });
  };

  // ---- ⌘K, and it is the only key the AI answers to now. There is no
  // sheet to toggle any more: the chat IS the home screen, so the
  // shortcut means GO ASK rather than open/close. On Home that is a
  // scroll home plus a caret in the field; anywhere else it is a real
  // navigation, the same posture every section link already has.
  const wireAsk = () => {
    const goAsk = () => {
      // #ai-input, not window.AIChat: this file runs before ai-chat.js,
      // so the field is the thing that is actually there to test, and it
      // is looked up inside the handler rather than closed over because
      // by press time the whole document has parsed.
      const field = document.getElementById('ai-input');
      if (!field) {
        location.href = 'index.html#home';       // a case study, or 404
        return;
      }
      // rest the hero first: the composer is only the foot of the SCREEN
      // while the hero IS the screen, so a ⌘K from three sections down
      // has to bring you back to it before the caret means anything.
      const hero = document.getElementById('home');
      if (hero) {
        window.scrollTo({ top: restY(hero),
          behavior: reduced() ? 'auto' : 'smooth' });
      }
      // preventScroll, because the line above is already doing the
      // scrolling and the two would fight over the same frames
      field.focus({ preventScroll: true });
    };

    document.addEventListener('keydown', (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
      e.preventDefault();
      goAsk();
    });
  };

  // ============================================================
  // The letterhead SCROLLS IN — it is not switched on.
  //
  // On the home screen the name and the role are already set, several
  // times over, in the middle of the page. Two spellings of the same
  // words on one screen is not emphasis, it is an echo, and it is the
  // small copy that loses. So on the document that owns the hero —
  // index, and only index: every other page has no #home and this
  // returns at the first line — the rail's letterhead is not there at
  // all, and the tree simply starts at the top of the column.
  //
  // The first version FLIPPED it: two thresholds, a class on and a class
  // off, and a 0.6s transition to cover the switch. That is an animation
  // playing NEAR a scroll, not a thing being scrolled, and it read as
  // one — the letterhead arrived on its own clock and you could pass the
  // trigger without seeing it.
  //
  // This is the honest version. One number, `p`, is the letterhead's
  // progress, and the scroll wheel is the only thing that moves it: the
  // slot opens from zero to the block's full height in exact lockstep
  // with the hero leaving, and the type inside is CLIPPED by that slot,
  // so the name is revealed a line at a time from the top down. Scroll
  // half as far and it is half in; scroll back and it goes back. There
  // is no transition on the geometry at all, because there is nothing to
  // ease — the visitor's hand is the easing.
  //
  // It is spent over HALF A SCREEN of scrolling (the hero holding 88% of
  // the reading area down to 30%), which is the "slowly but surely" part:
  // long enough to be a movement you watch rather than a state you
  // notice has changed.
  //
  // Two curves shape it, both applied to the same raw travel:
  //   · smoothstep on the geometry, so the slot eases out of nothing and
  //     into place instead of starting and stopping at full speed;
  //   · the ink lags the slot (it waits until the slot is 18% open and is
  //     fully up at 85%), so the first thing that happens is the space
  //     being made and the last is the name landing in it. Type that
  //     faded in exactly as fast as its own box opened read as one blurry
  //     event; staged, it reads as two — make room, then arrive.
  //
  // Measured against the READING AREA (the window under the sticky
  // strip, the line every other spy on this site reads).
  // ============================================================
  const wireAskReveal = () => {
    const chip = document.getElementById('ask-chip');
    const hero = document.getElementById('home');
    if (!chip || !hero) return;

    // ---- the slot's full height, MEASURED, not declared. The block is
    // system type at two sizes, so its height is whatever the visitor's
    // machine renders it at and a number off SF Pro would be a near-miss
    // on every other font. Measured on the TEXT, never on the chip: the
    // chip's own height is the thing this drives, so measuring it would
    // be reading back the answer. Re-run when the real face lands.
    const fit = () => {
      const text = chip.querySelector('.side-id-text');
      if (!text) return;
      const h = text.getBoundingClientRect().height;
      if (h > 1) chip.style.setProperty('--ask-h', h + 'px');
    };
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    chip.classList.add('is-tracked');   // only now is the geometry safe to arm

    const IN = 0.88;                 // hero's share of the screen: p = 0 above
    const OUT = 0.30;                // …and p = 1 below
    const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const smooth = (v) => v * v * (3 - 2 * v);

    let last = -1;
    const apply = (p) => {
      if (Math.abs(p - last) < 0.001) return;
      last = p;
      chip.style.setProperty('--ask-p', smooth(p).toFixed(4));
      chip.style.setProperty('--ask-o', smooth(clamp((p - 0.18) / 0.67)).toFixed(4));
      // out of the tab order until there is something to reach — a
      // letterhead nobody can see must not be what Tab finds first
      if (p <= 0.001) chip.setAttribute('inert', '');
      else chip.removeAttribute('inert');
    };

    const read = () => {
      const view = Math.max(1, window.innerHeight);
      const r = hero.getBoundingClientRect();
      // the share of the reading area the hero still holds
      const vis = (Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)) / view;
      apply(clamp((IN - vis) / (IN - OUT)));
    };

    read();

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; read(); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // the card rescales on a rail slide or a seam drag, which moves the
    // hero under a stationary scroll position
    window.addEventListener('shell:fit', onScroll);
  };

  if (!EMBED) {
    buildSide();

    // ---- and the way back in. With the rail shut the site has no visible
    // navigation at all, which is exactly the hole the strip's jump menu
    // used to paper over; this is the one-click answer instead. It stands
    // where the rail's own toggle stands, so the button does not move when
    // the column goes — the surface behind it does.
    const reopen = document.createElement('button');
    reopen.type = 'button';
    reopen.className = 'rail-open';
    reopen.setAttribute('aria-label', 'Show sidebar');
    reopen.title = 'Show sidebar';
    reopen.innerHTML = svg(G.rail, 1.9);
    reopen.addEventListener('click', toggleRail);
    shell.appendChild(reopen);

    const grip = document.createElement('div');
    grip.className = 'side-grip';
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-orientation', 'vertical');
    grip.title = 'Drag to resize · double-click to reset';
    shell.appendChild(grip);
    wireGrip(grip);
    wireNav();
    wireAsk();

    // ---- a real page load: land on the exact pixel this HISTORY ENTRY
    // banked (see `bank` at the top of this file). Runs before the reveal
    // rAFs, so there is no flash of the top of the page; the deep-link
    // section jumps in the scroll spies stand down when they see the flag.
    // …on a laptop. ≤700px the page is not one document any more — it is
    // four screens you tap between (js/mobile.js), and a pixel banked on
    // one of them means nothing on another. The pager owns the scroll
    // there, and it remembers each screen's place itself.
    const y0 = !matchMedia('(max-width: 700px)').matches &&
      history.state && typeof history.state.y === 'number' ? history.state.y : 0;
    if (y0 > 0) {
      window.__pixelRestore = true;
      window.scrollTo(0, y0);
      // scripts after this one (timeline.js) re-lay the bio spread and can
      // shift the target — assert the pixel once more on the first frame
      requestAnimationFrame(() => window.scrollTo(0, y0));
    }

    // LAST, and after the pixel restore on purpose: this reads the hero's
    // rect to decide whether the letterhead is there at all, and reading
    // it before the restore would answer for the top of a page the visitor
    // is not on.
    wireAskReveal();
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
    if (side) side.classList.add('is-lit');
    // the composer arrives with the furniture — on Home that means after
    // the name has finished typing, so the set piece is never interrupted
    // by a field sliding in underneath it halfway through. This is the
    // dock's old posture, kept: one arrival, everything in it.
    const stage = document.getElementById('ai-stage');
    if (stage) stage.classList.add('revealed');
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
  // the document's own name, before anything starts appending to it
  const BASE = document.title;

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
    // ---- and the document says which page it is on.
    //
    // The strip used to do this: the active tab re-lettered itself as you
    // scrolled from Home to Work to About, which was the one genuinely
    // good reason to draw a tab of our own. The browser has a tab too, and
    // this is the line it reads — so the behaviour survives its cause.
    //
    // PAGE only, never the section: the tab appended "/ Discovery" as
    // well, and a browser tab is 200px wide with a favicon in it. And
    // Home is the document's own name, so it says nothing extra.
    document.title = (title && title !== 'Home') ? title + ' — ' + BASE : BASE;
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

  // ---- THE SEAM IS A BORDER AGAIN.
  //
  // It was drawn in SVG, in viewport coordinates, re-cut every frame — and
  // it had to be, because it ran in along the strip's floor, climbed the
  // active TAB (a hole in the cream, and no border can follow a hole), came
  // back down, turned the card's corner and carried on to the foot of the
  // window. Four measurements, a MutationObserver on the tab list, two
  // ResizeObservers and a rAF chase through the intro, all to draw one
  // hairline that a border could not.
  //
  // With no strip and no tab there is no hole: the seam is the rail's own
  // right edge, top to bottom, and `border-right` on .shell-side says it in
  // one line (css/shell.css). The accent on grip-hover goes with it, as
  // does the "reach" — the stretch of column that used to run up past the
  // tabs, which is now simply part of the edge.


  // restY and land are published for the same reason markCurrent is: a
  // section has ONE resting place, and the three pages that land their own
  // deep links (work.js, about.js, play-pager.js) were each doing their own
  // arithmetic for it. They agreed with the rail once and then quietly
  // stopped, so arriving at Work from a case study parked it at the top of
  // the reading area while clicking Work from the rail centred it. One
  // function, one answer — and one poll that holds it there.
  window.Shell = { get page() { return page; }, get title() { return title; },
                   lightUp, toggleRail, markCurrent, setPage, restY, land };
})();
