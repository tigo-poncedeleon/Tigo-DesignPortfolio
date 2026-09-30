// Vercel serverless proxy to the Claude API, for the chat on Home.
//
// The key lives ONLY in the ANTHROPIC_API_KEY environment variable on Vercel
// (Production and Preview); it never reaches the browser. The page POSTs
// { messages, persona } and gets back { content: [{ type: 'text', text }] },
// the shape the page reads (js/chat.js: data.content[0].text), and the shape
// the API's own answer has, so a client written against either still works.
//
// It is a public endpoint that spends money, so it takes what the page's chat
// sends and nothing else:
//   messages   at most twenty, a question first and a question last, each
//              one words (8,000 characters at most, 40,000 in all) or, for
//              the newest question only, one photo (JPEG, PNG, WebP or GIF,
//              base64, about 2 MB at most) with its words
//   persona    one of three words, whitelisted; anything else is the house
//              voice
// Every message is rebuilt from those fields before it goes upstream, so a
// client cannot slip a system turn, a tool or a cache instruction through.
// (The page's chat sends nineteen messages at most and one photo; the first
// cut of this proxy forwarded whatever arrived.)
//
// The page calls it from its own origin, which needs no CORS at all. The one
// cross-origin caller it answers is a copy of the site on this machine
// (http://localhost or 127.0.0.1, any port), which has no /api of its own and
// calls production instead (js/chat.js). (It answered every origin while the
// draft was built beside the old site, which let any page anywhere spend the
// key from a visitor's browser.)
//
// The model is Claude Haiku 4.5, as it has been since the chat began: the
// answers are a couple of sentences about one person, and it answers them
// fast. The SDK retries a rate limit or an overload twice before giving up.

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 1024;
const MAX_MESSAGES = 20;
const MAX_TEXT = 8000;
const MAX_TOTAL_TEXT = 40000;
const MAX_IMAGE_BASE64 = 3000000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

const SYSTEM_PROMPT =
  "You are an AI assistant on Tigo Ponce de León's design portfolio. Answer " +
  "questions about him warmly and concisely — a couple of short sentences unless " +
  "more is clearly wanted. Never use markdown formatting. Only state facts given " +
  "here; if you are asked something about him these notes don't cover, say you " +
  "don't know and suggest emailing him.\n\n" +
  "WHO HE IS: Tigo is a product design engineer from Portland, Oregon, now in " +
  "Chicago studying Media Arts & Design and Computer Science at the University " +
  "of Chicago, graduating Spring 2027. He believes software should be both " +
  "useful and pleasurable, and that every design decision should serve that. He " +
  "sees AI as the defining technology of this age and wants to help shape it.\n\n" +
  "EXPERIENCE: Product Designer of PantryPal, from November 2025 to now — an " +
  "iPhone app that turns the ingredients you already have into dinner: scan a " +
  "receipt or your fridge and it opens on one dish, ranked against your shelf. " +
  "He designed and built it end to end, from wireframes and a Figma prototype to " +
  "a SwiftUI app with its own design system and a small AI service on Vercel " +
  "(Gemini reads the receipts and writes new dishes), and it is live on the App " +
  "Store. UX Engineer Intern at Vicino AI in Bellevue, WA, June to August 2026 " +
  "(the internship has ended): he helped build Canvas, Vicino's node editor where " +
  "every AI generation step is a node, from the ground up; helped create the " +
  "design system behind Pulse, its marketing-analytics side (356 tokens in one " +
  "file, 62 components); and helped write the guide that teaches AI agents to " +
  "design inside that system, which then redrew Pulse's eighteen-screen " +
  "onboarding. Founding Designer for Next Level Drone Cleaning, July to September " +
  "2025 — the complete brand identity (nine versions of the mark, three " +
  "colorways) and its rollout across the website, socials and apparel, for a " +
  "Belgian drone-cleaning startup in Kortrijk, after meeting its founder " +
  "Sebastien on a night out in Madrid. UX Researcher at UChicago, autumn 2025 — " +
  "studied interface homogenization across six AI-generated web apps.\n\n" +
  "SKILLS: Figma and Adobe Creative Cloud for design; HTML/CSS/JS, Swift and " +
  "SwiftUI, React, Python, C#, and Git for code; user research, wireframing, " +
  "interaction design, MVP scoping, usability testing. English fluent, Spanish " +
  "professional — he spent summer 2025 in Madrid on a Foreign Language " +
  "Acquisition Grant from UChicago.\n\n" +
  "TRAVEL & PLACES: grew up in Portland, Oregon; lives in Chicago; studied in " +
  "Madrid (a favorite memory: summer nights out near the Templo de Debod); and " +
  "spent summer 2026 in Bellevue, WA, interning at Vicino AI.\n\n" +
  "TASTE: A film lover (Letterboxd regular) — his four favorites are Y Tu Mamá " +
  "También, Drive My Car, Mulholland Drive, and Paris, Texas; he leans toward " +
  "arthouse directors like Wenders, Lynch, Cuarón, and Hamaguchi. A steady " +
  "reader (Goodreads too) with a Murakami streak — The Wind-Up Bird Chronicle, " +
  "Norwegian Wood, Kafka on the Shore — plus Stories of Your Life and Others " +
  "by Ted Chiang, The Fire Next Time by James Baldwin, This Is Water by David " +
  "Foster Wallace, Call Me By Your Name, Freakonomics, Escape from Freedom, " +
  "and the graphic novel Daytripper.\n\n" +
  "OUTSIDE WORK: bike rides along Lake Michigan, soccer — he's a devoted Real " +
  "Madrid fan — and hanging out with friends. He built this portfolio himself: " +
  "hand-written HTML, CSS and JavaScript with no framework, designed in Figma. " +
  "Its Play screen has working Pong, Snake and Flappy Bird, each case study runs " +
  "its work on the page (PantryPal's own recipe ranking, Vicino's canvas), and " +
  "this chat runs on Claude through a small Vercel proxy.\n\n" +
  "HIRING: open to full-time product design / design engineering roles " +
  "starting summer 2027. Contact: tigoponcedeleon@gmail.com.";

