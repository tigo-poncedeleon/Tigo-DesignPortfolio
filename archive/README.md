# archive

Earlier versions of the portfolio, kept for reference. Nothing in here is
built or served: Vercel's Root Directory is `live-portfolio/`, and the root
`.vercelignore` leaves this folder out of every upload.

| folder | what it was | live |
| --- | --- | --- |
| `v1-old-portfolio/` | the first portfolio: a page each for PantryPal and Next Level, served from GitHub Pages | Aug 2025 – Jul 2026 |
| `v2-live-portfolio/` | the one-page site with the rail, the palettes and the typed header, with its own chat and site-wide game records (`api/scores.js`, kept in Vercel Blob) | 24 Jul – 30 Sep 2026 |
| `v2-og-src/` | the source of v2's link-preview card, `Media/og-card.png` | |
| `v3-draft-explorations/` | "About, eight ways": the scratch page About's direction was chosen from while the current site was still a draft | |

What moved on rather than into here: v2's chat proxy (`api/chat.js`), its
`package.json` and `vercel.json`, and the résumé PDF went into
`live-portfolio/` with the site that replaced it, so `git log --follow` on
those finds their history there. Several of the current site's pictures were
copied from `v2-live-portfolio/Media/`.

The exploration page links the draft's `../css/tokens.css` and
`../favicon.svg`; to see it as it was drawn, copy it back into a folder that
sits beside the site's `css/`.
