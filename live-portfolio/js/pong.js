// Pong — the Play page game. Left paddle is the computer, right paddle is the
// player (arrow keys, or W/S). Space or a click on the board starts a game; space
// pauses/resumes mid-rally. Every serve runs a 3-2-1 countdown; the first
// serve always goes left toward the computer (per spec), later serves go
// toward whoever just conceded. A point ends the game: the board shows the
// session tallies wide by each paddle plus a replay glyph (Figma 1361:83) —
// the board stays clean of text while the ball is live. Tallies live in
// sessionStorage so they survive hopping home and back, and reset when the
// tab closes.
window.Pong = (function () {
  var PADDLE_W = 21, PADDLE_H = 81;
  var BALL = 21;
  var PADDLE_INSET = 31;        // Figma: paddle x=126, wall inner edge x=95
  var PLAYER_SPEED = 460;       // px/s
  var AI_SPEED = 360;           // slower than the ball can climb — beatable
  var AI_IDLE_SPEED = 120;      // drift back to centre while the ball moves away
  var SERVE_SPEED = 420;
  var SPEEDUP = 1.045;          // per paddle hit
  var MAX_SPEED = 900;
  var MAX_BOUNCE_DEG = 55;      // reflection angle at the paddle's very edge
  var STORE_C = 'pong.computerWins';
  var STORE_P = 'pong.playerWins';

  var board, ballEl, padLEl, padREl, wallEl, scoreboard, countdownEl, scoreCEl, scorePEl, replayEl, playBtnEl;
  var W, H;                     // playfield size — the inner rail's content box
  var ox, oy;                   // playfield origin within the board
  var FULL_W = 1094;            // the classic court's playfield width, the
                                // yardstick the demo's speeds are quoted in
  var state = 'idle';           // idle | countdown | playing | paused | ended
  var ball = { x: 0, y: 0, vx: 0, vy: 0 };
  var padL, padR;               // y of each paddle
  var held = { up: false, down: false };
  var aiError = 0;              // per-serve aim offset so the AI misses sometimes
  var aiVel = 0;                // smoothed AI paddle velocity (px/s)
  var DPR = 1;                  // device pixels per CSS px, read at init
  var serveDir = -1;            // first serve goes left, toward the computer
  var countdownTimer = null;
  var lastT = 0;
  var rally = 0;                // paddle hits this point — the site-record stat

  function readTally(key) {
    var n = parseInt(sessionStorage.getItem(key), 10);
    return isNaN(n) ? 0 : n;
  }

  function renderTallies() {
    scoreCEl.textContent = readTally(STORE_C);
    scorePEl.textContent = readTally(STORE_P);
  }

  // x/y are playfield coords; elements are positioned within the board.
  // translate3d keeps the movers on their own GPU layers, and positions snap
  // to the device-pixel grid: at fractional offsets the compositor bilinear-
  // filters the layer, which makes a small fast ball shimmer ("scratchy")
  // as its edges soften and sharpen frame to frame.
  function place(el, x, y) {
    var px = Math.round((ox + x) * DPR) / DPR;
    var py = Math.round((oy + y) * DPR) / DPR;
    el.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
  }

  // The playfield is the inside of the inner rail — the ball treats its
  // border as the wall. Read rather than assumed, because the rail is two
  // different rectangles depending on where the board is parked.
  function measure() {
    ox = wallEl.offsetLeft + wallEl.clientLeft;
    oy = wallEl.offsetTop + wallEl.clientTop;
    W = wallEl.clientWidth;
    H = wallEl.clientHeight;
  }

  // A court that just changed shape has movers standing in the old one:
  // recentre the paddles and let the demo re-serve into the new box.
  function reseat() {
    demoOn = false;
    if (state === 'playing' || state === 'countdown' || state === 'paused') {
      ball.x = (W - BALL) / 2;
      ball.y = (H - BALL) / 2;
      place(ballEl, ball.x, ball.y);
    }
    centerPaddles();
  }

  function centerPaddles() {
    padL = padR = (H - PADDLE_H) / 2;
    place(padLEl, PADDLE_INSET, padL);
    place(padREl, W - PADDLE_INSET - PADDLE_W, padR);
  }

  function startCountdown() {
    state = 'countdown';
    ballEl.hidden = true;
    scoreboard.hidden = true;   // stays hidden through the rally — clean board
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
      serve();
    }, 1000);
  }

  function serve() {
    var angle = (Math.random() * 40 - 20) * Math.PI / 180;
    ball.x = (W - BALL) / 2;
    ball.y = (H - BALL) / 2;
    ball.vx = Math.cos(angle) * SERVE_SPEED * serveDir;
    ball.vy = Math.sin(angle) * SERVE_SPEED;
    aiError = (Math.random() - 0.5) * 44;
    rally = 0;
    ballEl.hidden = false;
    state = 'playing';
  }

  // A point ends the game: show the tallies and the replay glyph, then wait
  // for space / a board click to run the next countdown.
  function score(winner) {
    var key = winner === 'player' ? STORE_P : STORE_C;
    sessionStorage.setItem(key, readTally(key) + 1);
    renderTallies();
    if (window.PlayRecords) window.PlayRecords.report('pong', rally);
    // classic Pong: next serve goes toward the side that just conceded
    serveDir = winner === 'player' ? -1 : 1;
    state = 'ended';
    ballEl.hidden = true;
    scoreboard.hidden = false;
    replayEl.hidden = false;
  }

  // Reflect off a paddle: the hit offset from the paddle's centre sets the
  // exit angle (edge hits go steep), and each return gets a little faster.
  function bounce(dir, padY) {
    var offset = ((ball.y + BALL / 2) - (padY + PADDLE_H / 2)) / ((PADDLE_H + BALL) / 2);
    offset = Math.max(-1, Math.min(1, offset));
    var angle = offset * MAX_BOUNCE_DEG * Math.PI / 180;
    var speed = Math.min(Math.hypot(ball.vx, ball.vy) * SPEEDUP, MAX_SPEED);
    ball.vx = Math.cos(angle) * speed * dir;
    ball.vy = Math.sin(angle) * speed;
    aiError = (Math.random() - 0.5) * 44;
    rally++;
  }

  function step(dt) {
    // player paddle
    var move = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    padR = Math.max(0, Math.min(H - PADDLE_H, padR + move * PLAYER_SPEED * dt));

    // computer paddle: chase the ball while it approaches, else drift home.
    // Proportional control with an eased velocity — near the target the
    // paddle decelerates smoothly instead of stepping in and out of a
    // deadzone, which looked scratchy at low speeds.
    var chasing = ball.vx < 0;
    var target = chasing ? ball.y + BALL / 2 - PADDLE_H / 2 + aiError : (H - PADDLE_H) / 2;
    var diff = target - padL;
    var aiMax = chasing ? AI_SPEED : AI_IDLE_SPEED;
    var desired = Math.max(-aiMax, Math.min(aiMax, diff * 8));
    aiVel += (desired - aiVel) * Math.min(1, dt * 12);
    padL = Math.max(0, Math.min(H - PADDLE_H, padL + aiVel * dt));

    var prevX = ball.x;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // walls
    if (ball.y < 0) { ball.y = -ball.y; ball.vy = Math.abs(ball.vy); }
    else if (ball.y + BALL > H) { ball.y = 2 * (H - BALL) - ball.y; ball.vy = -Math.abs(ball.vy); }

    // paddle faces, swept on x so a fast ball can't tunnel through
    var faceL = PADDLE_INSET + PADDLE_W;
    var faceR = W - PADDLE_INSET - PADDLE_W - BALL;
    if (ball.vx < 0 && prevX >= faceL && ball.x <= faceL) {
      var t = (prevX - faceL) / (prevX - ball.x);
      var yAt = ball.y - ball.vy * dt * (1 - t);
      if (yAt + BALL > padL && yAt < padL + PADDLE_H) {
        ball.x = faceL;
        ball.y = yAt;
        bounce(1, padL);
      }
    } else if (ball.vx > 0 && prevX <= faceR && ball.x >= faceR) {
      var t2 = (faceR - prevX) / (ball.x - prevX);
      var yAt2 = ball.y - ball.vy * dt * (1 - t2);
      if (yAt2 + BALL > padR && yAt2 < padR + PADDLE_H) {
        ball.x = faceR;
        ball.y = yAt2;
        bounce(-1, padR);
      }
    }

    // a paddle missed and the ball reached the rail → point for the other side
    if (ball.x <= 0) { score('player'); return; }
    if (ball.x + BALL >= W) { score('computer'); return; }

    place(ballEl, ball.x, ball.y);
    place(padLEl, PADDLE_INSET, padL);
    place(padREl, W - PADDLE_INSET - PADDLE_W, padR);
  }

  /* ---- the tile demo: while the court idles in its preview card the game
     plays ITSELF — a lazy two-computer rally, the snake-attract idiom.
     Own ball state so a real game's serve maths never tangle with it;
     the shared paddles are fine (every real start recentres them). ---- */
  var DEMO_OK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var demoOn = false;
  var demo = { x: 0, y: 0, vx: 0, vy: 0 };

  // Speeds are quoted for the full-width court and scaled to whatever court
  // the board is currently in, so the square tile rally crosses its table in
  // the same handful of seconds — and at the same speed ON SCREEN, since the
  // narrower court is shown at a proportionally larger zoom.
  function demoSpeed(v) { return v * (W / FULL_W); }

  function demoServe(dirX) {
    var a = (Math.random() * 36 - 18) * Math.PI / 180;
    var s = demoSpeed(330);
    demo.x = (W - BALL) / 2;
    demo.y = (H - BALL) / 2;
    demo.vx = Math.cos(a) * s * dirX;
    demo.vy = Math.sin(a) * s;
  }

  function demoTick(dt) {
    if (!demoOn) {
      demoOn = true;
      ballEl.hidden = false;
      demoServe(Math.random() < 0.5 ? -1 : 1);
    }
    demo.x += demo.vx * dt;
    demo.y += demo.vy * dt;
    if (demo.y < 0) { demo.y = -demo.y; demo.vy = Math.abs(demo.vy); }
    else if (demo.y + BALL > H) { demo.y = 2 * (H - BALL) - demo.y; demo.vy = -Math.abs(demo.vy); }
    var faceL = PADDLE_INSET + PADDLE_W;
    var faceR = W - PADDLE_INSET - PADDLE_W - BALL;
    if (demo.vx < 0 && demo.x <= faceL && demo.y + BALL > padL && demo.y < padL + PADDLE_H) {
      demo.x = faceL;
      demo.vx = Math.abs(demo.vx);
      demo.vy += ((demo.y + BALL / 2) - (padL + PADDLE_H / 2)) * demoSpeed(3);
    } else if (demo.vx > 0 && demo.x >= faceR && demo.y + BALL > padR && demo.y < padR + PADDLE_H) {
      demo.x = faceR;
      demo.vx = -Math.abs(demo.vx);
      demo.vy += ((demo.y + BALL / 2) - (padR + PADDLE_H / 2)) * demoSpeed(3);
    }
    // a miss just re-serves the other way — nobody keeps score in a lobby
    if (demo.x < -BALL * 2) demoServe(1);
    else if (demo.x > W + BALL) demoServe(-1);
    // both paddles chase with a deliberately easy hand, so the rally
    // wanders instead of playing perfect
    var tL = demo.vx < 0 ? demo.y + BALL / 2 - PADDLE_H / 2 : (H - PADDLE_H) / 2;
    var tR = demo.vx > 0 ? demo.y + BALL / 2 - PADDLE_H / 2 : (H - PADDLE_H) / 2;
    var cap = demoSpeed(250);
    padL = Math.max(0, Math.min(H - PADDLE_H,
      padL + Math.max(-cap, Math.min(cap, (tL - padL) * 5)) * dt));
    padR = Math.max(0, Math.min(H - PADDLE_H,
      padR + Math.max(-cap, Math.min(cap, (tR - padR) * 5)) * dt));
    place(ballEl, demo.x, demo.y);
    place(padLEl, PADDLE_INSET, padL);
    place(padREl, W - PADDLE_INSET - PADDLE_W, padR);
  }

  function demoStop() {
    if (!demoOn) return;
    demoOn = false;
    if (state === 'idle' || state === 'ended') {
      ballEl.hidden = true;
      centerPaddles();
    }
  }

  function inDemo() {
    return DEMO_OK && (state === 'idle' || state === 'ended') &&
      !!board.closest('.play-card');
  }

  function loop(t) {
    // Integrate with the real frame delta so the ball keeps a constant
    // real-time speed even when a frame runs long — clamping at ~2 frames
    // made every slow frame a visible hiccup. The 100ms cap only guards
    // tab-switch-sized gaps; the swept paddle check handles the larger steps.
    var dt = Math.min((t - lastT) / 1000, 0.1);
    lastT = t;
    if (state === 'playing') step(dt);
    else if (inDemo()) demoTick(dt);
    else demoStop();
    requestAnimationFrame(loop);
  }

  // With Snake sharing the page, only the game whose board straddles the
  // viewport centre owns the keyboard (and a game scrolled off mid-rally
  // pauses itself rather than playing on unseen).
  // Which board owns the keyboard. The decks stack VERTICALLY now: the
  // board that straddles the middle of the screen answers. Unless the
  // theater (js/theater.js) has one — then it owns the keys outright — or
  // an overlay is up, in which case every game stays quiet (inert does not
  // silence document-level keydown listeners; this check is the real guard).
  function inView() {
    var html = document.documentElement;
    if (html.classList.contains('theater-open')) return !!board.closest('#theater-stage');
    if (html.classList.contains('ai-open') || html.classList.contains('case-open')) return false;
    if (board.closest('.play-card')) return false;   // parked in its preview tile
    var r = board.getBoundingClientRect();
    var mid = window.innerHeight / 2;
    return r.top < mid && r.bottom > mid;
  }

  // WASD sits alongside the arrows — same paddle, left hand or right.
  // Anything with a modifier held is the browser's (⌘W closes the tab), so
  // it passes straight through untouched.
  function isUp(code) { return code === 'ArrowUp' || code === 'KeyW'; }
  function isDown(code) { return code === 'ArrowDown' || code === 'KeyS'; }
  function isSteer(code) {
    return isUp(code) || isDown(code) || code === 'ArrowLeft' ||
      code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD';
  }

  function onKeyDown(e) {
    if (!inView() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (isSteer(e.code) || e.code === 'Space') e.preventDefault();
    if (isUp(e.code)) held.up = true;
    if (isDown(e.code)) held.down = true;
    if (e.code === 'Space' && !e.repeat) {
      if (state === 'idle' || state === 'ended') startCountdown();
      else if (state === 'playing') state = 'paused';
      else if (state === 'paused') state = 'playing';
      // ignored during the countdown
    }
  }

  function onKeyUp(e) {
    if (isUp(e.code)) held.up = false;
    if (isDown(e.code)) held.down = false;
  }

  function init() {
    board = document.getElementById('board');
    ballEl = document.getElementById('ball');
    padLEl = document.getElementById('paddle-left');
    padREl = document.getElementById('paddle-right');
    scoreboard = document.getElementById('scoreboard');
    countdownEl = document.getElementById('countdown');
    scoreCEl = document.getElementById('score-computer');
    scorePEl = document.getElementById('score-player');
    replayEl = document.getElementById('replay');
    playBtnEl = document.getElementById('play-btn');
    if (!board || !ballEl) return;

    wallEl = document.getElementById('board-wall');
    DPR = window.devicePixelRatio || 1;
    measure();
    // The court changes SHAPE between its two homes — a square table in the
    // preview tile, the classic 2.7:1 strip in the theater (css/play.css).
    // The move happens in js/theater.js at times this file cannot see (the
    // trip home lands a beat after setTheater(false), at the end of the fly),
    // so the rail itself is what is watched: whenever it resizes, the
    // playfield is re-read and the movers are put back where they belong.
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        if (wallEl.clientWidth === W && wallEl.clientHeight === H) return;
        measure();
        reseat();
      }).observe(wallEl);
    }

    renderTallies();
    // clean idle board like snake/flappy — the tallies only show on the
    // replay screen (score() unhides them)
    scoreboard.hidden = true;
    centerPaddles();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    // clicking anywhere on the board starts a game (also covers the replay
    // glyph, which sits inside the board)
    board.addEventListener('click', function () {
      if (state === 'idle' || state === 'ended') startCountdown();
    });
    // touch: drag anywhere on the court to steer the paddle (the tap that
    // starts a game already arrives as a click)
    board.addEventListener('touchmove', function (e) {
      if (state !== 'playing' && state !== 'paused') return;
      var r = board.getBoundingClientRect();
      var y = (e.touches[0].clientY - r.top) * (board.offsetHeight / r.height) - oy;
      padR = Math.max(0, Math.min(H - PADDLE_H, y - PADDLE_H / 2));
      place(padREl, W - PADDLE_INSET - PADDLE_W, padR);
      e.preventDefault();
    }, { passive: false });

    // NB: no auto-pause on window blur — it froze the game with no visual
    // cue whenever focus flickered, which read as stutter or a dead ball.
    // Scrolling AWAY does pause, though: an unseen rally just loses points.
    // the DOCUMENT scrolls now (the deck's own scroller is plain flow) —
    // a board scrolled away mid-game pauses rather than playing on unseen
    window.addEventListener('scroll', function () {
      if (state === 'playing' && !inView()) state = 'paused';
    }, { passive: true });

    requestAnimationFrame(function (t) {
      lastT = t;
      requestAnimationFrame(loop);
    });

    // (the stage's own fade-in moved to js/play-pager.js, which is where
    // Work and About keep theirs — one line per section, in the file that
    // owns the section, rather than in whichever game happened to boot)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // the theater (js/theater.js) is moving the board. Entering mid-rally
  // pauses; LEAVING ends the run outright — back in its tile the court is
  // inert, so a frozen half-game would just sit there. The tile gets the
  // idle board back and the demo rally takes over.
  function setTheater(on) {
    if (on) {
      if (state === 'playing') state = 'paused';
      return;
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    state = 'idle';
    ballEl.hidden = true;
    scoreboard.hidden = true;
    countdownEl.hidden = true;
    replayEl.hidden = true;
    playBtnEl.hidden = false;
    centerPaddles();
  }

  return { init: init, setTheater: setTheater };
})();
