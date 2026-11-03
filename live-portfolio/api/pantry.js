// Vercel serverless relay to PantryPal's own kitchen, for the app the case
// study runs on its page (assets/case/pantrypal/app/).
//
// The prototype on pantrypal.html is the App Store build's screens, and it
// asks what the app asks of the same server: PantryPal's proxy (a Vercel
// project of its own, ~/Developer/PantryPal/proxy), which holds the Gemini
// key and writes every prompt. So a scan here is read by the model that reads
// the app's, a dish here is written by the prompt that writes the app's, and
// a drawing comes out of the same art store. This function holds the one
// thing the browser must not: the app's shared secret, in the PP_APP_SECRET
// environment variable on Vercel (PP_PROXY_URL names the proxy, and defaults
// to the one the app ships with). It passes three routes through, each in
// the shape the app sends it (LiveServices.swift):
//
//   POST ?route=recipes      { ingredients: [string], count: 1 or 2 }
//   POST ?route=scan         { picture: 'receipt' | 'fridge' }, one of the
//                            two pictures the scanner's doors take, read here
//                            off the site's own files and sent on as a JPEG;
//                            or { image: base64, mime }, a photo from the
//                            library, a JPEG, PNG or WebP under about 2 MB
//   GET  ?route=illustrate&ingredient=…[&variant=dish]
//                            a drawing's bytes, cached by Vercel's CDN for a
//                            year, as the proxy's own answer is
//
// It is a public endpoint that spends money (half a cent a dish, about seven
// cents for a drawing nobody has asked for before), so it takes what the
// app's screens send and nothing else, and meters each visitor:
//   - every field is checked and bounded before it goes upstream, and the
//     body is rebuilt from those fields
//   - each address gets a sliding window per route (LIMITS), per warm
//     instance, as the proxy's own limiter works, and a ceiling of its own
//     on new drawings: past it, a visitor is served only drawings the store
//     already has (the proxy's ?existing=1), and the page draws the nearest
//     food it has instead (the scanner's own foods are drawn ahead, in the
//     page's app/drawn/, and cost nothing)
//   - upstream, the proxy meters each "device": here a visitor is one, a
//     salted hash of the address, so one busy visitor cannot use up the
//     quota of every other
//   - the page calls it from its own origin, which needs no CORS; the one
//     other origin it answers is a copy of the site on this machine (as
//     api/chat.js does), which has no /api of its own
// The hard ceiling on the bill is still the proxy's prepaid Gemini balance.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PROXY = (process.env.PP_PROXY_URL || 'https://pantrypal-proxy.vercel.app').replace(/\/$/, '');
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const MAX_INGREDIENTS = 60;
const MAX_NAME = 60;
const MAX_IMAGE_BASE64 = 3000000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// a name the art store could draw: letters, spaces and the punctuation food
// names carry, never a prompt
const DRAWABLE = /^[\p{L}][\p{L}\p{M}0-9 '’&.,-]{0,59}$/u;
// The app's own client deadline is 35 seconds, and the proxy's budget is 28
// for words and 32 for a drawing, so the proxy loses its race first; this
// one is the backstop for a proxy that never answers at all.
const UPSTREAM_MS = { text: 33000, art: 34000 };

// The scanner's two pictures, by name. A door sends only the name: the
// photo is the site's own (vercel.json includes them in this function), so
// nothing in the browser has to redraw it, and nothing big is uploaded.
const PICTURES = { receipt: 'scan-receipt.jpg', fridge: 'scan-fridge.jpg' };
const pictures = new Map();
async function picture(name, req) {
  if (pictures.has(name)) return pictures.get(name);
  const file = path.join('assets/case/pantrypal/app', PICTURES[name]);
  let bytes = null;
  // the project's root, as Vercel runs a function (it compiles this file to
  // CommonJS, where import.meta is a syntax error, so no path beside it)
  try { bytes = await readFile(path.join(process.cwd(), file)); } catch { /* fetched below */ }
  if (!bytes) {
    // a deployment that left the file out still serves it
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const res = await fetch(`${proto}://${req.headers.host}/${file}`);
    if (!res.ok) throw new Error(`picture ${name}: ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
  }
  const base64 = bytes.toString('base64');
  pictures.set(name, base64);
  return base64;
}

// per address, per ten minutes, and new drawings per hour
const LIMITS = {
  recipes: { count: 12, windowMs: 10 * 60 * 1000 },
  scan: { count: 8, windowMs: 10 * 60 * 1000 },
  illustrate: { count: 90, windowMs: 10 * 60 * 1000 },
  render: { count: 16, windowMs: 60 * 60 * 1000 },
};
const hits = new Map();
function spend(kind, who, now = Date.now()) {
  const { count, windowMs } = LIMITS[kind];
  const key = `${kind}:${who}`;
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= count) {
    hits.set(key, recent);
    return Math.ceil((windowMs - (now - recent[0])) / 1000);
  }
  recent.push(now);
  hits.set(key, recent);
  // a warm instance forgets the addresses it has not seen for an hour
  if (hits.size > 5000) {
    for (const [k, times] of hits) if (!times.length || now - times[times.length - 1] > 3600000) hits.delete(k);
  }
  return 0;
}
function over(kind, who) {
  const { count, windowMs } = LIMITS[kind];
  const now = Date.now();
  return (hits.get(`${kind}:${who}`) || []).filter((t) => now - t < windowMs).length >= count;
}

function visitor(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}
const device = (ip) => `web-${createHash('sha256').update(`${process.env.PP_APP_SECRET}|${ip}`).digest('hex').slice(0, 20)}`;

// A call to the proxy, body and all, under a deadline that holds whatever
// the connection does: the timer aborts the request and the read alike.
async function upstream(path, init, ip, ms) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(new DOMException('upstream', 'TimeoutError')), ms);
  try {
    const answer = await fetch(`${PROXY}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        'x-pantrypal-key': process.env.PP_APP_SECRET,
        'x-pantrypal-device': device(ip),
      },
      signal: stop.signal,
    });
    const body = Buffer.from(await answer.arrayBuffer());
    return { status: answer.status, ok: answer.ok, headers: answer.headers, body };
  } finally {
    clearTimeout(timer);
  }
}

