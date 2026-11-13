"""
check_engine.py — opens the website in a real browser (Playwright) and checks step 1:
the Python engine loads, solubility_toolkit answers, and a figure is drawn.

HOW TO USE (from the solubility-toolkit folder)
    pip install playwright && playwright install chromium     # once
    python web/tests/check_engine.py                          # prints PASS / FAIL lines
    python web/tests/check_engine.py --shots out_folder       # also saves screenshots

It starts its own preview server (scripts/build_web.py), so nothing else has to run.
The file name does not start with "test_" on purpose: `pytest` (the science tests)
must not need a browser.

HOW TO CHANGE
    Port -> PORT.   What is checked -> the numbered blocks in main().
"""
import argparse
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PORT = 8765
BASE = f"http://localhost:{PORT}/"


def start_server():
    proc = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "build_web.py"), "--serve", "--port", str(PORT)])
    for _ in range(50):
        try:
            urllib.request.urlopen(BASE, timeout=1)
            return proc
        except OSError:
            time.sleep(0.2)
    proc.terminate()
    raise RuntimeError("preview server did not start")


def main(shots):
    results, errors = [], []
    check = lambda name, ok, note="": results.append((name, bool(ok), note))
    server = start_server()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 1200})
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            # only this computer: proves the site works without the CDN
            page.route("**/*", lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())

            # 1. engine loads
            t0 = time.time()
            page.goto(BASE + "#/dev")
            page.wait_for_selector('[data-engine-state="ready"], [data-engine-state="error"]', timeout=180_000)
            state = page.get_attribute("#engine-pill", "data-engine-state")
            check("Python engine ready", state == "ready", f"{time.time() - t0:.1f} s; {page.inner_text('#engine-pill')}")

            # 2. toolkit answers, defaults come from config.py
            page.wait_for_selector('[data-page="dev"][data-dev-state]', timeout=60_000)
            info = page.inner_text("#dev-info")
            check("toolkit imported", "solubility_toolkit" in info and "0.1.0" in info, info.replace("\n", " | ")[:200])
            check("config.py defaults reach the page", "10000" in info and "kenaga_goring_1980" in info)

            # 3. kernel numbers equal the Python package (first row, first bin of the Igor-validated kernel)
            cell = page.inner_text("#dev-kernel tbody tr:first-child td:nth-child(2)")
            sys.path.insert(0, str(ROOT))
            from solubility_toolkit import Kernel
            expect = Kernel([1.78, 0.32, 0.06, 0.01], [-1, 0, 1, 2]).matrix[0, 0]
            check("kernel in browser = kernel in Python", abs(float(cell) - expect) < 1e-6, f"{cell} vs {expect:.6f}")

            # 4. figure drawn by Plotly with one curve per Vr
            n = page.locator("#dev-figure .scatterlayer .trace").count()
            check("figure drawn (4 curves)", n == 4, f"{n} curves")

            if shots:
                page.screenshot(path=str(shots / "dev.png"), full_page=True)

            # 5. tabs switch without reloading the engine
            page.click('a[data-route="distribution"]')
            page.wait_for_selector('[data-page="distribution"]:not([hidden])')
            check("tab switch keeps engine", page.get_attribute("#engine-pill", "data-engine-state") == "ready")
            if shots:
                page.screenshot(path=str(shots / "tab.png"))

            check("no browser errors", not errors, "; ".join(errors)[:300])
            browser.close()
    finally:
        server.terminate()

    for name, ok, note in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"   [{note}]" if note else ""))
    return all(ok for _, ok, _ in results)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--shots", type=Path, default=None, help="folder for screenshots")
    args = parser.parse_args()
    if args.shots:
        args.shots.mkdir(parents=True, exist_ok=True)
    sys.exit(0 if main(args.shots) else 1)
