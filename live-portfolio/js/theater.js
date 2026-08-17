// The theater — click a court's corner glyph and the game fills the
// window. The board element is MOVED into a fixed layer (never cloned:
// records.js appends the initials entry INTO the board and finds it by
// id) and a zoom on the holder does the fit — the game's layout px never
// change, so pong's positions, snake's grid and a live run's score all
// survive the trip in both directions. Entering or leaving pauses a
// running game (setTheater in each engine); the next press resumes.
//
// State rides the URL as ?game=<id>, exactly like the case overlay's
// ?case= — Back closes, tabs remember, deep links reopen.
(() => {
  const root = document.documentElement;
  const shell = document.getElementById('shell');
  const playStage = document.getElementById('play-stage');
  if (!shell || !playStage) return;                          // index only
  if (window.matchMedia('(max-width: 700px)').matches) return;

  const GAMES = {
    pong:   { board: 'board',        api: () => window.Pong },
    snake:  { board: 'snake-board',  api: () => window.Snake },
    flappy: { board: 'flappy-board', api: () => window.Flappy },
  };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const wrap = document.createElement('div');
  wrap.className = 'theater';
  wrap.id = 'theater';
  wrap.hidden = true;
  // The game opens in the TAB YOU ARE IN, filling the card the way a page
  // does — the × in the corner is the way back. The surface behind it is
  // OPAQUE: a court you can see the play grid moving through is a court
  // you cannot read.
  wrap.innerHTML =
    '<div class="theater-veil"></div>' +
    '<div class="theater-stage" id="theater-stage" role="region" aria-label="Game" tabindex="-1">' +
      '<div id="theater-fit"></div>' +
    '</div>' +
    '<button class="theater-x" type="button" aria-label="Close game">' +
      '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" aria-hidden="true">' +
        '<path d="M7 7 L19 19" /><path d="M19 7 L7 19" /></svg>' +
    '</button>';
  shell.appendChild(wrap);
  const stage = wrap.querySelector('.theater-stage');
  const fitBox = wrap.querySelector('#theater-fit');
  const xBtn = wrap.querySelector('.theater-x');

  let openGame = null;
  let anchor = null;          // marks the board's seat in its slide
  let homeRect = null;        // where it lifted off (scroll is locked while open)
  let pushed = false;
  let hideTimer = 0;
  const TITLES = { pong: 'Pong', snake: 'Snake', flappy: 'Flappy Bird' };

  const param = () => new URLSearchParams(location.search).get('game');
  const hrefWith = (id) => {
    const u = new URL(location.href);
    if (id) u.searchParams.set('game', id);
    else u.searchParams.delete('game');
    return (u.pathname.split('/').pop() || 'index.html') + u.search + u.hash;
  };
  const rememberTab = () => {
    if (window.ShellTabs && window.ShellTabs.remember) window.ShellTabs.remember();
  };

  // aspect-fit the court to the CARD (the layer's own box, since the chrome
  // and rail keep their room now): zoom scales the rendering while every
  // offsetWidth the game ever reads stays the same layout px
  const fit = () => {
    if (!openGame) return;
    const b = document.getElementById(GAMES[openGame].board);
    if (!b) return;
    // the layer's box now includes the band behind the chrome strip, which
    // is surface, not room — the court is fitted to what is actually visible
    const r = wrap.getBoundingClientRect();
    const strip = document.getElementById('shell-chrome');
    const seen = r.height - (strip ? strip.offsetHeight : 0);
    const z = Math.min((r.width - 96) / b.offsetWidth,
                       (seen - 96) / b.offsetHeight);
    fitBox.style.zoom = Math.max(z, 0.1);
  };
  window.addEventListener('resize', fit, { passive: true });
  // the rail slides and the seam drags without a resize event — the layer's
  // width changes underneath, so refit on the shell's own fit signal too
  window.addEventListener('shell:fit', fit);

  const open = (game, opts) => {
    opts = opts || {};
    const g = GAMES[game];
    if (!g || openGame === game) return;
    if (openGame) close({ instant: true });
    const b = document.getElementById(g.board);
    if (!b) return;
    openGame = game;
    clearTimeout(hideTimer);

    homeRect = b.getBoundingClientRect();
    anchor = document.createComment('theater-seat');
    b.parentNode.insertBefore(anchor, b);
    wrap.hidden = false;
    fitBox.appendChild(b);
    root.classList.add('theater-open');
    fit();

    const api = g.api();
    if (api && api.setTheater) api.setTheater(true);
    // the rail lights Play; the tab (and its record) wear the game's name
    if (window.Shell && window.Shell.setPage) window.Shell.setPage('play', TITLES[game]);

    if (!opts.instant && !reduced()) {
      // FLIP: start where the court sat on the page, fly to centre.
      // x and y scale INDEPENDENTLY because a court can change shape on the
      // way in — pong's tile is a square table and its theater is the 2.7:1
      // strip (css/play.css). One shared scale would snap the square to a
      // strip on frame one and then fly; two make the shape itself part of
      // the flight. Snake and flappy keep their aspect, so for them the two
      // numbers are equal and nothing changes.
      const to = b.getBoundingClientRect();
      stage.style.transition = 'none';
      stage.style.transform = 'translate(' + (homeRect.left - to.left) + 'px,' +
        (homeRect.top - to.top) + 'px) scale(' + homeRect.width / to.width + ',' +
        homeRect.height / to.height + ')';
      void stage.offsetWidth;
      stage.style.transition = '';
      stage.style.transform = '';
    } else {
      stage.style.transform = '';
    }
    requestAnimationFrame(() => wrap.classList.add('is-open'));
    stage.focus({ preventScroll: true });
  };

  const close = (opts) => {
    opts = opts || {};
    if (!openGame) return;
    const g = GAMES[openGame];
    const game = openGame;
    const b = document.getElementById(g.board);
    openGame = null;
    const api = g.api();
    if (api && api.setTheater) api.setTheater(false);
    wrap.classList.remove('is-open');
    root.classList.remove('theater-open');
    // hand the tab its own name back — it wore the game's while that was up
    if (window.Shell && window.Shell.setPage) window.Shell.setPage('play', 'Play');

    const finish = () => {
      hideTimer = 0;
      if (anchor && b) {
        anchor.parentNode.insertBefore(b, anchor);
        anchor.remove();
      }
      anchor = null;
      fitBox.style.zoom = '';
      stage.style.transition = 'none';
      stage.style.transform = '';
      void stage.offsetWidth;
      stage.style.transition = '';
      wrap.hidden = true;
      const tile = document.querySelector('.play-card[data-game="' + game + '"]');
      if (tile) tile.focus({ preventScroll: true });
    };

    if (!opts.instant && !reduced() && homeRect && b) {
      // fly home: the scroll was locked the whole time, so the seat the
      // court lifted off is exactly where it still belongs
      const at = b.getBoundingClientRect();
      stage.style.transform = 'translate(' + (homeRect.left - at.left) + 'px,' +
        (homeRect.top - at.top) + 'px) scale(' + homeRect.width / at.width + ',' +
        homeRect.height / at.height + ')';
      hideTimer = setTimeout(finish, 430);
    } else {
      finish();
    }
  };

  // the game opens IN THIS TAB, which takes its name while it is up; ?game=
  // is pushed as a real history entry, so Back leaves it too
  const openWithHistory = (game) => {
    history.pushState(null, '', hrefWith(game));
    pushed = true;
    open(game);
    rememberTab();
  };
  // the way back: the ×, Escape, or the rail. A pushed entry has to be
  // POPPED rather than replaced, or Back walks straight into the game again.
  const requestClose = () => {
    if (!openGame) return;
    const wasPushed = pushed;
    pushed = false;
    close();
    if (wasPushed) history.back();
    else history.replaceState(null, '', hrefWith(null));
    rememberTab();
  };

  window.addEventListener('popstate', () => {
    const id = param();
    if (id && GAMES[id]) {
      if (openGame !== id) { pushed = false; open(id, { instant: true }); }
    } else if (openGame) {
      pushed = false;
      close();
    }
  });

  // the TILES are the doors: a press anywhere on a preview card lifts its
  // court into the theater. Capture phase + the holder's pointer-events:none
  // together guarantee the parked game never hears the press as a start/flap.
  document.querySelectorAll('.play-card').forEach((cardEl) => {
    cardEl.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
    cardEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openWithHistory(cardEl.dataset.game);
    }, true);
    cardEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openWithHistory(cardEl.dataset.game);
    });
  });

  xBtn.addEventListener('click', requestClose);
  // records.js's initials entry guards keydown at capture and stops
  // propagation, so while a record is being signed this never fires —
  // Escape dismisses the entry first, then the game. As intended.
  document.addEventListener('keydown', (e) => {
    if (!openGame || e.key !== 'Escape') return;
    e.preventDefault();
    requestClose();
  });

  // the rail stays live beside the court, so its links have to work: follow
  // one and the game steps aside (capture phase, so the shell's own delegate
  // then scrolls a document that is scrollable again)
  document.addEventListener('click', (e) => {
    if (!openGame) return;
    const a = e.target.closest('a[href]');
    if (!a || a.closest('#theater')) return;
    const url = new URL(a.getAttribute('href'), location.href);
    // '/' and '/index.html' are one document — the test the shell's own
    // delegate uses (js/shell.js samePage). It has to be the same test here
    // or, on the site's front door, the shell would scroll a page the court
    // is still standing on top of.
    if (url.pathname.replace(/(^|\/)index\.html$/, '$1') !==
        location.pathname.replace(/(^|\/)index\.html$/, '$1') || !url.hash) return;
    requestClose();
  }, true);

  // deep link / tab restore
  const initial = param();
  if (initial && GAMES[initial]) open(initial, { instant: true });

  window.Theater = {
    get openGame() { return openGame; },
    sync: () => {
      const id = param();
      if (id && GAMES[id]) { if (openGame !== id) open(id, { instant: true }); }
      else if (openGame) { pushed = false; close({ instant: true }); }
    },
  };
})();
