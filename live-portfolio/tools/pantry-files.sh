#!/usr/bin/env bash
# pantry-files.sh — copy the files PantryPal's Build chapter opens.
#
#     live-portfolio/tools/pantry-files.sh              # from ~/Developer/PantryPal
#     PANTRYPAL=/path/to/PantryPal live-portfolio/tools/pantry-files.sh
#
# Every card in the Build chapter opens a real file of the app's repository,
# drawn beside its code (js/pantry-files.js). The files are copied here as
# they stand, under the paths they have there, so the code a reader sees is
# the code that ships, and this is the one place the list is written down:
#
#   repo/design-system/tokens/*.json        the seven token files
#   repo/design-system/Sources/PantryPalDS/Components/
#                                           four of the seventeen components
#   repo/App/Resources/ChefBook.json        the book of fifty dishes
#   repo/App/Sources/Services/CateredPick.swift
#                                           the dish written for tonight, or not
#   repo/proxy/api/{illustrate,recipes}.ts  the two proxy functions
#   repo/design-system/tokens-login.txt     grep's answer for the Login frame,
#                                           which the Figma card opens
#
# The viewer points at lines in these files by number (pantry-files.js, the
# data-lines of each drawing), so after a copy that moves them, open each
# file and point at its drawing again.

set -euo pipefail

PP="${PANTRYPAL:-$HOME/Developer/PantryPal}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$HERE/assets/case/pantrypal/repo"
C=design-system/Sources/PantryPalDS/Components

copy() { mkdir -p "$OUT/$(dirname "$1")"; cp "$PP/$1" "$OUT/$1"; }

for f in "$PP"/design-system/tokens/*.json; do copy "design-system/tokens/$(basename "$f")"; done
for c in PPPrimaryButton PPStickerButton PageTitlePill ScallopedBorder; do copy "$C/$c.swift"; done
copy App/Resources/ChefBook.json
copy App/Sources/Services/CateredPick.swift
copy proxy/api/illustrate.ts
copy proxy/api/recipes.ts
(cd "$PP/design-system" && grep -n "Login\|Log In" tokens/*.json) > "$OUT/design-system/tokens-login.txt"

echo "copied into $OUT"
