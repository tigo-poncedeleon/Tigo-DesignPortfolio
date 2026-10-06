#!/usr/bin/env bash
# pantry-story.sh — bake the five pictures on PantryPal's story map, the row
# of chapters under the case study's overview (assets/case/pantrypal/story/).
#
#     live-portfolio/tools/pantry-story.sh
#     PANTRYPAL=/path/to/PantryPal live-portfolio/tools/pantry-story.sh
#
# Each tile holds its chapter's own artifact, all five in one light and four
# of them rising out of the tile's foot in one phone, Tigo's iPhone 16 Pro
# render from the App Store lab, so the row reads as one story told in five
# stages and no two tiles show the same screen:
#
#   sketch      the kept sheet (pantry-wire-3) as the paper it was: a white
#               margin, a strip of tape, and the red KEPT! stamp the Sketch
#               chapter stamps on it, in the app's Fugaz
#   prototype   the Figma file's own My recipes frame (the copy the app's
#               tools/ui-diff keeps, 393 × 852) under the lab's 9:41 bar
#   build       the design system's own parts, drawn by PantryPalDS itself
#               (tools/pantry-parts, a Swift package that renders them)
#   rethink     the old hub, counted (lab/hub-counted.webp), inside its own
#               ink line, under the 9:41 bar in its own paler sky
#   ship        the scan of Tigo's fridge (phones/scanfridge.webp, which
#               tools/pantry-app.sh makes)
#
# The phones and the paper are cut to the top of their height that a tile
# ever shows (it shows a phone's top half), 600 wide; the parts are the
# tile's own shape, 800 by 640.
#
# Needs ImageMagick (magick) and cwebp from Homebrew, and Xcode, whose
# toolchain has the SwiftUI the parts are drawn with.
set -euo pipefail

PP="${PANTRYPAL:-$HOME/Developer/PantryPal}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CASE="$HERE/assets/case/pantrypal"
OUT="$CASE/story"
STORE="$PP/concepts/appstore-lab"
FUGAZ="$CASE/app/fonts/FugazOne-Regular.ttf"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for need in magick cwebp swift; do
  command -v "$need" >/dev/null || { echo "pantry-story.sh needs $need" >&2; exit 1; }
done
[ -d "$PP/design-system" ] || { echo "no PantryPal at $PP (set PANTRYPAL)" >&2; exit 1; }
mkdir -p "$OUT"

webp() { cwebp -quiet -m 6 "$@"; }
# a phone or a sheet, cut to the part of it a tile shows
tile() {
  magick "$1" -resize 600x -gravity north -crop 600x780+0+0 +repage -type TrueColorAlpha "$TMP/tile.png"
  webp -q 84 -alpha_q 90 "$TMP/tile.png" -o "$OUT/$2.webp"
  echo "  story/$2.webp"
}
# a screen, as wide as the render's screen and from its top, in the render
# (pantry-app.sh's phones step measured the screen: 714 × 1553, 43 in and
# 41 down at the render's 800-wide size, its corners 113)
magick "$STORE/frame/iphone-16-pro.png" -resize 800x1636! "$TMP/frame.png"
magick -size 714x1553 xc:none -fill white -draw "roundrectangle 0,0,713,1552,113,113" "$TMP/mask.png"
seat() {  # seat <screen.png> <floor colour> <out.png>
  magick "$1" -resize 714x -gravity north -background "$2" -extent 714x1553 \
    "$TMP/mask.png" -compose DstIn -composite "$TMP/seated.png"
  magick -size 800x1636 xc:none "$TMP/seated.png" -geometry +43+41 -compose Over -composite \
    "$TMP/frame.png" -compose Over -composite "$3"
}
# the 9:41 bar, out of the lab's own capture of home
magick "$STORE/shots/home.png" -crop 1179x140+0+0 +repage "$TMP/bar.png"

echo "the story map"

# 01 the kept sheet, on paper. (Every image is kept in colour: ImageMagick
# saves a black-and-white sheet as grey, and the red stamp laid over it
# then came out grey too.)
magick "$CASE/pantry-wire-3.webp" -resize 948x -colorspace sRGB "$TMP/sheet.png"
SW=$(magick identify -format '%w' "$TMP/sheet.png")
SH=$(magick identify -format '%h' "$TMP/sheet.png")
PW=$((SW + 52)); PH=$((SH + 52))
magick -size ${PW}x${PH} xc:none -fill white -draw "roundrectangle 0,0,$((PW - 1)),$((PH - 1)),8,8" \
  "$TMP/sheet.png" -geometry +26+26 -compose Over -composite -type TrueColorAlpha "$TMP/paper.png"
