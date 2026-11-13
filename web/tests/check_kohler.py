"""
check_kohler.py — opens page ② in a real browser (Playwright) and checks it.

HOW TO USE (from the solubility-toolkit folder)
    python web/tests/check_kohler.py                    # prints PASS / FAIL lines
    python web/tests/check_kohler.py --shots out_folder # also saves screenshots

WHAT IS CHECKED
    the α-pinene example reproduces the Excel reference of the paper (s_c 1.0035 at 394.29 nm,
    dissolved fraction 0.70464, κ_CCN 0.1114 …) and equals the Python package; curve, drawing and
    bar charts follow the slider and the jump buttons without calling Python; density from O/C, H/C;
    the A1A0 sub-sample reproduces the Excel κ; the κ_intr fit (small, seeded) equals the Python
    package, shows progress, can be cancelled, and its values can be applied;
    mosquito coil and peat examples; input errors; CSV upload / download; a distribution sent
    from ① arrives; reset; phone width.

    The fit is run here with few draws so the check stays short. A full fit (200 draws x 3 rounds)
    takes minutes in a browser.

HOW TO CHANGE
    What is checked -> the numbered blocks in main().  Server / browser start -> check_engine.py.
"""
import argparse
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_engine import BASE, ROOT, start_server   # noqa: E402

sys.path.insert(0, str(ROOT))                       # the Python package, for reference values

PAGE = '[data-page="kohler"]'


def wait_done(page):
    page.wait_for_selector(f'{PAGE}[data-state="done"], {PAGE}[data-state="error"]', timeout=120_000)
    page.wait_for_timeout(250)                       # one screen refresh for the figures


def run(page):
    page.click("#k-run")
    page.wait_for_function("document.querySelector('#k-run').textContent === 'Run Köhler model' && !document.querySelector('#k-run').disabled")
    page.wait_for_timeout(250)


def results(page):
    return [t.replace("\xa0", " ") for t in page.locator("#k-result-table tbody tr td:nth-child(2)").all_inner_texts()]


