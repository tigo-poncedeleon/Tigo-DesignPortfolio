// play/pong.js — Atari, 1972, in ink on pink.
//
// The rules and every number are the live game's (live-portfolio/js/pong.js
// :11-20 and :110-164). They were tuned there and are only redrawn here.
//   paddles 21 × 81, 31 in from the court's edge; the ball is 21
//   you: 460px/s on the keys, or drag the paddle directly
//   the computer: chases at 360, drifts home at 120, aims with a ±22px error
//     re-rolled on every serve and every hit, and eases into its speed —
//     desired = clamp(gap × 8), v += (desired − v) × min(1, dt × 12) — so
//     it is good, and beatable
//   serve 420 at up to ±20°; every hit ×1.045, up to 900
//   where the ball meets the paddle sets its angle, up to 55° at the tips
//   collisions are swept along x, so a fast ball cannot pass through a face
// One point per game, as on the live site; the record is the RALLY, the hits
// by both paddles in that point.
//
// The court is 1092 × 376 on the stage, the live court's shape. In a card it
// is near-square (560 × 420), which keeps both paddles in view, and the demo
// rally's speeds scale with the width.

import { Game, INK, STRUCTURE, roundRect, capsule, disc, clamp } from './engine.js';

const PW = 21;
const PH = 81;
const BALL = 21;
const INSET = 31;
const PLAYER = 460;
const AI_CHASE = 360;
const AI_HOME = 120;
const SERVE = 420;
const SPEEDUP = 1.045;
const MAX = 900;
const MAX_ANGLE = (55 * Math.PI) / 180;
const SERVE_ANGLE = (20 * Math.PI) / 180;
const AIM = 22;

export default class Pong extends Game {
  static id = 'pong';
  static field = { w: 1092, h: 376 };
  static demoField = { w: 560, h: 420 };

  reset() {
    const { h } = this.f;
    // the demo is the live one's calmer two-computer rally, scaled to its court
    this.k = this.isDemo ? (this.f.w / 1092) * 0.8 : 1;
    this.left = { y: (h - PH) / 2, v: 0, aim: 0 };   // the computer
    this.right = { y: (h - PH) / 2, v: 0, aim: 0 };  // you (or, in the demo, the other computer)
    this.ball = { x: (this.f.w - BALL) / 2, y: (h - BALL) / 2, vx: 0, vy: 0 };
    this.score = 0;
    this.up = false;
    this.down = false;
    this.grab = null;
    this.wait = this.isDemo ? 0.5 : 0;
    this.winner = null;
  }

  begin() { this.serve(-1); }

  serve(dir) {
    const a = (Math.random() * 2 - 1) * SERVE_ANGLE * (this.isDemo ? 0.9 : 1);
    const v = SERVE * this.k * (this.isDemo ? 0.8 : 1);
    this.ball.vx = dir * Math.cos(a) * v;
    this.ball.vy = Math.sin(a) * v;
    this.reaim();
  }
  reaim() {
    this.left.aim = (Math.random() * 2 - 1) * AIM;
    this.right.aim = (Math.random() * 2 - 1) * AIM;
  }

  ai(p, side, dt, chaseCap, homeCap) {
    const b = this.ball;
    const toward = side === 'left' ? b.vx < 0 : b.vx > 0;
    const target = toward ? b.y + BALL / 2 + p.aim : this.f.h / 2;
    const cap = (toward ? chaseCap : homeCap) * this.k;
    const desired = clamp((target - (p.y + PH / 2)) * 8, -cap, cap);
    p.v += (desired - p.v) * Math.min(1, dt * 12);
    p.y = clamp(p.y + p.v * dt, 0, this.f.h - PH);
  }

  step(dt) {
    // you
    if (this.grab != null) {
      this.right.y = clamp(this.grab - PH / 2, 0, this.f.h - PH);
    } else {
      const dir = (this.down ? 1 : 0) - (this.up ? 1 : 0);
      this.right.y = clamp(this.right.y + dir * PLAYER * dt, 0, this.f.h - PH);
    }
    this.ai(this.left, 'left', dt, AI_CHASE, AI_HOME);
    this.move(dt);
  }

