// pantry-home.js — Home (HomeScreen.swift), for the app the case study runs
// (pantry-app.js): the root of the stack once a chef has joined.
//
//   the welcome   an empty shelf asks what is in the kitchen, the pile of
//                 food tipping onto the counter the first time it shows; its
//                 two doors are the scanner and Type it in!, and either one
//                 holds the welcome behind it (AppState.welcomeHolds), so
//                 coming back finds it stocked, with "See what I can cook"
//   the seat      a shelf of three or more sets the chef writing
//                 (CateredPickStore): after the store's 0.7-second settle it
//                 asks the kitchen for two dishes made for the shelf, and
//                 the deck's first card is the seat they are on their way
//                 into, the pencil writing on it. The answer fills the seat
//                 if the chef is resting on it (commitCateredIfAtRest), or
//                 the moment they walk back to it; a kitchen that does not
//                 answer hands the seat to the book's top pick. What the
//                 kitchen wrote for a shelf is kept by the shelf, so going
//                 back to one takes it at once.
//   the deck      the two dishes made for the shelf, then the book's
//                 ranking, ten in all, swiped or stepped; each opens its
//                 recipe, and the wardrobe opens the shelf

import * as chef from './pantry-chef.js';
import * as kitchen from './pantry-kitchen.js';
import { HERE, h, img, reduced, SHUFFLE, SETTLE, DROP, GLYPH, cardHTML, fitLine, PIECES, seatHTML, runSeat, hydrate } from './pantry-draw.js';

const SEAT = Object.freeze({ seat: true });
// The seat stands at least as long as the pencil takes to write one whole
// menu and tick it (MenuScript, about eight seconds), so a kitchen that
// answers in four still shows the chef at work; the app's waits for the
// network, which on a phone is about that long.
const SEATED_MS = 8600;