def main(shots):
    out, errors = [], []
    check = lambda name, ok, note="": out.append((name, bool(ok), note))
    server = start_server()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 1000}, accept_downloads=True)
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.route("**/*", lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())

            # 1. α-pinene example = Excel reference of the paper (tests/test_against_paper.py)
            page.goto(BASE + "#/kohler")
            wait_done(page)
            res = results(page)
            check("s_c = 1.00350 (Excel 1.0035)", res[0].startswith("1.00350"), res[0])
            check("wet diameter at s_c = 394 nm (Excel 394.29)", res[1] == "394 nm", res[1])
            check("dissolved fraction at s_c = 0.705 (Excel 0.70464)", res[2] == "0.705", res[2])
            check("κ_CCN = 0.111 / 0.111 / 0.111 / 0.112 (Excel)", res[3] == "0.111 / 0.111 / 0.111 / 0.112", res[3])
            check("defaults from config.py", page.input_value("#k-sigma") == "0.072" and page.input_value("#k-temp") == "298"
                  and page.input_value("#k-dd") == "100")

            # 2. figures at the critical point
            check("Köhler curve drawn", page.locator("#k-curve .scatterlayer .trace").count() == 3)
            check("5 components in both bar charts", page.locator("#k-bars .figure-card").nth(0).locator(".barlayer .trace").first.locator(".point").count() == 5
                  and page.locator("#k-bars .figure-card").nth(1).locator(".barlayer .point").count() == 5)
            check("drawing: two phases at s_c", page.inner_text("#k-cartoon .cartoon-state") == "Two phases (LLPS)")
            check("slider label at s_c", "394 nm" in page.inner_text("#k-slider-label") and "SS 0.350 %" in page.inner_text("#k-slider-label"),
                  page.inner_text("#k-slider-label"))
            if shots:
                page.screenshot(path=str(shots / "kohler.png"), full_page=True)

            # 3. jump buttons and slider move everything without a Python call
            jumps = page.locator("#k-jumps button").all_inner_texts()
            check("three jump buttons", len(jumps) == 3 and "0.99" in jumps[0] and "activation" in jumps[1] and "fully dissolved" in jumps[2], str(jumps))
            page.evaluate("() => { window.__calls = 0; const w = Worker.prototype.postMessage; Worker.prototype.postMessage = function (...a) { window.__calls++; return w.apply(this, a); }; }")
            page.locator("#k-jumps button").nth(2).click()
            page.wait_for_timeout(300)
            total = page.locator("#k-bars .figure-card").nth(0).locator(".figure-note b").inner_text()
            check("iii: single aqueous phase", page.inner_text("#k-cartoon .cartoon-state") == "Single aqueous phase"
                  and float(total) >= 0.999, f"total dissolved {total}; {page.inner_text('#k-slider-label')}")
            page.locator("#k-jumps button").nth(0).click()
            page.wait_for_timeout(300)
            label = page.inner_text("#k-slider-label")
            check("i: s = 0.99, sub-saturated", "RH 99" in label and page.inner_text("#k-cartoon .cartoon-state") == "Two phases (LLPS)", label)
            if shots:
                page.locator("#k-results figure").first.screenshot(path=str(shots / "kohler_i.png"))
            page.evaluate("() => { const s = document.querySelector('#k-slider'); s.value = 700; s.dispatchEvent(new Event('input', { bubbles: true })); }")
            page.wait_for_timeout(300)
            moved = page.inner_text("#k-slider-label")
            check("slider moves the marker", moved != label and re.search(r"\d+ nm", moved) is not None, moved)
            check("slider and buttons did not call Python", page.evaluate("window.__calls") == 0, f"{page.evaluate('window.__calls')} calls")

            # 4. bin labels
            tick = lambda: " | ".join(page.locator("#k-bars .figure-card").nth(0).locator(".ytick text").all_text_contents())
            before = tick()
            page.click("#k-label-k")
            page.wait_for_timeout(300)
            check("bin labels: log S <-> log K_OW", "log S" in before and "OW" in tick(), f"{before} -> {tick()}")
            page.click("#k-label-s")

            # 5. density from O/C and H/C gives the same particle (Kuwata et al., 2012)
            page.click("#k-oc")
            check("O/C, H/C columns shown, stale note", page.locator('#k-table input[data-key="oc"]').count() == 4 and page.is_visible("#k-stale"))
            run(page)
            res2 = results(page)
            check("density from O/C, H/C", res2[0].startswith("1.0035") and res2[3] == res[3], f"{res2[0]}; {res2[3]}")
            page.click("#k-rho")
            check("typed densities kept when switching back", page.input_value('#k-table tbody tr:first-child input[data-key="rho"]') == "1.393064595")

            # 5b. sub-sample: A1A0 at Vr 1.78 reproduces the Excel κ (tests/test_against_paper.py)
            options = page.locator("#k-sample option").all_inner_texts()
            check("sample menu lists the fractions", len(options) == 5 and "A1A0 [Vr 1.78]" in options, str(options))
            page.fill("#k-ss", "0.329479, 0.458184, 0.586997, 0.769875")
            page.select_option("#k-sample", label="A1A0 [Vr 1.78]")
            page.wait_for_function("document.querySelector('#k-curve-title').textContent.includes('A1A0')")
            wait_done(page)
            check("A1A0[1.78]: κ_CCN = 0.187 / 0.188 / 0.188 / 0.189 (Excel)", results(page)[3] == "0.187 / 0.188 / 0.188 / 0.189"
                  and page.locator("#k-bars .figure-card").nth(1).locator(".barlayer .point").count() == 4, results(page)[3])
            page.select_option("#k-sample", index=0)
            wait_done(page)

            # 5c. κ_intr fit: small and seeded, must equal the Python package
            page.wait_for_timeout(600)                      # figures above have finished redrawing
            page.click("#k-fold-fit > summary")
            page.wait_for_function("document.querySelector('#k-fold-fit').open")
            check("measured κ table filled from the example", page.locator("#k-measured tbody tr").count() == 5
                  and page.input_value("#k-fit-draws") == "200" and page.input_value("#k-fit-tol") == "0.02, 0.01, 0.0075")
            page.click("#k-fold-fit details > summary")
            page.fill("#k-fit-draws", "8")
            page.fill("#k-fit-tol", "0.2, 0.1")
            page.check("#k-fit-seed")
            page.click("#k-fit")
            page.wait_for_selector("#k-fit-progress:not([hidden])")
            page.wait_for_function("document.querySelector('#k-fit-progress span').textContent.includes(' of 16 ')")
            progress = page.inner_text("#k-fit-progress span")
            page.wait_for_selector(f'{PAGE}[data-fit="done"]', timeout=170_000)
            sys.path.insert(0, str(ROOT / "tests"))
            import test_against_paper as paper
            from solubility_toolkit.kappa_fit import KappaIntrinsicFitter
            samples = paper.ap_samples()
            # measured κ_CCN: Lee et al. (2023), SI Table S4; SS as shown in the table of the page (3 decimals)
            ss_on, ss_fr = [round(x, 3) for x in paper.SS_ONLINE], [round(x, 3) for x in paper.SS_FRACTIONS]
            measured = {"online": (ss_on, [.12, .12, .11, .10]), "A0": (ss_fr, [.13] * 4),
                        "A1A0[1.78]": (ss_fr, [.21, .22, .21, .20]), "A1A0[0.32]": (ss_fr, [.17] * 4),
                        "A1A0[0.06]": (ss_fr, [.13] * 4)}
            ref = KappaIntrinsicFitter(samples, measured, draws=8, tolerances=(0.2, 0.1)).fit(seed=42)
            fitted = [float(t) for t in page.locator("#k-fit-table tbody td:nth-child(3)").all_inner_texts()]
            check("progress shown while fitting", "Round" in progress and "κ sets" in progress, progress)
            check("fit in browser = Python package (seed 42)", ref.ok and len(fitted) == 5 and all(abs(a - b) < 6e-4 for a, b in zip(fitted, ref.mean)),
                  f"{fitted} vs {ref.mean.round(3).tolist()}; {page.inner_text('#k-fit-summary')[:40]}")
            check("fit figures: 5 fractions, 5 histograms", page.locator("#k-fit-scatter .scatterlayer .trace").count() == 5
                  and page.locator("#k-fit-hist .js-plotly-plot").count() == 5)
            if shots:
                page.locator("#k-fold-fit").screenshot(path=str(shots / "kohler_fit.png"))
            page.click("#k-fit-apply")
            page.wait_for_function(f"document.querySelector('#k-table tbody tr input[data-key=\"kappa\"]').value === '{float(f'{ref.mean[0]:.4f}'):g}'")
            wait_done(page)
            check("fitted values applied to the bin table and WIOM", abs(float(page.input_value("#k-wiom-kappa")) - ref.mean[4]) < 1e-4, page.input_value("#k-wiom-kappa"))

            # 5d. a long fit can be cancelled; the engine comes back and the page still works
            page.fill("#k-fit-draws", "200")
            page.click("#k-fit")
            page.wait_for_function("/ [3-9] of 400 /.test(document.querySelector('#k-fit-progress span').textContent)", timeout=60_000)
            page.click("#k-fit-cancel")
            page.wait_for_selector(f'{PAGE}[data-fit="cancelled"]')
            page.wait_for_selector('[data-engine-state="ready"]', timeout=120_000)
            run(page)
            check("cancel: engine restarts, page keeps working", "cancelled" in page.inner_text("#k-fit-error")
                  and page.get_attribute(PAGE, "data-state") == "done" and page.is_visible("#k-fit-values"))
            page.click("#k-reset")
            wait_done(page)

            # 6. input error is explained
            page.fill('#k-table tbody tr:nth-child(2) input[data-key="kappa"]', "")
            page.click("#k-run")
            page.wait_for_selector("#k-error:not([hidden])")
            check("input error shown", "κ_intr in row 2" in page.inner_text("#k-error"), page.inner_text("#k-error"))

            # 7. other examples (values from the Python package with data/kohler_params.json)
            for key, want in (("mosquito_coil", "1.00318"), ("peat", "1.00301")):
                page.select_option("#k-example", key)
                page.wait_for_function(f"document.querySelector('#k-result-table tbody td:nth-child(2)').textContent.startsWith('{want}')", timeout=60_000)
                page.wait_for_timeout(250)
                check(f"{key} example", results(page)[0].startswith(want) and page.locator('#k-table tbody tr').count() == 5
                      and page.input_value("#k-temp") == "298.15", results(page)[0])
                menu = page.locator("#k-sample option").all_inner_texts()
                types = page.locator('#k-measured tbody tr:first-child select option').all_inner_texts()
                check(f"{key}: no WIOM -> no 'Particle' in either menu", menu[0].startswith("A0") and len(menu) == 8
                      and "Particle (online)" not in types, f"{menu[:2]}; {types}")
            if shots:
                page.screenshot(path=str(shots / "kohler_peat.png"), full_page=True)
            page.fill("#k-wiom", "0.2")
            page.wait_for_timeout(200)
            check("WIOM entered -> 'Particle (online)' offered", page.locator("#k-sample option").first.inner_text().startswith("Particle (online)")
                  and "Particle (online)" in page.locator('#k-measured tbody tr:first-child select option').all_inner_texts())
            page.click("#k-reset")
            page.wait_for_function("document.querySelector('#k-wiom').value === '0'")
            wait_done(page)
            check("reset to paper defaults (example reloaded)", page.input_value("#k-wiom") == "0" and results(page)[0].startswith("1.00301"))

            # 8. CSV upload and download
            csv = "log_S,mass_fraction,density,kappa_intr\n0.45,0.6,1.4,0.2\n-2,0.4,1.1,0.1\n"
            page.set_input_files("#k-upload input", files=[{"name": "my_bins.csv", "mimeType": "text/csv", "buffer": csv.encode()}])
            page.wait_for_selector("#k-source.note-ok")
            page.wait_for_function("document.querySelectorAll('#k-table tbody tr').length === 2")
            wait_done(page)
            check("CSV upload", "my_bins.csv" in page.inner_text("#k-source") and page.locator("#k-bars .figure-card").nth(1).locator(".barlayer .point").count() == 2)
            with page.expect_download() as dl:
                page.click("#k-csv")
            head = Path(dl.value.path()).read_text().split("\n")[0]
            check("CSV download", head.startswith("D_nm,s,dissolved_fraction,kappa_eff,eps_"), head)
            page.set_input_files("#k-upload input", files=[{"name": "wrong.csv", "mimeType": "text/csv", "buffer": b"a,b\n1,2\n"}])
            page.wait_for_selector("#k-error:not([hidden])")
            check("wrong file explained", "needs the columns log_S and mass_fraction" in page.inner_text("#k-error"), page.inner_text("#k-error")[:90])

            # 9. chain: ① sends its distribution, ② fills density and κ_intr from the example and runs
            page.click('a[data-route="distribution"]')
            page.wait_for_selector('[data-page="distribution"][data-state="done"]', timeout=120_000)
            page.click("#d-send")
            page.wait_for_selector(f"{PAGE}:not([hidden])")
            page.wait_for_function("document.querySelector('#k-source').textContent.includes('Received distribution')")
            wait_done(page)
            sc = results(page)[0]
            check("distribution from ① arrives and runs", "filled from the example" in page.inner_text("#k-source")
                  and page.locator("#k-table tbody tr").count() == 4 and sc.startswith("1.003"), f"{sc}; {page.inner_text('#k-source')[:60]}")

            # 10. phone width
            page.set_viewport_size({"width": 390, "height": 800})
            page.wait_for_timeout(600)
            width = page.evaluate("document.documentElement.scrollWidth")
            check("fits a phone screen (no sideways scroll)", width <= 392, f"page width {width}px")
            if shots:
                page.screenshot(path=str(shots / "kohler_phone.png"), full_page=True)

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
