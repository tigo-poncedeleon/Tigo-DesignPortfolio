// pantry-app.js — PantryPal, running on its case study: Home (the welcome on
// an empty shelf, the chef's pick on a stocked one) and the Recipe screen
// behind it, in the app's own fonts, colours and art (pantry-app.css),
// ranked against a shelf the page hands it.
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
//                 cropped from its captures; everything under the band is
//                 drawn here from the Swift source's own numbers (DishCard,
//                 HomeScreen, SpillStage, CookScreen, the design system's
//                 tokens and button styles) and checked against the 1.3
//                 build's captures on an iPhone 16, measured to the point,
//                 its glyphs traced over the app's own
//   the motion    the app's springs, sampled into CSS (spring below): the
//                 deck's slide, a let-go card's settle, the welcome's drop
//   left out      the AI's catered picks (the real app asks Gemini for two
//                 dishes written for this shelf and pins them first; here
//                 the bundled book answers alone, which is what the app does
//                 offline), and the Season Pass card a free chef finds third
//                 in the deck: this is the deck a pass holder sees
//
// mountPantryApp(el, { book, shelf, announce }) builds the phone into el and
// returns { setShelf(names, { keep, added }), deck(), index(), advance(step),
// open(), back(), on(event, fn) }. It emits 'change' with the new deck
// whenever the shelf does, 'pick' as the deck is walked, 'open' / 'back' as
// the screens change, and the four the page answers for the app, since the
// shelf is the page's: 'add' ({ names, title }) from a card's add-missing
// chip, 'scan' and 'type' from the welcome's two doors, and 'shelf' from the
// title and the wardrobe. It says what is on top in a live region of its own
// unless told not to (announce: false), for a page that already says so.

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

// The two seats the app keeps at the front of its deck for dishes written
// for this exact shelf (ChefBook.deck's catered slots, filled by
// CateredPickStore): it asks its server for them on every shelf of three or
// more, so its first card changes with almost every change to the shelf,
// and they wear "Made for your shelf". This page has no server, so after a
// change it seats two of the book's own dishes there instead, chosen as a
// dish written for the shelf would be: one the shelf can cook whole, built
// on what was just put on it where one is, and never the dish that was in
// front before the change. The same shelf seats the same two, as the app's
// answers are kept by shelf. (Without them the first card held still
// through most changes: a dish fully stocked stays at the top of the book's
// own ranking until something it uses comes off.)
export const CATERED_SLOTS = 2;
export const CATER_FROM = 3;
const turnOf = (s) => {
  let n = 2166136261;
  for (let i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619);
  return n >>> 0;
};
export function cater(shelfNames, ranked, { added = [], avoid = null } = {}) {
  if (shelfNames.length < CATER_FROM) return [];
  const key = shelfNames.map(matchKey).sort().join('|');
  const fresh = new Set(added.map(matchKey));
  return ranked
    .filter((p) => p.stocked && p.recipe.title !== avoid)
    // (what it is built on is what was just added, never the salt: a
    // staple is in every kitchen and builds nothing)
    .map((p) => ({ p, fresh: p.owned.filter((n) => fresh.has(matchKey(n)) && !STAPLES.has(matchKey(n))), turn: turnOf(`${key}#${p.recipe.title}`) }))
    .sort((a, b) => b.fresh.length - a.fresh.length || a.turn - b.turn)
    .slice(0, CATERED_SLOTS)
    .map(({ p, fresh }) => ({ ...p, made: true, fresh }));
}
export function deckFor(shelfNames, book, { cater: seat = false, added = [], avoid = null } = {}) {
  const ranked = rank(shelfNames, book);
  const made = seat ? cater(shelfNames, ranked, { added, avoid }) : [];
  const seated = new Set(made.map((p) => p.recipe.title));
  return [...made, ...ranked.filter((p) => !seated.has(p.recipe.title))].slice(0, DECK_SIZE);
}

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

