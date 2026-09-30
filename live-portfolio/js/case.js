// case.js — a case study page: the menu, the entrance, the title that
// follows the story, and the few things on the page that can be chosen.
//
//   the menu      the index's own (js/nav.js), its pages pointing back into
//                 index.html, with Work marked as the one you are in
//   the entrance  every piece marked data-rise rises into place the first
//                 time it comes into view, on the page's one entrance
//                 (js/motion.js rise), a beat apart, as on the index
//   the title     the pill beside the back button names the part of the
//                 story that holds the middle of the window: the words
//                 trade places in it, the leaving one lifting away as the
//                 arriving one rises in, in the direction you are scrolling,
//                 while the pill stretches or draws in to fit
//   steppers      [data-stepper]: a row of chips (or notes) and a stage;
//                 choosing one shows its panel, with the arrow keys walking
//                 the row. data-auto on a stepper walks it on its own every
//                 few seconds while it is in view, until a hand takes over
//   live boards   .cs-live: a board that runs (canvas.html?parked), drawn at
//                 its own size in a frame and scaled down to its window
//   reading       the back button's ring fills as the page is read (--read)
//   counting      a number marked data-count runs up to itself, once, the
//                 first time its piece rises into view
//   live docs     [data-live]: a window that is the real page, laid over its
//                 still once it is near and scaled down whole; a long one
//                 reads itself (data-live-scroll), one to use takes the
//                 pointer (data-live-use)
//   the run       [data-run]: presses the board's own Run in the hero
//   playback      [data-play]: plays its piece out once it is in view, and
//                 again from its replay button
//   scale         [data-scale]: one slider shrinks the pictures in it together
//
// Nothing here moves the page: it scrolls the browser's own way.

import { initNav } from './nav.js';
import { SPRING, EASE, animate, rise, reduced } from './motion.js';

const root = document.documentElement;
const title = document.querySelector('.cs-title');

// ---- the menu ----
const nav = initNav(document.querySelector('.menu'), { clearOf: title });
nav.setCurrent('work');

// ---- the entrance ----
root.classList.add('rises');
let booting = true;
const riser = new IntersectionObserver((entries) => {
  const now = entries.filter((e) => e.isIntersecting).map((e) => e.target);
  if (!now.length) return;
  for (const el of now) {
    riser.unobserve(el);
    el.classList.add('is-risen');
    el.querySelectorAll('[data-count]').forEach(countUp);
  }
  rise(now, { delay: booting ? 120 : 30, stagger: 60 });
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
for (const el of document.querySelectorAll('[data-rise]')) riser.observe(el);
requestAnimationFrame(() => setTimeout(() => { booting = false; }, 400));

// A number runs up to itself on the settle spring's clock, easing out as a
// thrown thing slows, and then its own text goes back, so what it says is
// always what the page says. The digits are tabular (css/case.css), so the
// word beside them never shuffles as they turn over.
function countUp(el) {
  const to = Number(el.dataset.count);
  if (!Number.isFinite(to) || reduced()) return;
  const text = el.textContent;
  const t0 = performance.now();
  const dur = 1100;
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = String(Math.round(to * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(tick);
    else el.textContent = text;
  };
  requestAnimationFrame(tick);
}

// ---- reading ----
// How much of the story is behind you, as a ring round the back button
// (css/case.css .cs-back::before), painted once a frame at most.
const backButton = document.querySelector('.cs-back');
if (backButton) {
  let frame = 0;
  const paintRead = () => {
    frame = 0;
    const max = root.scrollHeight - innerHeight;
    const read = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    backButton.style.setProperty('--read', read.toFixed(4));
  };
  addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(paintRead); }, { passive: true });
  addEventListener('resize', paintRead);
  paintRead();
}

// ---- the title follows the story ----
// The pill is as wide as its word: the next word is measured off a hidden
// copy in the same type before it arrives, so the pill can be on its way to
// the new width while the words cross.
const pad = () => parseFloat(getComputedStyle(title).paddingLeft) || 0;
const measurer = document.createElement('span');
measurer.setAttribute('aria-hidden', 'true');
measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none';
title.append(measurer);
function widthOf(text) {
  measurer.textContent = text;
  return measurer.getBoundingClientRect().width;
}
let word = title.querySelector('.cs-title-word');
let current = word.textContent;
let lastY = scrollY;
function fitTitle({ still = false } = {}) {
  if (still) title.style.transition = 'none';
  title.style.width = `${widthOf(current) + 2 * pad()}px`;
  if (still) { void title.offsetWidth; title.style.transition = ''; }
}
function setTitle(text) {
  if (text === current) return;
  const dir = scrollY >= lastY ? 1 : -1;
  current = text;
  fitTitle();
  const leaving = word;
  const arriving = document.createElement('span');
  arriving.className = 'cs-title-word';
  arriving.textContent = text;
  title.insertBefore(arriving, measurer);
  word = arriving;
  const d = 10 * dir;
  animate(leaving, [
    { opacity: 1, translate: '0 0', filter: 'blur(0px)' },
    { opacity: 0, translate: `0 ${-d}px`, filter: 'blur(3px)' },
  ], { duration: 200, easing: EASE.exit, fill: 'forwards' }).finished.then(() => leaving.remove(), () => leaving.remove());
  animate(arriving, [
    { opacity: 0, translate: `0 ${d}px`, filter: 'blur(3px)' },
    { opacity: 1, translate: '0 0', filter: 'blur(0px)' },
  ], { ...SPRING.settle, delay: 60, fill: 'backwards' });
}
const sections = [...document.querySelectorAll('[data-title]')];
const spy = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) setTitle(e.target.dataset.title);
  lastY = scrollY;
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach((s) => spy.observe(s));
document.fonts?.ready.then(() => fitTitle({ still: true }));
fitTitle({ still: true });
addEventListener('resize', () => fitTitle({ still: true }));

