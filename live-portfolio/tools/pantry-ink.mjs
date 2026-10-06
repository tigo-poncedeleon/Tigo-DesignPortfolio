// pantry-ink.mjs — draw PantryPal's four ways out as the ink wireframes in
// the case study's 4.1 (assets/case/pantrypal/lab/ink-1.webp to ink-4.webp).
//
//     node live-portfolio/tools/pantry-ink.mjs
//
// The four were working prototypes in colour (lab/c1.webp to c4.webp, the
// UX Lab's captures); the story tells them as the ideas they were, so they
// are drawn here in the hand of the Sketch chapter's three sheets: black ink
// on graph paper at the sheets' own pitch, a wobble in every line, the phone
// drawn as the sheets draw it, and the lettering in Chalkboard SE (macOS),
// rendered into the picture so no font ships with the page. Each sheet
// keeps its prototype's layout, its words and its foods.
//
// The foods and the chef are the app's own drawings (app/art/, mascot.webp)
// with the colour taken out: each is thresholded to its ink, at a level of
// its own, since a dark food (the steak, the beef) would otherwise come out
// a solid blot.
//
// Needs playwright-core where Node can find it from the folder it is run in
// (as og-cards.mjs does), the system Chrome, ImageMagick and cwebp.

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { chromium } = createRequire(path.join(process.cwd(), 'pantry-ink.cjs'))('playwright-core');
const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASE = path.join(site, 'assets/case/pantrypal');
const OUT = path.join(CASE, 'lab');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pantry-ink-'));
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ---- the ink: each drawing to its outline, at its own level ----
const LEVEL = { steak: 14, 'ground-beef': 15, tuna: 20, 'cheddar-cheeseburger': 22, lamb: 20, pork: 26, salmon: 24, tomato: 9, broccoli: 20 };
const FOODS = ['tuna', 'lamb', 'pork', 'chicken-breast', 'steak', 'ground-beef', 'lettuce', 'tomato', 'onion', 'broccoli',
  'burger-buns', 'salt', 'eggs', 'pasta', 'salmon', 'cheddar-cheeseburger'];
