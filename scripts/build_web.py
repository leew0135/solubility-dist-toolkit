"""
build_web.py — prepare the website and (optionally) preview it on your computer.

WHAT IT DOES
    1. Packs solubility_toolkit/ into web/py/solubility_toolkit.zip.
       The website loads this zip into Pyodide, so the browser runs exactly
       the same Python code as `pip install -e .` does. Never edit the zip:
       edit solubility_toolkit/*.py and run this script again.
    2. With --serve: starts a local web server for the web/ folder.

HOW TO USE (from the solubility-toolkit folder)
    python scripts/build_web.py              # build only (use this before deploying)
    python scripts/build_web.py --serve      # build, then open http://localhost:8000
    python scripts/build_web.py --serve --port 8123

HOW TO CHANGE
    Which files go into the zip  -> PACKAGE_DIR / the "*.py" pattern in build_zip()
    Default port                 -> DEFAULT_PORT
"""
import argparse
import functools
import http.server
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKAGE_DIR = ROOT / "solubility_toolkit"
WEB_DIR = ROOT / "web"
ZIP_PATH = WEB_DIR / "py" / "solubility_toolkit.zip"
DEFAULT_PORT = 8000


def build_zip():
    """Write web/py/solubility_toolkit.zip from the package source."""
    ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    files = sorted(PACKAGE_DIR.glob("*.py"))
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            # fixed timestamp: the zip only changes when the code changes
            info = zipfile.ZipInfo(f"{PACKAGE_DIR.name}/{f.name}", date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, f.read_bytes())
    print(f"built {ZIP_PATH.relative_to(ROOT)}  ({len(files)} files)")


class DevHandler(http.server.SimpleHTTPRequestHandler):
    """Static file server with the MIME types Pyodide needs and no caching."""
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".wasm": "application/wasm",
        ".whl": "application/octet-stream",
        ".zip": "application/zip",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")   # always serve the latest edit
        super().end_headers()

    def log_message(self, *args):
        pass                                            # keep the terminal quiet


def serve(port):
    handler = functools.partial(DevHandler, directory=str(WEB_DIR))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"serving web/ at http://localhost:{port}   (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--serve", action="store_true", help="start a local preview server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()
    build_zip()
    if args.serve:
        serve(args.port)
