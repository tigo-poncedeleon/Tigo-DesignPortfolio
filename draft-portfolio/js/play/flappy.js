// play/flappy.js — dotGears, 2013, in ink on sky.
//
// The live game's physics (live-portfolio/js/flappy.js:10-19, 159-203):
//   the bird is 21px and flies at x 200; gravity is 1500px/s², and a flap
//     SETS the fall to −430 rather than adding to it (an apex of about 62px)
//   pipes are 42 wide with a 147 gap, travel at 150px/s, one pair every 210px,
//     and the gap stays 42 clear of the ceiling and the floor
//   the ceiling and the floor both end it; a pipe scores once it has fully
//     passed; and after a crash there is a 600ms lock, so the flap that
//     crashed you cannot also restart you
// No countdown here, unlike Pong and Snake: the first flap is the start.
// Waiting through "3, 2, 1" and then having to flap anyway is two starts.
//
// The pipes are outlined pillars, the dock's pen on the sky, clipped by the
// playfield so they arrive through its edge. The bird is an ink disc with an
// eye, tilted by how fast it is climbing or falling.

import { Game, INK, STRUCTURE, roundRect, disc, clamp } from './engine.js';

const BIRD = 21;
const GRAVITY = 1500;
const FLAP = -430;
const PIPE = 42;
const GAP = 147;
const SPEED = 150;
const EVERY = 210;
const MARGIN = 42;

export default class Flappy extends Game {
  static id = 'flappy';
  static countdown = false;
  static field = { w: 597, h: 538 };
  static demoField = { w: 560, h: 420 };

  reset() {
    this.x = this.isDemo ? 170 : 200;
    this.y = this.f.h / 2 - BIRD / 2;
    this.vy = 0;
    this.pipes = [];
    this.since = EVERY; // travel since the last pair
    this.score = 0;
    if (this.isDemo) this.spawn(this.f.w * 0.62);
  }

  begin() { this.flap(); }

  spawn(x = this.f.w + 20) {
    const lo = MARGIN + GAP / 2;
    const hi = this.f.h - MARGIN - GAP / 2;
    this.pipes.push({ x, gap: lo + Math.random() * (hi - lo), passed: false });
    this.since = 0;
  }

  flap(strength = 1) { this.vy = FLAP * strength; }

  fly(dt) {
    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;
    const d = SPEED * dt;
    this.since += d;
    for (const p of this.pipes) p.x -= d;
    if (this.since >= EVERY) this.spawn(this.f.w + 20 - (this.since - EVERY));
    this.pipes = this.pipes.filter((p) => p.x + PIPE > -40);
  }

  crashed() {
    if (this.y < 0 || this.y + BIRD > this.f.h) return true;
    const r = BIRD / 2;
    const cx = this.x + r;
    const cy = this.y + r;
    for (const p of this.pipes) {
      if (cx + r < p.x || cx - r > p.x + PIPE) continue;
      const top = p.gap - GAP / 2;
      const bottom = p.gap + GAP / 2;
      // circle against the two rectangles, nearest-point test
      for (const [y0, y1] of [[-1e4, top], [bottom, 1e4]]) {
        const nx = clamp(cx, p.x, p.x + PIPE);
        const ny = clamp(cy, y0, y1);
        if ((cx - nx) ** 2 + (cy - ny) ** 2 < r * r) return true;
      }
    }
    return false;
  }

  step(dt) {
    this.fly(dt);
    for (const p of this.pipes) {
      if (!p.passed && p.x + PIPE < this.x) {
        p.passed = true;
        this.score += 1;
        this.emit();
      }
    }
    if (this.crashed()) this.end();
  }

  // The card's bird flies itself: whenever it sinks more than 14px below the
  // next gap's centre, it flaps, a little softer than you would.
  demo(dt) {
    const next = this.pipes.find((p) => p.x + PIPE > this.x) || { gap: this.f.h / 2 };
    if (this.y + BIRD / 2 > next.gap + 14 && this.vy > 0) this.flap(0.85);
    this.fly(dt);
    if (this.crashed()) this.reset();
  }

  // Waiting (and after a crash, falling): a gentle bob in place.
  idle(dt) {
    if (this.state === 'ended') {
      if (this.y + BIRD < this.f.h) {
        this.vy += GRAVITY * dt;
        this.y = Math.min(this.f.h - BIRD, this.y + this.vy * dt);
      }
      return;
    }
    if (this.state === 'idle') this.y = this.f.h / 2 - BIRD / 2 + Math.sin(this.t * 3) * 6;
  }

  press() {
    if (this.state === 'idle' || this.state === 'ended') this.start();
    else if (this.state === 'paused') { this.resume(); this.flap(); }
    else if (this.state === 'playing') this.flap();
  }

  key(e, down) {
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'arrowup' || k === 'w' || k === 'enter') {
      if (down && !e.repeat) this.press();
      return true;
    }
    if (k === 'p') { if (down) this.toggle(); return true; }
    if (k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright' || k === 'a' || k === 's' || k === 'd') return true;
    return false;
  }

  // pointerdown, not click: a flap must not wait for the finger to lift
  pointer(e) {
    if (e.type === 'pointerdown') this.press();
  }

  draw(c) {
    const { w, h } = this.f;
    const px = this.s.px;
    const r = 22;

    c.strokeStyle = STRUCTURE;
    c.lineWidth = 2 * px;
    roundRect(c, 0, 0, w, h, r);
    c.stroke();

    // everything that moves stays inside the playfield
    c.save();
    roundRect(c, 0, 0, w, h, r);
    c.clip();

    c.strokeStyle = INK;
    c.lineWidth = 4 * px;
    for (const p of this.pipes) {
      const top = p.gap - GAP / 2;
      const bottom = p.gap + GAP / 2;
      roundRect(c, p.x, -40, PIPE, top + 40, 12);
      c.stroke();
      roundRect(c, p.x, bottom, PIPE, h - bottom + 40, 12);
      c.stroke();
    }

    // the bird, nose up on the flap and down in the fall
    const tilt = clamp(this.vy / 700, -0.45, 1.1);
    c.save();
    c.translate(this.x + BIRD / 2, this.y + BIRD / 2);
    c.rotate(this.state === 'idle' ? 0 : tilt);
    c.fillStyle = INK;
    disc(c, 0, 0, BIRD / 2 + 1);
    c.fillStyle = this.s.court;
    disc(c, BIRD * 0.2, -BIRD * 0.16, BIRD * 0.11);
    c.restore();

    c.restore();
  }
}
