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
  const VERSION = 2;             // v2: each tab carries state = { y } — its
                                 // exact scroll, captured by remember()
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

    // a v1 record is upgraded, not dropped — the visitor keeps their tabs
    if (rec && rec.v === 1 && Array.isArray(rec.tabs)) {
      rec.tabs.forEach((t) => { t.state = t.state || {}; });
      rec.v = 2;
    }

    if (!rec || rec.v !== VERSION || !Array.isArray(rec.tabs) || !rec.tabs.length
        || at(rec.active) < 0) {
      rec = { v: VERSION, seq: 1, active: 't0',
              tabs: [Object.assign({ id: 't0', state: {} }, me)] };
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
    // …but a scroll remembered for a DIFFERENT document is meaningless —
    // navigating the tab somewhere new starts its memory over
    const path = (h) => (h || '').split('#')[0].split('?')[0];
    if (path(cur.href) !== path(me.href)) cur.state = {};
    cur.state = cur.state || {};
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
  // '/' and '/index.html' are the same document — every tab's href is
  // written with the second spelling (see here(), which fills in the empty
  // last segment) while the site is served as the first, so a raw
  // comparison read every home tab as "somewhere else" and switching to one
  // did a full page load. Same fold as js/shell.js samePage.
  const samePath = (p) => p.replace(/(^|\/)index\.html$/, '$1') ===
    location.pathname.replace(/(^|\/)index\.html$/, '$1');
  const sameAsHere = (href) => {
    const a = document.createElement('a'); a.href = href;
    return samePath(a.pathname) && a.search === location.search
      && a.hash === location.hash;
  };
  // Before leaving, write down where this tab ACTUALLY is — URL and exact
  // scroll. The scroll spies move the hash with history.replaceState as you
  // read, and none of that reached the record — so every tab you came back
  // to had the href it was born with and dumped you at the top of the page.
  const remember = () => {
    if (!rec) return;
    const i = at(rec.active);
    if (i < 0) return;
    rec.tabs[i].href = (location.pathname.split('/').pop() || 'index.html') +
      location.search + location.hash;
    rec.tabs[i].state = { y: Math.round(window.scrollY) };
    // bank the page identity too, so a backgrounded tab wears the name and
    // favicon of where it actually is — not where it was born
    if (window.Shell && window.Shell.page) {
      rec.tabs[i].page = window.Shell.page;
      if (window.Shell.title) rec.tabs[i].title = window.Shell.title;
    }
    save();
  };

  // hand the freshly-activated tab to the shell: it reconciles overlays to
  // the URL and jumps to the tab's exact scroll, instantly
  const restore = () => {
    window.dispatchEvent(new CustomEvent('shell:restore',
      { detail: { tab: rec.tabs[at(rec.active)] || null } }));
  };

  const go = (href) => {
    if (sameAsHere(href)) { delete rec.want; save(); render(); restore(); return; }
    const a = document.createElement('a');
    a.href = href;
    if (samePath(a.pathname)) {
      // Same document, different search/hash. A real navigation here would
      // either reload the whole page (search) or smooth-scroll it (hash) —
      // both wrong for a tab switch, which must feel like changing
      // DOCUMENTS: push the history entry ourselves and restore in place.
      // The invariant holds: after pushState the active tab's href IS the
      // real URL of this document.
      const cur = rec.tabs[at(rec.active)];
      if (cur) delete cur.fresh;
      delete rec.want;
      save();
      render();
      // …spelt the way the visitor is already spelling it: on the front door
      // the path stays '/', not '/index.html'. Same document either way, and
      // here() folds the empty last segment back to index.html when the
      // record is written, so the invariant is untouched.
      history.pushState(null, '', a.search + a.hash || location.pathname);
      restore();
      return;
    }
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
  const open = () => {
    remember();                            // before rec.active moves on
    const t = HOME;
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

  // a page-provided tab: the case overlay and the theater open their
  // documents in tabs of their own. Same-document by construction, so the
  // history entry is pushed here and the CALLER paints what the URL says —
  // no navigation, no restore round-trip, instant.
  const openWith = (t) => {
    if (!rec || !t || !t.href) return false;
    remember();                            // bank the tab being left
    const btn = box && box.querySelector('.chrome-new');
    if (rec.tabs.length >= CAP) {          // the cap is legible, not silent
      if (btn) {
        btn.classList.remove('is-capped');
        void btn.offsetWidth;
        btn.classList.add('is-capped');
      }
      return false;
    }
    const id = 't' + rec.seq++;
    rec.tabs.splice(at(rec.active) + 1, 0, {
      id: id, page: t.page || 'home', title: t.title || 'Home',
      href: t.href, state: {},
    });
    rec.active = id;
    save();
    render();
    history.pushState(null, '', t.href);
    return true;
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
    remember();                            // ditto — where were WE?
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
        // icon and name ride together on one pill, so the page can scroll
        // through the tab behind them and they stay readable (shell.css)
        '<span class="tab-id">' +
          '<span class="tab-ico">' + (iconOf ? iconOf(t.page) : '') + '</span>' +
          '<span class="tab-label">' + esc(t.title) + '</span>' +
        '</span>' +
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

    // Hovering primes what a click would load — the + always means Home,
    // and a background tab means wherever it points. By the time the
    // click lands the document is already in cache.
    box.addEventListener('pointerover', (e) => {
      if (e.target.closest('.chrome-new')) { prefetch(HOME.href); return; }
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

    // ---- drag to reorder, the way a browser does it. The tab in hand
    // travels on a transform — never a reflow, so the row it leaves keeps
    // its shape — and its neighbours slide aside as it passes their middles.
    // It does not lift off: it stays a tab standing on the strip, with the
    // page still open under it (see chase, below). The record is rewritten
    // once, on drop, so a drag that ends where it started costs nothing.
    let drag = null;

    // The mouth cut in the strip (js/shell.js) is a MEASURED path, and a
    // drag is a transform — nothing about it reaches the observer that
    // keeps the two in step. So for as long as a tab is travelling, and for
    // the glide its neighbours take to close up after the drop, the path is
    // re-cut every frame. That is the whole of "the tab stays connected":
    // the flares at its feet and the seam across its mouth travel with it,
    // so it slides along the page it opens instead of coming away from it.
    let chasing = 0, until = 0;
    const chase = (tail) => {
      until = tail ? performance.now() + tail : 0;
      if (chasing) return;
      const step = () => {
        if (window.__shellTabHole) window.__shellTabHole();
        chasing = (drag || performance.now() < until)
          ? requestAnimationFrame(step) : 0;
      };
      chasing = requestAnimationFrame(step);
    };

    box.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.tab-close, .chrome-new')) return;
      const tab = e.target.closest('.chrome-tab');
      if (!tab || rec.tabs.length < 2) return;
      const tabs = [...box.querySelectorAll('.chrome-tab')];
      drag = {
        el: tab, id: tab.dataset.id, x0: e.clientX, moved: false,
        from: tabs.indexOf(tab), to: tabs.indexOf(tab),
        // every tab's centre, measured once: the row does not move during a
        // drag, only the transforms on it do
        mids: tabs.map((t) => {
          const r = t.getBoundingClientRect();
          return r.left + r.width / 2;
        }),
        w: tab.getBoundingClientRect().width,
        tabs: tabs,
      };
      tab.setPointerCapture(e.pointerId);
    });

    box.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x0;
      if (!drag.moved) {
        if (Math.abs(dx) < 4) return;      // a click is not a drag
        drag.moved = true;
        drag.el.classList.add('is-dragging');
        document.documentElement.classList.add('tab-dragging');
        chase();                       // the mouth comes along for the ride
      }
      drag.el.style.transform = 'translateX(' + dx + 'px)';

      // where it would land: the first neighbour whose centre the dragged
      // tab's own centre has passed
      const centre = drag.mids[drag.from] + dx;
      let to = drag.from;
      for (let i = 0; i < drag.mids.length; i++) {
        if (i < drag.from && centre < drag.mids[i]) { to = i; break; }
        if (i > drag.from && centre > drag.mids[i]) to = i;
      }
      if (to !== drag.to) drag.to = to;

      // the others step aside by exactly one tab's width
      drag.tabs.forEach((t, i) => {
        if (t === drag.el) return;
        let shift = 0;
        if (drag.to > drag.from && i > drag.from && i <= drag.to) shift = -drag.w;
        if (drag.to < drag.from && i >= drag.to && i < drag.from) shift = drag.w;
        t.style.transform = shift ? 'translateX(' + shift + 'px)' : '';
      });
    });

    const endDrag = () => {
      if (!drag) return;
      const d = drag;
      drag = null;
      document.documentElement.classList.remove('tab-dragging');
      d.tabs.forEach((t) => { t.style.transform = ''; t.classList.remove('is-dragging'); });
      // set down: keep re-cutting through the neighbours' glide, so the
      // mouth is still under the tab as the row closes up around it
      chase(420);
      if (!d.moved || d.to === d.from) return;
      remember();                          // bank the tab being moved, first
      const i = at(d.id);
      if (i < 0) return;
      const [moved] = rec.tabs.splice(i, 1);
      rec.tabs.splice(d.to, 0, moved);
      save();
      render();
    };
    box.addEventListener('pointerup', endDrag);
    box.addEventListener('pointercancel', endDrag);
    // a drag that ends on a tab must not also read as a click on it
    box.addEventListener('click', (e) => {
      if (document.documentElement.classList.contains('tab-dragging')) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);

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

    // back/forward may land on an entry another tab switch pushed — re-run
    // THE line so the strip can never disagree with the URL. (The overlays
    // watch popstate themselves; the hash case rides the shell's own
    // hashchange listener.)
    window.addEventListener('popstate', () => {
      if (!rec) return;
      const i = at(rec.active);
      if (i < 0) return;
      rec.tabs[i].href = (location.pathname.split('/').pop() || 'index.html') +
        location.search + location.hash;
      save();
    });

    // a real navigation or reload is leaving — bank the exact scroll first.
    // Not while a switch WE asked for is in flight (rec.want): the active
    // id has already moved to the target tab, and this page's scroll must
    // not be written into it.
    window.addEventListener('pagehide', () => {
      if (!rec || rec.want) return;
      remember();
    });
  };

  return { mount, open, openWith, close, activate, remember,
           activeTab: () => (rec ? rec.tabs[at(rec.active)] || null : null),
           count: () => (rec ? rec.tabs.length : 0),
           current: () => rec && rec.active };
})();
