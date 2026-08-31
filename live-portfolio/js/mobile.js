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
     THE WINDOW, MEASURED — and nothing subtracted from anything.

     The home screen is exactly one screen with the composer docked to its
     floor, so the moment a software keyboard opens, the field is behind it
     unless the screen shortens. index.html asks the browser to do that for
     us (`interactive-widget=resizes-content` in the viewport meta), and
     where that is honoured it is the whole answer. It is not honoured
     everywhere, and iOS Safari is where it is not.

     This block used to answer that by MEASURING THE KEYBOARD —
     `innerHeight − visualViewport.height` — and taking it off 100dvh. That
     is arithmetic across two different ideas of the viewport, and it is
     only correct while they agree:

       ·  100dvh is the browser's DYNAMIC viewport. It tracks the browser's
          own toolbars showing and hiding, and it does not move for a
          keyboard.
       ·  innerHeight is the LAYOUT viewport, which is a different number
          the moment the toolbar is mid-collapse.

     In one browser's webview they happened to be equal and the subtraction
     was right; in Safari they are not, and the difference landed straight
     in the stage's height — the hero drawn taller or shorter than the
     screen, the name pushed off the top, the composer left under the
     keyboard. "Works in one browser and not another" was that gap.

     So: do not subtract. visualViewport.height IS the height of what the
     visitor can see, in every browser, keyboard or no keyboard, toolbar or
     no toolbar, and whether or not the meta above was honoured. And
     visualViewport.offsetTop is WHERE that window starts — how far the
     browser has scrolled the visual viewport inside the layout one to
     reveal a focused field. `window.scrollY` does not move for that and
     `position: fixed` does not know about it, which is how the menu button
     slid off the top of the screen and took the name and role with it.

     ONE number, read straight off the window, nothing derived:

       --vh   how tall the window is   →   the hero's height

     AND NOT visualViewport.offsetTop, which this had and which was the
     worst of the faults it caused. The reasoning was sound: the browser
     scrolls the visual viewport inside the layout one to reveal a focused
     field, `position: fixed` is fixed to the LAYOUT viewport, so a fixed
     button should add that offset back to stay on screen. Measured off a
     screen recording, it moved the menu button exactly 62 CSS px DOWN the
     instant the keyboard opened — precisely the offset being added. The
     browser had already anchored the button and the flow correctly, and
     the compensation was a second correction stacked on a first. A control
     that jumps a quarter of an inch every time the keyboard arrives is far
     worse than one that is occasionally a pixel out.

     What replaces it is not a better correction. It is removing the thing
     being corrected for: the home screen cannot scroll at all now
     (css/mobile.css), and a browser with nothing to scroll has no reason
     to shove the window in the first place.

     PINCH-ZOOM is the one thing that must not be mistaken for the window
     being covered: visualViewport shrinks because it is scaled, not
     because anything is over it. vv.scale says so, and we stand down and
     report the layout viewport instead.
     ============================================================ */
  const vv = window.visualViewport;
  if (vv) {
    const scroll = document.getElementById('ai-scroll');
    const home = document.getElementById('home');
    let vh = -1;

    const syncKB = () => {
      const h = Math.round(vv.scale > 1.01 ? window.innerHeight : vv.height);
      if (h === vh) return;                  // this IS the coalescer
      vh = h;
      root.style.setProperty('--vh', h + 'px');

      // is something covering the screen? The only use left for the
      // keyboard's own height is deciding whether there IS one — nothing in
      // CSS asks for the number any more. 80 rather than 0 because a stray
      // pixel of toolbar is not a keyboard.
      const covered = window.innerHeight - h > 80;

      // …the document, if it also moved. On the home screen there is
      // nothing under the fold to reveal, so any document scroll here is
      // the browser guessing, and the stage has already made room.
      if (covered && at === 'home' && window.scrollY) window.scrollTo(0, 0);

      // the transcript just got shorter by the height of a keyboard. A
      // reader who was at the bottom of it should still be at the bottom of
      // it; one who had scrolled up to re-read something is left alone.
      // Same 40px slack ai-chat.js uses for the same judgement.
      if (scroll && covered &&
          scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight
            < 40 + (window.innerHeight - h)) {
        scroll.scrollTop = scroll.scrollHeight;
      }
    };

    // …and again when the screen has finished making room. The pin above
    // lands against the box's height AT THE MOMENT the window is reported,
    // and the box spends the next quarter-second easing to its real one
    // (css/mobile.css) — so the last bubble creeps a few pixels below the
    // fold on the way down. One listener on the end of that ease puts it
    // back, exactly once.
    if (home && scroll) {
      home.addEventListener('transitionend', (e) => {
        if (e.propertyName !== 'height' || e.target !== home) return;
        if (scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40) {
          scroll.scrollTop = scroll.scrollHeight;
        }
      });
    }

    vv.addEventListener('resize', syncKB);
    vv.addEventListener('scroll', syncKB);
    // …and a screen change closes the keyboard without necessarily firing
    // either of them in an order we can rely on
    window.addEventListener('phone:screen', syncKB);

    // The FIRST measurement lands cold — the hero is simply the size of the
    // window, with no ease, because there is nothing for it to ease from.
    // Only once it is standing at the right size does the curve go on, so
    // the opening frame can never be an animation of the page assembling
    // itself out of a wrong height.
    syncKB();
    root.classList.add('kb-armed');
  }
})();
