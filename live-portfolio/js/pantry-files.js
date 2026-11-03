// pantry-files.js — PantryPal's Build chapter, with its files open.
//
// The chapter names the files the app was built from (the tokens, the
// Swift package's components, the harness that diffs a screen against
// Figma, the book, the proxy), and every one of them is a card here that
// opens. Pressed, a card opens the repository at that file, over the page:
// the file tree down the left, the file itself drawn in the middle, and its
// code on the right, the real file, copied as it stands from the app's
// repository (assets/case/pantrypal/repo/, mirroring its paths).
//
//   the drawing   rebuilt on the page from the file: a token file is drawn
//                 from its own values, read out of the JSON as it loads, so
//                 the swatches are what the file says; a component is drawn
//                 as its #Preview would, and can be pressed
//   the link      pointing at anything in the drawing lights the lines of
//                 the code it comes from, and scrolls the code to them; the
//                 lit lines stay lit until something else is pointed at, so
//                 the pointer can go over to read them
//   the walks     the proxy and the fallback are run, not drawn: a
//                 request walks the proxy's three tiers, and home opens
//                 with and without a network
//   the guide     3.1's style contract in three steps, its rules lighting
//                 the phrases of the prompt they write
//
// A reader without the script still has every card's words and the code in
// the repository; the viewer is only how it opens here.

import { reduced } from './motion.js';

const BASE = new URL('../assets/case/pantrypal/', import.meta.url).href;
const REPO = `${BASE}repo/`;
const ART = `${BASE}app/art/`;
const HOVER = matchMedia('(hover: hover)').matches;

// ---- a little DOM ----
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid);
  return el;
}
const art = (slug, attrs = {}) => h('img', { src: `${ART}${slug}.webp`, alt: '', decoding: 'async', draggable: 'false', ...attrs });
const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const span = (a, b = a) => (a === b ? `${a}` : `${a}-${b}`);

// ---- where a thing is in a file ----
// The line (counted from one) on which a run of keys, each inside the last,
// is named; and the lines a key's whole value spans, braces counted with
// strings stepped over. Only for keys that stand at the head of their own
// line, which in these files is every key a drawing points at.
function locate(lines) {
  const lineOf = (...keys) => {
    let at = 0;
    for (const key of keys) {
      const name = `"${key}"`;
      while (at < lines.length && !new RegExp(`${name.replace(/[$]/g, '\\$')}\\s*:`).test(lines[at])) at++;
      if (at >= lines.length) return 0;
      at++;
    }
    return at;
  };
  const blockOf = (...keys) => {
    const start = lineOf(...keys);
    if (!start) return '0';
    let depth = 0;
    let opened = false;
    for (let i = start - 1; i < lines.length; i++) {
      let quoted = false;
      for (let j = 0; j < lines[i].length; j++) {
        const c = lines[i][j];
        if (quoted) { if (c === '\\') j++; else if (c === '"') quoted = false; continue; }
        if (c === '"') quoted = true;
        else if (c === '{' || c === '[') { depth++; opened = true; }
        else if (c === '}' || c === ']') depth--;
      }
      if (!opened || depth <= 0) return span(start, i + 1);
    }
    return `${start}`;
  };
  return { lineOf, blockOf };
}

// ---- the highlighter ----
// One pattern a language, walked across the whole file so a comment or a
// string that runs over several lines is coloured whole; each piece is then
// cut at its newlines, so no colour crosses from one line into the next.
const WORDS = {
  swift: 'import public private fileprivate internal open struct class enum extension protocol func var let static init return if else guard switch case default for in while break continue where some any self Self true false nil try await async throws throw do catch defer weak final lazy mutating nonisolated get set inout as is',
  ts: 'import export from default async await function const let var return if else for of in while new try catch finally throw typeof instanceof null undefined true false as type interface extends class this void with',
  sh: 'if then else elif fi for in do done while case esac function return local set echo continue break exit',
};
const KEYWORDS = Object.fromEntries(Object.entries(WORDS).map(([k, v]) => [k, new Set(v.split(' '))]));
const PATTERN = {
  swift: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*")|(#\w+|@\w+)|(\b0x[0-9A-Fa-f]+\b|\b\d+(?:\.\d+)?\b)|\b([A-Za-z_]\w*)\b/g,
  ts: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(@\w+)|(\b\d+(?:\.\d+)?\b)|\b([A-Za-z_$][\w$]*)\b/g,
  sh: /(#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*')|(\$\{[^}]*\}|\$\w+|\$@)|(\b\d+(?:\.\d+)?\b)|\b([A-Za-z_][\w-]*)\b/g,
  json: /("(?:\\.|[^"\\])*")(\s*:)?|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|\b(true|false|null)\b/g,
};
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function paint(text, lang) {
  const pieces = [];
  const plain = (s) => pieces.push(['', s]);
  if (lang === 'grep') {
    // path:line:the line, as grep -n prints it: the place, then the JSON
    text.split('\n').forEach((line, i) => {
      if (i) plain('\n');
      const m = /^([^:]+:\d+:)(.*)$/.exec(line);
      if (!m) return plain(line);
      pieces.push(['m', m[1]]);
      pieces.push(...paint(m[2], 'json').pieces);
    });
    return { pieces };
  }
  const re = PATTERN[lang];
  if (!re) { plain(text); return { pieces }; }
  re.lastIndex = 0;
  let at = 0;
  for (let m; (m = re.exec(text));) {
    if (m.index > at) plain(text.slice(at, m.index));
    let cls = '';
    if (lang === 'json') {
      if (m[1]) cls = m[2] ? 'p' : 's';
      else if (m[3]) cls = 'n';
      else cls = 'k';
      if (m[1] && m[2]) { pieces.push(['p', m[1]], ['', m[2]]); at = re.lastIndex; continue; }
    } else if (m[1]) cls = 'c';
    else if (m[2]) cls = 's';
    else if (m[3]) cls = lang === 'sh' ? 'v' : 'a';
    else if (m[4]) cls = 'n';
    else {
      const word = m[5];
      const next = text[re.lastIndex];
      if (KEYWORDS[lang]?.has(word)) cls = 'k';
      else if (lang !== 'sh' && /^[A-Z]/.test(word)) cls = 't';
      else if (text[m.index - 1] === '.') cls = next === '(' ? 'f' : 'p';
      else if (next === '(') cls = 'f';
    }
    pieces.push([cls, m[0]]);
    at = re.lastIndex;
  }
  if (at < text.length) plain(text.slice(at));
  return { pieces };
}

function toLines(text, lang) {
  const out = [''];
  for (const [cls, s] of paint(text, lang).pieces) {
    s.split('\n').forEach((seg, i) => {
      if (i) out.push('');
      if (seg) out[out.length - 1] += cls ? `<span class="pf-${cls}">${escape(seg)}</span>` : escape(seg);
    });
  }
  return out;
}

// ---- the files ----
// In the order of the story, which is the order a presenter steps through
// them, and grouped by what they are for rather than where they live (the
// path stands in the bar). Each has a plain name over its file name, a
// headline, a sentence a reader who has never opened a repository can
// follow, and what to try ({verb} is "Point at" with a pointer and "Tap"
// on glass). (The tree was the repository's folders and the files' own
// names, and every view opened on "Drawn from the file's own values":
// true, and no help to anyone who had to say what they were looking at.)
const KIND = {
  json: { badge: '{ }', name: 'JSON' },
  swift: { badge: 'S', name: 'Swift' },
  ts: { badge: 'TS', name: 'TypeScript' },
  sh: { badge: '$', name: 'Shell' },
  grep: { badge: 'F', name: 'Figma' },
};
const GROUPS = {
  start: ['Where it started', 'the Figma prototype'],
  tokens: ['The design decisions', 'tokens'],
  parts: ['The building blocks', 'components'],
  think: ['How it thinks', 'the app and its server'],
};

