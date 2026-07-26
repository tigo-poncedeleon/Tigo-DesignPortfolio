// Flappy Bird — the third Play-page game, in the pong/snake mould. The
// orange bird (the pong ball, given wings) holds a fixed x while
// paddle-grey pipes scroll left through the portrait court; Space, ArrowUp,
// W or a click flaps. Hitting a pipe or the rail ends the run: the board
// shows the Score · replay · Best card like snake's. Best lives in
// sessionStorage. Only the game whose board is centred owns the keyboard;
// scrolling away pauses, and the next flap resumes (space IS flap here, so
// there is no space-pause).
window.Flappy = (function () {
  var BIRD = 21;
  var BIRD_X = 200;             // ~1/3 of the 599px playfield
  var GRAVITY = 1500;           // px/s²
  var FLAP_VY = -430;           // px/s impulse
  var PIPE_W = 42;              // two 21px units — a fat paddle
  var GAP = 147;                // seven units
  var PIPE_SPEED = 150;         // px/s leftward
  var PIPE_EVERY = 210;         // px of travel between pairs
  var GAP_MARGIN = 42;          // gap centre keeps 2 units off the rails
  var END_LOCK_MS = 600;        // ignore start inputs right after a death —
                                // the flap you buffered as you died shouldn't
                                // instantly restart the game
  var STORE_BEST = 'flappy.best';

  var board, wall, clip, scoreboard, countdownEl, scoreEl, bestEl, replayEl, playBtnEl, birdEl;
  var W, H, ox, oy, DPR = 1;
  var state = 'idle';           // idle | countdown | playing | paused | ended
  var bird = { y: 0, vy: 0 };
  var pipes = [];               // {x, gapY, topEl, botEl, scored}
  var pool = [];                // released pipe element pairs
  var sinceSpawn = 0;
  var score = 0;
  var countdownTimer = null;
  var lastT = 0;
  var endedAt = 0;

  function endLocked() {
    return state === 'ended' && performance.now() - endedAt < END_LOCK_MS;
  }

  function readBest() {
    var n = parseInt(sessionStorage.getItem(STORE_BEST), 10);
    return isNaN(n) ? 0 : n;
  }

  function renderScores() {
    scoreEl.textContent = score;
    bestEl.textContent = readBest();
  }

  function place(el, x, y) {
    var px = Math.round((ox + x) * DPR) / DPR;
    var py = Math.round((oy + y) * DPR) / DPR;
    el.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
  }

  // pipes live in the clip layer, whose origin IS the playfield origin
  function placeClipped(el, x, y) {
    var px = Math.round(x * DPR) / DPR;
    var py = Math.round(y * DPR) / DPR;
    el.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
  }

  function pipePair() {
    if (pool.length) return pool.pop();
    var top = document.createElement('div');
    var bot = document.createElement('div');
    top.className = 'pipe';
    bot.className = 'pipe';
    clip.appendChild(top);
    clip.appendChild(bot);
    return { topEl: top, botEl: bot };
  }

  function spawnPipe() {
    var pair = pipePair();
    var half = GAP / 2;
    var gapY = GAP_MARGIN + half + Math.random() * (H - 2 * (GAP_MARGIN + half));
    pair.topEl.hidden = false;
    pair.botEl.hidden = false;
    pair.topEl.style.height = Math.max(0, gapY - half) + 'px';
    pair.botEl.style.height = Math.max(0, H - gapY - half) + 'px';
    pipes.push({ x: W, gapY: gapY, topEl: pair.topEl, botEl: pair.botEl, scored: false });
    placePipe(pipes[pipes.length - 1]);
  }

  function placePipe(p) {
    placeClipped(p.topEl, p.x, 0);
    placeClipped(p.botEl, p.x, p.gapY + GAP / 2);
  }

  function releasePipe(p) {
    p.topEl.hidden = true;
    p.botEl.hidden = true;
    pool.push({ topEl: p.topEl, botEl: p.botEl });
  }

  function hideMovers() {
    birdEl.hidden = true;
    pipes.forEach(releasePipe);
    pipes = [];
  }

  function startCountdown() {
    state = 'countdown';
    hideMovers();
    scoreboard.hidden = true;
    replayEl.hidden = true;
    playBtnEl.hidden = true;
    countdownEl.hidden = false;
    var n = 3;
    countdownEl.textContent = n;
    countdownTimer = setInterval(function () {
      n--;
      if (n > 0) { countdownEl.textContent = n; return; }
      clearInterval(countdownTimer);
      countdownTimer = null;
      countdownEl.hidden = true;
      begin();
    }, 1000);
  }

  function begin() {
    score = 0;
    bird.y = (H - BIRD) / 2;
    bird.vy = FLAP_VY;            // launched on a flap
    sinceSpawn = PIPE_EVERY * 0.4; // first pipe arrives after a breath
    birdEl.hidden = false;
    place(birdEl, BIRD_X, bird.y);
    state = 'playing';
  }

  // idle preview: one stationary pipe pair so the intro card isn't empty.
  // Cleared by startCountdown's hideMovers like any other movers.
  function showIdleScene() {
    var pair = pipePair();
    var gapY = 270;
    pair.topEl.hidden = false;
    pair.botEl.hidden = false;
    pair.topEl.style.height = (gapY - GAP / 2) + 'px';
    pair.botEl.style.height = (H - gapY - GAP / 2) + 'px';
    pipes.push({ x: 430, gapY: gapY, topEl: pair.topEl, botEl: pair.botEl, scored: true });
    placePipe(pipes[pipes.length - 1]);
  }

  function gameOver() {
    if (score > readBest()) sessionStorage.setItem(STORE_BEST, score);
    renderScores();
    if (window.PlayRecords) window.PlayRecords.report('flappy', score);
    state = 'ended';
    endedAt = performance.now();
    hideMovers();                 // clean card: just the tallies + replay
    scoreboard.hidden = false;
    replayEl.hidden = false;
  }

  function flap() {
    if (state === 'paused') state = 'playing';   // resuming IS a flap
    if (state !== 'playing') return;
    bird.vy = FLAP_VY;
  }

  function step(dt) {
    bird.vy += GRAVITY * dt;
    bird.y += bird.vy * dt;

    // the rail is deadly at both edges
    if (bird.y < 0 || bird.y + BIRD > H) {
      gameOver();
      return;
    }

    sinceSpawn += PIPE_SPEED * dt;
    if (sinceSpawn >= PIPE_EVERY) {
      sinceSpawn -= PIPE_EVERY;
      spawnPipe();
    }

    for (var i = pipes.length - 1; i >= 0; i--) {
      var p = pipes[i];
      p.x -= PIPE_SPEED * dt;

      // scoring: the pair fully passes the bird
      if (!p.scored && p.x + PIPE_W < BIRD_X) {
        p.scored = true;
        score++;
      }
      // collision: x overlap and outside the gap
      if (p.x < BIRD_X + BIRD && p.x + PIPE_W > BIRD_X) {
        if (bird.y < p.gapY - GAP / 2 || bird.y + BIRD > p.gapY + GAP / 2) {
          gameOver();
          return;
        }
      }
      if (p.x + PIPE_W < 0) {     // fully past the rail — the clip hides it
        releasePipe(p);
        pipes.splice(i, 1);
      } else {
        placePipe(p);
      }
    }

    place(birdEl, BIRD_X, bird.y);
  }

  function loop(t) {
    var dt = Math.min((t - lastT) / 1000, 0.1);
    lastT = t;
    if (state === 'playing') step(dt);
    requestAnimationFrame(loop);
  }

  function inView() {
    var r = board.getBoundingClientRect();
    var mid = window.innerWidth / 2;   // slides travel horizontally
    return r.left < mid && r.right > mid;
  }

  // W flaps alongside space and the up arrow; the rest of WASD is swallowed
  // so a left hand on the keys can't scroll the carousel out from under the
  // bird. Modifier combos are the browser's (⌘W closes the tab) — untouched.
  var SWALLOW = {
    ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1,
    KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1,
  };

  function onKeyDown(e) {
    if (!inView() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (SWALLOW[e.code]) e.preventDefault();
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      if (state === 'idle' || state === 'ended') {
        if (!e.repeat && !endLocked()) startCountdown();
      } else {
        flap();
      }
    }
  }

  function init() {
    board = document.getElementById('flappy-board');
    wall = document.getElementById('flappy-wall');
    clip = document.getElementById('flappy-clip');
    scoreboard = document.getElementById('flappy-scoreboard');
    countdownEl = document.getElementById('flappy-countdown');
    scoreEl = document.getElementById('flappy-score');
    bestEl = document.getElementById('flappy-best');
    replayEl = document.getElementById('flappy-replay');
    playBtnEl = document.getElementById('flappy-play');
    if (!board || !wall || !clip) return;

    ox = wall.offsetLeft + wall.clientLeft;
    oy = wall.offsetTop + wall.clientTop;
    W = wall.clientWidth;
    H = wall.clientHeight;
    DPR = window.devicePixelRatio || 1;

    birdEl = document.createElement('div');
    birdEl.className = 'bird';
    birdEl.hidden = true;
    board.appendChild(birdEl);

    renderScores();
    showIdleScene();

    document.addEventListener('keydown', onKeyDown);
    // pressing the board starts a run when idle/ended, flaps mid-game.
    // pointerdown, not click: click waits for the RELEASE, which made mouse
    // flaps land a beat later than the space bar's keydown.
    board.addEventListener('pointerdown', function (e) {
      e.preventDefault();                // rapid taps shouldn't select text
      if (state === 'idle' || state === 'ended') {
        if (!endLocked()) startCountdown();
      } else {
        flap();
      }
    });
    var scroller = document.getElementById('play-scroll');
    if (scroller) {
      scroller.addEventListener('scroll', function () {
        if (state === 'playing' && !inView()) state = 'paused';
      }, { passive: true });
    }

    requestAnimationFrame(function (t) {
      lastT = t;
      requestAnimationFrame(loop);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init: init };
})();