  demo(dt) {
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) this.serve(Math.random() < 0.5 ? -1 : 1);
    }
    this.ai(this.left, 'left', dt, 250, 90);
    this.ai(this.right, 'right', dt, 250, 90);
    this.move(dt);
  }

  move(dt) {
    const b = this.ball;
    const { w, h } = this.f;
    const px = b.x;
    const py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.y < 0) { b.y = -b.y; b.vy = Math.abs(b.vy); }
    if (b.y > h - BALL) { b.y = 2 * (h - BALL) - b.y; b.vy = -Math.abs(b.vy); }

    // swept: did the ball's leading edge cross a paddle's face this frame?
    const lf = INSET + PW;
    if (b.vx < 0 && px >= lf && b.x < lf) {
      const y = py + (b.y - py) * ((px - lf) / (px - b.x));
      if (y + BALL > this.left.y && y < this.left.y + PH) this.hit(this.left, 1, lf, y);
    }
    const rf = w - INSET - PW - BALL;
    if (b.vx > 0 && px <= rf && b.x > rf) {
      const y = py + (b.y - py) * ((rf - px) / (b.x - px));
      if (y + BALL > this.right.y && y < this.right.y + PH) this.hit(this.right, -1, rf, y);
    }

    if (b.x + BALL < 0) this.point('right');
    else if (b.x > w) this.point('left');
  }

  hit(p, dir, x, y) {
    const b = this.ball;
    const offset = clamp((y + BALL / 2 - (p.y + PH / 2)) / (PH / 2 + BALL / 2), -1, 1);
    const angle = offset * MAX_ANGLE;
    const speed = Math.min(MAX * this.k, Math.hypot(b.vx, b.vy) * SPEEDUP);
    b.vx = dir * Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.x = x;
    b.y = y;
    this.reaim();
    if (!this.isDemo) {
      this.score += 1;
      this.emit();
    }
  }

  point(winner) {
    if (this.isDemo) {
      this.ball = { x: (this.f.w - BALL) / 2, y: (this.f.h - BALL) / 2, vx: 0, vy: 0 };
      this.wait = 0.6;
      return;
    }
    this.winner = winner === 'right' ? 'you' : 'computer';
    this.end({ won: winner === 'right' });
  }

  key(e, down) {
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') { this.up = down; this.grab = null; return true; }
    if (k === 'arrowdown' || k === 's') { this.down = down; this.grab = null; return true; }
    if (k === 'arrowleft' || k === 'arrowright' || k === 'a' || k === 'd') return true;
    if (k === ' ' || k === 'enter') { if (down && !e.repeat) this.toggle(); return true; }
    return false;
  }

  pointer(e) {
    if (e.type === 'pointerdown') {
      if (this.state === 'idle' || this.state === 'ended') { this.start(); return; }
      if (this.state === 'paused') { this.resume(); }
    }
    if (e.type === 'pointerup' || e.type === 'pointercancel') { this.grab = null; return; }
    if (e.buttons || e.pointerType !== 'mouse' || e.type === 'pointerdown') {
      this.grab = this.s.toField(e.clientX, e.clientY).y;
    }
  }

  draw(c) {
    const { w, h } = this.f;
    const px = this.s.px;
    // the court: an outline in the structure ink, the ball's walls
    c.strokeStyle = STRUCTURE;
    c.lineWidth = 2 * px;
    roundRect(c, -14, -14, w + 28, h + 28, 24);
    c.stroke();
    c.setLineDash([10, 14]);
    c.beginPath();
    c.moveTo(w / 2, 8);
    c.lineTo(w / 2, h - 8);
    c.stroke();
    c.setLineDash([]);

    c.fillStyle = INK;
    capsule(c, INSET, this.left.y, PW, PH);
    capsule(c, w - INSET - PW, this.right.y, PW, PH);
    const b = this.ball;
    if (this.state !== 'ended' || (b.x > -BALL && b.x < w)) disc(c, b.x + BALL / 2, b.y + BALL / 2, BALL / 2);
  }
}
