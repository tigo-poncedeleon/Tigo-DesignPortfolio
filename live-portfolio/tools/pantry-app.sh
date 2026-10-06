#!/usr/bin/env bash
# pantry-app.sh — rebuild what PantryPal's case study takes from the app.
#
#     live-portfolio/tools/pantry-app.sh              # from ~/Developer/PantryPal
#     PANTRYPAL=/path/to/PantryPal live-portfolio/tools/pantry-app.sh
#
# The case study runs the app's Home and Recipe screens on the page
# (assets/case/pantrypal/app/pantry-app.js), and shows the app on phones.
# Everything it needs is lifted from the app's own repository, never drawn
# again by hand, and this is the one place that lifting is written down, so
# that when the app changes the page can follow it:
#
#   app/fonts/      the two faces, as the design system bundles them
#   app/chefbook.json
#                   the fifty bundled dishes, as the app ranks them
#   app/art/        each of those dishes, and every ingredient they name,
#                   from the app's bundled drawings: dishes at 400 wide,
#                   ingredients at 192 (a sticker is never drawn bigger)
#   app/frame.webp  Tigo's iPhone 16 Pro render, the App Store lab's
#   app/chrome-*    the header and each title band, cropped from the App
#                   Store lab's captures, which pin the status bar at 9:41
#                   with full bars: the wordmark, the chef and the scallops
#                   are drawn art, so the replica wears the real pixels
#                   (the welcome's from the sweep's empty shelf, under the
#                   lab's 9:41 bar; its pile and its buttons are drawn live)
#   app/rule.webp   the design system's fuzzy rule, one strip of it
#   app/plank.webp  the shelf's wood (ShelfScreen's WoodShelfHeader), the
#                   middle of the app's tab-wood texture, groove and all,
#                   for the planks that name the case study's shelves
#   app/hat.webp    the rank badge's hat
#   phones/         a layout sweep's captures (iPhone 16), seated in the
#                   same render, with the 9:41 battery laid over the sweep's
#                   own; the Work tile's two are copies of these. Their
#                   "Looks good?" (phones/scanfridge) is the sweep's, with
#                   Tigo's own fridge in its frame where the sweep has a
#                   stand-in receipt, from the App Store lab's untouched
#                   capture of it (both frames are the same, to the pixel)
#   fridge.webp     that photo of the fridge, alone, for the print the Ship
#                   chapter tapes up behind the phone
#   sweep/, store/  the layout sweep's four-phone montages, and the App
#                   Store listing's five panels
#
# (The UX Lab's captures in lab/, and the Figma prototype's six screens in
# figma/, are one-offs: the lab's were taken from concepts/index.html in a
# browser, with its sticky bar hidden and the tap targets counted, and the
# Figma screens are the live site's own, Media/pantry-flow-*.webp.)
#
# The phones come from the sweep set PANTRYPAL_SHOTS names, by default the
# sweep's final set. The October 2026 phones are a fresh one of the 1.3
# build, shot by the app's own sweep with the same launch flags:
#
#     (cd ~/Developer/PantryPal/tools/ui-sweep && ./sweep.sh --label oct \
#        --devices 16 --build signup scanner scanshot scanreview shelf home cook)
#     PANTRYPAL_SHOTS=~/Developer/PantryPal/tools/ui-sweep/shots/oct/16 \
#       live-portfolio/tools/pantry-app.sh
#
# (The 4.1 ink sketches are drawn by tools/pantry-ink.mjs, from the drawings
# this script lifts, and the story map's five pictures by
# tools/pantry-story.sh, from the phones it makes.)
#
# Needs ImageMagick (magick) and cwebp, both from Homebrew.
set -euo pipefail

PP="${PANTRYPAL:-$HOME/Developer/PantryPal}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/assets/case/pantrypal"
APP="$OUT/app"
SWEEP="$PP/tools/ui-sweep/shots/final/16"
SHOTS="${PANTRYPAL_SHOTS:-$SWEEP}"
STORE="$PP/concepts/appstore-lab"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for need in magick cwebp python3; do
  command -v "$need" >/dev/null || { echo "pantry-app.sh needs $need" >&2; exit 1; }
done
[ -d "$PP/App" ] || { echo "no PantryPal at $PP (set PANTRYPAL)" >&2; exit 1; }
mkdir -p "$APP/fonts" "$APP/art" "$OUT/phones" "$OUT/sweep" "$OUT/store"

webp() { cwebp -quiet -m 6 "$@"; }

echo "fonts"
cp "$PP/design-system/Sources/PantryPalDS/Resources/Fonts/FugazOne-Regular.ttf" "$APP/fonts/"
cp "$PP/design-system/Sources/PantryPalDS/Resources/Fonts/Faustina-VariableFont.ttf" "$APP/fonts/Faustina.ttf"

echo "the book, and its drawings"
python3 - "$PP/App/Resources/ChefBook.json" "$APP/chefbook.json" "$TMP" <<'PY'
import json, re, sys
src, dst, tmp = sys.argv[1:4]
book = json.load(open(src))['recipes']
keep = ['title', 'summary', 'calories', 'proteinGrams', 'minutes', 'meals', 'ingredientNames', 'steps']
out = {'source': 'PantryPal/App/Resources/ChefBook.json, copied unchanged but for its header comment',
       'recipes': [{k: r[k] for k in keep if k in r} for r in book]}
