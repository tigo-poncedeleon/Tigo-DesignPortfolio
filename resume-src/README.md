# resume-src

`resume.html` renders **two** one-page PDFs, because the two audiences want
opposite things:

| build | file | font | for |
| --- | --- | --- | --- |
| `?v=sf` | `live-portfolio/PoncedeLeon-Resume.pdf` | SF Pro | the website — people |
| default | `resume-src/PoncedeLeon-CV.pdf` | Inter | job applications — scanners |

Same content, same layout, one source file. The variant is chosen by a query
string that a tiny inline script turns into `data-variant="sf"` on `<html>`.

**The split exists because Chrome cannot embed Apple's fonts.** The SF Pro
build therefore has *no text layer at all* — every glyph is a Type 3 drawing,
so you cannot select or copy text out of it and a scanner reads nothing. That
is an acceptable trade for the copy a human opens from the site, and a
disqualifying one for the copy an employer's ATS ingests. **Never send the
website copy to an employer.** `resume-src/PoncedeLeon-CV.pdf` is the one that
goes out; a copy also lives at `~/Downloads/PoncedeLeon-CV.pdf`.

`resume-src/` is deliberately not part of the site: Vercel's Root Directory is
`live-portfolio/`, so nothing in here is ever served (and `.vercelignore` skips
it on upload too). Only `PoncedeLeon-Resume.pdf` ships.

## Re-rendering and checking

```sh
sh resume-src/verify.sh
```

That renders **both** PDFs, stamps their document metadata, checks each one,
and prints the text a scanner reads out of the applications copy. It is the
only entry point you need. **Run it after every edit** and actually read the
extracted text — it is the only way to see what an ATS gets.

A good run reports one page for both, `Type3` for the website copy (expected,
with the "no text layer by design" note), `Type0 / Inter-Regular` for the
applications copy, and text that reads top to bottom in document order with
each job's bullets directly under that job. Any real problem prints `FAIL`
and exits non-zero.

The helpers: `check.py` inspects one PDF, `stamp.py` adds Title/Author/
Subject/Keywords via a PDF incremental update (Chrome writes none of those),
and `pdftext.py` is a small PDF text extractor written for this repo because
there is no poppler / pdftotext / pymupdf on this machine.

## Why it looks the way it does

The page is the portfolio's own design language on Letter paper — nothing here
is invented:

| resume | comes from |
| --- | --- |
| ruled rows, hairline per row | `.xp-ledger` / `.xp-row` in `css/about.css` |
| date over location in the right margin | `.xp-date` / `.xp-loc` |
| name beside role on one baseline | `.about-title` / `.work-title` title pair |
| small tracked caps over a heavier rule | `.board-eyebrow` (`nextlevel.css`), `.accept-label` (`vicino.css`) |

**Nothing on this page is chipped any more.** The row numerals and the date and
skill pills came off on 2026-09-01, and the contact row followed the same day —
with the pills gone it was the loudest object on the page and was competing with
the section labels. Dates are quiet margin text, skills are comma-set runs, and
contact is one middot-separated line.

### The two rule weights

That flattening left the page as a single uniform stack of `#e3e3e3` hairlines
with no entry points — the label above a section was drawn with the exact same
line as every row inside it, and at `rgba(0,0,0,.42)` it was the *lightest* text
on a page whose body copy is `#5e5e5e`. The fix is two tokens, and keeping them
apart is the whole navigation system:

| token | value | draws |
| --- | --- | --- |
| `--rule` | `#ededed` | every row and craft hairline |
| `--rule-strong` | `#b0b0b0` | **only** the line under a section label |

Never draw a row with `--rule-strong`; there are exactly three strong rules on
the page and they are the three things the eye is meant to find first.

### The masthead

Two lines and nothing else: `Santiago (Tigo) Ponce de León` with the role beside
it, then one middot-separated contact run. There is **no summary line** — the
user cut it on 2026-09-01, so the page opens on the name and goes straight to
education.

Three sizes, settled by eye against the user's own read: **24 / 15 / 12.6px**.
Each one moved for a reason, and all three were wrong at some point on
2026-09-01:

- The name was tried at 28px and read as too big. 24 is the ceiling here.
- The role was `rgba(0,0,0,0.3)` — 2.1:1, the faintest text on the sheet, which
  is a strange place to put the two words the page is arguing for. It sits at
  `--role` now, where every other job title on the page already lived.
- The contact run was 11.6px, *smaller* than the 12.2px body copy. It is the
  one line a reader is meant to act on, so it now sits a step above body at
  12.6px.

**There is no em dash between name and role**, unlike every row below. The rows
need one because employer and role are set at nearly the same size and would run
together; the masthead does not, because 24px against 15px already reads as two
things. A dash was tried there and the user cut it. What separates them instead
is the 18px `gap` (≈22px with the `&nbsp;`) — that gap *is* the separator, so
don't quietly tighten it back to a normal one.

`.head` is `white-space: nowrap`, so the pair is one line or it is broken —
**a longer role title overflows the sheet silently instead of wrapping.**
Measured 2026-09-01: the title line uses 562px of 704 in Inter (522 in SF Pro)
and the contact run 654px (646 in SF). The contact line is the binding one —
about four characters of headroom before it wraps and costs a row.

### The ink ladder

Four steps, measured against the `#fdfdfd` ground. Anything that reads as
navigation belongs at 4.9:1 or darker — `--meta` is for locations and nothing
else:

