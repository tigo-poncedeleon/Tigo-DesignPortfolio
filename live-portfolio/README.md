# live-portfolio

The portfolio at <https://www.tigoponcedeleon.com>, live since 30 September
2026. It began as a draft beside the site before it, built from the Figma file
`MGcQ5N2Mo7NzXIOaaDWPYn`: first the frame "AI-Opening-Screen" (node
`1579:306`), then Home's frame (node `1595:527`). The sites it replaced are in
`../archive/` (its README says which was which).

## How it goes live

- This folder is the Vercel project's Root Directory (the project is
  `tigo-design-portfolio`). A push to `main` on GitHub is a production
  deploy; there is no build step, only `npm install` for the chat's one
  dependency.
- The bare domain redirects to `www.tigoponcedeleon.com`, which is the
  canonical address: every page's `<link rel="canonical">`, `og:url` and the
  sitemap name it.
- The root `.vercelignore` keeps the archive, the résumé's source, this
  README and `tools/` out of the upload; nothing in them is served.
- `vercel.json` sends the old site's addresses on (`work.html`,
  `about.html`, `play.html`, `ai.html`, and its card and icon under `Media/`),
  keeps HTML from being cached stale, and gives the chat 30 seconds.
- Old links into the page itself (`#vicino`, `#bio`, `#pong` and the rest)
  are translated by `js/router.js` into the screens that hold the same thing
  now.

## Running it

```sh
python3 live-portfolio/tools/serve.py
```

Then open <http://localhost:8793>. The server listens on this machine only
(127.0.0.1) and turns caching off, so every reload shows what is on disk.
In Claude Code the same server is the `portfolio` entry in
`.claude/launch.json`. It serves files and nothing else: there is no
`/api` locally, so the chat asks production's (below), and Vercel's redirects
and 404 page only happen there.

Add `?overlay` to the address to lay the Figma render over Home. Press **O**
to show or hide it, and **D** for difference mode, where anything that matches
goes black. Use a 1280×832 window, where one Figma pixel is one CSS pixel.
The render in `tools/figma-home.png` is the first frame's (`1579:306`).

## What it talks to

- **The chat** posts to `api/chat.js`, a Vercel function that calls Claude
  Haiku 4.5 through the Anthropic SDK with the system prompt written there.
  The key is the `ANTHROPIC_API_KEY` environment variable on the Vercel
  project (Production and Preview) and never reaches the browser. The page
  calls its own `/api/chat`; a copy of the site on localhost calls
  production's, which lets localhost in and no other origin. The proxy takes
  only what the chat sends (twenty messages at most, one photo, with the
  newest question) and rebuilds every message before it goes on. The
  composer's mood (friendly, whimsical or suspicious) is its `persona`
  field. A photo goes up as an image block, shrunk to 1200px, which Claude
  can see. The microphone uses the browser's own speech recognition; in
  Chrome that sends the audio to Google, and Safari transcribes on the Mac.
  The facts the chat knows are in the system prompt: change them there.
