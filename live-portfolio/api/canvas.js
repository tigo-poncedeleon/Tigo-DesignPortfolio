// Vercel serverless relay to Gemini, for Canvas's Live Run (chosen in the
// menu under the board's name on canvas.html; the page's side of it is
// assets/case/vicino/canvas/vicino-live.js).
//
// Canvas is the replica of the node editor Tigo helped build at Vicino AI.
// Its test run is simulated: every result is a file the page already has.
// A live run is a blank, working canvas that asks Gemini for real. Whatever
// model name a node shows (the shipped board's own menu), an Image node is
// answered by a Gemini image model, and a Video node by Gemini Omni Flash,
// handed the frame its image node returned; vicino-live.js maps one to the
// other. (Gemini makes no 3D models, so a live run offers no 3D node.) This
// function holds the two things the browser must not: the Gemini key, in
// GEMINI_API_KEY on Vercel, and the password that lets a run spend it, in
// CANVAS_PASSCODE.
//
// It is for Tigo alone, for demos given in person, so every route wants the
// passcode in an x-canvas-pass header and answers 401 without it. Guessing is
// slowed to a handful of tries per address. The passcode is the gate; the
// limits below are a seatbelt against a page left running in a loop, not a
// meter for strangers, and the hard ceiling on the bill is the spend cap on
// the key's own Google project.
//
//   POST ?route=unlock   {}                         204, or 401
//   POST ?route=image    { model, prompt, aspect, images: [{ data, mime }] }
//                        the picture's bytes, as Gemini returned them
//   POST ?route=video    { model, prompt, aspect, seconds, resolution,
//                          image: { data, mime } }  202 { id }
//   POST ?route=plan     { message }  { reply, nodes, edges }: the AI
//                        Workflow Builder's graph for a request
//   GET  ?route=video&id=…          { status, parts, bytes, mime } once the
//                                   clip is done; { status } while it runs;
//                                   { status: 'failed', message } if not
//   GET  ?route=video&id=…&part=N   part N of the finished clip's bytes
//
// Why a clip comes back in parts: a Vercel function's response body is capped
// at 4.5 MB, streamed or not, and a ten-second 1080p clip is bigger than
// that. Storing the clip somewhere public (Vercel Blob) would lift the cap,
// but it would also leave every demo clip at a public address, and it would
// need a store of its own; three-megabyte parts, joined by the page, need
// neither. A picture is one part, since a 1K frame is well under the cap.
//
// Why video is asked for in the background: a clip takes a minute or more to
// make, and a function that waited for it would hold a connection the whole
// time. Gemini's Interactions API can run it in the background instead, kept
// for a week (store: true), and hand back an id to ask after; the page asks
// every few seconds. If the model ever refuses to run in the background, the
// relay asks again in the foreground, still stored, and waits (maxDuration is
// 300 for this), so the page's side of it does not change.

import { createHash, timingSafeEqual } from 'node:crypto';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
// Pinned versions, never `-latest`: PantryPal's proxy learned on 2026-08-21
// that a floating alias can move to a model that rejects the same call. The
// image models are the ones that proxy already runs on this account.
const IMAGE_MODELS = ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-3.1-flash-lite-image'];
const VIDEO_MODELS = ['gemini-omni-1.2-flash'];
// the Workflow Builder's planner: the text model PantryPal's proxy runs,
// pinned to a version for the same reason
const PLAN_MODEL = 'gemini-3.5-flash';
const PLAN_PORTS = { image: ['prompt', 'image'], video: ['prompt', 'firstFrame', 'refs'] };
const IMAGE_ASPECTS = ['16:9', '1:1', '9:16'];
// Omni makes landscape and portrait clips only, so a square ask is landscape
const VIDEO_ASPECTS = ['16:9', '9:16'];
const RESOLUTIONS = ['360p', '720p', '1080p', '4k'];
const MAX_PROMPT = 2000;
// any number of pictures can feed a node on the board; ten is where the
// relay stops, and the page redraws them smaller past three
const MAX_IMAGES = 10;
// The page sends its frames as JPEGs no wider than 1280 (a few hundred KB);
// the cap leaves room for that and stays under Vercel's 4.5 MB request limit.
const MAX_IMAGE_BASE64 = 2500000;
const MAX_BODY_BASE64 = 4000000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PART_BYTES = 3 * 1024 * 1024;
const MAX_RELAYED = 4400000;
// an interaction id goes into a path, so it may hold nothing that could leave
// the segment it is put in
const ID = /^[A-Za-z0-9_.:-]{1,200}$/;
const UPSTREAM_MS = { image: 150000, start: 60000, poll: 60000, foreground: 285000 };

