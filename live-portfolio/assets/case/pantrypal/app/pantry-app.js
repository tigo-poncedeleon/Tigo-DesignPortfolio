// pantry-app.js — PantryPal, running on its case study: the Home screen's
// chef's pick and the Recipe screen behind it, in the app's own fonts,
// colours and art (pantry-app.css), ranked against a shelf the page hands it.
//
// What is the app's and what is drawn here:
//   the ranking   a straight port of App/Sources/Services/ChefBook.swift and
//                 IngredientName.swift, rule for rule: the plural fold on the
//                 last word, the shelf index's one-direction bare-noun rule
//                 ("Pasta" is satisfied by "Rigatoni Pasta", never the other
//                 way round), the four staples that sit outside coverage, and
//                 the six tie-breaks. The deck is ten, as the app's is.
//   the book      App/Resources/ChefBook.json, the fifty bundled dishes
//                 (chefbook.json), each with its own bundled art (art/)
//   the chrome    the header and each title band are the app's own pixels,
//                 cropped from its App Store captures; the chip, the card,
//                 the buttons and the whole recipe are drawn here, from
//                 DishCard.swift and CookScreen.swift's own numbers
//   left out      the AI's catered picks (the real app asks Gemini for two
//                 dishes written for this shelf and pins them first; here
//                 the bundled book answers alone, which is what the app does
//                 offline), and the Season Pass card that shares the deck
//
// mountPantryApp(el, { book, shelf, announce }) builds the phone into el and
// returns { setShelf(names), deck(), index(), advance(step), open(), back(),
// on(event, fn) }; it emits 'change' with the new deck whenever the shelf
// does, 'pick' as the deck is walked, and 'open' / 'back' as the screens
// change. It says what is on top in a live region of its own unless told
// not to (announce: false), for a page that already says so itself.

const HERE = new URL('.', import.meta.url).href;
const ART = (name) => `${HERE}art/${slug(name)}.webp`;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ======================================================================
// the chef's logic (ChefBook.swift), ported
// ======================================================================

// EXACTLY the four basics the proxy's recipe prompt names, and nothing a
// person would actually shop for: butter, garlic and soy sauce are real
// shopping. Whole match keys, because "Bell Pepper" folds to "pepper".
const STAPLES = new Set([
  'salt', 'sea salt', 'kosher salt', 'table salt',
  'pepper', 'black pepper', 'ground black pepper', 'white pepper',
  'water', 'cold water', 'warm water',
  'oil', 'olive oil', 'extra virgin olive oil', 'vegetable oil',
  'canola oil', 'cooking oil', 'neutral oil',
]);
// modifiers that make a different food, not a variety of the same one:
// peanut butter is not butter, and coconut milk is not milk
const SUBSTITUTES = new Set(['peanut', 'almond', 'cashew', 'coconut', 'oat', 'soy', 'apple', 'cocoa', 'ice']);

export function singularized(word) {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes')) return word.slice(0, -2);
  for (const s of ['xes', 'zes', 'ches', 'shes']) if (word.endsWith(s)) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss') && !word.endsWith('us')
      && !word.endsWith('is') && !word.endsWith('sses')) return word.slice(0, -1);
  return word;
}
// lowercase, whitespace collapsed, the LAST word folded to its singular
export function matchKey(name) {
  const words = name.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  words[words.length - 1] = singularized(words[words.length - 1]);
  return words.join(' ');
}

class ShelfIndex {
  constructor(names) {
    this.byKey = new Map();
    this.byLast = new Map();
    for (const name of names) {
      const key = matchKey(name);
      if (!key) continue;
      this.byKey.set(key, name);
      const words = key.split(' ');
      if (words.length < 2) continue;
      const last = words[words.length - 1];
      if (!this.byLast.has(last)) this.byLast.set(last, []);
      this.byLast.get(last).push({ name, sub: SUBSTITUTES.has(words[words.length - 2]) });
    }
  }
  match(ingredient) {
    const key = matchKey(ingredient);
    if (this.byKey.has(key)) return this.byKey.get(key);
    if (key.includes(' ')) return null;
    const found = this.byLast.get(key);
    if (!found || found.length !== 1 || found[0].sub) return null;
    return found[0].name;
  }
}

