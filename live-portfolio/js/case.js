// case.js — a case study page: the menu, the entrance, the rail that
// follows the story, and the few things on the page that can be chosen.
//
//   the menu      the index's own (js/nav.js), its pages pointing back into
//                 index.html, with Work marked as the one you are in
//   the entrance  every piece marked data-rise rises into place the first
//                 time it comes into view, on the page's one entrance
//                 (js/motion.js rise), a beat apart, as on the index
//   steppers      [data-stepper]: a row of chips (or notes) and a stage;
//                 choosing one shows its panel, with the arrow keys walking
//                 the row. data-auto on a stepper walks it on its own every
//                 few seconds while it is in view, until a hand takes over
//   live boards   .cs-live: a board that runs (canvas.html?parked), drawn at
//                 its own size in a frame and scaled down to its window
//   reading       the back button's ring fills as the page is read (--read)
//   the rail      every chapter, listed in the lane's left margin in its
//                 case's own dress, built from the chapters' own openers:
//                 the one being read marked, the ones before it done, and a
//                 runner (a hat, a spark, a drone) travelling to it
//   counting      a number marked data-odo rolls up to itself as an
//                 odometer does, once, the first time its piece rises into
//                 view
//   zoom          a picture marked data-zoom opens out to the window, the
//                 picture itself growing into it where the browser can
//   the light     a lit tile is lit again from wherever the pointer is
//   live docs     [data-live]: a window that is the real page, laid over its
//                 still once it is near and scaled down whole; a long one
//                 reads itself (data-live-scroll), one to use takes the
//                 pointer (data-live-use)
//   the run       [data-run]: presses the board's own Run in the hero
//   the way in    .cs-hero-go: the hero's work is a link to it, and a chip
//                 trails the pointer over it saying where it goes
//   the fan       [data-fan]: PantryPal's phones; one at the back, pressed,
//                 comes to the front
//   playback      [data-play]: plays its piece out once it is in view, and
//                 again from its replay button
//   scale         [data-scale]: one slider shrinks the pictures in it together
//
// Nothing here moves the page: it scrolls the browser's own way.

import { initNav } from './nav.js';
import { rise, reduced } from './motion.js';

const root = document.documentElement;

// ---- the menu ----
// its row of pages opens beside the square if it clears the back button,
// the one thing on the masthead's left now
const nav = initNav(document.querySelector('.menu'), { clearOf: document.querySelector('.cs-back') });
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
    el.querySelectorAll('.cs-odo').forEach((o) => o.classList.add('is-rolled'));
  }
  rise(now, { delay: booting ? 120 : 30, stagger: 60 });
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
for (const el of document.querySelectorAll('[data-rise]')) riser.observe(el);
requestAnimationFrame(() => setTimeout(() => { booting = false; }, 400));

// An odometer: every digit of the number becomes a column of the ten digits,
// twice over, that rolls once round and stops on its own when the piece
// rises (css/case.css .cs-odo). What it says stays in the page as text for a
// reader; the columns are only a picture of it. Built before anything is in
// view, so a number never changes width as it rolls. Under reduced motion it
// is simply the number. (The numbers used to count up as text, a frame at a
// time, which a reader heard as a run of numbers and the eye saw jitter.)
function odometer(el) {
  const text = el.textContent.trim();
  el.textContent = '';
  const said = document.createElement('span');
  said.className = 'sr-only';
  said.textContent = text;
  const shown = document.createElement('span');
  shown.className = 'cs-odo';
  shown.setAttribute('aria-hidden', 'true');
  let k = 0;
  for (const ch of text) {
    if (!/\d/.test(ch)) {
      shown.append(document.createTextNode(ch));
      continue;
    }
    const d = document.createElement('span');
    d.className = 'cs-odo-d';
    const strip = document.createElement('span');
    for (let n = 0; n < 20; n++) {
      const g = document.createElement('span');
      g.textContent = String(n % 10);
      strip.append(g);
    }
    d.style.setProperty('--to', String(10 + Number(ch)));
    d.style.setProperty('--k', String(k++));
    d.append(strip);
    shown.append(d);
  }
  el.append(said, shown);
}
if (!reduced()) document.querySelectorAll('[data-odo]').forEach(odometer);

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