const FILES = [
  {
    id: 'figma', group: 'start', label: 'The Figma frame', folder: 'Figma', name: 'Login', lang: 'grep',
    title: 'search results: “Login” in the token files', src: 'design-system/tokens-login.txt', crumbs: ['Figma', 'PantryPal', 'Login'],
    head: 'Where the look came from',
    cap: 'The prototype’s Login screen in Figma. Every design value in the code notes the part of Figma it was measured from, so searching the code for “Login” finds everything taken from this one screen.',
    try: '{verb} a pin to see the value it became.',
    draw: drawFigma,
  },
  { id: 'colors', group: 'tokens', label: 'Colours', folder: 'design-system/tokens', name: 'colors.json', lang: 'json', draw: drawColors,
    head: 'Every colour in the app',
    cap: 'Each colour notes where in Figma it was sampled. The dashed ones were never in Figma: they were invented for states the prototype didn’t draw, like pressed and disabled.',
    try: '{verb} a swatch to see its line in the code.' },
  { id: 'typography', group: 'tokens', label: 'Type', folder: 'design-system/tokens', name: 'typography.json', lang: 'json', draw: drawType,
    head: 'Two typefaces, each with one job',
    cap: 'Fugaz One for everything you tap or scan, Faustina only for recipe text. Every size is one the Figma file used, rounded where it was a fraction off.',
    try: '{verb} a size to see its line in the code.' },
  { id: 'spacing', group: 'tokens', label: 'Spacing and sizes', folder: 'design-system/tokens', name: 'spacing.json', lang: 'json', draw: drawSpacing,
    head: 'Spacing, and every fixed size',
    cap: 'A spacing scale in steps of four, found by measuring the gaps Figma actually used, and the height of every button and bar, each drawn here at its real size.',
    try: '{verb} a shape to see its line in the code.' },
  { id: 'radii', group: 'tokens', label: 'Corners', folder: 'design-system/tokens', name: 'radii.json', lang: 'json', draw: drawRadii,
    head: 'How round the corners are',
    cap: 'Figma had six slightly different corner sizes. They were tidied into three, and fully round.',
    try: '{verb} a corner to see its line in the code.' },
  { id: 'borders', group: 'tokens', label: 'Outlines', folder: 'design-system/tokens', name: 'borders.json', lang: 'json', draw: drawBorders,
    head: 'Outlines, instead of shadows',
    cap: 'The black outline is the app’s only sense of depth. A dashed outline means “not final yet” and a solid one means settled. And the scalloped edge under every header.',
    try: '{verb} an outline to see its line in the code.' },
  { id: 'shadows', group: 'tokens', label: 'Depth', folder: 'design-system/tokens', name: 'shadows.json', lang: 'json', draw: drawShadows,
    head: 'No shadows, one press',
    cap: 'Figma has no drop shadows anywhere. The one rule here was invented: a pressed button sinks two points and darkens, like a sticker pushed into the page.',
    try: 'Press and hold the button.' },
  { id: 'illustration-style', group: 'tokens', label: 'Drawing style', folder: 'design-system/tokens', name: 'illustration-style.json', lang: 'json', draw: drawContract,
    head: 'The drawing style, written for Gemini',
    cap: 'The rules every food drawing follows, taken from eighteen of the Figma file’s own pictures. The app turns them into the prompt Gemini receives.',
    try: 'Pick a food to see the prompt it gets.' },
  { id: 'primary', group: 'parts', label: 'The main button', folder: 'design-system/Sources/PantryPalDS/Components', name: 'PPPrimaryButton.swift', lang: 'swift', draw: drawPrimary,
    head: 'The main button, rebuilt in code',
    cap: 'The red button from Figma, rebuilt in SwiftUI out of the design decisions. Figma only drew it at rest, so its pressed and disabled looks were invented to match.',
    try: 'Press it, and {verb.lc} a measurement to see its line.' },
  { id: 'sticker', group: 'parts', label: 'The quieter buttons', folder: 'design-system/Sources/PantryPalDS/Components', name: 'PPStickerButton.swift', lang: 'swift', draw: drawSticker,
    head: 'The quieter buttons',
    cap: 'The same shape, outline and press as the red one. Only the colour of the label changes, and with it what the button means.',
    try: 'Press them.' },
  { id: 'pill', group: 'parts', label: 'The title pill', folder: 'design-system/Sources/PantryPalDS/Components', name: 'PageTitlePill.swift', lang: 'swift', draw: drawPill,
    head: 'The title pill',
    cap: 'Solid on finished screens, dashed on ones still in progress. A title too long for it shrinks to fit instead of being cut off with “…”.',
    try: 'Drag the slider to narrow the pill.' },
  { id: 'scallop', group: 'parts', label: 'The scalloped edge', folder: 'design-system/Sources/PantryPalDS/Components', name: 'ScallopedBorder.swift', lang: 'swift', draw: drawScallop,
    head: 'The scalloped edge',
    cap: 'The red edge under every header is two overlapping rows of ovals, the top row the colour of the sky. The overlap is what makes the little points between the bumps.',
    try: 'Switch between one row and two.' },
  { id: 'book', group: 'think', label: 'The recipe book', folder: 'App/Resources', name: 'ChefBook.json', lang: 'json', draw: drawBook,
    head: 'The recipe book on the phone',
    cap: 'Fifty dishes ship inside the app, so it can suggest dinner the moment it opens, with no internet. Every ingredient they use has a drawing.',
    try: 'Flip through the dishes.' },
  { id: 'illustrate', group: 'think', label: 'Drawing a food', folder: 'proxy/api', name: 'illustrate.ts', lang: 'ts', draw: drawIllustrate,
    head: 'How a food gets drawn, and paid for once',
    cap: 'The app asks a small server for a drawing. The server looks in two places first and only pays Gemini for a food nobody has asked for, so each food is drawn once, ever.',
    try: 'Ask for a food, then ask for it again.' },
  { id: 'recipes', group: 'think', label: 'Writing a recipe', folder: 'proxy/api', name: 'recipes.ts', lang: 'ts', draw: drawRecipes,
    head: 'How a recipe gets written',
    cap: 'The server turns what’s on your shelf into a prompt for Gemini, and gives it a strict form to answer in, so the app can always read the reply.',
    try: 'Change the shelf and watch the prompt change.' },
  { id: 'catered', group: 'think', label: 'When the network fails', folder: 'App/Sources/Services', name: 'CateredPick.swift', lang: 'swift', draw: drawCatered,
    head: 'When the network fails',
    cap: 'Home shows a dish from the book at once. A dish written for your shelf arrives a moment later, or, if the internet fails, nothing breaks: the book’s dish simply stays.',
    try: 'Play it with the internet, and without.' },
];
const BY_ID = Object.fromEntries(FILES.map((f) => [f.id, f]));
for (const f of FILES) {
  f.src ??= `${f.folder}/${f.name}`;
  f.crumbs ??= ['PantryPal', ...f.folder.split('/'), f.name];
}

// The texts, fetched once each, when first opened
const texts = new Map();
const load = (f) => {
  if (!texts.has(f.id)) texts.set(f.id, fetch(REPO + f.src).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }));
  return texts.get(f.id);
};