// ---- steppers ----
for (const stepper of document.querySelectorAll('[data-stepper]')) {
  const tabs = [...stepper.querySelectorAll('[data-step]')];
  const panels = [...stepper.querySelectorAll('[data-panel]')];
  const marks = [...stepper.querySelectorAll('[data-mark]')];
  let index = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));
  let timer = 0;
  let handled = false;

  function choose(i, { focus = false } = {}) {
    index = (i + tabs.length) % tabs.length;
    tabs.forEach((t, n) => {
      t.setAttribute('aria-selected', String(n === index));
      t.tabIndex = n === index ? 0 : -1;
    });
    const key = tabs[index].dataset.step;
    panels.forEach((p) => p.toggleAttribute('data-on', p.dataset.panel === key));
    marks.forEach((m) => m.toggleAttribute('data-on', m.dataset.mark === key));
    if (focus) tabs[index].focus({ preventScroll: true });
  }
  function takeOver() { handled = true; clearInterval(timer); }
  tabs.forEach((t, n) => {
    t.addEventListener('click', () => { takeOver(); choose(n); });
    t.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      takeOver();
      choose(index + step, { focus: true });
    });
  });
  // a pointer on the stage stops the walk too: someone is looking
  stepper.addEventListener('pointerenter', () => { if (stepper.hasAttribute('data-auto')) clearInterval(timer); });
  stepper.addEventListener('pointerleave', () => { if (!handled) walk(); });
  function walk() {
    clearInterval(timer);
    if (handled || reduced() || !stepper.hasAttribute('data-auto')) return;
    timer = setInterval(() => choose(index + 1), Number(stepper.dataset.auto) || 3600);
  }
  if (stepper.hasAttribute('data-auto')) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) walk();
      else clearInterval(timer);
    }, { threshold: 0.35 }).observe(stepper);
  }
  choose(index);
}

// ---- live boards ----
for (const box of document.querySelectorAll('.cs-live')) {
  const frame = box.querySelector('iframe');
  const w = parseFloat(getComputedStyle(box).getPropertyValue('--live-w')) || 1100;
  const fit = () => { frame.style.scale = String(box.clientWidth / w); };
  new ResizeObserver(fit).observe(box);
  fit();
  // the board frames itself a beat after it loads; it is shown once it has
  frame.addEventListener('load', () => setTimeout(() => frame.classList.add('is-ready'), 500));
}

// ---- live documents ----
// The page is drawn at its own width (data-live-w) and scaled to its window,
// so it lays itself out exactly as it does in a tab, and the still under it
// holds the window's shape until the page has painted.
for (const box of document.querySelectorAll('[data-live]')) {
  const w = Number(box.dataset.liveW) || 1280;
  let frame = null;
  const fit = () => {
    if (!frame) return;
    const k = box.clientWidth / w;
    frame.style.scale = String(k);
    frame.style.height = `${box.clientHeight / k}px`;
  };
  const load = () => {
    frame = document.createElement('iframe');
    frame.src = box.dataset.live;
    frame.title = box.dataset.liveTitle || '';
    frame.style.width = `${w}px`;
    if (!box.hasAttribute('data-live-use')) {
      // a picture that runs: not a stop for the keyboard, nor for a reader
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
    }
    box.append(frame);
    fit();
    frame.addEventListener('load', () => {
      setTimeout(() => {
        frame.classList.add('is-ready');
        box.classList.add('is-live');
        if (box.hasAttribute('data-live-scroll')) drift(box, frame);
      }, 250);
    }, { once: true });
  };
  new ResizeObserver(fit).observe(box);
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    load();
  }, { rootMargin: '700px 0px' }).observe(box);
}

