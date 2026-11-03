// pantry-draw.js — how PantryPal's pieces are drawn on the page, for the app
// the case study runs (pantry-app.js): the DOM helpers, the app's springs
// sampled into CSS, the glyphs traced over its captures, the dish card and
// its plate, and the chef writing on the seat (CookingDishCard). Every
// drawing of a food or a dish goes through art() and hydrate(): the app's
// bundled drawing at once if it has one, or the art store's once it is
// drawn (pantry-kitchen.js drawing()).

import { drawing, drawingNow } from './pantry-kitchen.js';

export const HERE = new URL('.', import.meta.url).href;
// the system's setting, or the app's own Animations switch (Settings)
let still = false;
export const setStill = (on) => { still = on; };
export const reduced = () => still || matchMedia('(prefers-reduced-motion: reduce)').matches;
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

export const h = (tag, cls, attrs = {}) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  return el;
};
export const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const img = (src, cls = '', alt = '') => `<img class="${cls}" src="${src}" alt="${esc(alt)}" decoding="async" draggable="false" />`;

// SwiftUI's spring(response:dampingFraction:), sampled into a CSS linear()
// easing: the app's own curve, overshoot and all, run for as long as it
// takes to settle to within a five-hundredth. A browser without linear()
// gets an ease-out of the same length, since animate() throws on an easing
// it does not know.
const LINEAR = typeof CSS !== 'undefined' && CSS.supports?.('animation-timing-function', 'linear(0, 1)');
export function spring(response, damping) {
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
export const SHUFFLE = spring(0.32, 0.78);
export const SETTLE = spring(0.3, 0.85);
export const DROP = spring(0.52, 0.62);

// The glyph each button leads with (the app's CTAGlyph) and the deck's two
// arrows, drawn here at the size, the weight and the place of the SF Symbol
// the app uses, and traced over the app's own captures until each covered
// the app's ink to within a few pixels (82 to 92 per cent of it): Apple's
// symbols are licensed for its platforms, not for a web page. Each is drawn
// in the capture's own pixels, three to a point, and its box is its ink and
// nothing more, so it stands as wide and as tall as the app's (--gw, --gh).
export const glyph = (cls, w, hgt, body) => `<svg class="pp-g ${cls}" viewBox="0 0 ${w} ${hgt}" style="--gw: ${+(w / 3).toFixed(2)}; --gh: ${+(hgt / 3).toFixed(2)}" aria-hidden="true">${body}</svg>`;
export const GLYPH = {
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
export const badge = (size) => `<span class="pp-badge" style="--bs: ${size}" aria-hidden="true">${GLYPH.mark}</span>`;

export function plate(recipe) {
  return `<div class="pp-plate"><span class="pp-rays"></span><span class="pp-rim"></span>`
    + `<span class="pp-dish">${dishArt(recipe)}</span></div>`;
}

// What the shelf is short of, as one button that puts all of it on the
// shelf (DishCard coverageChip): the app's coral sticker on its dashed
// "provisional" edge, the first three gaps drawn, and the rest a count.
export function missingHTML(p) {
  const n = p.missing.length;
  const tiles = p.missing.slice(0, 3).map((name) => `<span><i>${art(name)}</i><b>${esc(name)}</b></span>`).join('');
  const more = n > 3 ? `<span class="is-more"><i>+${n - 3}</i><b>more</b></span>` : '';
  return `<button type="button" class="pp-missing" aria-label="Add the ${n} missing ingredient${n === 1 ? '' : 's'} to your shelf: ${esc(p.missing.join(', '))}">`
    + '<svg class="pp-dash" aria-hidden="true"><rect /></svg>'
    + `<span class="pp-missing-word" aria-hidden="true">+ Add ${n} missing</span><span class="pp-missing-row" aria-hidden="true">${tiles}${more}</span></button>`;
}

// The card is a door to its recipe, as the app's is (a tap anywhere on it),
// and the add-missing chip inside it a door of its own: one button laid
// over the whole card, and the chip's above that.
export function cardHTML(p) {
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

export function cardLabel(p) {
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
export function fitLine(el, floor) {
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
export const PIECES = [
  ['Broccoli', -8, 16, 116, 0.954, -11], ['Eggs', 102, 2, 120, 1.059, 6],
  ['Bell Pepper', 230, 18, 104, 0.831, 13], ['Lemon', 324, 80, 84, 0.918, -8],
  ['Tomato', 26, 112, 100, 0.944, 9], ['Cheddar Cheese', 2, 278, 120, 1.15, -7],
  ['Bread', 140, 284, 114, 1.128, 5], ['Avocado', 280, 280, 100, 0.8, 14],
];

// The type-in page's own glyphs, traced over the 1.3 build's captures as
// the others were: fork.knife at the bar's 18 semibold, in white, and at
// the art well's 24 black, in the placeholder grey; the undo chip's xmark
// at 9 black, and the staple's plus at 11 black.
GLYPH.fork = glyph('is-fork', 39, 63, '<path class="is-fill" d="M0.3 2.3a2.25 2.25 0 0 1 4.5 0V19.3h2.9V2.3a2.15 2.15 0 0 1 4.3 0V19.3h2.8V2.3a2.1 2.1 0 0 1 4.2 0V20c0 3.6-2.3 6-5.3 6.9v32a3.85 3.85 0 0 1-7.7 0v-32C2.6 26 0.3 23.6 0.3 20z"/><path class="is-fill" d="M36.4 0.2c1.3 0 2.3 1 2.3 2.4v56.3a3.85 3.85 0 0 1-7.7 0V36.6l-2.6-2c-1.3-1-1.9-2.3-1.9-4V22c0-9.5 3.5-17 7.9-20.9.6-.6 1.2-.9 2-.9z"/>');
GLYPH.well = glyph('is-well', 56.6, 88.4, '<path class="is-fill" d="M0.6 3.2a3.2 3.2 0 0 1 6.4 0V26.4h4.9V3a2.8 2.8 0 0 1 5.6 0V26.4h4.9V3.2a3.2 3.2 0 0 1 6.4 0V28.5c0 5-3.4 8.9-8.8 10.9v43.3a5.7 5.7 0 0 1-11.4 0V39.4C4 37.4 0.6 33.5 0.6 28.5z"/><path class="is-fill" d="M53.5 0.1c1.7 0 3.1 1.4 3.1 3.2v79.4a6.1 6.1 0 0 1-12.2 0V55.6L41 52.8c-1.6-1.3-2.4-3.2-2.4-5.4V33c0-14 4.9-25 11.9-31.6.8-.8 1.8-1.3 3-1.3z"/>');
GLYPH.x = glyph('is-x', 23, 23, '<path d="M2.8 2.8 20.2 20.2M20.2 2.8 2.8 20.2" stroke-width="5.6"/>');
GLYPH.plus = glyph('is-plus', 29, 29, '<path d="M14.5 3.1v22.8M3.1 14.5h22.8" stroke-width="6.2"/>');

// CheckBadge(size: 44, glyph: .plus), the field's own add: a cross of the
// check green with every corner rounded (RoundedCross, its arms 0.27 of
// its span), in a white ellipse a tenth shorter than it is wide. On an
// empty field it stands at a third of itself.
export const PLUS_BADGE = (() => {
  const cx = 22;
  const cy = 19.8;
  const half = 14.52;
  const ht = 3.92;
  const r = 2.64;
  const pts = [[cx - ht, cy - half], [cx + ht, cy - half], [cx + ht, cy - ht], [cx + half, cy - ht], [cx + half, cy + ht], [cx + ht, cy + ht],
    [cx + ht, cy + half], [cx - ht, cy + half], [cx - ht, cy + ht], [cx - half, cy + ht], [cx - half, cy - ht], [cx - ht, cy - ht]];
  let d = `M${cx} ${cy - half}`;
  for (let i = 1; i <= pts.length; i++) {
    const [px, py] = pts[i % pts.length];
    const [ax, ay] = pts[(i - 1 + pts.length) % pts.length];
    const [bx, by] = pts[(i + 1) % pts.length];
    const inx = Math.sign(px - ax); const iny = Math.sign(py - ay);
    const outx = Math.sign(bx - px); const outy = Math.sign(by - py);
    const sweep = inx * outy - iny * outx > 0 ? 1 : 0;
    d += `L${(px - inx * r).toFixed(2)} ${(py - iny * r).toFixed(2)}A${r} ${r} 0 0 ${sweep} ${(px + outx * r).toFixed(2)} ${(py + outy * r).toFixed(2)}`;
  }
  return `<svg class="pp-plusbadge" viewBox="0 0 44 39.6" aria-hidden="true"><ellipse cx="22" cy="19.8" rx="21.03" ry="18.83" fill="#fff" stroke="#000" stroke-width="1.94"/><path d="${d}Z" fill="#349e31" stroke="#000" stroke-width="1.98"/></svg>`;
})();

// ======================================================================
// the chef writing (CookingDishCard.swift WritingScene and MenuScript)
// ======================================================================

// A pencil writing tonight's menu on a card, on the plate where the dish
// will be, while the halo turns: the app's own scene, number for number.
// Each line is handwriting as a shape, a run of quadratic arcs off a
// baseline from a seeded generator (mulberry32, the lab page's), so the
// page writes the same menu every time; the pencil's tip rides the end of
// the ink, lifting between lines, and the card turns from the dashed
// "provisional" edge to solid ink when the tick lands. Nothing here says
// how far along the chef is: the bar under it does that.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function scribble(x0, y, length, amplitude, seed, step = 7) {
  const next = seeded(seed);
  const arcs = [];
  let x = x0;
  let up = true;
  for (let k = 0; x < x0 + length; k++) {
    const w = step * (0.8 + next() * 0.5);
    const gap = (k % 5 === 4 && next() < 0.6) ? 4 : 0;
    const tall = (k % 4 === 2 && next() < 0.7) ? amplitude * 1.9 : amplitude * (0.7 + next() * 0.6);
    const cx = x + w / 2 + gap / 2;
    const cy = y + (up ? -tall : tall * 0.45);
    const from = x;
    x += w + gap;
    arcs.push([from, cx, cy, x]);
    up = !up;
  }
  // the arcs flattened finely, so a fraction of the line's length is a
  // point on it, as SwiftUI's trimmedPath measures one
  const pts = [[x0, y]];
  for (const [a, cx, cy, b] of arcs) {
    for (let i = 1; i <= 24; i++) {
      const t = i / 24;
      const u = 1 - t;
      pts.push([u * u * a + 2 * u * t * cx + t * t * b, u * u * y + 2 * u * t * cy + t * t * y]);
    }
  }
  const run = [0];
  for (let i = 1; i < pts.length; i++) run.push(run[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = run[run.length - 1];
  const at = (fraction) => {
    const d = Math.min(1, Math.max(0, fraction)) * total;
    let lo = 0;
    let hi = run.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (run[m] < d) lo = m; else hi = m; }
    const u = (d - run[lo]) / ((run[hi] - run[lo]) || 1);
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * u, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * u];
  };
  // the app times a line by 48 chords along it (MenuScript.length)
  let length48 = 0;
  let last = [x0, y];
  for (let k = 1; k <= 48; k++) { const p = at(k / 48); length48 += Math.hypot(p[0] - last[0], p[1] - last[1]); last = p; }
  const d = `M${x0} ${y}${arcs.map(([, cx, cy, b]) => `Q${cx.toFixed(2)} ${cy.toFixed(2)} ${b.toFixed(2)} ${y}`).join('')}`;
  return { d, at, start: [x0, y], end: at(1), length: Math.max(1, length48) };
}
let menu = null;
export function menuScript() {
  if (menu) return menu;
  const strokes = [
    [36, 40, 110, 7, 11, '#ff4b4b', 3.4, 120],
    [30, 70, 140, 4.2, 21, '#000', 2.6, 95],
    [30, 94, 126, 4.2, 31, '#000', 2.6, 95],
    [30, 118, 96, 4.2, 41, '#000', 2.6, 95],
  ].map(([x0, y, length, amplitude, seed, color, width, speed]) => ({ ...scribble(x0, y, length, amplitude, seed), color, width, speed }));
  const segments = [];
  let t = 0.35;
  strokes.forEach((s, i) => {
    const from = i === 0 ? [s.start[0] - 30, s.start[1] - 40] : strokes[i - 1].end;
    const hop = i === 0 ? 0.5 : 0.26;
    segments.push({ hop: true, from, to: s.start, t0: t, t1: t + hop });
    t += hop;
    const duration = s.length / s.speed;
    segments.push({ index: i, t0: t, t1: t + duration });
    t += duration;
  });
  const drawEnd = t;
  const hold = 1.1;
  const clear = 0.45;
  const tickTime = 0.45;
  const ease = (x) => (x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x);
  const frame = (elapsed) => {
    const t = elapsed % (drawEnd + hold + clear);
    const f = { progress: strokes.map(() => 0), ink: 1, tick: 0, done: false, pencil: [strokes[0].start[0] - 30, strokes[0].start[1] - 40], tilt: 34, lift: 0, shadow: 1 };
    if (t < drawEnd) {
      // every line the pencil has passed is finished, exactly
      for (const s of segments) if (!s.hop && t >= s.t1) f.progress[s.index] = 1;
      const now = segments.find((s) => t >= s.t0 && t < s.t1);
      if (now?.hop) {
        const u = ease((t - now.t0) / (now.t1 - now.t0));
        const lift = Math.sin(u * Math.PI);
        f.pencil = [now.from[0] + (now.to[0] - now.from[0]) * u, now.from[1] + (now.to[1] - now.from[1]) * u - lift * 14];
        f.lift = lift;
        f.tilt = 34 + lift * 8;
        f.shadow = 1 - lift * 0.6;
      } else if (now) {
        const u = (t - now.t0) / (now.t1 - now.t0);
        f.progress[now.index] = u;
        f.pencil = strokes[now.index].at(u);
      } else {
        // between loops: the pencil hovers off the page
        f.shadow = 0;
      }
    } else {
      f.progress = strokes.map(() => 1);
      f.done = true;
      f.tick = Math.min(1, (t - drawEnd) / tickTime);
      const end = strokes[strokes.length - 1].end;
      f.pencil = [end[0] + 14, end[1] - 26];
      f.tilt = 46;
      f.shadow = 0;
      if (t > drawEnd + hold) f.ink = 1 - (t - drawEnd - hold) / clear;
    }
    return f;
  };
  menu = { strokes, drawEnd, tickTime, finishedAt: drawEnd + tickTime + 0.1, frame };
  return menu;
}

// The card: composed in the lab's 200 × 150, scaled as one piece to the
// plate (68 per cent of its width, which binds before 70 of its height),
// and tipped two degrees. The pencil is drawn with its tip at its origin,
// so it turns about the point that touches the page: eraser, ferrule,
// body (its shade and its highlight), cone and lead, each on a 1.6 ink line.
function menuHTML() {
  const m = menuScript();
  const lines = m.strokes.map((s) => `<path class="pp-ln" d="${s.d}" pathLength="1" stroke="${s.color}" stroke-width="${s.width}"/>`).join('');
  return `<svg class="pp-menu" viewBox="0 0 200 150" aria-hidden="true">`
    + '<rect y="3" width="200" height="150" rx="9" fill="rgb(0 0 0 / 0.18)"/>'
    + '<rect width="200" height="150" rx="9" fill="#fff"/>'
    + '<rect class="pp-menu-dashed" x="1.25" y="1.25" width="197.5" height="147.5" rx="7.75" fill="none" stroke="#5a5a5a" stroke-width="2.5" stroke-dasharray="6 4"/>'
    + '<rect class="pp-menu-solid" x="1.25" y="1.25" width="197.5" height="147.5" rx="7.75" fill="none" stroke="#000" stroke-width="2.5"/>'
    + lines
    + '<path class="pp-ln pp-tick" d="M148 108 157 117 174 99" pathLength="1" stroke="#349e31" stroke-width="4"/>'
    + '<g class="pp-pencil">'
    + '<ellipse class="pp-pshadow" rx="6" ry="2.2" fill="rgb(0 0 0 / 0.16)"/>'
    + '<rect x="-5.2" y="-71.2" width="10.4" height="6.4" rx="1.7" fill="#eba6a6" stroke="#000" stroke-width="1.6"/>'
    + '<rect x="-5.7" y="-63.2" width="11.4" height="5.4" fill="#cdcdcd" stroke="#000" stroke-width="1.6"/>'
    + '<rect x="-6" y="-57" width="12" height="40" fill="#ffd67e"/>'
    + '<rect x="-6" y="-57" width="4" height="40" fill="rgb(0 0 0 / 0.13)"/>'
    + '<rect x="1.4" y="-49" width="2.2" height="28" rx="1.1" fill="rgb(255 255 255 / 0.85)"/>'
    + '<rect x="-5.2" y="-56.2" width="10.4" height="38.4" fill="none" stroke="#000" stroke-width="1.6"/>'
    + '<path d="M-6 -17H6L0 0Z" fill="#ebd5a6" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/>'
    + '<path d="M-2.2 -6H2.2L0 0Z" fill="#000"/>'
    + '</g></svg>';
}

// EstimatedProgressBar: 0.9 · (1 − e^(−t/τ)), τ the expected time over 1.8,
// past sixty per cent as the expected time passes and never full: the last
// tenth belongs to the answer arriving, which takes the bar away
export const EXPECTED = 10;
export const barAt = (seconds) => 0.9 * (1 - Math.exp(-seconds / (EXPECTED / 1.8)));

// The seat's card: DishCard's frame, its plate coral and its halo turning,
// the name band's treatment for "Chef's cooking…", and the bar where a
// dish keeps its pills. It opens nothing, so it is not a button.
export function seatHTML() {
  return `
    <div class="pp-card-open" tabindex="0" role="group" aria-label="The chef is writing a dish for your shelf. It will appear on this card when it is ready."></div>
    <div class="pp-hero" aria-hidden="true">
      <span class="pp-stocked is-cooking">${img(`${HERE}hat.webp`)}Made for your shelf</span>
      <div class="pp-plate is-writing"><span class="pp-rays"></span><span class="pp-rim"></span><span class="pp-dish">${menuHTML()}</span></div>
    </div>
    <div class="pp-title" aria-hidden="true"><span class="pp-outlined">Chef’s cooking…</span></div>
    <div class="pp-body is-seat" aria-hidden="true">
      <p class="pp-summary">He’s writing a dish out of the food you actually have. It lands on this card when it’s ready.</p>
      <div class="pp-wait"><p>Writing tonight’s menu…</p><span class="pp-track"><i></i></span></div>
    </div>`;
}
// One clock for the scene and the bar, started as the card is, and run
// for as long as the card is on the page. (The app's runs at thirty a
// second; this one at the display's rate.) Under reduced motion the page
// stands written and ticked, and the bar, which is information and not
// decoration, steps every 0.8 seconds.
export function runSeat(card) {
  const m = menuScript();
  const svg = card.querySelector('.pp-menu');
  const lines = [...svg.querySelectorAll('.pp-ln')];
  const pencil = svg.querySelector('.pp-pencil');
  const shadow = svg.querySelector('.pp-pshadow');
  const fill = card.querySelector('.pp-track i');
  const start = performance.now();
  const paint = (seconds) => {
    const f = m.frame(seconds);
    lines.forEach((el, i) => {
      const p = i < f.progress.length ? f.progress[i] : f.tick;
      el.style.strokeDasharray = `${Math.max(0.0001, p)} 2`;
      el.style.opacity = p > 0 ? f.ink : 0;
    });
    svg.classList.toggle('is-done', f.done);
    pencil.setAttribute('transform', `translate(${f.pencil[0].toFixed(2)} ${f.pencil[1].toFixed(2)}) rotate(${f.tilt.toFixed(2)})`);
    shadow.setAttribute('transform', `translate(0 ${(-0.2 + f.lift * 14).toFixed(2)}) scale(${(1 - f.lift * 0.5).toFixed(3)})`);
    shadow.style.opacity = f.shadow;
  };
  const bar = (seconds) => { fill.style.width = `max(calc(10 * var(--pt)), ${(barAt(seconds) * 100).toFixed(2)}%)`; };
  if (reduced()) {
    paint(m.finishedAt);
    bar(0);
    const tick = setInterval(() => {
      if (!card.isConnected) { clearInterval(tick); return; }
      bar((performance.now() - start) / 1000);
    }, 800);
    return;
  }
  const loop = (now) => {
    if (!card.isConnected) return;
    const seconds = (now - start) / 1000;
    paint(seconds);
    bar(seconds);
    requestAnimationFrame(loop);
  };
  paint(0);
  bar(0);
  requestAnimationFrame(loop);
}

// ---- the drawings, bundled or drawn ----
// A food's drawing (IllustrationView): the bundled one in place at once, or
// an empty frame that hydrate() fills when the art store has drawn it. With
// `tile`, a name with no drawing at all wears the app's missing tile, its
// shelf's pastel under the fork and knife, as the shelf screen's cards do.
export function art(name, { cls = '', dish = false, tile = null } = {}) {
  const now = drawingNow(name, dish);
  const tileAttr = tile ? ` data-tile="${tile}"` : '';
  if (now) return `<img class="pp-art ${cls}" src="${now}" alt="" decoding="async" draggable="false" />`;
  return `<img class="pp-art ${cls}" data-art="${esc(name)}"${dish ? ' data-dish' : ''}${tileAttr} data-pending src="${BLANK}" alt="" decoding="async" draggable="false" />`;
}
// A dish's drawing on its plate (DishHeroArt): the bundled one, or, while
// the art store draws it, the dish's own foods in a cluster on the plate
// (those the page has drawings of, six at most) and "plating…" under them.
// A drawing that never comes leaves the cluster, and takes the word away.
export function dishArt(recipe) {
  if (drawingNow(recipe.title, true)) return art(recipe.title, { dish: true });
  const foods = recipe.ingredientNames.filter((n) => drawingNow(n)).slice(0, 6);
  const cols = Math.max(1, Math.min(foods.length, foods.length <= 4 ? 2 : 3));
  return `<span class="pp-cluster" style="--cols: ${cols}">${foods.map((n) => art(n)).join('')}</span>`
    + '<span class="pp-plating">plating…</span>'
    + art(recipe.title, { dish: true, cls: 'is-hero' });
}
// Fill every frame under `root` still waiting for its drawing. `generate`
// false asks for nothing new (the art well, the recipes' cluster).
export function hydrate(root, { generate = true } = {}) {
  for (const el of root.querySelectorAll('img[data-pending]')) {
    if (el.dataset.asked) continue;
    el.dataset.asked = '1';
    const dish = el.hasAttribute('data-dish');
    drawing(el.dataset.art, { dish, generate }).then((url) => {
      if (!el.isConnected) return;
      el.removeAttribute('data-pending');
      const dishPlate = dish ? el.closest('.pp-dish') : null;
      if (url) {
        el.src = url;
        el.classList.add('is-drawn');
        dishPlate?.classList.add('is-plated');
      } else {
        dishPlate?.classList.add('is-tried');
        if (el.dataset.tile) el.replaceWith(missingTile(el.dataset.tile, el.className));
      }
    });
  }
}
// IllustrationPlaceholder's missing tile: the shelf's pastel, rounded, the
// fork and knife in it
export function missingTile(pastel, cls = '') {
  const t = h('span', `pp-tile ${cls.replace('pp-art', '')}`, { 'aria-hidden': 'true' });
  t.style.background = pastel;
  t.innerHTML = GLYPH.well;
  return t;
}

// the strip's short everyday word (CookScreen chipName) and its pastel
export function chipName(name) {
  const n = name.toLowerCase();
  if (n.includes('beef')) return 'Beef';
  if (n.includes('cheddar') || n.includes('cheese')) return 'Cheddar';
  if (n.includes('bun') || n.includes('bread')) return 'Bun';
  if (n.includes('chicken')) return 'Chicken';
  const last = name.split(' ').pop();
  return last.charAt(0).toUpperCase() + last.slice(1);
}
export function chipPastel(name) {
  const n = name.toLowerCase();
  if (n.includes('beef')) return '#ebd5a6';
  if (n.includes('lettuce')) return '#beeba6';
  if (n.includes('tomato')) return '#eba6a6';
  if (n.includes('cheddar') || n.includes('cheese')) return '#f5ee90';
  if (n.includes('bun') || n.includes('bread')) return '#e2ffff';
  return '#dbdbdb';
}

// the fuzzy rule, the design system's one strip of it
export const rule = (cls = '') => img(`${HERE}rule.webp`, `pp-rule ${cls}`);

// More of the app's symbols, drawn at their size and weight: checkmark and
// magnifyingglass on a primary, chevron.down on a secondary, trash on the
// destructive sticker, photo.on.rectangle on the library's button, and the
// shelf's StepperGlyph, a plus or a minus of rounded bars.
GLYPH.check = glyph('is-check', 54, 42, '<path d="M4.2 22.6 18.6 37.4 49.8 4.6" stroke-width="7.6"/>');
GLYPH.search = glyph('is-search', 52, 52, '<circle cx="21.4" cy="21.4" r="17.6" stroke-width="6.2"/><path d="m34.4 34.4 13.8 13.8" stroke-width="7.4"/>');
GLYPH.chevron = glyph('is-chevron', 34, 21, '<path d="M3.6 3.6 17 17 30.4 3.6" stroke-width="6.6"/>');
GLYPH.trash = glyph('is-trash', 48, 54, '<path d="M3 11h42M17.4 10V5.6c0-1.6 1.3-2.8 2.8-2.8h7.6c1.6 0 2.8 1.3 2.8 2.8V10M8.4 11l2.6 36.6c.2 2.2 2 3.8 4.2 3.8h17.6c2.2 0 4-1.6 4.2-3.8L39.6 11M19.4 20.4v21.2M28.6 20.4v21.2" stroke-width="5"/>');
GLYPH.photo = glyph('is-photo', 54, 45, '<rect x="11.6" y="2.6" width="39.8" height="30.2" rx="5" stroke-width="5"/><path d="M5.6 11.8v24.6c0 3.2 2.6 5.8 5.8 5.8h29.4" stroke-width="5"/><path d="m15.8 29 9.6-9.4 6.8 6.6 5-4.6 9.2 7.4" stroke-width="4.4"/><circle class="is-fill" cx="39.4" cy="11.4" r="3.6"/>');
export const stepper = (minus, span) => `<svg class="pp-stepper" viewBox="0 0 ${span} ${span}" style="--sp: ${span}" aria-hidden="true"><rect x="0" y="${span * 0.365}" width="${span}" height="${span * 0.27}" rx="${span * 0.08}"/>${minus ? '' : `<rect x="${span * 0.365}" y="0" width="${span * 0.27}" height="${span}" rx="${span * 0.08}"/>`}</svg>`;
// InkMark (ScanDoors): a tick or a cross in a colour, on an ink line
export function inkMark(tick, color, size = 26) {
  const w = size * 0.2;
  const o = Math.max(2, size * 0.055);
  const d = tick ? `M${size * 0.16} ${size * 0.55}L${size * 0.4} ${size * 0.78}L${size * 0.85} ${size * 0.22}` : `M${size * 0.2} ${size * 0.2}L${size * 0.8} ${size * 0.8}M${size * 0.8} ${size * 0.2}L${size * 0.2} ${size * 0.8}`;
  return `<svg class="pp-inkmark" viewBox="0 0 ${size} ${size}" style="--ms: ${size}" aria-hidden="true"><path d="${d}" stroke="#000" stroke-width="${w + o * 2}"/><path d="${d}" stroke="${color}" stroke-width="${w}"/></svg>`;
}
