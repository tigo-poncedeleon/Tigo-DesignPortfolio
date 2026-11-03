// pantry-receipt.mjs — photograph the receipt the case study's PantryPal
// scans (assets/case/pantrypal/app/scan-receipt.webp).
//
//     node live-portfolio/tools/pantry-receipt.mjs
//
// A browser has no camera to give the prototype, so its "A RECEIPT" door
// takes this picture instead, and the scan is real: the picture goes to the
// app's own scanner (api/pantry.js, then the app's proxy and Gemini), which
// reads it as it reads a photo from a phone. The shop is a burger night and a
// taco one, as the book can cook them, and one line on it is not food, so the
// scan shows the app leaving it off. The paper lies on a counter, tipped, lit
// from one side and filling the frame, the way a usable photo of a receipt
// does (ScanStubPhoto, the app's own stand-in, says why).
//
// Needs playwright-core where Node can find it from the folder it is run in
// (as og-cards.mjs does), the system Chrome, cwebp and ImageMagick.

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { chromium } = createRequire(path.join(process.cwd(), 'pantry-receipt.cjs'))('playwright-core');
const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(site, 'assets/case/pantrypal/app/scan-receipt.webp');

const LINES = [
  ['GROUND BEEF 80/20 1LB', '6.49'],
  ['SHARP CHEDDAR 8OZ', '3.99'],
  ['BURGER BUNS 4CT', '3.79'],
  ['ICEBERG LETTUCE', '1.89'],
  ['ROMA TOMATOES', ''],
  ['  3 @ 0.69', '2.07'],
  ['YELLOW ONION', '0.98'],
  ['HASS AVOCADO', ''],
  ['  2 @ 1.25', '2.50'],
  ['FLOUR TORTILLAS 10CT', '2.99'],
  ['SOUR CREAM 16OZ', '2.29'],
  ['LIMES 3 FOR', '0.99'],
  ['PAPER TOWELS 2PK', '4.49'],
];
const subtotal = LINES.reduce((s, [, p]) => s + (Number(p) || 0), 0);
const tax = Math.round(subtotal * 0.0225 * 100) / 100;
const money = (n) => n.toFixed(2);

const row = ([name, price]) => `<div class="row"><span>${name}</span><span>${price}</span></div>`;
const html = `<!doctype html><html><head><style>
  html, body { margin: 0; width: 900px; height: 1200px; overflow: hidden; }
  body {
    background:
      radial-gradient(120% 90% at 18% 8%, rgb(255 250 240 / 0.55), transparent 60%),
      repeating-linear-gradient(94deg, rgb(0 0 0 / 0.025) 0 3px, transparent 3px 11px),
      linear-gradient(170deg, #c9c2b6, #a9a195);
  }
  .paper {
    position: absolute; left: 136px; top: 44px; width: 628px; padding: 58px 52px 120px;
    background:
      linear-gradient(90deg, rgb(0 0 0 / 0.05), transparent 12%, transparent 88%, rgb(0 0 0 / 0.06)),
      linear-gradient(180deg, #fbfaf6, #f1efe8);
    transform: rotate(-1.7deg); transform-origin: 50% 0;
    box-shadow: 0 2px 2px rgb(0 0 0 / 0.12), 18px 26px 40px rgb(0 0 0 / 0.28);
    font: 700 29px/1.42 'Courier New', Courier, monospace; color: #2b2b2e; letter-spacing: 0.5px;
    -webkit-mask: linear-gradient(#000 0 0) top / 100% calc(100% - 22px) no-repeat,
      conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / 34px 22px repeat-x;
  }
  .head { text-align: center; margin-bottom: 30px; }
  .head b { display: block; font-size: 44px; letter-spacing: 3px; }
  .rule { border-top: 3px dashed #55555a; margin: 20px 0; }
  .row { display: flex; justify-content: space-between; white-space: pre; }
  .total { font-size: 37px; }
  .foot { text-align: center; margin-top: 34px; }
  .grain { position: absolute; inset: 0; opacity: 0.13; mix-blend-mode: multiply; }
</style></head><body>
  <div class="paper">
    <div class="head"><b>CORNER MARKET</b>FRESH FOOD DAILY<br>STORE 0214  REG 03<br>11/02/26  6:04 PM</div>
    <div class="rule"></div>
    ${LINES.map(row).join('')}
    <div class="rule"></div>
    ${row(['SUBTOTAL', money(subtotal)])}
    ${row(['TAX', money(tax)])}
    <div class="total">${row(['TOTAL', money(subtotal + tax)])}</div>
    <div class="rule"></div>
    ${row(['VISA **** 4417', money(subtotal + tax)])}
    <div class="foot">13 ITEMS<br>THANK YOU FOR SHOPPING</div>
  </div>
  <svg class="grain" width="900" height="1200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/></filter><rect width="900" height="1200" filter="url(#n)"/></svg>
</body></html>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pantry-receipt-'));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.screenshot({ path: path.join(tmp, 'receipt.png') });
await browser.close();
execFileSync('cwebp', ['-quiet', '-m', '6', '-q', '84', path.join(tmp, 'receipt.png'), '-o', out]);
// and the JPEG the relay sends the kitchen (api/pantry.js)
execFileSync('magick', [path.join(tmp, 'receipt.png'), '-strip', '-quality', '82', out.replace(/\.webp$/, '.jpg')]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`receipt: ${path.relative(process.cwd(), out)}`);
