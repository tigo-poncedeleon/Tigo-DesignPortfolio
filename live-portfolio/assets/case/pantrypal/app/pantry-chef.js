// pantry-chef.js — what PantryPal knows, ported from its Swift rule for rule,
// for the app the case study runs (pantry-app.js). Nothing here draws.
//
//   the names     IngredientName.swift: the match key (lowercase, the last
//                 word folded to its singular), the edit distance behind
//                 "Did you mean…", the non-food words a scan drops, and
//                 DishTitle.canonical
//   the shelf     IngredientCategory.guess and its pastels, the six shelves
//                 in the app's order, and the staples Type it in! offers
//   the drawings  KnownIngredients and IllustrationKey: which bundled
//                 drawing a name finds (art.json lists them all), the
//                 vocabulary the suggestions come from, and what a name
//                 is asked of the art store as
//   the chef      ChefBook.swift: the shelf index's one-direction bare-noun
//                 rule, the four staples outside coverage, the six
//                 tie-breaks, the deck of ten, and what CateredPickStore
//                 does with the two dishes the kitchen writes for a shelf
//                 (reconcile, select, and the key a shelf is kept by)

export function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---- IngredientName ----
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
// Damerau-Levenshtein with a ceiling: anything past `limit` is limit + 1
export function editDistance(a, b, limit) {
  const x = [...a];
  const y = [...b];
  if (Math.abs(x.length - y.length) > limit) return limit + 1;
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  let twoBack = new Array(y.length + 1).fill(0);
  let previous = Array.from({ length: y.length + 1 }, (_, i) => i);
  let current = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    current[0] = i;
    let rowBest = current[0];
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      let best = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) best = Math.min(best, twoBack[j - 2] + 1);
      current[j] = best;
      rowBest = Math.min(rowBest, best);
    }
    if (rowBest > limit) return limit + 1;
    [twoBack, previous, current] = [previous, current, twoBack];
  }
  return previous[y.length];
}
const NON_FOOD_WORDS = new Set(['wipe', 'diaper', 'detergent', 'soap', 'shampoo', 'toothpaste', 'deodorant', 'lotion', 'napkin', 'tissue', 'foil', 'sponge', 'bleach', 'cleaner', 'litter', 'battery', 'pillow', 'candle', 'charcoal', 'sunscreen', 'razor', 'floss', 'coupon', 'deposit', 'magazine', 'towel', 'sock', 'lightbulb', 'mouthwash', 'sanitizer']);
const NON_FOOD_PHRASES = ['dog food', 'cat food', 'pet food', 'pet treat', 'toilet paper', 'trash bag', 'garbage bag', 'light bulb'];
export function isLikelyNonFood(name) {
  const words = name.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean).map(singularized);
  if (words.some((w) => NON_FOOD_WORDS.has(w))) return true;
  const joined = words.join(' ');
  return NON_FOOD_PHRASES.some((p) => joined.includes(p));
}
const EVALUATIVE = new Set(['classic', 'simple', 'easy', 'quick', 'basic', 'best', 'ultimate', 'perfect', 'homemade', 'traditional', 'authentic', 'foolproof', 'weeknight', 'speedy', 'favorite', 'favourite', 'delicious', 'tasty', 'super', 'amazing', 'everyday', 'no-fuss', 'go-to']);
export function canonicalTitle(title) {
  const words = title.toLowerCase().split(/\s+/).filter(Boolean);
  while (words.length > 1 && EVALUATIVE.has(words[0].replace(/^\p{P}+|\p{P}+$/gu, ''))) words.shift();
  return words.join(' ');
}
// ManualAddScreen.smartCapitalized: a word with a capital in it is kept as typed
export function smartCapitalized(name) {
  return name.split(' ').map((w) => (/\p{Lu}/u.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ');
}

// ---- IngredientCategory ----
// in the app's order, which is the shelf screen's order
export const SHELVES = ['meat', 'produce', 'dairy', 'grains', 'pantry', 'frozen'];
export const SHELF_TITLE = { meat: 'Meat', produce: 'Produce', dairy: 'Dairy', grains: 'Grain', pantry: 'Pantry', frozen: 'Frozen' };
// each shelf's own colour (IngredientCategory+Pastel.swift): meaty red,
// produce green, dairy yellow, wheat tan, pantry grey, frozen ice-blue
export const PASTEL = { meat: '#eba6a6', produce: '#beeba6', dairy: '#f5ee90', grains: '#ebd5a6', pantry: '#dbdbdb', frozen: '#e2ffff' };
// the first shelf whose words the name contains (frozen before all, so
// frozen peas are frozen), and the pantry for everything else
const SHELF_WORDS = [
  ['frozen', ['frozen', 'ice cream', 'popsicle']],
  ['meat', ['beef', 'chicken', 'pork', 'lamb', 'steak', 'bacon', 'turkey', 'sausage', 'salmon', 'tuna', 'shrimp', 'fish', 'ham', 'meat']],
  ['dairy', ['cheese', 'milk', 'butter', 'yogurt', 'cream', 'egg', 'parmesan', 'mozzarella', 'cheddar']],
  ['produce', ['lettuce', 'tomato', 'onion', 'garlic', 'pepper', 'broccoli', 'spinach', 'mushroom', 'potato', 'carrot', 'cucumber', 'avocado', 'lemon', 'lime', 'banana', 'apple', 'berry', 'salad', 'herb', 'basil']],
  ['grains', ['bun', 'bread', 'rice', 'pasta', 'tortilla', 'oats', 'flour', 'noodle', 'cereal', 'bagel']],
];
export function shelfOf(name) {
  const n = name.toLowerCase();
  for (const [shelf, words] of SHELF_WORDS) if (words.some((w) => n.includes(w))) return shelf;
  return 'pantry';
}
// the staples offered while the field is idle (KnownIngredients.quickAdd)
export const QUICK_ADD = ['Milk', 'Eggs', 'Bread', 'Butter', 'Onion', 'Rice'];

// ---- the drawings (KnownIngredients, IllustrationKey, IllustrationCache) ----
let bundled = new Set();
let drawnSet = new Set();
let known = [];
let knownKeys = new Set();
// art.json: every bundled drawing's slug, which of them are the book's
// dishes, and the foods the art store has drawn for the scanner's two
// pictures (drawn/), which the app would ask the store for
export function useArt({ all, book, drawn = [] }) {
  bundled = new Set(all);
  drawnSet = new Set(drawn);
  const dishes = new Set(book);
  known = [...new Set(all.filter((s) => !dishes.has(s)).map((s) => s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')))].sort();
  knownKeys = new Set(known.map(matchKey));
}
// The bundled drawing a name finds, as IllustrationCache.loadUIImage looks
// for one: the name's own slug, its folded one (eggs → egg), then the folded
// one plural, since the bundle files most foods under the plural (eggs.png);
// a dish by its title, then its canonical title.
export function bundledSlug(name, dish = false) {
  const raw = slug(name);
  if (!raw) return null;
  const tries = dish ? [raw, slug(canonicalTitle(name))] : [raw, slug(matchKey(name)), `${slug(matchKey(name))}s`];
  return tries.find((s) => bundled.has(s)) || null;
}
// a food the art store has already drawn for the page, by its folded name
export function drawnSlug(name) {
  const s = slug(matchKey(name));
  return drawnSet.has(s) ? s : null;
}
// The nearest food with a drawing, for a name nothing draws: the name with
// its first words dropped one at a time, so "Iceberg Lettuce" is lettuce and
// "Sharp Cheddar Cheese" is cheddar cheese.
export function nearest(name) {
  const words = matchKey(name).split(' ');
  for (let i = 1; i < words.length; i++) {
    const rest = words.slice(i).join(' ');
    const s = bundledSlug(rest);
    if (s) return { folder: 'art', slug: s };
    const d = drawnSlug(rest);
    if (d) return { folder: 'drawn', slug: d };
  }
  return null;
}
// what the art store is asked to draw (IllustrationKey.promptSubject)
export const promptSubject = (name, dish = false) => (dish ? canonicalTitle(name) : matchKey(name));
// a near miss of a drawable name is a typo, and is never sent to be drawn
export function looksMisspelled(name) {
  const key = matchKey(name);
  if (key.length < 3 || knownKeys.has(key)) return false;
  const limit = key.length <= 6 ? 1 : 2;
  for (const k of knownKeys) if (editDistance(key, k, limit) <= limit) return true;
  return false;
}
// "Did you mean…": names that start with what is typed, then names that
// contain it, three at most, never the one typed exactly
export function suggestions(query, excluding = new Set(), limit = 3) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const prefix = [];
  const contains = [];
  for (const name of known) {
    const lower = name.toLowerCase();
    if (excluding.has(lower) || lower === q) continue;
    if (lower.startsWith(q)) prefix.push(name);
    else if (lower.includes(q)) contains.push(name);
  }
  return [...prefix, ...contains].slice(0, limit);
}

// ---- the chef (ChefBook.swift) ----
// EXACTLY the four basics the proxy's recipe prompt names, and nothing a
// person would actually shop for: butter, garlic and soy sauce are real
// shopping. Whole match keys, because "Bell Pepper" folds to "pepper".
export const STAPLES = new Set([
  'salt', 'sea salt', 'kosher salt', 'table salt',
  'pepper', 'black pepper', 'ground black pepper', 'white pepper',
  'water', 'cold water', 'warm water',
  'oil', 'olive oil', 'extra virgin olive oil', 'vegetable oil',
  'canola oil', 'cooking oil', 'neutral oil',
]);
// modifiers that make a different food, not a variety of the same one:
// peanut butter is not butter, and coconut milk is not milk
const SUBSTITUTES = new Set(['peanut', 'almond', 'cashew', 'coconut', 'oat', 'soy', 'apple', 'cocoa', 'ice']);

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

function score(recipe, shelf) {
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
// one recipe against a shelf (ChefBook.pick)
export const pickFor = (recipe, shelfNames) => score(recipe, new ShelfIndex(shelfNames));

// coverage, then the meal it is, then fewer gaps, then the bigger dinner,
// then the faster one, then book order
export function rank(shelfNames, book, meal = null) {
  const shelf = new ShelfIndex(shelfNames);
  const suits = (r) => !r.meals?.length || r.meals.includes(meal);
  return book
    .map((recipe, i) => ({ p: score(recipe, shelf), i }))
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
// the two seats at the front of the deck for dishes written for the shelf,
// asked for on every shelf of three or more (CateredPickStore)
export const CATERED_SLOTS = 2;
export const CATER_FROM = 3;
// a shelf is kept by its set of match keys, whatever order it was filled in
export const shelfKey = (names) => [...new Set(names.map(matchKey).filter(Boolean))].sort().join('|');
// the kitchen's names put back onto the shelf's own spelling
export function reconcile(recipes, shelfNames) {
  const shelf = new ShelfIndex(shelfNames);
  return recipes.map((r) => ({ ...r, ingredientNames: r.ingredientNames.map((n) => shelf.match(n) ?? n) }));
}
// ranked against the shelf, one of a title, two at most
export function select(recipes, shelfNames) {
  const seen = new Set();
  return rank(shelfNames, recipes)
    .map((p) => p.recipe)
    .filter((r) => { const k = matchKey(r.title); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, CATERED_SLOTS);
}
// the deck: the seated dishes first, then the book's ranking, ten in all
export function deckFor(shelfNames, book, catered = [], meal = 'dinner') {
  const pinned = catered.slice(0, CATERED_SLOTS);
  const ranked = rank(shelfNames, book, meal);
  if (!pinned.length) return ranked.slice(0, DECK_SIZE);
  const keys = new Set(pinned.map((r) => matchKey(r.title)));
  return [...pinned.map((r) => ({ ...pickFor(r, shelfNames), made: true })), ...ranked.filter((p) => !keys.has(matchKey(p.recipe.title)))].slice(0, DECK_SIZE);
}
