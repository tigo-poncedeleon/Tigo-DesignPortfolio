// pantry-app.js — PantryPal, the App Store build rebuilt for the browser and
// running on its case study, from the phone's home screen to dinner.
//
// A visitor finds the phone on its home screen and opens PantryPal from its
// icon; from there it is the app a new chef meets, screen for screen and in
// the app's own order: the cold open, the Kitchen Pass, the tour, "Hey,
// chef!", the scanner and Type it in!, the deck, the shelf behind the
// wardrobe, My recipes, a recipe, and Settings behind the chef. Every screen
// does what the app's does, and the kitchen behind them is the app's: a scan
// is read, and the two dishes at the front of the deck are written, by the
// same proxy and the same Gemini prompts the App Store build calls
// (pantry-kitchen.js, through the page's relay, api/pantry.js), and a food
// the app has no drawing of is drawn by the same art store.
//
// What is the app's and what is drawn here:
//   the chrome    the header and each title band are the app's own pixels,
//                 cropped from its captures (chrome-*.webp, tools/
//                 pantry-app.sh); everything under them is drawn here from
//                 the Swift source's own numbers, and checked against the
//                 1.3 build's captures on an iPhone 16, measured to the point
//   the logic     pantry-chef.js, a port of ChefBook, IngredientName,
//                 IngredientCategory and KnownIngredients
//   the motion    the app's springs, sampled into CSS (pantry-draw.js):
//                 the cold open's beats (LaunchCurtain), the tour's falling
//                 tickets, the deck, the spill, the navigation stack's push
//   the phone     the home screen, the window opening from its icon, the
//                 keyboard (pantry-keys.js) and the alerts are the system's,
//                 drawn to look like iOS 26 on an iPhone 16; their glyphs and
//                 icons are drawn here, never Apple's
//   left out      the camera (each scan door takes a picture the page
//                 carries instead, and "Choose from library" a real file),
//                 the Season Pass and its paywall (every shelf is free), and
//                 a second chef's picker
//
// mountPantryApp(el, { book, artIndex }) returns { restart(), stage(),
// on(type, fn) } and emits 'stage' with the screen on top. Nothing on it
// points at what to press: a visitor finds their own way, as a new chef does.

import * as chef from './pantry-chef.js';
import { createKeyboard } from './pantry-keys.js';
import { HERE, h, esc, img, spring, reduced, setStill } from './pantry-draw.js';
import { buildHome } from './pantry-home.js';
import { buildScreens } from './pantry-screens.js';

// The phone reads 9:41, the App Store's own minute, and the meal it is in
// the evening is dinner: every word the app says for it (MealTime.swift).
export const MEAL = {
  noun: 'dinner', band: 'Dinner!', possessive: 'tonight’s', leading: 'Tonight’s',
  header: 'DINNER TIME', flap: 'DINNER MADE', showcase: 'Cheddar Cheeseburger', key: 'dinner',
};

// the window opening out of its icon
const OPEN = spring(0.5, 0.86);
// the navigation stack's push, and a pop is the same run backwards
const PUSH = { duration: 460, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };

// the home screen's slots, four to a row on the iPhone 16's grid (an icon 63
// across, every 91 along and 98.7 down), and PantryPal's in the sixth row,
// fourth column, where it sits on Tigo's phone
const SLOT = (c, r) => `left: calc(${(28.5 + c * 91).toFixed(1)} * var(--pt)); top: calc(${(80.4 + r * 98.7).toFixed(1)} * var(--pt))`;
const HUES = [208, 32, 140, 350, 262, 190, 18, 96, 228, 320, 170, 48, 280, 8, 120, 200, 300, 60, 240, 150, 0, 210, 36];
const DOCK = [35, 121.3, 208, 294.5];

