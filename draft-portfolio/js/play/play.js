// play/play.js — the Play page: three courts playing themselves, and the
// stage one of them grows into when you pick it up.
//
// Opening a game is the card becoming the stage. The stage is the size of the
// whole band, in the card's colour, and it starts exactly where the card is.
// Its box — left, top, width, height, corner — springs out to fill the band
// on the settling curve, so the landing is visible. The real game is drawn
// on a canvas already at the stage's final size, clipped by the growing box,
// and fades in once the box has most of the way to go behind it; it is never
// stretched. Closing is the same in reverse, on the critically damped curve:
// it is going home, not landing.
//
// Every card holds a demo instance of its game, and the stage makes a fresh
// one when it opens. Two instances, not one board carried between two
// places: the carrying is where the live site's games got tangled up with
// their shell.
//
// The URL is #play/<game> while one is open, so Back closes it, a reload
// reopens it, and Esc is Back (or, arriving by a deep link with nothing
// behind it inside the site, a quiet replace to #play).

import Pong from './pong.js';
import Snake from './snake.js';
import Flappy from './flappy.js';
import { Surface, readBest } from './engine.js';
import { SPRING, EASE, animate, settle, reduced, onReducedChange, u, clearInline } from '../motion.js';

const GAMES = { pong: Pong, snake: Snake, flappy: Flappy };

// What the bottom line says, per game and per state. The line is the page's
// one voice, so the games speak through it too: how to play before you start
// (and until there is a score worth showing), the score while you play, the
// verdict when it is over. The stage itself holds only the court and the
// 3, 2, 1.
const COPY = {
  pong: {
    title: 'pong',
    ready: 'pong: space to serve, then ↑ ↓ or drag',
    playing: (g) => (g.score ? 'pong: rally ' + g.score : 'pong: ↑ ↓ or drag to move'),
    over: (g) => 'pong: ' + (g.result?.won ? 'you won' : 'the computer won') + ', rally ' + g.score,
  },
  snake: {
    title: 'snake',
    ready: 'snake: space to start, arrow keys to steer',
    playing: (g) => (g.score ? 'snake: ' + g.score : 'snake: arrow keys to steer'),
    over: (g) => 'snake: game over at ' + g.score,
  },
  flappy: {
    title: 'flappy bird',
    ready: 'flappy bird: space or click to flap',
    playing: (g) => (g.score ? 'flappy bird: ' + g.score : 'flappy bird: space or click to flap'),
    over: (g) => 'flappy bird: ' + g.score,
  },
};