// ---- the rail ----
// Every chapter, read off the chapters' own openers (a section whose id its
// parts name in data-chapter), so the list is never written twice; a part of
// a chapter marks its chapter. It is the one thing on the page that says
// where you are (the masthead carries no title: there was a pill beside the
// back button that named the part being read, until Tigo wanted its room
// back), and it stands in the lane's left margin under the back button. It
// is put in the page right after the opening tile, so it comes up from under
// the tile's foot as the tile scrolls away, and then holds its place
// (css/case.css "the rail", position: sticky).
//
// Each case dresses it in its own product (css/case.css): PantryPal's is the
// app's recipe, its steps ticked off and the chef's hat on the one being
// read; Vicino's is a run down a pipeline of nodes, a spark on the wire;
// Next Level's is a flight plan, the drone flying it. Here the rail only says
// which chapter is being read (aria-current), which went before it
// (is-done), where the runner is to stand (--y, down the list), which way it
// is going there (data-heading), and how far through the story you are (the
// count in its head). Before the first chapter (the opening tile, the
// overview) nothing is current; past the last (the foot) everything is done.
const frameEl = document.querySelector('.frame.cs');
const rail = document.createElement('nav');
rail.className = 'cs-rail';
rail.setAttribute('aria-label', 'Chapters');
rail.innerHTML = '<div class="cs-rail-in">'
  + '<p class="cs-rail-head" aria-hidden="true"><span class="cs-rail-title"></span><span class="cs-rail-count"><b>0</b>/<span></span></span></p>'
  + '<ol class="cs-rail-list" role="list"></ol>'
  + '<span class="cs-rail-runner" aria-hidden="true"><i></i></span>'
  + '</div>';
const railIn = rail.firstElementChild;
const railList = rail.querySelector('.cs-rail-list');
const railCount = rail.querySelector('.cs-rail-count b');
rail.querySelector('.cs-rail-title').textContent = frameEl?.dataset.rail || 'Chapters';
const railLinks = [];
for (const sec of document.querySelectorAll('.cs-sec[id]:not(.is-part)')) {
  if (!sec.querySelector('.cs-chapter')) continue;
  const num = sec.querySelector('.cs-chapter-num');
  const n = num && !num.classList.contains('is-word') ? num.textContent.trim() : '';
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = `#${sec.id}`;
  a.dataset.chapter = sec.id;
  // the number is drawn in its own cell; a reader hears it with the name
  a.innerHTML = `<span class="cs-rail-num" aria-hidden="true">${n}</span>`
    + `<span class="cs-rail-name">${n ? `<span class="sr-only">${n} </span>` : ''}${sec.dataset.title}</span>`
    + '<i class="cs-rail-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5.5 12.5 4 4 9-9" /></svg></i>';
  li.append(a);
  railList.append(li);
  railLinks.push(a);
}
rail.querySelector('.cs-rail-count > span').textContent = String(railLinks.length);

