// play/engine.js — what the three games share: one clock, a canvas fitted
// to a playfield, the best scores, and the life of a game.
//
// The live site's games are DOM boards: divs moved with translate3d, sized
// by CSS zoom, and they know the shell they live in. These are canvas. The
// new look is ink line art: a snake drawn as one round-jointed stroke that
// glides between cells, capsule paddles, outlined pillars, a bird that tilts.
// Canvas draws those natively. Each game also keeps its playfield in its own
// logical units, so the same rules run in a 347px card and on a full stage,
// and only the fit changes.

// ---- one clock for everything that runs ----
// One requestAnimationFrame for every live game, with the frame's time step
// capped at 0.1s (a backgrounded tab coming back must not teleport a ball
// through a paddle). It stops itself when nothing is listening.
const subscribers = new Set();
let raf = 0;
let last = 0;
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  for (const fn of [...subscribers]) fn(dt, now);
  raf = subscribers.size ? requestAnimationFrame(frame) : 0;
}
export const ticker = {
  add(fn) {
    subscribers.add(fn);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  },
  remove(fn) { subscribers.delete(fn); },
};

// ---- the pen ----
export const INK = '#1e1e1e';
export const STRUCTURE = 'rgba(30, 30, 30, 0.18)';
export const FAINT = 'rgba(30, 30, 30, 0.1)';

// ---- a canvas, fitted to a playfield ----
// The canvas fills its box in CSS; its bitmap follows at the device's pixel
// ratio (capped at 2), and the field is scaled to fit inside, centred, with
// `pad` CSS px kept clear around it. `px` is one CSS pixel in field units,
// so a line can be drawn "4px wide" whatever the scale.
export class Surface {
  constructor(canvas, field, { pad = 0 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.field = field;
    this.pad = pad;
    this.observer = new ResizeObserver(() => this.fit());
    this.observer.observe(canvas);
    this.fit();
  }

  fit() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    const { w: fw, h: fh } = this.field;
    this.scale = Math.max(0.01, Math.min((w - 2 * this.pad) / fw, (h - 2 * this.pad) / fh));
    this.ox = (w - fw * this.scale) / 2;
    this.oy = (h - fh * this.scale) / 2;
    this.dpr = dpr;
    this.px = 1 / this.scale;
    // the court's own pastel, for anything drawn in "paper" over the ink
    // (an eye, a highlight): read once here, not every frame
    this.court = getComputedStyle(this.canvas).getPropertyValue('--card-bg').trim() || '#fafafa';
    this.onfit?.();
  }

  begin() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const k = this.dpr * this.scale;
    c.setTransform(k, 0, 0, k, this.dpr * this.ox, this.dpr * this.oy);
    return c;
  }

  // where a pointer is, in field units
  toField(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left - this.ox) / this.scale, y: (clientY - r.top - this.oy) / this.scale };
  }

  destroy() { this.observer.disconnect(); }
}

// ---- small drawing helpers ----
export function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}
export function capsule(c, x, y, w, h) {
  const r = Math.min(w, h) / 2;
  roundRect(c, x, y, w, h, r);
  c.fill();
}
export function disc(c, x, y, r) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---- the best scores stay on this machine ----
// localStorage only, keyed per game. The live site keeps site-wide records
// through /api/scores; the draft never calls it, because a POST from here
// would change the live site's records.
export function readBest(id) {
  try { return Number(localStorage.getItem('draft.best.' + id)) || 0; } catch { return 0; }
}
function writeBest(id, value) {
  try { localStorage.setItem('draft.best.' + id, String(value)); } catch { /* private mode */ }
}

// ---- the life of a game ----
//   demo       playing itself in its card
//   idle       on the stage, waiting for you
//   countdown  3, 2, 1 (timed in the tick, so it pauses with everything else)
//   playing
//   paused
//   ended      a short lock (600ms, the live Flappy's) so the key that ended
//              a run cannot also start the next one
export class Game {
  static id = 'game';
  static countdown = true;

  constructor(surface, { demo = false, onChange = () => {} } = {}) {
    this.s = surface;
    this.f = demo ? this.constructor.demoField : this.constructor.field;
    this.isDemo = demo;
    this.onChange = onChange;
    this.state = demo ? 'demo' : 'idle';
    this.score = 0;
    this.best = readBest(this.constructor.id);
    this.count = 0;
    this.countT = 0;
    this.lock = 0;
    this.t = 0;
    this.tick = this.tick.bind(this);
    this.reset();
  }

  run() { ticker.add(this.tick); }
  stop() { ticker.remove(this.tick); }
  destroy() { this.stop(); this.s.destroy(); }

  start() {
    if (this.lock > 0) return;
    this.reset();
    if (this.constructor.countdown) {
      this.state = 'countdown';
      this.count = 3;
      this.countT = 0;
    } else {
      this.state = 'playing';
      this.begin();
    }
    this.emit();
  }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.emit();
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.emit();
  }
  toggle() {
    if (this.state === 'idle' || this.state === 'ended') this.start();
    else if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }
  end(result = {}) {
    this.state = 'ended';
    this.result = result;
    this.lock = 0.6;
    this.newBest = this.score > this.best;
    if (this.newBest) {
      this.best = this.score;
      writeBest(this.constructor.id, this.best);
    }
    this.emit();
  }

  tick(dt) {
    this.t += dt;
    if (this.lock > 0) this.lock -= dt;
    if (this.state === 'demo') this.demo(dt);
    else if (this.state === 'countdown') {
      this.countT += dt;
      if (this.countT >= 1) {
        this.countT -= 1;
        this.count -= 1;
        if (this.count <= 0) {
          this.state = 'playing';
          this.begin();
        }
        this.emit();
      }
      this.idle(dt);
    } else if (this.state === 'playing') this.step(dt);
    else this.idle(dt);
    this.render();
  }

  render() {
    if (!this.s.scale) return;
    this.draw(this.s.begin());
  }

  emit() { this.onChange(this); }

  // the games fill these in
  reset() {}
  begin() {}
  step() {}
  demo() {}
  idle() {}
  draw() {}
  key() { return false; }
  pointer() {}
}
