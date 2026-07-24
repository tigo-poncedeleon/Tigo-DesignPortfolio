// Site-wide play records — one tiny JSON blob in Vercel Blob storage.
//
// GET  → { records: { pong: {score, initials, at} | null, snake: …, flappy: … } }
// POST { game, score, initials } → { beaten: bool, records }
//   A record only moves forward: the incoming score must beat the stored one.
//   pong counts the longest rally, snake the longest snake, flappy the
//   longest run — the client just sends the number.
//
// Storage: play/records.json in the portfolio-scores public store. The
// BLOB_READ_WRITE_TOKEN env var is provisioned by Vercel; reads fetch the
// blob URL with a cache-busting query so a fresh record is never lost to
// the CDN cache.

import { put, head } from '@vercel/blob';

const GAMES = ['pong', 'snake', 'flappy'];
const PATH = 'play/records.json';
const MAX_SCORE = 9999;

function empty() {
  return { pong: null, snake: null, flappy: null };
}

async function load() {
  try {
    const meta = await head(PATH);
    const res = await fetch(meta.url + '?ts=' + Date.now());
    if (!res.ok) return empty();
    const data = await res.json();
    return { ...empty(), ...data };
  } catch {
    // head() throws when the blob doesn't exist yet — first run
    return empty();
  }
}

async function save(records) {
  await put(PATH, JSON.stringify(records), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
}

export default async function handler(req, res) {
  // Open CORS like api/chat.js: the records are public by nature, and the
  // draft portfolio calls this from localhost while it isn't deployed.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Server is missing BLOB_READ_WRITE_TOKEN' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ records: await load() });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const game = body.game;
  const score = Math.floor(Number(body.score));
  const initials = String(body.initials || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3);

  if (!GAMES.includes(game)) {
    return res.status(400).json({ error: 'Unknown game' });
  }
  if (!Number.isFinite(score) || score < 1 || score > MAX_SCORE) {
    return res.status(400).json({ error: 'Score out of range' });
  }
  if (!initials) {
    return res.status(400).json({ error: 'Initials required' });
  }

  const records = await load();
  const current = records[game];
  if (current && score <= current.score) {
    return res.status(200).json({ beaten: false, records });
  }

  records[game] = { score, initials, at: new Date().toISOString() };
  await save(records);
  return res.status(200).json({ beaten: true, records });
}
