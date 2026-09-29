# draft-portfolio

A trial of a new direction for the portfolio, built from the Figma frame
"AI-Opening-Screen" (file `MGcQ5N2Mo7NzXIOaaDWPYn`, node `1579:306`). It lives
on this Mac only. It is **not** the live site, and nothing here is deployed.

## Why it cannot go live

- Vercel builds only `live-portfolio/`, which is the project's Root
  Directory. This folder is a sibling of it, so Vercel never serves it.
- It is also listed in the root `.vercelignore`, so a CLI deploy run from the
  repo root does not even upload it.
- Its commits stay on local `main` and are not pushed.
- The page carries `noindex, nofollow`, in case it is ever served somewhere
  by mistake.

Nothing under `live-portfolio/` is changed by this work. Making the draft live
is a decision to take on purpose, later.

## Running it

```sh
python3 draft-portfolio/tools/serve.py
```

Then open <http://localhost:8793>. The server listens on this machine only
(127.0.0.1) and turns caching off, so every reload shows what is on disk.
In Claude Code the same server is the `draft-portfolio` entry in
`.claude/launch.json`.

Add `?overlay` to the address to lay the Figma render over Home. Press **O**
to show or hide it, and **D** for difference mode, where anything that matches
goes black. Use a 1280×832 window, where one Figma pixel is one CSS pixel.

## What it talks to

- **The chat** posts to the live site's own proxy,
  `https://tigo-design-portfolio.vercel.app/api/chat`: the same Claude Haiku,
  with the same system prompt. The proxy answers any origin; its CORS comment
  expects a draft on localhost to call it directly. Each question is one
  model call on the live key, as a visitor's would be. The composer's mood
  (friendly, whimsical or suspicious) is the proxy's own `persona` field. A
  photo goes up as an image block, shrunk to 1200px, which Claude can see.
  The microphone uses the browser's own speech recognition; in Chrome that
  sends the audio to Google, and Safari transcribes on the Mac.
- **The games** keep their best scores in this browser's `localStorage`
  (`draft.best.*`). They never call the live `/api/scores`, because a post
  from here would change the live site's records.

## The pieces

- `index.html` is the one page. The routes are hashes: `#`, `#work`, `#play`,
  `#about`, and `#play/pong`, `#play/snake` or `#play/flappy` for an open
  game.
- `css/tokens.css` holds every number, in Figma pixels (`--u`), plus the
  springs the motion runs on.
- `js/main.js` boots the page and runs page changes.
- `js/prompt.js` is the composer's field and its block caret.
- `js/composer.js` is the rest of the pill: photo, mood, microphone, send.
- `js/chat.js` holds the conversation.
- `js/nav.js` is the yellow menu.
- `js/play/` holds the engine, the three games, and the stage.

## Adding a photo

Save it as `assets/me.jpg` and it replaces the About placeholder. Until the
file exists, the browser console shows one harmless 404 for it, once you
visit About.
