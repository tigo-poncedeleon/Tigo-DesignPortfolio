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

  /* ---- operations ---- */
  const open = () => {
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
    rec.tabs.splice(at(rec.active) + 1, 0, Object.assign({ id: id, fresh: true }, HOME));
    rec.active = id;
    go(HOME.href);
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

  /* ---- wiring ---- */
  const mount = (el, seed) => {
    box = el;
    iconOf = seed.icon;
    plusGlyph = seed.plus || '+';
    reconcile(seed);
    render();

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