// per address: wrong passcodes per quarter hour, and the seatbelts
const LIMITS = {
  guess: { count: 8, windowMs: 15 * 60 * 1000 },
  image: { count: 60, windowMs: 10 * 60 * 1000 },
  plan: { count: 40, windowMs: 10 * 60 * 1000 },
  video: { count: 12, windowMs: 60 * 60 * 1000 },
  poll: { count: 600, windowMs: 10 * 60 * 1000 },
};
const hits = new Map();
function recent(kind, who, now) {
  return (hits.get(`${kind}:${who}`) || []).filter((t) => now - t < LIMITS[kind].windowMs);
}
// seconds until the address may try again, or 0 if it may now
function wait(kind, who, now = Date.now()) {
  const times = recent(kind, who, now);
  return times.length >= LIMITS[kind].count
    ? Math.ceil((LIMITS[kind].windowMs - (now - times[0])) / 1000)
    : 0;
}
function spend(kind, who, now = Date.now()) {
  const left = wait(kind, who, now);
  if (left) return left;
  const times = recent(kind, who, now);
  times.push(now);
  hits.set(`${kind}:${who}`, times);
  if (hits.size > 2000) {
    for (const [k, t] of hits) if (!t.length || now - t[t.length - 1] > 3600000) hits.delete(k);
  }
  return 0;
}
function tooMany(res, seconds) {
  res.setHeader('Retry-After', String(seconds));
  return res.status(429).json({ error: 'busy', message: `Too many tries; wait ${Math.ceil(seconds / 60)} min` });
}

function visitor(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

// Compared as digests, so the time it takes says nothing about how much of a
// guess was right.
function opens(req) {
  const want = process.env.CANVAS_PASSCODE;
  const got = String(req.headers['x-canvas-pass'] || '');
  if (!want || !got) return false;
  const digest = (s) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(want), digest(got));
}

function cleanPrompt(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_PROMPT);
}

// Pictures the page sends: base64 with a type, bounded one by one and in
// all. Anything else in the list is a malformed request, not a picture to
// skip, so the whole list is refused (null).
function pictures(list) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > MAX_IMAGES) return null;
  let total = 0;
  const out = [];
  for (const item of list) {
    const data = typeof item?.data === 'string' ? item.data : '';
    const mime = IMAGE_TYPES.includes(item?.mime) ? item.mime : '';
    if (!data || !mime || data.length > MAX_IMAGE_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(data)) return null;
    total += data.length;
    out.push({ data, mime });
  }
  return total > MAX_BODY_BASE64 ? null : out;
}

// A call to Gemini under a deadline that holds whatever the connection does:
// the timer aborts the request and the read alike.
async function gemini(path, init, ms) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(new DOMException('upstream', 'TimeoutError')), ms);
  try {
    const answer = await fetch(path.startsWith('https://') ? path : `${GEMINI}${path}`, {
      ...init,
      headers: { ...init.headers, 'x-goog-api-key': process.env.GEMINI_API_KEY },
      signal: stop.signal,
    });
    const isJSON = /json/.test(answer.headers.get('content-type') || '');
    if (!isJSON) {
      return { status: answer.status, ok: answer.ok, json: null, bytes: Buffer.from(await answer.arrayBuffer()) };
    }
    const text = await answer.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* left null: said below */ }
    return { status: answer.status, ok: answer.ok, json };
  } finally {
    clearTimeout(timer);
  }
}

