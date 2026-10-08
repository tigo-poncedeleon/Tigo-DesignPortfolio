// main.js — boots the draft, and keeps track of where on the page you are.
//
// The site is one page, four screens down it in the menu's order: Home,
// Work, Play, About (index.html). You move between them by scrolling, or with
// the menu, whose pills are plain links to each screen, so the browser does
// the going (css/base.css). Nothing here ever moves the page. It only
// watches: whichever screen holds the middle of the window is the one you
// are on, and everything that depends on that follows it as you scroll:
//   the headline  the name on Home, and "Work", "Play" or "About" elsewhere,
//                 the old one lifting away as the new one rises in, in the
//                 direction you are scrolling;
//   the menu      its pill for the screen is marked;
//   the address   the hash is the screen's (#work), noted as you go, so a
//                 reload or a shared link comes back to it (js/router.js);
//   the screens   Home's conversation and composer, and Play's games, know
//                 whether they are the one in the window.
// Each screen's pieces rise into place the first time they come into view.
// (It was four pages, each the whole window, swapped in place with a
// crossfade that ran in the menu's direction.)

import { createPrompt } from './prompt.js';
import { createComposer } from './composer.js';
import { createChat } from './chat.js';
import { watchKeyboard } from './keyboard.js';
import { initNav } from './nav.js';
import { startRouter, VIEWS } from './router.js';
import { playEntrance } from './entrance.js';
import { initAbout } from './about.js';
import { SPRING, EASE, animate, rise, reduced, u } from './motion.js';

const NAME = 'Tigo Ponce de León';
const TITLES = {
  home: NAME,
  work: 'Work — ' + NAME,
  play: 'Play — ' + NAME,
  about: 'About — ' + NAME,
};

const screens = {};
const views = {};
for (const el of document.querySelectorAll('.screen')) {
  screens[el.dataset.section] = el;
  views[el.dataset.section] = el.querySelector('.view');
}

// While a conversation is up on Home, the menu square gives its place to a
// clear button (the chat says when, below).
const nav = initNav(document.querySelector('.menu'), {
  onClear: () => chat.clear(),
  // the row of pages keeps off the name
  clearOf: document.querySelector('.headline .name'),
});

// ---- while there is a conversation ----
// The conversation takes the whole page. The frame says so with data-chat,
// and three things answer it: the menu square gives its place to the clear
// square (js/nav.js), the composer's pill stays open (css/home.css), and the
// name steps out of the way. It simply fades, and fades back in once the
// conversation is cleared, or when you scroll away from Home, where the
// headline is the other screens' names anyway. (It lifted off and went out of focus, a line at a time; the chat
// is kept plain now, and so is this.) Before the first paint (a
// conversation restored by a reload) nothing moves: the name is simply not
// there, and the entrance leaves it out (js/entrance.js).
const frame = document.querySelector('.frame');
const nameLines = [...document.querySelectorAll('.name-line')];
function setChatting(on) {
  if (frame.hasAttribute('data-chat') === on) return;
  frame.toggleAttribute('data-chat', on);
  nav.setChat(on);
  prompt.setChatting(on);
  if (!document.documentElement.classList.contains('entered')) return;
  for (const line of nameLines) {
    for (const a of line.getAnimations()) a.cancel();
    animate(line, on ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }],
      { duration: on ? 200 : 300, easing: 'ease-out', delay: on ? 0 : 120, fill: on ? 'forwards' : 'backwards' });
  }
}

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
  thread: document.querySelector('.thread'),
  announcer: document.getElementById('announcer'),
  onFail: (sent) => composer.restore(sent),
  onLive: setChatting,
});
const composer = createComposer(promptForm, {
  prompt,
  onSend: (message) => chat.submit(message),
});

// A click on Home's empty canvas is a click on the prompt: the whole page is
// the invitation. That is the whole screen, the composer's pill and the
// air around it as well as the band, so on a phone a tap anywhere raises
// the keyboard, and the cursor goes to the end of whatever is there. (It was
// the band alone, and the pill around the one-line field took a tap and did
// nothing with it.) Not on the conversation's bubbles, though, which are
// there to be read and selected, nor on anything with a job of its own.
// And once there is a conversation, only the composer itself: the screen is
// the answers' then, and a press beside one, to read it or to drop a
// selection, should not bring a blinking caret (and on a phone, a keyboard)
// up over it.
screens.home.addEventListener('click', (e) => {
  if (e.target.closest('.bubble, .turn-photo, a, button, textarea, .composer-mood, .composer-thumb')) return;
  if (frame.hasAttribute('data-chat') && !e.target.closest('.composer')) return;
  if (!getSelection().isCollapsed) return;
  prompt.focus({ atEnd: true });
});