// The JSON routes: the proxy's answer, status and all, or a reason. A
// kitchen that falls over quickly (a 5xx) is asked once more, since the
// model behind it fails now and then and is fine on the next try; one that
// runs out the clock is not, or the second wait would outlast the page's.
async function relayJSON(res, path, body, ip) {
  const ask = () => upstream(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, ip, UPSTREAM_MS.text);
  const started = Date.now();
  let answer = await ask();
  if (answer.status >= 500 && Date.now() - started < 12000) answer = await ask();
  const retry = answer.headers.get('retry-after');
  if (retry) res.setHeader('Retry-After', retry);
  res.status(answer.status);
  res.setHeader('Content-Type', 'application/json');
  return res.send(answer.ok ? answer.body.toString('utf8') : JSON.stringify({ error: answer.status === 429 ? 'busy' : 'kitchen' }));
}

function recipes(req, res, body, ip) {
  const list = body?.ingredients;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_INGREDIENTS) {
    return res.status(400).json({ error: 'ingredients' });
  }
  const ingredients = [];
  for (const item of list) {
    const name = typeof item === 'string' ? item.trim() : '';
    if (!name || name.length > MAX_NAME) return res.status(400).json({ error: 'ingredients' });
    ingredients.push(name);
  }
  const count = Math.min(Math.max(Math.round(Number(body.count) || 2), 1), 2);
  const wait = spend('recipes', ip);
  if (wait) return tooMany(res, wait);
  return relayJSON(res, '/api/recipes', { ingredients, count }, ip);
}

async function scan(req, res, body, ip) {
  if (typeof body?.picture === 'string') {
    if (!PICTURES[body.picture]) return res.status(400).json({ error: 'picture' });
    const wait = spend('scan', ip);
    if (wait) return tooMany(res, wait);
    return relayJSON(res, '/api/scan', { image: await picture(body.picture, req), mime: 'image/jpeg' }, ip);
  }
  const image = body?.image;
  const mime = body?.mime || 'image/jpeg';
  if (typeof image !== 'string' || !image || image.length > MAX_IMAGE_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return res.status(400).json({ error: 'image' });
  }
  if (!IMAGE_TYPES.includes(mime)) return res.status(400).json({ error: 'image' });
  const wait = spend('scan', ip);
  if (wait) return tooMany(res, wait);
  return relayJSON(res, '/api/scan', { image, mime }, ip);
}

async function illustrate(req, res, ip) {
  // the store files a subject by its lowercase name, as the app sends it
  // (IllustrationKey.promptSubject), so "Avocado" is the avocado already
  // drawn, never a second purchase of it
  const ingredient = String(req.query.ingredient || '').trim().toLowerCase();
  const variant = req.query.variant === 'dish' ? 'dish' : null;
  if (!DRAWABLE.test(ingredient)) return res.status(400).json({ error: 'ingredient' });
  const wait = spend('illustrate', ip);
  if (wait) return tooMany(res, wait);
  // past the ceiling on new drawings, only what the store already holds
  const capped = over('render', ip);
  const query = new URLSearchParams({ ingredient });
  if (variant) query.set('variant', variant);
  if (capped) query.set('existing', '1');
  const answer = await upstream(`/api/illustrate?${query}`, { method: 'GET', headers: {} }, ip, UPSTREAM_MS.art);
  const source = answer.headers.get('x-pp-source') || '';
  if (source === 'model') spend('render', ip);
  if (!answer.ok) {
    // a refusal for one visitor is never cached for the next
    res.setHeader('Cache-Control', capped ? 'no-store' : 'public, s-maxage=600');
    return res.status(answer.status === 404 ? 404 : 502).json({ error: 'drawing' });
  }
  res.setHeader('Content-Type', answer.headers.get('content-type') || 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
  res.setHeader('X-PP-Source', source);
  return res.status(200).send(answer.body);
}

function tooMany(res, seconds) {
  res.setHeader('Retry-After', String(seconds));
  return res.status(429).json({ error: 'busy' });
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && LOCAL_ORIGIN.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const route = req.query.route;
  if (!process.env.PP_APP_SECRET) {
    console.error('pantry: PP_APP_SECRET is not set');
    return res.status(503).json({ error: 'kitchen' });
  }
  const ip = visitor(req);
  try {
    if (route === 'illustrate') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'method' });
      return await illustrate(req, res, ip);
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method' });
    }
    res.setHeader('Cache-Control', 'no-store');
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'body' }); }
    }
    if (route === 'recipes') return await recipes(req, res, body, ip);
    if (route === 'scan') return await scan(req, res, body, ip);
    return res.status(404).json({ error: 'route' });
  } catch (err) {
    // a timeout is the kitchen being slow, as the app hears it; anything
    // else is the kitchen being down
    const timedOut = err?.name === 'TimeoutError';
    console.error('pantry:', route, timedOut ? 'timed out' : err?.message);
    return res.status(timedOut ? 504 : 502).json({ error: timedOut ? 'slow' : 'kitchen' });
  }
}
