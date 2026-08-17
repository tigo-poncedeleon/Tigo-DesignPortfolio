# og-src

`og.html` is the source for **live-portfolio/Media/og-card.png** — the 1200×630
link preview that LinkedIn, iMessage, Slack and X unfurl for every page that
declares `og:image` (index, vicino, pantrypal, nextlevel).

Like `resume-src/`, it is deliberately not part of the site: Vercel's Root
Directory is `live-portfolio/`, so nothing in here is served. Only the baked PNG
ships.

## Re-baking

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 \
  --screenshot="$PWD/live-portfolio/Media/og-card.png" \
  "file://$PWD/og-src/og.html"
```

`--force-device-scale-factor=1` matters: at 2 the shot comes out 2400×1260 and
disagrees with the `og:image:width`/`height` the heads promise.

## Why it looks the way it does

Nothing on the card is invented — it is the home header with the chrome taken
away:

| card | comes from |
| --- | --- |
| #f6f6f6 canvas, SF Pro at weight 400 | `html, body` in `css/styles.css` |
| name over role, same size, role at 34% ink | `.frame-name` / `.frame-role` |
| the ember bar after the role | the caret that types the header (`js/typewriter.js`) |

Rules worth keeping if you edit it:

- **No portrait.** The stipple face was the old card's subject; the name is the
  subject now. It also survives being shown at 120px wide in a chat sidebar,
  which a halftone face does not.
- **One hue.** Ember is the site's object colour and belongs to the four small
  things that move. The frozen caret is the first of them; a second colour on
  this card would break the same rule the sheets keep.
- **No bold.** Hierarchy comes from tone, exactly as it does on the site.

## Cache note

Unfurlers cache by image URL, so a redesign that keeps the old filename can sit
behind a stale preview for about a week. That is why this one shipped as
`og-card.png` rather than overwriting `og.png`. If the art changes again, bump
the filename and update the four `og:image` tags together.
