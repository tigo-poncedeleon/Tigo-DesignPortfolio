#!/usr/bin/env bash
# story-art.sh — bake the pictures on the case studies' story maps, the row
# of chapters under each case study's overview (assets/case/<case>/story/).
#
#     live-portfolio/tools/story-art.sh                    every case
#     live-portfolio/tools/story-art.sh pantrypal          one case
#     live-portfolio/tools/story-art.sh pantrypal ship     one picture
#
# Each tile is an illustration drawn by hand in its own work's manner:
#
#   pantrypal   the app's own: a thick ink line that wobbles a little, flat
#               colour with one shade and one white highlight, its coral,
#               red, butter, sky and green, and its Fugaz. Each chapter as
#               a kitchen would tell it: the pad and its pencil, the Figma
#               screen and its noodle, the design system prepped in bowls,
#               fourteen pots on one stove, and the icon served.
#   vicino      the sketchbook Canvas was mapped in: a fine pen line on
#               white nodes, each lit by its chapter's port colour, with
#               the agent from the first sheet going from the board to the
#               guide to the pen.
#   nextlevel   the mark's own: a navy line of one weight and its blue, each
#               chapter one simple scene inside the badge's ring and arc,
#               taking its quarter, its waves and its drone where they fit:
#               the night in Madrid, a question whose point is a drop, nine
#               tries in rings, the badge itself, and the jacket.
#
# The drawings are SVG, in tools/story-art/<case>/: change one there and
# bake it again. Each is shot in the system Chrome at twice its size, so its
# filters (the wobble) and its type are drawn as a browser draws them, and
# halved to the tile's own shape, 800 by 640, on a clear ground: the tile's
# light shows through.
#
# Needs Google Chrome, ImageMagick (magick) and cwebp from Homebrew.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
ARTS="$HERE/tools/story-art"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for need in magick cwebp; do
  command -v "$need" >/dev/null || { echo "story-art.sh needs $need" >&2; exit 1; }
done
[ -x "$CHROME" ] || { echo "story-art.sh needs Google Chrome" >&2; exit 1; }

bake() {  # bake <case> <name>
  local svg="$ARTS/$1/$2.svg" out="$HERE/assets/case/$1/story"
  [ -f "$svg" ] || { echo "no drawing at $svg" >&2; exit 1; }
  mkdir -p "$out"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=800,640 --default-background-color=00000000 \
    --screenshot="$TMP/$2.png" "file://$svg" >/dev/null 2>&1
  magick "$TMP/$2.png" -filter Lanczos -resize 800x640 -type TrueColorAlpha "$TMP/$2-1x.png"
  cwebp -quiet -m 6 -q 86 -alpha_q 92 "$TMP/$2-1x.png" -o "$out/$2.webp"
  echo "  $1/story/$2.webp"
}

cases=("${1:-}")
[ -n "${1:-}" ] || cases=(pantrypal vicino nextlevel)
for c in "${cases[@]}"; do
  echo "$c"
  if [ $# -gt 1 ]; then
    for name in "${@:2}"; do bake "$c" "$name"; done
  else
    for svg in "$ARTS/$c"/*.svg; do bake "$c" "$(basename "$svg" .svg)"; done
  fi
done