let at = -1;
let moving = 0;
// Where the runner stands (--y): the middle of the chapter being read, or of
// the last once the story is over. The first chapter's middle and the last's
// (--y0, --y1) are where a case's wire or flight path begins and ends.
function placeRunner() {
  if (!railLinks.length) return;
  const top = railIn.getBoundingClientRect().top;
  const mid = (a) => `${(a.getBoundingClientRect().top - top + a.offsetHeight / 2).toFixed(1)}px`;
  railIn.style.setProperty('--y0', mid(railLinks[0]));
  railIn.style.setProperty('--y1', mid(railLinks[railLinks.length - 1]));
  railIn.style.setProperty('--y', mid(railLinks[Math.min(Math.max(at, 0), railLinks.length - 1)]));
}
function setChapter(i) {
  if (i === at) return;
  const from = at;
  at = i;
  railLinks.forEach((a, k) => {
    if (k === i) a.setAttribute('aria-current', 'step');
    else a.removeAttribute('aria-current');
    a.classList.toggle('is-done', k < i);
  });
  railCount.textContent = String(Math.max(0, Math.min(i + 1, railLinks.length)));
  rail.classList.toggle('is-started', i >= 0);
  rail.classList.toggle('is-finished', i >= railLinks.length);
  if (i < 0) return;
  placeRunner();
  // a runner that was already out travels, and leans or hops as it goes
  if (from >= 0 && !reduced()) {
    rail.dataset.heading = i > from ? 'down' : 'up';
    rail.classList.remove('is-moving');
    void rail.offsetWidth;
    rail.classList.add('is-moving');
    clearTimeout(moving);
    moving = setTimeout(() => rail.classList.remove('is-moving'), 900);
  }
}
const chapterOf = (el) => {
  if (el.dataset.chapter) return railLinks.findIndex((a) => a.dataset.chapter === el.dataset.chapter);
  return el.matches('.cs-end') ? railLinks.length : -1;
};
const spy = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) setChapter(chapterOf(e.target));
}, { rootMargin: '-45% 0px -50% 0px' });
if (railLinks.length) {
  document.querySelector('.cs-hero')?.after(rail);
  placeRunner();
  new ResizeObserver(placeRunner).observe(railIn);
  document.fonts?.ready.then(placeRunner);
  for (const s of document.querySelectorAll('[data-title]')) spy.observe(s);
}

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
// Drawn at the board's own width and scaled to the window, and as tall as
// the window is at that scale: the hero's window is taller than the
// board's own shape wherever the window is, and the board frames itself
// in whatever it is given.
for (const box of document.querySelectorAll('.cs-live')) {
  const frame = box.querySelector('iframe');
  const w = parseFloat(getComputedStyle(box).getPropertyValue('--live-w')) || 1100;
  const fit = () => {
    const k = box.clientWidth / w;
    frame.style.scale = String(k);
    frame.style.height = `${box.clientHeight / k}px`;
  };
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

// ---- the way in ----
// The hero's work is a link to the work itself (.cs-hero-go). Pointed at,
// a chip saying where it goes trails the pointer across it, a little
// behind, as the light does, and swings to the pointer's other side
// rather than run off the tile; under reduced motion it keeps up exactly.
// A phone cannot point, and has no chip (css/case.css).
if (matchMedia('(hover: hover)').matches) {
  for (const art of document.querySelectorAll('.cs-hero-go')) {
    const cue = art.querySelector('.cs-hero-cue');
    if (!cue) continue;
    const tile = art.closest('.cs-hero-tile');
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
    const step = () => {
      const k = reduced() ? 1 : 0.2;
      x += (tx - x) * k;
      y += (ty - y) * k;
      if (Math.abs(tx - x) + Math.abs(ty - y) < 0.4) { x = tx; y = ty; }
      cue.style.translate = `${x}px ${y}px`;
      raf = x === tx && y === ty ? 0 : requestAnimationFrame(step);
    };
    const follow = (e, jump) => {
      const r = art.getBoundingClientRect();
      const room = tile.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      // below and to the right of the arrow, clear of it, unless that runs
      // past the tile's edge or its foot
      tx = e.clientX + 16 + cue.offsetWidth > room.right - 12 ? px - 12 - cue.offsetWidth : px + 16;
      ty = e.clientY + 22 + cue.offsetHeight > room.bottom - 12 ? py - 14 - cue.offsetHeight : py + 22;
      if (jump) { x = tx; y = ty; }
      if (!raf) raf = requestAnimationFrame(step);
    };
    art.addEventListener('pointerenter', (e) => { follow(e, true); art.classList.add('is-pointed'); });
    art.addEventListener('pointermove', (e) => follow(e, false));
    art.addEventListener('pointerleave', () => art.classList.remove('is-pointed'));
  }
}

// ---- the fan ----
// PantryPal's three phones, in three slots: one in front and one either
// side behind. Pressing one at the back turns the three round, keeping
// their order, so it comes to the front, the one that was in front steps
// back to the side it is going to, and the third goes round behind them
// both (css/case.css places each by its slot, so a turn is one
// transition).
const SLOTS = ['left', 'front', 'right'];
for (const fan of document.querySelectorAll('[data-fan]')) {
  const phones = [...fan.querySelectorAll('[data-slot]')];
  let settle = 0;
  fan.addEventListener('click', (e) => {
    const picked = e.target.closest('[data-slot]');
    if (!picked || picked.dataset.slot === 'front') return;
    // the one on the left comes forward by everyone moving one to the right
    const step = picked.dataset.slot === 'left' ? 1 : -1;
    clearTimeout(settle);
    for (const phone of phones) {
      const was = phone.dataset.slot;
      const now = SLOTS[(SLOTS.indexOf(was) + step + SLOTS.length) % SLOTS.length];
      phone.classList.toggle('was-front', was === 'front');
      phone.dataset.slot = now;
      phone.setAttribute('aria-pressed', String(now === 'front'));
    }
    settle = setTimeout(() => phones.forEach((p) => p.classList.remove('was-front')), 700);
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

// ---- zoom ----
// One dialog for the page. A press on a picture marked data-zoom opens it at
// the size of the window over a frosted page; where the browser can carry a
// view, the picture itself grows out of its place into the dialog and shrinks
// back into it on the way out. Its words (its alt, or data-zoom-cap) stand
// under it, small. A press anywhere, Escape, or the close button puts it back.
const zoomables = [...document.querySelectorAll('[data-zoom]')];
if (zoomables.length) {
  const dialog = document.createElement('dialog');
  dialog.className = 'cs-zoom';
  dialog.setAttribute('aria-label', 'Picture, opened out');
  dialog.innerHTML = '<img alt="" /><p class="cs-zoom-cap"></p>'
    + '<button type="button" class="cs-zoom-close" aria-label="Close"><svg viewBox="-2 -2 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button>';
  document.body.append(dialog);
  const big = dialog.querySelector('img');
  const cap = dialog.querySelector('.cs-zoom-cap');
  let from = null;
  const carry = () => document.startViewTransition && !reduced();
  const name = (el, on) => { el.style.viewTransitionName = on ? 'cs-zoom' : ''; };

  async function open(img) {
    from = img;
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    big.classList.toggle('is-phone', img.classList.contains('cs-phone') || img.hasAttribute('data-zoom-phone'));
    cap.textContent = img.dataset.zoomCap || img.alt || '';
    if (!carry()) { dialog.showModal(); return; }
    // the same file as the one pressed, so it is cached; decoded first, or
    // the carried view would grow out of an empty frame
    await big.decode().catch(() => {});
    name(img, true);
    const t = document.startViewTransition(() => {
      name(img, false);
      name(big, true);
      dialog.showModal();
    });
    t.finished.finally(() => name(big, false));
  }
  function shut() {
    if (!dialog.open) return;
    if (!carry() || !from?.isConnected) { dialog.close(); return; }
    name(big, true);
    const back = from;
    const t = document.startViewTransition(() => {
      name(big, false);
      name(back, true);
      dialog.close();
    });
    t.finished.finally(() => name(back, false));
  }
  for (const img of zoomables) {
    // a picture to open is a control: say so, and let a keyboard open it
    if (!img.closest('a, button')) {
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', `Open the picture: ${img.alt || 'enlarge'}`);
    }
    img.addEventListener('click', (e) => { e.preventDefault(); open(img); });
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
    });
  }
  dialog.addEventListener('click', shut);
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); shut(); });
  dialog.addEventListener('close', () => from?.focus({ preventScroll: true }));
}

