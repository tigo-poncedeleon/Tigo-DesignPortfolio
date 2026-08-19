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
| numbered ruled rows, hairline per row | `.xp-ledger` / `.xp-row` in `css/about.css` |
| date chip over location in the right margin | `.xp-date` / `.xp-loc` |
| name beside role on one baseline | `.about-title` / `.work-title` title pair |
| skill pills | `.craft-chip` |
| contact chips (all three the same grey) | `.xp-date` |

Rules worth keeping if you edit it:

- **No bold.** The site gets hierarchy from size and tone at weight 400, and so
  does this. Employer in `--ink`, role in the quiet `rgba(0,0,0,0.42)`.
- **One page.** Every bullet is written to land on exactly two lines at the
  current measure. `.sheet` has no height cap, so an overflow shows up as a
  real second page rather than silently cropping — `verify.sh` catches it. The
  page is currently ~1042px (Inter) / ~1041px (SF Pro) against a 1056px
  budget — under a line of slack, so any new copy has to displace something.
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
3. **Contact details near the top, in the order a parser expects.** Location
   is the tail of the quiet phrase beside the name — `product design engineer
   — Chicago, IL` — joined by the same em dash that binds every other entity
   to its qualifier on this page. It is one inline run, not a positioned
   element in the corner: that reads as one breath rather than a stranded
   chunk, and it puts the location immediately after the name in the text
   stream, which is where a parser looks. Phone, email, portfolio, and
   LinkedIn follow as chips, in that order. Four chips is what fits on one line in *both* fonts; a fifth wrapped
   the row and cost 26px, which is why location moved up rather than in.
4. **Real spaces at every seam.** Boxes separated only by `gap` or `padding`
   touch in the text stream — the three contact chips came out as
   `tigoponcedeleon.comtigoponcedeleon@uchicago.edulinkedin.com/...`, i.e. no
   findable email address. Each seam now carries a literal `&nbsp;` (an
   anonymous flex item), with the flex `gap` reduced to compensate. Those
   separators are sized by `.contact { font-size: 9px }` — the chips set their
   own size, so that rule reaches only the anonymous items and buys back ~16px
   of row width without touching the chips.
5. **Casing is per-variant**, via `text-transform` — which changes the glyphs
   that get painted and therefore the text in the PDF, so each build gets the
   casing its reader wants. The website keeps the site's lowercase voice
   (`experience` / `education` / `skills`, and `chicago, il` in the header
   tail); the applications build uses `Experience` / `Education` / `Skills`
   and `Chicago, IL`, matching what a parser's section dictionary and location
   gazetteer expect. The HTML holds one canonical casing and the CSS bends it
   per build — never fork the markup for this.
6. **No ligatures, and full dates.** `font-variant-ligatures: none` keeps
   "workflows" from exporting as "workﬂows" (U+FB02) and missing the keyword.
   Date ranges carry the year on both ends — `Jun 2026 - Aug 2026`, not
   `Jun - Aug 2026`, which gives a parser no start year to read.

Chrome keeps the three header links as real PDF link annotations, so the
portfolio, email, and LinkedIn stay clickable in the exported file.