// A long page reads itself: down at an easy reading pace while it is in
// view, a breath at the foot, back up to the top, and on again. A pointer on
// it, or focus in it, holds it where it is; so does reduced motion, where it
// is simply the top of the page.
function drift(box, frame) {
  const doc = frame.contentDocument?.scrollingElement;
  if (!doc || reduced()) return;
  const SPEED = 0.045;   // page pixels a millisecond
  let y = 0;
  let wait = 1400;       // a beat on the top before it starts
  let held = false;
  let seen = false;
  let raf = 0;
  let last = 0;
  const hold = (on) => { held = on; };
  box.addEventListener('pointerenter', () => hold(true));
  box.addEventListener('pointerleave', () => hold(false));
  box.addEventListener('focusin', () => hold(true));
  box.addEventListener('focusout', () => hold(false));
  const tick = (t) => {
    raf = 0;
    const dt = last ? Math.min(64, t - last) : 16;
    last = t;
    if (!held) {
      const max = doc.scrollHeight - doc.clientHeight;
      if (wait > 0) wait -= dt;
      else if (y >= max) {
        doc.scrollTo({ top: 0, behavior: 'smooth' });
        y = 0;
        wait = 2600;
      } else {
        y = Math.min(max, y + dt * SPEED);
        doc.scrollTo({ top: y, behavior: 'instant' });
        if (y >= max) wait = 2200;
      }
    } else {
      y = doc.scrollTop;
    }
    if (seen) raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([e]) => {
    seen = e.isIntersecting;
    last = 0;
    if (seen && !raf) raf = requestAnimationFrame(tick);
  }, { threshold: 0.2 }).observe(box);
}

// ---- the run ----
// The hero's board is the replica (canvas.html?parked), same-origin, so the
// pill can press its own Run: every node goes back to queued and the ladder
// walks the graph, stage by stage, until the frames, the clip and the mesh
// land again. The pill says what the board is doing while it does it.
for (const pill of document.querySelectorAll('[data-run]')) {
  const frame = document.querySelector(pill.dataset.run);
  const word = pill.querySelector('span');
  pill.addEventListener('click', () => {
    const board = frame?.contentWindow?.VicinoCanvas;
    if (!board || pill.classList.contains('is-running')) return;
    pill.classList.add('is-running');
    word.textContent = 'Running';
    board.run();
    // the board has no event for done; the board itself wears is-running
    // for exactly as long as a run lasts
    const started = performance.now();
    const check = () => {
      const busy = frame.contentDocument.getElementById('vc')?.classList.contains('is-running');
      if (busy || performance.now() - started < 400) return setTimeout(check, 150);
      pill.classList.remove('is-running');
      word.textContent = 'Run it again';
    };
    setTimeout(check, 150);
  });
}

// ---- playback ----
for (const piece of document.querySelectorAll('[data-play]')) {
  const play = () => {
    piece.classList.remove('is-playing');
    void piece.offsetWidth;
    piece.classList.add('is-playing');
  };
  if (reduced()) continue;
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    play();
  }, { threshold: 0.45 }).observe(piece);
  piece.querySelector('[data-replay]')?.addEventListener('click', play);
}

// ---- scale ----
// One slider sets every picture's size at once (--s, in frame pixels), and
// on its first sight sweeps down to a favicon and back, once, so the point
// is made before anyone touches it.
for (const piece of document.querySelectorAll('[data-scale]')) {
  const input = piece.querySelector('input[type="range"]');
  const out = piece.querySelector('output');
  const set = (v) => {
    piece.style.setProperty('--s', String(v));
    const p = (v - input.min) / (input.max - input.min);
    input.style.setProperty('--p', `${(p * 100).toFixed(1)}%`);
    out.textContent = `${Math.round(v)} px`;
  };
  // a hand on the slider ends the sweep, for good
  let swept = false;
  input.addEventListener('input', () => { swept = true; set(Number(input.value)); });
  set(Number(input.value));
  if (reduced()) continue;
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting || swept) return;
    io.disconnect();
    const from = Number(input.value);
    const low = Number(piece.dataset.scaleLow || input.min);
    const t0 = performance.now();
    const dur = 3200;
    const tick = (t) => {
      if (swept) return;
      const k = Math.min(1, (t - t0) / dur);
      // down to the favicon over the first half, a rest, and back up
      const phase = k < 0.45 ? k / 0.45 : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      const ease = phase < 0.5 ? 2 * phase * phase : 1 - (-2 * phase + 2) ** 2 / 2;
      const v = from + (low - from) * ease;
      input.value = String(v);
      set(v);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { threshold: 0.6 }).observe(piece);
}
