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
case study's opening tile, shot by `tools/og-cards.mjs` from a local server
and written to the file the page's `og:image` names (name pages after the
address to bake only those: `vicino pantrypal nextlevel`). Unfurlers cache a
card by its address for about a week, so when the art changes for good, give
the card a new name in its page's `og:image`, bake it, and delete the old
file: the case studies' cards are `-3` since their opening tiles were
redrawn, and then regrouped, in October 2026.
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
- `js/keyboard.js` makes room for a phone's keyboard: while the composer
  has it, Home fits what the keyboard leaves of the window, the composer
  just over it, and the page holds still on Home. It is the old site's
  keyboard lock (`archive/v2-live-portfolio/js/mobile.js`, whose notes say
  what was tried on a phone first), cut down to this page. A tap anywhere
  on Home, the composer's pill included, raises the keyboard.
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
old site's case study in the site's own language (the lit tiles, the
frosted pills, the chat's bubbles), but not at its one size: a case study
is read at a book's sizes, its words at 18.5 frame pixels and a chapter's
first sentence at 26, under chapter titles at 64 and part titles at 36
(`--t-*` in `css/case.css`), and spaced on a handful of distances, each
kept for one meaning, from a caption's 12 to a chapter's 144 (`--air-*`).
Each opens on its Work tile grown to fill the whole
window, edge to edge, and where the browser can carry a view across pages
the tile itself grows into it, its icon travelling on its own to its new
place, and shrinks home on the way back. The masthead carries only the back
button and the menu square: there is no title beside the back button.

The opening tile's words keep to a column on the left: who it is at the
top (the icon, the name, what it is), and at the column's foot the role
and when, and the ways in, the first of them filled with the case's deep
colour. PantryPal's first is Apple's own Download on the App Store badge
(`assets/case/pantrypal/app-store-badge.svg`, the old site's copy of
Apple's file), drawn as Apple draws it. The role and when are dressed in
the case's own product, as the chapters' numbers are: Vicino's are a node
as Canvas draws one, standing on the board's dot grid and wired across
into the board, a spark running the wire (fast while the board runs);
PantryPal's are the app's own Kitchen Pass, its sign-up card, in the
app's two faces; Next Level's stand on a ruled construction line, on the
badge's blue grid, the icon drawn over its rings as the badge is in the
brand book. The work stands beside the words. Canvas runs off the tile's
right edge and its foot, as on the Work tile; the website ends at the
menu square's right edge and runs off the foot; PantryPal's three phones
stand one in front and two behind, and pressing one at the back brings
it to the front (`[data-fan]` in `js/case.js`). Canvas and the website
are ways in as well, and pointed at, a chip trails the pointer across
them saying where they go.

- `css/case.css` is every piece the three pages are built from, and
  `js/case.js` runs them: the menu (the index's own `js/nav.js`), the rise,
  the ring round the back button that fills as the page is read, the rail
  of chapters, the steppers, the numbers that roll up like an odometer, the
  pictures that open out to the window, and the living pieces below. `js/pantry-story.js`
  lays out the pictures PantryPal's story draws from the app's own
  drawings: a hundred foods for the food thrown away, the last thirty
  falling out of the waffle as it rises, and the fifty dishes on one
  plate. PantryPal's brief tells its two facts in pictures (the falling
  waffle, and three of the app's dinners read against a breakfast fridge,
  the few things it holds on white plates and the rest dashed) and ends on
  its question as a line of type, its last words marked in the app's
  butter. Nothing on PantryPal's page is set as a chat: its quotes are a
  house rule and a verdict, each on a rule of the case's colour. The same
  script draws the leader lines that tie the rethink's three findings to
  the places on the old hub they are about.
- PantryPal's story map, the row of chapters under its overview, shows each
  chapter's own artifact in one light, four of them rising out of the
  tile's foot in one phone: the kept sheet as taped paper with its KEPT!
  stamp, the Figma file's own frame, the design system's own parts (drawn
  by PantryPalDS itself, `tools/pantry-parts`), the old hub counted, and
  the scan of the fridge. `tools/pantry-story.sh` bakes all five.
- PantryPal's ideas stand as paper: the Sketch chapter's three wireframes
  and 4.1's four ways out are graph-paper sheets taped to a board, the
  three judged with a rubber stamp and followed by the shelf that shipped,
  the four drawn in the same ink and hand (`tools/pantry-ink.mjs` draws
  them, from the app's own drawings with the colour taken out). The look
  (2.1) is four cards of one make: the palette as a spec, the drawings,
  and the two faces. The Ship chapter opens on the scan's moment, Tigo's
  own fridge taped up behind the phone that took it, and runs the seven
  screens from the front door to a plate in the app's own order, each
  turning over to the prototype's screen at the same step.
- Each story is told in chapters, and every chapter opens the same way:
  its number and when it happened on a hairline, its title, and what it is
  about (`.cs-chapter`); a part of a chapter has a smaller head numbered
  within it (`.cs-part`, 2.1, 2.2). Every part of the story, its head, its
  words and its work, is laid out to be seen together in about one window:
  pictures stand beside the notes that explain them rather than over them.
  The overview before them is named, in the small capitals a label is set
  in, its facts beside its words. Each case numbers them in its own
  product's hand: PantryPal in the app's sticker type, Vicino as nodes on a
  board wired one into the next, Next Level in the badge's ring. A section
  is a chapter when it has an `id` and a `.cs-chapter`, and names its
  chapter in `data-chapter`; the rail (below) is built from them, so the
  list is written once.
- The rail is the page's one sign of where you are: every chapter, down the
  lane's left margin under the back button, the one being read marked, the
  ones before it done, and the count read in its head. It sits in the page
  just after the opening tile, so it comes up from under the tile's foot
  and then holds still (`position: sticky`). Each case dresses it in its
  own product, named by the page's `data-rail`: PantryPal's is the app's
  **Recipe**, its steps the app's own, ticked off, with the chef's hat in
  the step being read; Vicino's is a **Story run** down a pipeline of
  nodes, each queued, running or checked, a spark travelling the wire; Next
  Level's is a **Flight plan** on the badge's blue grid, the badge's drone
  flying it and spraying each chapter clean. Where a pointer can hover it
  stands folded, as narrow as the back button over it: the count, and a
  column of each chapter's mark in the same dress, the runner still going
  from one to the next (the hat in the step's own cell, the spark on the
  wire, the drone on the path). Pointed at, or tabbed into, it opens to its
  names into a margin kept empty for it, so it never reaches the story, and
  folds again a moment after the pointer leaves ("the rail, folded" in
  `css/case.css`). A touch screen, with nothing to hover with, has it open
  in the same margin. On a phone there is no rail.
- The overview ends on the story map, the chapters as a row of tiles each
  holding its own chapter's picture, which are also links to them, and the
  story is told in their order: PantryPal from the sketches to the App
  Store, Vicino from the board to the machines drawing on its system, Next
  Level from Madrid to the mark on every surface.
- Below the opening tile nothing ever slides up under the masthead's
  buttons: the story keeps to the lane between them (`--lane-l`,
  `--lane-r`). On the left the lane starts past the open rail and 48 of air
  (`--rail-open`, `--rail-gap`), whether the rail stands open or folded; on
  the right it ends short of the menu square. The lane is a size container,
  and every piece that lays itself out by its room asks the lane
  (`@container lane`), not the window. The opening tile is the one thing as
  wide as the window, and it is a size container of its own (`hero`): its
  words and its work stand clear of the buttons, beside each other in a
  landscape window and as a poster, the words over the work, in a narrow
  or tall one. A phone has no room for a lane, and keeps to the gutters.
- Each story is set in one column, a channel down the middle of the
  window, 920 frame pixels at the most (`--col`); where centring it would
  leave less than 760 (`--col-min`), it holds at 760 and moves right of the
  middle, its left margin always wide enough for the open rail
  (`--main-pad-r`). Everything in it keeps to the column's two edges: the
  heads, the words, the tiles, the rows read across, the windows onto the
  real files and the software meant to be used in place, on a phone as on
  a desktop. Only the opening tile is wider. The words keep to a reading
  measure by standing in their head (`.cs-chapter`, `.cs-part`), beside its
  name where the column is 660 or wider, five twelfths for the name and
  seven for the words, and under it where it is narrower; the overview,
  the quote rows and the captions keep the same split, so one line runs
  down the page. Each section is a size container (`lane`), so a piece lays
  itself out by the column it stands in: the rows built for a wide column
  step down from 1100 and again from 860, and under 500, a phone's column
  or a window under about 1000, every piece stacks. (Until October 2026
  the words had 640, the work 880, and a few pieces stepped out onto a
  stage of 1192, `.cs-breakout`; then for a day everything kept to 640,
  and for a day it ran the whole lane, up to 1192.)
  PantryPal's running app stands in a card of the app's own kitchen, under
  its awning (`.cs-band`).
- The work runs on the page wherever it can, instead of being pictured:
  - PantryPal's **"The chef, live"** is the app itself: its Home and
    Recipe screens in its own fonts, colours and drawings, ranking its
    own fifty-dish book against a shelf you stock from the stickers
    beside it (`assets/case/pantrypal/app/pantry-app.js`, fed by
    `js/pantry-demo.js`). The ranking is a port of the app's
    `ChefBook.swift`, rule for rule, and passes the app's own ChefBook
    tests; the screens are drawn from `DishCard.swift` and
    `CookScreen.swift`'s own numbers, and were laid over the app's
    captures and measured to within a point: the deck that slides and
    springs back as the app's does, the welcome's falling pile, the
    add-missing chip, the scan and the ticks. Beside it, the shelf is one
    of the app's cards named on the app's own wood planks, its stickers in
    balanced rows whose count stands the card level with the phone; the
    three shelves to start from are words of the sentence that offers them.
    On a phone, where the app has scrolled away above the shelf, what the
    chef decided rides the window's foot while the shelf is read. The app
    writes two dishes for every new shelf of three or more on its own
    server and seats them first, "Made for your shelf"; with no server
    here, the page seats two of the book's own in their place, ones the
    shelf can cook whole, built on what was just added, so the first card
    changes with nearly every change to the shelf, as the app's does.
    `tools/pantry-app.sh` rebuilds everything the page takes from the
    app's repository.
  - Vicino's hero board runs when **Run the board** is pressed (the
    replica's own Run). The two ways to build play out as they come into
    view. The brand book and the AI guide are the real pages, reading
    themselves slowly (they hold still under the pointer), and the
    component browser is the real one, to be used in place.
  - Next Level's interview answers as the chat does, after a beat. The
    nine versions of the mark are kept as a design tool keeps them, with
    Sebastien's two notes where he left them; the badge that shipped is
    drawn over its construction, measured off the shipped file; and a
    slider shrinks the last two candidates together to show why the ninth
    won. The website reads itself top to bottom in the rollout.
  - PantryPal's prototype is a reel the page scrolls through sideways on a
    wide window, and its six shipped screens turn over, one after another,
    to the prototype's screen at the same step.
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
  `Media/` and from the work's own repositories. PantryPal's phones are a
  layout sweep of the 1.3 build (October 2026) in the iPhone 16 Pro frame
  from the PantryPal repo's App Store lab, and its UX Lab pictures are the
  lab's own prototypes, drawn again in ink for 4.1. Next Level's nine versions of the mark come from the
  first portfolio (`archive/v1-old-portfolio/Drone-Media/`), and its long
  website is the brand's site as it is live, captured top to bottom.
- The links to vicino.ai, the App Store, the website and the Pulse review
  go to the real places; nothing on these pages posts anywhere but the chat.

## The photo

About's photo is `assets/me.jpg`, square, 1000px. It is drawn twice: as the
small picture after "Tigo" in About's sentence, cropped in close on the face,
and as the portrait that opens out of it when it is pointed at or focused.
Save a new picture over it to change both.
