// pantry-screens.mjs — shoot every screen of PantryPal for the Ship
// chapter's reel (assets/case/pantrypal/screens/), from the app the case
// study runs on the page.
//
//     python3 live-portfolio/tools/serve.py 8793 &
//     node live-portfolio/tools/pantry-screens.mjs [http://localhost:8793]
//
// The reel shows the app as the page's own phone draws it (the chef, live:
// assets/case/pantrypal/app/), so the two always agree: when the live app
// changes, run this and the reel follows. A second copy of the app is
// mounted alone on the page, over nothing, and walked the way a new chef
// walks it, a press at a time: in from the icon, the Kitchen Pass, the
// tour, "Hey, chef!", the fridge scanned through its four steps, the
// cheeseburger's six foods typed in, the chef writing, dinner, its recipe,
// the shelf, Settings. Each screen is shot with the
// phone's own frame, at 800 wide, on nothing, as the earlier captures in
// phones/ are.
//
// Its kitchen is pointed nowhere, so every answer is the one the app keeps
// for a kitchen that does not answer: the scan's recorded reading of the
// fridge (app/scan-readings.json) and the book's own top pick, the same
// each run. (Asked for real, the chef writes a new dish every time.)
//
// Needs the system Chrome, which it drives over its debugging port, and
// cwebp.

import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(site, 'assets/case/pantrypal/screens');
const BASE = (process.argv[2] || 'http://localhost:8793').replace(/\/$/, '');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pantry-screens-'));
fs.mkdirSync(OUT, { recursive: true });

// ---- the walk: what to press, how long to let it land, and what to keep ----
const NAME = "(() => { const i = document.querySelector('#reel-host .pp-signup .pp-input'); i.value = 'Tigo'; i.dispatchEvent(new Event('input', { bubbles: true })); })()";
const TYPE = `(async () => {
  const v = document.querySelector('#reel-host .pp-typein');
  const i = v.querySelector('.pp-tinput');
  for (const n of ['Ground Beef', 'Cheddar Cheese', 'Lettuce', 'Tomato', 'Burger Buns', 'Salt']) {
    i.value = n;
    i.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 450));
    v.querySelector('.pp-addbadge').click();
    await new Promise((r) => setTimeout(r, 650));
  }
})()`;
const WALK = [
  { press: '.pp-appicon', wait: 4500, keep: 'join' },
  { run: NAME, press: '.pp-signup .pp-join', wait: 5500, keep: 'tour' },
  { press: '.pp-howto', wait: 3500, keep: 'welcome' },
  { press: '.pp-welcome .pp-scan', wait: 2000, keep: 'scan' },
  { press: '.pp-scanner .is-food', wait: 2500, keep: 'snap' },
  { press: '.pp-scanner .is-accept', wait: 1100, keep: 'scanning' },
  { wait: 6000, keep: 'found' },
  { press: '.pp-scanner .pp-keep', wait: 1500 },
  { press: '.pp-home .pp-type', wait: 2000 },
  { run: TYPE, wait: 1500, keep: 'typein' },
  // back on Home the chef sits down to write for the new shelf, and, his
  // kitchen not answering, hands the seat to the book's top pick
  { press: '.pp-typein .pp-bar', wait: 2600, keep: 'writing' },
  { wait: 9500, keep: 'dinner' },
  { press: '.pp-home .pp-go', wait: 2500, keep: 'recipe' },
  { press: '.pp-recipe .is-back', wait: 1500 },
  { press: '.pp-home .is-door', wait: 2200, keep: 'shelf' },
  { press: '.pp-shelf .is-back', wait: 1500 },
  { press: '.pp-home .is-gear', wait: 2200, keep: 'settings' },
];

// ---- Chrome, over its debugging port ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(TMP, 'chrome')}`,
  '--hide-scrollbars', '--window-size=900,1000', 'about:blank'], { stdio: 'ignore' });
let target;
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
  if (!target) await sleep(200);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const waiting = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const run = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
};

// the phone 400 wide at twice the pixels, so a shot is 800 across
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1000, deviceScaleFactor: 2, mobile: false });
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
await send('Page.navigate', { url: `${BASE}/pantrypal.html` });
await sleep(2500);
// the page's own phone stays asleep (it wakes only near the window); this
// one is mounted alone over a page with nothing else to show
await run(`(async () => {
  window.PANTRY_ENDPOINT = 'http://127.0.0.1:9/api/pantry';
  const APP = '/assets/case/pantrypal/app/';
  const [{ mountPantryApp }, book, artIndex] = await Promise.all([
    import(APP + 'pantry-app.js'),
    fetch(APP + 'chefbook.json').then((r) => r.json()).then((d) => d.recipes),
    fetch(APP + 'art.json').then((r) => r.json()),
  ]);
  const style = document.createElement('style');
  style.textContent = 'html, body { background: transparent !important; } body > *:not(#reel-host) { visibility: hidden !important; } #reel-host { position: fixed; left: 50px; top: 40px; width: 400px; z-index: 99999; }';
  document.head.append(style);
  const host = document.createElement('div');
  host.id = 'reel-host';
  document.body.append(host);
  mountPantryApp(host, { book, artIndex, announce: false });
})()`);
await sleep(1500);

for (const step of WALK) {
  if (step.run) await run(step.run);
  if (step.press) {
    const found = await run(`(() => { const el = document.querySelector('#reel-host ' + ${JSON.stringify(step.press)}); if (el) el.click(); return !!el; })()`);
    if (!found) throw new Error(`nothing to press at ${step.press}`);
  }
  await sleep(step.wait);
  if (!step.keep) continue;
  const box = JSON.parse(await run(`JSON.stringify(document.getElementById('reel-host').getBoundingClientRect())`));
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 } });
  const png = path.join(TMP, `${step.keep}.png`);
  fs.writeFileSync(png, Buffer.from(shot.result.data, 'base64'));
  execFileSync('cwebp', ['-quiet', '-q', '84', '-alpha_q', '100', png, '-o', path.join(OUT, `${step.keep}.webp`)]);
  console.log(`screens/${step.keep}.webp`);
}
ws.close();
// (Chrome writes its profile as it goes, so it is let go before the folder)
await new Promise((r) => { chrome.once('exit', r); chrome.kill(); });
fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
