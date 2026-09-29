// play/snake.js — Nokia, 1997, in ink on mint.
//
// The rules are the live game's (live-portfolio/js/snake.js:9-13, 165-232):
//   a 20 × 20 grid of 21px cells; a step every 110ms, 3ms quicker per food,
//   never quicker than 65ms; four long at the centre, heading right
//   a turn straight back into yourself is ignored
//   walls end it, and so does your own body, except the cell your tail is
//     just leaving (unless you eat on that step, when the tail stays)
//   the score is how long you are, less the four you started with
// One change: turns queue two deep. The live board takes one turn per step
// and drops a second one pressed in the same step, so a quick
// down-then-left to double back around a corner loses the left. Here the
// second waits its turn. Each queued turn is checked against the one before
// it, not against where the snake is facing now.
//
// Drawn as ONE stroke through the cells' centres, round-jointed, the same
// pen as the dock's icons, and it GLIDES: the head is drawn part-way to its
// cell and the tail part-way from its old one, by how far the clock is into
// the current step. The picture runs one step behind the rules, which is the
// price of never jumping a whole cell at a time.

import { Game, INK, FAINT, STRUCTURE, roundRect, disc } from './engine.js';

const CELL = 21;
const START = 110;
const FASTER = 3;
const FLOOR = 65;
const DIRS = {
  arrowup: [0, -1], w: [0, -1],
  arrowdown: [0, 1], s: [0, 1],
  arrowleft: [-1, 0], a: [-1, 0],
  arrowright: [1, 0], d: [1, 0],
};

export default class Snake extends Game {
  static id = 'snake';
  static field = { w: 20 * CELL, h: 20 * CELL };
  static demoField = { w: 16 * CELL, h: 12 * CELL };

  reset() {
    this.cols = Math.round(this.f.w / CELL);
    this.rows = Math.round(this.f.h / CELL);
    const cx = Math.floor(this.cols / 2);
    const cy = Math.floor(this.rows / 2);
    this.body = [0, 1, 2, 3].map((i) => ({ x: cx - i, y: cy }));
    this.prevTail = { x: cx - 4, y: cy };
    this.grew = false;
    this.dir = { x: 1, y: 0 };
    this.queue = [];
    this.acc = 0;
    this.stepMs = this.isDemo ? 150 : START;
    this.score = 0;
    this.dead = false;
    this.placeFood();
  }

