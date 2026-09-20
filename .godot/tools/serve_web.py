#!/usr/bin/env python3
"""Local testing server for an EXPORTED Godot website, not the source project."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--port", type=int, default=8080)
parser.add_argument("--directory", type=Path, default=ROOT / "exports" / "web")
args = parser.parse_args()
if not (args.directory / "index.html").exists():
    raise SystemExit("No exported index.html found. Export the Web preset first; see GETTING_STARTED.md.")

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".wasm": "application/wasm", ".pck": "application/octet-stream",
                      ".js": "text/javascript"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

server = ThreadingHTTPServer(("0.0.0.0", args.port), partial(Handler, directory=str(args.directory)))
print(f"DELVE test website: http://localhost:{args.port} (Ctrl+C to stop)", flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()
