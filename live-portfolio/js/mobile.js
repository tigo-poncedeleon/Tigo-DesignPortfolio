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

     TWO numbers, both read straight off the visual viewport:

       --kb    innerHeight − visualViewport.height   → the keyboard's
               height, which insets the chat area
       --doc-top   scrollY + visualViewport.offsetTop → the DOCUMENT y of
               the top of the visible window, which is where the screen and
               the menu button are placed
     and the screen is `position: ABSOLUTE`, at an explicit document
     coordinate, sized to the visible window. `position: fixed` is not used
     anywhere on this screen, and that is the point rather than an
     accident: **on iOS a fixed element is unreliable while a keyboard is
     open** — it is anchored to the LAYOUT viewport, which is itself
     displaced relative to what can be seen, and WebKit is additionally
     known to drift fixed layers during a keyboard. Measured off a
     recording, the whole screen ended up above the top by more than a
     keyboard's height, which no amount of `inset: 0` prevents: filling the
     layout viewport does not help when the layout viewport is the thing
     that moved.

     Document coordinates have no such ambiguity. scrollY + offsetTop is
     the document y of the top of the visible window in every browser, by
     the definitions of the two numbers, and an absolutely positioned box
     resolves against the document — PROVIDED no ancestor is positioned.
     That proviso is the one that bit last time: `.shell-card` is
     `position: relative`, so an earlier absolute version resolved against
     it instead and was pushed off the bottom. css/mobile.css now makes
     that ancestor `static` on this screen, so the coordinate means what
     it says.

     What `--kb` insets is the CHAT AREA inside the box
     (`.ai-stage.is-hero { bottom: var(--kb) }`) and the name pair's
     centring — so the box's own top edge never moves relative to the
     window, and the two corner buttons sitting on it cannot either.

     This is the third model and the first that satisfies both halves of
     what is wanted at once, so the reasoning is worth keeping:

       ·  Sizing the screen to visualViewport.height left the rest of the
          layout viewport EMPTY below it. The browser scrolled down into
          that empty region and the whole screen went above the top —
          measured, the composer's control row ended up behind the status
          bar.
       ·  Translating the screen back by visualViewport.offsetTop fixed
          that and cost a frame, and a frame on a control nailed to a
          corner is the flinch.

       ·  A screen that always fills the layout viewport has neither
          problem. There is no empty region to scroll into, so the shove
          has no reason to happen; and because the box never moves or
          resizes, the two corner buttons cannot move whatever it does.
          Only the chat area's bottom inset changes, which is exactly the
          thing that should animate.

     Why fixed and a transform, after trying almost everything else:

       ·  It is right under BOTH mechanisms WebKit can use to get a covered
          field into view. If it shoves the visual viewport, offsetTop says
          so and the translate answers it. If it SCROLLS THE DOCUMENT, a
          fixed element does not move with the document at all, so there is
          nothing to answer — and offsetTop is 0, so nothing is answered.
          One formula, both mechanisms, no branch.

       ·  It has no containing block to get wrong. The version before this
          was `position: absolute` at `scrollY + offsetTop`, which is a
          DOCUMENT coordinate — but an absolute box resolves against its
          nearest positioned ancestor, and here that is .shell-card, not
          the document. The instant the browser scrolled the document to
          reveal the field, scrollY went into the number and .shell-card
          did not move, so the screen was pushed down by exactly that much
          and went off the bottom. Intermittently, because it depended on
          the browser deciding to scroll. A fixed box has one containing
          block and it is the viewport.

       ·  The translate is a compositor property, so the correction costs
          no layout.

     ALL iOS BROWSERS ARE WEBKIT — Safari and the in-app browsers alike —
     so there is one engine here and one behaviour. Anything that looked
     like a difference between them was a difference between two versions
     of this file, which is why index.html is now served no-cache
     (vercel.json): a phone holding yesterday's HTML asks for yesterday's
     scripts, and no amount of fixing this file reaches it.

     PINCH-ZOOM is the one thing that must not be mistaken for the window
     being covered: visualViewport shrinks because it is scaled, not
     because anything is over it. vv.scale says so, and we stand down and
     report the layout viewport instead.
     ============================================================ */
  const vv = window.visualViewport;
  if (vv) {
    const scroll = document.getElementById('ai-scroll');
    const home = document.getElementById('home');
    let wh = -1, wt = -1;

    /* ---- ONE number leaves this file, and visualViewport.offsetTop is
       deliberately not it.

       offsetTop is how far the browser has shoved the window down to
       reveal a focused field, and translating the page by it was correct
       in the sense that it put the content back where the window was —
       but it is answered a frame late, and that frame is a visible flinch
       on two controls that should be nailed to their corners. Traced off a
       recording, the menu button wandered ±13px over about four hundred
       milliseconds while the keyboard arrived.

       So nothing here reacts to it. The hero is fixed at the top of the
       layout viewport and only its HEIGHT changes, which means the two
       corner buttons — one fixed at the same origin, one an absolute child
       of a box whose top never moves — cannot move at all, by
       construction rather than by correction. What moves is the content
       below them, which is the whole of what should.

       This is only safe because the shove is now prevented rather than
       compensated: the box is capped on focus (see below), so the field is
       already clear and the browser never asks. If that ever stops being
       true the symptom will be the page sitting low during a keyboard,
       not a twitch — and the fix is the scroll lock in css/mobile.css and
       the scrollTop pin below, not chasing offsetTop again. ---- */

    /* ---- (GONE, and this is the whole lesson of this block: an
       ANTICIPATED height, which shrank the box on focus by a remembered
       keyboard so the composer lifted on the tap; and a SETTLE, which
       ignored a visual-viewport shove unless it held for 250ms.

       Each was a reasonable idea and together they were the spasm. Traced
       off a screen recording, the composer's top through one keyboard:

           1854 → 949 → 857 → 2069 → 1850 → 433 → 1640 → 1599 → 1557

       — flying across nearly the whole screen and back, ten frames of it.
       Not lag: a fight. `vv.height` passes through every value between
       full and settled as the keyboard slides, and the anticipated height
       was swapped in or out depending on which side of a threshold each
       frame's reading fell — so the box alternated between the guess and
       the truth, frame by frame. The settle then held its own stale value
       across the same frames, and its timer only advanced while the rAF
       loop happened to be alive, which is what made it every-other-time.

       Both are gone. What is left below is a pure function of the live
       viewport with no memory at all: read the two numbers, write the two
       numbers. A thing with no state cannot get into a wrong one, cannot
       oscillate between two answers, and cannot behave differently on the
       second try than the first. That property is worth more here than
       any amount of cleverness about what the keyboard is about to do.) */

    /* ---- (GONE with it: armCap(), the remembered-keyboard store, and the
       focus handler that primed them. The whole point was to lift the
       composer on the tap so the browser had nothing to reveal — and the
       reveal is now stopped at the source instead: the home screen cannot
       scroll (css/mobile.css) and any scroll is put back below. That is a
       guarantee rather than a prediction, and it costs no state.

       What is left in this function is a pure read of the live viewport.
       Every attempt to be clever here — anticipating the keyboard,
       settling the shove, remembering a height — has cost more in
       spasms and every-other-time bugs than it ever bought.) ---- */

    // ---- write the window's box, and say whether it moved.
    const write = () => {
      // scaled, not covered: a pinched-in viewport is short for a reason
      // that has nothing to do with a keyboard
      const zoomed = vv.scale > 1.01;
      const live = Math.round(zoomed ? window.innerHeight : vv.height);
      /* (GONE: a focus-time CAP on the keyboard's height, remembered in
         sessionStorage, that lifted the composer on the tap before the
         keyboard existed. It became dead weight the moment --kb stopped
         being published — and worse than dead: the early-return below
         still compared the CAPPED value while the height published was
         the live one, so whenever the cap pinned that number the screen's
         height froze while the real window kept shrinking. Measured, the
         gap under the composer walked 52, 24, -4 … -228 as the keyboard
         opened. A guard must compare exactly what it guards.) */
      // where the visible window starts, in DOCUMENT coordinates
      const top = Math.round(window.scrollY + (zoomed ? 0 : vv.offsetTop));
      if (live === wh && top === wt) return false;
      wh = live; wt = top;
      // TWO properties, and they are exactly the two the guard above
      // compares. (--kb was published once and taken off twice downstream;
      // it is gone entirely rather than left to be misused again.)
      root.style.setProperty('--doc-top', top + 'px');
      root.style.setProperty('--win-h', live + 'px');
      return true;
    };

    const syncKB = () => {
      if (!write()) return false;

      /* ---- CANCEL THE REVEAL-SCROLL. This came out once, when the hero
         was position: fixed and could not be moved by a document scroll.
         The hero is ABSOLUTE now, so a document scroll drags it straight
         off the top — which is exactly the reported fault, and why
         scrolling back up by hand fixed it.

         Why the compensation in --doc-top is not enough on its own: it
         counts window.scrollY, and iOS does not reliably fire a `scroll`
         event for its own keyboard-reveal scroll (it does for a finger,
         which is why a manual scroll appeared to repair it). So do not
         wait to be told. On the home screen there is nothing under the
         fold to reveal and the composer is already above the keyboard by
         construction, so any document scroll here is the browser acting
         on a layout that no longer exists, and the right answer is to put
         it back. Checked every frame by the loop, not just on an event. */
      if (at === 'home' && window.scrollY) window.scrollTo(0, 0);


      // the transcript just got shorter by the height of a keyboard. A
      // reader who was at the bottom of it should still be at the bottom of
      // it; one who had scrolled up to re-read something is left alone.
      //
      // WAS at the bottom — decided once, when the movement started, and
      // held for the whole of it. Asking again mid-flight is how the last
      // message ended up under the fold: the box shrinks, the reader is no
      // longer "near the bottom" BECAUSE it shrank, and the test that was
      // meant to protect them stops answering yes halfway down.
      if (scroll && pinned) scroll.scrollTop = scroll.scrollHeight;
      return true;
    };

    /* ============================================================
       FOLLOW THE WINDOW BY FRAME, AND DO NOT ANIMATE IT.

       The `resize` event is coarse — measured off a screen recording it
       fires three or four times across the keyboard's third of a second,
       which is about thirteen frames a second. Easing between those steps
       was the obvious answer and it was wrong, in a way the recording
       showed exactly: the composer sits at the stage's FLOOR, which is
       top + height, and top and height were two separate transitions. Any
       moment one was ahead of the other their sum was nonsense, so the box
       flew ~280px past where it was going and eased back. Every time.

           711 → 691 → 1156 → 1704 → 1618 → 1526 → 1474 → 1447 → 1424

       You cannot ease two numbers independently when what matters is their
       sum. And you do not need to: visualViewport's PROPERTIES are live
       even though its event is not. Read in a rAF loop they track the
       keyboard continuously, at the frame rate, because they are being
       driven by the keyboard itself. So the loop is the animation — the
       real one, not an interpolation of it — and nothing in CSS
       transitions at all. top and height are then always written in the
       same frame from the same reading, and their sum is never wrong.

       The loop runs only while something is moving: ten quiet frames after
       the last change and it stops, so this is not a permanent rAF.
       ============================================================ */
    let raf = 0, quiet = 0, pinned = false;
    const typing = () => {
      const a = document.activeElement;
      return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
    };
    /* ---- THE TAIL, and it is the whole of "spasm, then slide into place".

       The loop used to give up ten frames after the last CHANGE — about
       160ms. A keyboard closes over roughly 300. So two thirds of the way
       down, the screen simply stopped following: it froze mid-slide, and
       the next coarse resize event snapped it the rest of the way. The
       freeze read as the spasm and the snap read as the slide back into
       place. Nothing was fighting; the loop had just gone home early.

       TAIL is ninety frames — a second and a half of stillness before it
       stops, which no keyboard animation outlasts. A bounded count rather
       than "until the window looks settled", because settled is a
       judgement about numbers a browser might never quite agree on, and a
       loop that can spin forever is a worse bug than one that runs a
       second too long. While a field is focused it stays alive regardless.

       Cost, measured: one height write is 0.17ms against a 16.7ms frame,
       and on a frame where nothing changed it is two property reads. There
       is no reason to be frugal here and every reason to still be
       watching. ---- */
    const TAIL = 90;
    const pump = () => {
      raf = 0;
      quiet = syncKB() ? 0 : quiet + 1;
      // The resize EVENT is coarse — three or four fires across the
      // keyboard's third of a second — but visualViewport's properties are
      // live, so a loop that reads them is the only thing here that sees
      // the keyboard actually moving rather than three snapshots of it.
      if (typing() || quiet < TAIL) raf = requestAnimationFrame(pump);
      else pinned = false;
    };
    const follow = () => {
      // decide ONCE, before anything moves, whether this reader is at the
      // foot of the conversation — and hold that answer until the window
      // has finished moving. Same 40px slack ai-chat.js uses.
      if (!raf && scroll) {
        pinned = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40;
      }
      quiet = 0;
      // SYNCHRONOUSLY first, and the loop after. The loop is what makes the
      // motion smooth, but it is not what makes it correct: rAF does not run
      // in a tab that is not being painted, and a window that only ever
      // updated from inside one would simply never update there. Every
      // event lands the right answer on its own; the frames in between are
      // the improvement.
      syncKB();
      if (!raf) raf = requestAnimationFrame(pump);
    };

    // the events say "something is about to move"; the loop finds out what.
    vv.addEventListener('resize', follow);
    vv.addEventListener('scroll', follow);
    window.addEventListener('scroll', follow, { passive: true });
    // …and focus is the EARLIEST warning there is — early enough to make
    // the room BEFORE the keyboard needs it (see the note above).
    document.addEventListener('focusin', follow, true);
    document.addEventListener('focusout', follow, true);

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

    // a screen change closes the keyboard without necessarily firing
    // anything above in an order we can rely on
    window.addEventListener('phone:screen', follow);

    // and the box the page opens at
    syncKB();

    /* ---- ?vv — a readout of what the window is actually reporting, on the
       device, in the browser that is misbehaving. Every fix in this block
       before it was reasoned from a screen recording, and a recording shows
       what happened without ever saying why. Costs nothing when the flag is
       absent, which is always unless somebody typed it. ---- */
    if (new URLSearchParams(location.search).has('vv')) {
      const box = document.createElement('pre');
      box.style.cssText = 'position:fixed;left:6px;top:56px;z-index:999;margin:0;' +
        'padding:6px 8px;font:600 10px ui-monospace,monospace;line-height:1.45;' +
        'background:rgba(0,0,0,.82);color:#0f0;border-radius:6px;white-space:pre;' +
        'pointer-events:none';
      document.body.appendChild(box);
      const paint = () => {
        const st = document.getElementById('home');
        const r = st ? st.getBoundingClientRect() : { top: 0, height: 0 };
        const bar = document.querySelector('.ai-inputbar');
        const b = bar ? bar.getBoundingClientRect() : { bottom: 0 };
        box.textContent =
          'innerH   ' + window.innerHeight + '\n' +
          'vv.h     ' + Math.round(vv.height) + '\n' +
          'vv.top   ' + Math.round(vv.offsetTop) + '\n' +
          'scrollY  ' + Math.round(window.scrollY) + '\n' +
          'stage    ' + Math.round(r.top) + ' h' + Math.round(r.height) + '\n' +
          'bar.bot  ' + Math.round(b.bottom) + '\n' +
          'gap      ' + Math.round(vv.height - b.bottom);
        requestAnimationFrame(paint);
      };
      paint();
    }
  }
})();
