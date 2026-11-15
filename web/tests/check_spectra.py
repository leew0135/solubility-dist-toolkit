"""
check_spectra.py — opens page ⓪ in a real browser (Playwright) and checks it.

HOW TO USE (from the solubility-toolkit folder)
    python web/tests/check_spectra.py                    # prints PASS / FAIL lines
    python web/tests/check_spectra.py --shots out_folder # also saves screenshots

WHAT IS CHECKED
    the α-pinene example gives the paper's α (0.44 / 0.55 / 0.66 / 0.77) and equals the
    Python package; the three figures are drawn and follow the Vr buttons; m/z window,
    exclusions and unticking a condition; mosquito coil and peat examples; upload of a
    wrong file; CSV download; "Send α to ①" arrives on page ① and is inverted there.

HOW TO CHANGE
    What is checked -> the numbered blocks in main().  Server / browser start -> check_engine.py.
"""
import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_distribution import RESULT_ROWS_JS  # noqa: E402
from check_engine import BASE, ROOT, start_server   # noqa: E402

sys.path.insert(0, str(ROOT))
from solubility_toolkit import io as toolkit_io     # noqa: E402

PAGE = '[data-page="spectra"]'


def table(page):
    rows = page.locator("#s-table tbody tr")
    return [[float(t) for t in rows.nth(i).locator("td").all_inner_texts()] for i in range(rows.count())]


def run(page):
    page.click("#s-run")
    page.wait_for_function("document.querySelector('#s-run').textContent === 'Run' && !document.querySelector('#s-run').disabled")


def wait_done(page):
    page.wait_for_selector(f'{PAGE}[data-state="done"], {PAGE}[data-state="error"]', timeout=120_000)