const magick = (...args) => execFileSync('magick', args);
function ink(src, name, level = 34) {
  const m = path.join(TMP, `m-${name}.png`);
  magick(src, '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-resize', '360x360', '-colorspace', 'gray', '-threshold', `${level}%`, '-negate', m);
  const size = execFileSync('magick', ['identify', '-format', '%wx%h', m]).toString();
  magick('-size', size, 'xc:black', m, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', path.join(TMP, `${name}.png`));
}
for (const f of FOODS) ink(path.join(CASE, 'app/art', `${f}.webp`), f, LEVEL[f]);
ink(path.join(CASE, 'mascot.webp'), 'chef');

// ---- the drawing ----
const W = 480;
const H = 820;
const FONT = "'Chalkboard SE','Chalkboard','Comic Sans MS',cursive";
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#8217;');
class Sheet {
  constructor() { this.parts = []; }
  add(x) { this.parts.push(x); return this; }
  rect(x, y, w, h, { rx = 12, sw = 3.2, dash = '', fill = 'none' } = {}) {
    return this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="#151515" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
  }
  line(x1, y1, x2, y2, sw = 3, dash = '') {
    return this.add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#151515" stroke-width="${sw}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
  }
  path(d, sw = 3, fill = 'none') {
    return this.add(`<path d="${d}" fill="${fill}" stroke="#151515" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  circle(cx, cy, r, sw = 3, fill = 'none') {
    return this.add(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#151515" stroke-width="${sw}"/>`);
  }
  text(x, y, t, { size = 22, anchor = 'middle', fill = '#151515' } = {}) {
    return this.add(`<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" text-anchor="${anchor}" fill="${fill}">${esc(t)}</text>`);
  }
  img(name, x, y, w, h) {
    return this.add(`<image href="file://${path.join(TMP, `${name}.png`)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`);
  }
  // the scallops the app hangs under its header, as the sheets draw them
  wavy(y, x0 = 26, x1 = 454, amp = 3.6, per = 15, sw = 2.6) {
    let d = `M${x0} ${y}`;
    const n = Math.floor(((x1 - x0) / per) * 2);
    for (let i = 0; i < n; i++) {
      const xa = x0 + ((i + 0.5) * per) / 2;
      const xb = x0 + ((i + 1) * per) / 2;
      d += ` Q${xa.toFixed(1)} ${(y + (i % 2 ? amp : -amp)).toFixed(1)} ${xb.toFixed(1)} ${y}`;
    }
    return this.path(d, sw);
  }
  scribble(x0, x1, y, sw = 2.2, amp = 2.2, per = 11) {
    let d = `M${x0} ${y}`;
    for (let x = x0, i = 0; x < x1; i++) {
      const xn = Math.min(x1, x + per);
      d += ` Q${((x + xn) / 2).toFixed(1)} ${(y + (i % 2 ? amp : -amp)).toFixed(1)} ${xn.toFixed(1)} ${(y + (i % 3 ? 0.6 : -0.4)).toFixed(1)}`;
      x = xn;
    }
    return this.path(d, sw);
  }
}

// the phone, as the three sheets draw it: a rounded body, the island, the
// time, the wifi and the battery, and the home bar
function frame(d) {
  d.rect(22, 14, 436, 792, { rx: 54, sw: 4 });
  d.rect(196, 30, 88, 22, { rx: 11, sw: 2.6 });
  d.text(64, 50, '12:20PM', { size: 15, anchor: 'start' });
  d.path('M366 44 q8 -8 16 0 M369 47 q5 -5 10 0', 2.4);
  d.circle(374, 49, 1.4, 2);
  d.rect(392, 38, 28, 13, { rx: 4, sw: 2.4 });
  d.add('<rect x="395" y="41" width="15" height="7" rx="2" fill="#151515"/>');
  d.line(421.5, 42, 421.5, 47, 2.4);
  d.line(196, 790, 284, 790, 4);
}
// the wordmark in its cloud, two tomatoes, the chef, and the scallops
function header(d) {
  d.path('M54 96 C46 72 72 62 92 70 C104 56 136 58 146 70 C168 60 196 66 198 86 C214 92 212 118 192 122 C178 136 146 132 136 124 C118 136 86 134 76 122 C54 124 44 108 54 96 Z', 3);
  d.text(80, 94, 'Pantry', { size: 21, anchor: 'start' });
  d.text(80, 118, 'Pal', { size: 21, anchor: 'start' });
  for (const cx of [126, 146]) {
    d.circle(cx, 112, 7, 2.4);
    d.path(`M${cx - 4} 105 l4 3 l4 -3`, 2);
  }
  d.img('chef', 360, 56, 82, 82);
  d.wavy(150);
}
function foodCell(d, x, y, w, h, name, label, count = null) {
  const tw = Math.max(56, label.length * 9 + 18);
  d.rect(x + (w - tw) / 2, y + 8, tw, 24, { rx: 10, sw: 2.4, dash: '5 4' });
  d.text(x + w / 2, y + 26, label, { size: 14 });
  d.img(name, x + 16, y + 38, w - 32, h - 52);
  if (count != null) {
    d.circle(x + w - 22, y + h - 20, 11, 2.4);
    d.text(x + w - 22, y + h - 14.5, String(count), { size: 14 });
  }
}

function oneRedButton() {
  const d = new Sheet(); frame(d); header(d);
  d.rect(74, 166, 332, 52, { rx: 16, sw: 3, dash: '9 7' });
  d.text(240, 200, 'Choose ingredients!', { size: 25 });
  // the meat shelf, three by two, the sixth place the way to add
  const cells = [['tuna', 'Tuna', 3], ['lamb', 'Lamb', 1], ['pork', 'Pork', 1], ['chicken-breast', 'Chicken', 2], ['steak', 'Steak', 1]];
  const [x0, y0, cw, ch] = [38, 232, 134, 124];
  cells.forEach(([n, l, c], i) => foodCell(d, x0 + (i % 3) * cw, y0 + Math.floor(i / 3) * ch, cw, ch, n, l, c));
  d.rect(x0 + 2 * cw + 14, y0 + ch + 12, cw - 28, ch - 24, { rx: 14, sw: 2.6, dash: '7 6' });
  d.text(x0 + 2.5 * cw, y0 + ch + 58, '+', { size: 30 });
  d.text(x0 + 2.5 * cw, y0 + ch + 86, 'Add to shelf', { size: 14 });
  d.line(x0 + cw, y0 + 6, x0 + cw, y0 + 2 * ch - 6, 2.4, '6 6');
  d.line(x0 + 2 * cw, y0 + 6, x0 + 2 * cw, y0 + 2 * ch - 6, 2.4, '6 6');
  d.line(x0 + 6, y0 + ch, x0 + 3 * cw - 6, y0 + ch, 2.4, '6 6');
  // the shelves' tabs, the first the one you are on
  let tx = 34;
  ['Meat', 'Produce', 'Dairy', 'Grain'].forEach((t, i) => {
    const tw = t === 'Produce' ? 112 : 90;
    d.rect(tx, 500, tw, 44, { rx: 10, sw: 3, fill: i === 0 ? 'url(#hatch)' : 'none' });
    if (i === 0) d.rect(tx + 14, 510, tw - 28, 24, { rx: 6, sw: 0, fill: '#fff' });
    d.text(tx + tw / 2, 529, t, { size: 19 });
    tx += tw + 10;
  });
  // the one thing allowed to be loud
  d.rect(40, 676, 400, 70, { rx: 16, sw: 3.4, fill: '#151515' });
  d.text(256, 720, 'Scan your groceries', { size: 24, fill: '#fff' });
  d.path('M76 718 q0 -16 14 -14 q4 -10 14 -4 q10 -6 14 4 q14 -2 12 14 z M82 718 h44 v8 h-44 z', 2.6, '#fff');
  return d;
}
function chefsPick() {
  const d = new Sheet(); frame(d); header(d);
  d.img('chef', 36, 162, 62, 62);
  d.rect(104, 174, 222, 40, { rx: 14, sw: 3 });
  d.text(215, 201, 'Tonight, I’d make...', { size: 18 });
  // the wardrobe, which is the shelf
  d.rect(378, 162, 54, 50, { rx: 6, sw: 3 });
  d.line(405, 166, 405, 208, 2.4);
  d.circle(399, 186, 1.8, 2); d.circle(411, 186, 1.8, 2);
  d.text(405, 230, 'My shelf', { size: 13 });
  // the dish
  d.rect(40, 244, 400, 360, { rx: 18, sw: 3.4 });
  d.circle(240, 338, 80, 3);
  d.img('cheddar-cheeseburger', 172, 276, 136, 124);
  d.text(240, 452, 'Cheddar Cheeseburger', { size: 25 });
  d.scribble(96, 384, 478); d.scribble(130, 350, 496);
  d.line(176, 516, 176, 556, 2.4, '5 5'); d.line(304, 516, 304, 556, 2.4, '5 5');
  for (const [x, a, b] of [[112, 'calories:', '600 cal'], [240, 'protein:', '32g'], [368, 'time:', '25 min']]) {
    d.text(x, 530, a, { size: 13 }); d.text(x, 552, b, { size: 18 });
  }
  d.rect(142, 568, 196, 26, { rx: 13, sw: 2.6 });
  d.path('M158 581 l5 5 l9 -10', 2.6);
  d.text(252, 587, 'You have all 6!', { size: 15 });
  // the one way on, loud, and the other, quiet
  d.rect(40, 622, 400, 56, { rx: 14, sw: 3.4, fill: '#151515' });
  d.text(240, 659, 'Cook it!', { size: 26, fill: '#fff' });
  d.rect(40, 692, 400, 46, { rx: 14, sw: 3 });
  d.path('M162 709 a10 10 0 1 1 -3 -7', 2.6);
  d.path('M159.5 696 l0.5 7.5 l-7.5 0.5', 2.6);
  d.text(252, 722, 'Show me another', { size: 18 });
  return d;
}
function oneQuestion() {
  const d = new Sheet(); frame(d); header(d);
  d.rect(96, 168, 288, 56, { rx: 16, sw: 3.2 });
  d.text(240, 205, 'What’s the vibe?', { size: 27 });
  d.text(240, 258, 'pick one, the chef handles the rest', { size: 16 });
  [['eggs', 'Quick', '20 min or less'], ['pasta', 'Comfort', 'warm & heavy'], ['salmon', 'Fresh', 'light & green'], ['chef', 'Surprise me', 'chef’s call']]
    .forEach(([n, l, sub], i) => {
      const x = 44 + (i % 2) * 202;
      const y = 284 + Math.floor(i / 2) * 212;
      d.rect(x, y, 190, 196, { rx: 16, sw: 3.2 });
      d.img(n, x + 40, y + 18, 110, 96);
      d.text(x + 95, y + 146, l, { size: 23 });
      d.text(x + 95, y + 172, sub, { size: 14 });
    });
  [214, 240, 266].forEach((cx, i) => d.circle(cx, 736, 7, 2.6, i === 0 ? '#151515' : 'none'));
  return d;
}
function cardIsTheButton() {
  const d = new Sheet(); frame(d); header(d);
  const foods = [['ground-beef', 'Ground Beef'], ['steak', 'Steak'], ['chicken-breast', 'Chicken'], ['pork', 'Pork'], ['lamb', 'Lamb'], ['tuna', 'Tuna'],
    ['lettuce', 'Lettuce'], ['tomato', 'Tomato'], ['onion', 'Onion'], ['broccoli', 'Broccoli'], ['burger-buns', 'Buns'], ['salt', 'Salt']];
  const [x0, y0, cw, ch] = [34, 166, 137.3, 150];
  foods.forEach(([n, l], i) => foodCell(d, x0 + (i % 3) * cw, y0 + Math.floor(i / 3) * ch, cw, ch, n, l));
  for (const c of [1, 2]) d.line(x0 + c * cw, y0 + 4, x0 + c * cw, y0 + 4 * ch - 8, 2.4, '6 6');
  for (const r of [1, 2, 3]) d.line(x0 + 4, y0 + r * ch, x0 + 3 * cw - 4, y0 + r * ch, 2.4, '6 6');
  return d;
}

// the paper: the three sheets' grid, its pitch and its blue, under the ink,
// and every line of the ink a little unsteady, as a pen's is
function page(d) {
  const grid = [];
  for (let x = 15; x < W; x += 52.6) grid.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}"/>`);
  for (let y = 22; y < H; y += 52.6) grid.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}"/>`);
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}svg{display:block}</style>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <filter id="rough" x="-4%" y="-4%" width="108%" height="108%">
    <feTurbulence type="fractalNoise" baseFrequency="0.026" numOctaves="2" seed="5" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="3.6" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
    <line x1="0" y1="0" x2="0" y2="7" stroke="#151515" stroke-width="2.4"/>
  </pattern>
</defs>
<rect width="${W}" height="${H}" fill="#fff"/>
<g stroke="rgb(197 203 211)" stroke-width="1.1">${grid.join('')}</g>
<g filter="url(#rough)">${d.parts.join('')}</g>
</svg>`;
}

const SHEETS = [oneRedButton, chefsPick, oneQuestion, cardIsTheButton];
const browser = await chromium.launch({ executablePath: chrome });
const tab = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
for (const [i, draw] of SHEETS.entries()) {
  const html = path.join(TMP, `sheet-${i + 1}.html`);
  fs.writeFileSync(html, page(draw()));
  await tab.goto(`file://${html}`);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(300);
  const png = path.join(TMP, `sheet-${i + 1}.png`);
  await tab.locator('svg').screenshot({ path: png });
  magick(png, '-resize', '720x', png);
  execFileSync('cwebp', ['-quiet', '-q', '80', png, '-o', path.join(OUT, `ink-${i + 1}.webp`)]);
  console.log(`lab/ink-${i + 1}.webp`);
}
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
