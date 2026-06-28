// Vercel serverless proxy to the Anthropic Messages API.
//
// The API key lives ONLY in the ANTHROPIC_API_KEY environment variable on
// Vercel — it is never sent to the browser. The client POSTs a `messages`
// array; we add the system prompt + model server-side and return Claude's
// raw JSON response (so the client reads `data.content[0].text`).

const SYSTEM_PROMPT =
  "You are an AI assistant on Tigo Ponce de León's design portfolio. Tigo is a " +
  "UI/UX designer and frontend engineer, currently interning as a UX Engineer at " +
  "Vicino AI (summer 2026). He is a rising senior at the University of Chicago " +
  "studying Computer Science and Media Arts & Design, graduating in May 2027. His " +
  "projects include PantryPal (AI recipe generator) and Next Level Drone Cleaning " +
  "(Belgian drone startup, full design system). His toolset centers on designing in " +
  "Figma and front-end engineering with HTML, CSS, JavaScript, and React. He's " +
  "originally from Portland, Oregon and outside of work loves soccer — especially " +
  "following Real Madrid. Answer questions about his work, skills, and background " +
  "warmly and concisely. If asked if he's available for hire, say he's open to " +
  "full-time roles starting summer 2027.";

export default async function handler(req, res) {
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
        system: SYSTEM_PROMPT,
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
