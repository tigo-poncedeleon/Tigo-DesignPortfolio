// pantry-kitchen.js — the prototype's line to PantryPal's kitchen: the three
// calls the app makes to its proxy (LiveServices.swift), made here through
// the page's own relay (api/pantry.js), which holds the app's key.
//
//   recipes(names)     the dishes the kitchen writes for a shelf, two of them,
//                      as CateredPickStore and the shelf's "Find recipes" ask
//   scanPicture(name)  what one of the scanner's own two pictures has on
//                      it: only the name goes, and the relay sends the
//                      photo, so nothing here redraws or uploads it
//   scan(photo)        the same for a photo from the library, the non-food
//                      dropped as the app drops it
//   recordedReading()  what the kitchen read off one of the two pictures
//                      once (scan-readings.json), for a scan whose kitchen
//                      does not answer
//   drawing(name)      a drawing for a food or a dish: the app's bundled one
//                      if it has one (art/, art.json), or the art store's,
//                      lifted off its white the way the app's SubjectLifter
//                      lifts it, kept for the session
//
// A failure is a KitchenError, whose kind is the app's own five: offline,
// slow, busy (the limiter), slammed (the model) and snag (anything else), so
// each screen says what the app says.
//
// It always asks its own origin: on the site, the relay; on this Mac,
// tools/serve.py, which relays the same three routes with the app's key
// read from the app's own Secrets.xcconfig. window.PANTRY_ENDPOINT points
// it elsewhere.

import { bundledSlug, drawnSlug, nearest, looksMisspelled, promptSubject, slug, matchKey, canonicalTitle, isLikelyNonFood, SHELVES } from './pantry-chef.js';

const HERE = new URL('.', import.meta.url).href;
const ENDPOINT = window.PANTRY_ENDPOINT || '/api/pantry';
// the app's client deadline (LiveServices proxySession)
const DEADLINE = 35000;

export class KitchenError extends Error {
  constructor(kind) {
    super(kind);
    this.kind = kind;
  }
}

