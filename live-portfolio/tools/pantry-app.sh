#!/usr/bin/env bash
# pantry-app.sh — rebuild what PantryPal's case study takes from the app.
#
#     live-portfolio/tools/pantry-app.sh              # from ~/Developer/PantryPal
#     PANTRYPAL=/path/to/PantryPal live-portfolio/tools/pantry-app.sh
#
# The case study runs the app on the page, the App Store build rebuilt for
# the browser from the phone's home screen to dinner
# (assets/case/pantrypal/app/pantry-app.js), and shows the app on phones.
# Everything it needs is lifted from the app's own repository, never drawn
# again by hand, and this is the one place that lifting is written down, so
# that when the app changes the page can follow it:
#
#   app/fonts/      the two faces, as the design system bundles them
#   app/chefbook.json
#                   the fifty bundled dishes, as the app ranks them
#   app/drawn/      the foods the scanner's two pictures come back with that
#                   the app bundles no drawing of, drawn by the app's art
#                   store and lifted by its subject lifter
#                   (tools/pantry-drawn.py), listed in app/art.json
#   app/art/        every drawing the app bundles, listed in app/art.json:
#                   plates at 400 wide, stickers at 192 (a sticker is never
#                   drawn bigger)
#   app/logo-*, mascot, kitchen-scene, tab-wood, wardrobe, app-icon
#                   the app's own pictures, out of its asset catalog
#   app/frame.webp  Tigo's iPhone 16 Pro render, the App Store lab's
#   app/chrome-*    the header and each title band, cut from captures of
#                   the app (tools/pantry-captures.sh, which pins the status
#                   bar at 9:41 with full bars): the wordmark, the chef and
#                   the scallops are drawn art, so the replica wears the
#                   real pixels (everything under their bands is drawn
#                   live), and scan-doors, the scanner's two doors
#   app/statusbar-* the 9:41 bar alone, in ink and in white
#   app/scan-receipt.webp, .jpg
#                   the receipt the scanner's receipt door photographs,
#                   drawn by tools/pantry-receipt.mjs; the JPEG is what the
#                   relay sends the kitchen (api/pantry.js), as is
#   app/scan-fridge.jpg
#                   Tigo's fridge, the food door's picture
#   app/scan-readings.json
#                   what the kitchen read off those two pictures once, kept
#                   for a scan whose kitchen does not answer (recorded with
#                   the relay, not by this script)
#   app/rule.webp   the design system's fuzzy rule, one strip of it
#   app/hat.webp    the rank badge's hat
#   phones/         a layout sweep's captures (iPhone 16), seated in the
#                   same render, with the 9:41 battery laid over the sweep's
#                   own; the Work tile's two are copies of these. Their
#                   "Looks good?" (phones/scanfridge) is the sweep's, with
#                   Tigo's own fridge in its frame where the sweep has a
#                   stand-in receipt, from the App Store lab's untouched
#                   capture of it (both frames are the same, to the pixel)
#   fridge.webp     that photo of the fridge, alone, for the print the Ship
#                   chapter tapes up behind the phone, and the picture the
#                   scanner's food door takes
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
# this script lifts. The story map's five pictures are drawn by hand, in
# tools/story-art/pantrypal/.)
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
# the chrome's captures, shot by tools/pantry-captures.sh
CAPS="${PANTRYPAL_CAPTURES:-${TMPDIR:-/tmp}/pantry-captures}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for need in magick cwebp python3; do
  command -v "$need" >/dev/null || { echo "pantry-app.sh needs $need" >&2; exit 1; }
done
[ -d "$PP/App" ] || { echo "no PantryPal at $PP (set PANTRYPAL)" >&2; exit 1; }
[ -f "$CAPS/home.png" ] || { echo "no captures in $CAPS: run tools/pantry-captures.sh first" >&2; exit 1; }
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
# Every drawing the app bundles, not only the book's: a name typed into the
# prototype finds the drawing the app would find (its art well, its chips,
# its shelf), and KnownIngredients.all, the vocabulary behind "Did you
# mean…", is every bundled drawing that is not one of the book's dishes.
# app/art.json lists them. A plate (one of the book's, or a dish the art
# store drew and the harvest bundled, which are wider than they are tall)
# goes at 400 wide, a sticker at 192, and every food a book dish names
# stays a sticker, however wide its drawing.
python3 - "$PP/App/Resources/ChefBook.json" "$ART" "$APP/art.json" "$TMP" <<'PY'
import json, os, re, struct, sys
src, art, dst, tmp = sys.argv[1:5]
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
recipes = json.load(open(src))['recipes']
book = sorted({slug(r['title']) for r in recipes})
named = {slug(i) for r in recipes for i in r['ingredientNames']}
every = sorted(f[:-4] for f in os.listdir(art) if f.endswith('.png'))
def wide(s):
    with open(f'{art}/{s}.png', 'rb') as f:
        w, h = struct.unpack('>II', f.read(24)[16:24])
    return s in book or (s not in named and w / h >= 1.15)
