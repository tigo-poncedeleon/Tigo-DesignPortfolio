#!/usr/bin/env python3
"""Serve the site on this Mac, and only this Mac.

    python3 live-portfolio/tools/serve.py          # http://localhost:8793
    python3 live-portfolio/tools/serve.py 9000     # or any port

Three differences from `python3 -m http.server`, all on purpose:

- It listens on 127.0.0.1 only. The plain server listens on every interface,
  so anyone on the same Wi-Fi could open the draft. This one answers only to
  the machine it runs on.
- It sends `Cache-Control: no-store`. The plain server sends nothing about
  caching, and a browser left to guess will happily keep an old stylesheet
  or module across a reload. Every reload here fetches what is on disk now.
- It answers a request for part of a file (`Range`), as Vercel does. A video
  is fetched a piece at a time; the plain server sends the whole file
  whatever is asked, and a browser given that cannot seek in it, so a
  scrubber dragged back went nowhere and a film opened partway through
  started again from the top.
- It answers /api/pantry, as the site's relay (api/pantry.js) does, so the
  PantryPal the case study runs scans and writes dishes here too: the same
  three routes, passed to the app's own proxy with the app's shared secret,
  read from PP_APP_SECRET or from the app's gitignored Secrets.xcconfig
  (~/Developer/PantryPal/App, or $PANTRYPAL/App). Without either, the
  route answers 503 and the app says the kitchen is slammed, as it would.
"""

import base64
import functools
import http.server
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROXY = os.environ.get("PP_PROXY_URL", "https://pantrypal-proxy.vercel.app").rstrip("/")


def app_secret():
    """The app's shared secret: the environment's, or the app's own file's."""
    if os.environ.get("PP_APP_SECRET"):
        return os.environ["PP_APP_SECRET"]
    app = os.path.join(os.environ.get("PANTRYPAL", os.path.expanduser("~/Developer/PantryPal")), "App", "Secrets.xcconfig")
    try:
        with open(app) as f:
            found = re.search(r"^PP_APP_SECRET\s*=\s*(\S+)", f.read(), re.M)
            return found[1] if found else None
    except OSError:
        return None


class NoStore(http.server.SimpleHTTPRequestHandler):
    # Keep-alive: the page is one document and a dozen ES modules, fetched in
    # a burst. On HTTP/1.0 every one of them is a fresh connection.
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    # ---- /api/pantry, the relay to PantryPal's kitchen ----
    def do_GET(self):
        if self.path.startswith("/api/pantry"):
            return self.pantry("GET")
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/pantry"):
            return self.pantry("POST")
        self.send_error(405)

    def pantry(self, method):
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        route = (query.get("route") or [""])[0]
        secret = app_secret()
        if not secret:
            return self.answer(503, b'{"error":"kitchen"}', "application/json")
        headers = {"x-pantrypal-key": secret, "x-pantrypal-device": "portfolio-local"}
        if route == "illustrate" and method == "GET":
            # the store files a subject by its lowercase name, as the app sends it
            ask = {"ingredient": (query.get("ingredient") or [""])[0].strip().lower()[:60]}
            if (query.get("variant") or [""])[0] == "dish":
                ask["variant"] = "dish"
            req = urllib.request.Request(f"{PROXY}/api/illustrate?{urllib.parse.urlencode(ask)}", headers=headers)
            timeout = 34
        elif route in ("recipes", "scan") and method == "POST":
            body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
            try:
                asked = json.loads(body)
            except ValueError:
                return self.answer(400, b'{"error":"body"}', "application/json")
            # a scanner door names its picture, and the photo is read here
            if route == "scan" and isinstance(asked, dict) and "picture" in asked:
                name = {"receipt": "scan-receipt.jpg", "fridge": "scan-fridge.jpg"}.get(asked["picture"])
                if not name:
                    return self.answer(400, b'{"error":"picture"}', "application/json")
                with open(os.path.join(ROOT, "assets/case/pantrypal/app", name), "rb") as f:
                    body = json.dumps({"image": base64.b64encode(f.read()).decode(), "mime": "image/jpeg"}).encode()
            headers["content-type"] = "application/json"
            req = urllib.request.Request(f"{PROXY}/api/{route}", data=body, headers=headers, method="POST")
            timeout = 33
        else:
            return self.answer(404, b'{"error":"route"}', "application/json")
        # a kitchen that falls over is asked once more, as the site's relay does
        for attempt in (1, 2):
            try:
                with urllib.request.urlopen(req, timeout=timeout) as up:
                    return self.answer(up.status, up.read(), up.headers.get("Content-Type", "application/json"))
            except urllib.error.HTTPError as err:
                if err.code >= 500 and attempt == 1 and route != "illustrate":
                    continue
                sys.stderr.write(f"pantry: {route} answered {err.code}\n")
                return self.answer(err.code, b'{"error":"kitchen"}', "application/json")
            except (urllib.error.URLError, TimeoutError, OSError) as err:
                sys.stderr.write(f"pantry: {route} did not answer ({err})\n")
                return self.answer(504, b'{"error":"slow"}', "application/json")

    def answer(self, status, body, kind):
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_head(self):
        # the bytes still to send of a part asked for, read by copyfile; None
        # for a whole file, which the plain server sends as it always has
        self.left = None
        path = self.translate_path(self.path)
        asked = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", "").strip())
        if not asked or not (asked[1] or asked[2]) or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        if asked[1]:
            start, end = int(asked[1]), min(int(asked[2] or size - 1), size - 1)
        else:
            start, end = max(0, size - int(asked[2])), size - 1
        if start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self.left = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        if self.left is None:
            return super().copyfile(source, outputfile)
        while self.left > 0:
            chunk = source.read(min(64 * 1024, self.left))
            if not chunk:
                break
            outputfile.write(chunk)
            self.left -= len(chunk)


class Server(http.server.ThreadingHTTPServer):
    # The stock listen queue holds five waiting connections. A reload asks
    # for more than that at once, and the overflow was refused outright
    # (ERR_CONNECTION_RESET on a module), which leaves the page without its
    # script. A deeper queue lets them wait their turn instead.
    request_queue_size = 128
    daemon_threads = True


def main():
    port = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8793))
    handler = functools.partial(NoStore, directory=ROOT)
    server = Server(("127.0.0.1", port), handler)
    print(f"live-portfolio on http://localhost:{port}  (this Mac only; Ctrl-C stops it)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
