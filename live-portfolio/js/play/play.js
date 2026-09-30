// play/play.js — the Play page: three tiles playing themselves, and the
// stage one of them grows into when you pick it up.
//
// The stage is the tile, made big: the same surface, its name and year at
// the top left, the score and a close button where the tile's Play pill was,
// and under them the court, the tile's sunk screen grown to 2:1. All three
// games are played in that one rectangle (840 × 420, in their own units).
//
// Opening is the tile becoming the stage, piece by piece, all on the
// settling curve, so the landing is visible:
//   the surface  grows from the tile's box to the stage's
//   the name     rides its top-left corner, from the tile's head to the
//                stage's. It is the same size in both, so it only travels.
//   the tools    ride its top-right corner, from where the pill was
//   the well     grows from the tile's screen to the court
//   the game     is drawn on a canvas already the court's size, and fades
//                in once the well has most of the way to go behind it. It
//                is never stretched.
// The stage itself never moves or resizes: it is laid out where it ends
// (css/play.css), and only those pieces are animated, so nothing in it is
// laid out twice. Closing is the same in reverse, on the critically damped
// curve: it is going home, not landing. Stopped half-way, either one turns
// round from wherever it has got to (motion.js settle()).
//
// Every tile holds a demo instance of its game, and the stage makes a fresh
// one when it opens. Two instances, not one board carried between two
// places: the carrying is where the old site's games got tangled up with
// their shell.
//
// The URL is #play/<game> while one is open, so Back closes it, a reload
// reopens it, and Esc is Back (or, arriving by a deep link with nothing
// behind it inside the site, a quiet replace to #play).
//
// While a game is open it has the page to itself. Opening settles the Play
// screen square in the window if it was scrolled part-way (the one time
// anything here moves the page), and until it closes the wheel, a drag and
// the scrolling keys do nothing to the page, so a game is never played
// half off the screen.

import Pong from './pong.js';
import Snake from './snake.js';
import Flappy from './flappy.js';
import { Surface } from './engine.js';
import { SPRING, EASE, animate, settle, reduced, onReducedChange, u, clearInline } from '../motion.js';

const GAMES = { pong: Pong, snake: Snake, flappy: Flappy };

// What the court says, per game. A hint is written with its keys in braces,
// and drawn with them as keys; `touch` is the same said to a finger, and
// `say` the same said to a screen reader. The call is how it ended.
const COPY = {
  pong: {
    keys: '{space} to serve, then {↑}{↓} or drag',
    touch: 'Tap to serve, then drag',
    say: 'Space to serve, then the up and down arrows, or drag',
    over: (g) => (g.result?.won ? 'You won' : 'The computer won'),
    count: 'rally',
  },
  snake: {
    keys: '{space} to start, then {←}{↑}{↓}{→} to steer',
    touch: 'Tap to start, then swipe to steer',
    say: 'Space or an arrow to start, then the arrows to steer',
    over: (g) => (g.food ? 'Game over' : 'You filled the board'),
    count: 'score',
  },
  flappy: {
    keys: '{space} or click to flap',
    touch: 'Tap to flap',
    say: 'Space or click to flap',
    over: () => 'Game over',
    count: 'score',
  },
};
const AGAIN = { keys: '{space} to play again', touch: 'Tap to play again', say: 'Space to play again' };
const PAUSED = { keys: '{space} to go on', touch: 'Tap to go on', say: 'Space to go on' };

// the keys the page scrolls by, which do nothing to it while a game is open
const SCROLL_KEYS = new Set([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);

const touchOnly = matchMedia('(hover: none) and (pointer: coarse)');

// A hint's words and keys, as nodes: "{space} to serve" is a key, then the
// words. Keys written together ({↑}{↓}) are one group, set closer.
function hintNodes(text) {
  const out = [];
  let keys = null;
  for (const part of text.split(/(\{[^}]+\})/)) {
    if (!part.trim()) continue;
    if (part.startsWith('{')) {
      if (!keys) out.push((keys = Object.assign(document.createElement('span'), { className: 'keys' })));
      keys.append(Object.assign(document.createElement('kbd'), { textContent: part.slice(1, -1) }));
    } else {
      keys = null;
      out.push(Object.assign(document.createElement('span'), { textContent: part.trim() }));
    }
  }
  return out;
}