// ---- the viewer ----
// Three panes, each named for what it is: the files, what the file makes,
// and its code. Over the middle one, the file's headline, a sentence, and
// what to try; in the bar, where the file lives and the way through, one
// file after another, as a presenter steps through slides (and the arrow
// keys do the same).
const dialog = h('dialog', { class: 'pf', 'aria-labelledby': 'pf-head' });
const crumbs = h('p', { class: 'pf-crumbs' });
const meta = h('span', { class: 'pf-meta' });
const close = h('button', { type: 'button', class: 'pf-close', 'aria-label': 'Close the codebase' });
close.innerHTML = '<svg viewBox="-2 -2 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>';
const ARROW = (d) => `<svg viewBox="-2 -2 28 28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}" /></svg>`;
const prev = h('button', { type: 'button', class: 'pf-step', 'aria-label': 'The file before' });
prev.innerHTML = ARROW('m15 18-6-6 6-6');
const next = h('button', { type: 'button', class: 'pf-step', 'aria-label': 'The next file' });
next.innerHTML = ARROW('m9 18 6-6-6-6');
const count = h('span', { class: 'pf-count', 'aria-live': 'polite' });
const tree = h('nav', { class: 'pf-tree', 'aria-label': 'The files' });
const where = h('p', { class: 'pf-where' });
const headline = h('h2', { class: 'pf-head', id: 'pf-head' });
const cap = h('p', { class: 'pf-cap' });
const hint = h('p', { class: 'pf-try' });
const stage = h('div', { class: 'pf-stage' });
const onward = h('button', { type: 'button', class: 'pf-onward' });
const codeTab = h('span', { class: 'pf-tab' });
const codeLit = h('span', { class: 'pf-lit', 'aria-live': 'polite' });
const scroller = h('div', { class: 'pf-scroll', tabindex: '0', role: 'region' });
const list = h('ol', { class: 'pf-lines' });
scroller.append(list);
dialog.append(h('div', { class: 'pf-panel' },
  h('header', { class: 'pf-bar' },
    h('span', { class: 'pf-lights', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    crumbs, meta,
    h('span', { class: 'pf-steps' }, prev, count, next),
    close),
  h('div', { class: 'pf-side' }, h('p', { class: 'pf-pane', text: `${FILES.length} files` }), tree),
  h('section', { class: 'pf-view', 'aria-labelledby': 'pf-head' },
    h('div', { class: 'pf-intro' }, where, headline, cap, hint),
    stage, onward),
  h('section', { class: 'pf-code', 'aria-label': 'The code' },
    h('div', { class: 'pf-code-head' }, h('span', { class: 'pf-pane', text: 'The real code' }), codeTab, codeLit),
    scroller)));

// the tree: what the files are for, a heading each, the files under it
// by their plain names, each over its file name
const treeButtons = new Map();
{
  let group = null;
  let ul = null;
  for (const f of FILES) {
    if (f.group !== group) {
      group = f.group;
      ul = h('ul', { class: 'pf-tree-files', role: 'list' });
      const [name, what] = GROUPS[group];
      tree.append(h('div', { class: 'pf-tree-group' }, h('p', { class: 'pf-tree-folder' }, h('b', { text: name }), h('span', { text: what })), ul));
    }
    const b = h('button', { type: 'button', class: `pf-tree-file is-${f.lang}`, onclick: () => show(f.id) },
      h('i', { 'aria-hidden': 'true', text: KIND[f.lang].badge }),
      h('span', {}, h('b', { text: f.label }), h('code', { text: f.name })));
    treeButtons.set(f.id, b);
    ul.append(h('li', {}, b));
  }
}
const step = (d) => {
  if (!current) return;
  const i = FILES.indexOf(current) + d;
  if (i >= 0 && i < FILES.length) show(FILES[i].id);
};
prev.addEventListener('click', () => step(-1));
next.addEventListener('click', () => step(1));
onward.addEventListener('click', () => { step(1); next.focus({ preventScroll: true }); });
// the arrow keys step too, unless a slider or a field has them
dialog.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  if (e.target.closest?.('input, textarea, select, [role="radiogroup"]')) return;
  e.preventDefault();
  step(e.key === 'ArrowRight' ? 1 : -1);
});

let current = null;
let opener = null;
let lineEls = [];
let litNow = [];
let cleanups = [];
const later = (fn) => cleanups.push(fn);

// lines "3-5,9" → [3, 4, 5, 9]
const parse = (s) => String(s).split(',').flatMap((part) => {
  const [a, b = a] = part.split('-').map(Number);
  return a ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [];
});

function light(spec, { scroll = true } = {}) {
  for (const li of litNow) li.classList.remove('is-lit');
  const nums = parse(spec);
  litNow = nums.map((n) => lineEls[n - 1]).filter(Boolean);
  for (const li of litNow) li.classList.add('is-lit');
  for (const el of stage.querySelectorAll('.is-pointed')) el.classList.remove('is-pointed');
  if (!litNow.length) { codeLit.replaceChildren(); return; }
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  // the readout carries a swatch of the highlight itself, which says
  // "highlighted" in fewer letters than the word
  codeLit.replaceChildren(h('i', { 'aria-hidden': 'true' }), h('span', { class: 'sr-only', text: 'highlighted: ' }), lo === hi ? `line ${lo}` : `lines ${lo}–${hi}`);
  if (!scroll) return;
  const first = litNow[0];
  const last = litNow[litNow.length - 1];
  const top = first.offsetTop;
  const bottom = last.offsetTop + last.offsetHeight;
  const view = scroller.clientHeight;
  if (top >= scroller.scrollTop && bottom <= scroller.scrollTop + view) return;
  const room = view - (bottom - top);
  scroller.scrollTo({ top: Math.max(0, top - (room > 0 ? Math.min(room / 3, 96) : 24)), behavior: reduced() ? 'auto' : 'smooth' });
}

// pointing at a drawn thing lights its lines; pointing at a lit line marks
// the thing it came from
function point(e) {
  const at = e.target.closest?.('[data-lines]');
  if (!at || !stage.contains(at)) return;
  light(at.dataset.lines);
  at.classList.add('is-pointed');
}
// (no click: a tap sends pointerover first, and a click bubbling up after
// a control's own press would light the control's lines over the ones
// the press had just lit)
stage.addEventListener('pointerover', point);
stage.addEventListener('focusin', point);
list.addEventListener('pointerover', (e) => {
  const li = e.target.closest?.('li');
  if (!li || !li.classList.contains('is-lit')) return;
  const n = lineEls.indexOf(li) + 1;
  for (const el of stage.querySelectorAll('[data-lines]')) el.classList.toggle('is-pointed', parse(el.dataset.lines).includes(n));
});

async function show(id) {
  const f = BY_ID[id];
  if (!f) return;
  for (const fn of cleanups.splice(0)) fn();
  current = f;
  for (const [fid, b] of treeButtons) b.toggleAttribute('aria-current', fid === id);
  treeButtons.get(id).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  crumbs.replaceChildren(...f.crumbs.map((c, i) => (i === f.crumbs.length - 1 ? h('b', { text: c }) : h('span', { text: c }))));
  const at = FILES.indexOf(f);
  count.textContent = `${at + 1} of ${FILES.length}`;
  prev.disabled = at === 0;
  next.disabled = at === FILES.length - 1;
  const after = FILES[at + 1];
  onward.hidden = !after;
  if (after) onward.replaceChildren(h('span', { text: 'Next' }), h('b', { text: after.label }), h('i', { 'aria-hidden': 'true', text: '→' }));
  where.textContent = GROUPS[f.group][0];
  headline.textContent = f.head;
  // where the path is wider than the bar (a phone's), the file's own name
  // is the part to keep in view
  crumbs.scrollLeft = crumbs.scrollWidth;
  codeTab.replaceChildren(h('i', { 'aria-hidden': 'true', text: KIND[f.lang].badge }), h('span', { text: f.title ?? f.name }));
  codeTab.className = `pf-tab is-${f.lang}`;
  scroller.setAttribute('aria-label', `The code of ${f.title ?? f.name}`);
  cap.textContent = f.cap;
  const verb = HOVER ? 'Point at' : 'Tap';
  hint.replaceChildren(h('b', { text: 'Try it' }), f.try.replace('{verb}', verb).replace('{verb.lc}', verb.toLowerCase()));
  stage.replaceChildren(h('p', { class: 'pf-loading', text: 'Opening the file…' }));
  stage.parentElement.scrollTop = 0;
  list.replaceChildren();
  codeLit.textContent = '';
  litNow = [];
  scroller.scrollTop = 0;
  let text;
  try {
    text = await load(f);
  } catch {
    if (current !== f) return;
    stage.replaceChildren(h('p', { class: 'pf-loading', text: 'The file didn’t open. Try again in a moment.' }));
    texts.delete(f.id);
    return;
  }
  if (current !== f) return;
  const lines = text.replace(/\n$/, '').split('\n');
  meta.textContent = f.lang === 'grep' ? `${lines.length} results` : `${KIND[f.lang].name} · ${lines.length} lines`;
  // the code: each line its own item, its indent kept on the lines it
  // wraps onto, so a long JSON line reads as one
  const painted = toLines(text.replace(/\n$/, ''), f.lang);
  list.innerHTML = painted.map((html, i) => {
    const ind = /^\s*/.exec(lines[i] ?? '')[0].replace(/\t/g, '    ').length;
    return `<li style="--ind:${Math.min(ind, 24)}">${html || '\u200b'}</li>`;
  }).join('');
  lineEls = [...list.children];
  const ctx = { text, lines, json: f.lang === 'json' ? JSON.parse(text) : null, ...locate(lines), light, later };
  stage.replaceChildren(f.draw(ctx));
  if (f.at) light(f.at);
}

