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
  const page = shell.dataset.page || 'home';
  const title = shell.dataset.title || 'Home';

  // ---- the icon vocabulary: the site's own 26-box line glyphs, lifted
  // from js/nav-touch.js, about.html and the two case studies so the rail
  // speaks in shapes the visitor has already seen.
  const svg = (paths, size, weight) =>
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 26 26" ' +
    'aria-hidden="true" fill="none" stroke="currentColor" stroke-width="' +
    (weight || 2.2) + '" stroke-linecap="round" stroke-linejoin="round">' +
    paths + '</svg>';

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
    // elsewhere
    link: '<path d="M4.5 16.5 L16.5 4.5" /><path d="M6.5 4.5 H16.5 V14.5" />',
  };

  // brand marks are FILLED, so they get their own 24-box wrapper
  const BRAND = {
    li: '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0zM7.12 20.45H3.56V9h3.56v11.45zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28z"/></svg>',
    gh: '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .3z"/></svg>',
    lb: '<svg width="17" height="11" viewBox="0 0 36 22" aria-hidden="true"><g fill="currentColor"><circle cx="7" cy="11" r="6.5"/><circle cx="18" cy="11" r="6.5" stroke="#fbfbfb" stroke-width="1.6"/><circle cx="29" cy="11" r="6.5" stroke="#fbfbfb" stroke-width="1.6"/></g></svg>',
    gr: '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="19" text-anchor="middle" font-family="Georgia, \'Times New Roman\', serif" font-size="25" font-weight="bold" fill="currentColor">g</text></svg>',
  };

  // ============================================================
  // The site, as a tree. This is the ONLY place that knows its shape.
  //   id    — matches a page's data-page, so the current row and its
  //           ancestors can be lit without any JS guessing
  //   sec   — matches a section id, for the scroll-spy to light
  //   mark  — a real brand image instead of a line glyph
  // ============================================================
  const TREE = [
    { label: 'pages', rows: [
      { id: 'home', href: 'index.html#home', text: 'Home', icon: 'home' },
      { id: 'about', href: 'about.html', text: 'About', icon: 'about', kids: [
        { sec: 'bio', href: 'about.html#bio', text: 'bio', icon: 'bio' },
        { sec: 'skills', href: 'about.html#skills', text: 'craft', icon: 'skills' },
        { sec: 'resume', href: 'about.html#resume', text: 'experience', icon: 'resume' },
        { sec: 'contact', href: 'about.html#contact', text: 'contact', icon: 'contact' },
      ] },
      { id: 'work', href: 'work.html', text: 'Work', icon: 'work', kids: [
        { id: 'vicino', sec: 'vicino', href: 'vicino.html', text: 'Vicino AI',
          meta: '2026', mark: 'Media/vicino-logo.webp' },
        { id: 'pantrypal', sec: 'pantrypal', href: 'pantrypal.html', text: 'PantryPal',
          meta: '2026', mark: 'Media/pantrypal-logo.webp', kids: [
          { sec: 'overview', href: 'pantrypal.html#overview', text: 'overview', icon: 'overview' },
          { sec: 'problem', href: 'pantrypal.html#problem', text: 'problem', icon: 'problem' },
          { sec: 'solution', href: 'pantrypal.html#solution', text: 'solution', icon: 'solution' },
          { sec: 'process', href: 'pantrypal.html#process', text: 'process', icon: 'process' },
          { sec: 'craft', href: 'pantrypal.html#craft', text: 'craft', icon: 'craft' },
          { sec: 'results', href: 'pantrypal.html#results', text: 'results', icon: 'results' },
        ] },
        { id: 'nextlevel', sec: 'drone', href: 'nextlevel.html', text: 'Next Level',
          meta: '2025', mark: 'Media/NextLevelIcon.webp', kids: [
          { sec: 'overview', href: 'nextlevel.html#overview', text: 'overview', icon: 'overview' },
          { sec: 'story', href: 'nextlevel.html#story', text: 'story', icon: 'story' },
          { sec: 'discovery', href: 'nextlevel.html#discovery', text: 'discovery', icon: 'discovery' },
          { sec: 'mark', href: 'nextlevel.html#mark', text: 'mark', icon: 'mark' },
          { sec: 'process', href: 'nextlevel.html#process', text: 'process', icon: 'process' },
          { sec: 'rollout', href: 'nextlevel.html#rollout', text: 'rollout', icon: 'rollout' },
          { sec: 'reflection', href: 'nextlevel.html#reflection', text: 'reflection', icon: 'results' },
        ] },
      ] },
      { id: 'play', href: 'play.html', text: 'Play', icon: 'play', kids: [
        { sec: 'pong', href: 'play.html#pong', text: 'Pong', icon: 'pong' },
        { sec: 'snake', href: 'play.html#snake', text: 'Snake', icon: 'snake' },
        { sec: 'flappy', href: 'play.html#flappy', text: 'Flappy Bird', icon: 'flappy' },
      ] },
      { id: 'ai', href: 'ai.html', text: 'AI', icon: 'ai' },
    ] },
    { label: 'elsewhere', rows: [
      { href: 'PoncedeLeon-Resume.pdf', text: 'Resume', icon: 'resume',
        meta: 'pdf ↓', ext: true },
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
        '<span class="chrome-lights" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '<button class="chrome-btn" type="button" data-act="rail" ' +
          'aria-label="Toggle sidebar">' + svg(G.rail, 20) + '</button>' +
        '<button class="chrome-btn" type="button" data-act="back" ' +
          'aria-label="Back">' + svg(G.back, 20) + '</button>' +
        '<button class="chrome-btn" type="button" data-act="fwd" ' +
          'aria-label="Forward">' + svg(G.fwd, 20) + '</button>' +
      '</div>' +
      '<div class="chrome-tabs">' +
        '<span class="chrome-tab">' +
          '<img src="Media/darkcircle.png" alt="" width="16" height="16" />' +
          '<span class="tab-label" id="tab-label">' + esc(title) + '</span>' +
        '</span>' +
        '<button class="chrome-btn chrome-new" type="button" ' +
          'aria-label="Open this page in a new browser tab">' +
          svg(G.plus, 20) + '</button>' +
      '</div>';

    // back is honest about whether there is anywhere to go; forward has no
    // API to ask, so it stays live and simply does nothing at the end
    const back = chrome.querySelector('[data-act="back"]');
    if (back && history.length <= 1) back.disabled = true;

    chrome.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.act === 'back') history.back();
      else if (btn.dataset.act === 'fwd') history.forward();
      else if (btn.dataset.act === 'rail') toggleRail();
      // the "+" means what it says: this page, in a REAL new tab
      else if (btn.classList.contains('chrome-new')) {
        window.open(location.href, '_blank', 'noopener');
      }
    });
  };

  // ---- the rail collapses to an icon strip; stage-fit re-reads the frame
  const RAIL_KEY = 'shell.rail';
  const toggleRail = () => {
    const next = !root.classList.contains('rail-collapsed');
    root.classList.toggle('rail-collapsed', next);
    try { localStorage.setItem(RAIL_KEY, next ? '1' : '0'); } catch (err) { /* private mode */ }
    if (window.__shellFit) window.__shellFit();
  };
  try {
    if (localStorage.getItem(RAIL_KEY) === '1') root.classList.add('rail-collapsed');
  } catch (err) { /* private mode — the rail just starts open */ }

  // ============================================================
  // Sidebar
  // ============================================================
  const rowHTML = (row) => {
    const kids = row.kids && row.kids.length;
    const key = row.id || row.text;
    const isOpen = kids && opened.has(key);
    const icon = row.brand ? BRAND[row.brand]
      : row.mark ? '<img class="side-mark" src="' + row.mark + '" alt="" width="17" height="17" />'
      : svg(G[row.icon] || G.link, 17, 1.9);

    // the twisty is a SIBLING of the link, never inside it — a button
    // nested in an anchor is invalid and gets re-parented by the parser
    let h = '<div class="side-node" data-key="' + esc(key) + '">' +
      '<div class="side-row">' +
        (kids
          ? '<button class="side-tw" type="button" aria-expanded="' + (isOpen ? 'true' : 'false') +
            '" aria-label="Toggle ' + esc(row.text) + ' sections">' + svg(G.twist, 13, 2.4) + '</button>'
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

  const buildSide = () => {
    if (!side) return;
    let n = 0;
    const groups = TREE.map((g) =>
      '<section class="side-group" style="--n:' + (n++) + '">' +
        '<h2 class="side-label">' + esc(g.label) + '</h2>' +
        g.rows.map(rowHTML).join('') +
      '</section>').join('');

    side.innerHTML =
      '<a class="side-id" href="index.html#home">' +
        '<img class="side-avatar" src="Media/darkcircle.png" alt="" ' +
          'width="26" height="26" />' +
        '<span class="side-id-text">' +
          '<span class="side-name">Tigo Ponce de León</span>' +
          '<span class="side-role">product design engineer</span>' +
        '</span>' +
      '</a>' +
      '<nav class="side-scroll" id="side-scroll" aria-label="Site">' + groups + '</nav>' +
      '<div class="side-foot">' +
        '<a class="ask-pill" id="ask-pill" href="ai.html">' +
          svg(G.ai, 18, 2) +
          '<span class="ask-label">ask my ai</span>' +
          '<span class="ask-kbd" aria-hidden="true">⌘K</span>' +
        '</a>' +
      '</div>';

    // the current page, and every ancestor it hangs from, wear the accent
    const cur = side.querySelector('.side-link[data-page="' + page + '"]');
    if (cur) {
      cur.setAttribute('aria-current', 'page');
      cur.closest('.side-row').classList.add('is-current');
    }
    openChain.forEach((id) => {
      const link = side.querySelector('.side-link[data-page="' + id + '"]');
      if (link && link !== cur) link.closest('.side-row').classList.add('is-trail');
    });

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

  buildChrome();
  buildSide();

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

  window.Shell = { page, lightUp, toggleRail };
})();
