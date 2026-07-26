// Snake — the second Play-page game, patterned on js/pong.js. The rail's
// content box divides into 21px cells (the pong unit): 52×18. Arrow keys or
// WASD steer (reversals ignored), space pauses; the snake speeds up a little
// with each food. Hitting the rail or itself ends the run: the board shows
// Score/Best plus the replay glyph, exactly like pong's ended state. Best
// lives in sessionStorage alongside pong's tallies. Only the game whose
// board is centred in the viewport owns the keyboard (see pong.js).
window.Snake = (function () {
  var CELL = 21;
  var STEP_MS0 = 110;           // ms per grid step at the start
  var STEP_MIN = 65;
  var STEP_FALL = 3;            // ms faster per food
  var START_LEN = 4;
  var STORE_BEST = 'snake.best';        // this session's best (in-board tally)

  var board, wall, scoreboard, countdownEl, scoreEl, bestEl, replayEl, playBtnEl;
  var cols, rows;               // grid size — the rail content box / CELL
  var ox, oy;                   // playfield origin within the board
  var DPR = 1;
  var state = 'idle';           // idle | countdown | playing | paused | ended
  var snake = [];               // [{x,y}] head first, grid coords
  var segEls = [];              // pooled divs, one per segment
  var dir = { x: 1, y: 0 };
  var nextDir = { x: 1, y: 0 };
  var food = { x: 0, y: 0 };
  var foodEl = null;
  var stepMs = STEP_MS0;
  var acc = 0;
  var lastT = 0;
  var countdownTimer = null;

  var attract = null;           // {cells, i} while the idle snake circles

  function readBest() {
    var n = parseInt(sessionStorage.getItem(STORE_BEST), 10);
    return isNaN(n) ? 0 : n;
  }

  function renderScores() {
    scoreEl.textContent = snake.length ? snake.length - START_LEN : 0;
    bestEl.textContent = readBest();
  }

  // same DPR-snapped translate3d trick as pong's place()
  function place(el, cx, cy) {
    var px = Math.round((ox + cx * CELL) * DPR) / DPR;
    var py = Math.round((oy + cy * CELL) * DPR) / DPR;
    el.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
  }

  function segEl(i) {
    while (segEls.length <= i) {
      var el = document.createElement('div');
      el.className = 'snake-seg';
      board.appendChild(el);
      segEls.push(el);
    }
    return segEls[i];
  }

  function render() {
    for (var i = 0; i < snake.length; i++) {
      var el = segEl(i);
      el.hidden = false;
      place(el, snake[i].x, snake[i].y);
    }
    for (var j = snake.length; j < segEls.length; j++) segEls[j].hidden = true;
    foodEl.hidden = false;
    place(foodEl, food.x, food.y);
  }

  function hideMovers() {
    segEls.forEach(function (el) { el.hidden = true; });
    if (foodEl) foodEl.hidden = true;
  }

  function dropFood() {
    do {
      food.x = Math.floor(Math.random() * cols);
      food.y = Math.floor(Math.random() * rows);
    } while (snake.some(function (s) { return s.x === food.x && s.y === food.y; }));
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
    attract = null;
    snake = [];
    var cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    for (var i = 0; i < START_LEN; i++) snake.push({ x: cx - i, y: cy });
    dir = { x: 1, y: 0 };
    nextDir = dir;
    stepMs = STEP_MS0;
    acc = 0;
    dropFood();
    render();
    state = 'playing';
  }

  function gameOver() {
    var score = snake.length - START_LEN;
    if (score > readBest()) sessionStorage.setItem(STORE_BEST, score);
    renderScores();
    if (window.PlayRecords) window.PlayRecords.report('snake', score);
    state = 'ended';
    hideMovers();                 // clean card: just the tallies + replay
    scoreboard.hidden = false;
    replayEl.hidden = false;
  }

  /* ---- attract mode: on the INITIAL screen only, a little snake endlessly
     circumnavigates the outer ring of the grid (skipped under
     prefers-reduced-motion). begin() clears it for good — the ended board
     stays still. ---- */
  function ringCells() {
    var cells = [];
    var x, y;
    for (x = 0; x < cols; x++) cells.push({ x: x, y: 0 });
    for (y = 1; y < rows; y++) cells.push({ x: cols - 1, y: y });
    for (x = cols - 2; x >= 0; x--) cells.push({ x: x, y: rows - 1 });
    for (y = rows - 2; y >= 1; y--) cells.push({ x: 0, y: y });
    return cells;
  }

  function startAttract() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    attract = { cells: ringCells(), i: 0 };
    if (foodEl) foodEl.hidden = true;
    acc = 0;
  }

  function attractStep() {
    var ring = attract.cells;
    attract.i = (attract.i + 1) % ring.length;
    for (var s = 0; s < START_LEN; s++) {
      var el = segEl(s);
      el.hidden = false;
      var cell = ring[(attract.i - s + ring.length) % ring.length];
      place(el, cell.x, cell.y);
    }
    for (var j = START_LEN; j < segEls.length; j++) segEls[j].hidden = true;
  }

  function step() {
    dir = nextDir;
    var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // the rail is the wall
    if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows) {
      gameOver();
      return;
    }
    // self collision — the tail cell is safe unless this step grows
    var eats = head.x === food.x && head.y === food.y;
    var body = eats ? snake : snake.slice(0, -1);
    if (body.some(function (s) { return s.x === head.x && s.y === head.y; })) {
      gameOver();
      return;
    }

    snake.unshift(head);
    if (eats) {
      stepMs = Math.max(STEP_MIN, stepMs - STEP_FALL);
      renderScores();
      dropFood();
    } else {
      snake.pop();
    }
    render();
  }

  function loop(t) {
    var dt = Math.min(t - lastT, 100);   // cap tab-switch gaps like pong
    lastT = t;
    if (state === 'playing') {
      acc += dt;
      while (acc >= stepMs && state === 'playing') {
        acc -= stepMs;
        step();
      }
    } else if (attract && (state === 'idle' || state === 'ended')) {
      acc += dt;
      while (acc >= STEP_MS0) {
        acc -= STEP_MS0;
        attractStep();
      }
    }
    requestAnimationFrame(loop);
  }

  function inView() {
    var r = board.getBoundingClientRect();
    var mid = window.innerWidth / 2;   // slides travel horizontally
    return r.left < mid && r.right > mid;
  }

  function steer(x, y) {
    // no reversing into yourself; queue off the CURRENT direction so two
    // quick turns within one step can't fold the head back
    if (x === -dir.x && y === -dir.y) return;
    nextDir = { x: x, y: y };
  }

  // WASD steers alongside the arrows. Anything with a modifier held is the
  // browser's (⌘W closes the tab) and passes straight through untouched.
  var STEER = {
    ArrowUp: [0, -1], KeyW: [0, -1],
    ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0],
    ArrowRight: [1, 0], KeyD: [1, 0],
  };

  function onKeyDown(e) {
    if (!inView() || e.metaKey || e.ctrlKey || e.altKey) return;
    var turn = STEER[e.code];
    if (turn || e.code === 'Space') e.preventDefault();
    if (turn) steer(turn[0], turn[1]);
    if (e.code === 'Space' && !e.repeat) {
      if (state === 'idle' || state === 'ended') startCountdown();
      else if (state === 'playing') state = 'paused';
      else if (state === 'paused') state = 'playing';
    }
  }

  function init() {
    board = document.getElementById('snake-board');
    wall = document.getElementById('snake-wall');
    scoreboard = document.getElementById('snake-scoreboard');
    countdownEl = document.getElementById('snake-countdown');
    scoreEl = document.getElementById('snake-score');
    bestEl = document.getElementById('snake-best');
    replayEl = document.getElementById('snake-replay');
    playBtnEl = document.getElementById('snake-play');
    if (!board || !wall) return;

    cols = Math.floor(wall.clientWidth / CELL);
    rows = Math.floor(wall.clientHeight / CELL);
    // centre the grid's leftover pixels inside the rail
    ox = wall.offsetLeft + wall.clientLeft + Math.floor((wall.clientWidth - cols * CELL) / 2);
    oy = wall.offsetTop + wall.clientTop + Math.floor((wall.clientHeight - rows * CELL) / 2);
    DPR = window.devicePixelRatio || 1;

    foodEl = document.createElement('div');
    foodEl.className = 'snake-food';
    foodEl.hidden = true;
    board.appendChild(foodEl);

    renderScores();
    // per the 1417 frame the idle board is clean — tallies only on game over
    scoreboard.hidden = true;
    startAttract();

    document.addEventListener('keydown', onKeyDown);
    board.addEventListener('click', function () {
      if (state === 'idle' || state === 'ended') startCountdown();
    });
    // touch: swipe on the court to steer (arrow keys, but with a thumb)
    var touchAt = null;
    board.addEventListener('touchstart', function (e) {
      touchAt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    board.addEventListener('touchmove', function (e) {
      if (!touchAt) return;
      var dx = e.touches[0].clientX - touchAt.x;
      var dy = e.touches[0].clientY - touchAt.y;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1, 0);
      else steer(0, dy > 0 ? 1 : -1);
      touchAt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      e.preventDefault();
    }, { passive: false });
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