# and the foods the art store drew for the scanner's pictures (tools/pantry-drawn.py)
drawn_dir = os.path.join(os.path.dirname(dst), 'drawn')
drawn = sorted(f[:-5] for f in os.listdir(drawn_dir) if f.endswith('.webp')) if os.path.isdir(drawn_dir) else []
json.dump({'all': every, 'book': book, 'drawn': drawn}, open(dst, 'w'), separators=(',', ':'))
open(f'{tmp}/dishes', 'w').write(''.join(s + '\n' for s in every if wide(s)))
open(f'{tmp}/foods', 'w').write(''.join(s + '\n' for s in every if not wide(s)))
PY
while read -r s; do webp -q 80 -alpha_q 85 -resize 400 0 "$ART/$s.png" -o "$APP/art/$s.webp"; done < "$TMP/dishes"
while read -r s; do webp -q 80 -alpha_q 85 -resize 192 0 "$ART/$s.png" -o "$APP/art/$s.webp"; done < "$TMP/foods"

echo "the app's own pictures"
# the lockup the cold open builds from (LaunchCurtain), at twice its
# points; the kitchen behind the pass; the wood the shelf's headers and the
# tour's board are cut from; the wardrobe; and the icon on the home screen
XC="$PP/App/Resources/Assets.xcassets"
webp -q 88 -alpha_q 92 -resize 522 0 "$XC/logo-blob.imageset/logo-blob.png" -o "$APP/logo-blob.webp"
webp -q 88 -alpha_q 92 -resize 276 0 "$XC/logo-icon.imageset/logo-icon.png" -o "$APP/logo-icon.webp"
webp -q 88 -alpha_q 92 -resize 450 0 "$XC/mascot.imageset/mascot.png" -o "$APP/mascot.webp"
webp -q 82 -resize 816 0 "$XC/kitchen-scene.imageset/kitchen-scene.png" -o "$APP/kitchen-scene.webp"
webp -q 84 -resize 786 0 "$XC/tab-wood.imageset/tab-wood.png" -o "$APP/tab-wood.webp"
webp -q 88 -alpha_q 92 -resize 186 0 "$XC/wardrobe.imageset/wardrobe.png" -o "$APP/wardrobe.webp"
webp -q 90 -resize 192 0 "$XC/AppIcon.appiconset/AppIcon.png" -o "$APP/app-icon.webp"

echo "the device, and the chrome"
webp -q 85 -alpha_q 90 -resize 900 0 "$STORE/frame/iphone-16-pro.png" -o "$APP/frame.webp"
# The header and each title band, cut from captures of the app on an
# iPhone 16 (tools/pantry-captures.sh): the status bar in them is the
# system's own, pinned at 9:41, drawn over the app's art as on a phone, so
# the chef's hat runs up under it. Cut to the band's rough rule (the shelf's
# to the top of the wood its first shelf pins under the rule, the pass's to
# 330 points, where the kitchen shows between the fringe's scallops).
# The bands are drawn as the case study wears them (tools/pantry-chrome.py):
# every title pill on a solid line, and the back arrow on a coral band in
# butter, not red on red.
chrome() { # name source height [--pill] [--arrow]
  python3 "$HERE/tools/pantry-chrome.py" "$CAPS/$2.png" "$TMP/drawn-$1.png" "${@:4}"
  magick "$TMP/drawn-$1.png" -crop "1179x$3+0+0" +repage -resize 786x "$TMP/chrome-$1.png"
  webp -q 86 "$TMP/chrome-$1.png" -o "$APP/chrome-$1.webp"
}
chrome home home 660
chrome welcome home-empty 636
chrome recipe cook 620
chrome typein manual 660 --pill --arrow
chrome signup signup 990
chrome howto onboarding 660 --pill
chrome scan scanner 660 --pill --arrow
chrome looks scanshot 660 --pill --arrow
chrome scanning scanread 660 --pill --arrow
chrome found scanreview 660 --arrow
chrome shelf shelf 636
chrome myrecipes recipes 660
chrome settings settings 660
magick "$SWEEP/cook.png" -crop 1179x40+0+1846 +repage -resize 786x "$TMP/rule.png"
webp -q 90 "$TMP/rule.png" -o "$APP/rule.webp"
# The bar alone, its sky taken out: the system draws it over everything,
# so it stays put while a screen moves under it (the pass's kitchen rising
# for the keyboard, the cold open's sky), the same pixels the captures
# carry. In ink for the app, in white for the home screen; the island is
# drawn live, so it is left out here.
magick "$CAPS/onboarding.png" -crop 1179x126+0+0 +repage -fill '#b8edf8' -draw "rectangle 395,0 785,126" \
  -colorspace gray -negate -level 10%,90% "$TMP/status-mask.png"
for tone in dark:black light:white; do
  magick -size 1179x126 "xc:${tone#*:}" "$TMP/status-mask.png" -alpha off -compose CopyOpacity -composite -resize 786x "$TMP/status.png"
  webp -q 90 -alpha_q 95 "$TMP/status.png" -o "$APP/statusbar-${tone%%:*}.webp"
done
# the scanner's two doors, from under its band's rule to the foot of the
# library's, the whole of that rule in them: the receipt on butter, the food
# on sky down to the rule, each with its camera badge (the page laid its own
# strip of rule over the doors' foot, and the strip's butter showed as a
# band between the food's sky and the rule)
magick "$CAPS/scanner.png" -crop 1179x1653+0+619 +repage -resize 786x "$TMP/doors.png"
webp -q 84 "$TMP/doors.png" -o "$APP/scan-doors.webp"
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
magick "$TMP/fridge.png" -resize 900x -strip -quality 82 "$APP/scan-fridge.jpg"
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
