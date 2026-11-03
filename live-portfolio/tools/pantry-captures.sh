#!/usr/bin/env bash
# pantry-captures.sh — shoot the PantryPal screens the case study's chrome is
# cut from (tools/pantry-app.sh), on an iPhone 16 simulator.
#
#     live-portfolio/tools/pantry-captures.sh [out-dir]   # default $TMPDIR/pantry-captures
#     PANTRYPAL_CAPTURES=<out-dir> live-portfolio/tools/pantry-app.sh
#
# The app must be installed on the simulator (a Debug build, which honours
# the launch flags below). The status bar is the system's own, pinned at
# 9:41 with full bars and a full battery, so each capture carries the bar as
# iOS draws it, over the app's art: the chef's hat runs up under it, as it
# does on a phone. (The chrome used to be the layout sweep's captures with
# the App Store lab's whole bar strip pasted over their tops, for its
# battery, which cut the top off the chef's hat in a straight line.)
#
# Each screen is launched straight onto its route with the fixtures, the
# meal pinned to dinner, and no cold open.
set -euo pipefail

OUT="${1:-${TMPDIR:-/tmp}/pantry-captures}"
DEVICE="${PANTRYPAL_DEVICE:-iPhone 16}"
APP="com.tigoponcedeleon.pantrypal"
mkdir -p "$OUT"
UDID=$(xcrun simctl list devices booted | grep -F "$DEVICE (" | head -1 | grep -oE '[0-9A-F-]{36}')
[ -n "$UDID" ] || { echo "boot the $DEVICE simulator first" >&2; exit 1; }

xcrun simctl status_bar "$UDID" override --time "9:41" --batteryState discharging --batteryLevel 100 \
  --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3 --operatorName ''

shoot() { # name, then the launch flags
  local name=$1; shift
  xcrun simctl terminate "$UDID" "$APP" 2>/dev/null || true
  xcrun simctl launch "$UDID" "$APP" -reset YES -launchAnim NO -meal dinner -fixtures YES -noCamera YES "$@" >/dev/null
  sleep "${WAIT:-4}"
  xcrun simctl io "$UDID" screenshot --type=png "$OUT/$name.png" >/dev/null 2>&1
  echo "$name"
}
shoot signup -route signup
WAIT=6 shoot onboarding -route onboarding
shoot home-empty -route home
shoot home -route home -shelf receipt
shoot manual -route manual
shoot scanner -route scanner
shoot scanshot -route scanshot
shoot scanread -route scanread
shoot scanreview -route scanreview
shoot shelf -route shelf -shelf receipt
shoot recipes -route recipes -shelf receipt
shoot settings -route settings
shoot cook -route cook -shelf receipt
xcrun simctl status_bar "$UDID" clear
echo "captures in $OUT"