// SwiftUI's spring(response:dampingFraction:), sampled into a CSS linear()
// easing: the app's own curve, overshoot and all, run for as long as it
// takes to settle to within a five-hundredth. A browser without linear()
// gets an ease-out of the same length, since animate() throws on an easing
// it does not know.
const LINEAR = typeof CSS !== 'undefined' && CSS.supports?.('animation-timing-function', 'linear(0, 1)');
function spring(response, damping) {
  const w = (2 * Math.PI) / response;
  const wd = w * Math.sqrt(1 - damping * damping);
  const settle = Math.log(500) / (damping * w);
  const n = 40;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (settle * i) / n;
    const x = i === n ? 1 : 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t));
    pts.push(+x.toFixed(4));
  }
  return { duration: Math.round(settle * 1000), easing: LINEAR ? `linear(${pts.join(', ')})` : 'cubic-bezier(0.2, 0.9, 0.3, 1)' };
}
// the deck's shuffle (HomeScreen.shuffle), a card let go short of a throw
// (the slot's drag animation), and the welcome's pile (SpillStage.drop)
const SHUFFLE = spring(0.32, 0.78);
const SETTLE = spring(0.3, 0.85);
const DROP = spring(0.52, 0.62);

// The glyph each button leads with (the app's CTAGlyph) and the deck's two
// arrows, drawn here at the size, the weight and the place of the SF Symbol
// the app uses, and traced over the app's own captures until each covered
// the app's ink to within a few pixels (82 to 92 per cent of it): Apple's
// symbols are licensed for its platforms, not for a web page. Each is drawn
// in the capture's own pixels, three to a point, and its box is its ink and
// nothing more, so it stands as wide and as tall as the app's (--gw, --gh).
const glyph = (cls, w, hgt, body) => `<svg class="pp-g ${cls}" viewBox="0 0 ${w} ${hgt}" style="--gw: ${+(w / 3).toFixed(2)}; --gh: ${+(hgt / 3).toFixed(2)}" aria-hidden="true">${body}</svg>`;
const GLYPH = {
  // frying.pan, 18 semibold: Start cooking
  pan: glyph('is-pan', 84, 50, '<path d="M2.6 27.6c0 12.2 13.7 20 30.9 20s30.9-7.8 30.9-20" stroke-width="5.2"/><ellipse cx="33.5" cy="25.4" rx="31" ry="8.5" stroke-width="5"/><path class="is-fill" d="M5.2 29c6.8-.4 13.3-1.2 18.3-1.8 3-.3 5.3-1 6.7-2 2-1.8 4.6-2.6 7.4-2.4 3.2.2 5.6 1.8 7.2 3.8 5.7.8 11.6 1.6 17 2.6-4.8 3.4-15.4 5.4-28.3 5.4S10 32.6 5.2 29z"/><rect x="-4.1" y="-4.1" width="30" height="8.2" rx="4.1" transform="translate(60 17.4) rotate(-28.5)" stroke-width="4.3"/>'),
  // arrow.right, 15 heavy: Next dish
  next: glyph('is-next', 44, 36, '<path d="M3.8 17.6h35.8M26.4 4.2l13.4 13.4L26.4 31" stroke-width="7.6"/>'),
  // arrow.uturn.backward, 18 heavy: back a dish, staying on the screen
  back: glyph('is-back', 53, 53, '<path d="M18.4 4.3 4.3 18.3l14.1 14.1M4.3 18.3H33a14.7 14.7 0 0 1 0 29.4h-7.6" stroke-width="8.4"/>'),
  // camera and list.bullet.rectangle.portrait, 18 semibold: the welcome's two doors
  camera: glyph('is-camera', 65, 51, '<path d="M9.8 8.6h8.8l5.2-5.4c.4-.4.9-.6 1.5-.6h14.4c.6 0 1.1.2 1.5.6l5.2 5.4h8.8c3.9 0 7 3.1 7 7v25.2c0 3.9-3.1 7-7 7H9.8c-3.9 0-7-3.1-7-7V15.6c0-3.9 3.1-7 7-7z" stroke-width="5.4"/><circle cx="32.5" cy="27.6" r="12" stroke-width="5.2"/><circle class="is-fill" cx="52.6" cy="16.6" r="3"/>'),
  list: glyph('is-list', 46, 57, '<rect x="2.9" y="2.6" width="40" height="51.2" rx="6.4" stroke-width="5.6"/><circle class="is-fill" cx="11.9" cy="12.1" r="2.3"/><circle class="is-fill" cx="11.9" cy="20.1" r="2.3"/><circle class="is-fill" cx="11.9" cy="28.1" r="2.3"/><path d="M19 12.1h15.4M19 20.1h15.4M19 28.1h15.4" stroke-width="3.1"/>'),
  // bookmark: Save recipe
  save: '<svg class="pp-save-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.6h9.6c.9 0 1.6.7 1.6 1.6v15.2L12 16.2l-6.4 4.2V5.2c0-.9.7-1.6 1.6-1.6z"/></svg>',
  // the checkmark in the stocked pill, and in the app's CheckBadge
  mark: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.2 6.4 2.5 2.4 5-5.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
// CheckBadge: the ink check on the app's check green, in an ellipse a tenth
// shorter than it is wide (a ticked step's is 30 across, a kept recipe's 22)
const badge = (size) => `<span class="pp-badge" style="--bs: ${size}" aria-hidden="true">${GLYPH.mark}</span>`;

function plate(recipe) {
  return `<div class="pp-plate"><span class="pp-rays"></span><span class="pp-rim"></span>`
    + `<span class="pp-dish">${img(ART(recipe.title), '', '')}</span></div>`;
}

// What the shelf is short of, as one button that puts all of it on the
// shelf (DishCard coverageChip): the app's coral sticker on its dashed
// "provisional" edge, the first three gaps drawn, and the rest a count.
function missingHTML(p) {
  const n = p.missing.length;
  const tiles = p.missing.slice(0, 3).map((name) => `<span><i>${img(ART(name))}</i><b>${esc(name)}</b></span>`).join('');
  const more = n > 3 ? `<span class="is-more"><i>+${n - 3}</i><b>more</b></span>` : '';
  return `<button type="button" class="pp-missing" aria-label="Add the ${n} missing ingredient${n === 1 ? '' : 's'} to your shelf: ${esc(p.missing.join(', '))}">`
    + '<svg class="pp-dash" aria-hidden="true"><rect /></svg>'
    + `<span class="pp-missing-word" aria-hidden="true">+ Add ${n} missing</span><span class="pp-missing-row" aria-hidden="true">${tiles}${more}</span></button>`;
}

// The card is a door to its recipe, as the app's is (a tap anywhere on it),
// and the add-missing chip inside it a door of its own: one button laid
// over the whole card, and the chip's above that.
function cardHTML(p) {
  const r = p.recipe;
  return `
    <button type="button" class="pp-card-open" aria-label="${esc(cardLabel(p))} Opens the recipe."></button>
    <div class="pp-hero" aria-hidden="true">
      ${p.stocked ? `<span class="pp-stocked">${GLYPH.mark}All on your shelf</span>` : ''}
      ${plate(r)}
    </div>
    <div class="pp-title" aria-hidden="true"><span class="pp-outlined">${esc(r.title)}</span></div>
    <div class="pp-body">
      <p class="pp-summary" aria-hidden="true">${esc(r.summary)}</p>
      <div class="pp-macros" aria-hidden="true"><span class="pp-macro">${r.calories} cal</span><span class="pp-macro">${r.proteinGrams}g protein</span>${r.minutes ? `<span class="pp-macro">${r.minutes} min</span>` : ''}</div>
      ${p.stocked ? '' : missingHTML(p)}
    </div>`;
}

function cardLabel(p) {
  const r = p.recipe;
  let label = `${r.title}. ${r.summary} ${r.calories} calories, ${r.proteinGrams} grams protein`;
  if (r.minutes) label += `, ${r.minutes} minutes`;
  label += '. ';
  label += p.stocked ? `You have all ${p.owned.length} ingredients.` : `You still need ${p.missing.join(', ')}.`;
  if (p.staples.length) label += ` Assuming you have ${p.staples.join(', ')}.`;
  return label;
}

// A one-line title shrinks to fit rather than being cut, as far as the app
// lets it (minimumScaleFactor: 0.55 on the card, 0.5 on the recipe, 0.7 on
// the welcome's band). It is the type that shrinks, line and all, as
// SwiftUI's does, not a transform over type that keeps its full-size line:
// the recipe's plate sits under the title's real line, and a scaled picture
// of a bigger one pushed it a point and a half too low. The outline's four
// points are counted in, as the app's ZStack of eight offset copies counts
// them.
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

// The welcome's pile (SpillStage.swift), piece for piece, back to front:
// each drawing's top-left on the app's 393 × 424 canvas, its width, its
// drawing's own width over its height, and its tilt. The canvas is scaled
// to the room an iPhone 16 leaves it under the title band (pantry-app.css
// .pp-spill), and the coral band with the question swings through it.
const PIECES = [
  ['Broccoli', -8, 16, 116, 0.954, -11], ['Eggs', 102, 2, 120, 1.059, 6],
  ['Bell Pepper', 230, 18, 104, 0.831, 13], ['Lemon', 324, 80, 84, 0.918, -8],
  ['Tomato', 26, 112, 100, 0.944, 9], ['Cheddar Cheese', 2, 278, 120, 1.15, -7],
  ['Bread', 140, 284, 114, 1.128, 5], ['Avocado', 280, 280, 100, 0.8, 14],
];

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
  let spilled = false;

  root.classList.add('pp-device');
  root.innerHTML = `
    <div class="pp-screen">
      <section class="pp-view pp-home" aria-label="Home">
        ${img(`${HERE}chrome-home.webp`, 'pp-chrome is-deck')}
        ${img(`${HERE}chrome-welcome.webp`, 'pp-chrome is-welcome')}
        <span class="pp-door-count" aria-hidden="true"></span>
        <button type="button" class="pp-door is-title" tabindex="-1" aria-hidden="true"></button>
        <button type="button" class="pp-door is-door"></button>
        <div class="pp-welcome">
          <div class="pp-spill">
            ${PIECES.map(([name, x, y, w, a, t]) => `<img class="pp-piece" src="${ART(name)}" alt="" decoding="async" draggable="false" style="--x: ${x}; --y: ${y}; --w: ${w}; --a: ${a}; --t: ${t}" />`).join('')}
            <p class="pp-band" role="heading" aria-level="2"><span class="pp-outlined">What’s in your kitchen?</span></p>
          </div>
          <button type="button" class="pp-btn pp-scan">${GLYPH.camera}<span>Scan my groceries</span></button>
          <button type="button" class="pp-btn pp-type">${GLYPH.list}<span>Type my groceries</span></button>
        </div>
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
  const door = $('.pp-door.is-door');
  const title = $('.pp-door.is-title');
  const welcome = $('.pp-welcome');
  const band = $('.pp-band');
  const prev = $('.pp-prev');
  const next = $('.pp-next');
  const go = $('.pp-go');
  const scroller = $('.pp-scroll');
  const live = $('.pp-live');
  // one of the app's points, in pixels, as the screen is drawn now
  const pt = () => home.clientWidth / 393;

  let card = null;
  function paintRank() {
    // HomeScreen.badgeLabel: the seats made for the shelf are named for what
    // they are, then the top of the book, then where you are in the deck
    rankWord.textContent = deck[index]?.made ? 'Made for your shelf'
      : index === 0 ? 'Chef’s top pick' : `Pick ${index + 1} of ${deck.length}`;
    prev.hidden = index === 0;
    next.disabled = deck.length < 2;
    next.style.opacity = deck.length < 2 ? '0.5' : '';
  }
  function makeCard(p) {
    const el = h('div', `pp-card${p.stocked ? ' is-stocked' : ''}${p.missing.length ? ' is-short' : ''}`);
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

  // An empty shelf is the welcome, not an empty deck: the chef still ranks
  // all fifty dishes against nothing (ChefBookTests
  // testEmptyShelfStillReturnsEveryRecipe), but Home asks what is in the
  // kitchen instead of offering one of them, under "Hey, chef!" and with no
  // door to a shelf that has nothing on it. The pile falls the first time it
  // is shown, as the app plays it once a launch.
  function paintEmpty(empty) {
    home.classList.toggle('is-empty', empty);
    for (const el of [rankWord.parentElement, deckEl, go, prev.parentElement, door, title]) el.inert = empty;
    welcome.inert = !empty;
    if (empty && !spilled) {
      spilled = true;
      spill();
    }
  }
  function spill() {
    if (reduced()) return;
    const k = pt();
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
  // leading edge (the next dish), 1 toward the trailing edge (the one
  // before), 0 swapped in place (the shelf changed under it and the chef
  // reranked); `from` is where a hand let it go.
  function show(dir = 0, from = null) {
    const p = deck[index];
    // a keyboard that was on the card going, or on a welcome door that
    // has just filled the shelf, goes on to the card coming
    const held = root.contains(document.activeElement)
      && (card?.contains(document.activeElement) || welcome.contains(document.activeElement));
    paintEmpty(names.length === 0);
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
    if (held && names.length) card.querySelector('.pp-card-open').focus({ preventScroll: true });
    if (!leaving) return;
    leaving.inert = true;
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
    // The deck's own move (HomeScreen.slotted): the dish going slides off
    // toward the edge it is going to and fades, the next slides in from the
    // other edge and fades up, both on the deck's spring, from wherever a
    // hand let the old one go. (They were thrown off at a tilt, a card game's
    // throw, which the app never does.)
    const w = home.clientWidth;
    const off = from ? `${from.x}px ${from.y}px` : '0px 0px';
    leaving.style.pointerEvents = 'none';
    leaving.animate([{ translate: off, opacity: 1 }, { translate: `${dir * w}px 0px`, opacity: 0 }], { ...SHUFFLE, fill: 'forwards' })
      .finished.then(() => leaving.remove(), () => leaving.remove());
    card.animate([{ translate: `${-dir * w}px 0px`, opacity: 0 }, { translate: '0px 0px', opacity: 1 }], { ...SHUFFLE, fill: 'backwards' });
  }
  // On down the ranking, wrapping from the last dish to the top pick; or
  // back up it, which stops at the top pick (HomeScreen advance, retreat)
  function advance(step, from) {
    if (deck.length < 2) return;
    if (step < 0 && index === 0) return;
    index = (index + step + deck.length) % deck.length;
    show(step > 0 ? -1 : 1, from);
    emit('pick', { index, pick: deck[index] });
  }

  // The card follows a hand along whichever way it is going, damped to a
  // little over half, and thrown further than 56 points it is the next dish
  // (left, or up) or the one before (right, or down); short of that it
  // springs back. Where there is nowhere to go, back from the top pick, or
  // on with only one dish, it pulls at a third and rubber-bands
  // (HomeScreen.cardSwipe). A touch listens sideways only: up and down on a
  // page is the page's scroll, as on the app's short-phone layout, where the
  // card scrolls.
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
        if (Math.hypot(dx, dy) < 24 * pt()) return;
        axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        if (axis === 'y' && start.touch) { start = null; axis = null; return; }
        el.setPointerCapture(e.pointerId);
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
      if (!moved) return;
      // the press that ends a throw is not a tap on the card
      el.addEventListener('click', (c) => { c.stopImmediatePropagation(); c.preventDefault(); }, { capture: true, once: true });
      const at = el.style.translate || '0px 0px';
      const [fx = 0, fy = 0] = at.split(' ').map((v) => parseFloat(v) || 0);
      el.style.translate = '';
      if (Math.abs(travel) > 56 * pt()) {
        if (travel < 0) { advance(1, { x: fx, y: fy }); return; }
        if (index > 0) { advance(-1, { x: fx, y: fy }); return; }
      }
      if (!reduced()) el.animate([{ translate: at }, { translate: '0px 0px' }], SETTLE);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    const opener = el.querySelector('.pp-card-open');
    opener.addEventListener('click', (e) => open(e.detail === 0));
    opener.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); advance(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); advance(-1); }
    });
    // every gap at once, as the app's one button does (the page puts them
    // on the shelf, and the dish stays on top, now with everything)
    el.querySelector('.pp-missing')?.addEventListener('click', () => {
      const p = deck[index];
      if (p) emit('add', { names: [...p.missing], title: p.recipe.title });
    });
  }

  next.addEventListener('click', () => advance(1));
  prev.addEventListener('click', () => advance(-1));
  go.addEventListener('click', (e) => open(e.detail === 0));
  // The title and the wardrobe are both doors to the shelf, as in the app;
  // here the shelf is the one the page lays beside the phone. The welcome's
  // two doors fill it: a scan stocks it as a receipt would, and typing
  // hands over to the page's own stickers.
  for (const el of [door, title]) el.addEventListener('click', () => emit('shelf'));
  $('.pp-scan').addEventListener('click', () => emit('scan'));
  $('.pp-type').addEventListener('click', () => emit('type'));

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
    // a step to do wears a dashed ring, 28 across; a step done, the app's
    // check badge, 30 across (CookScreen stepBlock)
    const steps = r.steps.map((s, i) => `
      <button type="button" class="pp-step" aria-pressed="false" aria-label="Step ${i + 1}: ${esc(s.title)}. ${esc(s.body)}">
        <span class="pp-step-head"><span class="pp-step-num">${i + 1}.</span><span class="pp-step-title">${esc(s.title)}</span><span class="pp-step-tick"><svg class="pp-ring" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="13.5" /></svg>${badge(30)}</span></span>
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
        ${img(`${HERE}../mascot.webp`, 'pp-finish-chef', '')}
        <span class="pp-outlined">Bon appétit!</span>
        <p>Made it? The chef has another idea waiting.</p>
        <button type="button" class="pp-btn pp-save">${GLYPH.save}${badge(22)}<span class="pp-save-word">Save recipe</span></button>
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
      save.querySelector('.pp-save-word').textContent = kept ? 'Saved to My recipes' : 'Save recipe';
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
    card?.querySelector('.pp-card-open')?.focus({ preventScroll: true });
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
  // The app goes back to the chef's top pick whenever the shelf changes
  // (a stale index into a reranked deck swaps the dish silently, which reads
  // as "the chef ignores my shelf"). `keep` names a dish to stay on instead,
  // for the one change made from the card itself: its missing ingredients
  // put on the shelf, the dish stays on top, now with all of them.
  // `added` names what the change put on the shelf, for the seats made
  // for it; a change made from a card (`keep`) stays on that card instead.
  function setShelf(list, { keep = null, added = [] } = {}) {
    const wasEmpty = names.length === 0;
    names = [...list];
    const before = deck[index]?.recipe.title;
    deck = deckFor(names, book, { cater: !keep, added, avoid: before });
    const kept = keep ? deck.findIndex((p) => p.recipe.title === keep) : -1;
    index = kept >= 0 ? kept : 0;
    if (cooking) back();
    if (!card || deck[index]?.recipe.title !== before || wasEmpty !== (names.length === 0)) {
      show(0);
    } else {
      // the same dish on top, only a different count of what is missing:
      // drawn again where it stands, with nothing thrown
      const held = card.contains(document.activeElement);
      const fresh = makeCard(deck[index]);
      card.replaceWith(fresh);
      card = fresh;
      fitCard(card);
      bindDrag(card);
      paintRank();
      if (held) card.querySelector('.pp-card-open').focus({ preventScroll: true });
    }
    paintDoor();
    count.classList.remove('is-bumped');
    void count.offsetWidth;
    count.classList.add('is-bumped');
    emit('change', deck);
  }
  function paintDoor() {
    count.textContent = String(names.length);
    door.setAttribute('aria-label', `My shelf, ${names.length} ingredient${names.length === 1 ? '' : 's'}`);
  }

  paintDoor();
  show(0);
  document.fonts?.ready.then(() => {
    if (card) fitCard(card);
    fitLine(band.firstElementChild, 0.7);
  });
  new ResizeObserver(() => {
    if (card) fitCard(card);
    fitLine(band.firstElementChild, 0.7);
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
