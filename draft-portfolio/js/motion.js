// motion.js — the draft's vocabulary of movement, read from css/tokens.css so
// the choreography in JS and the transitions in CSS share one set of curves.
//
// The springs are CSS linear() strings (sampled step responses; see the
// tokens file for what each one is for). A browser without linear() gets the
// cubic fallbacks the tokens file swaps in, so reading the token is always
// safe to hand to animate(), which throws on an easing it does not know.

const root = document.documentElement;
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');

export const reduced = () => reducedQuery.matches;
export function onReducedChange(fn) {
  reducedQuery.addEventListener('change', () => fn(reducedQuery.matches));
}

function token(name) {
  return getComputedStyle(root).getPropertyValue(name).trim().replace(/\s+/g, ' ');
}
function ms(value) {
  const n = parseFloat(value);
  return value.endsWith('ms') ? n : n * 1000;
}

// Read lazily: the first caller is always after the stylesheets have applied.
const cache = {};
function spring(name) {
  if (!cache[name]) {
    cache[name] = { easing: token(`--spring-${name}`), duration: ms(token(`--t-${name}`)) };
  }
  return cache[name];
}
export const SPRING = {
  get settle() { return spring('settle'); },
  get out() { return spring('out'); },
  get pop() { return spring('pop'); },
  get snap() { return spring('snap'); },
};

export const EASE = {
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  rise: 'cubic-bezier(0.22, 1, 0.36, 1)',
  draw: 'cubic-bezier(0.4, 0, 0.2, 1)',
};

// One frame pixel, in CSS px. --u is registered as a <length> (tokens.css),
// so its computed value is already resolved.
export function u() {
  return parseFloat(getComputedStyle(root).getPropertyValue('--u')) || 1;
}

// Stop everything running on an element WHERE IT IS: the current animated
// value is written into the inline style, then the animation goes. Whatever
// runs next starts from exactly what is on screen. That is what makes a
// second click in the middle of a transition a reversal rather than a jump.
export function settle(el, { subtree = false } = {}) {
  for (const a of el.getAnimations({ subtree })) {
    try { a.commitStyles(); } catch { /* not rendered: nothing to keep */ }
    a.cancel();
  }
}

// Under reduced motion every movement becomes a short fade. Keyframes keep
// only their opacity (anything else is simply dropped), and nothing runs
// longer than 200ms or waits for anything.
export function animate(el, keyframes, options) {
  if (reduced()) {
    const faded = keyframes.map((k) => ('opacity' in k ? { opacity: k.opacity } : {}));
    const hasOpacity = faded.some((k) => 'opacity' in k);
    return el.animate(hasOpacity ? faded : [{}, {}], {
      ...options,
      duration: hasOpacity ? Math.min(options.duration ?? 200, 200) : 0,
      delay: 0,
      easing: 'linear',
    });
  }
  return el.animate(keyframes, options);
}

// Move an element from where it WAS to where it IS (First, Last, Invert,
// Play), by translate alone.
export function flip(el, from, to, timing = SPRING.settle) {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  if (!dx && !dy) return null;
  return animate(el, [{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], timing);
}

// The one entrance: text rising a little, sharpening as it comes. It is used
// for everything that arrives (a page's content, the first load's name), so
// there is one entrance in the draft, not one per page.
export function rise(els, { delay = 0, stagger = 45, distance = 12, blur = 4 } = {}) {
  const k = u();
  return [...els].map((el, i) =>
    animate(el, [
      { opacity: 0, translate: `0 ${distance * k}px`, filter: `blur(${blur}px)` },
      { opacity: 1, translate: '0 0', filter: 'blur(0px)' },
    ], { ...SPRING.settle, delay: delay + i * stagger, fill: 'backwards' }),
  );
}

// Take off whatever inline styles an animation left behind.
export function clearInline(el, props = ['opacity', 'translate', 'transform', 'filter', 'scale']) {
  for (const p of props) el.style.removeProperty(p);
}
