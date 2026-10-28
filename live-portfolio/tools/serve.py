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
"""

import functools
import http.server
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoStore(http.server.SimpleHTTPRequestHandler):
    # Keep-alive: the page is one document and a dozen ES modules, fetched in
    # a burst. On HTTP/1.0 every one of them is a fresh connection.
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

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
