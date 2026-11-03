#!/usr/bin/env python3
"""Draw a PantryPal capture's title band the way the case study wears it.

    python3 live-portfolio/tools/pantry-chrome.py in.png out.png [--pill] [--arrow]

Called by tools/pantry-app.sh on the iPhone 16 captures (1179 wide) the
chrome is cut from. Two changes from the app's own band, both Tigo's:

  --pill   the title pill's line drawn whole. The app dashes it on a screen
           that is still provisional (How it works!, Scan it in, Looks good?,
           Scanning..., Type it in!); here every pill wears the solid 2-point
           ink line the rest do. The pill's white runs under its line, so its
           white is its shape: the line is laid 6 pixels inside it, over the
           dashes, with a ring of the band's own colour just outside, so no
           dash's soft end shows.
  --arrow  the back arrow on a coral band filled with butter. There it is the
           band's own coral inside its ink line, red on red; on the steel and
           butter bands it is coral already, and is left alone.

Needs ImageMagick.
"""

import subprocess
import sys

W = 1179


def main():
    src, dst = sys.argv[1], sys.argv[2]
    raw = subprocess.run(["magick", src, "-depth", "8", "rgb:-"], capture_output=True, check=True).stdout
    px = lambda x, y: raw[(y * W + x) * 3:(y * W + x) * 3 + 3]
    ops = []
    if "--arrow" in sys.argv:
        # the shaft's middle and the head's, inside the arrow's ink line
        ops += ["-fuzz", "14%", "-fill", "#ffd67e", "-draw", "color 200,507 floodfill", "-draw", "color 112,507 floodfill"]
    if "--pill" in sys.argv:
        xs, ys = [], []
        for y in range(420, 600):
            for x in range(W):
                r, g, b = px(x, y)
                if r >= 250 and g >= 250 and b >= 250:
                    xs.append(x)
                    ys.append(y)
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        l, t, r, b = x0 + 3, y0 + 3, x1 - 3, y1 - 3
        rad = (b - t) / 2
        band = "#%02x%02x%02x" % tuple(px(4, (y0 + y1) // 2))
        ops += ["-fill", "none", "-stroke", band, "-strokewidth", "4", "-draw", f"roundrectangle {x0 - 2},{y0 - 2} {x1 + 2},{y1 + 2} {rad + 5},{rad + 5}"]
        ops += ["-fill", "none", "-stroke", "#000", "-strokewidth", "6.6", "-draw", f"roundrectangle {l},{t} {r},{b} {rad},{rad}"]
    subprocess.run(["magick", src] + ops + [dst], check=True)


if __name__ == "__main__":
    sys.exit(main())
