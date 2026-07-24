---
name: portfolio-inspiration
description: Use when the user gives one or more portfolio/website URLs and wants design inspiration, pattern extraction, or ideas applied to their own site. Captures full-page screenshots of each URL, then analyzes typography, layout rhythm, hover/interaction states, and case-study structure to extract reusable patterns.
---

# Portfolio Inspiration

## When to use this skill
Trigger when the user shares one or more URLs (portfolio sites, competitor sites, design references) and asks for inspiration, ideas, or wants patterns pulled out and applied to their own project.

## Workflow

1. **Capture screenshots.** For each URL provided, run:
   ```
   node scripts/screenshot.mjs "<url>" "/tmp/inspo-<n>.png" 1440
   ```
   This produces a full-page PNG (scrolled, lazy-load triggered, retina res).
   If a site is very tall (long scrolling portfolio), that's fine — the script captures the whole thing in one image.

2. **View each screenshot** using the view tool immediately after capture, so the image is in context.

3. **Analyze across all sites together, not one at a time.** Look specifically at:
   - Typography: type pairing, scale, weight contrast, use of display vs. body fonts
   - Layout rhythm: grid structure, whitespace, section pacing
   - Navigation pattern: sticky nav, hidden nav, scroll-triggered reveal
   - Hero treatment: how they introduce themselves/the work
   - Case study / project structure: how work is presented (grid, list, full-bleed, hover previews)
   - Micro-interactions implied by the screenshot: hover states, cursor treatments, transitions (note these are inferred, not directly visible in a static image — flag this)
   - Color and contrast approach

4. **Synthesize, don't just describe.** Output a short list of 3-5 concrete, adaptable patterns (not "they use nice typography" but "large serif display headline at ~120px paired with a small monospace label above it, common across 3 of these sites").

5. **If the user has their own repo/site open**, propose how 2-3 of the strongest patterns could be adapted to their existing design system, referencing their actual components/CSS where possible rather than generic advice.

## Setup (one-time, before first use)
```
npm install playwright
npx playwright install chromium
```

## Notes
- This captures static visual state only. It won't capture scroll-triggered animations, hover states, or JS-driven interactions directly — Claude should infer likely interaction patterns from context (cursor styles, transition hints in code if the site's source is inspectable) and say so.
- For sites that block headless browsers or require auth, this will fail — fall back to asking the user for a manual screenshot instead.