export function initPlay(view, { router, lines }) {
  const grid = view.querySelector('.games');
  const cards = [...view.querySelectorAll('.game-card')];
  const stage = view.querySelector('.stage');
  const canvas = stage.querySelector('.stage-canvas');
  const hudCenter = stage.querySelector('.hud-center');
  const closeBtn = stage.querySelector('.stage-close');
  const live = stage.querySelector('.stage-live');
  const controlsLine = lines.querySelector('.sl-controls');

  let active = false;     // Play is the page on screen
  let open = null;        // { id, game, surface, card }
  let fromGrid = false;   // the open game was picked here, so Esc can be Back
  let closing = null;

  // ---- the demos ----
  const demos = new Map();
  for (const card of cards) {
    const id = card.dataset.game;
    const Game = GAMES[id];
    const surface = new Surface(card.querySelector('canvas'), Game.demoField, { pad: 18 * u() });
    const game = new Game(surface, { demo: true });
    demos.set(id, { game, card, seen: true });
    // Space on a focused card picks it up too, the way a button would
    card.addEventListener('keydown', (e) => {
      if (e.key === ' ') { e.preventDefault(); card.click(); }
    });
  }

  // A demo runs only while you could be watching it: Play on screen, the
  // card in view, the tab visible, no game open over it, and motion welcome.
  // Otherwise it holds still on its last frame.
  function sync() {
    for (const d of demos.values()) {
      const run = active && !open && d.seen && !document.hidden && !reduced();
      if (run) d.game.run();
      else { d.game.stop(); d.game.render(); }
    }
  }
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) demos.get(e.target.dataset.game).seen = e.isIntersecting;
    sync();
  });
  cards.forEach((c) => seen.observe(c));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && open?.game.state === 'playing') open.game.pause();
    sync();
  });
  addEventListener('blur', () => { if (open?.game.state === 'playing') open.game.pause(); });
  onReducedChange(sync);

  // ---- the bottom line knows each game's best ----
  function paintBests() {
    for (const el of lines.querySelectorAll('[data-best]')) {
      const best = readBest(el.dataset.best);
      el.textContent = best ? ' · best ' + best : '';
    }
  }
  paintBests();

  // ---- the bottom line narrates; the court shows only the 3, 2, 1 ----
  let shownCount = null;
  function hud(game) {
    const copy = COPY[open?.id || game.constructor.id];
    const s = game.state;
    let line = copy.ready;
    if (s === 'countdown') line = copy.playing(game);
    else if (s === 'playing') line = copy.playing(game);
    else if (s === 'paused') line = copy.title + ': paused, space to go on';
    else if (s === 'ended') {
      line = copy.over(game) + (game.newBest ? ', a new best' : game.best ? ', best ' + game.best : '') + ' · space to play again';
    }
    if (controlsLine.textContent !== line) controlsLine.textContent = line;

    const count = s === 'countdown' ? String(game.count) : '';
    if (hudCenter.textContent !== count) {
      hudCenter.textContent = count;
      if (count && shownCount !== game.count) {
        shownCount = game.count;
        animate(hudCenter, [{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }], SPRING.pop);
      }
    }
    if (s !== 'countdown') shownCount = null;
    if (s === 'ended') {
      paintBests();
      live.textContent = copy.over(game) + '. Best ' + game.best + '. Space to play again.';
    }
  }

  // ---- keys belong to the open game ----
  // Capture phase on the window, installed on open and gone on close: a key
  // the game uses never scrolls the page or reaches anything else.
  function onKey(e) {
    if (!open || e.metaKey || e.ctrlKey || e.altKey) return;
    const down = e.type === 'keydown';
    if (e.key === 'Escape') {
      if (down) { e.preventDefault(); leaveGame(); }
      return;
    }
    const t = e.target;
    if ((e.key === ' ' || e.key === 'Enter') && t !== stage && t.closest?.('button, a')) return;
    if (open.game.key(e, down)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onPointer(e) {
    if (!open) return;
    if (e.type === 'pointerdown') canvas.setPointerCapture?.(e.pointerId);
    open.game.pointer(e);
  }
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    canvas.addEventListener(type, onPointer);
  }

  function leaveGame() {
    if (fromGrid) history.back();
    else router.go({ view: 'play', game: null }, { replace: true });
  }
  closeBtn.addEventListener('click', leaveGame);

  // ---- opening and closing ----
  function rectIn(el) {
    const v = view.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { left: r.left - v.left, top: r.top - v.top, width: r.width, height: r.height };
  }

  function openGame(id, { instant = false } = {}) {
    if (open?.id === id) return;
    if (open) closeGame({ instant: true });
    const card = cards.find((c) => c.dataset.game === id);
    const Game = GAMES[id];
    const k = u();

    settle(stage, { subtree: true });
    stage.style.setProperty('--card-bg', getComputedStyle(card).getPropertyValue('--card-bg'));
    stage.hidden = false;
    stage.inert = false;
    // the stage's own resting box (css/play.css), before anything animates it
    const full = { width: stage.clientWidth, height: stage.clientHeight };
    // the canvas is drawn at the stage's FINAL size from the first frame,
    // so the grow only ever reveals it and never resizes it
    canvas.style.width = full.width + 'px';
    canvas.style.height = full.height + 'px';
    const surface = new Surface(canvas, Game.field, { pad: 44 * k });
    const game = new Game(surface, { onChange: hud });
    open = { id, game, surface, card };
    game.run();
    hud(game);
    sync();

    lines.dataset.open = id;
    hud(game);
    stage.setAttribute('aria-label', COPY[id].ready + '. Escape closes.');
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);

    const inner = [canvas, stage.querySelector('.hud'), closeBtn];
    if (instant || reduced()) {
      clearInline(stage, ['left', 'top', 'width', 'height', 'border-radius']);
      stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'linear' });
      grid.style.visibility = 'hidden';
    } else {
      const from = rectIn(card);
      const cardRadius = getComputedStyle(card).borderRadius;
      stage.animate([
        { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px', borderRadius: cardRadius },
        { left: '0px', top: '0px', width: full.width + 'px', height: full.height + 'px', borderRadius: getComputedStyle(stage).borderRadius },
      ], SPRING.settle);
      for (const el of inner) {
        el.animate([{ opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1 }],
          { duration: 240, easing: EASE.rise, delay: SPRING.settle.duration * 0.55, fill: 'backwards' });
      }
      card.style.visibility = 'hidden';
      for (const c of cards) {
        if (c === card) continue;
        animate(c, [{}, { opacity: 0, translate: `0 ${12 * k}px` }],
          { duration: 160, easing: EASE.exit, fill: 'forwards' });
      }
      setTimeout(() => { if (open?.card === card) grid.style.visibility = 'hidden'; }, SPRING.settle.duration);
    }
    stage.focus({ preventScroll: true });
  }

  function closeGame({ instant = false } = {}) {
    if (!open) return;
    const { game, card, surface } = open;
    open = null;
    delete lines.dataset.open;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKey, true);
    game.stop();

    const finish = () => {
      stage.hidden = true;
      clearInline(stage, ['left', 'top', 'width', 'height', 'border-radius', 'opacity']);
      game.destroy();
      surface.destroy();
      for (const c of cards) { settle(c); clearInline(c, ['opacity', 'translate', 'visibility']); }
      closing = null;
      sync();
    };

    grid.style.visibility = '';
    if (instant || reduced() || !active) {
      card.style.visibility = '';
      for (const c of cards) { settle(c); clearInline(c); }
      finish();
      return;
    }

    const k = u();
    const to = rectIn(card);
    settle(stage);
    stage.inert = true;
    for (const el of [canvas, stage.querySelector('.hud'), closeBtn]) {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'linear', fill: 'forwards' });
    }
    const back = stage.animate([
      {},
      { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px', borderRadius: getComputedStyle(card).borderRadius },
    ], { ...SPRING.out, fill: 'forwards' });
    // the other cards come back up while the stage is still shrinking
    for (const c of cards) {
      if (c === card) continue;
      settle(c);
      animate(c, [{}, { opacity: 1, translate: '0 0' }],
        { duration: 360, easing: EASE.rise, delay: 150, fill: 'forwards' });
    }
    closing = back;
    back.finished.then(() => {
      if (closing !== back) return;
      card.style.visibility = '';
      for (const el of [canvas, stage.querySelector('.hud'), closeBtn]) el.getAnimations().forEach((a) => a.cancel());
      back.cancel();
      finish();
    }, () => {});
  }

  // ---- the router's hooks ----
  return {
    enter(route, prev, { initial } = {}) {
      active = true;
      paintBests();
      sync();
      if (route.game) {
        fromGrid = false;
        openGame(route.game, { instant: true });
      }
    },
    leave() {
      active = false;
      if (open) closeGame({ instant: true });
      sync();
    },
    update(route, prev) {
      if (route.game) {
        fromGrid = !!prev && prev.view === 'play' && !prev.game;
        openGame(route.game);
      } else if (open) {
        closeGame();
      }
    },
  };
}
