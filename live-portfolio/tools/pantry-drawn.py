#!/usr/bin/env python3
"""Draw the foods the scanner's two pictures come back with, for the case study.

    python3 live-portfolio/tools/pantry-drawn.py            # every name in pantry-drawn.txt

A scan of the page's receipt or of Tigo's fridge (api/pantry.js) names foods
the app has no bundled drawing of: "Iceberg Lettuce", "Hass Avocado",
"Kombucha". The app asks its art store for each, and so would the page, but a
render the store has never made takes seconds and costs money, and one the
visitor's limit refuses is an empty tile. So each of them is asked of the store
once, here, the way the app asks (the name folded and lowercased), lifted off
its white by the app's own subject lifter (Vision, tools/subject-lift), trimmed
and kept as a sticker in app/drawn/. The page treats one as a drawing the store
has just made: it arrives after a beat, into the slot that turned while it
waited (pantry-kitchen.js), and app/art.json lists them (tools/pantry-app.sh
writes that list).

The names are the kitchen's, collected by scanning each picture a few times
(it names a food a little differently each time); add a line to
pantry-drawn.txt for any new one. Needs the app's shared secret, read from
PP_APP_SECRET or the app's Secrets.xcconfig, Swift, ImageMagick and cwebp.
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "case", "pantrypal", "app", "drawn")
PP = os.environ.get("PANTRYPAL", os.path.expanduser("~/Developer/PantryPal"))
PROXY = os.environ.get("PP_PROXY_URL", "https://pantrypal-proxy.vercel.app").rstrip("/")


def secret():
    if os.environ.get("PP_APP_SECRET"):
        return os.environ["PP_APP_SECRET"]
    with open(os.path.join(PP, "App", "Secrets.xcconfig")) as f:
        return re.search(r"^PP_APP_SECRET\s*=\s*(\S+)", f.read(), re.M)[1]


def main():
    with open(os.path.join(HERE, "pantry-drawn.txt")) as f:
        names = [l.strip() for l in f if l.strip() and not l.startswith("#")]
    key = secret()
    raw, lifted = tempfile.mkdtemp(), tempfile.mkdtemp()
    try:
        for name in names:
            slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
            q = urllib.parse.urlencode({"ingredient": name.lower()})
            req = urllib.request.Request(f"{PROXY}/api/illustrate?{q}", headers={"x-pantrypal-key": key, "x-pantrypal-device": "portfolio-prep"})
            with urllib.request.urlopen(req, timeout=90) as r, open(os.path.join(raw, f"{slug}.jpg"), "wb") as f:
                f.write(r.read())
                print(r.headers.get("X-PP-Source"), name)
        subprocess.run(["swift", os.path.join(PP, "tools", "subject-lift", "main.swift"), raw, lifted], check=True)
        os.makedirs(OUT, exist_ok=True)
        for png in sorted(os.listdir(lifted)):
            trimmed = os.path.join(lifted, f"t-{png}")
            subprocess.run(["magick", os.path.join(lifted, png), "-trim", "+repage", "-bordercolor", "none", "-border", "6", trimmed], check=True)
            subprocess.run(["cwebp", "-quiet", "-m", "6", "-q", "80", "-alpha_q", "85", "-resize", "192", "0", trimmed, "-o", os.path.join(OUT, png[:-4] + ".webp")], check=True)
    finally:
        shutil.rmtree(raw, ignore_errors=True)
        shutil.rmtree(lifted, ignore_errors=True)
    print(f"{len(names)} drawn into {os.path.relpath(OUT)}; run tools/pantry-app.sh to list them in art.json")


if __name__ == "__main__":
    sys.exit(main())