- **Vercel Web Analytics** counts page views, first-party and cookieless
  (`/_vercel/insights/script.js`, in each page's head). Load any page with
  `?va-ignore=1` once in a browser to stop it counting your own visits, and
  `?va-ignore=0` to start again.
- **The games** talk to nothing. They keep no scores past the one on screen.
  (The site before kept site-wide records in Vercel Blob through
  `api/scores.js`; that is in the archive, and its blob store is still on the
  project, unused.)

## The link previews

Each page's `og:image` is its own card in `assets/og/`: Home itself, and each
case study's opening tile, shot by `tools/og-cards.mjs` from a local server.
Unfurlers cache a card by its address for about a week, so when the art
changes for good, rename the files and the `og:image` tags together.
`apple-touch-icon.png` is the favicon's ink disc on the paper, opaque,
because iOS fills a clear corner with black.

## The pieces

- `index.html` is the one page: four screens down it, Home, Work, Play and
  About, each the height of the window, under a fixed masthead whose headline
  names the screen you are on. The hash follows the screen as you scroll
  (`#`, `#work`, `#play`, `#about`), so a reload comes back to it, and
  `#play/pong`, `#play/snake` or `#play/flappy` opens a game.
- `css/tokens.css` holds every number, in Figma pixels (`--u`), plus the
  springs the motion runs on.
- `js/main.js` boots the page and keeps track of which screen you are on.
- `js/prompt.js` is the composer's field and its block caret, which types
  out a greeting the first time Home is in view and backspaces it away
  again (the textarea's `data-greeting` in `index.html`; change the words
  there). On a phone there is no greeting, only the caret.
- `js/composer.js` is the rest of the pill: mood, microphone, send, and a
  photo pasted or dropped in.
- `js/chat.js` holds the conversation.
- `js/nav.js` is the yellow menu. Its pages open in a row to the left of
  the square, on the name's line, or under the square in a window too
  narrow for that (under 960px wide). On a phone it is back on the
  square's line, and the name, or a screen's title, is wiped away to make
  room for it and drawn back in when it shuts. The page's gutters are 44
  frame pixels, not the frame's 74 and 102, to make room for the row.
- `js/theme.js` turns the page's colours: paper, night, then rose, sky and
  sage, and back to paper, spreading out from where it was pressed. Nothing
  on the page presses it for now; its header says how to hook it back up.
- `js/about.js` is About's foot: the six icons, the line that says where
  each goes, and the email icon, which copies the address.
- `js/play/` holds the engine, the three games, and the stage. Picked up, a
  tile grows into the stage, the same tile made big, and all three games are
  played on one court there, 2:1 (840 × 420 in the games' own units), as
  big as the band allows; on a phone the stage is the whole screen.

## The case studies

A Work tile opens its case study in the same tab: `vicino.html`,
`pantrypal.html` and `nextlevel.html`, each one long page, retold from the
old site's case study in the site's own language (the one size, the lit
tiles, the frosted pills, the chat's bubbles). Each opens on its Work tile
grown to the window, and where the browser can carry a view across pages
the tile itself grows into it, and shrinks home on the way back.

- `css/case.css` is every piece the three pages are built from, and
  `js/case.js` runs them: the menu (the index's own `js/nav.js`), the rise,
  the title pill that names the part you are reading, the ring round the
  back button that fills as the page is read, the steppers, the numbers
  that count up, and the living pieces below.
- Each story is set in one reading column down the middle of the window
  (880 frame pixels, `--col` in `css/case.css`), its words and its tiles
  sharing the column's two edges. Only the opening tile and the two pieces
  of software meant to be used in place (PantryPal's running app, Vicino's
  component browser) step out onto the wider band (`.cs-breakout`).
- Each story opens with its milestones, a row of dates under the
  overview that are also links to their parts, and is told in their
  order: PantryPal from the sketches to the App Store, Vicino from the
  board to the machines drawing on its system, Next Level from Madrid to
  the mark on every surface.
- The work runs on the page wherever it can, instead of being pictured:
  - PantryPal's **"The chef, live"** is the app itself: its Home and
    Recipe screens in its own fonts, colours and drawings, ranking its
    own fifty-dish book against a shelf you stock from the stickers
    beside it (`assets/case/pantrypal/app/pantry-app.js`, fed by
    `js/pantry-demo.js`). The ranking is a port of the app's
    `ChefBook.swift`, rule for rule, and passes the app's own ChefBook
    tests; the screens are drawn from `DishCard.swift` and
    `CookScreen.swift`'s own numbers, and were laid over the app's
    captures and measured to within a point. `tools/pantry-app.sh`
    rebuilds everything the page takes from the app's repository.
  - Vicino's hero board runs when **Run the board** is pressed (the
    replica's own Run). The two ways to build play out as they come into
    view. The brand book and the AI guide are the real pages, reading
    themselves slowly (they hold still under the pointer), and the
    component browser is the real one, to be used in place.
  - Next Level's interview answers as the chat does, after a beat. The
    nine versions of the mark are kept as a design tool keeps them, with
    Sebastien's two notes where he left them, and a slider shrinks the
    last two candidates together to show why the ninth won. The website
    reads itself top to bottom in the rollout.
  - Under reduced motion none of it moves: everything stands in its
    finished state.
- The opt-in to that transition is written inline in each page's head,
  not in a stylesheet: the scripts read computed style as soon as they
  start, and a read before a linked stylesheet has applied made the
  browser drop the transition.
- `canvas.html` is Canvas, the old site's working replica of Vicino's
  node editor (`assets/case/vicino/canvas/`, copied from
  `archive/v2-live-portfolio`, with only its media paths changed). Opened plain, it is the instrument;
  `canvas.html?parked` is the finished board that runs in Vicino's opening
  tile. The board loads Manrope from Google Fonts.
- `vicino-ds/` is the Pulse design system's own documents (the brand book,
  the accent study, the home experiment, the component browser and
  library, the charts, the AI guide), copied unchanged from
  `archive/v2-live-portfolio/vicino-ds/`. Every document window on `vicino.html`
  opens its real file in a new tab, and three of them run it in place
  (above). A few pictures inside them point outside the folder and are
  missing, as they were on the old site.
- `assets/case/` holds each case's pictures, copied from the old site's
  `Media/` and from the work's own repositories. PantryPal's phones are the
  app's latest layout-sweep captures in the iPhone 16 Pro frame from the
  PantryPal repo's App Store lab, and its UX Lab pictures are the lab's
  own prototypes. Next Level's nine versions of the mark come from the
  first portfolio (`archive/v1-old-portfolio/Drone-Media/`), and its long
  website is the brand's site as it is live, captured top to bottom.
- The links to vicino.ai, the App Store, the website and the Pulse review
  go to the real places; nothing on these pages posts anywhere but the chat.

## The photo

About's photo is `assets/me.jpg`, square, 1000px. It is drawn twice: as the
small picture after "Tigo" in About's sentence, cropped in close on the face,
and as the portrait that opens out of it when it is pointed at or focused.
Save a new picture over it to change both.
