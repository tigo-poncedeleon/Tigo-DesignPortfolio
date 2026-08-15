# resume-src

`resume.html` is the source for **live-portfolio/PoncedeLeon-Resume.pdf** — the
one-page resume the about page links to.

It is deliberately not part of the site: Vercel's Root Directory is
`live-portfolio/`, so nothing in here is ever served (and `.vercelignore` skips
it on upload too). Only the rendered PDF ships.

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

Two rules worth keeping if you edit it:

- **No bold.** The site gets hierarchy from size and tone at weight 400, and so
  does this. Employer in `--ink`, role in the quiet `rgba(0,0,0,0.42)`.
- **One page.** Every bullet is written to land on exactly two lines at the
  current measure. If you add copy, check nothing spills to a second page —
  `.sheet` has no height cap, so an overflow shows up as a real second page
  rather than silently cropping.

## Re-rendering

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer \
  --run-all-compositor-stages-before-draw --virtual-time-budget=3000 \
  --print-to-pdf="live-portfolio/PoncedeLeon-Resume.pdf" \
  "file://$PWD/resume-src/resume.html"
```

Chrome keeps the three header links as real PDF link annotations, so the
portfolio, email, and LinkedIn stay clickable in the exported file.