function open(id, from) {
  opener = from;
  if (!dialog.open) {
    document.body.append(dialog);
    dialog.showModal();
    document.documentElement.classList.add('pf-open');
  }
  show(id).then(() => next.focus({ preventScroll: true }));
}
function shut() { if (dialog.open) dialog.close(); }
close.addEventListener('click', shut);
dialog.addEventListener('click', (e) => { if (e.target === dialog) shut(); });
dialog.addEventListener('close', () => {
  for (const fn of cleanups.splice(0)) fn();
  current = null;
  document.documentElement.classList.remove('pf-open');
  opener?.focus({ preventScroll: true });
});

for (const card of document.querySelectorAll('[data-file]')) {
  card.addEventListener('click', () => open(card.dataset.file, card));
}

// ---- small parts the drawings share ----
const label = (text, attrs = {}) => h('p', { class: 'pf-label', text, ...attrs });
const seg = (choices, onPick, start = 0) => {
  const row = h('div', { class: 'pf-seg', role: 'radiogroup' });
  const buttons = choices.map(([text, lines], i) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(i === start), 'data-lines': lines,
    text,
    onclick: () => {
      buttons.forEach((b, j) => b.setAttribute('aria-checked', String(j === i)));
      onPick(i);
    },
  }));
  row.append(...buttons);
  return row;
};
const ink = (text, size, extra = {}) => h('span', { class: 'pf-fugaz', text, style: { '--s': size }, ...extra });

// ---- Figma: the Login frame, and where each token was read ----
// Pins at the places the grep's lines name, as fractions of the frame
// (assets/case/pantrypal/figma/figma-1.webp, the frame in its phone); a
// pin lights every grep line about its place.
function drawFigma() {
  const PINS = [
    { at: [0.36, 0.155], lines: '1,8', name: 'The wordmark', says: 'the brand red, and the logo’s size' },
    { at: [0.89, 0.333], lines: '2', name: 'The yellow band', says: 'the butter colour' },
    { at: [0.75, 0.52], lines: '3', name: 'The input boxes', says: 'the off-white colour' },
    { at: [0.43, 0.575], lines: '4', name: 'The grey hint text', says: 'the placeholder colour' },
    { at: [0.68, 0.641], lines: '1,6,7', name: 'The Log In button', says: 'its red, its 20pt label, its 44pt height' },
    { at: [0.25, 0.86], lines: '5', name: 'The kitchen picture', says: 'kept out of the drawing rules' },
  ];
  const frame = h('div', { class: 'pf-figma-frame' }, h('img', { src: `${BASE}figma/figma-1.webp`, width: 454, height: 907, alt: 'The Login frame of the Figma file: the wordmark and chef on the sky band, Let’s get cooking! on butter, and the log-in card over the kitchen' }));
  const legend = h('ol', { class: 'pf-figma-legend', role: 'list' });
  PINS.forEach((p, i) => {
    frame.append(h('button', { type: 'button', class: 'pf-pin', 'data-lines': p.lines, style: { left: `${p.at[0] * 100}%`, top: `${p.at[1] * 100}%` }, 'aria-label': `${p.name}: ${p.says}`, text: String(i + 1) }));
    legend.append(h('li', { 'data-lines': p.lines, tabindex: '0' }, h('i', { text: String(i + 1) }), h('b', { text: p.name }), h('span', { text: p.says })));
  });
  return h('div', { class: 'pf-figma' }, frame, h('div', {}, label('what each pin became'), legend));
}

// ---- colors.json ----
function drawColors({ json, lineOf }) {
  const wrap = h('div', { class: 'pf-colors' });
  for (const [group, entries] of Object.entries(json)) {
    if (group.startsWith('$')) continue;
    const ul = h('ul', { class: 'pf-swatches', role: 'list' });
    let note = null;
    for (const [name, tok] of Object.entries(entries)) {
      if (name.startsWith('$')) continue;
      if (typeof tok === 'string') { note = h('p', { class: 'pf-note', 'data-lines': String(lineOf(group, name)), text: tok }); continue; }
      const alpha = tok.alpha ?? 1;
      // the shipped app's coral was sampled off the rendered bands and left
      // the JSON behind; the file is shown as it is, and says so here
      const drift = group === 'surface' && name === 'coral' && tok.value.toUpperCase() !== '#FF7E7D';
      ul.append(h('li', { class: `pf-swatch${tok.inferred ? ' is-inferred' : ''}`, 'data-lines': String(lineOf(group, name)), tabindex: '0', style: { '--c': tok.value, '--a': alpha } },
        h('span', { class: 'pf-chip', 'aria-hidden': 'true' }),
        h('b', { text: name }),
        h('code', { text: alpha < 1 ? `${tok.value} · ${Math.round(alpha * 100)}%` : tok.value }),
        h('span', { class: 'pf-src', text: tok.inferred ? 'inferred' : (tok.sources?.[0] ?? '') }),
        drift && h('span', { class: 'pf-drift', text: 'the app uses #FF7E7D' })));
    }
    wrap.append(h('section', { class: 'pf-swatch-group' }, label(group), ul, note));
  }
  return wrap;
}

// ---- typography.json ----
const SAMPLE = {
  caption: '600 cal', chip: 'Cheddar', link: 'Sign Up', label: 'Email address', button: 'Log In',
  cardTitle: 'Beef Tacos', heading: 'Prepare the patties', title: 'Recipe', display: 'Let’s get cooking!',
  bodySm: 'A seared beef patty under melted cheddar.', fineprint: 'By joining you agree to the terms.',
  body: 'Divide the ground beef into four even portions.',
};
function drawType({ json, lineOf, blockOf }) {
  const face = (key, role) => {
    const fam = json.families[key];
    return h('li', { class: `pf-face is-${key}`, 'data-lines': blockOf('families', key), tabindex: '0' },
      h('span', { class: 'pf-face-aa', 'aria-hidden': 'true', text: 'Aa' }), h('b', { text: fam.value }), h('span', { text: role }));
  };
  const rows = h('ul', { class: 'pf-scale', role: 'list' });
  for (const [name, t] of Object.entries(json.scale)) {
    const lh = json.lineHeight[t.family]?.value ?? 1;
    rows.append(h('li', { 'data-lines': blockOf('scale', name), tabindex: '0' },
      h('span', { class: 'pf-scale-name' }, h('code', { text: name }), h('span', { text: `${t.size}${t.inferred ? ' · inferred' : ''}` })),
      h('span', { class: `pf-scale-sample is-${t.family}`, style: { '--s': t.size, '--lh': lh, '--tr': t.tracking ?? 0 }, text: SAMPLE[name] ?? name })));
  }
  const logo = json.logoLockup.large;
  return h('div', { class: 'pf-type' },
    h('ul', { class: 'pf-faces', role: 'list' }, face('display', 'every label, button and title'), face('body', 'recipe prose, and only that')),
    label('the scale, in points'), rows,
    label('the wordmark'),
    // the lockup as the app sets it (PPHeader, large): the hand-drawn white
    // blob, the two lines in Fugaz with their ink line, and the tomato after
    // Pal, at the Login header's own numbers, on the sky it stands on.
    // (Typeset alone in a ruled box, it read as a near miss of the logo.)
    h('div', { class: 'pf-logo-sky', 'data-lines': blockOf('logoLockup', 'large'), tabindex: '0' },
      h('div', { class: 'pf-logo', role: 'img', 'aria-label': 'The PantryPal wordmark: Pantry Pal in red, with a tomato, on its white blob', style: { '--s': logo.size } },
        h('img', { class: 'pf-logo-blob', src: `${BASE}app/logo-blob.webp`, alt: '', width: 522, height: 264 }),
        h('span', { class: 'pf-logo-word is-one', text: 'Pantry' }),
        h('span', { class: 'pf-logo-word is-two', text: 'Pal' }),
        h('img', { class: 'pf-logo-tomato', src: `${BASE}app/logo-icon.webp`, alt: '', width: 276, height: 276 }))));
}

