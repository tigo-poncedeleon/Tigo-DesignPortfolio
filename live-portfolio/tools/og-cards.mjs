// og-cards.mjs — bake the link-preview cards in assets/og/, the 1200 × 630
// pictures LinkedIn, iMessage, Slack and X unfurl for each page (og:image).
//
//     python3 live-portfolio/tools/serve.py 8796 &
//     node live-portfolio/tools/og-cards.mjs http://127.0.0.1:8796
//     node live-portfolio/tools/og-cards.mjs http://127.0.0.1:8796 vicino pantrypal
//
// Named after the address, only those cards are baked; with none, all four.
//
// Nothing on a card is drawn for it: each is the page's own opening, shot in
// the system Chrome at twice the size and halved.
//   home        Home itself, in a 1200 × 630 window: the name, and the
//               composer with its greeting typed out
//   vicino, pantrypal, nextlevel
//               the case study's opening tile, the Work tile grown to the
//               whole window, in a window of 1280 × 672, the card's own
//               shape, so the tile comes out the card exactly; for the shot
//               the masthead's buttons are taken off it and its rounded
//               foot squared, since a card is a picture of the page and not
//               a page
// Each card is written to the file its own page's og:image names, read off
// the page as it is served. Unfurlers cache a card by its address for about
// a week, so when the art changes for good, give the card a new name in its
// page's og:image and bake it again; the old file can then go
// (archive/v2-og-src/README.md learned that the first time). The cards were
// written to fixed names until October 2026, which made a rename two edits
// that had to agree.
//
// Needs playwright-core where Node can find it from the folder it is run in
// (npm i playwright-core in any folder, and run from there: it is looked up
// from there, since a module's own imports are looked up from the module's
// folder, where it is not), and ImageMagick for the halving.

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { chromium } = createRequire(path.join(process.cwd(), 'og-cards.cjs'))('playwright-core');
const base = process.argv[2] || 'http://127.0.0.1:8796';
const only = new Set(process.argv.slice(3));
const wanted = (name) => !only.size || only.has(name);
const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const baked = [];

// where the page's og:image says its card is, as a file in the site
const cardFor = async (page) => {
  const url = await page.getAttribute('meta[property="og:image"]', 'content');
  return path.join(site, new URL(url).pathname);
};

const browser = await chromium.launch({ executablePath: chrome, args: ['--hide-scrollbars'] });
const halve = (file) => execFileSync('magick', [file, '-resize', '1200x630!', '-strip', file]);

// Home: the greeting types itself into the field's placeholder the first
// time Home is seen, holds for 1.7 seconds and backspaces away (js/prompt.js
// HOLD), so the shot is taken in the hold
if (wanted('home')) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const t = document.querySelector('textarea[data-greeting]');
    return t && t.placeholder === t.dataset.greeting;
  }, null, { timeout: 10000, polling: 50 });
  await page.waitForTimeout(250);
  const file = await cardFor(page);
  await page.screenshot({ path: file });
  halve(file);
  baked.push(file);
  await page.close();
}

for (const name of ['vicino', 'pantrypal', 'nextlevel'].filter(wanted)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 672 }, deviceScaleFactor: 2 });
  await page.goto(`${base}/${name}.html`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.masthead { visibility: hidden !important; } .cs-hero-tile { border-radius: 0 !important; }' });
  // the Vicino board paints a beat after its frame loads (js/case.js)
  await page.waitForTimeout(name === 'vicino' ? 3500 : 1200);
  const tile = await page.$('.cs-hero-tile');
  const file = await cardFor(page);
  await tile.screenshot({ path: file });
  halve(file);
  baked.push(file);
  await page.close();
}

await browser.close();
console.log('baked', baked.map((f) => path.relative(site, f)).join(', '));