// The chat's mood toggle. The client sends one of these three words with
// each request; anything else falls back to friendly. Every mood keeps the
// facts straight and the answers short — only the voice changes.
const PERSONAS = {
  friendly: '',
  whimsical:
    'TONE FOR THIS CONVERSATION: whimsical. Answer with a light, playful ' +
    'touch — a small flourish, an unexpected image, a wink — while keeping ' +
    'every fact accurate and every answer just as short. Never let the whimsy ' +
    'bury the information, and still never use markdown.',
  suspicious:
    'TONE FOR THIS CONVERSATION: comically suspicious. Answer like a wary ' +
    'noir detective who finds every question just a little too convenient — ' +
    'side-eye the asker, mutter about what they might really be after — but ' +
    'ALWAYS still give the full, accurate answer, just as short as ever. The ' +
    'suspicion is a bit, never an excuse to withhold. Still never use markdown.',
};

// A client is made once per warm instance, and only once there is a key to
// make it with.
let client = null;

// The conversation, rebuilt from the fields the page sends, or a reason it
// was turned away.
function cleanMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return { error: 'No messages' };
  if (messages.length > MAX_MESSAGES) return { error: 'Too many messages' };
  let total = 0;
  const out = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const last = i === messages.length - 1;
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return { error: 'Unknown role' };
    if (typeof m.content === 'string') {
      const text = m.content.trim();
      if (!text) return { error: 'Empty message' };
      if (text.length > MAX_TEXT) return { error: 'Message too long' };
      total += text.length;
      out.push({ role: m.role, content: text });
      continue;
    }
    // blocks: words, and one photo, only on the newest question
    if (!Array.isArray(m.content) || m.content.length === 0 || m.content.length > 2) {
      return { error: 'Unreadable message' };
    }
    const blocks = [];
    let images = 0;
    for (const b of m.content) {
      if (b && b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
        const text = b.text.trim();
        if (text.length > MAX_TEXT) return { error: 'Message too long' };
        total += text.length;
        blocks.push({ type: 'text', text });
      } else if (b && b.type === 'image' && b.source && b.source.type === 'base64') {
        const { media_type: type, data } = b.source;
        if (!last || m.role !== 'user' || ++images > 1) return { error: 'Photo out of place' };
        if (!IMAGE_TYPES.includes(type)) return { error: 'Unsupported photo' };
        if (typeof data !== 'string' || !data || data.length > MAX_IMAGE_BASE64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
          return { error: 'Unreadable photo' };
        }
        blocks.push({ type: 'image', source: { type: 'base64', media_type: type, data } });
      } else {
        return { error: 'Unreadable message' };
      }
    }
    if (!blocks.length) return { error: 'Empty message' };
    out.push({ role: m.role, content: blocks });
  }
  if (total > MAX_TOTAL_TEXT) return { error: 'Conversation too long' };
  if (out[0].role !== 'user' || out[out.length - 1].role !== 'user') {
    return { error: 'A conversation starts and ends on a question' };
  }
  return { messages: out };
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && LOCAL_ORIGIN.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('chat: ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'The chat is not set up' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const cleaned = cleanMessages(body && body.messages);
  if (cleaned.error) {
    return res.status(400).json({ error: cleaned.error });
  }

  // the mood is whitelisted here, never interpolated from the client — an
  // unknown word simply means the house voice
  const tone = PERSONAS[body && body.persona] || '';
  const system = tone ? SYSTEM_PROMPT + '\n\n' + tone : SYSTEM_PROMPT;

  try {
    client ??= new Anthropic({ maxRetries: 2, timeout: 15000 });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: cleaned.messages,
    });
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    if (!text) {
      console.error('chat: no text in the answer', message.stop_reason);
      return res.status(502).json({ error: 'The chat had nothing to say' });
    }
    return res.status(200).json({
      content: [{ type: 'text', text }],
      stop_reason: message.stop_reason,
    });
  } catch (err) {
    // Most specific first. The page only needs to know that it failed (it
    // offers the question again); the detail goes to the function's log.
    if (err instanceof Anthropic.RateLimitError) {
      console.error('chat: rate limited', err.message);
      return res.status(429).json({ error: 'The chat is busy. Try again in a moment.' });
    }
    if (err instanceof Anthropic.BadRequestError) {
      console.error('chat: the API turned the request down', err.message);
      return res.status(400).json({ error: 'The chat could not read that' });
    }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error('chat: the key was refused', err.status, err.message);
      return res.status(500).json({ error: 'The chat is not set up' });
    }
    if (err instanceof Anthropic.APIConnectionError) {
      console.error('chat: could not reach the API', err.message);
      return res.status(504).json({ error: 'The chat could not be reached' });
    }
    if (err instanceof Anthropic.APIError) {
      console.error('chat: API error', err.status, err.message);
      return res.status(503).json({ error: 'The chat is unavailable. Try again in a moment.' });
    }
    console.error('chat: unexpected', err);
    return res.status(500).json({ error: 'The chat failed' });
  }
}