# the stamp: its word in Fugaz, a ring round it, the ink taking unevenly
magick -size 900x260 xc:none -font "$FUGAZ" -pointsize 150 -fill 'rgb(219,44,44)' -gravity center \
  -annotate +0+6 'KEPT!' -trim +repage -bordercolor none -border 34x22 "$TMP/stamp-word.png"
TW=$(magick identify -format '%w' "$TMP/stamp-word.png")
TH=$(magick identify -format '%h' "$TMP/stamp-word.png")
magick -size ${TW}x${TH} xc:none -fill none \
  -stroke 'rgb(219,44,44)' -strokewidth 13 -draw "roundrectangle 8,8,$((TW - 9)),$((TH - 9)),26,26" \
  -stroke white -strokewidth 4 -draw "roundrectangle 18,18,$((TW - 19)),$((TH - 19)),18,18" \
  "$TMP/stamp-word.png" -compose Over -composite -colorspace sRGB "$TMP/stamp-raw.png"
magick -size ${TW}x${TH} xc: -seed 7 +noise Random -colorspace gray -blur 0x1.1 -threshold 34% -colorspace sRGB "$TMP/grain.png"
magick "$TMP/stamp-raw.png" \( "$TMP/stamp-raw.png" -alpha extract -colorspace sRGB "$TMP/grain.png" -compose Multiply -composite -colorspace gray \) \
  -alpha off -compose CopyOpacity -composite -channel A -evaluate multiply 0.92 +channel \
  -background none -rotate -8 -resize 62% -type TrueColorAlpha "$TMP/stamp.png"
magick "$TMP/paper.png" "$TMP/stamp.png" -gravity north -geometry +0+$((PH * 41 / 100)) -compose Multiply -composite \
  -type TrueColorAlpha "$TMP/paper-stamped.png"
# the tape, torn at both ends, across the sheet's head
magick -size 300x80 xc:none -fill 'rgba(250,240,205,0.9)' \
  -draw "polygon 9,5 21,0 282,0 294,11 300,38 291,69 300,80 15,80 0,67 9,40 0,13" "$TMP/tape0.png"
magick "$TMP/tape0.png" \( +clone -background 'rgba(80,50,20,0.5)' -shadow 40x3+0+3 \) +swap \
  -background none -layers merge +repage -rotate -3 "$TMP/tape.png"
magick -size $((PW + 40))x$((PH + 60)) xc:none -type TrueColorAlpha "$TMP/paper-stamped.png" -geometry +20+40 -compose Over -composite \
  "$TMP/tape.png" -gravity north -geometry +0+10 -compose Over -composite -type TrueColorAlpha "$TMP/sketch.png"
tile "$TMP/sketch.png" sketch

# 02 the Figma frame, at the app's three times, under the bar; the sky is
# the same #B8EDF8 in both, so they meet without a seam
magick "$PP/tools/ui-diff/figma/recipes.png" -filter Lanczos -resize 1179x "$TMP/figma.png"
magick "$TMP/bar.png" "$TMP/figma.png" -append "$TMP/figma-tall.png"
seat "$TMP/figma-tall.png" '#FFD67E' "$TMP/prototype.png"
tile "$TMP/prototype.png" prototype

# 03 the parts, drawn by the design system
(
  cd "$HERE/tools/pantry-parts"
  [ -d /Applications/Xcode.app ] && export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
  PANTRYPAL="$PP" swift run --scratch-path "$TMP/parts-build" pantry-parts "$TMP/parts.png" "$PP/App/Resources/BundledIllustrations"
) | tail -1
magick "$TMP/parts.png" -resize 800x640 -type TrueColorAlpha "$TMP/build.png"
webp -q 86 -alpha_q 92 "$TMP/build.png" -o "$OUT/build.webp"
echo "  story/build.webp"

# 04 the old hub: inside the capture's own ink line (6 in, all round), under
# the bar recoloured to the hub's paler sky (#E1F2F8, where the app's is
# #B8EDF8)
magick "$STORE/shots/home.png" -crop 1179x140+0+0 +repage -fuzz 6% -fill 'srgb(225,242,248)' -opaque 'srgb(184,237,248)' \
  -resize 560x "$TMP/bar-pale.png"
magick "$CASE/lab/hub-counted.webp" -crop 548x1194+6+6 +repage -resize 560x "$TMP/hub.png"
magick "$TMP/bar-pale.png" "$TMP/hub.png" -append "$TMP/hub-tall.png"
seat "$TMP/hub-tall.png" 'srgb(225,242,248)' "$TMP/rethink.png"
tile "$TMP/rethink.png" rethink

# 05 the scan, as the Ship chapter shows it
tile "$CASE/phones/scanfridge.webp" ship
