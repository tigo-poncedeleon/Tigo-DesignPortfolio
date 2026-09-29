// main.js — boots the draft and runs every page change.
//
// A page change is three things moving at once, on the same clock:
//   the menu   folds its pills away and slides its square home (nav.css),
//              with the new page's pill marked;
//   the band   the old page drifts out against the direction of travel and
//              fades (180ms, an ease-in: it is leaving, so it accelerates
//              away), while the new one arrives from the other side on the
//              settling spring, its text rising into place a line at a time;
//   the line   the bottom-left line crossfades to the new page's words.
//
// "Direction" is the menu's order, home → work → play → about: going down
// the list, pages come in from the right; going up, from the left.
//
// Every change starts from what is on screen, not from where the last one was
// meant to end. settle() pins whatever is mid-flight where it is, and the
// next animation leaves from there. Five clicks in a second is five changes of
// mind, not five pages queued up, and Back in the middle of a crossfade just
// turns it around.

import { createPrompt } from './prompt.js';
import { createComposer } from './composer.js';
import { createChat } from './chat.js';
import { initNav } from './nav.js';
import { startRouter, VIEWS } from './router.js';
import { playEntrance } from './entrance.js';
import { SPRING, EASE, animate, settle, rise, clearInline, reduced, u } from './motion.js';

const NAME = 'Tigo Ponce de León';
const TITLES = {
  home: NAME,
  work: 'Work — ' + NAME,
  play: 'Play — ' + NAME,
  about: 'About — ' + NAME,
};

const views = {};
for (const v of document.querySelectorAll('.band > [data-view]')) views[v.dataset.view] = v;
const lines = {};
for (const l of document.querySelectorAll('.status > [data-status]')) lines[l.dataset.status] = l;

const nav = initNav(document.querySelector('.menu'));

// ---- Home: the composer and the conversation ----
// The field (prompt.js) owns the text and the caret; the composer
// (composer.js) owns everything around it and decides what a send is; the
// chat (chat.js) sends it and plays the answer.
const promptForm = document.querySelector('.prompt');
const prompt = createPrompt(promptForm, {
  onSubmit: () => composer.submit(),
  onChange: () => composer?.paintSend(),
});
const chat = createChat({
  prompt,
  promptForm,
  name: document.querySelector('.name'),
  ask: document.querySelector('.ask'),
  answerBox: document.querySelector('.answer'),
  announcer: document.getElementById('announcer'),
  onFail: (sent) => composer.restore(sent),
});
const composer = createComposer(promptForm, {
  prompt,
  onSend: (message) => chat.submit(message),
});

// A click on Home's empty canvas is a click on the prompt: the whole page is
// the invitation. Not on the answer's own text, though, which is there to be
// read and selected.
views.home.addEventListener('click', (e) => {
  if (e.target.closest('.answer-text')) return;
  if (!getSelection().isCollapsed) return;
  prompt.focus();
});

// Which hand is driving: keyboard navigation moves focus to the new page's
// heading, a click leaves focus where it was.
let byKeyboard = false;
addEventListener('keydown', () => { byKeyboard = true; }, true);
addEventListener('pointerdown', () => { byKeyboard = false; }, true);

// ---- per-page hooks (Play fills this in when it loads) ----
const hooks = {};
let current = null;

// ---- leaving and arriving ----
function leave(el, name, dir) {
  el.inert = true;
  settle(el);
  const k = u();
  const a = animate(el, [{}, { opacity: 0, translate: `${-dir * 16 * k}px 0` }], {
    duration: 180, easing: EASE.exit, fill: 'forwards',
  });
  a.finished.then(() => {
    if (current?.view === name) return;
    el.hidden = true;
    a.cancel();
    clearInline(el);
  }, () => {});
}

function arrive(el, name, dir, { initial, stagger = true } = {}) {
  const fresh = el.hidden;
  settle(el);
  el.hidden = false;
  el.inert = false;
  if (initial) { clearInline(el); return; }
  if (fresh) {
    el.style.opacity = '0';
    if (!reduced()) el.style.translate = `${dir * 24 * u()}px 0`;
  }
  const a = animate(el, [{}, { opacity: 1, translate: '0 0' }], {
    ...SPRING.settle, delay: fresh ? 90 : 0, fill: 'forwards',
  });
  a.finished.then(() => {
    if (current?.view !== name) return;
    a.cancel();
    clearInline(el);
  }, () => {});
  if (fresh && stagger) rise(el.querySelectorAll('[data-rise]'), { delay: 90, stagger: 45 });
}

function show(next, prev, { initial }) {
  current = next;
  document.title = TITLES[next.view];

  nav.setCurrent(next.view);
  nav.close();

  // the same page, a different state of it (a game opening or closing)
  if (prev && prev.view === next.view) {
    hooks[next.view]?.update?.(next, prev);
    return;
  }

  const dir = prev ? Math.sign(VIEWS.indexOf(next.view) - VIEWS.indexOf(prev.view)) : 0;
  if (prev) hooks[prev.view]?.leave?.(next, prev);

  prompt.setTypeAnywhere(next.view === 'home');
  chat.setVisible(next.view === 'home');

  for (const [name, el] of Object.entries(views)) {
    if (name === next.view) arrive(el, name, dir, { initial });
    else if (!el.hidden) leave(el, name, dir);
  }
  for (const [name, el] of Object.entries(lines)) {
    if (name === next.view) arrive(el, name, 0, { initial, stagger: false });
    else if (!el.hidden) leave(el, name, 0);
  }

  hooks[next.view]?.enter?.(next, prev, { initial });

  if (initial) {
    // Arriving straight at a page: its content rises once the frame has
    // assembled around it, rather than standing there first.
    if (next.view !== 'home') rise(views[next.view].querySelectorAll('[data-rise]'), { delay: 380, stagger: 50 });
    return;
  }
  if (next.view === 'home') {
    prompt.focusIfDesk();
  } else if (byKeyboard) {
    views[next.view].querySelector('h1')?.focus({ preventScroll: true });
  }
}

// ---- boot ----
const router = startRouter((next, prev, info) => show(next, prev, info));

playEntrance({ caret: prompt.caret }).then(() => {
  if (router.current.view === 'home') prompt.focusIfDesk();
});

// Play's engine is the heaviest thing here, and nothing needs it until the
// Play page opens. It is fetched when the browser is idle, and wired in when
// it arrives.
function loadPlay() {
  return import('./play/play.js').then(({ initPlay }) => {
    hooks.play = initPlay(views.play, { router, lines: lines.play });
    if (router.current.view === 'play') hooks.play.enter(router.current, null, { initial: true });
  }).catch((err) => console.warn('play did not load', err));
}
if (router.current.view === 'play') loadPlay();
else (window.requestIdleCallback || ((f) => setTimeout(f, 1200)))(loadPlay);

if (new URLSearchParams(location.search).has('overlay')) {
  import('../tools/overlay.js');
}
