"""
check_sync.py — the three tool pages follow each other's example choice (Playwright).

HOW TO USE (from the solubility-toolkit folder)
    python web/tests/check_sync.py                    # prints PASS / FAIL lines
    python web/tests/check_sync.py --shots out_folder # also saves screenshots

WHAT IS CHECKED
    an example picked on ⓪ is loaded by ① and ② when they are opened; one picked on ② is loaded by
    ⓪ and ①; "Send α to ①" still wins when it is newer than the example choice; a page that already
    shows the shared example is not run again.

HOW TO CHANGE
    What is checked -> the numbered blocks in main().  Server / browser start -> check_engine.py.
"""
import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_engine import BASE, start_server   # noqa: E402


def done(page, name):
    page.wait_for_selector(f'[data-page="{name}"]:not([hidden])')
    page.wait_for_function(f"document.querySelector('[data-page=\"{name}\"]').dataset.state === 'done'", timeout=180_000)
    page.wait_for_timeout(300)


def open_tab(page, route):
    page.click(f'a[data-route="{route}"]')
    done(page, route)


def main(shots):
    out, errors = [], []
    check = lambda name, ok, note="": out.append((name, bool(ok), note))
    server = start_server()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 1000})
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.route("**/*", lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())

            # 1. pick mosquito coil on ⓪
            page.goto(BASE + "#/spectra")
            done(page, "spectra")
            page.select_option("#s-example", "mosquito_coil")
            page.wait_for_function("document.querySelectorAll('#s-table tbody tr').length === 5", timeout=60_000)

            # 2. ① and ② follow
            open_tab(page, "distribution")
            page.wait_for_function("document.querySelectorAll('#d-table tbody tr').length === 5", timeout=60_000)
            done(page, "distribution")
            check("① follows ⓪ (mosquito coil)", page.input_value("#d-example") == "mosquito_coil"
                  and "Mosquito coil" in page.inner_text("#d-source") and page.locator("#d-dist .barlayer .point").count() == 5,
                  page.inner_text("#d-source")[:50])
            open_tab(page, "kohler")
            page.wait_for_function("document.querySelectorAll('#k-table tbody tr').length === 5", timeout=60_000)
            done(page, "kohler")
            check("② follows ⓪ (mosquito coil)", page.input_value("#k-example") == "mosquito_coil"
                  and page.input_value("#k-temp") == "298.15" and page.locator("#k-measured tbody tr").count() == 8,
                  page.inner_text("#k-source")[:50])

            # 3. pick peat on ②; ⓪ and ① follow
            page.select_option("#k-example", "peat")
            page.wait_for_function("document.querySelector('#k-source').textContent.includes('Peat')")
            done(page, "kohler")
            open_tab(page, "spectra")
            page.wait_for_function("document.querySelector('#s-source').textContent.includes('Peat')", timeout=60_000)
            done(page, "spectra")
            alphas = [t for t in page.locator("#s-table tbody tr td:nth-child(2)").all_inner_texts()]
            check("⓪ follows ② (peat)", page.input_value("#s-example") == "peat" and alphas[:2] == ["0.50", "0.44"], str(alphas))
            open_tab(page, "distribution")
            page.wait_for_function("document.querySelector('#d-source').textContent.includes('Peat')", timeout=60_000)
            done(page, "distribution")
            check("① follows ② (peat)", page.input_value("#d-example") == "peat"
                  and page.input_value('#d-table tbody tr:first-child input[data-key="alpha"]') == "0.37")
            if shots:
                page.screenshot(path=str(shots / "sync_peat.png"))

            # 4. coming back without a new choice does not reload or rerun
            page.evaluate("() => { window.__calls = 0; const w = Worker.prototype.postMessage; Worker.prototype.postMessage = function (...a) { window.__calls++; return w.apply(this, a); }; }")
            open_tab(page, "kohler")
            open_tab(page, "distribution")
            check("no rerun when nothing changed", page.evaluate("window.__calls") == 0, f"{page.evaluate('window.__calls')} Python calls")

            # 5. a newer "Send α to ①" wins over the older example choice
            open_tab(page, "spectra")
            page.click("#s-send")
            done(page, "distribution")
            page.wait_for_function("document.querySelector('#d-source').textContent.includes('Received α from ⓪')")
            check("newer Send α from ⓪ wins", page.input_value('#d-table tbody tr:first-child input[data-key="alpha"]') == "0.5"
                  and page.locator("#d-table tbody tr").count() == 5, page.inner_text("#d-source")[:60])

            # 6. after that, a new example choice on ⓪ wins again
            open_tab(page, "spectra")
            page.select_option("#s-example", "alpha_pinene")
            page.wait_for_function("document.querySelectorAll('#s-table tbody tr').length === 4", timeout=60_000)
            open_tab(page, "distribution")
            page.wait_for_function("document.querySelectorAll('#d-table tbody tr').length === 4", timeout=60_000)
            done(page, "distribution")
            check("newer example choice wins again (α-pinene)", page.input_value("#d-example") == "alpha_pinene"
                  and "α-pinene" in page.inner_text("#d-source"))

            check("no browser errors", not errors, "; ".join(errors)[:300])
            browser.close()
    finally:
        server.terminate()

    for name, ok, note in out:
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"   [{note}]" if note else ""))
    return all(ok for _, ok, _ in out)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--shots", type=Path, default=None, help="folder for screenshots")
    args = parser.parse_args()
    if args.shots:
        args.shots.mkdir(parents=True, exist_ok=True)
    sys.exit(0 if main(args.shots) else 1)