async function post(route, body) {
  if (!navigator.onLine) throw new KitchenError('offline');
  let res;
  try {
    res = await fetch(`${ENDPOINT}?route=${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEADLINE),
    });
  } catch (err) {
    throw new KitchenError(err?.name === 'TimeoutError' ? 'slow' : navigator.onLine ? 'snag' : 'offline');
  }
  if (res.status === 429) throw new KitchenError('busy');
  if (res.status === 503) throw new KitchenError('slammed');
  if (res.status === 504) throw new KitchenError('slow');
  if (!res.ok) throw new KitchenError('snag');
  try {
    return await res.json();
  } catch {
    throw new KitchenError('snag');
  }
}

// GeneratedRecipe, decoded as the app decodes it: a dish missing anything it
// needs is not a dish, and minutes is optional
const text = (v) => (typeof v === 'string' ? v.trim() : '');
function recipeOf(r) {
  if (!r || !text(r.title) || !Array.isArray(r.ingredientNames) || !Array.isArray(r.steps)) return null;
  const steps = r.steps.map((s) => ({ title: text(s?.title), body: text(s?.body) })).filter((s) => s.title || s.body);
  const ingredientNames = r.ingredientNames.map(text).filter(Boolean);
  if (!steps.length || !ingredientNames.length) return null;
  return {
    title: text(r.title),
    summary: text(r.summary),
    calories: Math.round(Number(r.calories) || 0),
    proteinGrams: Math.round(Number(r.proteinGrams) || 0),
    minutes: Number.isFinite(Number(r.minutes)) && Number(r.minutes) > 0 ? Math.round(Number(r.minutes)) : undefined,
    ingredientNames,
    steps,
    written: true,
  };
}
export async function recipes(names, count = 2) {
  const answer = await post('recipes', { ingredients: names, count });
  return (Array.isArray(answer?.recipes) ? answer.recipes : []).map(recipeOf).filter(Boolean);
}

// A photo as the app uploads one (ScanPhoto.uploadJPEG): its long edge at
// most 1600, a JPEG at 0.8. A browser that cannot make a bitmap of the file
// draws it through an image element instead.
async function picture(blob) {
  try {
    return await createImageBitmap(blob);
  } catch {
    const im = new Image();
    im.src = URL.createObjectURL(blob);
    await im.decode();
    return im;
  }
}
export async function photoJPEG(source) {
  const bitmap = await picture(source);
  const w = bitmap.width || bitmap.naturalWidth;
  const hgt = bitmap.height || bitmap.naturalHeight;
  const k = Math.min(1, 1600 / Math.max(w, hgt));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(hgt * k);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
}
const found = (list) => (Array.isArray(list) ? list : [])
  .map((i) => ({ name: text(i?.name), shelf: SHELVES.includes(i?.category) ? i.category : 'pantry', quantity: Math.max(1, Math.round(Number(i?.quantity) || 1)) }))
  .filter((i) => i.name && !isLikelyNonFood(i.name));
export async function scan(jpegBase64) {
  return found((await post('scan', { image: jpegBase64, mime: 'image/jpeg' }))?.ingredients);
}
export async function scanPicture(name) {
  return found((await post('scan', { picture: name }))?.ingredients);
}
let readings = null;
export async function recordedReading(name) {
  readings ||= fetch(`${HERE}scan-readings.json`).then((r) => r.json());
  return found((await readings)[name]);
}

// ---- the drawings ----
// A bundled drawing is a file the page already has; anything else is asked
// of the art store once a session, two at a time (IllustrationGenerationGate),
// and a subject that failed is not asked again this session.
const drawn = new Map();
let running = 0;
const queue = [];
const gate = () => new Promise((go) => { if (running < 2) { running++; go(); } else queue.push(go); });
const release = () => { const next = queue.shift(); if (next) next(); else running--; };

export const bundledURL = (name, dish = false) => {
  const s = bundledSlug(name, dish);
  return s ? `${HERE}art/${s}.webp` : null;
};
// the drawing's URL now if there is one, else null, and nothing asked
export function drawingNow(name, dish = false) {
  return bundledURL(name, dish) || drawn.get(storeKey(name, dish))?.url || null;
}
const storeKey = (name, dish) => (dish ? `dish:${slug(canonicalTitle(name))}` : slug(matchKey(name)));
// the drawing, bundled or drawn; `generate: false` asks for nothing new, as
// the type-in page's art well never does while a name is being typed
export function drawing(name, { dish = false, generate = true } = {}) {
  const now = bundledURL(name, dish);
  if (now) return Promise.resolve(now);
  const key = storeKey(name, dish);
  const known = drawn.get(key);
  if (known) return known.promise;
  if (!generate || !key || (!dish && looksMisspelled(name))) return Promise.resolve(null);
  const entry = { url: null, promise: null };
  // A food the art store has already drawn for the page arrives as one
  // drawn for the app does: after a beat, into the slot that turned while
  // it waited, and kept for the session after that.
  const ready = !dish && drawnSlug(name);
  if (ready) {
    entry.promise = new Promise((done) => {
      const url = `${HERE}drawn/${ready}.webp`;
      const im = new Image();
      im.src = url;
      setTimeout(() => { entry.url = url; done(url); }, 500 + Math.random() * 1700);
    });
    drawn.set(key, entry);
    return entry.promise;
  }
  entry.promise = (async () => {
    await gate();
    try {
      const query = new URLSearchParams({ route: 'illustrate', ingredient: promptSubject(name, dish) });
      if (dish) query.set('variant', 'dish');
      const res = await fetch(`${ENDPOINT}?${query}`, { signal: AbortSignal.timeout(DEADLINE) });
      if (res.ok) entry.url = await lift(await res.blob(), dish ? 560 : 320);
    } catch {
      // the store did not answer; the nearest food stands in, below
    } finally {
      release();
    }
    // a food the store could not draw wears the nearest one's drawing
    // rather than an empty tile ("Iceberg Lettuce" is lettuce)
    if (!entry.url && !dish) {
      const near = nearest(name);
      if (near) entry.url = `${HERE}${near.folder}/${near.slug}.webp`;
    }
    return entry.url;
  })();
  drawn.set(key, entry);
  return entry.promise;
}

// The art store draws on plain white, since image models cannot draw
// transparency, and the app lifts the subject off it (SubjectLifter). Here
// the white is flooded from the edges, stopping at the drawing's ink line,
// so a white plate inside the line stays a plate; the pixels at the edge of
// the flood take an alpha by how white they are, with the white taken back
// out of their colour, and the picture is trimmed to what is left.
async function lift(blob, edge) {
  const bitmap = await createImageBitmap(blob);
  const k = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * k);
  const hgt = Math.round(bitmap.height * k);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = hgt;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, hgt);
  bitmap.close?.();
  const image = ctx.getImageData(0, 0, w, hgt);
  const d = image.data;
  const off = (i) => 765 - d[i * 4] - d[i * 4 + 1] - d[i * 4 + 2];
  const FLOOD = 42;
  const bg = new Uint8Array(w * hgt);
  const stack = [];
  const seed = (i) => { if (!bg[i] && off(i) < FLOOD) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((hgt - 1) * w + x); }
  for (let y = 0; y < hgt; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i < (hgt - 1) * w) seed(i + w);
  }
  let minX = w;
  let minY = hgt;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < w * hgt; i++) {
    const x = i % w;
    const y = (i / w) | 0;
    if (bg[i]) { d[i * 4 + 3] = 0; continue; }
    const edgeOf = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (i >= w && bg[i - w]) || (i < (hgt - 1) * w && bg[i + w]);
    if (edgeOf) {
      const a = Math.min(1, off(i) / 150);
      if (a < 1) {
        for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.max(0, Math.min(255, Math.round((d[i * 4 + c] - 255 * (1 - a)) / Math.max(a, 0.05))));
        d[i * 4 + 3] = Math.round(a * 255);
      }
    }
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX < 0) return null;
  ctx.putImageData(image, 0, 0);
  const pad = 2;
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(w, maxX + pad + 1) - cx;
  const ch = Math.min(hgt, maxY + pad + 1) - cy;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  const png = await new Promise((done) => out.toBlob(done, 'image/png'));
  return png ? URL.createObjectURL(png) : null;
}