export function initPlay(view, { router }) {
  const grid = view.querySelector('.games');
  const cards = [...view.querySelectorAll('.game-card')];
  const screen = view.closest('.screen');
  const stage = view.querySelector('.stage');
  const $ = (s) => stage.querySelector(s);
  const surfaceEl = $('.stage-surface');
  const title = $('.stage-title');
  const nameEl = $('.stage-name');
  const metaEl = $('.stage-meta');
  const tools = $('.stage-tools');
  const scoreEl = $('.stage-score');
  const closeBtn = $('.stage-close');
  const court = $('.stage-court');
  const well = $('.court-well');
  const courtScreen = $('.court-screen');
  const canvas = $('.stage-canvas');
  const callEl = $('.court-call');
  const hintEl = $('.court-hint');
  const live = $('.stage-live');
  // everything that moves when the stage opens or closes, and what it may
  // leave behind inline
  const PIECES = [surfaceEl, title, tools, well, courtScreen, callEl, hintEl];
  const PROPS = ['left', 'top', 'width', 'height', 'border-radius', 'opacity', 'translate', 'scale'];

  let active = false;     // Play is the page on screen
  let open = null;        // { id, game, surface, card }
  let fromGrid = false;   // the open game was picked here, so Esc can be Back
  let closing = null;     // { anim, finish } while a close is running

  // ---- the demos ----
  const demos = new Map();
  for (const card of cards) {
    const id = card.dataset.game;
    const Game = GAMES[id];
    const surface = new Surface(card.querySelector('canvas'), Game.demoField);
    const game = new Game(surface, { demo: true });
    demos.set(id, { game, card, seen: true });
    // Space on a focused card picks it up too, the way a button would
    card.addEventListener('keydown', (e) => {
      if (e.key === ' ') { e.preventDefault(); card.click(); }
    });
    // Picked up, the page is about to be squared up under the game (align(),
    // below), and Back must not put it where it was before that: #play is
    // told not to restore its scroll. Set here, while #play is the entry
    // the browser is on, before the link goes to the game; put back once the
    // game has closed.
    card.addEventListener('click', () => { history.scrollRestoration = 'manual'; });
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

  // ---- what the stage says ----
  // The score in the head; in the court, the call in its middle and the
  // hint at its foot, each shown only when there is something to say. A
  // line going away keeps its words until it has gone.
  function showScore(n) {
    const text = String(n);
    if (scoreEl.textContent === text) return;
    scoreEl.textContent = text;
    // a point comes up from below, as the page's lines do
    if (n > 0) {
      animate(scoreEl, [
        { opacity: 0, translate: `0 ${10 * u()}px`, filter: 'blur(3px)' },
        { opacity: 1, translate: '0 0', filter: 'blur(0px)' },
      ], SPRING.snap);
    }
  }

  function showCall(text, kind = '') {
    if (!text) { callEl.removeAttribute('data-on'); return; }
    const was = callEl.textContent;
    callEl.textContent = text;
    callEl.dataset.kind = kind;
    callEl.setAttribute('data-on', '');
    // each numeral of the count lands on its own
    if (kind === 'count' && was !== text) {
      animate(callEl, [{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }], SPRING.pop);
    }
  }

  let hintText = null;
  function showHint(copy, { waiting = false } = {}) {
    if (!copy) { hintEl.removeAttribute('data-on'); hintText = null; return; }
    const text = touchOnly.matches ? copy.touch : copy.keys;
    if (text !== hintText) {
      hintText = text;
      hintEl.replaceChildren(...hintNodes(text));
    }
    hintEl.toggleAttribute('data-waiting', waiting);
    hintEl.setAttribute('data-on', '');
  }

  function hud(game) {
    const copy = COPY[open.id];
    const s = game.state;
    showScore(game.score);
    if (s === 'countdown') showCall(String(game.count), 'count');
    else if (s === 'paused') showCall('Paused');
    else if (s === 'ended') showCall(copy.over(game));
    else showCall('');
    if (s === 'idle') showHint(copy, { waiting: true });
    else if (s === 'paused') showHint(PAUSED);
    else if (s === 'ended') showHint(AGAIN, { waiting: true });
    else showHint(null);
    if (s === 'ended') live.textContent = `${copy.over(game)}, ${copy.count} ${game.score}. ${AGAIN.say}.`;
    else if (s === 'paused') live.textContent = `Paused. ${PAUSED.say}.`;
  }

  // ---- the open game has the keys, the pointer, and the page ----
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
    } else if (SCROLL_KEYS.has(e.key)) {
      e.preventDefault();
    }
  }
  const hold = (e) => { if (e.cancelable) e.preventDefault(); };

  // The whole stage takes the pointer, not only the court: a flap or a
  // serve can land anywhere on it, and a drag for Pong's paddle or a swipe
  // for the snake can start anywhere too. Only the close button is its own.
  function onPointer(e) {
    if (!open) return;
    if (e.target.closest?.('.stage-close')) return;
    if (e.type === 'pointerdown') {
      if (e.button > 0) return;
      stage.setPointerCapture?.(e.pointerId);
    }
    open.game.pointer(e);
  }
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    stage.addEventListener(type, onPointer);
  }
  touchOnly.addEventListener('change', () => { if (open) hud(open.game); });

  function leaveGame() {
    if (fromGrid) history.back();
    else router.go({ view: 'play', game: null }, { replace: true });
  }
  closeBtn.addEventListener('click', leaveGame);

  // ---- opening and closing ----
  // r's box, as left/top/width/height inside o
  const box = (r, o) => ({
    left: r.left - o.left + 'px',
    top: r.top - o.top + 'px',
    width: r.width + 'px',
    height: r.height + 'px',
  });
  const rect = (el) => el.getBoundingClientRect();
  // where each piece sits on the tile, measured against where it sits on
  // the stage
  function measure(card) {
    const S = rect(stage);
    const W = rect(court);
    const T = rect(title);
    const X = rect(closeBtn);
    const cardTitle = rect(card.querySelector('.game-title'));
    const pill = rect(card.querySelector('.game-play'));
    return {
      surface: { ...box(rect(card), S), borderRadius: getComputedStyle(card).borderRadius },
      well: { ...box(rect(card.querySelector('.game-screen')), W) },
      title: `${cardTitle.left - T.left}px ${cardTitle.top - T.top}px`,
      // the close button's right edge and middle on the pill's
      tools: `${pill.right - X.right}px ${pill.top + pill.height / 2 - (X.top + X.height / 2)}px`,
    };
  }
  function atRest() {
    const W = rect(court);
    return {
      surface: { left: '0px', top: '0px', width: rect(stage).width + 'px', height: rect(stage).height + 'px', borderRadius: getComputedStyle(surfaceEl).borderRadius },
      well: { left: '0px', top: '0px', width: W.width + 'px', height: W.height + 'px' },
    };
  }
  function clearPieces() {
    for (const el of PIECES) {
      el.getAnimations().forEach((a) => a.cancel());
      clearInline(el, PROPS);
    }
  }

  // If Play's screen is scrolled part-way into the window, bring it square:
  // gliding there as a game opens, and at once when the window changes size
  // under an open one (the browser keeps the scroll, not the screen).
  function align({ glide = true } = {}) {
    if (getComputedStyle(stage).position === 'fixed') return;
    const top = rect(screen).top;
    if (Math.abs(top) > 1) scrollBy({ top, behavior: glide && !reduced() ? 'smooth' : 'instant' });
  }
  addEventListener('resize', () => { if (open) align({ glide: false }); });

  function openGame(id, { instant = false } = {}) {
    if (open?.id === id) return;
    if (open) closeGame({ instant: true });
    closing?.finish();
    const card = cards.find((c) => c.dataset.game === id);
    const Game = GAMES[id];
    const k = u();

    // the stage takes on the tile's colours and words, and a new game
    stage.dataset.game = id;
    nameEl.textContent = card.querySelector('.game-name').textContent;
    metaEl.textContent = card.querySelector('.game-meta').textContent;
    clearPieces();
    stage.hidden = false;
    stage.inert = false;
    const surface = new Surface(canvas, Game.field);
    const game = new Game(surface, { onChange: hud });
    open = { id, game, surface, card };
    game.run();
    hud(game);
    sync();
    stage.setAttribute('aria-label', `${nameEl.textContent}. ${COPY[id].say}. Escape closes.`);
    live.textContent = '';
    // The game's own entry restores its scroll as any page's does: only #play,
    // behind it, is told not to (on the tile's click, above). A new entry
    // copies the one it came from, so this one is put back.
    history.scrollRestoration = 'auto';

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('wheel', hold, { passive: false });
    window.addEventListener('touchmove', hold, { passive: false });

    align({ glide: !instant });
    if (instant || reduced()) {
      stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'linear' });
      grid.style.visibility = 'hidden';
    } else {
      const from = measure(card);
      const to = atRest();
      const grow = SPRING.settle;
      surfaceEl.animate([from.surface, to.surface], grow);
      well.animate([from.well, to.well], grow);
      title.animate([{ translate: from.title }, { translate: '0 0' }], grow);
      tools.animate([{ translate: from.tools }, { translate: '0 0' }], grow);
      // the score and the close come in as the pill goes; the game, and what
      // the court says, once the well is nearly there
      tools.animate([{ opacity: 0 }, { opacity: 1 }],
        { duration: 220, easing: 'linear', delay: grow.duration * 0.2, fill: 'backwards' });
      for (const el of [courtScreen, callEl, hintEl]) {
        el.animate([{ opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1 }],
          { duration: 240, easing: EASE.rise, delay: grow.duration * 0.55, fill: 'backwards' });
      }
      card.style.visibility = 'hidden';
      for (const c of cards) {
        if (c === card) continue;
        settle(c);
        animate(c, [{}, { opacity: 0, translate: `0 ${12 * k}px` }],
          { duration: 160, easing: EASE.exit, fill: 'forwards' });
      }
      setTimeout(() => { if (open?.card === card) grid.style.visibility = 'hidden'; }, grow.duration);
    }
    stage.focus({ preventScroll: true });
  }

  function closeGame({ instant = false } = {}) {
    if (!open) return;
    const { game, card } = open;
    open = null;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKey, true);
    window.removeEventListener('wheel', hold);
    window.removeEventListener('touchmove', hold);
    game.stop();
    // Focus goes back to the tile it came from, once it is back. Going Back
    // to #play has usually dropped it already (the browser lets go of focus
    // on the way to a fragment), so focus on nothing counts as the stage's.
    const was = document.activeElement;
    const hadFocus = !was || was === document.body || stage.contains(was);
    stage.inert = true;

    const finish = () => {
      if (closing?.finish === finish) closing = null;
      history.scrollRestoration = 'auto';
      stage.hidden = true;
      clearPieces();
      game.destroy();
      card.style.visibility = '';
      grid.style.visibility = '';
      if (hadFocus) card.focus({ preventScroll: true });
      sync();
    };

    grid.style.visibility = '';
    if (instant || reduced() || !active) {
      for (const c of cards) { c.getAnimations().forEach((a) => a.cancel()); clearInline(c, ['opacity', 'translate', 'visibility']); }
      finish();
      return;
    }

    // from wherever the pieces are now, which is where the open left them,
    // or part-way there if it is still running
    for (const el of PIECES) settle(el);
    const to = measure(card);
    const home = { ...SPRING.out, fill: 'forwards' };
    const back = surfaceEl.animate([{}, to.surface], home);
    well.animate([{}, to.well], home);
    title.animate([{}, { translate: to.title }], home);
    tools.animate([{}, { translate: to.tools }], home);
    for (const el of [tools, courtScreen, callEl, hintEl]) {
      el.animate([{}, { opacity: 0 }], { duration: 120, easing: 'linear', fill: 'forwards' });
    }
    // the other tiles come back up while the stage is still shrinking, and
    // tidy up after themselves
    for (const c of cards) {
      if (c === card) continue;
      settle(c);
      const a = animate(c, [{}, { opacity: 1, translate: '0 0' }],
        { duration: 360, easing: EASE.rise, delay: 150, fill: 'forwards' });
      a.finished.then(() => { a.cancel(); clearInline(c, ['opacity', 'translate']); }, () => {});
    }
    closing = { anim: back, finish };
    back.finished.then(() => {
      if (closing?.anim !== back) return;
      finish();
      // the tile's own screen comes back on, rather than blinking on
      card.querySelector('.game-screen canvas').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'linear' });
    }, () => {});
  }

  // ---- the router's hooks ----
  return {
    enter(route) {
      active = true;
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
