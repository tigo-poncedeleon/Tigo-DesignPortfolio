// THE DRAWER (≤700px) — and nothing above it.
//
// The phone's navigation, all of it: one button in the top-left corner and
// a panel that slides out from underneath it while the page is pushed
// aside. It replaces the floating pill of three words that used to sit at
// the foot of every phone screen — three words being all that bar could
// ever hold, against a site whose rail has listed eleven destinations since
// the shell was built.
//
// It does not invent a single one of them. window.Shell publishes the same
// TREE the rail is drawn from (js/shell.js), and this file regroups it for
// a thumb. That is the whole point: the .site-nav markup this replaces was
// hand-copied into five documents and had drifted — three of those five
// pointed at redirect stubs and marked the wrong page as current — which is
// what a second source of truth looks like after a year.
//
// Loaded on all five documents, AFTER js/shell.js (whose export it reads)
// and BEFORE js/mobile.js. That second half is belt-and-braces: mobile.js
// routes in-page taps from a document-level CAPTURE listener that calls
// stopPropagation, so anything registered later at that level would not see
// them. This file listens for mobile.js's own `phone:screen` event instead,
// which is dispatched synchronously from inside the pager and cannot be
// missed either way.
(() => {
  const MQ = window.matchMedia('(max-width: 700px)');
  if (!MQ.matches) return;                 // desktop: not one line further

  const S = window.Shell;
  if (!S || !S.TREE) return;               // shell.js did not run: no data, no drawer

  const root = document.documentElement;
  if (root.classList.contains('is-embed')) return;

  /* ============================================================
     THE SITE, REGROUPED FOR A THUMB.

     Same TREE, the rail's own two groups, both labelled:

       ·  pages — Home, Work, About. Play is absent because TREE says
          `phone: false`, not because this file has ever heard of Play.
       ·  elsewhere — the resume, the mailbox and the four profiles.

     (GONE: a third group that flattened Work's three CASE STUDIES out
     from behind the rail's twisty and listed them here. It was the
     reference's "Pinned" shelf and it was one shelf too many: Work is
     one tap away and its screen is a list of exactly those three, so
     the drawer was offering a second route to a page the row above it
     already reaches. The drawer is a map of the site's sections, not
     an index of everything on it. They still light correctly when you
     are ON one — see markCurrent, which marks Work as the trail.)

     The LABELS are the site's own. The reference calls its groups
     "Pinned" and "Recents" because that is what its groups hold, and
     "Recents" over a permanent list of a LinkedIn and a Goodreads
     would be a name that lies. The shape is borrowed; the words are
     not — these two are the rail's, unchanged.
     ============================================================ */
  const pages = S.TREE.find((g) => g.label === 'pages');
  const away = S.TREE.find((g) => g.label === 'elsewhere');
  if (!pages || !away) return;
  const GROUPS = [
    { label: 'pages', rows: pages.rows.filter((r) => r.phone !== false) },
    { label: 'elsewhere', rows: away.rows },
  ].filter((g) => g.rows.length);

  const rowHTML = (row) =>
    '<a class="m-row" href="' + S.esc(row.href) + '"' +
      (row.id ? ' data-page="' + S.esc(row.id) + '"' : '') +
      (row.ext ? ' target="_blank" rel="noopener"' : '') + '>' +
      '<span class="m-ico">' +
        S.svg(row.brand ? S.SOCIAL[row.brand] : (S.G[row.icon] || S.G.link),
              row.brand ? 1.7 : 1.9) +
      '</span>' +
      '<span class="m-text">' + S.esc(row.text) + '</span>' +
    '</a>';

  const groupHTML = (g) =>
    '<section class="m-group">' +
      (g.label ? '<h2 class="m-label">' + S.esc(g.label) + '</h2>' : '') +
      g.rows.map(rowHTML).join('') +
    '</section>';

  /* ============================================================
     The three elements, all direct children of <body>.

     Outside .shell, deliberately and for the same reason the bar's
     markup used to sit out here: below 700px the drawer PUSHES .shell
     with a transform (css/drawer.css), and a fixed element inside a
     transformed ancestor is positioned against the ancestor. The
     button would ride away with the page it opens.
     ============================================================ */
  const menu = document.createElement('button');
  menu.className = 'm-menu';
  menu.id = 'm-menu';
  menu.type = 'button';
  menu.setAttribute('aria-label', 'Open menu');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-controls', 'm-drawer');
  menu.innerHTML = S.svg(S.G.rail, 1.9);

  const scrim = document.createElement('button');
  scrim.className = 'm-scrim';
  scrim.type = 'button';
  scrim.setAttribute('aria-label', 'Close menu');
  scrim.tabIndex = -1;

  const drawer = document.createElement('aside');
  drawer.className = 'm-drawer';
  drawer.id = 'm-drawer';
  drawer.tabIndex = -1;
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Menu');
  drawer.setAttribute('inert', '');
  drawer.innerHTML =
    // the wordmark. A fresh one rather than the rail's #ask-chip, which at
    // this width is collapsed to height 0 and marked inert by
    // wireAskReveal() — see the letterhead note in css/drawer.css.
    '<a class="m-head" href="index.html#home">' +
      '<img class="m-head-mark" src="Media/darkcircle.png" alt=""' +
        ' width="30" height="30" />' +
      '<span class="m-head-text">' +
        '<span class="m-head-name">Tigo Ponce de León</span>' +
        '<span class="m-head-role">product design engineer</span>' +
      '</span>' +
    '</a>' +
    '<nav class="m-scroll" aria-label="Site">' + GROUPS.map(groupHTML).join('') + '</nav>';

    // (GONE: the whole foot — statusHTML()'s "now" section, and before that
    // a black "new chat" pill under it.
    //
    // The pill was the reference's, and the reference needs one because its
    // drawer lists conversations; this site has ONE, and the way to clear it
    // is already on the screen the pill led to (#ai-reset, in the corner
    // opposite the button that opens this).
    //
    // The status rows were the rail's, and the rail's argument for them is
    // about a RAIL: a persistent column with navigation above it wants a
    // weighted floor rather than a long fall to nothing. A drawer has no
    // long fall — it is shut except in the second you opened it to go
    // somewhere — so the floor was holding down a column that was never
    // falling, and spending a third of a phone screen to do it. The same
    // two lines are still on About, in the letter, where someone reading
    // about him is actually asking.)

  document.body.append(menu, scrim, drawer);

  /* ============================================================
     Where you are.

     The rail's own rule, unchanged: the page wears aria-current, its
     ancestors wear the trail. On a case study there is no row for the
     case itself (they are reached through Work — see the groups above),
     so the trail is what answers: ANCESTORS maps all three to Work and
     Work is what carries the mark. The bar this replaces got that wrong
     in the other direction, marking work.html — a redirect stub — as
     the current page on all three.

     It is ARIA only. Nothing in css/drawer.css paints these two classes
     any more: the drawer is one ink now, current row included. The
     marks stay because a reader still has to be told where it is, and
     that was never the colour's job to say on its own.
     ============================================================ */
  const markCurrent = (id) => {
    drawer.querySelectorAll('.m-row').forEach((a) => {
      a.classList.remove('is-current', 'is-trail');
      a.removeAttribute('aria-current');
    });
    // …and where the page has no row of its own — a case study, which is
    // reached THROUGH Work rather than listed beside it — the mark falls
    // back to the section it belongs to, exactly as the rail's does when
    // the case studies are collapsed behind their twisty (js/shell.js).
    // Without this a visitor on vicino.html opens the drawer and nothing
    // in it says where they are.
    let cur = drawer.querySelector('.m-row[data-page="' + id + '"]');
    const up = (S.ANCESTORS[id] || [])[0];
    if (!cur && up) cur = drawer.querySelector('.m-row[data-page="' + up + '"]');
    if (cur) {
      cur.setAttribute('aria-current', 'page');
      cur.classList.add('is-current');
    }
    (S.ANCESTORS[id] || []).forEach((a) => {
      const t = drawer.querySelector('.m-row[data-page="' + a + '"]');
      if (t && t !== cur) t.classList.add('is-trail');
    });
  };
  markCurrent(S.page);

  // …and on index the "page" changes as you tap between screens, without a
  // load. The pager says so synchronously (js/mobile.js), which is what the
  // deleted bar's own is-current loop listened to. This is what became of it.
  window.addEventListener('phone:screen', (e) => {
    if (e.detail && e.detail.id) markCurrent(e.detail.id);
  });

  /* ============================================================
     Open, close, and the trap.

     The focus trap is `inert` on every <body> child except the three
     built above — and that IS the trap: no keydown loop, no first/last
     sentinels, no list of focusables to keep in step with markup that
     will change. The menu button is deliberately NOT inerted: it stays
     live in its corner while the panel slides out underneath it, so
     focus never leaves it and there is nothing to restore.
     ============================================================ */
  const SUPPORTS_INERT = 'inert' in HTMLElement.prototype;
  const others = () => Array.prototype.filter.call(document.body.children,
    (el) => el !== menu && el !== scrim && el !== drawer);

  let isOpen = false;

  const setOutside = (off) => {
    others().forEach((el) => {
      if (SUPPORTS_INERT) el.inert = off;
      // Safari below 15.5 has no inert. aria-hidden is not a focus trap,
      // but it is the half of the job that matters most to a reader.
      else if (off) el.setAttribute('aria-hidden', 'true');
      else el.removeAttribute('aria-hidden');
    });
  };

  const open = () => {
    if (isOpen) return;
    isOpen = true;
    root.classList.add('m-open');
    menu.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-label', 'Close menu');
    drawer.removeAttribute('inert');
    scrim.tabIndex = 0;
    setOutside(true);
    // …and only now can it take focus. The panel is `visibility: hidden`
    // when shut (see css/drawer.css: display:none cannot transition, and a
    // merely translated panel is still in the tab order), and focus() on a
    // hidden element is a no-op. The class above does not become visible
    // until style is recalculated, so ASK for the recalculation — one
    // forced reflow, deliberately, rather than a rAF that a backgrounded
    // tab would never run.
    drawer.offsetHeight;                     // eslint-disable-line no-unused-expressions
    // the panel, not its first link: a reader should hear the whole thing
    // arrive rather than be dropped onto "Home" with no idea what opened
    drawer.focus({ preventScroll: true });
  };

  const close = (opts) => {
    if (!isOpen) return;
    const o = opts || {};
    isOpen = false;
    root.classList.remove('m-open');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Open menu');
    drawer.setAttribute('inert', '');
    scrim.tabIndex = -1;
    setOutside(false);
    if (o.restore !== false) menu.focus({ preventScroll: true });
  };

  menu.addEventListener('click', () => (isOpen ? close() : open()));
  scrim.addEventListener('click', () => close());

  // Escape, in CAPTURE and gated on isOpen — nextlevel's .look overlay
  // preventDefaults Escape for its own reasons, and it must keep it for
  // every moment this panel is shut.
  document.addEventListener('keydown', (e) => {
    if (!isOpen || e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }, true);

  /* ---- swipe to close. Close ONLY: there is deliberately no
     edge-swipe to open, because iOS Safari owns the left twenty pixels
     for its own Back gesture and two gestures arguing over one strip is
     worse than one gesture missing.

     Axis-locked before it takes anything — until the finger has moved
     further across than down, this is a scroll of the panel and not a
     drag of it. ---- */
  let sx = 0, sy = 0, dx = 0, t0 = 0, axis = 0, dragging = false;

  drawer.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !isOpen) return;
    sx = e.clientX; sy = e.clientY; dx = 0; axis = 0; t0 = e.timeStamp;
    dragging = true;
  });

  drawer.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const mx = e.clientX - sx;
    const my = e.clientY - sy;
    if (!axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      axis = Math.abs(mx) > Math.abs(my) ? 1 : -1;
      if (axis === 1) {
        root.classList.add('m-dragging');
        drawer.setPointerCapture(e.pointerId);
      }
    }
    if (axis !== 1) return;
    dx = Math.min(0, mx);                  // it only travels left
    drawer.style.translate = dx + 'px 0';
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    if (axis !== 1) { axis = 0; return; }
    root.classList.remove('m-dragging');
    drawer.style.translate = '';
    const v = dx / Math.max(1, e.timeStamp - t0);        // px per ms, negative
    if (dx < -70 || v < -0.5) close({ restore: false });
    axis = 0;
  };
  drawer.addEventListener('pointerup', endDrag);
  drawer.addEventListener('pointercancel', endDrag);

  /* ---- a tap on a row shuts the drawer behind it.

     Two mechanisms, and together they are order-independent. In-page
     rows are claimed by js/mobile.js's capture-phase delegate, which
     stopPropagations them — those arrive as `phone:screen` above.
     Everything mobile.js does not claim (the resume PDF, the mailbox,
     the four profiles) falls through its early
     returns with the event intact and reaches this listener normally.

     An external row is left open on purpose: it opens a new tab, this
     one does not navigate, and closing the menu underneath would be a
     change the visitor did not ask for. ---- */
  window.addEventListener('phone:screen', () => close({ restore: false }));
  drawer.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank') return;
    close({ restore: false });
  });

  // ---- the button arrives. On index the opening owns the corner until the
  // name has finished typing (html.intro-pending holds it at opacity 0 in
  // css/drawer.css, and js/typewriter.js drops the class); everywhere else
  // the class was never set and this simply fades it in on the next frame.
  requestAnimationFrame(() => menu.classList.add('is-lit'));
})();