// ---- spacing.json ----
function drawSpacing({ json, lineOf, blockOf }) {
  const scale = h('ul', { class: 'pf-steps4', role: 'list' });
  for (const [name, v] of Object.entries(json.scale)) {
    scale.append(h('li', { 'data-lines': String(lineOf('scale', name)), tabindex: '0', style: { '--v': v } }, h('i'), h('code', { text: name }), h('span', { text: v })));
  }
  const g = json.layout.gutter.value;
  const w = json.layout.screenWidth.value;
  const canvas = h('div', { class: 'pf-canvas', 'data-lines': blockOf('layout'), tabindex: '0', style: { '--g': `${(g / w) * 100}%` } },
    h('span', { class: 'pf-canvas-pill', text: 'Recipe' }),
    h('span', { class: 'pf-canvas-note' }, h('code', { text: `${g}` }), ' gutter · ', h('code', { text: `${w - 2 * g}` }), ' pill · ', h('code', { text: `${w}` }), ' screen'));
  const SHAPES = {
    controlHeight: ['is-btn', 'Log In'], chipHeight: ['is-chip', 'Cheddar'], searchBarHeight: ['is-search', 'Search the shelf'],
    titlePillHeight: ['is-pill', 'My shelf'], stepBandHeight: ['is-band', 'Sear the beef'], sectionBandHeight: ['is-section', 'Dairy'], badgeSize: ['is-badge', '3'],
  };
  const controls = h('ul', { class: 'pf-controls', role: 'list' });
  for (const [name, c] of Object.entries(json.controls)) {
    const [cls, word] = SHAPES[name] ?? ['is-btn', name];
    controls.append(h('li', { 'data-lines': String(lineOf('controls', name)), tabindex: '0' },
      h('span', { class: `pf-shape ${cls}`, style: { '--h': c.value } }, cls === 'is-band' ? [h('i', { text: '2.' }), word] : word),
      h('code', { text: name }), h('span', { text: `${c.value}pt` })));
  }
  return h('div', { class: 'pf-spacing' }, label('the scale'), scale, label('one screen, 393 wide'), canvas, label('every fixed height, at its size'), controls);
}

// ---- radii.json ----
function drawRadii({ json, lineOf }) {
  const SHAPE = { sm: ['an input', 120, 44], md: ['the form card', 132, 84], xl: ['a title pill', 210, 70], full: ['a badge', 44, 44] };
  const ul = h('ul', { class: 'pf-radii', role: 'list' });
  for (const [name, r] of Object.entries(json)) {
    if (name.startsWith('$')) continue;
    const [what, w, ht] = SHAPE[name] ?? ['', 80, 80];
    ul.append(h('li', { 'data-lines': String(lineOf(name)), tabindex: '0' },
      h('span', { class: 'pf-radius', style: { '--r': Math.min(r.value, 200), '--w': w, '--h': ht } }),
      h('b', {}, h('code', { text: name }), ` ${r.value === 9999 ? 'full' : r.value}`),
      h('span', { text: `${what}: ${r.sources.slice(0, 2).join(', ')}` })));
  }
  return ul;
}

// ---- the scallop, as ScallopedBorder draws it ----
// Ellipse rows on a 24pt pitch, back to front: the red one, then the sky
// one over it (Components/ScallopedBorder.swift rows), each bump filled
// then stroked, in points, the edge lifted 8.5 into the sky band as its
// #Preview lifts it (.offset(y: -8.5)).
function scallopSVG({ width = 393, rows = 2, scale = 1, bumpH = 16.06 } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const band = 34;
  const top = band - 8.5;
  const height = top + 8.5 + bumpH + 4;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'pf-scallop-svg');
  svg.style.setProperty('--k', scale);
  const add = (tag, a) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) el.setAttribute(k, v); svg.append(el); return el; };
  add('rect', { x: 0, y: 0, width, height: band, fill: '#B8EDF8' });
  const rowsDrawn = [[5 - 24, 8.5, '#FF4B4B', 'is-red'], [-7 - 24, 0, '#B8EDF8', 'is-sky']].slice(0, rows);
  for (const [phase, y, fill, cls] of rowsDrawn) {
    for (let x = phase; x < width; x += 24) {
      add('ellipse', { class: cls, cx: x + 12, cy: top + y + bumpH / 2, rx: 12, ry: bumpH / 2, fill, stroke: '#000', 'stroke-width': 1 });
    }
  }
  return svg;
}

// ---- borders.json ----
function drawBorders({ json, lineOf, blockOf }) {
  const widths = h('ul', { class: 'pf-widths', role: 'list' });
  for (const [name, w] of Object.entries(json.width)) {
    widths.append(h('li', { 'data-lines': String(lineOf('width', name)), tabindex: '0', style: { '--w': w.value } }, h('i'), h('code', { text: `${name} ${w.value}` }), h('span', { text: w.sources[0] })));
  }
  const styles = h('ul', { class: 'pf-edges', role: 'list' },
    h('li', { 'data-lines': String(lineOf('style', 'solid')), tabindex: '0' }, h('span', { class: 'pf-edge', text: 'settled' }), h('span', { text: json.style.solid.usage })),
    h('li', { 'data-lines': blockOf('style', 'dashed'), tabindex: '0' }, h('span', { class: 'pf-edge is-dashed', text: 'provisional' }), h('span', { text: `6 on, 4 off: ${json.style.dashed.usage.split(';')[0]}` })));
  return h('div', { class: 'pf-borders' },
    label('three weights of ink'), widths,
    label('what a dashed edge means'), styles,
    label('the scallop, under every header'),
    h('div', { class: 'pf-scallop', 'data-lines': blockOf('scallop'), tabindex: '0' }, scallopSVG({ width: 240 })));
}

// ---- shadows.json ----
function drawShadows({ lineOf, blockOf }) {
  const press = h('button', { type: 'button', class: 'pf-sticker is-press', 'data-lines': blockOf('pressedOffset'), text: 'Press and hold' });
  return h('div', { class: 'pf-shadows' },
    h('div', { class: 'pf-shadow-pair', 'data-lines': blockOf('none'), tabindex: '0' },
      h('figure', { class: 'is-no' }, h('span', { class: 'pf-sticker is-blur', text: 'a shadow' }), h('figcaption', { text: 'never, in the whole file' })),
      h('figure', {}, h('span', { class: 'pf-sticker', text: 'an ink edge' }), h('figcaption', { text: 'the depth it uses instead' }))),
    label('the one entry, inferred'),
    h('div', { class: 'pf-press' }, press, h('p', { 'data-lines': String(lineOf('pressedOffset', 'rationale')), tabindex: '0', text: 'Down two points and a tenth darker, in 80 ms, as every button in the app presses.' })));
}