// Gemini's own refusal, passed on in words. The page is Tigo's alone, so the
// message can be Google's own: "API key not valid" is what he needs to read.
// A 401 from here means the passcode and nothing else, so a key Google
// rejects is a 502.
function refused(res, answer) {
  const message = answer.json?.error?.message || `The model answered ${answer.status}`;
  console.error('canvas: gemini answered', answer.status, outline(answer.json));
  if (answer.status === 429) return res.status(429).json({ error: 'busy', message });
  if (answer.status === 400) return res.status(422).json({ error: 'declined', message });
  return res.status(502).json({ error: 'gemini', message });
}

// What an answer looked like, for the function's logs: its keys and types,
// with every long string cut down to its length, so a clip's base64 never
// lands in a log and a shape Gemini changed can still be read off one line.
// The Interactions API is new, and its docs are thin on what a clip in
// progress looks like, so the relay says what it was given.
function shape(value, depth = 0) {
  if (typeof value === 'string') return value.length > 60 ? `<${value.length} chars>` : value;
  if (!value || typeof value !== 'object') return value;
  if (depth > 6) return Array.isArray(value) ? '[…]' : '{…}';
  if (Array.isArray(value)) return value.slice(0, 8).map((v) => shape(v, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v, depth + 1)]));
}
const outline = (json) => JSON.stringify(shape(json)).slice(0, 2000);

// Everything the model said in words, joined: a refusal arrives as text where
// the picture or the clip would have been.
function words(node, out = []) {
  if (!node || typeof node !== 'object' || out.length > 4) return out;
  if (Array.isArray(node)) { node.forEach((n) => words(n, out)); return out; }
  if (typeof node.text === 'string' && node.text.trim()) out.push(node.text.trim());
  for (const [k, v] of Object.entries(node)) if (k !== 'text' && k !== 'input' && typeof v === 'object') words(v, out);
  return out;
}

