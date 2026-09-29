#!/usr/bin/env python3
"""Serve the draft on this Mac, and only this Mac.

    python3 draft-portfolio/tools/serve.py          # http://localhost:8793
    python3 draft-portfolio/tools/serve.py 9000     # or any port

Two differences from `python3 -m http.server`, both on purpose:

- It listens on 127.0.0.1 only. The plain server listens on every interface,
  so anyone on the same Wi-Fi could open the draft. This one answers only to
  the machine it runs on.
- It sends `Cache-Control: no-store`. The plain server sends nothing about
  caching, and a browser left to guess will happily keep an old stylesheet
  or module across a reload. Every reload here fetches what is on disk now.
"""

import functools
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8793))
    handler = functools.partial(NoStore, directory=ROOT)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"draft-portfolio on http://localhost:{port}  (this Mac only; Ctrl-C stops it)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