export function mountPantryApp(root, { book, artIndex, announce = true }) {
  chef.useArt(artIndex);
  const listeners = {};
  const emit = (type, detail) => (listeners[type] || []).forEach((fn) => fn(detail));

  let slots = '';
  let n = 0;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      if (r === 5 && c === 3) {
        slots += `<button type="button" class="pp-appicon" style="${SLOT(c, r)}" aria-label="PantryPal">${img(`${HERE}app-icon.webp`)}<span>PantryPal</span></button>`;
      } else {
        slots += `<span class="pp-icon" style="${SLOT(c, r)}; --h: ${HUES[n++ % HUES.length]}" aria-hidden="true"></span>`;
      }
    }
  }
  root.classList.add('pp-device');
  root.innerHTML = `
    <div class="pp-screen is-board">
      <div class="pp-board" role="group" aria-label="Home Screen">
        <span class="pp-wall" aria-hidden="true"></span>
        ${slots}
        <span class="pp-search" aria-hidden="true"><svg viewBox="0 0 16 16"><circle cx="6.8" cy="6.8" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m10.6 10.6 4 4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>Search</span>
        <span class="pp-dock" aria-hidden="true">${DOCK.map((x, i) => `<span class="pp-icon" style="left: calc(${x - 12.8} * var(--pt)); --h: ${HUES[(i * 5 + 3) % HUES.length]}"></span>`).join('')}</span>
      </div>
      <div class="pp-app" inert>
        <div class="pp-stack"></div>
        <div class="pp-layer"></div>
      </div>
      <img class="pp-status is-light" src="${HERE}statusbar-light.webp" alt="" aria-hidden="true" />
      <img class="pp-status is-dark" src="${HERE}statusbar-dark.webp" alt="" aria-hidden="true" />
      <span class="pp-island" aria-hidden="true"></span>
    </div>
    <img class="pp-frame" src="${HERE}frame.webp" alt="" draggable="false" />
    <p class="pp-live"${announce ? ' aria-live="polite"' : ''}></p>`;

  const $ = (s) => root.querySelector(s);
  const screen = $('.pp-screen');
  const board = $('.pp-board');
  const icon = $('.pp-appicon');
  const appEl = $('.pp-app');
  const stackEl = $('.pp-stack');
  const layer = $('.pp-layer');
  const liveEl = $('.pp-live');
  const kbd = createKeyboard(appEl);
  // one of the app's points, in pixels, as the screen is drawn now
  const pt = () => screen.clientWidth / 393;

  // ---- the session (KitchenSession, AuthStore, AppState) ----
  // A cold launch starts it, and "Start over" is one: a new chef's phone,
  // the shelf empty, nobody signed in.
  const fresh = () => ({
    chef: null, chefs: 0, shelf: [], held: false, generated: [], kept: [],
    seenTour: false, seenDisclaimer: false, haptics: true, animations: true, nextId: 1,
  });
  let state = fresh();

  const ctx = {
    book, MEAL, root, screen, appEl, layer, kbd, pt,
    get state() { return state; },
    live(text) { liveEl.textContent = text; },
    emit,
    names: () => state.shelf.map((s) => s.name),
    has: (name) => state.shelf.some((s) => s.name.toLowerCase() === name.toLowerCase()),
    // a food onto the shelf, its quantity added to a row of the same name on
    // the same shelf if there is one (ManualAddScreen.add, ScannerScreen.commit)
    add(name, shelf = chef.shelfOf(name), quantity = 1) {
      const row = state.shelf.find((s) => s.name.toLowerCase() === name.toLowerCase() && s.shelf === shelf);
      if (row) { row.quantity += quantity; return row; }
      const made = { id: state.nextId++, name, shelf, quantity, selected: false };
      state.shelf.push(made);
      return made;
    },
    remove(rows) {
      const gone = new Set(rows);
      state.shelf = state.shelf.filter((s) => !gone.has(s));
    },
    // the shelf changed under the deck (HomeScreen's onChange of the pantry)
    changed(added = []) { home.changed(added); emit('shelf'); },
    push, pop, popToRoot, popTo, replayTour, top: () => stack[stack.length - 1],
    depth: () => stack.length,
    alert, stage,
    // the chrome every pushed screen wears: the capture's pixels, and the
    // presses on them (the logo replays the tour, the chef opens Settings)
    chromeView(cls, file, { label, back, logo = true, gear = true } = {}) {
      const view = h('section', `pp-view ${cls}`, { 'aria-label': label, inert: '' });
      view.innerHTML = `${img(`${HERE}${file}`, 'pp-chrome')}`
        + (logo ? '<button type="button" class="pp-hit is-logo" aria-label="Replay the tour"></button>' : '')
        + (gear ? '<button type="button" class="pp-hit is-gear" aria-label="Settings"></button>' : '')
        + (back ? '<button type="button" class="pp-hit is-back" aria-label="Back"></button>' : '');
      if (logo) view.querySelector('.is-logo').addEventListener('click', () => replayTour());
      if (gear) view.querySelector('.is-gear').addEventListener('click', () => push('settings'));
      if (back) view.querySelector('.is-back').addEventListener('click', () => back());
      return view;
    },
    // the app's own Animations switch, on top of the system's setting
    setAnimations(on) {
      state.animations = on;
      setStill(!on);
      root.classList.toggle('is-still', !on);
    },
    // Delete this chef: nobody is left on the phone, so the pass again
    signOut() { coldStart(); stage(); },
    releaseHome: () => home.release(),
  };

  const home = buildHome(ctx);
  const screens = { home, ...buildScreens(ctx) };
  for (const s of Object.values(screens)) {
    stackEl.append(s.view);
  }

  // ---- the navigation stack (AppState.path) ----
  // Each screen is one view, pushed over the one under it as SwiftUI's
  // NavigationStack pushes: the new one slides in from the trailing edge
  // while the one under it drifts a third of the way left and dims.
  let stack = [];
  function slide(view, under, forward, instant) {
    const o = { ...PUSH, duration: instant || reduced() ? 1 : PUSH.duration, fill: 'forwards' };
    view.getAnimations().forEach((a) => a.cancel());
    const a = view.animate(forward
      ? [{ translate: '100% 0', boxShadow: '0 0 0 rgb(0 0 0 / 0)' }, { translate: '0 0', boxShadow: '-12px 0 28px rgb(0 0 0 / 0.14)' }]
      : [{ translate: '0 0' }, { translate: '100% 0' }], o);
    if (under) {
      under.getAnimations().forEach((x) => x.cancel());
      under.animate(forward
        ? [{ translate: '0 0', filter: 'brightness(1)' }, { translate: '-30% 0', filter: 'brightness(0.9)' }]
        : [{ translate: '-30% 0', filter: 'brightness(0.9)' }, { translate: '0 0', filter: 'brightness(1)' }], o);
    }
    return a.finished.catch(() => {});
  }
  function settle(view, on) {
    view.getAnimations().forEach((a) => a.cancel());
    view.classList.toggle('is-on', on);
    view.inert = !on;
  }
  function push(name, arg, { instant = false } = {}) {
    const s = screens[name];
    if (!s || stack.includes(s)) return;
    if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
    const under = stack[stack.length - 1];
    stack.push(s);
    s.enter?.(arg);
    s.view.classList.add('is-on');
    s.view.style.zIndex = String(stack.length);
    s.view.inert = false;
    if (under) { under.view.inert = true; under.cover?.(); }
    slide(s.view, under?.view, true, instant).then(() => {
      if (stack[stack.length - 1] === s) s.shown?.();
    });
    stage();
  }
  // Back to a depth: the top screen slides away over the one it returns to,
  // and anything between them goes with it.
  function popTo(depth) {
    if (stack.length <= depth) return;
    if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
    const top = stack[stack.length - 1];
    const gone = stack.splice(depth);
    const under = stack[stack.length - 1];
    for (const s of gone) if (s !== top) { s.leave?.(); settle(s.view, false); }
    top.leave?.();
    top.view.inert = true;
    under.view.inert = false;
    under.view.classList.add('is-on');
    slide(top.view, under.view, false).then(() => {
      if (!stack.includes(top)) settle(top.view, false);
    });
    under.uncover?.();
    stage();
  }
  function pop() { popTo(stack.length - 1); }
  function popToRoot() { popTo(1); }
  // the logo: the tour again, over Home (AppState.replayTour)
  function replayTour() {
    if (stack[stack.length - 1] === screens.howto) return;
    const gone = stack.splice(1);
    for (const s of gone) { s.leave?.(); settle(s.view, false); }
    stack[0].view.inert = false;
    push('howto');
  }
  // the root changes hands, as RootView's gate does when a chef joins
  function setRoot(name) {
    for (const s of stack) { s.leave?.(); settle(s.view, false); }
    const s = screens[name];
    stack = [s];
    s.enter?.();
    settle(s.view, true);
    s.view.style.zIndex = '1';
    s.shown?.();
  }
  ctx.setRoot = setRoot;
  // Joining: Home is the root from now on, and the tour goes on top of it
  // for a chef who has not seen it (AppState.enterApp)
  ctx.enterApp = (name) => {
    state.chef = name;
    state.chefs += 1;
    const signup = stack[stack.length - 1];
    const s = screens.howto;
    for (const x of stack) if (x !== signup && x !== home) { x.leave?.(); settle(x.view, false); }
    stack = [home];
    home.enter();
    home.view.classList.add('is-on');
    home.view.style.zIndex = '1';
    home.view.inert = true;
    stack.push(s);
    s.enter();
    s.view.classList.add('is-on');
    s.view.style.zIndex = '3';
    s.view.inert = false;
    signup.view.style.zIndex = '2';
    slide(s.view, signup.view, true).then(() => { settle(signup.view, false); signup.view.style.zIndex = ''; s.shown?.(); });
    stage();
  };

  // Add a chef: a new chef has a shelf of their own, which starts empty
  ctx.newChef = (name) => {
    const keep = { chefs: state.chefs, haptics: state.haptics, animations: state.animations, nextId: state.nextId };
    state = { ...fresh(), ...keep };
    home.reset();
    ctx.enterApp(name);
  };

  // ---- alerts (the system's, as iOS 26 draws one) ----
  function alert({ title, message = '', buttons }) {
    const panel = h('div', 'pp-alert', { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title });
    panel.innerHTML = `<div class="pp-alert-box"><p class="pp-alert-title">${esc(title)}</p>${message ? `<p class="pp-alert-msg">${esc(message)}</p>` : ''}`
      + `<div class="pp-alert-btns${buttons.length > 2 ? ' is-stacked' : ''}">${buttons.map((b, i) => `<button type="button" class="pp-alert-btn${b.role ? ` is-${b.role}` : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    layer.append(panel);
    const close = () => {
      if (reduced()) { panel.remove(); return; }
      panel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out' }).finished.then(() => panel.remove(), () => panel.remove());
    };
    panel.querySelectorAll('.pp-alert-btn').forEach((b) => b.addEventListener('click', () => {
      close();
      buttons[Number(b.dataset.i)].action?.();
    }));
    if (!reduced()) {
      panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      panel.firstElementChild.animate([{ scale: 1.12 }, { scale: 1 }], spring(0.3, 0.8));
    }
    panel.querySelector('.pp-alert-btn').focus({ preventScroll: true });
  }

  // ---- the phone: the home screen, and the window opening from the icon ----
  let running = false;
  let inApp = false;
  let moving = null;
  // a cold launch: a session begins (the shelf wiped before the first frame)
  // and the gate roots the stack on the pass, nobody having joined yet
  function coldStart() {
    for (const s of Object.values(screens)) s.reset?.();
    layer.innerHTML = '';
    kbd.detach();
    const animations = state.animations;
    state = fresh();
    ctx.setAnimations(animations);
    stack = [];
    for (const s of Object.values(screens)) settle(s.view, false);
    setRoot('signup');
    running = true;
  }
  function iconBox() {
    const r = icon.getBoundingClientRect();
    const s = screen.getBoundingClientRect();
    return { x: r.left - s.left, y: r.top - s.top, k: r.width / s.width };
  }
  function openApp() {
    if (moving || inApp) return;
    const cold = !running;
    if (cold) coldStart();
    inApp = true;
    screen.classList.remove('is-board');
    appEl.inert = false;
    board.inert = true;
    appEl.classList.add('is-open');
    if (cold) curtain();
    const { x, y, k } = iconBox();
    const r = 14 * pt();
    const glyph = h('img', 'pp-launch-icon', { src: `${HERE}app-icon.webp`, alt: '' });
    appEl.append(glyph);
    if (reduced()) {
      glyph.remove();
      appEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      afterOpen(cold);
      return;
    }
    moving = appEl.animate([
      { transform: `translate(${x}px, ${y}px) scale(${k})`, borderRadius: `${r / k}px` },
      { transform: 'none', borderRadius: `${(55 * pt()).toFixed(1)}px` },
    ], { ...OPEN, fill: 'none' });
    glyph.animate([{ opacity: 1 }, { opacity: 1, offset: 0.12 }, { opacity: 0, offset: 0.4 }, { opacity: 0 }], { duration: OPEN.duration, fill: 'forwards' });
    board.animate([{ scale: 1, filter: 'blur(0px)' }, { scale: 1.12, filter: 'blur(6px)' }], { duration: OPEN.duration * 0.6, easing: 'ease-out', fill: 'forwards' });
    moving.finished.catch(() => {}).then(() => { moving = null; glyph.remove(); afterOpen(cold); });
  }
  function afterOpen(cold) {
    stage();
    if (!cold) stack[stack.length - 1]?.shown?.();
  }
  icon.addEventListener('click', openApp);

  // ---- the cold open (LaunchCurtain) ----
  // The lockup at rest in the middle of the sky: the tomato hops and lands,
  // the blob grows out of it, the wordmark's two lines drop in, the chef
  // swings in from the right, and the whole lockup seats into the pass's
  // large header as the sky shrinks to it, the scallops landing last. Then
  // the header the screen wears takes over, and the curtain is gone. Every
  // beat is the app's, in seconds from the first frame.
  function curtain() {
    const c = h('div', 'pp-curtain', { 'aria-hidden': 'true' });
    c.innerHTML = `<span class="pp-csky"></span><div class="pp-lockup">`
      + '<svg class="pp-cscallop" viewBox="0 0 393 24.56" preserveAspectRatio="none">'
      + scallops() + '</svg><span class="pp-lsky"></span>'
      + `${img(`${HERE}logo-blob.webp`, 'pp-cblob')}`
      + '<span class="pp-cword is-one">Pantry</span><span class="pp-cword is-two">Pal</span>'
      + `<span class="pp-cring"></span>${img(`${HERE}logo-icon.webp`, 'pp-ctomato')}${img(`${HERE}mascot.webp`, 'pp-cchef')}</div>`;
    appEl.append(c);
    const q = (s) => c.querySelector(s);
    const k = pt();
    const H = screen.clientHeight / k;
    const restX = 393 / 2 - 184;
    const restY = H / 2 - 162;
    const lockup = q('.pp-lockup');
    const at = (beat) => ({ delay: beat * 1000, fill: 'both' });
    const sp = (response, damping, beat) => ({ ...spring(response, damping), ...at(beat) });
    if (reduced()) {
      lockup.style.translate = '0 0';
      q('.pp-csky').style.scale = `1 ${213 / H}`;
      c.classList.add('is-seated');
      setTimeout(() => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-out', fill: 'forwards' }).finished.then(() => c.remove()), 200);
      return;
    }
    lockup.style.translate = `${restX * k}px ${restY * k}px`;
    // the hop: crouch, launch, hang, fall, and the landing's squash
    q('.pp-ctomato').animate([
      { translate: '0 0', scale: '1 1', easing: 'ease-in-out' },
      { translate: '0 0', scale: '1.16 0.84', offset: 0.09 / 0.52, easing: 'ease-out' },
      { translate: `0 ${-54 * k}px`, scale: '0.92 1.13', offset: 0.23 / 0.52, easing: 'ease-in-out' },
      { translate: `0 ${-38 * k}px`, scale: '0.94 1.1', offset: 0.3 / 0.52, easing: 'ease-in' },
      { translate: '0 0', scale: '1.2 0.8', offset: 0.38 / 0.52, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
      { translate: '0 0', scale: '1 1' },
    ], { duration: 520, fill: 'both' });
    q('.pp-cring').animate([
      { scale: 0.55, opacity: 0.85 },
      { scale: 1.8, opacity: 0 },
    ], { duration: 340, easing: 'cubic-bezier(0.3, 0.6, 0.4, 1)', ...at(0.38) });
    q('.pp-cblob').animate([{ scale: '0 1' }, { scale: '1 1' }], sp(0.26, 0.78, 0.42));
    q('.pp-cword.is-one').animate([{ translate: `0 ${-18 * k}px`, opacity: 0 }, { translate: '0 0', opacity: 1 }], sp(0.24, 0.68, 0.48));
    q('.pp-cword.is-two').animate([{ translate: `0 ${-18 * k}px`, opacity: 0 }, { translate: '0 0', opacity: 1 }], sp(0.24, 0.68, 0.55));
    q('.pp-cchef').animate([{ translate: `${104 * k}px 0`, rotate: '-9deg', opacity: 0 }, { translate: '0 0', rotate: '0deg', opacity: 1 }], sp(0.34, 0.7, 0.56));
    q('.pp-cscallop').animate([{ translate: `0 ${-10 * k}px`, opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 220, easing: 'ease-out', ...at(1.06) });
    const seat = sp(0.46, 0.88, 0.8);
    lockup.animate([{ translate: `${restX * k}px ${restY * k}px` }, { translate: '0 0' }], seat);
    q('.pp-csky').animate([{ scale: '1 1' }, { scale: `1 ${213 / H}` }], seat);
    // the seat settles; a tenth of a second on, the screen's own header
    setTimeout(() => {
      c.remove();
      stage();
    }, (0.8 + seat.duration / 1000 + 0.1) * 1000);
  }
  // the header's scallops (ScallopedBorder, .header): the coral row on its
  // hairline, under a row of sky ones that cut it into bumps
  function scallops() {
    let s = '';
    for (const [phase, y, fill] of [[5 - 24, 8.5, '#ff4b4b'], [-7 - 24, 0, '#b8edf8']]) {
      for (let x = phase; x < 393; x += 24) s += `<ellipse cx="${x + 12}" cy="${y + 8.03}" rx="12" ry="8.03" fill="${fill}" stroke="#000" stroke-width="1"/>`;
    }
    return s;
  }

  // ---- where the phone is ----
  let staged = null;
  function stageName() {
    if (!inApp) return 'board';
    if (appEl.querySelector('.pp-curtain')) return 'launch';
    const top = stack[stack.length - 1];
    return top?.stage?.() || top?.name || 'app';
  }
  function stage() {
    const s = stageName();
    if (s === staged) return;
    staged = s;
    emit('stage', s);
  }

  // A new phone, as "Start over" makes it: the app closed and forgotten,
  // the home screen, and PantryPal on it to open for the first time.
  function restart() {
    for (const a of [...appEl.getAnimations(), ...board.getAnimations()]) a.cancel();
    moving = null;
    appEl.querySelector('.pp-curtain')?.remove();
    appEl.querySelector('.pp-launch-icon')?.remove();
    kbd.detach();
    inApp = false;
    running = false;
    board.inert = false;
    appEl.inert = true;
    appEl.classList.remove('is-open');
    screen.classList.add('is-board');
    if (!reduced()) screen.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    ctx.live('Home Screen. PantryPal is on it.');
    staged = null;
    stage();
  }

  new ResizeObserver(() => {
    for (const s of Object.values(screens)) s.resize?.();
  }).observe(root);
  document.fonts?.ready.then(() => { for (const s of Object.values(screens)) s.resize?.(); });
  stage();

  return {
    restart,
    stage: stageName,
    on(type, fn) { (listeners[type] ||= []).push(fn); },
  };
}
