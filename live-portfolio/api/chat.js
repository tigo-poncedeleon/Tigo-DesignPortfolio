// Vercel serverless proxy to the Anthropic Messages API.
//
// The API key lives ONLY in the ANTHROPIC_API_KEY environment variable on
// Vercel — it is never sent to the browser. The client POSTs a `messages`
// array; we add the system prompt + model server-side and return Claude's
// raw JSON response (so the client reads `data.content[0].text`).

const SYSTEM_PROMPT =
  "You are an AI assistant on Tigo Ponce de León's design portfolio. Answer " +
  "questions about him warmly and concisely — a couple of short sentences unless " +
  "more is clearly wanted. Never use markdown formatting.\n\n" +
  "WHO HE IS: Tigo is a product design engineer from Portland, Oregon, now in " +
  "Chicago studying Media Arts & Design and Computer Science at the University " +
  "of Chicago, graduating Spring 2027. He believes software should be both " +
  "useful and pleasurable, and that every design decision should serve that. He " +
  "sees AI as the defining technology of this age and wants to help shape it.\n\n" +
  "EXPERIENCE: UX Engineer Intern at Vicino AI, summer 2026 in Bellevue, WA — " +
  "agentic workflows for an AI marketing generation and analytics platform, " +
  "plus a Figma-to-React component library. Product Designer of PantryPal, winter 2025–26 — an " +
  "end-to-end AI recipe app (computer vision stocks your digital pantry, a " +
  "recipe engine runs on a live Gemini API); task completion rose 40% across " +
  "testing rounds. Founding Visual Designer for Next Level Drone Cleaning, " +
  "summer 2025 — complete brand identity (nine logo iterations) and marketing " +
  "presence for a Belgian drone-cleaning startup in Kortrijk, after meeting its " +
  "founder Sebastien on a night out in Madrid. UX Researcher at UChicago, " +
  "autumn 2025 — studied interface homogenization across six AI-generated web " +
  "apps.\n\n" +
  "SKILLS: Figma and Adobe Creative Cloud for design; HTML/CSS/JS, Python, C#, " +
  "and Git for code; user research, wireframing, interaction design, MVP " +
  "scoping, usability testing. English fluent, Spanish professional — he spent " +
  "summer 2025 in Madrid on a Foreign Language Acquisition Grant from UChicago.\n\n" +
  "TRAVEL & PLACES: grew up in Portland, Oregon; lives in Chicago; studied in " +
  "Madrid (a favorite memory: summer nights out near the Templo de Debod); " +
  "heads to Bellevue, WA for summer 2026.\n\n" +
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
  "hand-written HTML/CSS/JS, zero dependencies, designed in Figma; the play " +
  "page has working Pong, Snake, and Flappy Bird with site-wide high scores, " +
  "and this chat runs on Claude through a small Vercel proxy.\n\n" +
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

export default async function handler(req, res) {
  // CORS: the proxy serves the deployed site AND local/dev copies of the
  // portfolio (draft-portfolio runs on localhost and calls this URL directly).
  // The key never leaves the server, so an open origin only exposes what the
  // public chat already answers.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const messages = body && body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Request body must include a non-empty "messages" array' });
  }

  // the mood is whitelisted here, never interpolated from the client — an
  // unknown word simply means the house voice
  const tone = PERSONAS[body && body.persona] || '';
  const system = tone ? SYSTEM_PROMPT + '\n\n' + tone : SYSTEM_PROMPT;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system,
        messages,
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      // Forward Anthropic's status and error payload for easier debugging.
      return res.status(upstream.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach the Anthropic API', detail: String(err) });
  }
}
