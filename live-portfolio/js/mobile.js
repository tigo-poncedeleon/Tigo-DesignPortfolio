// THE PHONE (≤700px) — and nothing above it.
//
// On a laptop this site is one long document: Home, Work, About and Play
// scroll into one another and the AI is a sheet that floats over whatever
// you are reading. None of that survives a phone well, so below 700px the
// same markup is re-cast as FOUR SCREENS you tap between with the bottom
// bar — no scrolling from one section into the next, one thing at a time:
//
//   home   the name, one screen, nothing under it
//   work   the three projects, scrolled straight through
//   about  the letter and the chronology
//   ai     the chat, a PAGE again rather than an overlay
//
// Play retires entirely here (the boards want a keyboard and a wider
// court) — the whole stage is taken out of the document before the game
// engines boot, so nothing idles behind a hidden screen.
//
// This file runs BETWEEN shell.js (which builds the AI overlay) and the
// game/chat scripts that would otherwise wire themselves to what it takes
// away, so every one of those files sees the phone's DOM and no other
// file needs a phone branch. Load order in index.html is load-bearing.
(() => {
  const MQ = window.matchMedia('(max-width: 700px)');
  const root = document.documentElement;

  // ---- crossing the breakpoint rebuilds the page. A phone turned on its
  // side is 844px — desktop CSS — and the restructuring below has already
  // happened by then, so the two would disagree. The site has always
  // snapshotted this breakpoint at load (about.js, work.js, case-overlay.js
  // all do); this makes the snapshot honest instead of stale. The chat
  // transcript and the tab's scroll pixel both survive a reload.
  let phone = MQ.matches;
  let bounce = 0;
  MQ.addEventListener('change', () => {
    clearTimeout(bounce);
    bounce = setTimeout(() => {
      if (MQ.matches === phone) return;      // a resize that came back
      phone = MQ.matches;
      location.reload();
    }, 300);
  });

  if (!MQ.matches) return;                   // desktop: not one line further

  const main = document.querySelector('.shell-card > main');
  if (!main) return;

  /* ============================================================
     Play, gone
     Removed rather than hidden: pong.js / snake.js / flappy.js /
     play-pager.js / records.js all boot off getElementById and bail
     cleanly on null, so taking the stage out here is what stops three
     game loops and a network call from running behind a screen nobody
     can reach.
     ============================================================ */
  const playStage = document.getElementById('play-stage');
  if (playStage) playStage.remove();

  /* (GONE: "The AI, a page again". This used to lift shell.js's sheet out
     of its overlay and drop it into a section, because the desktop chat
     was a floating window and a phone cannot have one. There is no
     overlay any more — the chat is markup inside #home on both — so the
     phone's version of it is simply the home screen, and the phone has
     one fewer screen than it did.) */

  /* ============================================================
     Work, unrolled
     The desktop stepper is a three-button index that swaps one big
     picture — a shape that needs a pointer to browse and a wide screen
     to hold. On a phone the three projects simply run down the page,
     picture over words, each one a link into its case study. Built from
     the stepper's own markup so the copy has one home, and the <img>
     elements are MOVED rather than re-created (the browser keeps the
     decode it has already done).
     ============================================================ */
  const pick = document.getElementById('work-pick');
  if (pick) {
    const HREF = { vicino: 'vicino.html', pantrypal: 'pantrypal.html',
                   nextlevel: 'nextlevel.html' };
    const list = document.createElement('div');
    list.className = 'm-work';

    Array.from(pick.querySelectorAll('.pick-row')).forEach((row, i) => {
      const id = row.dataset.case;
      const href = HREF[id];
      const card = pick.querySelector('.pick-card[data-case="' + id + '"]');
      const shot = pick.querySelector('.pick-shot[data-case="' + id + '"]');
      const img = shot && shot.querySelector('img');
      if (!href || !card || !img) return;

      const a = document.createElement('a');
      a.className = 'm-work-item';
      a.href = href;
      a.style.setProperty('--n', i);
      // the desktop thumbnails carry the class js/case-overlay.js keys off;
      // it stands down on phones, but the class is free to keep and the
      // per-project image sizing hangs off it
      a.dataset.case = id;

      const fig = document.createElement('figure');
      fig.className = 'm-work-shot';
      fig.appendChild(img);                  // moved, not cloned

      const meta = document.createElement('div');
      meta.className = 'm-work-meta';
      const n = row.querySelector('.pick-n');
      meta.innerHTML =
        '<p class="m-work-n">' + (n ? n.textContent : '') + '</p>' +
        '<h3 class="m-work-name"></h3>' +
        '<p class="m-work-role"></p>' +
        '<p class="m-work-copy"></p>' +
        '<p class="m-work-go">read the case study <span aria-hidden="true">&rarr;</span></p>';
      const put = (sel, from) => {
        const el = meta.querySelector(sel);
        const src = card.querySelector(from);
        if (el && src) el.textContent = src.textContent.trim();
      };
      put('.m-work-name', 'h3');
      put('.m-work-role', '.pick-role');
      put('.m-work-copy', '.pick-copy');

      a.append(fig, meta);
      list.appendChild(a);
    });

    if (list.children.length) {
      pick.parentNode.insertBefore(list, pick);
      pick.remove();                         // work-pick.js then finds nothing
    }
  }

  /* ============================================================
     The pager
     Four screens, one at a time. The hash stays the address — every
     link that already exists in the world (index.html#bio from the case
     studies, about.html's redirect, #vicino from work.html) lands on the
     right screen, and back/forward walk them.
     ============================================================ */
  const SCREENS = [
    { id: 'home',  el: document.getElementById('home'),                hash: '#home' },
    { id: 'work',  el: document.querySelector('.work-stage'),          hash: '#vicino' },
    { id: 'about', el: document.querySelector('.about-stage'),         hash: '#bio' },
  ].filter((s) => s.el);

  // which screen a hash belongs to. The retired ids are all here on
  // purpose: #pantrypal / #drone were slide names once and still appear in
  // links, and the play hashes have nowhere to go now, so they go home.
  const OF_HASH = {
    home: 'home', '': 'home',
    work: 'work', vicino: 'work', pantrypal: 'work', drone: 'work',
    bio: 'about', about: 'about', contact: 'about', resume: 'about',
    ai: 'home',
    play: 'home', pong: 'home', snake: 'home', flappy: 'home',
  };

  const navWords = Array.from(document.querySelectorAll('.site-nav-word'));
  // each tab's own destination, read from the markup rather than repeated.
  // The Play tab answers for NOTHING: it is hidden on phones, and a stray
  // #pong routes home only so an old link is not a dead end — that must not
  // also light a tab nobody can see (two aria-current="page" in one bar).
  const wordScreen = (a) => {
    const href = a.getAttribute('href') || '';
    if (href === 'play.html' || href === '#pong') return null;
    const hash = href.indexOf('#') > -1 ? href.slice(href.indexOf('#') + 1) : '';
    if (hash) return OF_HASH[hash] || null;
    return { 'about.html': 'about', 'work.html': 'work',
             'index.html': 'home' }[href] || null;
  };

  const scrollOf = {};                       // where each screen was left
  let at = null;

  const show = (id, opts) => {
    const next = SCREENS.find((s) => s.id === id) || SCREENS[0];
    if (!next) return;
    const o = opts || {};

    if (at && at !== next.id) {
      scrollOf[at] = window.scrollY;
    }
    SCREENS.forEach((s) => s.el.classList.toggle('m-on', s === next));
    root.classList.add('m-ready');
    root.dataset.mScreen = next.id;

    // The entrances are gated on .revealed, which each stage's own
    // IntersectionObserver hands out as you scroll to it. A screen that is
    // display:none until the instant you tap its tab is a poor thing to
    // make that promise about — if the observer is a frame late, or never
    // fires, the screen is BLANK. The pager knows what it just put on
    // screen, so it says so itself and the observers become the belt to
    // this pair of braces. A FRAME later, deliberately: the element has to
    // have been laid out at opacity 0 for one frame or the transition has
    // nothing to run from and the screen simply snaps in.
    requestAnimationFrame(() => {
      next.el.classList.add('revealed');
      // NOT .ai-stage: the composer answers to shell.js's lightUp(), which
      // waits for the typewriter. Revealing it here would put a field under
      // the name before the name has typed a character.
      next.el.querySelectorAll('.about-slide, .work-slide')
        .forEach((s) => s.classList.add('revealed'));
    });

    navWords.forEach((a) => {
      const on = wordScreen(a) === next.id;
      a.classList.toggle('is-current', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    const first = at === null;
    at = next.id;

    // Say so out loud. A screen that was display:none had no layout box, so
    // anything that had to MEASURE itself could not — js/about.js bakes the
    // hedcut into a canvas and needs real pixels to bake into. Announced
    // synchronously, after the class toggle, so a listener reading
    // clientWidth in the handler already gets the real number.
    window.dispatchEvent(new CustomEvent('phone:screen', { detail: { id: at } }));

    // a screen you come back to remembers where you were reading; a screen
    // you open for the first time starts at the top
    if (!o.keepScroll) {
      window.scrollTo(0, o.restore === false ? 0 : (scrollOf[next.id] || 0));
    }
    if (!first && o.silent !== true && location.hash !== next.hash) {
      history.pushState(null, '', next.hash);
    }
  };

  // ---- the bottom bar drives it. Capture phase, so shell.js's own
  // document-level anchor delegate never sees these clicks and never tries
  // to smooth-scroll to a section that is not on screen.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.site-nav-word, .site-nav-home');
    if (!a || !document.querySelector('.site-nav').contains(a)) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = a.classList.contains('site-nav-home') ? 'home' : wordScreen(a);
    if (!id || !SCREENS.some((s) => s.id === id)) return;   // let it navigate
    e.preventDefault();
    e.stopPropagation();
    if (id === at) {                         // tapping the tab you are on
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    show(id, { restore: false });
  }, true);

  // ---- in-page anchors (the hero's own links, a redirect landing) — same
  // rule, and again ahead of the shell's delegate
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || a.closest('.site-nav')) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute('href') || '';
    if (href.charAt(0) !== '#') return;
    const id = OF_HASH[href.slice(1)];
    if (!id || !SCREENS.some((s) => s.id === id)) return;
    e.preventDefault();
    e.stopPropagation();
    show(id, { restore: false });
  }, true);

  window.addEventListener('popstate', () => {
    show(OF_HASH[location.hash.slice(1)] || 'home', { silent: true });
  });

  // ---- landing. ?ask=1 (ai.html's redirect) is a home landing now — home
  // IS the chat — and ?q=… still asks its question on arrival.
  const params = new URLSearchParams(location.search);
  const landing = params.has('ask') ? 'home'
    : (OF_HASH[location.hash.slice(1)] || 'home');
  show(landing, { silent: true, restore: false });

  // (?q= is not replayed here any more. It used to be, because the seed had
  // to survive the sheet being lifted into a section on this width; the
  // composer is the same markup on both widths now, so ai-chat.js asks the
  // question once, for everyone. Two copies of this would ask it twice.)
})();