// ---- illustration-style.json: the prompt, for any food ----
const FOODS = [['tomato'], ['lamb'], ['broccoli'], ['shrimp'], ['avocado'], ['cheddar cheeseburger', 'dish']];
function drawContract({ json, lineOf, light }) {
  const tpl = json.style_prompt_template;
  const [before, after] = tpl.split('{ingredient}');
  const slot = h('mark', { class: 'pf-slot' });
  const pic = h('img', { class: 'pf-contract-art', alt: '', width: 192, height: 192 });
  const note = h('p', { class: 'pf-contract-note' });
  const choose = (i) => {
    const [food, variant] = FOODS[i];
    slot.textContent = food;
    pic.src = `${ART}${slugOf(food)}.webp`;
    pic.alt = `PantryPal’s drawing of ${food}`;
    note.replaceChildren();
    if (food === 'lamb') {
      note.append(h('b', { text: 'The run’s one send-back. ' }), 'The first lamb came back as a live sheep, against the contract’s own words: food stays food.');
      note.dataset.lines = String(lineOf('attributes', 'cuteness'));
    } else if (variant === 'dish') {
      note.append(h('b', { text: 'A dish. ' }), 'Same language, more interior detail allowed: the variant the recipe heroes use.');
      note.dataset.lines = String(lineOf('variants', 'dish'));
    } else {
      note.append(h('b', { text: 'Drawn once. ' }), 'Kept for good, and bundled into the app, so it works offline.');
      note.dataset.lines = String(lineOf('output', 'background'));
    }
    light(note.dataset.lines);
  };
  const ATTR = [['outline', 'thick near-black outline'], ['highlights', 'small white highlights, upper left'], ['composition', 'one object, a slight ¾ turn'], ['background_treatment', 'nothing behind it: the app draws the plate']];
  const foods = seg(FOODS.map(([f]) => [f, String(lineOf('style_prompt_template'))]), choose);
  const view = h('div', { class: 'pf-contract' },
    foods,
    h('div', { class: 'pf-contract-row' },
      h('figure', { class: 'pf-contract-pic' }, pic,
        h('ul', { class: 'pf-contract-attrs', role: 'list' }, ATTR.map(([k, t]) => h('li', { 'data-lines': String(lineOf('attributes', k)), tabindex: '0', text: t })))),
      h('div', {},
        label('the prompt it gets'),
        h('p', { class: 'pf-prompt', 'data-lines': String(lineOf('style_prompt_template')), tabindex: '0' }, before, slot, after),
        label('and what it may never draw'),
        h('p', { class: 'pf-prompt is-not', 'data-lines': String(lineOf('negative_prompt')), tabindex: '0', text: json.negative_prompt }),
        note)));
  queueMicrotask(() => choose(0));
  return view;
}

// ---- the three buttons ----
const pressLines = (btn, lines) => {
  btn.addEventListener('pointerdown', () => btn.closest('.pf-stage') && light(lines));
};
function drawPrimary() {
  const on = h('button', { type: 'button', class: 'pf-btn is-primary', 'data-lines': '21-41', text: 'Log In' });
  // disabled by aria, not the attribute: a disabled button takes no
  // pointer at all, and this one still has to light its two lines
  const off = h('button', { type: 'button', class: 'pf-btn is-primary is-off', 'data-lines': '24,29', 'aria-disabled': 'true', text: 'Log In' });
  pressLines(on, '35-40');
  const dims = h('div', { class: 'pf-dims', 'aria-hidden': 'true' },
    h('span', { class: 'pf-dim is-h', 'data-lines': '26', text: '44' }),
    h('span', { class: 'pf-dim is-r', 'data-lines': '28', text: 'r 10' }),
    h('span', { class: 'pf-dim is-ink', 'data-lines': '33', text: '2pt ink' }),
    h('span', { class: 'pf-dim is-font', 'data-lines': '23', text: 'Fugaz One 20' }));
  return h('div', { class: 'pf-device is-butter', 'data-lines': '48-56' },
    h('div', { class: 'pf-measured' }, on, dims),
    off,
    h('p', { class: 'pf-device-note' }, h('b', { text: 'Press the red one. ' }), 'It sinks two points and darkens; the grey one is disabled.'));
}
function drawSticker() {
  const a = h('button', { type: 'button', class: 'pf-btn is-primary', 'data-lines': '78', text: 'Start cooking' });
  const b = h('button', { type: 'button', class: 'pf-btn is-secondary', 'data-lines': '18-27,79', text: 'Next dish' });
  const c = h('button', { type: 'button', class: 'pf-btn is-destructive', 'data-lines': '32-43,80', text: 'Sign out' });
  pressLines(b, '57-70');
  pressLines(c, '57-70');
  return h('div', { class: 'pf-device is-butter', 'data-lines': '75-84' }, a, b, c,
    h('p', { class: 'pf-device-note', 'data-lines': '55-71', tabindex: '0' }, h('b', { text: 'One shell, three labels. ' }), 'The white two have the same sticker, edge and press as the red; only the label’s colour says what it does.'));
}

// ---- PageTitlePill.swift ----
function drawPill() {
  const word = h('span', { class: 'pf-pill-word', text: 'Today’s breakfast' });
  const pill = h('span', { class: 'pf-pill', 'data-lines': '30-70' }, word);
  const read = h('output', { class: 'pf-pill-read' });
  const range = h('input', { type: 'range', min: '150', max: '347', value: '347', 'aria-label': 'How wide the pill is, in points', 'data-lines': '45-46' });
  // SwiftUI's lineLimit(1) with a minimumScaleFactor: smaller type first,
  // down to the floor, and only past the floor an ellipsis
  const fit = () => {
    const w = Number(range.value);
    pill.style.setProperty('--w', w);
    word.style.setProperty('--k', 1);
    const natural = word.scrollWidth;
    const room = w - 28;
    const k = Math.min(1, room / natural);
    const floor = 0.6;
    word.style.setProperty('--k', Math.max(k, floor));
    const cut = k < floor;
    pill.classList.toggle('is-cut', cut);
    read.textContent = cut ? `${w}pt: past the 0.6 floor, it would truncate` : `${w}pt wide · type at ${Math.round(Math.max(k, floor) * 100)}%`;
  };
  range.addEventListener('input', () => { fit(); light('45-46', { scroll: true }); });
  requestAnimationFrame(fit);
  return h('div', { class: 'pf-device is-butter pf-pills', 'data-lines': '73-81' },
    h('span', { class: 'pf-pill', 'data-lines': '14,51-53,75' }, h('span', { class: 'pf-pill-word', text: 'Scan Receipt' })),
    h('span', { class: 'pf-pill is-dashed', 'data-lines': '16,55-63,76' }, h('span', { class: 'pf-pill-word', text: 'Choose ingredients!' })),
    label('a title never loses a letter'),
    pill, range, read);
}

// ---- ScallopedBorder.swift ----
function drawScallop() {
  const big = h('div', { class: 'pf-scallop-zoom', 'data-lines': '1-23' });
  const draw = (rows) => big.replaceChildren(scallopSVG({ width: 132, rows }));
  draw(2);
  return h('div', { class: 'pf-scallop-view' },
    seg([['the red row', '84-86,102'], ['and the sky row over it', '84-87,92-108']], (i) => draw(i + 1), 1),
    big,
    h('p', { class: 'pf-device-note', 'data-lines': '9-13', tabindex: '0' }, h('b', { text: 'The tip. ' }), 'Each sky bump only touches its neighbour, so a sliver of red shows through at every meeting point. One row alone floats whole ellipses; two in one fill make a wave.'),
    label('at its size, under the header'),
    h('div', { class: 'pf-scallop', 'data-lines': '117-124', tabindex: '0' }, scallopSVG({ width: 393 })));
}