async function image(req, res, body, ip) {
  const model = IMAGE_MODELS.includes(body?.model) ? body.model : IMAGE_MODELS[0];
  const prompt = cleanPrompt(body?.prompt);
  const refs = pictures(body?.images);
  if (refs === null) return res.status(400).json({ error: 'image', message: 'A reference picture was not one the relay takes' });
  if (!prompt && !refs.length) return res.status(400).json({ error: 'prompt', message: 'Wire a prompt into this node' });
  const aspect = IMAGE_ASPECTS.includes(body?.aspect) ? body.aspect : '16:9';
  const left = spend('image', ip);
  if (left) return tooMany(res, left);

  // the call PantryPal's proxy makes (generateContent with an imageConfig),
  // in REST's own words; the reference pictures go first, then the words
  const parts = refs.map((r) => ({ inlineData: { mimeType: r.mime, data: r.data } }));
  parts.push({ text: prompt || 'Make one new picture from these references.' });
  const answer = await gemini(`/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { imageConfig: { aspectRatio: aspect } },
    }),
  }, UPSTREAM_MS.image);
  if (!answer.ok) return refused(res, answer);

  const candidate = answer.json?.candidates?.[0];
  const found = candidate?.content?.parts?.find((p) => p.inlineData?.data);
  if (!found) {
    console.error('canvas: no picture in', outline(answer.json));
    const why = answer.json?.promptFeedback?.blockReason || candidate?.finishReason || 'no picture';
    const said = words(candidate?.content).join(' ').slice(0, 300);
    return res.status(422).json({ error: 'declined', message: said ? `${why}: ${said}` : `The model returned no picture (${why})` });
  }
  const bytes = Buffer.from(found.inlineData.data, 'base64');
  if (bytes.length > MAX_RELAYED) return res.status(502).json({ error: 'gemini', message: 'The picture was too big to relay' });
  res.setHeader('Content-Type', found.inlineData.mimeType || 'image/png');
  res.setHeader('x-canvas-model', String(answer.json?.modelVersion || model));
  return res.status(200).send(bytes);
}

// The AI Workflow Builder: a request in words, back as a small graph the
// board can lay out — text nodes holding written prompts, image and video
// nodes, and the wires between them. The model is asked for JSON and its
// answer is checked node by node and wire by wire before the page sees
// it, so a plan can only ever name things the board can build.
async function plan(req, res, body, ip) {
  const message = cleanPrompt(body?.message).slice(0, 800);
  if (!message) return res.status(400).json({ error: 'prompt', message: 'Say what you want to make' });
  // nodes selected on the board, which the plan may wire from by key
  const context = (Array.isArray(body?.context) ? body.context : []).slice(0, 4)
    .filter((c) => /^s\d$/.test(c?.key) && ['text', 'image', 'video'].includes(c?.type))
    .map((c) => ({ key: c.key, type: c.type, prompt: cleanPrompt(c.prompt || '').slice(0, 300) }));
  const left = spend('plan', ip);
  if (left) return tooMany(res, left);
  const brief = 'You plan workflows for a node-based generative canvas. Node types:\n' +
    '- text: holds a prompt (field "prompt"); its output is text.\n' +
    '- image: makes a picture from the text wired into its "prompt" port, and can take reference pictures on its "image" port.\n' +
    '- video: makes a short clip from the text on its "prompt" port, opening on the picture wired into its "firstFrame" port.\n' +
    'Plan the smallest graph (2 to 6 nodes) that does what the user asks. Write every text node\'s prompt as one vivid, ' +
    'specific paragraph (at most 60 words) ready for an image or video model. Use one text node per distinct idea. ' +
    'Reply as JSON: {"reply": one short sentence saying what you built, "nodes": [{"key": short id, "type": ' +
    '"text"|"image"|"video", "prompt": text nodes only}], "edges": [{"from": key, "to": key, "port": ' +
    '"prompt"|"image"|"firstFrame"|"refs"}]}. Edges go from a text node to a prompt port, or from an image node to an image, refs or ' +
    'firstFrame port. An image node may take several pictures on its image port, to blend or draw from them; ' +
    'a video node may take extra pictures on a "refs" port as references for its look.' +
    (context.length ? '\nThe user has selected these existing nodes, which you may wire FROM by their key ' +
      '(do not list them in "nodes"): ' + context.map((c) => `${c.key} (${c.type}${c.prompt ? `: "${c.prompt}"` : ''})`).join(', ') + '.' : '') +
    '\nUser: ' + message;
  const answer = await gemini(`/models/${PLAN_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: brief }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  }, UPSTREAM_MS.start);
  if (!answer.ok) return refused(res, answer);
  let raw = (answer.json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  let got;
  try { got = JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim()); } catch {
    console.error('canvas: plan was not JSON', raw.slice(0, 400));
    return res.status(502).json({ error: 'gemini', message: 'The planner answered in a shape the board cannot use' });
  }
  const nodes = [];
  const keys = new Set();
  for (const n of Array.isArray(got?.nodes) ? got.nodes.slice(0, 8) : []) {
    const key = String(n?.key || '').replace(/[^\w-]/g, '').slice(0, 24);
    const type = ['text', 'image', 'video'].includes(n?.type) ? n.type : null;
    if (!key || !type || keys.has(key)) continue;
    keys.add(key);
    nodes.push(type === 'text' ? { key, type, prompt: cleanPrompt(n.prompt).slice(0, 600) } : { key, type });
  }
  const typeOf = new Map(nodes.map((n) => [n.key, n.type]).concat(context.map((c) => [c.key, c.type])));
  const edges = [];
  for (const e of Array.isArray(got?.edges) ? got.edges.slice(0, 16) : []) {
    const from = typeOf.get(e?.from), to = typeOf.get(e?.to);
    if (!from || !to || e.from === e.to || !(PLAN_PORTS[to] || []).includes(e.port)) continue;
    if (/^s\d$/.test(e.to)) continue;            // a plan never rewires what was selected
    if ((e.port === 'prompt') !== (from === 'text')) continue;
    if (e.port !== 'prompt' && from !== 'image') continue;
    edges.push({ from: e.from, to: e.to, port: e.port });
  }
  if (!nodes.length) return res.status(502).json({ error: 'gemini', message: 'The planner returned no nodes' });
  return res.status(200).json({ reply: cleanPrompt(got?.reply || '').slice(0, 240), nodes, edges });
}