// A phone's keyboard comes up over the composer, so while it is up Home is
// fitted into what is left of the window, and the page is held on Home
// (js/keyboard.js).
const keyboard = watchKeyboard({ input: prompt.input, home: screens.home });

// ---- per-screen hooks (Play fills this in when it loads) ----
const hooks = {};

// ---- the headline ----
const headline = {};
for (const el of document.querySelectorAll('.headline > [data-for]')) headline[el.dataset.for] = el;

// The pill behind a screen's title is one for all three, as wide as
// whichever is showing, in that screen's pastel (css/base.css), so it
// stretches or draws in to the next word as the screens change. On Home it
// keeps the width of the last title it held, out of sight. Fitted without
// its spring when the page opens or the window changes size, so only a
// change of screen moves it.
const pill = document.querySelector('.headline-pill');
function fitPill(name, { still = false } = {}) {
  const title = headline[name];
  if (!pill || !title || name === 'home') return;
  if (still) pill.style.transition = 'none';
  pill.style.setProperty('--pill-w', `${title.offsetWidth}px`);
  if (still) { void pill.offsetWidth; pill.style.transition = ''; }
}
const fitPillStill = () => fitPill(section && section !== 'home' ? section : 'work', { still: true });
function swapHeadline(to, from, dir) {
  const k = u();
  const leaving = headline[from];
  const arriving = headline[to];
  for (const el of [leaving, arriving]) for (const a of el.getAnimations()) a.cancel();
  animate(leaving, [
    { opacity: 1, translate: '0 0', filter: 'blur(0px)' },
    { opacity: 0, translate: `0 ${-dir * 10 * k}px`, filter: 'blur(3px)' },
  ], { duration: 200, easing: EASE.exit, fill: 'forwards' });
  // Home's headline is the name, which a conversation keeps out of the way
  if (to === 'home' && frame.hasAttribute('data-chat')) return;
  animate(arriving, [
    { opacity: 0, translate: `0 ${dir * 10 * k}px`, filter: 'blur(3px)' },
    { opacity: 1, translate: '0 0', filter: 'blur(0px)' },
  ], { ...SPRING.settle, delay: 90, fill: 'backwards' });
}

// ---- where you are ----
// The screen you are on is the one that holds the middle of the window.
// Everything that depends on it is told here, once, as it changes.
let section = null;
function setSection(name, { initial = false } = {}) {
  if (name === section) return;
  const prev = section;
  section = name;
  // the frame first: the chat below hides the name for a conversation, and
  // must find the headline already turned to the new screen
  frame.dataset.section = name;
  fitPill(name, { still: initial });
  document.title = TITLES[name];
  nav.setCurrent(name);
  nav.close();
  prompt.setTypeAnywhere(name === 'home');
  chat.setVisible(name === 'home');
  // The first time Home is in view, the caret types its greeting out and
  // takes it back (js/prompt.js): on a first load once the entrance has set
  // it blinking (at 700ms) and it has blinked once; arriving later, a beat
  // after the scroll lands. Not over a conversation, which has said hello
  // already.
  if (name === 'home' && !frame.hasAttribute('data-chat')) prompt.greet({ delay: initial ? 1250 : 500 });
  if (prev) hooks[prev]?.leave?.();
  hooks[name]?.enter?.(router.current?.view === name ? router.current : { view: name, game: null });
  if (prev && !initial) swapHeadline(name, prev, Math.sign(VIEWS.indexOf(name) - VIEWS.indexOf(prev)));
  router.note({ view: name, game: null });
}