// ---- ChefBook.json: the book, a dish at a time ----
function drawBook({ json, lines, light }) {
  // where each dish starts and ends in the file: the book's dishes are the
  // objects four spaces in
  const starts = [];
  lines.forEach((l, i) => { if (/^ {4}\{\s*$/.test(l)) starts.push(i + 1); });
  const ends = [];
  lines.forEach((l, i) => { if (/^ {4}\},?\s*$/.test(l)) ends.push(i + 1); });
  const find = (from, to, key) => { for (let i = from; i <= to; i++) if (new RegExp(`^ {6}"${key}"`).test(lines[i - 1])) return i; return from; };
  const blockFrom = (from, to, key) => {
    const s = find(from, to, key);
    for (let i = s; i <= to; i++) if (/^ {6}\]/.test(lines[i - 1])) return span(s, i);
    return String(s);
  };
  const card = h('article', { class: 'pf-dish' });
  const count = h('output', { class: 'pf-dish-count' });
  let at = 0;
  const render = () => {
    const r = json.recipes[at];
    const from = starts[at];
    const to = ends[at];
    count.textContent = `${at + 1} of ${json.recipes.length}`;
    card.dataset.lines = span(from, to);
    card.replaceChildren(
      h('p', { class: 'pf-dish-title', 'data-lines': String(find(from, to, 'title')) }, ink(r.title, 22)),
      h('figure', { class: 'pf-dish-art', 'data-lines': String(find(from, to, 'title')) }, art(slugOf(r.title), { width: 120, height: 120 })),
      h('ul', { class: 'pf-dish-chips', role: 'list' },
        h('li', { 'data-lines': String(find(from, to, 'calories')), text: `${r.calories} cal` }),
        h('li', { 'data-lines': String(find(from, to, 'proteinGrams')), text: `${r.proteinGrams}g protein` }),
        r.minutes && h('li', { 'data-lines': String(find(from, to, 'minutes')), text: `${r.minutes} min` }),
        h('li', { class: 'is-meal', 'data-lines': blockFrom(from, to, 'meals'), text: r.meals.join(' · ') })),
      h('p', { class: 'pf-dish-summary', 'data-lines': String(find(from, to, 'summary')), text: r.summary }),
      h('ul', { class: 'pf-dish-strip', role: 'list', 'data-lines': blockFrom(from, to, 'ingredientNames') },
        r.ingredientNames.map((n) => h('li', {}, art(slugOf(n), { width: 40, height: 40 }), h('span', { text: n })))),
      h('ol', { class: 'pf-dish-steps', 'data-lines': blockFrom(from, to, 'steps') },
        r.steps.map((s, i) => h('li', {}, h('b', { text: `${i + 1}.` }), h('span', {}, h('b', { text: s.title }), ' ', s.body)))));
    light(card.dataset.lines);
  };
  const step = (d) => { at = (at + d + json.recipes.length) % json.recipes.length; render(); };
  queueMicrotask(render);
  return h('div', { class: 'pf-book' },
    h('div', { class: 'pf-book-nav' },
      h('button', { type: 'button', class: 'pf-round', 'aria-label': 'The dish before', onclick: () => step(-1) }, '‹'),
      count,
      h('button', { type: 'button', class: 'pf-round', 'aria-label': 'The next dish', onclick: () => step(1) }, '›')),
    card);
}

// ---- illustrate.ts: a request, down the three tiers ----
function drawIllustrate({ light }) {
  const spent = { n: 0 };
  // what each tier has seen: the store holds everything ever drawn (the
  // tomato among it), the CDN only what this walk has asked for
  const store = new Set(['tomato']);
  const cdn = new Set();
  // the tier that first answered, which a cached copy still says
  const source = new Map([['tomato', 'store']]);
  const TIERS = [
    ['cdn', 'A nearby copy', 'the internet’s cache (a CDN): a food asked for before is answered here, and the server never runs', '85,186'],
    ['store', 'The drawing store', 'every drawing the server has ever made, kept for good', '79-89'],
    ['model', 'Gemini', 'only for a food nobody has asked for: about 7¢ a drawing', '114-176'],
  ];
  const ladder = h('ol', { class: 'pf-tiers', role: 'list' }, TIERS.map(([k, name, says, lines]) => h('li', { 'data-tier': k, 'data-lines': lines, tabindex: '0' }, h('b', { text: name }), h('span', { text: says }))));
  const out = h('div', { class: 'pf-response', 'aria-live': 'polite' });
  const bill = h('output', { class: 'pf-bill' });
  const timers = [];
  later(() => timers.forEach(clearTimeout));
  const ask = (food) => {
    timers.forEach(clearTimeout);
    timers.length = 0;
    const tier = cdn.has(food) ? 'cdn' : store.has(food) ? 'store' : 'model';
    const path = TIERS.map(([k]) => k).slice(0, TIERS.findIndex(([k]) => k === tier) + 1);
    ladder.querySelectorAll('li').forEach((li) => li.classList.remove('is-pass', 'is-hit'));
    out.replaceChildren(h('code', { class: 'pf-req', text: `GET /api/illustrate?ingredient=${food}` }));
    light('28-42');
    const wait = reduced() ? 0 : 420;
    path.forEach((k, i) => timers.push(setTimeout(() => {
      const li = ladder.querySelector(`[data-tier="${k}"]`);
      li.classList.add(k === tier ? 'is-hit' : 'is-pass');
      if (k === tier) {
        light(k === 'model' ? '114-129,150-187' : li.dataset.lines);
        if (k === 'model') { spent.n += 1; store.add(food); }
        if (k !== 'cdn') source.set(food, k);
        cdn.add(food);
        bill.textContent = `Spent on drawing so far: $${(spent.n * 0.067).toFixed(3)}`;
        const by = { cdn: 'the nearby copy', store: 'the drawing store', model: 'Gemini, drawing it new' }[k];
        out.append(h('div', { class: 'pf-res' },
          art(slugOf(food), { width: 96, height: 96 }),
          h('div', {}, h('p', { class: 'pf-res-by' }, 'Answered by ', h('b', { text: by })),
          h('ul', { class: 'pf-headers', role: 'list' },
            h('li', {}, h('b', { text: '200' }), ' image/png'),
            h('li', {}, 'X-PP-Source: ', h('b', { text: source.get(food) })),
            h('li', {}, k === 'cdn' ? 'answered by the CDN’s copy' : 'Cache-Control: public, s-maxage=31536000, immutable'),
            k === 'model' && h('li', { class: 'is-kept' }, 'kept: await storeRender(…)')))));
      }
    }, wait * (i + 1))));
  };
  return h('div', { class: 'pf-illustrate' },
    label('ask the server for a drawing'),
    h('div', { class: 'pf-asks' },
      h('button', { type: 'button', class: 'pf-ask', onclick: () => ask('tomato') }, art('tomato', { width: 32, height: 32 }), 'A tomato (drawn before)'),
      h('button', { type: 'button', class: 'pf-ask', onclick: () => ask('avocado') }, art('avocado', { width: 32, height: 32 }), 'An avocado (never drawn)')),
    label('where it looks, cheapest first'),
    ladder, out, bill,
    h('p', { class: 'pf-device-note' }, 'Ask for the same food twice: the second time, the nearby copy answers and nothing is paid.'));
}

