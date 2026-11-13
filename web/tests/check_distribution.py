"""
check_distribution.py — opens page ① in a real browser (Playwright) and checks it.

HOW TO USE (from the solubility-toolkit folder)
    python web/tests/check_distribution.py                    # prints PASS / FAIL lines
    python web/tests/check_distribution.py --shots out_folder # also saves screenshots

WHAT IS CHECKED
    the α-pinene example runs by itself; the table equals the Python package (same seed);
    all four kinds of figure are drawn; the axis switch, CSV upload, input errors,
    "Reset to paper defaults" and "Send distribution to ②" work; no browser errors.

HOW TO CHANGE
    What is checked -> the numbered blocks in main().  Server / browser start -> check_engine.py.
"""
import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_engine import BASE, ROOT, start_server   # noqa: E402

sys.path.insert(0, str(ROOT))
from solubility_toolkit import Inversion, Kernel    # noqa: E402

VR, ALPHA, BINS = [1.78, 0.32, 0.06, 0.01], [0.44, 0.55, 0.66, 0.77], [-1, 0, 1, 2]


def table_numbers(page):
    rows = page.locator("#d-result-table tbody tr")
    return [[float(t.replace("−", "-")) for t in rows.nth(i).locator("td").all_inner_texts()] for i in range(rows.count())]


