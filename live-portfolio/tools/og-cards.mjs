// og-cards.mjs — bake the link-preview cards in assets/og/, the 1200 × 630
// pictures LinkedIn, iMessage, Slack and X unfurl for each page (og:image).
//
//     python3 live-portfolio/tools/serve.py 8796 &
//     node live-portfolio/tools/og-cards.mjs http://127.0.0.1:8796
//
// Nothing on a card is drawn for it: each is the page's own opening, shot in
// the system Chrome at twice the size and halved.
//   home        Home itself, in a 1200 × 630 window: the name, and the
//               composer with its greeting typed out
//   vicino, pantrypal, nextlevel
//               the case study's opening tile, the Work tile grown to the
//               window, in a window of 1280 × 797, where the tile comes out
//               1192 × 626, the card's own shape to within a pixel
// Unfurlers cache a card by its address for about a week, so when the art
// changes for good, rename the files and the og:image tags together
// (archive/v2-og-src/README.md learned that the first time).
//
// Needs playwright-core where Node can find it (npm i playwright-core in any
// folder, and run from there), and ImageMagick for the halving.

import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:8796';
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'og');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await chromium.launch({ executablePath: chrome, args: ['--hide-scrollbars'] });
const halve = (file) => execFileSync('magick', [file, '-resize', '1200x630!', '-strip', file]);

// Home: the greeting types itself into the field's placeholder the first
// time Home is seen, holds for 1.7 seconds and backspaces away (js/prompt.js
// HOLD), so the shot is taken in the hold
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const t = document.querySelector('textarea[data-greeting]');
    return t && t.placeholder === t.dataset.greeting;
  }, null, { timeout: 10000, polling: 50 });
  await page.waitForTimeout(250);
  const file = path.join(out, 'home.png');
  await page.screenshot({ path: file });
  halve(file);
  await page.close();
}

for (const name of ['vicino', 'pantrypal', 'nextlevel']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 797 }, deviceScaleFactor: 2 });
  await page.goto(`${base}/${name}.html`, { waitUntil: 'networkidle' });
  // the Vicino board paints a beat after its frame loads (js/case.js)
  await page.waitForTimeout(name === 'vicino' ? 3500 : 1200);
  const tile = await page.$('.cs-hero-tile');
  const file = path.join(out, `${name}.png`);
  await tile.screenshot({ path: file });
  halve(file);
  await page.close();
}

await browser.close();
console.log('baked', out);
