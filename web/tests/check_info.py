"""
check_info.py — opens "Read me" and "How to cite" in a real browser (Playwright) and checks them.

HOW TO USE (from the solubility-toolkit folder)
    python web/tests/check_info.py                    # prints PASS / FAIL lines
    python web/tests/check_info.py --shots out_folder # also saves screenshots

WHAT IS CHECKED
    Read me: every equation is typeset (no KaTeX error), numbers come from config.py, the three
    template files download and are accepted by the Python package, section links work.
    How to cite: five papers with DOI links; the .bib / .enw / .ris files contain all five;
    copy buttons put the text on the clipboard.

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
from solubility_toolkit import io as toolkit_io     # noqa: E402


def main(shots):
    out, errors = [], []
    check = lambda name, ok, note="": out.append((name, bool(ok), note))
    server = start_server()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            context = browser.new_context(viewport={"width": 1280, "height": 1000}, accept_downloads=True)
            context.grant_permissions(["clipboard-read", "clipboard-write"])
            page = context.new_page()
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.route("**/*", lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())

            # 1. Read me: equations
            page.goto(BASE + "#/readme")
            page.wait_for_selector('[data-engine-state="ready"]', timeout=180_000)
            page.wait_for_timeout(500)
            n_eq = page.locator('[data-page="readme"] .equation .katex-display').count()
            n_err = page.locator('[data-page="readme"] .katex-error').count()
            check("equations typeset with KaTeX", n_eq == 15 and n_err == 0, f"{n_eq} equations, {n_err} errors")
            widths = page.evaluate("[...document.querySelectorAll('[data-page=readme] .equation')].map(e => [e.scrollWidth, e.clientWidth])")
            check("KaTeX fonts loaded (local copy)", page.evaluate("document.fonts.check('16px KaTeX_Main')"))
            text = page.inner_text('[data-page="readme"]')
            check("defaults quoted from config.py", "a=−0.642" in text.replace(" ", "") and "10,000" in text and "0.02 → 0.01 → 0.0075" in text)
            if shots:
                page.screenshot(path=str(shots / "readme.png"), full_page=True)

            # 2. section links
            page.click('.toc a:has-text("Theory")')
            page.wait_for_timeout(300)
            top = page.evaluate("document.querySelector('#theory').getBoundingClientRect().top")
            check("section link scrolls to Theory", abs(top) < 5 and page.is_visible('[data-page="readme"]'), f"top {top:.0f}px")

            # 3. templates download and are accepted by the package
            got = {}
            for name in ("spectra_template.csv", "alpha_template.csv", "distribution_template.csv"):
                with page.expect_download() as dl:
                    page.click(f"text={name}")
                got[name] = Path(dl.value.path()).read_text()
            ok = (len(toolkit_io.read_spectra(got["spectra_template.csv"]).vr) == 2
                  and len(toolkit_io.read_alpha(got["alpha_template.csv"])[0]) == 4
                  and "kappa_intr" in toolkit_io.read_distribution(got["distribution_template.csv"]))
            check("three templates download and load in the Python package", ok)

            # 4. phone width (equations scroll inside their box)
            page.set_viewport_size({"width": 390, "height": 800})
            page.wait_for_timeout(400)
            width = page.evaluate("document.documentElement.scrollWidth")
            check("Read me fits a phone screen", width <= 392, f"page width {width}px")
            page.set_viewport_size({"width": 1280, "height": 1000})

            # 5. How to cite
            page.click('a[data-route="cite"]')
            page.wait_for_selector('[data-page="cite"]:not([hidden])')
            links = page.locator('[data-page="cite"] .ref-list a').evaluate_all("els => els.map(e => e.href)")
            check("five papers with DOI links", len(links) == 5 and all(u.startswith("https://doi.org/10.") for u in links), str(links[-1]))
            files = {}
            for ext in ("bib", "enw", "ris"):
                with page.expect_download() as dl:
                    page.click(f'button[data-file="{ext}"]')
                files[ext] = Path(dl.value.path()).read_text()
            check("BibTeX: 5 entries", files["bib"].count("@article{") == 5 and "author = {Kuwata, Mikinori and Lee, Wen-Chien}" in files["bib"]
                  and "pages = {17924--17935}" in files["bib"])
            check("EndNote: 5 entries", files["enw"].count("%0 Journal Article") == 5 and "%R 10.1021/acs.est.3c03039" in files["enw"])
            check("RIS: 5 entries", files["ris"].count("TY  - JOUR") == 5 and files["ris"].count("ER  - ") == 5 and "SP  - 602" in files["ris"])
            page.click('button[data-copy="methods"]')
            page.wait_for_timeout(200)
            clip = page.evaluate("navigator.clipboard.readText()")
            check("copy Methods text", clip.startswith("Water-solubility distributions were retrieved") and "v0.1.0" in clip, clip[-40:])
            page.click('button[data-copy-ref="2"]')
            page.wait_for_timeout(200)
            clip = page.evaluate("navigator.clipboard.readText()")
            check("copy one reference", clip.startswith("Lee, W.-C., Chen, J. and Kuwata, M. (2020)") and clip.endswith("10.1080/02786826.2020.1795482"), clip[:60])
            if shots:
                page.screenshot(path=str(shots / "cite.png"), full_page=True)

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