// ---- the light ----
// Which lit tile the pointer is over, and where on it, written once a frame
// as --mx and --my (css/case.css .cs-lit::before). Only a pointer that hovers
// lights anything: a finger lifts off the glass.
if (matchMedia('(hover: hover)').matches) {
  let lit = null;
  let px = 0;
  let py = 0;
  let queued = 0;
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    lit = e.target.closest?.('.cs-lit') || null;
    if (!lit) return;
    px = e.clientX;
    py = e.clientY;
    if (queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      if (!lit) return;
      const r = lit.getBoundingClientRect();
      lit.style.setProperty('--mx', `${(px - r.left).toFixed(1)}px`);
      lit.style.setProperty('--my', `${(py - r.top).toFixed(1)}px`);
    });
  }, { passive: true });
}

// ---- belts ----
// [data-belts] deals the pictures in the list beside it (.cs-belt-src, which
// stays for a reader) onto three belts that run against each other. Each row
// is doubled, so a run of one copy's width comes back to where it began and
// the belt never shows a seam. The copies are only pictures.
for (const belts of document.querySelectorAll('[data-belts]')) {
  const src = belts.parentElement.querySelector('.cs-belt-src');
  if (!src) continue;
  const pics = [...src.querySelectorAll('img')];
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const belt = document.createElement('div');
    belt.className = 'cs-belt';
    const row = document.createElement('div');
    row.className = `cs-belt-row${r % 2 ? ' is-back' : ''}`;
    row.style.setProperty('--dur', `${64 + r * 14}s`);
    const mine = pics.filter((_, i) => i % rows === r);
    for (const pass of [0, 1]) {
      for (const p of mine) {
        const img = p.cloneNode();
        img.alt = '';
        img.loading = pass ? 'lazy' : p.loading;
        row.append(img);
      }
    }
    belt.append(row);
    belts.append(belt);
  }
}