function pick(recipe, shelf) {
  const owned = [];
  const staples = [];
  const missing = [];
  for (const ingredient of recipe.ingredientNames) {
    // the shelf first: salt a chef actually stocked is salt they have
    if (shelf.match(ingredient) != null) owned.push(ingredient);
    else if (STAPLES.has(matchKey(ingredient))) staples.push(ingredient);
    else missing.push(ingredient);
  }
  const total = owned.length + missing.length;
  return {
    recipe, owned, staples, missing,
    coverage: total ? owned.length / total : 0,
    satisfied: owned.length + staples.length,
    stocked: missing.length === 0 && owned.length > 0,
  };
}

// coverage, then the meal it is, then fewer gaps, then the bigger dinner,
// then the faster one, then book order
export function rank(shelfNames, book, meal = 'dinner') {
  const shelf = new ShelfIndex(shelfNames);
  const suits = (r) => !r.meals?.length || r.meals.includes(meal);
  return book
    .map((recipe, i) => ({ p: pick(recipe, shelf), i }))
    .sort((a, b) => {
      if (a.p.coverage !== b.p.coverage) return b.p.coverage - a.p.coverage;
      if (meal) {
        const as = suits(a.p.recipe);
        const bs = suits(b.p.recipe);
        if (as !== bs) return as ? -1 : 1;
      }
      if (a.p.missing.length !== b.p.missing.length) return a.p.missing.length - b.p.missing.length;
      if (a.p.satisfied !== b.p.satisfied) return b.p.satisfied - a.p.satisfied;
      const am = a.p.recipe.minutes ?? Infinity;
      const bm = b.p.recipe.minutes ?? Infinity;
      if (am !== bm) return am - bm;
      return a.i - b.i;
    })
    .map((x) => x.p);
}
// ten, not fifty: "nobody swipes to dish forty"
export const DECK_SIZE = 10;
export const deckFor = (shelfNames, book) => rank(shelfNames, book).slice(0, DECK_SIZE);

// the strip's short everyday word (CookScreen chipName) and its pastel
function chipName(name) {
  const n = name.toLowerCase();
  if (n.includes('beef')) return 'Beef';
  if (n.includes('cheddar') || n.includes('cheese')) return 'Cheddar';
  if (n.includes('bun') || n.includes('bread')) return 'Bun';
  if (n.includes('chicken')) return 'Chicken';
  const last = name.split(' ').pop();
  return last.charAt(0).toUpperCase() + last.slice(1);
}
function chipPastel(name) {
  const n = name.toLowerCase();
  if (n.includes('beef')) return '#ebd5a6';
  if (n.includes('lettuce')) return '#beeba6';
  if (n.includes('tomato')) return '#eba6a6';
  if (n.includes('cheddar') || n.includes('cheese')) return '#f5ee90';
  if (n.includes('bun') || n.includes('bread')) return '#e2ffff';
  return '#dbdbdb';
}

// ======================================================================
// drawing
// ======================================================================
const h = (tag, cls, attrs = {}) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  return el;
};
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const img = (src, cls = '', alt = '') => `<img class="${cls}" src="${src}" alt="${esc(alt)}" decoding="async" draggable="false" />`;

// glyphs, drawn to sit where the app's SF Symbols do (Apple's own symbols
// are licensed for its platforms, not for a web page)
const GLYPH = {
  pan: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="9.5" cy="12.5" rx="7.5" ry="6.5"/><path d="M16.6 10.4 22.5 7.6"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15"/><path d="m13 5.5 6.5 6.5-6.5 6.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  mark: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.2 6.4 2.5 2.4 5-5.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>',
};

function plate(recipe) {
  return `<div class="pp-plate"><span class="pp-rays"></span><span class="pp-rim"></span>`
    + `<span class="pp-dish">${img(ART(recipe.title), '', '')}</span></div>`;
}