def wait_done(page):
    page.wait_for_selector('[data-page="distribution"][data-state="done"], [data-page="distribution"][data-state="error"]', timeout=120_000)


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

            # 1. example loads and runs by itself
            page.goto(BASE + "#/distribution")
            wait_done(page)
            check("example runs on opening", page.get_attribute('[data-page="distribution"]', "data-state") == "done",
                  page.inner_text("#d-sum")[-25:])
            check("α table filled from example", page.locator("#d-table tbody tr").count() == 4)
            check("defaults from config.py", page.input_value("#d-n") == "10000" and page.input_value("#d-unc") == "10"
                  and page.input_value("#d-a") == "-0.642" and page.input_value("#d-b") == "-0.8")
            first = table_numbers(page)
            check("result close to paper (0.475 / 0.089 / 0.109 / 0.223)",
                  all(abs(r[2] - m) < 0.02 for r, m in zip(first, [0.475, 0.089, 0.109, 0.223])), str([r[2] for r in first]))

            # 2. figures
            check("distribution: 4 bars", page.locator("#d-dist .barlayer .point").count() == 4)
            check("extra figures folded away at first", not page.is_visible("#d-kernel") and not page.is_visible("#d-fit") and not page.is_visible("#d-hist"))
            if shots:
                page.screenshot(path=str(shots / "distribution.png"), full_page=True)
            for fold in ("#d-fold-kernel", "#d-fold-fit", "#d-fold-hist"):
                page.click(f"{fold} > summary")
            page.wait_for_timeout(400)
            check("kernel: 4 curves", page.locator("#d-kernel .scatterlayer .trace").count() == 4)
            box = page.locator("#d-kernel .legend").bounding_box(), page.locator("#d-kernel .plot").bounding_box()
            check("kernel legend lower left", box[0]["y"] > box[1]["y"] + box[1]["height"] / 2 and box[0]["x"] < box[1]["x"] + box[1]["width"] / 2)
            check("alpha fit: 2 series", page.locator("#d-fit .scatterlayer .trace").count() == 2)
            check("histograms: 4 panels", page.locator("#d-hist .js-plotly-plot").count() == 4)
            if shots:
                page.screenshot(path=str(shots / "distribution_open.png"), full_page=True)

            # 2b. mosquito coil and peat examples (paper: SI Tables S5 / S6 distributions of A0)
            for key, paper in (("mosquito_coil", [0.476, 0.093, 0.336, 0.055, 0.012]), ("peat", [0.293, 0.207, 0.061, 0.049, 0.389])):
                page.select_option("#d-example", key)
                page.wait_for_function("document.querySelectorAll('#d-hist .js-plotly-plot').length === 5", timeout=120_000)
                wait_done(page)
                got = [r[2] for r in table_numbers(page)]
                check(f"{key} example close to paper", len(got) == 5 and all(abs(g - p) < 0.02 for g, p in zip(got, paper)), str(got))
                if shots and key == "peat":
                    page.screenshot(path=str(shots / "distribution_peat.png"), full_page=True)
            page.select_option("#d-example", "alpha_pinene")
            page.wait_for_function("document.querySelectorAll('#d-hist .js-plotly-plot').length === 4", timeout=120_000)
            wait_done(page)

            # 3. reproducible run equals the Python package exactly
            page.click("#d-params details > summary")
            page.check("#d-seed")
            page.click("#d-run")
            page.wait_for_selector('[data-state="running"]', timeout=5000)
            wait_done(page)
            ref = Inversion(Kernel(VR, BINS)).monte_carlo(ALPHA, uncertainty=[0.1] * 4, seed=42)
            got = table_numbers(page)
            ok = all(abs(g[2] - m) < 6e-4 and abs(g[3] - s) < 6e-4 for g, m, s in zip(got, ref.mean, ref.sd))
            check("browser = Python package (seed 42)", ok, f"{[g[2] for g in got]} vs {ref.mean.round(3).tolist()}")

            # 4. axis switch relabels without recomputing
            bottom = lambda: page.locator("#d-dist .xtick text").all_text_contents()
            before = bottom()
            page.click("#d-axis-s")
            page.wait_for_timeout(300)
            after = bottom()
            check("axis switch log K_OW -> log S", before[0] in ("−1", "-1") and after[0] == "0.45", f"{before} -> {after}")
            if shots:
                page.locator("#d-dist").screenshot(path=str(shots / "distribution_logS.png"))
            page.click("#d-axis-kow")

            # 5. input error is explained, results stay
            page.fill('#d-table tbody tr:first-child input[data-key="alpha"]', "1.4")
            check("stale note after edit", page.is_visible("#d-stale"))
            page.click("#d-run")
            page.wait_for_selector("#d-error:not([hidden])")
            check("input error shown", "between 0 and 1" in page.inner_text("#d-error"), page.inner_text("#d-error"))
            page.fill('#d-table tbody tr:first-child input[data-key="alpha"]', "0.44")

            # 6. CSV upload (5 conditions, own uncertainty column), then download
            csv = "Vr,alpha,uncertainty_pct\n10,0.2,5\n1,0.4,5\n0.1,0.6,5\n0.01,0.8,5\n0.001,0.9,5\n"
            page.set_input_files("#d-upload input", files=[{"name": "my_alpha.csv", "mimeType": "text/csv", "buffer": csv.encode()}])
            page.wait_for_selector('#d-source.note-ok')
            wait_done(page)
            page.wait_for_function("document.querySelectorAll('#d-table tbody tr').length === 5")
            wait_done(page)
            check("CSV upload", "my_alpha.csv" in page.inner_text("#d-source")
                  and page.input_value('#d-table tbody tr:first-child input[data-key="unc"]') == "5", page.inner_text("#d-source"))
            with page.expect_download() as dl:
                page.click("#d-csv")
            text = Path(dl.value.path()).read_text()
            check("CSV download", text.startswith("log_kow,log_s,mean,sd,normalized,central_nnls") and text.count("\n") == 5, text.split("\n")[0])

            # 7. other bins: 5 bins -> 5 histogram panels
            page.fill("#d-bins", "-2, -1, 0, 1, 2")
            page.click("#d-run")
            page.wait_for_function("document.querySelectorAll('#d-hist .js-plotly-plot').length === 5", timeout=120_000)
            check("5 bins -> 5 bars and 5 histograms", page.locator("#d-dist .barlayer .point").count() == 5)

            # 8. reset, then send to ②
            page.select_option("#d-relation", "coates_1985")
            check("relationship fills a, b", page.input_value("#d-a") == "-1.79" and page.input_value("#d-b") == "-0.94")
            page.fill("#d-a", "-1")
            check("typing a switches to Custom", page.input_value("#d-relation") == "custom")
            page.click("#d-reset")
            wait_done(page)
            check("reset to paper defaults", page.input_value("#d-a") == "-0.642" and page.input_value("#d-relation") == "kenaga_goring_1980"
                  and not page.is_checked("#d-seed"))
            page.click("#d-send")
            page.wait_for_selector('[data-page="kohler"]:not([hidden])')
            sent = page.evaluate("JSON.parse(sessionStorage.getItem('solubility-toolkit:distribution')).data")
            check("send to ② (normalized)", abs(sum(sent["mass_fraction"]) - 1) < 1e-9 and sent["normalized"] is True,
                  str([round(x, 3) for x in sent["mass_fraction"]]))

            # 9. coming back keeps the page as it was
            page.click('a[data-route="distribution"]')
            page.wait_for_selector('[data-page="distribution"]:not([hidden])')
            check("page kept when returning", page.locator("#d-table tbody tr").count() == 5 and page.is_visible("#d-results"))

            # 10. narrow screen
            page.set_viewport_size({"width": 390, "height": 800})
            page.wait_for_timeout(500)
            width = page.evaluate("document.documentElement.scrollWidth")
            check("fits a phone screen (no sideways scroll)", width <= 392, f"page width {width}px")
            if shots:
                page.screenshot(path=str(shots / "distribution_phone.png"), full_page=True)

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