  placeFood() {
    const free = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!this.body.some((c) => c.x === x && c.y === y)) free.push({ x, y });
      }
    }
    // a full board has nowhere left to put food, and that is a win
    this.food = free.length ? free[(Math.random() * free.length) | 0] : null;
  }

  turn(x, y) {
    const last = this.queue.at(-1) || this.dir;
    if ((x === -last.x && y === -last.y) || (x === last.x && y === last.y)) return;
    if (this.queue.length < 2) this.queue.push({ x, y });
  }

  advance() {
    if (this.queue.length) this.dir = this.queue.shift();
    const head = this.body[0];
    const nx = head.x + this.dir.x;
    const ny = head.y + this.dir.y;
    if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) return false;
    const eating = this.food && nx === this.food.x && ny === this.food.y;
    const against = eating ? this.body : this.body.slice(0, -1);
    if (against.some((c) => c.x === nx && c.y === ny)) return false;
    this.prevTail = { ...this.body.at(-1) };
    this.body.unshift({ x: nx, y: ny });
    this.grew = !!eating;
    if (eating) {
      if (!this.isDemo) {
        this.score += 1;
        this.stepMs = Math.max(FLOOR, START - FASTER * this.score);
        this.emit();
      } else if (this.body.length > 12) {
        // the card's snake stays small: it is a picture, not a player
        this.body.pop();
        this.grew = false;
      }
      this.placeFood();
      if (!this.food) return false;
    } else {
      this.body.pop();
    }
    return true;
  }

  step(dt) {
    this.acc += dt * 1000;
    while (this.acc >= this.stepMs) {
      this.acc -= this.stepMs;
      if (!this.advance()) {
        this.acc = this.stepMs; // freeze the picture on the step that ended it
        this.dead = true;
        this.end();
        return;
      }
    }
  }

  // The card's snake plays itself: at each step it takes whichever of
  // straight on, left or right is safe and brings it nearest the food.
  demo(dt) {
    this.acc += dt * 1000;
    while (this.acc >= this.stepMs) {
      this.acc -= this.stepMs;
      const h = this.body[0];
      const d = this.dir;
      const options = [d, { x: d.y, y: -d.x }, { x: -d.y, y: d.x }]
        .map((o) => ({ ...o, nx: h.x + o.x, ny: h.y + o.y }))
        .filter((o) => o.nx >= 0 && o.ny >= 0 && o.nx < this.cols && o.ny < this.rows &&
          !this.body.slice(0, -1).some((c) => c.x === o.nx && c.y === o.ny));
      if (!options.length || !this.food) { this.reset(); return; }
      const dist = (o) => Math.abs(o.nx - this.food.x) + Math.abs(o.ny - this.food.y);
      options.sort((a, b) => dist(a) - dist(b));
      this.dir = { x: options[0].x, y: options[0].y };
      if (!this.advance()) { this.reset(); return; }
    }
  }

  key(e, down) {
    const k = e.key.toLowerCase();
    if (DIRS[k]) {
      if (down) {
        if (this.state === 'idle' || this.state === 'ended') return true;
        this.turn(...DIRS[k]);
      }
      return true;
    }
    if (k === ' ' || k === 'enter') { if (down && !e.repeat) this.toggle(); return true; }
    return false;
  }

  // Swipes steer, 24px at least, as on the live board. A tap starts or
  // resumes.
  pointer(e) {
    if (e.type === 'pointerdown') {
      this.swipe = { x: e.clientX, y: e.clientY };
      if (this.state === 'idle' || this.state === 'ended') this.start();
      else if (this.state === 'paused') this.resume();
      return;
    }
    if (!this.swipe || (e.type !== 'pointermove' && e.type !== 'pointerup')) return;
    const dx = e.clientX - this.swipe.x;
    const dy = e.clientY - this.swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) this.turn(Math.sign(dx), 0);
    else this.turn(0, Math.sign(dy));
    this.swipe = e.type === 'pointerup' ? null : { x: e.clientX, y: e.clientY };
  }

  draw(c) {
    const { w, h } = this.f;
    const px = this.s.px;
    const moving = this.state === 'playing' || this.state === 'demo';
    const p = moving ? Math.min(1, this.acc / this.stepMs) : 1;
    const at = (cell) => [cell.x * CELL + CELL / 2, cell.y * CELL + CELL / 2];
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

    // the board: its edge, and a faint dot at every cell
    c.strokeStyle = STRUCTURE;
    c.lineWidth = 2 * px;
    roundRect(c, -12, -12, w + 24, h + 24, 22);
    c.stroke();
    c.fillStyle = FAINT;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) disc(c, x * CELL + CELL / 2, y * CELL + CELL / 2, 1.3 * px);
    }

    // the food, breathing
    if (this.food) {
      const [fx, fy] = at(this.food);
      c.fillStyle = INK;
      disc(c, fx, fy, CELL * 0.24 * (1 + 0.1 * Math.sin(this.t * 5)));
    }

    // the snake: one stroke, head to tail
    const body = this.body;
    const pts = [];
    pts.push(body.length > 1 ? lerp(at(body[1]), at(body[0]), p) : at(body[0]));
    for (let i = 1; i < body.length; i++) pts.push(at(body[i]));
    if (!this.grew) pts.push(lerp(at(this.prevTail), at(body.at(-1)), p));
    c.strokeStyle = INK;
    c.lineWidth = CELL * 0.62;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.stroke();

    // an eye, a little ahead and to its left, looking where it is going
    const [hx, hy] = pts[0];
    const { x: dx, y: dy } = this.dir;
    c.fillStyle = this.s.court;
    disc(c, hx + (dx + dy) * CELL * 0.14, hy + (dy - dx) * CELL * 0.14, CELL * 0.09);
  }
}