| tier | token | ratio |
| --- | --- | --- |
| name, section labels, employers | `--ink` / `--co` `#404040` | 10.2:1 |
| body, bullets, dates | `--body` `#5e5e5e` | 6.4:1 |
| job titles, skills sub-labels | `--role` `#6f6f6f` | 4.9:1 |
| locations | `--meta` `rgba(0,0,0,.42)` | 3.0:1 |

The name used to sit in `--body`, one step *lighter* than the employers listed
under it, and the bullet dot used to be `rgba(0,0,0,.28)` — 1.8:1, which is
simply not there at 3.4px on paper.

Rules worth keeping if you edit it:

- **No bold.** The site gets hierarchy from size and tone at weight 400, and so
  does this. Employer in `--ink`, role in the quiet `rgba(0,0,0,0.42)`.
- **One page.** Every bullet is written to land on exactly two lines at the
  current measure. `.sheet` has no height cap, so an overflow shows up as a
  real second page rather than silently cropping — `verify.sh` catches it. The
  page is currently ~1001px (Inter) / ~993px (SF Pro) against a 1056px budget
  — about three lines of slack (measured 2026-09-01). The section air added
  that day was paid for by unchipping the contact row and merging PantryPal's
  fourth bullet into its third; cutting the summary line freed the rest.
  **Check both variants**: the fonts have different metrics, and copy that
  fits in Inter can overflow in SF Pro. `verify.sh` builds and checks both,
  and keeps going if one fails so a break can't hide behind a break.

## The ATS rules

The PDF is read by machines before it is read by anyone. Four properties of
this file are load-bearing, and all four are easy to break by accident — the
long comment at the top of `resume.html` repeats them where they apply.

1. **A real font file, never a system font.** `system-ui` / `-apple-system` /
   SF Pro cannot be embedded, so Chrome exports every glyph as a **Type 3
   drawn procedure**: the PDF ends up with no actual font, and scanners that
   don't chase the ToUnicode map read nothing at all. This was measured for
   every SF variant on this machine, including the real `SF-Pro-Text-*.otf`
   files in `/Library/Fonts` — Apple's fonts refuse embedding, so **there is
   no way to keep SF Pro on this page and stay machine-readable.** The page
   ships its own **Inter** (`fonts/Inter-Regular.woff2`, SIL Open Font
   License, latin subset from Google Fonts) so the render is self-contained
   and works offline. It exports as an embedded **Type 0** font. `verify.sh`
   fails loudly both on Type 3 and on Inter failing to load and silently
   falling back. The website build opts out of this rule on purpose, and only
   because no scanner will ever see it.
2. **Nothing positioned.** PDF text comes out in *paint* order, and positioned
   boxes paint after everything else. The bullet dot used to be an
   `position: absolute` pseudo-element on a `position: relative` `<li>`, which
   pushed **every bullet on the resume to the end of the document**, detached
   from the job it described. The dot is now an in-flow `inline-block`. Never
   add `position` or flex `order` to anything carrying text.
3. **Contact details near the top, in the order a parser expects.** Phone,
   email, portfolio, and LinkedIn, as chips, in that order. Four chips is what
   fits on one line in *both* fonts; a fifth wraps the row and costs 26px.
   The header carries no city (the user cut it on 2026-09-01) — the location a
   gazetteer wants is `Chicago, IL` in the right margin of the education row
   and of two experience rows, which is early enough in the text stream.
4. **Real spaces at every seam.** Boxes separated only by `gap` or `padding`
   touch in the text stream — the contact row once came out as
   `tigoponcedeleon.comtigoponcedeleon@uchicago.edulinkedin.com/...`, i.e. no
   findable email address. Each seam carries `&nbsp;&middot;&nbsp;`, so a real
   space lands on both sides of the separator whatever the layout does. Keep
   the `&nbsp;` even though the middot is now visible — the middot alone is a
   glyph, not a space.
5. **Section labels are tracked caps, and the tracking is capped by the text
   extractor.** Both builds now render `EDUCATION` / `EXPERIENCE` / `SKILLS` in
   uppercase — the old per-variant casing rule is gone. The label is *smaller*
   than the body it introduces (10.5px against 12.2px) and stands out by shape
   and by the heavier rule beneath it, which is what lets the no-bold rule
   stand.

   **The `letter-spacing` value is load-bearing and cannot be raised blind.**
   Chrome writes letter-spaced text as individually positioned glyphs, and a
   PDF extractor inserts a space as soon as the gap passes roughly 25% of a
   space width. Push the tracking too far and `EXPERIENCE` comes back out of
   the PDF as `E X P E R I E N C E`, which matches no parser's section
   dictionary — a silent, invisible break that only shows up in the extracted
   text. `0.12em` at 10.5px was measured through `verify.sh` and extracts
   clean. If you raise it, re-read the extracted text; if it splits, walk down
   `0.09em` → `0.06em` → `0.04em` → none. The casing, ink, rule weight, and
   air do the work anyway — tracking is the nice-to-have.
6. **No ligatures, and full dates.** `font-variant-ligatures: none` keeps
   "workflows" from exporting as "workﬂows" (U+FB02) and missing the keyword.
   Date ranges carry the year on both ends — `Jun 2026 - Aug 2026`, not
   `Jun - Aug 2026`, which gives a parser no start year to read.

Chrome keeps the three header links as real PDF link annotations, so the
portfolio, email, and LinkedIn stay clickable in the exported file.