def main(shots):
    results, errors = [], []
    check = lambda name, ok, note="": results.append((name, bool(ok), note))
    server = start_server()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 1000}, accept_downloads=True)
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.route("**/*", lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())

            # 1. α-pinene example = paper = Python package
            page.goto(BASE)                                   # default route is ⓪
            wait_done(page)
            got = table(page)
            check("α-pinene example gives the paper's α", [g[1] for g in got] == [0.44, 0.55, 0.66, 0.77], str([g[1] for g in got]))
            ref = toolkit_io.read_spectra(str(ROOT / "web" / "examples" / "alpha_pinene_spectra.csv")).fit_all()
            check("browser = Python package (α, R², slope)",
                  all(abs(g[1] - r.alpha) < 1e-9 and abs(g[3] - r.r_squared) < 6e-4 and abs(g[4] - r.slope) < 6e-4 for g, r in zip(got, ref)),
                  f"R² {[g[3] for g in got]}")
            check("step default from config.py", page.input_value("#s-step") == "0.01")
            check("4 conditions listed and ticked", page.locator("#s-conditions input:checked").count() == 4)

            # 2. figures, and the Vr buttons
            check("spectra: measured + reconstructed", page.locator("#s-spectra .barlayer .trace").count() == 2)
            check("scatter: one point per m/z", page.locator("#s-figures .figure-card").nth(0).locator(".scatterlayer .point").count() == 172)
            sse_note = lambda: page.locator("#s-figures .figure-card").nth(1).locator(".annotation-text").text_content()
            check("SSE minimum marked", "0.44" in sse_note(), sse_note())
            if shots:
                page.screenshot(path=str(shots / "spectra.png"), full_page=True)
            page.click('#s-pick button[data-vr="0.01"]')
            page.wait_for_timeout(300)
            check("Vr button switches figures", "0.77" in sse_note() and "Vr 0.01" in page.inner_text("#s-spectra figcaption"), sse_note())

            # 3. m/z window + exclusions (grey sticks) + untick one condition
            page.fill("#s-mzmax", "150")
            page.fill("#s-exclude", "44, 50-60")
            check("stale note after edit", page.is_visible("#s-stale"))
            page.uncheck('#s-conditions input[data-vr="0.06"]')
            run(page)
            ref2 = toolkit_io.read_spectra(str(ROOT / "web" / "examples" / "alpha_pinene_spectra.csv"), mz_max=150, exclude="44, 50-60")
            want = [ref2.fit(v).alpha for v in (1.78, 0.32, 0.01)]
            got = table(page)
            check("window + exclusion + 3 of 4 conditions", [g[0] for g in got] == [1.78, 0.32, 0.01] and [g[1] for g in got] == [round(w, 2) for w in want],
                  f"{[g[1] for g in got]}; {page.inner_text('#s-file-info')[-40:]}")
            check("excluded m/z drawn as third series", page.locator("#s-spectra .barlayer .trace").count() == 3)
            if shots:
                page.locator("#s-spectra").screenshot(path=str(shots / "spectra_excluded.png"))

            # 3b. the user corrects a Vr: α is unchanged, the new Vr is shown and sent on
            page.fill('#s-conditions input[data-label="1.78"]', "2")
            run(page)
            got = table(page)
            check("Vr can be corrected", got[0][0] == 2.0 and got[0][1] == round(want[0], 2)
                  and "Vr 2" in page.inner_text("#s-pick"), str([g[:2] for g in got]))
            page.fill('#s-conditions input[data-label="1.78"]', "0.32")
            page.click("#s-run")
            page.wait_for_selector("#s-error:not([hidden])")
            check("duplicate Vr refused", "different Vr" in page.inner_text("#s-error"))

            # 4. bad input is explained
            page.fill("#s-exclude", "abc")
            page.click("#s-run")
            page.wait_for_selector("#s-error:not([hidden])")
            page.wait_for_function("document.querySelector('#s-error').textContent.includes('Exclude m/z')")
            check("input error shown", "Exclude m/z" in page.inner_text("#s-error"))
            page.click("#s-reset")
            wait_done(page)
            page.wait_for_function("document.querySelectorAll('#s-table tbody tr').length === 4")
            check("reset to paper defaults", page.input_value("#s-exclude") == "" and page.input_value("#s-mzmax") == ""
                  and page.locator("#s-conditions input:checked").count() == 4
                  and page.input_value('#s-conditions input[data-label="1.78"]') == "1.78")

            # 5. other examples
            for key, want in (("mosquito_coil", [0.48, 0.56, 0.72, 0.94, 1.0]), ("peat", [0.5, 0.44, 0.52, 0.62, 0.8])):
                page.select_option("#s-example", key)
                label = "Mosquito coil" if key == "mosquito_coil" else "Peat"
                page.wait_for_function(f"document.querySelector('#s-source').textContent.includes('{label}') && document.querySelector('{PAGE}').dataset.state === 'done'", timeout=60_000)
                page.wait_for_function("document.querySelectorAll('#s-table tbody tr').length === 5", timeout=60_000)
                got = [g[1] for g in table(page)]
                check(f"{key} example", got == want, str(got))
            if shots:
                page.screenshot(path=str(shots / "spectra_peat.png"), full_page=True)

            # 6. upload: a wrong file, then a good one; download
            page.set_input_files("#s-upload input", files=[{"name": "wrong.csv", "mimeType": "text/csv", "buffer": b"Vr,alpha\n1,0.5\n"}])
            page.wait_for_selector("#s-error:not([hidden])")
            check("wrong file explained", page.inner_text("#s-error").startswith("The file needs the columns"), page.inner_text("#s-error")[:80])
            good = (ROOT / "web" / "examples" / "alpha_pinene_spectra.csv").read_bytes()
            page.set_input_files("#s-upload input", files=[{"name": "my_spectra.csv", "mimeType": "text/csv", "buffer": good}])
            page.wait_for_function("document.querySelectorAll('#s-table tbody tr').length === 4", timeout=60_000)
            check("CSV upload", "my_spectra.csv" in page.inner_text("#s-source") and not page.is_visible("#s-error"))
            with page.expect_download() as dl:
                page.click("#s-csv")
            text = Path(dl.value.path()).read_text()
            check("CSV download", text.startswith("Vr,alpha,one_minus_alpha,r_squared,slope,sse") and text.count("\n") == 5)
            with page.expect_download() as dl:
                page.click("text=Download CSV template")
            check("template download", Path(dl.value.path()).read_text().startswith("mz,A0,A1A0_1.78,O1A0_1.78"))

            # 7. send α to ① and invert there
            page.click("#s-send")
            page.wait_for_selector('[data-page="distribution"][data-state="done"]', timeout=180_000)
            page.wait_for_selector("#d-source.note-ok")
            page.wait_for_function("!document.querySelector('#d-results').hidden")
            rows = page.locator("#d-table tbody tr")
            sent = [(rows.nth(i).locator('input[data-key="vr"]').input_value(), rows.nth(i).locator('input[data-key="alpha"]').input_value()) for i in range(rows.count())]
            check("Send α to ①", sent == [("1.78", "0.44"), ("0.32", "0.55"), ("0.06", "0.66"), ("0.01", "0.77")]
                  and "Received α from ⓪" in page.inner_text("#d-source"), page.inner_text("#d-source"))
            mean = [float(row[2]) for row in page.evaluate(RESULT_ROWS_JS)]
            check("① inverted the received α", len(mean) == 4 and abs(mean[0] - 0.475) < 0.02, str(mean))
            if shots:
                page.screenshot(path=str(shots / "spectra_to_distribution.png"))

            # 8. phone width
            page.click('a[data-route="spectra"]')
            page.wait_for_selector(f"{PAGE}:not([hidden])")
            page.set_viewport_size({"width": 390, "height": 800})
            page.wait_for_timeout(600)
            width = page.evaluate("document.documentElement.scrollWidth")
            check("fits a phone screen (no sideways scroll)", width <= 392, f"page width {width}px")
            if shots:
                page.screenshot(path=str(shots / "spectra_phone.png"), full_page=True)

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
