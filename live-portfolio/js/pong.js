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

  var board, ballEl, padLEl, padREl, scoreboard, countdownEl, scoreCEl, scorePEl, replayEl, playBtnEl;
  var W, H;                     // playfield size — the inner rail's content box
  var ox, oy;                   // playfield origin within the board
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

  function loop(t) {
    // Integrate with the real frame delta so the ball keeps a constant
    // real-time speed even when a frame runs long — clamping at ~2 frames
    // made every slow frame a visible hiccup. The 100ms cap only guards
    // tab-switch-sized gaps; the swept paddle check handles the larger steps.
    var dt = Math.min((t - lastT) / 1000, 0.1);
    lastT = t;
    if (state === 'playing') step(dt);
    requestAnimationFrame(loop);
  }

  // With Snake sharing the page, only the game whose board straddles the
  // viewport centre owns the keyboard (and a game scrolled off mid-rally
  // pauses itself rather than playing on unseen).
  // Which board owns the keyboard. This used to compare against the
  // viewport centre, which was the same thing when the page WAS the
  // viewport. Inside the shell the card sits right of centre, so the
  // question is asked of the card instead — literally what it always
  // meant: does this board straddle the middle of what you are looking at?
  function inView() {
    var r = board.getBoundingClientRect();
    var host = document.getElementById('shell-card');
    var hr = host ? host.getBoundingClientRect() : null;
    var mid = hr ? hr.left + hr.width / 2 : window.innerWidth / 2;
    return r.left < mid && r.right > mid;   // slides travel horizontally
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

    // the playfield is the inside of the inner rail — the ball treats its
    // border as the wall
    var wall = document.getElementById('board-wall');
    ox = wall.offsetLeft + wall.clientLeft;
    oy = wall.offsetTop + wall.clientTop;
    W = wall.clientWidth;
    H = wall.clientHeight;
    DPR = window.devicePixelRatio || 1;

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

    var stage = document.getElementById('play-stage');
    requestAnimationFrame(function () { stage.classList.add('revealed'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init: init };
})();