// ---- recipes.ts: the shelf into the prompt ----
const SHELF = ['Ground Beef', 'Cheddar Cheese', 'Lettuce', 'Tomato', 'Burger Buns', 'Eggs', 'Tortilla', 'Rice'];
function drawRecipes({ light }) {
  const on = new Set(SHELF.slice(0, 5));
  const filled = h('mark', { class: 'pf-slot' });
  // the prompt word for word as recipes.ts joins it, with the shelf and
  // the app's count of two in their places
  const prompt = h('p', { class: 'pf-prompt', 'data-lines': '92-112', tabindex: '0' },
    'Available ingredients: ', filled,
    '. Assume basic staples (oil, salt, pepper, water) are on hand. Propose exactly 2 distinct dishes a beginner cook would actually want to make tonight, using ONLY the available ingredients plus staples. Every dish must break into 3-5 simple steps. Every entry in ingredientNames MUST be copied character-for-character from the available ingredients list above — never invent, rename, pluralize, or singularize an ingredient. Set minutes to an honest total cook time. ',
    h('span', { class: 'pf-rule', 'data-lines': '107-112' }, 'TITLE RULES: name the dish plainly in 1-3 words, the way a menu would — "Pesto Salad", "Beef Tacos", "Fried Rice". No adjectives and no adverbs of any kind (not "Creamy", "Crispy", "Loaded", "Cheesy", "Easy", "Quick", "Classic", "Hearty", "Ultimate"). Two different shelves that produce the same dish must produce the same title.'));
  const chips = h('ul', { class: 'pf-shelf', role: 'list', 'data-lines': '75' });
  const sync = () => { filled.textContent = SHELF.filter((s) => on.has(s)).join(', ') || '…'; };
  for (const s of SHELF) {
    const b = h('button', { type: 'button', class: 'pf-food', 'aria-pressed': String(on.has(s)), 'data-lines': '92' }, art(slugOf(s), { width: 30, height: 30 }), s);
    b.addEventListener('click', () => {
      if (on.has(s)) on.delete(s); else on.add(s);
      b.setAttribute('aria-pressed', String(on.has(s)));
      sync();
      light('92');
    });
    chips.append(h('li', {}, b));
  }
  sync();
  const FIELDS = [['title', 'Short dish name, 1-3 words', '16'], ['summary', 'One warm, appetizing sentence', '17-20'], ['calories', 'integer', '21'], ['proteinGrams', 'integer', '22'], ['ingredientNames', 'strings, copied from the shelf', '23'], ['minutes', 'integer', '24'], ['steps', '3-5 of { title, body }', '25-38']];
  return h('div', { class: 'pf-recipes' },
    label('the shelf'), chips,
    label('the prompt, as the proxy writes it'), prompt,
    h('div', { class: 'pf-recipes-row' },
      h('div', {}, label('the shape the answer must take'),
        h('ul', { class: 'pf-schema', role: 'list', 'data-lines': '8-49' }, FIELDS.map(([k, t, l]) => h('li', { 'data-lines': l, tabindex: '0' }, h('code', { text: k }), h('span', { text: t }))))),
      h('div', { class: 'pf-titles', 'data-lines': '99-112', tabindex: '0' }, label('why the title rule'),
        h('ul', { role: 'list' }, ['Classic', 'Juicy', 'Loaded'].map((a) => h('li', { class: 'is-out', text: `${a} Cheeseburger` })), h('li', { text: 'Cheeseburger' })),
        h('p', { text: 'A title is the drawing’s address. Three adjectives were three more $0.067 drawings of one burger.' }))));
}

// ---- CateredPick.swift: home, opening, with and without a network ----
function drawCatered({ light }) {
  const seat = h('div', { class: 'pf-seat' });
  const book = h('div', { class: 'pf-seat is-book' }, art('cheddar-cheeseburger', { width: 56, height: 56 }), h('span', {}, h('b', { text: 'Cheddar Cheeseburger' }), h('i', { text: 'from the book, ranked on the phone' })));
  const deck = h('div', { class: 'pf-deck' }, seat, book);
  const log = h('ol', { class: 'pf-timeline', role: 'list' });
  const timers = [];
  later(() => timers.forEach(clearTimeout));
  let online = true;
  const run = () => {
    timers.forEach(clearTimeout);
    timers.length = 0;
    log.replaceChildren();
    deck.classList.remove('is-open', 'is-seated', 'is-filled', 'is-gone');
    seat.replaceChildren();
    const STEPS = [
      [0, 'the book’s best dish shows at once: no waiting, no internet needed', '21-30', () => deck.classList.add('is-open')],
      [500, 'a spot is saved at the front for a dish written for your shelf', '225-226', () => { deck.classList.add('is-seated'); seat.replaceChildren(h('span', { class: 'pf-cooking', text: 'cooking a dish for your shelf…' })); }],
      [1300, 'it waits 0.7 seconds, in case you’re still changing the shelf', '157,239'],
      [2100, 'then asks the server for two dishes', '152,240-241'],
      online
        ? [3300, 'they arrive and take the saved spot', '246-253,289-295', () => { deck.classList.add('is-filled'); seat.replaceChildren(art('beef-tacos', { width: 56, height: 56 }), h('span', {}, h('b', { text: 'Beef Tacos' }), h('i', { text: 'written for this shelf' }))); }]
        : [3300, 'the request fails: no error, no spinner', '254-264', () => { deck.classList.add('is-gone'); }],
      online ? null : [4300, 'the book’s dish stays on top, and the app won’t ask again for this shelf', '263'],
    ].filter(Boolean);
    const scale = reduced() ? 0 : 1;
    for (const [t, text, lines, act] of STEPS) {
      timers.push(setTimeout(() => {
        log.append(h('li', { 'data-lines': lines, tabindex: '0' }, h('code', { text: `${(t / 1000).toFixed(1)}s` }), text));
        light(lines);
        act?.();
      }, t * scale));
    }
  };
  const modes = seg([['with internet', '246-253'], ['no internet', '254-264']], (i) => { online = i === 0; run(); });
  queueMicrotask(run);
  return h('div', { class: 'pf-catered' },
    modes,
    h('div', { class: 'pf-catered-row' },
      h('div', { class: 'pf-device is-butter' }, label('home'), deck),
      h('div', {}, label('what happens, second by second'), log,
        h('button', { type: 'button', class: 'pf-replay', onclick: run }, 'Play it again'))));
}

// ---- 3.1: the contract, in three steps ----
// The rules as the file writes them, the prompt they write for one food,
// and what Gemini drew from it (pantrypal.html, [data-guide]). Each rule
// and the phrases it wrote share a colour; pointing at either lights the
// other and quiets the rest, so a reader can see which words of the guide
// made which part of the sticker. A food pressed in the row under them
// goes into the prompt's slot and comes out as its drawing. Nothing moves
// on its own.
for (const guide of document.querySelectorAll('[data-guide]')) {
  const word = guide.querySelector('[data-guide-food]');
  const pic = guide.querySelector('[data-guide-art]');
  const name = guide.querySelector('[data-guide-name]');
  const foods = [...guide.querySelectorAll('[data-food]')];
  const marked = [...guide.querySelectorAll('[data-rule]')];
  const show = (rule) => {
    guide.toggleAttribute('data-on', Boolean(rule));
    for (const el of marked) el.classList.toggle('is-on', el.dataset.rule === rule);
  };
  guide.addEventListener('pointerover', (e) => show(e.target.closest?.('[data-rule]')?.dataset.rule ?? null));
  // (a finger leaves as soon as it lifts: a tapped rule stays lit until
  // the next tap, on another rule or on nothing)
  guide.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') show(null); });
  guide.addEventListener('focusin', (e) => show(e.target.closest?.('[data-rule]')?.dataset.rule ?? null));
  guide.addEventListener('focusout', (e) => { if (!guide.contains(e.relatedTarget)) show(null); });
  const pop = (el) => { el.classList.remove('is-new'); void el.offsetWidth; el.classList.add('is-new'); };
  for (const b of foods) {
    new Image().src = `${ART}${slugOf(b.dataset.food)}.webp`;
    b.addEventListener('click', () => {
      const food = b.dataset.food;
      foods.forEach((f) => f.setAttribute('aria-checked', String(f === b)));
      word.textContent = food;
      name.textContent = food;
      pic.src = `${ART}${slugOf(food)}.webp`;
      pic.alt = `The ${food} Gemini drew to the rules`;
      pop(word);
      pop(pic.parentElement);
    });
  }
}