function cardHTML(p) {
  const r = p.recipe;
  const missing = p.missing.slice(0, 3).map((n) => `<span><i>${img(ART(n))}</i><b>${esc(n)}</b></span>`).join('');
  const more = p.missing.length > 3 ? `<span class="is-more"><i>+${p.missing.length - 3}</i><b>more</b></span>` : '';
  return `
    <div class="pp-hero">
      ${p.stocked ? `<span class="pp-stocked">${GLYPH.mark}All on your shelf</span>` : ''}
      ${plate(r)}
    </div>
    <div class="pp-title"><span class="pp-outlined">${esc(r.title)}</span></div>
    <div class="pp-body">
      <p class="pp-summary">${esc(r.summary)}</p>
      <div class="pp-macros"><span class="pp-macro">${r.calories} cal</span><span class="pp-macro">${r.proteinGrams}g protein</span>${r.minutes ? `<span class="pp-macro">${r.minutes} min</span>` : ''}</div>
      ${p.stocked ? '' : `<div class="pp-missing"><span>+ Add ${p.missing.length} missing</span><div class="pp-missing-row">${missing}${more}</div></div>`}
    </div>`;
}

function cardLabel(p) {
  const r = p.recipe;
  let label = `${r.title}. ${r.summary} ${r.calories} calories, ${r.proteinGrams} grams protein`;
  if (r.minutes) label += `, ${r.minutes} minutes`;
  label += '. ';
  label += p.stocked ? `You have all ${p.owned.length} ingredients.` : `You still need ${p.missing.join(', ')}.`;
  return label;
}

// A one-line title shrinks to fit rather than being cut, as far as the app
// lets it (minimumScaleFactor: 0.55 on the card, 0.5 on the recipe). It is
// the type that shrinks, line and all, as SwiftUI's does, not a transform
// over type that keeps its full-size line: the recipe's plate sits under
// the title's real line, and a scaled picture of a bigger one pushed it a
// point and a half too low. The outline's four points are counted in, as
// the app's ZStack of eight offset copies counts them.
function fitLine(el, floor) {
  el.style.fontSize = '';
  const box = el.parentElement;
  const cs = getComputedStyle(box);
  const room = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const outline = 2 * (parseFloat(getComputedStyle(el).getPropertyValue('--o')) || 0);
  const need = el.scrollWidth + outline;
  if (need > room && need > 0) {
    const size = parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = `${size * Math.max(floor, room / need)}px`;
  }
}