async function startVideo(req, res, body, ip) {
  const model = VIDEO_MODELS.includes(body?.model) ? body.model : VIDEO_MODELS[0];
  const prompt = cleanPrompt(body?.prompt);
  const frame = body?.image ? pictures([body.image]) : [];
  const refs = Array.isArray(body?.refs) && body.refs.length ? pictures(body.refs.slice(0, 6)) : [];
  if (frame === null || refs === null) return res.status(400).json({ error: 'image', message: 'A picture was not one the relay takes' });
  if (!prompt && !frame.length && !refs.length) return res.status(400).json({ error: 'prompt', message: 'Wire a prompt or a frame into this node' });
  const aspect = VIDEO_ASPECTS.includes(body?.aspect) ? body.aspect : '16:9';
  const seconds = Math.min(15, Math.max(3, parseInt(body?.seconds, 10) || 6));
  const resolution = RESOLUTIONS.includes(body?.resolution) ? body.resolution : '720p';
  const left = spend('video', ip);
  if (left) return tooMany(res, left);

  // Omni decides for itself how to use a lone picture, so the words ask for
  // it as the opening frame: the board's wire is labelled firstFrame, and a
  // clip that wandered off its frame would break the graph's promise.
  // the pictures go first frame first, then the references, and the
  // words say which is which
  const roles = [];
  if (frame.length) roles.push('open on the first image as the exact first frame, then animate it');
  if (refs.length) roles.push(`use the ${frame.length ? 'other' : ''} ${refs.length === 1 ? 'image' : refs.length + ' images'} only as references for the look of the subject and scene`.replace('  ', ' '));
  const said = (roles.length ? roles.join('; ') + '. ' : '') + (prompt || 'Natural, cinematic motion.');
  const input = [...frame, ...refs].map((f) => ({ type: 'image', data: f.data, mime_type: f.mime }));
  input.push({ type: 'text', text: said });
  const ask = (background) => gemini('/interactions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      input,
      response_format: { type: 'video', aspect_ratio: aspect, resolution, duration: `${seconds}s` },
      store: true,
      ...(background ? { background: true } : {}),
    }),
  }, background ? UPSTREAM_MS.start : UPSTREAM_MS.foreground);

  let answer = await ask(true);
  if (answer.status === 400 && /background/i.test(answer.json?.error?.message || '')) {
    console.log('canvas: no background run; asking in the foreground', outline(answer.json));
    answer = await ask(false);
  }
  if (!answer.ok) return refused(res, answer);
  console.log('canvas: clip asked for', answer.status, outline(answer.json));
  const id = String(answer.json?.id || answer.json?.name || '').replace(/^interactions\//, '');
  if (!ID.test(id)) return res.status(502).json({ error: 'gemini', message: 'The model gave no id for the clip' });
  return res.status(202).json({ id, status: 'running' });
}