export function buildHome(ctx) {
  const view = h('section', 'pp-view pp-home', { 'aria-label': 'Home', inert: '' });
  view.innerHTML = `
    ${img(`${HERE}chrome-home.webp`, 'pp-chrome is-deck')}
    ${img(`${HERE}chrome-welcome.webp`, 'pp-chrome is-welcome')}
    <button type="button" class="pp-hit is-logo" aria-label="Replay the tour"></button>
    <button type="button" class="pp-hit is-gear" aria-label="Settings"></button>
    <button type="button" class="pp-hit is-door" aria-label="My shelf"></button>
    <span class="pp-door-count" aria-hidden="true"></span>
    <div class="pp-welcome">
      <div class="pp-spill">
        ${PIECES.map(([name, x, y, w, a, t]) => `<img class="pp-piece" src="${HERE}art/${chef.slug(name)}.webp" alt="" decoding="async" draggable="false" style="--x: ${x}; --y: ${y}; --w: ${w}; --a: ${a}; --t: ${t}" />`).join('')}
        <p class="pp-band" role="heading" aria-level="2"><span class="pp-outlined">What’s in your kitchen?</span></p>
      </div>
      <button type="button" class="pp-btn pp-scan"></button>
      <button type="button" class="pp-btn pp-type"></button>
    </div>
    <p class="pp-rank">${img(`${HERE}hat.webp`)}<span></span></p>
    <div class="pp-deck"></div>
    <button type="button" class="pp-btn pp-go"></button>
    <div class="pp-row">
      <button type="button" class="pp-btn pp-prev" aria-label="Previous dish" hidden>${GLYPH.back}</button>
      <button type="button" class="pp-btn pp-next"><span>Next dish</span>${GLYPH.next}</button>
    </div>`;
  const $ = (s) => view.querySelector(s);
  const deckEl = $('.pp-deck');
  const rankWord = $('.pp-rank span');
  const count = $('.pp-door-count');
  const welcome = $('.pp-welcome');
  const band = $('.pp-band');
  const scan = $('.pp-scan');
  const type = $('.pp-type');
  const prev = $('.pp-prev');
  const next = $('.pp-next');
  const go = $('.pp-go');
  const st = () => ctx.state;
  const welcomeUp = () => st().shelf.length === 0 || st().held;

  // the session's catering: what the kitchen wrote for which shelf, the
  // shelves it would not write for, and the seat a dish is on its way into
  let shown = [];
  let answers = new Map();
  let refused = new Set();
  let seat = null;
  let deck = [];
  let index = 0;
  let spilled = false;
  let card = null;
  let dragging = false;

  view.querySelector('.is-logo').addEventListener('click', () => ctx.replayTour());
  view.querySelector('.is-gear').addEventListener('click', () => ctx.push('settings'));
  view.querySelector('.is-door').addEventListener('click', () => { if (!welcomeUp()) ctx.push('shelf'); });

  // ---- the deck (ChefBook.deck, and HomeScreen's cards over it) ----
  function build() {
    let cards = chef.deckFor(ctx.names(), ctx.book, shown, ctx.MEAL.key);
    if (seat && cards.length) cards = [SEAT, ...cards].slice(0, chef.DECK_SIZE);
    return cards;
  }
  // The deck's own task (HomeScreen.cater): a shelf the kitchen has written
  // for takes that answer at once; a new one of three or more sets a seat
  // and asks; anything less is the book alone.
  function write() {
    if (welcomeUp()) return;
    const names = ctx.names();
    const key = chef.shelfKey(names);
    if (seat && seat.key !== key) retire();
    if (answers.has(key)) { shown = answers.get(key); return; }
    shown = [];
    if (seat || names.length < chef.CATER_FROM || refused.has(key)) return;
    const token = {};
    const since = performance.now();
    seat = { key, landed: null, token };
    token.timer = setTimeout(async () => {
      let chosen = [];
      try {
        const raw = await kitchen.recipes(names, chef.CATERED_SLOTS);
        // made for this shelf, so cooked from it whole: a written dish that
        // asks for anything the shelf has not got (past the four staples)
        // does not take a seat
        chosen = chef.select(chef.reconcile(raw, names), names)
          .filter((r) => chef.pickFor(r, names).missing.length === 0);
        // the first dish's drawing is asked for as it lands (AppState's onCommitted)
        if (chosen[0]) kitchen.drawing(chosen[0].title, { dish: true });
      } catch {
        refused.add(key);
      }
      if (seat?.token !== token) return;
      await new Promise((done) => setTimeout(done, Math.max(0, SEATED_MS - (performance.now() - since))));
      if (seat?.token !== token) return;
      if (chosen.length) answers.set(key, chosen);
      seat.landed = chosen;
      atRest();
    }, 700);
  }
  function retire() {
    if (!seat) return;
    clearTimeout(seat.token.timer);
    seat = null;
  }
  // the answer fills the seat if the chef is resting on it, on Home
  function atRest() {
    if (seat?.landed && index === 0 && ctx.top() === api && !dragging) fill();
  }
  // The seat becomes the dish: the seat goes off toward the leading edge and
  // the dish comes in from the trailing one, on the deck's spring, as a
  // next dish does. An empty answer hands it to the book's top pick the same way.
  function fill() {
    if (!seat?.landed) return;
    shown = seat.landed;
    seat = null;
    deck = build();
    index = 0;
    show(-1);
    ctx.stage();
  }

  function paintRank() {
    // HomeScreen.badgeLabel: the seat says it is coming, the seats made for
    // the shelf are named for what they are, then the top of the book, then
    // where you are in the deck
    const c = deck[index];
    rankWord.textContent = c?.seat ? 'Coming right up' : c?.made ? 'Made for your shelf'
      : index === 0 ? 'Chef’s top pick' : `Pick ${index + 1} of ${deck.length}`;
    prev.hidden = index === 0;
    next.disabled = deck.length < 2;
    next.style.opacity = deck.length < 2 ? '0.5' : '';
    // the seat has no verb yet, so its button stands disabled, saying what
    // the chef is doing, rather than going
    const thinking = !!c?.seat;
    go.disabled = thinking;
    go.classList.toggle('is-thinking', thinking);
    go.innerHTML = `${GLYPH.pan}<span>${thinking ? 'Chef’s thinking…' : 'Start cooking'}</span>`;
    if (thinking) go.setAttribute('aria-label', 'The chef is still writing this one');
    else if (c) go.setAttribute('aria-label', `Start cooking, ${c.recipe.title}`);
  }
  function makeCard(p) {
    const el = h('div', p.seat ? 'pp-card is-seat' : `pp-card${p.stocked ? ' is-stocked' : ''}${p.missing.length ? ' is-short' : ''}`);
    el.innerHTML = p.seat ? seatHTML() : cardHTML(p);
    return el;
  }
  function fitCard(el) {
    const t = el.querySelector('.pp-title .pp-outlined');
    if (t) fitLine(t, 0.55);
  }
  // the dishes either side of the one on top are fetched before they are asked for
  function warm() {
    for (const k of [index + 1, index + 2, index - 1]) {
      const p = deck[(k + deck.length) % deck.length];
      if (p && !p.seat) kitchen.drawing(p.recipe.title, { dish: true });
    }
  }

  // The welcome's two doors. On an empty shelf they are the two ways to fill
  // it; once the welcome holds a shelf they are the way forward and the way
  // to add more, the primary changing hands and the secondary keeping its
  // slot (and its 16, where "Type my groceries" wears the primary's 20).
  function paintWelcome() {
    const stocked = st().shelf.length > 0;
    scan.innerHTML = stocked ? `${GLYPH.fork}<span>See what I can cook</span>` : `${GLYPH.camera}<span>Scan my groceries</span>`;
    type.innerHTML = `${GLYPH.list}<span>${stocked ? 'Add more groceries' : 'Type my groceries'}</span>`;
    type.classList.toggle('is-more', stocked);
  }
  function paintEmpty(up) {
    view.classList.toggle('is-empty', up);
    for (const el of [rankWord.parentElement, deckEl, go, prev.parentElement, view.querySelector('.is-door')]) el.inert = up;
    welcome.inert = !up;
    paintWelcome();
  }
  // the pile falls the first time the welcome shows in a session, as the
  // app plays it once a launch
  function spill() {
    if (spilled || !welcomeUp()) return;
    spilled = true;
    if (reduced()) return;
    const k = ctx.pt();
    welcome.querySelectorAll('.pp-piece').forEach((piece, i) => {
      const t = Number(piece.style.getPropertyValue('--t'));
      piece.animate([
        { translate: `0 ${-620 * k}px`, rotate: `${t - 20}deg`, opacity: 0 },
        { translate: '0 0', rotate: `${t}deg`, opacity: 1 },
      ], { ...DROP, delay: i * 55, fill: 'backwards' });
    });
    // the question arrives after the mess, so it reads as an answer to it
    band.animate([
      { translate: `0 ${-330 * k}px`, rotate: '-16deg', opacity: 0 },
      { translate: '0 0', rotate: '-3.5deg', opacity: 1 },
    ], { ...DROP, delay: PIECES.length * 55 + 100, fill: 'backwards' });
  }

  // Put a card on top. `dir` is where the old one goes: -1 toward the
  // leading edge (the next dish, or the seat filling), 1 toward the
  // trailing edge (the one before), 0 swapped in place (the shelf changed
  // under it); `from` is where a hand let it go; `instant` swaps it with
  // nothing thrown, for a deck nobody can see.
  function show(dir = 0, from = null, instant = false) {
    const p = deck[index];
    const focused = card?.contains(document.activeElement);
    paintEmpty(welcomeUp());
    paintRank();
    const leaving = card;
    if (!p || welcomeUp()) {
      if (leaving) leaving.remove();
      card = null;
      return;
    }
    card = makeCard(p);
    deckEl.append(card);
    fitCard(card);
    bindDrag(card);
    if (p.seat) runSeat(card);
    else hydrate(card);
    warm();
    ctx.live(p.seat ? 'Coming right up: the chef is writing a dish for your shelf.'
      : `${rankWord.textContent}: ${p.recipe.title}. ${p.stocked ? 'Everything is on your shelf.' : `Missing ${p.missing.length}.`}`);
    if (focused) card.querySelector('.pp-card-open').focus({ preventScroll: true });
    if (!leaving) return;
    leaving.inert = true;
    if (instant) { leaving.remove(); return; }
    if (reduced()) {
      leaving.remove();
      card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
      return;
    }
    if (dir === 0) {
      leaving.animate([{ opacity: 1 }, { opacity: 0, scale: 0.96 }], { duration: 180, easing: 'ease-out', fill: 'forwards' })
        .finished.then(() => leaving.remove(), () => leaving.remove());
      card.animate([{ opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1 }], { duration: 420, easing: 'cubic-bezier(0.3, 1.3, 0.5, 1)', delay: 60, fill: 'backwards' });
      return;
    }
    // The deck's own move (HomeScreen.slotted): the card going slides off
    // toward the edge it is going to and fades, the next slides in from the
    // other edge and fades up, both on the deck's spring.
    const w = view.clientWidth;
    const off = from ? `${from.x}px ${from.y}px` : '0px 0px';
    leaving.style.pointerEvents = 'none';
    leaving.animate([{ translate: off, opacity: 1 }, { translate: `${dir * w}px 0px`, opacity: 0 }], { ...SHUFFLE, fill: 'forwards' })
      .finished.then(() => leaving.remove(), () => leaving.remove());
    card.animate([{ translate: `${-dir * w}px 0px`, opacity: 0 }, { translate: '0px 0px', opacity: 1 }], { ...SHUFFLE, fill: 'backwards' });
  }
  // On down the ranking, wrapping from the last dish to the top; or back up
  // it, which stops at the top. Walking back onto a seat whose dish has
  // landed takes the dish, once the walk has settled.
  function advance(step, from) {
    if (deck.length < 2) return;
    if (step < 0 && index === 0) return;
    index = (index + step + deck.length) % deck.length;
    show(step > 0 ? -1 : 1, from);
    ctx.stage();
    if (index === 0 && seat?.landed) setTimeout(atRest, reduced() ? 0 : SHUFFLE.duration);
  }

  // The card follows a hand along whichever way it is going, damped to a
  // little over half, and thrown further than 56 points it is the next dish
  // (left, or up) or the one before (right, or down); short of that it
  // springs back (HomeScreen.cardSwipe). A touch listens sideways only.
  function bindDrag(el) {
    let start = null;
    let axis = null;
    let travel = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.pp-missing')) return;
      start = { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' };
      axis = null;
      travel = 0;
    });
    el.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!axis) {
        if (Math.hypot(dx, dy) < 24 * ctx.pt()) return;
        axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        if (axis === 'y' && start.touch) { start = null; axis = null; return; }
        el.setPointerCapture(e.pointerId);
        dragging = true;
      }
      travel = axis === 'x' ? dx : dy;
      let pull = travel;
      if (pull > 0 && index === 0) pull /= 3;
      if (pull < 0 && deck.length < 2) pull /= 3;
      const d = (pull * 0.55).toFixed(1);
      el.style.translate = axis === 'x' ? `${d}px 0px` : `0px ${d}px`;
    });
    const end = () => {
      if (!start) return;
      const moved = axis;
      start = null;
      axis = null;
      dragging = false;
      if (!moved) return;
      el.addEventListener('click', (c) => { c.stopImmediatePropagation(); c.preventDefault(); }, { capture: true, once: true });
      const at = el.style.translate || '0px 0px';
      const [fx = 0, fy = 0] = at.split(' ').map((v) => parseFloat(v) || 0);
      el.style.translate = '';
      if (Math.abs(travel) > 56 * ctx.pt()) {
        if (travel < 0) { advance(1, { x: fx, y: fy }); return; }
        if (index > 0) { advance(-1, { x: fx, y: fy }); return; }
      }
      if (!reduced()) el.animate([{ translate: at }, { translate: '0px 0px' }], SETTLE);
      atRest();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    const opener = el.querySelector('.pp-card-open');
    opener.addEventListener('click', () => open());
    opener.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); advance(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); advance(-1); }
    });
    // every gap at once, filed on a page of their own ("On the shelf!")
    el.querySelector('.pp-missing')?.addEventListener('click', () => {
      const p = deck[index];
      if (!p || p.seat) return;
      ctx.push('typein', { batch: p.missing });
    });
  }

  // The shelf changed (HomeScreen's onChange of the pantry): back to the top
  // of the deck for the new shelf, the old shelf's seat retired, and what
  // the kitchen wrote for this shelf before taken back if there is any.
  function changed() {
    if (seat && seat.key !== chef.shelfKey(ctx.names())) retire();
    index = 0;
    write();
    deck = build();
    paintDoor();
    count.classList.remove('is-bumped');
    void count.offsetWidth;
    count.classList.add('is-bumped');
    if (ctx.top() === api) show(0);
    else show(0, null, true);
    ctx.stage();
  }
  function paintDoor() {
    count.textContent = String(st().shelf.length);
  }

  next.addEventListener('click', () => advance(1));
  prev.addEventListener('click', () => advance(-1));
  go.addEventListener('click', () => open());
  function open() {
    const p = deck[index];
    if (!p || p.seat || ctx.top() !== api) return;
    ctx.push('cook', p.recipe);
  }

  // ---- the welcome's doors ----
  scan.addEventListener('click', () => {
    if (st().shelf.length) {
      // the welcome lets go, and the deck is what Home is now
      st().held = false;
      index = 0;
      write();
      deck = build();
      show(0, null, true);
      paintDoor();
      ctx.stage();
      return;
    }
    st().held = true;
    ctx.push('scanner');
  });
  type.addEventListener('click', () => {
    if (!st().shelf.length) st().held = true;
    ctx.push('typein', {});
  });

  const api = {
    name: 'home',
    view,
    changed,
    enter() { paintDoor(); deck = build(); show(0, null, true); },
    shown() { spill(); },
    // back on top: the welcome or the deck as the shelf now is, the chef
    // writing for it, and a dish that landed while away taken at rest
    uncover() {
      write();
      deck = build();
      if (index >= deck.length) index = 0;
      show(0, null, true);
      paintDoor();
      spill();
      setTimeout(atRest, reduced() ? 0 : 480);
    },
    // "See what I can cook" from the page that held the welcome
    release() {
      st().held = false;
      index = 0;
      write();
      deck = build();
      show(0, null, true);
      paintDoor();
    },
    stage() {
      if (welcomeUp()) return 'welcome';
      return deck[index]?.seat ? 'cooking' : 'deck';
    },
    reset() {
      retire();
      shown = [];
      answers = new Map();
      refused = new Set();
      index = 0;
      spilled = false;
      deck = [];
      card?.remove();
      card = null;
    },
    resize() {
      if (card) fitCard(card);
      fitLine(band.firstElementChild, 0.7);
    },
  };
  return api;
}