// ======================================================================
// the phone
// ======================================================================
export function mountPantryApp(root, { book, shelf = [], announce = true }) {
  const listeners = {};
  const emit = (type, detail) => (listeners[type] || []).forEach((fn) => fn(detail));
  let names = [...shelf];
  let deck = deckFor(names, book);
  let index = 0;
  let cooking = null;
  let done = new Set();

  root.classList.add('pp-device');
  root.innerHTML = `
    <div class="pp-screen">
      <section class="pp-view pp-home" aria-label="Home: the chef’s pick">
        ${img(`${HERE}chrome-home.webp`, 'pp-chrome')}
        <span class="pp-door-count" aria-hidden="true"></span>
        <img class="pp-welcome" src="${HERE}welcome.webp" alt="" decoding="async" draggable="false" />
        <p class="pp-rank">${img(`${HERE}hat.webp`)}<span></span></p>
        <div class="pp-deck"></div>
        <button type="button" class="pp-btn pp-go">${GLYPH.pan}<span>Start cooking</span></button>
        <div class="pp-row">
          <button type="button" class="pp-btn pp-prev" aria-label="Previous dish" hidden>${GLYPH.back}</button>
          <button type="button" class="pp-btn pp-next"><span>Next dish</span>${GLYPH.next}</button>
        </div>
      </section>
      <section class="pp-view pp-recipe" aria-label="Recipe" inert>
        ${img(`${HERE}chrome-recipe.webp`, 'pp-chrome')}
        <button type="button" class="pp-back" aria-label="Back to the chef’s pick"></button>
        <div class="pp-scroll"></div>
      </section>
      <span class="pp-indicator" aria-hidden="true"></span>
    </div>
    <img class="pp-frame" src="${HERE}frame.webp" alt="" draggable="false" />
    <p class="pp-live"${announce ? ' aria-live="polite"' : ''}></p>`;

  const $ = (s) => root.querySelector(s);
  const home = $('.pp-home');
  const recipeView = $('.pp-recipe');
  const deckEl = $('.pp-deck');
  const rankWord = $('.pp-rank span');
  const count = $('.pp-door-count');
  const prev = $('.pp-prev');
  const next = $('.pp-next');
  const go = $('.pp-go');
  const scroller = $('.pp-scroll');
  const live = $('.pp-live');

  let card = null;
  function paintRank() {
    rankWord.textContent = index === 0 ? 'Chef’s top pick' : `Pick ${index + 1} of ${deck.length}`;
    prev.hidden = index === 0;
    next.disabled = deck.length < 2;
    next.style.opacity = deck.length < 2 ? '0.5' : '';
  }
  function makeCard(p) {
    const el = h('div', `pp-card${p.stocked ? ' is-stocked' : ''}${p.missing.length ? ' is-short' : ''}`, {
      role: 'button', tabindex: '0', 'aria-label': `${cardLabel(p)} Opens the recipe.`,
    });
    el.innerHTML = cardHTML(p);
    return el;
  }
  function fitCard(el) {
    const t = el.querySelector('.pp-title .pp-outlined');
    if (t) fitLine(t, 0.55);
  }
  // the dishes either side of the one on top are decoded before they are asked for
  function warm() {
    for (const k of [index + 1, index + 2, index - 1]) {
      const p = deck[(k + deck.length) % deck.length];
      if (p) { const i = new Image(); i.decoding = 'async'; i.src = ART(p.recipe.title); }
    }
  }

  // Put a card on top. `dir` is where the old one goes: -1 thrown left (the
  // next dish), 1 thrown right (the one before), 0 swapped in place (the
  // shelf changed under it and the chef reranked).
  function show(dir = 0, fling = null) {
    const p = deck[index];
    // An empty shelf is the welcome, not an empty deck: the chef still ranks
    // all fifty dishes against nothing (ChefBookTests
    // testEmptyShelfStillReturnsEveryRecipe), but Home asks what is in the
    // kitchen instead of offering one of them.
    const empty = names.length === 0;
    home.classList.toggle('is-empty', empty);
    for (const el of [rankWord.parentElement, deckEl, go, prev.parentElement]) el.inert = empty;
    paintRank();
    const leaving = card;
    if (!p) {
      if (leaving) leaving.remove();
      card = null;
      return;
    }
    card = makeCard(p);
    deckEl.append(card);
    fitCard(card);
    bindDrag(card);
    warm();
    live.textContent = `${rankWord.textContent}: ${p.recipe.title}. ${p.stocked ? 'Everything is on your shelf.' : `Missing ${p.missing.length}.`}`;
    if (!leaving) return;
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
    const from = fling || { x: 0, r: 0 };
    const w = deckEl.clientWidth;
    leaving.style.zIndex = '2';
    leaving.style.pointerEvents = 'none';
    leaving.animate([
      { translate: `${from.x}px 0`, rotate: `${from.r}deg`, opacity: 1 },
      { translate: `${dir * w * 1.25}px ${w * 0.08}px`, rotate: `${dir * 14}deg`, opacity: 0.6 },
    ], { duration: 360, easing: 'cubic-bezier(0.4, 0, 0.9, 0.6)', fill: 'forwards' })
      .finished.then(() => leaving.remove(), () => leaving.remove());
    card.animate([
      { scale: 0.93, opacity: 0, translate: `0 ${w * 0.03}px` },
      { scale: 1, opacity: 1, translate: '0 0' },
    ], { duration: 520, easing: 'cubic-bezier(0.3, 1.25, 0.5, 1)', delay: 90, fill: 'backwards' });
  }
  function advance(step, fling) {
    if (deck.length < 2) return;
    index = (index + step + deck.length) % deck.length;
    show(step > 0 ? -1 : 1, fling);
    emit('pick', { index, pick: deck[index] });
  }

  // Throw the card away and the next one is under it, whichever way it is
  // thrown; let go early and it springs back (HomeScreen's swipe, which
  // answers to both axes).
  function bindDrag(el) {
    let start = null;
    let moved = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
      moved = false;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved && Math.abs(dy) > Math.abs(dx) * 1.4 && e.pointerType !== 'mouse') { start = null; return; }
      moved = true;
      el.style.translate = `${dx}px ${dy * 0.25}px`;
      el.style.rotate = `${dx / 22}deg`;
    });
    const end = (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dt = Math.max(1, performance.now() - start.t);
      const v = dx / dt;
      const wasMoved = moved;
      start = null;
      if (!wasMoved) return;
      el.addEventListener('click', (c) => c.stopImmediatePropagation(), { capture: true, once: true });
      const fling = { x: dx, r: dx / 22 };
      el.style.translate = '';
      el.style.rotate = '';
      if (Math.abs(dx) > deckEl.clientWidth * 0.28 || Math.abs(v) > 0.55) {
        advance(dx < 0 || v < -0.55 ? 1 : -1, fling);
      } else if (!reduced()) {
        el.animate([{ translate: `${dx}px 0`, rotate: `${fling.r}deg` }, { translate: '0 0', rotate: '0deg' }],
          { duration: 460, easing: 'cubic-bezier(0.3, 1.35, 0.5, 1)' });
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', (e) => open(e.detail === 0));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(true); }
      if (e.key === 'ArrowRight') { e.preventDefault(); advance(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); advance(-1); }
    });
  }

  next.addEventListener('click', () => advance(1));
  prev.addEventListener('click', () => advance(-1));
  go.addEventListener('click', (e) => open(e.detail === 0));

  // ---- the recipe ----
  function stripHTML(list) {
    // six to a row at most, and a longer list balanced over two
    const rows = list.length > 6 ? Math.ceil(list.length / 6) : 1;
    const per = Math.ceil(list.length / rows);
    let out = '';
    for (let i = 0; i < list.length; i += per) {
      out += `<div class="pp-strip-row">${list.slice(i, i + per).map((n) =>
        `<span class="pp-chip">${img(ART(n), '', '')}<span style="background:${chipPastel(n)}"><span class="pp-outlined">${esc(chipName(n))}</span></span></span>`).join('')}</div>`;
    }
    return `<div class="pp-strip" aria-label="Ingredients: ${esc(list.join(', '))}">${out}</div>`;
  }
  function recipeHTML(r) {
    const steps = r.steps.map((s, i) => `
      <button type="button" class="pp-step" aria-pressed="false" aria-label="Step ${i + 1}: ${esc(s.title)}. ${esc(s.body)}">
        <span class="pp-step-head"><span class="pp-step-num">${i + 1}.</span><span class="pp-step-title">${esc(s.title)}</span><span class="pp-step-tick">${GLYPH.check}</span></span>
        <span class="pp-step-body"><span><span>${esc(s.body)}</span></span></span>
      </button>`).join('');
    return `
      ${stripHTML(r.ingredientNames)}
      <div class="pp-rhero">
        <p class="pp-rtitle"><span class="pp-outlined">${esc(r.title)}</span></p>
        ${plate(r)}
        <div class="pp-macros"><span class="pp-macro">${r.calories} cal</span><span class="pp-macro">${r.proteinGrams}g protein</span>${r.minutes ? `<span class="pp-macro">${r.minutes} min</span>` : ''}</div>
        ${img(`${HERE}rule.webp`, 'pp-rule')}
      </div>
      <div class="pp-steps-head"><span class="pp-outlined">Let’s cook</span><span class="pp-count"></span></div>
      <div class="pp-steps">${steps}</div>
      <div class="pp-finish">
        ${img(`${HERE}rule.webp`, 'pp-rule is-top')}
        ${img(`${HERE}../mascot.webp`, '', '')}
        <span class="pp-outlined">Bon appétit!</span>
        <p>Made it? The chef has another idea waiting.</p>
        <button type="button" class="pp-btn pp-save">${GLYPH.save}<span>Save recipe</span></button>
        <button type="button" class="pp-btn pp-done">Done cooking</button>
      </div>`;
  }
  function paintCount() {
    const c = scroller.querySelector('.pp-count');
    if (!c || !cooking) return;
    const n = cooking.steps.length;
    c.textContent = done.size === n ? 'all done!' : `${done.size}/${n} done · tap a step to tick it`;
    c.classList.toggle('is-done', done.size === n);
  }
  // `byKey`: the recipe was opened from the keyboard, so focus goes with it
  // to the new screen; a pointer leaves it where the pointer is
  function open(byKey = false) {
    const p = deck[index];
    if (!p || cooking) return;
    cooking = p.recipe;
    done = new Set();
    scroller.innerHTML = recipeHTML(cooking);
    scroller.scrollTop = 0;
    fitLine(scroller.querySelector('.pp-rtitle .pp-outlined'), 0.5);
    scroller.querySelectorAll('.pp-step').forEach((b, i) => b.addEventListener('click', () => {
      if (done.has(i)) done.delete(i); else done.add(i);
      b.classList.toggle('is-done', done.has(i));
      b.setAttribute('aria-pressed', String(done.has(i)));
      paintCount();
    }));
    const save = scroller.querySelector('.pp-save');
    save.addEventListener('click', () => {
      const kept = save.classList.toggle('is-kept');
      save.querySelector('span').textContent = kept ? 'Saved to My recipes' : 'Save recipe';
    });
    scroller.querySelector('.pp-done').addEventListener('click', back);
    paintCount();
    recipeView.inert = false;
    home.inert = true;
    recipeView.classList.add('is-on');
    push(true);
    emit('open', cooking);
    if (byKey) setTimeout(() => recipeView.querySelector('.pp-back').focus({ preventScroll: true }), reduced() ? 0 : 380);
  }
  function back() {
    if (!cooking) return;
    cooking = null;
    home.inert = false;
    recipeView.inert = true;
    push(false).then(() => {
      if (!cooking) recipeView.classList.remove('is-on');
    });
    emit('back');
    card?.focus({ preventScroll: true });
  }
  $('.pp-back').addEventListener('click', back);

  // the navigation stack's own push: the new screen slides in over the old,
  // which drifts a third of the way left and dims
  function push(forward) {
    const o = { duration: reduced() ? 1 : 460, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' };
    const a = recipeView.animate(forward
      ? [{ translate: '100% 0', boxShadow: '0 0 0 rgb(0 0 0 / 0)' }, { translate: '0 0', boxShadow: '-12px 0 28px rgb(0 0 0 / 0.14)' }]
      : [{ translate: '0 0' }, { translate: '100% 0' }], o);
    home.animate(forward
      ? [{ translate: '0 0', filter: 'brightness(1)' }, { translate: '-30% 0', filter: 'brightness(0.9)' }]
      : [{ translate: '-30% 0', filter: 'brightness(0.9)' }, { translate: '0 0', filter: 'brightness(1)' }], o);
    return a.finished.catch(() => {});
  }

  // ---- the shelf, from outside ----
  function setShelf(list) {
    const wasEmpty = names.length === 0;
    names = [...list];
    const before = deck[index]?.recipe.title;
    deck = deckFor(names, book);
    // a stale index into a reranked deck swaps the dish silently, which reads
    // as "the chef ignores my shelf": back to the top pick instead
    index = 0;
    if (cooking) back();
    if (!card || deck[0]?.recipe.title !== before || wasEmpty !== (names.length === 0)) {
      show(0);
    } else {
      // the same dish on top, only a different count of what is missing:
      // drawn again where it stands, with nothing thrown
      const fresh = makeCard(deck[0]);
      card.replaceWith(fresh);
      card = fresh;
      fitCard(card);
      bindDrag(card);
      paintRank();
    }
    count.textContent = String(names.length);
    count.classList.remove('is-bumped');
    void count.offsetWidth;
    count.classList.add('is-bumped');
    emit('change', deck);
  }

  count.textContent = String(names.length);
  show(0);
  document.fonts?.ready.then(() => card && fitCard(card));
  new ResizeObserver(() => {
    if (card) fitCard(card);
    const t = scroller.querySelector('.pp-rtitle .pp-outlined');
    if (t) fitLine(t, 0.5);
  }).observe(root);

  return {
    setShelf,
    deck: () => deck,
    index: () => index,
    advance,
    open,
    back,
    on(type, fn) { (listeners[type] ||= []).push(fn); },
  };
}