// The clip in an interaction, wherever the answer keeps it: over REST it is
// a content item in steps (model_output), typed video, with its bytes inline
// or, if asked for that way, a Files URI.
function findVideo(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  if (Array.isArray(node)) {
    for (const n of node) { const v = findVideo(n, depth + 1); if (v) return v; }
    return null;
  }
  const mime = node.mime_type || node.mimeType || '';
  if ((node.type === 'video' || /^video\//.test(mime)) && (typeof node.data === 'string' || typeof node.uri === 'string')) {
    return { data: node.data, uri: node.uri, mime: /^video\//.test(mime) ? mime : 'video/mp4' };
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === 'input') continue;                 // the frame sent, not the clip
    const found = findVideo(v, depth + 1);
    if (found) return found;
  }
  return null;
}

// A warm instance keeps the last few finished clips, so asking for part 2
// does not fetch the whole interaction from Google again.
const clips = new Map();
function remember(id, clip) {
  clips.set(id, clip);
  while (clips.size > 4) clips.delete(clips.keys().next().value);
}

async function clipFor(id) {
  if (clips.has(id)) return { status: 'completed', clip: clips.get(id) };
  const answer = await gemini(`/interactions/${encodeURIComponent(id)}`, { method: 'GET', headers: {} }, UPSTREAM_MS.poll);
  if (!answer.ok) return { answer };
  const it = answer.json || {};
  const video = findVideo(it.steps || it.outputs || it);
  if (video) {
    let bytes = video.data ? Buffer.from(video.data, 'base64') : null;
    if (!bytes && video.uri) {
      // a Files URI wants the key, so it is only ever fetched from Google
      if (new URL(video.uri).hostname !== 'generativelanguage.googleapis.com') {
        return { status: 'failed', message: 'The clip was kept somewhere the relay does not fetch from' };
      }
      const file = await gemini(video.uri, { method: 'GET', headers: {} }, UPSTREAM_MS.poll);
      if (!file.ok || !file.bytes) return { status: 'failed', message: 'The finished clip could not be downloaded' };
      bytes = file.bytes;
    }
    const clip = { bytes, mime: video.mime };
    console.log('canvas: clip ready', id, bytes.length, 'bytes', clip.mime);
    remember(id, clip);
    return { status: 'completed', clip };
  }
  const status = String(it.status || 'in_progress').toLowerCase();
  console.log('canvas: clip', id, outline(it));
  if (it.error || /fail|cancel|expire|error/.test(status)) {
    return { status: 'failed', message: it.error?.message || words(it.steps).join(' ').slice(0, 300) || status };
  }
  if (status === 'completed') {
    const said = words(it.steps || it.outputs).join(' ').slice(0, 300);
    return { status: 'failed', message: said || 'The model finished without a clip (most often a safety filter)' };
  }
  return { status: 'running' };
}

async function video(req, res, ip) {
  const id = String(req.query.id || '');
  if (!ID.test(id)) return res.status(400).json({ error: 'id' });
  const left = spend('poll', ip);
  if (left) return tooMany(res, left);
  const found = await clipFor(id);
  if (found.answer) return refused(res, found.answer);
  if (found.status !== 'completed') return res.status(200).json(found);
  const { bytes, mime } = found.clip;
  const parts = Math.max(1, Math.ceil(bytes.length / PART_BYTES));
  if (req.query.part == null) return res.status(200).json({ status: 'completed', parts, bytes: bytes.length, mime });
  const n = Number(req.query.part);
  if (!Number.isInteger(n) || n < 0 || n >= parts) return res.status(400).json({ error: 'part' });
  res.setHeader('Content-Type', 'application/octet-stream');
  return res.status(200).send(bytes.subarray(n * PART_BYTES, (n + 1) * PART_BYTES));
}

export default async function handler(req, res) {
  // the page calls this from its own origin, which needs no CORS; the one
  // other origin it answers is a copy of the site on this machine (as
  // api/chat.js does), which has no /api of its own
  const origin = req.headers.origin;
  if (origin && LOCAL_ORIGIN.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-canvas-pass');
    res.setHeader('Access-Control-Expose-Headers', 'x-canvas-model, retry-after');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.GEMINI_API_KEY || !process.env.CANVAS_PASSCODE) {
    console.error('canvas: GEMINI_API_KEY or CANVAS_PASSCODE is not set');
    return res.status(503).json({ error: 'unset', message: 'Live mode is not set up on this deployment' });
  }
  const ip = visitor(req);
  const locked = wait('guess', ip);
  if (locked) return tooMany(res, locked);
  if (!opens(req)) {
    spend('guess', ip);
    return res.status(401).json({ error: 'passcode', message: 'That password does not open a live run' });
  }

  const route = req.query.route;
  try {
    if (route === 'video' && req.method === 'GET') return await video(req, res, ip);
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method' });
    }
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'body' }); }
    }
    if (route === 'unlock') return res.status(204).end();
    if (route === 'image') return await image(req, res, body, ip);
    if (route === 'video') return await startVideo(req, res, body, ip);
    if (route === 'plan') return await plan(req, res, body, ip);
    return res.status(404).json({ error: 'route' });
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError';
    console.error('canvas:', route, timedOut ? 'timed out' : err?.message);
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'slow' : 'gemini',
      message: timedOut ? 'The model took too long to answer' : 'The relay could not reach the model',
    });
  }
}
