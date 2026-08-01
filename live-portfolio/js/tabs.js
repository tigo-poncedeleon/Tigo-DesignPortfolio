// The tab strip — real tabs over real page loads.
//
// THE INVARIANT, and everything here follows from it:
//
//     the active tab's href is always the real URL of this document.
//
// Because the site navigates for real, every arrival — a sidebar link,
// browser back/forward, a bookmark, our own tab switch — ends in the same
// place: reconcile() overwrites the active tab with whatever actually
// loaded. That one line means a sidebar click needs no interception at
// all (the active tab simply renames itself, exactly as a real browser
// does) and that back never resurrects a stale tab. The strip and the URL
// are then structurally incapable of disagreeing about the tab you are
// looking at. Do not add a code path that sets `active` without
// navigating, or this stops being true.
//
// State lives in sessionStorage, so it survives navigation and dies with
// the tab — which is also why duplicating a real browser tab copies the
// whole strip and then self-heals through the same rule.
window.ShellTabs = (() => {
  const KEY = 'shell.tabs';
  const VERSION = 1;
  const CAP = 8;
  const HOME = { page: 'home', title: 'Home', href: 'index.html#home' };

  let box = null;          // the strip element
  let targets = null;      // what the + menu offers, supplied by shell.js
  let iconOf = null;       // (pageId) → favicon markup, supplied by shell.js
  let plusGlyph = '';      // ditto, so tabs.js owns no icon vocabulary
  let rec = null;

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');

  // the document's own identity, as a tab
  const here = (seed) => ({
    page: seed.page,
    title: seed.title,
    // '/' has no last segment, and an empty href navigates nowhere
    href: (location.pathname.split('/').pop() || 'index.html') +
      location.search + location.hash,
  });

  const load = () => {
    try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); }
    catch (err) { return null; }
  };
  const save = () => {
    try { sessionStorage.setItem(KEY, JSON.stringify(rec)); }
    catch (err) { /* private mode — tabs just don't survive the hop */ }
  };

  const at = (id) => rec.tabs.findIndex((t) => t.id === id);

  /* ---- reconcile: the whole state machine, and it is four steps ---- */
  const reconcile = (seed) => {
    const me = here(seed);
    rec = load();

    if (!rec || rec.v !== VERSION || !Array.isArray(rec.tabs) || !rec.tabs.length
        || at(rec.active) < 0) {
      rec = { v: VERSION, seq: 1, active: 't0', tabs: [Object.assign({ id: 't0' }, me)] };
      save();
      return;
    }

    // A navigation we asked for may never have happened — the visitor hit
    // Escape, or the target was unreachable. Undo our optimism.
    if (rec.want && rec.want !== me.href) {
      const landed = rec.tabs.findIndex((t) => t.href === me.href);
      if (landed >= 0) rec.active = rec.tabs[landed].id;
      else {
        const ghost = rec.tabs.findIndex((t) => t.fresh && t.href === rec.want);
        if (ghost >= 0 && rec.tabs.length > 1) {
          rec.tabs.splice(ghost, 1);
          if (at(rec.active) < 0) rec.active = rec.tabs[Math.max(0, ghost - 1)].id;
        }
      }
    }
    delete rec.want;

    // THE line. Whatever route brought us here, the active tab is this page.
    const cur = rec.tabs[at(rec.active)];
    cur.href = me.href;
    cur.page = me.page;
    cur.title = me.title;
    delete cur.fresh;
    save();
  };

  /* ---- go: mutate, then navigate — unless we are already there.
     location.assign() to the current URL is a silent no-op, which is what
     made switching between two tabs on the same page look broken. A real
     browser does not reload in that case either; it just changes which tab
     is lit. So: same URL, no navigation, just repaint. ---- */
  const sameAsHere = (href) => {
    const a = document.createElement('a'); a.href = href;
    return a.pathname === location.pathname && a.search === location.search
      && a.hash === location.hash;
  };
  const go = (href) => {
    if (sameAsHere(href)) { delete rec.want; save(); render(); return; }
    rec.want = href;
    save();
    // paint the new active tab BEFORE the load starts, so the click reads as
    // instant rather than waiting on the network
    render();
    location.assign(href);
  };

  /* ---- The one thing that actually made this feel slow was the page
     load, and the fix is to have already done it. Hovering the + (or any
     entry in its menu) prefetches the target, so by the time the click
     lands the document, its CSS and its scripts are in cache and the
     navigation is a repaint. ---- */
  const primed = new Set();
  const prefetch = (href) => {
    if (!href || primed.has(href)) return;
    primed.add(href);
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.as = 'document';
    l.href = href;
    document.head.appendChild(l);
  };

  /* ---- operations ---- */
  const open = (target) => {
    const t = target || HOME;
    const btn = box && box.querySelector('.chrome-new');
    if (rec.tabs.length >= CAP) {          // the cap is legible, not silent
      if (btn) {
        btn.classList.remove('is-capped');
        void btn.offsetWidth;
        btn.classList.add('is-capped');
      }
      return;
    }
    const id = 't' + rec.seq++;
    rec.tabs.splice(at(rec.active) + 1, 0,
      { id: id, fresh: true, page: t.page, title: t.title, href: t.href });
    rec.active = id;
    go(t.href);
  };

  const close = (id) => {
    if (rec.tabs.length <= 1) return;      // you cannot close the window
    const i = at(id);                      // from inside it
    if (i < 0) return;
    const wasActive = rec.tabs[i].id === rec.active;
    rec.tabs.splice(i, 1);
    if (!wasActive) { save(); render(); return; }   // closing a background tab
    const next = rec.tabs[i] || rec.tabs[i - 1];    // must NOT move you
    rec.active = next.id;
    go(next.href);
  };

  const activate = (id) => {
    if (id === rec.active) return;
    const t = rec.tabs[at(id)];
    if (!t) return;
    rec.active = id;
    go(t.href);                            // assign, not replace: each switch
  };                                       // is a real history entry, so the
                                           // chrome's own back button stays true
  /* ---- render ---- */
  const render = () => {
    if (!box) return;
    box.classList.toggle('is-single', rec.tabs.length <= 1);
    box.classList.toggle('is-icon-only', rec.tabs.length >= CAP);

    box.innerHTML = rec.tabs.map((t) => {
      const on = t.id === rec.active;
      return '<span class="chrome-tab' + (on ? ' is-active' : '') + '" ' +
        'data-id="' + esc(t.id) + '" role="tab" tabindex="0" ' +
        'aria-selected="' + on + '" title="' + esc(t.title) + '">' +
        '<span class="tab-ico">' + (iconOf ? iconOf(t.page) : '') + '</span>' +
        '<span class="tab-label">' + esc(t.title) + '</span>' +
        '<button class="tab-close" type="button" tabindex="-1" ' +
          'aria-label="Close ' + esc(t.title) + '">' +
          // the same 20px box and 2.2 weight the + wears, so the two read as
          // one pair rather than two unrelated glyphs
          '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" ' +
          'stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
          '<path d="M7.5 7.5 L18.5 18.5"/><path d="M18.5 7.5 L7.5 18.5"/></svg>' +
        '</button>' +
      '</span>';
    }).join('') +
      // the + belongs to the strip, not beside it: as the last flex item it
      // always sits immediately after the final tab
      '<button class="chrome-btn chrome-new" type="button" ' +
        'title="New tab ⌥T" aria-label="New tab">' + plusGlyph + '</button>';
  };

  /* ---- the + is also a menu: hold on it and it offers the pages
     directly, so opening "a new tab on Work" is one gesture instead of
     new-tab-then-navigate. Everything in it is prefetched on hover. ---- */
  let menu = null, menuT = 0;
  const buildMenu = () => {
    menu = document.createElement('div');
    menu.className = 'tab-menu';
    menu.hidden = true;
    menu.innerHTML = targets.map((t) =>
      '<button class="tab-menu-row" type="button" data-href="' + esc(t.href) + '" ' +
        'data-page="' + esc(t.page) + '" data-title="' + esc(t.title) + '">' +
        '<span class="tab-menu-ico">' + (iconOf ? iconOf(t.page) : '') + '</span>' +
        '<span>' + esc(t.title) + '</span>' +
      '</button>').join('');
    document.getElementById('shell').appendChild(menu);

    menu.addEventListener('pointerover', (e) => {
      const r = e.target.closest('.tab-menu-row');
      if (r) prefetch(r.dataset.href);
    });
    menu.addEventListener('click', (e) => {
      const r = e.target.closest('.tab-menu-row');
      if (!r) return;
      hideMenu();
      open({ page: r.dataset.page, title: r.dataset.title, href: r.dataset.href });
    });
    menu.addEventListener('pointerenter', () => clearTimeout(menuT));
    menu.addEventListener('pointerleave', () => { menuT = setTimeout(hideMenu, 220); });
  };

  const showMenu = (btn) => {
    if (!menu || !menu.hidden) return;
    const r = btn.getBoundingClientRect();
    menu.hidden = false;
    menu.style.left = Math.round(r.left - 6) + 'px';
    menu.style.top = Math.round(r.bottom + 4) + 'px';
    menu.offsetHeight;
    menu.classList.add('is-lit');
  };
  const hideMenu = () => {
    if (!menu || menu.hidden) return;
    menu.classList.remove('is-lit');
    setTimeout(() => { if (!menu.classList.contains('is-lit')) menu.hidden = true; }, 200);
  };

  /* ---- wiring ---- */
  const mount = (el, seed) => {
    box = el;
    iconOf = seed.icon;
    plusGlyph = seed.plus || '+';
    targets = seed.targets || [HOME];
    reconcile(seed);
    render();
    buildMenu();

    // hovering the + primes Home and offers the rest
    box.addEventListener('pointerover', (e) => {
      const plus = e.target.closest('.chrome-new');
      if (!plus) return;
      prefetch(HOME.href);
      clearTimeout(menuT);
      menuT = setTimeout(() => showMenu(plus), 260);
    });
    box.addEventListener('pointerout', (e) => {
      if (!e.target.closest('.chrome-new')) return;
      clearTimeout(menuT);
      menuT = setTimeout(hideMenu, 220);
    });
    // and hovering a tab primes the page it would take you to
    box.addEventListener('pointerover', (e) => {
      const tab = e.target.closest('.chrome-tab');
      if (!tab) return;
      const t = rec.tabs[at(tab.dataset.id)];
      if (t && t.id !== rec.active) prefetch(t.href);
    });

    box.addEventListener('click', (e) => {
      if (e.target.closest('.chrome-new')) { open(); return; }
      const x = e.target.closest('.tab-close');
      const tab = e.target.closest('.chrome-tab');
      if (!tab) return;
      e.preventDefault();
      if (x) close(tab.dataset.id);
      else activate(tab.dataset.id);
    });
    box.addEventListener('keydown', (e) => {
      const tab = e.target.closest('.chrome-tab');
      if (!tab || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      activate(tab.dataset.id);
    });

    // ⌥, not ⌘. ⌘T/⌘W/⌘1-9 are browser-chrome shortcuts on macOS —
    // preventDefault never gets the chance, so binding ⌘W would close the
    // visitor's REAL tab while appearing to close one of ours. The ⌘
    // variants are registered anyway: free on platforms that don't reserve
    // them, harmless on the ones that do.
    document.addEventListener('keydown', (e) => {
      if (!e.altKey && !e.metaKey && !e.ctrlKey) return;
      if (window.AIChat && window.AIChat.isOpen()) return;   // the sheet owns it
      if (document.querySelector('.record-entry')) return;    // mid-initials
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;

      // e.code, NOT e.key: macOS turns Option+T into a dead character, so
      // e.key is '†' and every comparison here quietly missed. e.code is the
      // physical key and is immune to the modifier's remapping.
      const c = e.code;
      if (c === 'KeyT') { e.preventDefault(); open(); return; }
      if (c === 'KeyW') { e.preventDefault(); close(rec.active); return; }
      const digit = /^Digit([1-9])$/.exec(c);
      if (digit) {
        const n = +digit[1];
        const t = n === 9 ? rec.tabs[rec.tabs.length - 1] : rec.tabs[n - 1];
        if (t) { e.preventDefault(); activate(t.id); }
      }
    });
  };

  return { mount, open, close, activate, current: () => rec && rec.active };
})();