// ---- the flip ----
// [data-flip]: a two-way switch (role radio) in its head turns every screen
// in the row over to the other face, the cards turning one after another
// (css/case.css .cs-flip). The arrow keys move along the switch, as they do
// along any radio group. Once in view it turns over by itself once, a beat
// in, to show there is another side, unless a hand has got there first.
for (const flip of document.querySelectorAll('[data-flip]')) {
  const options = [...flip.querySelectorAll('[data-show]')];
  const fronts = [...flip.querySelectorAll('.is-front')];
  const backs = [...flip.querySelectorAll('.is-back')];
  let touched = false;
  const show = (which, { focus = false } = {}) => {
    flip.dataset.show = which;
    options.forEach((o) => {
      const on = o.dataset.show === which;
      o.setAttribute('aria-checked', String(on));
      o.tabIndex = on ? 0 : -1;
      if (on && focus) o.focus();
    });
    // the face turned away is neither read nor reached: only the screens
    // showing are pictures to open (the first option is the front)
    const front = which === options[0].dataset.show;
    for (const [face, up] of [[fronts, front], [backs, !front]]) {
      for (const img of face) {
        // (written out: an empty aria-hidden is read as not hidden at all)
        if (up) img.removeAttribute('aria-hidden');
        else img.setAttribute('aria-hidden', 'true');
        if (img.hasAttribute('data-zoom')) img.tabIndex = up ? 0 : -1;
      }
    }
  };
  options.forEach((o, n) => {
    o.addEventListener('click', () => { touched = true; show(o.dataset.show); });
    o.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      touched = true;
      show(options[(n + step + options.length) % options.length].dataset.show, { focus: true });
    });
  });
  show(options.find((o) => o.getAttribute('aria-checked') === 'true')?.dataset.show || options[0].dataset.show);
  if (reduced()) continue;
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const first = flip.dataset.show;
    const other = options.find((o) => o.dataset.show !== first)?.dataset.show;
    setTimeout(() => { if (!touched) show(other); }, 1400);
    setTimeout(() => { if (!touched) show(first); }, 4200);
  }, { threshold: 0.55 }).observe(flip);
}

// ---- the reel ----
// [data-reel]: on a wide window the reel's view stands still in the window
// (css position: sticky) for as long as it takes to pan the whole row across
// it, and the row's offset is read straight off how far the page has been
// scrolled through that stretch: down moves it left, up moves it back. The
// stretch is exactly as long as the pan, so a screen crosses the window at
// the speed the page scrolls. Narrower, or under reduced motion, the row
// scrolls sideways under a finger and the bar follows that instead.
for (const reel of document.querySelectorAll('[data-reel]')) {
  const view = reel.querySelector('.cs-reel-view');
  const scroller = reel.querySelector('.cs-reel-scroll');
  const track = reel.querySelector('.cs-reel-track');
  const bar = reel.querySelector('.cs-reel-bar b');
  const wide = matchMedia('(min-width: 881px)');
  let pan = 0;
  let queued = 0;
  const pinned = () => wide.matches && !reduced();
  function paint() {
    queued = 0;
    if (reel.classList.contains('is-pinned')) {
      const r = reel.getBoundingClientRect();
      const stick = parseFloat(getComputedStyle(view).top) || 0;
      const p = pan > 0 ? Math.min(1, Math.max(0, (stick - r.top) / pan)) : 0;
      track.style.translate = `${(-p * pan).toFixed(1)}px 0`;
      bar?.style.setProperty('--p', p.toFixed(4));
    } else {
      const max = scroller.scrollWidth - scroller.clientWidth;
      bar?.style.setProperty('--p', max > 0 ? (scroller.scrollLeft / max).toFixed(4) : '0');
    }
  }
  function measure() {
    const on = pinned();
    reel.classList.toggle('is-pinned', on);
    if (on) scroller.scrollLeft = 0;
    track.style.translate = '';
    pan = on ? Math.max(0, track.scrollWidth - scroller.clientWidth) : 0;
    reel.style.setProperty('--pan', `${pan}px`);
    paint();
  }
  const ask = () => { if (!queued) queued = requestAnimationFrame(paint); };
  addEventListener('scroll', ask, { passive: true });
  scroller.addEventListener('scroll', ask, { passive: true });
  new ResizeObserver(measure).observe(scroller);
  wide.addEventListener('change', measure);
  measure();
}

// ---- the construction ----
// [data-construct] takes a plate's guides away and puts them back.
for (const sw of document.querySelectorAll('[data-construct]')) {
  const plate = sw.closest('.cs-construct');
  sw.addEventListener('click', () => {
    const on = sw.getAttribute('aria-pressed') !== 'true';
    sw.setAttribute('aria-pressed', String(on));
    plate?.classList.toggle('is-bare', !on);
  });
}
