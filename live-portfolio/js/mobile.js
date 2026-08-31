// THE PHONE (≤700px) — and nothing above it.
//
// On a laptop this site is one long document: Home, Work, About and Play
// scroll into one another. None of that survives a phone well, so below
// 700px the same markup is re-cast as THREE SCREENS — no scrolling from one
// section into the next, one thing at a time:
//
//   home   the name, one screen, and the composer docked under it
//   work   the three projects, scrolled straight through
//   about  the letter and the chronology
//
// You get between them from the DRAWER (js/drawer.js), which is the phone's
// whole navigation now. The bottom tab bar this file used to drive was
// deleted with it — see the (GONE) block in index.html.
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
     Three screens, one at a time. The hash stays the address — every
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

  // ---- which screen an href names, if any.
  //
  // It used to understand only a bare '#bio', because the only in-page links
  // on this document were the hero's own and the bottom bar's. The DRAWER's
  // rows are full paths — index.html#bio, the same hrefs the rail emits, so
  // one tree serves five documents and every row stays crawlable and
  // cmd-clickable — so this has to fold the two spellings of this page's own
  // URL together before it can answer. Same normalisation js/shell.js does.
  //
  // Anything that is not this document comes back null and is left alone: a
  // case study is a real navigation and must not be swallowed.
  const norm = (p) => p.replace(/(^|\/)index\.html$/, '$1');
  const HERE = norm(location.pathname);
  const screenOf = (href) => {
    if (!href) return null;
    if (href.charAt(0) === '#') return OF_HASH[href.slice(1)] || null;
    let u;
    try { u = new URL(href, location.href); } catch (err) { return null; }
    if (u.origin !== location.origin) return null;
    if (norm(u.pathname) !== HERE) return null;      // a real page: let it go
    return OF_HASH[u.hash.slice(1)] || null;
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

    // (GONE: the loop that lit the bottom bar's current tab. The drawer
    // marks itself off the `phone:screen` event dispatched below — one
    // listener, in the file that owns the rows, instead of this file
    // reaching across into markup it did not build.)

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

  // ---- ONE delegate now, for every link on the document that names a
  // screen: the drawer's rows, the hero's own anchors, a redirect landing.
  // (There were two — the second was the bottom bar's, and it went with the
  // bar. screenOf answers for both spellings, so one is enough.)
  //
  // Capture phase, so shell.js's own document-level anchor delegate never
  // sees these clicks and never tries to smooth-scroll to a section that is
  // not on screen. js/drawer.js knows about this and does not compete: it
  // closes off the `phone:screen` event below rather than off the click.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank') return;
    const id = screenOf(a.getAttribute('href'));
    if (!id || !SCREENS.some((s) => s.id === id)) return;   // let it navigate
    e.preventDefault();
    e.stopPropagation();
    if (id === at) {
      // ---- the screen you are already on.
      //
      // This used to scroll to the top and say nothing, and saying nothing
      // was the bug: it stopPropagation'd the click (two lines up, so the
      // shell's own delegate never sees it) and then returned without
      // calling show(), so `phone:screen` was never dispatched — and that
      // event is how js/drawer.js knows to close. Tapping "Home" from the
      // drawer while on Home did nothing at all: the panel just sat there,
      // over the page it was being asked to go back to.
      //
      // On HOME it also does not mean "scroll to the top", because Home
      // does not scroll — it is one screen with overflow: hidden. What the
      // top of Home is, once you have used it, is the empty composer: a
      // transcript is what this page LOOKS like after a question, and
      // going back to Home is the ask. So Home resets the chat, which is
      // the same thing #ai-reset does in the corner.
      if (id === 'home' && window.AIChat && window.AIChat.reset) {
        window.AIChat.reset();
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      // …and either way, say so. The drawer is listening.
      window.dispatchEvent(new CustomEvent('phone:screen', { detail: { id: at } }));
      return;
    }
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

  /* ============================================================
     THE KEYBOARD, MEASURED.

     The home screen is exactly 100dvh with the composer docked to its
     floor, so the moment a software keyboard opens, the field is behind
     it. index.html asks the browser to fix that for us —
     `interactive-widget=resizes-content` in the viewport meta, which
     makes the LAYOUT viewport (and therefore 100dvh) shrink by the
     keyboard — and where that is honoured it is the whole answer.

     It is not honoured everywhere, and the place it is not is the one
     this site is most often read on. On iOS Safari the keyboard does not
     touch the layout viewport at all: innerHeight does not move, 100dvh
     does not move, the stage does not shorten, and the composer sits
     under the keyboard while Safari scrolls the document around trying
     to reveal it. So measure the thing directly.

     THE MEASUREMENT, and why it is safe to run everywhere:

       kb = innerHeight − visualViewport.height

     innerHeight is the layout viewport; visualViewport.height is how much
     of it you can actually see. What is missing is what is covering it,
     which is the keyboard. And it is self-correcting: where
     interactive-widget IS honoured, innerHeight shrinks too, the
     difference stays at zero, and nothing is subtracted twice. One
     expression, both platforms, no sniffing.

     NOT minus vv.offsetTop, which this had at first and which is wrong in
     exactly the moment it matters. offsetTop is how far Safari has scrolled
     the VISUAL viewport inside the layout one to bring the focused field
     into view — it says nothing about how tall the keyboard is, and
     subtracting it makes the keyboard measure short by however far the page
     was shoved. Short measurement, stage not shortened enough, field still
     under the keyboard, so Safari shoves further: the two feed each other.
     The height of the covered strip does not depend on where the window is
     looking.

     Two things it must not mistake for a keyboard:
       ·  PINCH-ZOOM, where visualViewport.height is smaller because it is
          scaled rather than because anything is covering it — vv.scale
          says so, and we stand down.
       ·  SAFARI'S SHRINKING URL BAR, which moves innerHeight and
          vv.height together, so the difference never opens. Nothing to do.
     ============================================================ */
  const vv = window.visualViewport;
  if (vv) {
    const scroll = document.getElementById('ai-scroll');
    let kb = -1;                             // -1 so the first pass always writes

    const syncKB = () => {
      // a pinch is not a keyboard
      const next = vv.scale > 1.01 ? 0
        : Math.max(0, Math.round(window.innerHeight - vv.height));
      if (next === kb) return;               // this IS the coalescer: iOS fires
      kb = next;                             // a burst of these per keyboard and
      root.style.setProperty('--kb', kb + 'px');   // only the changes cost anything

      // (GONE: an `html.kb-up` class set off the same threshold. Its one
      // reader was a rule that docked the composer flush to the keyboard,
      // and that rule was a second animation on a gesture that should only
      // ever have one — see the note in css/mobile.css. The guards below
      // read the number directly, which is what they always did.)
      //
      // 80 rather than 0 in each of them: a stray pixel or two of rounding
      // is not a keyboard. No keyboard is anywhere near this short.

      // Safari scrolls the DOCUMENT to bring a focused field into view, and
      // on the home screen — one screen, nothing under it — that can only
      // ever take the name off the top. The stage has already shortened to
      // sit above the keyboard, so there is nothing it needs to reveal.
      if (kb > 80 && at === 'home' && window.scrollY) window.scrollTo(0, 0);

      // the transcript just got shorter by the height of a keyboard. A
      // reader who was at the bottom of it should still be at the bottom
      // of it; one who had scrolled up to re-read something is left alone.
      // Same 40px slack ai-chat.js uses for the same judgement.
      if (scroll && kb > 80 &&
          scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40 + kb) {
        scroll.scrollTop = scroll.scrollHeight;
      }
    };

    // …and again when the screen has finished making room. The pin above
    // lands against the box's height AT THE MOMENT the keyboard is
    // reported, and the box spends the next fifth of a second shrinking to
    // its real one (css/mobile.css eases #home.stage's height) — so the
    // last bubble creeps a few pixels below the fold on the way down. One
    // listener on the end of that ease puts it back, exactly once.
    const home = document.getElementById('home');
    if (home && scroll) {
      home.addEventListener('transitionend', (e) => {
        if (e.propertyName !== 'height' || e.target !== home) return;
        if (scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40 + kb) {
          scroll.scrollTop = scroll.scrollHeight;
        }
      });
    }

    // Called straight off the event rather than deferred to a frame: the
    // only work here is one custom property, the guard above already drops
    // every event that does not change it, and the LAYOUT it triggers is
    // batched by the browser anyway. A rAF in front of this would buy
    // nothing and would stall in a tab that is not being painted.
    vv.addEventListener('resize', syncKB);
    vv.addEventListener('scroll', syncKB);
    // …and a screen change closes the keyboard without necessarily firing
    // either of them in an order we can rely on
    window.addEventListener('phone:screen', syncKB);
    syncKB();
  }
})();