json.dump(out, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
# one name to a line, and a newline after the last, or `read` drops it
open(f'{tmp}/dishes', 'w').write(''.join(slug(r['title']) + '\n' for r in book))
open(f'{tmp}/foods', 'w').write(''.join(n + '\n' for n in sorted({slug(i) for r in book for i in r['ingredientNames']})))
PY
ART="$PP/App/Resources/BundledIllustrations"
while read -r s; do webp -q 80 -alpha_q 85 -resize 400 0 "$ART/$s.png" -o "$APP/art/$s.webp"; done < "$TMP/dishes"
while read -r s; do webp -q 80 -alpha_q 85 -resize 192 0 "$ART/$s.png" -o "$APP/art/$s.webp"; done < "$TMP/foods"

echo "the device, and the chrome"
webp -q 85 -alpha_q 90 -resize 900 0 "$STORE/frame/iphone-16-pro.png" -o "$APP/frame.webp"
magick "$STORE/shots/home.png" -crop 1179x660+0+0 +repage -resize 786x "$TMP/chrome-home.png"
webp -q 86 "$TMP/chrome-home.png" -o "$APP/chrome-home.webp"
magick "$STORE/shots/cook.png" -crop 1179x620+0+0 +repage -resize 786x "$TMP/chrome-recipe.png"
webp -q 86 "$TMP/chrome-recipe.png" -o "$APP/chrome-recipe.webp"
magick "$SWEEP/cook.png" -crop 1179x40+0+1846 +repage -resize 786x "$TMP/rule.png"
webp -q 90 "$TMP/rule.png" -o "$APP/rule.webp"
magick "$STORE/shots/home.png" -crop 1179x140+0+0 +repage "$TMP/bar.png"
magick "$SWEEP/home-empty.png" -crop 1179x636+0+0 +repage "$TMP/bar.png" -geometry +0+0 -composite -resize 786x "$TMP/chrome-welcome.png"
webp -q 86 "$TMP/chrome-welcome.png" -o "$APP/chrome-welcome.webp"
magick "$PP/App/Resources/Assets.xcassets/tab-wood.imageset/tab-wood.png" -crop 1179x186+0+180 +repage -resize 786x "$TMP/plank.png"
webp -q 80 "$TMP/plank.png" -o "$APP/plank.webp"
webp -q 85 -alpha_q 90 -resize 96 0 "$PP/App/Resources/Assets.xcassets/cta-hat.imageset/cta-hat.png" -o "$APP/hat.webp"

echo "phones"
# Tigo's fridge, out of the lab's untouched capture of it, into the sweep's
# "Looks good?": the photo's frame is 1034 by 1372 at 72, 674 in both, with
# corners of 48, and the frame's dashes stand over the photo's edge
magick "$STORE/shots/fridge-raw.png" -crop 1034x1372+72+674 +repage "$TMP/fridge.png"
magick -size 1034x1372 xc:black -fill white -draw "roundrectangle 0,0,1033,1371,48,48" "$TMP/fridge-mask.png"
magick "$TMP/fridge.png" "$TMP/fridge-mask.png" -alpha off -compose CopyOpacity -composite "$TMP/fridge-in.png"
magick "$SHOTS/scanshot.png" "$TMP/fridge-in.png" -geometry +72+674 -compose Over -composite "$TMP/scanfridge.png"
magick "$TMP/fridge.png" -resize 760x "$TMP/fridge-760.png"
webp -q 82 "$TMP/fridge-760.png" -o "$OUT/fridge.webp"
# The render's screen, measured off its alpha (appstore-lab/README.md): at
# the 800-wide size the page draws, a 714 × 1553 aperture 43 in and 41
# down, with corners of 113.
magick "$STORE/shots/home.png" -crop 105x63+990+55 +repage "$TMP/battery.png"
magick "$STORE/frame/iphone-16-pro.png" -resize 800x1636! "$TMP/frame.png"
magick -size 714x1553 xc:none -fill white -draw "roundrectangle 0,0,713,1552,113,113" "$TMP/mask.png"
for f in signup scanner scanfridge scanreview shelf home cook; do
  src="$SHOTS/$f.png"; [ "$f" = scanfridge ] && src="$TMP/scanfridge.png"
  magick "$src" "$TMP/battery.png" -geometry +990+55 -composite \
    -resize 714x1553^ -gravity center -extent 714x1553 \
    "$TMP/mask.png" -compose DstIn -composite "$TMP/screen.png"
  magick -size 800x1636 xc:none "$TMP/screen.png" -geometry +43+41 -compose Over -composite \
    "$TMP/frame.png" -compose Over -composite "$TMP/$f.png"
  webp -q 84 -alpha_q 90 "$TMP/$f.png" -o "$OUT/phones/$f.webp"
done
cp "$OUT/phones/signup.webp" "$HERE/assets/work/pantrypal-signup.webp"
cp "$OUT/phones/home.webp" "$HERE/assets/work/pantrypal-home.webp"

echo "the sweep, and the store"
for s in home shelf cook signup; do
  webp -q 82 -resize 1680 0 "$PP/tools/ui-sweep/review/final/$s.png" -o "$OUT/sweep/$s.webp"
done
i=0
for f in "$STORE"/final/*.png; do
  i=$((i + 1))
  webp -q 84 -resize 520 0 "$f" -o "$OUT/store/store-$i.webp"
done

echo "done: $(find "$APP/art" -name '*.webp' | wc -l | tr -d ' ') drawings"