function whereAmI() {
  // While a phone's keyboard is up for the composer, the page is Home,
  // whatever the window says: the keyboard takes half of it, and a page
  // nudged by the browser to show the field could read as Work, which took
  // the field's focus away and the keyboard with it.
  if (keyboard.held) return 'home';
  const middle = innerHeight / 2;
  let name = VIEWS[0];
  for (const v of VIEWS) if (screens[v].getBoundingClientRect().top <= middle) name = v;
  return name;
}
// The page is scrolled at all: the composer's blinking caret goes quiet
// (css/home.css), so nothing keeps asking for attention at the foot of Home
// while you read on down.
let spying = 0;
function onScroll() {
  spying = 0;
  frame.toggleAttribute('data-scrolled', scrollY > 4);
  setSection(whereAmI());
}
addEventListener('scroll', () => {
  if (!spying) spying = requestAnimationFrame(onScroll);
}, { passive: true });
frame.toggleAttribute('data-scrolled', scrollY > 4);
addEventListener('resize', () => { setSection(whereAmI()); fitPillStill(); });
document.fonts?.ready.then(fitPillStill);

// A change of the hash itself: a game opened or closed is Play's to handle.
// A link to another screen (a pill, the name, an address typed in) needs
// nothing from here: the browser has already gone there, and the page
// watching itself, above, follows.
function show(next, prev, { initial }) {
  if (initial) return;
  if (prev && prev.view === next.view) hooks[next.view]?.update?.(next, prev);
}

// ---- arriving ----
// Each screen's pieces (everything marked data-rise) rise into place by the
// page's one entrance the first time they come into view, a beat apart. They
// are held unseen until then (css/base.css, under html.rises), so none is
// caught standing there first; without script, nothing is held.
document.documentElement.classList.add('rises');
let booting = true;
const riser = new IntersectionObserver((entries) => {
  const now = entries.filter((e) => e.isIntersecting).map((e) => e.target);
  if (!now.length) return;
  for (const el of now) {
    riser.unobserve(el);
    el.classList.add('is-risen');
  }
  rise(now, { delay: booting ? 380 : 40, stagger: 50 });
}, { threshold: 0.12 });
for (const el of document.querySelectorAll('[data-rise]')) riser.observe(el);

// ---- boot ----
// The page opens where the address says (the browser takes a link to #work
// to the Work screen itself, and a reload back to wherever you were), and
// the first scroll the browser makes to get there puts everything else
// right.
const router = startRouter((next, prev, info) => show(next, prev, info));
// A game's address (#play/pong) names no element on the page, so the browser
// leaves a link to one at the top, on Home; take it to the Play screen, where
// the game opens (js/play/play.js).
if (router.current.game) screens[router.current.view].scrollIntoView({ block: 'start', behavior: 'instant' });
fitPillStill();
setSection(router.current.view, { initial: true });
// Once the page has loaded and the browser has put it back where it was, the
// window has the last word over the address: a reload restores the scroll,
// and if that disagrees with the hash, what you can see is where you are.
addEventListener('load', () => requestAnimationFrame(() => setSection(whereAmI())), { once: true });

playEntrance({ caret: prompt.caret, section }).then(() => {
  booting = false;
  // not over a conversation restored by a reload, which is there to be read
  if (section === 'home' && !frame.hasAttribute('data-chat')) prompt.focusIfDesk();
});

// Play's engine is the heaviest thing here, and nothing needs it until the
// Play screen comes into view. It is fetched when the browser is next idle
// (within two seconds, however busy it is), or the moment the Play screen
// comes within a screen of the window, whichever is first, and wired in when
// it arrives. (It waited for idle alone, which on a busy page can be never,
// and left the courts blank for whoever scrolled down to them.)
let playing = null;
function loadPlay() {
  if (playing) return playing;
  return (playing = import('./play/play.js').then(({ initPlay }) => {
    hooks.play = initPlay(views.play, { router });
    if (section === 'play') hooks.play.enter(router.current.view === 'play' ? router.current : { view: 'play', game: null }, null, { initial: true });
  }).catch((err) => console.warn('play did not load', err)));
}
if (router.current.view === 'play') loadPlay();
else {
  if (window.requestIdleCallback) requestIdleCallback(loadPlay, { timeout: 2000 });
  else setTimeout(loadPlay, 1200);
  const near = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { near.disconnect(); loadPlay(); }
  }, { rootMargin: '100% 0px' });
  near.observe(screens.play);
}

// About's foot: the icons that say where they go, and the email that copies
// itself (js/about.js).
initAbout(screens.about, { announcer: document.getElementById('announcer') });

if (new URLSearchParams(location.search).has('overlay')) {
  import('../tools/overlay.js');
}
