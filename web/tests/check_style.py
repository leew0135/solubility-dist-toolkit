"""
check_style.py — opens the style page (#/style, author tool) in a real browser and checks it.

HOW TO USE (from the solubility-toolkit folder)
    python web/tests/check_style.py                    # prints PASS / FAIL lines
    python web/tests/check_style.py --shots out_folder # also saves screenshots

WHAT IS CHECKED
    every figure of figure_styles.js has a live preview and its controls; changing a common
    setting, a figure's own setting and an override redraws the preview at once; "Undo all changes"
    restores the saved look; the downloaded file equals the file on disk when nothing was changed,
    and after a change it is a valid module whose styleFor() gives exactly what the page showed.

HOW TO CHANGE
    What is checked -> the numbered blocks in main().  Server / browser start -> check_engine.py.
"""
import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_engine import BASE, ROOT, start_server   # noqa: E402

PAGE = '[data-page="style"]'
# runs in the page: load a figure_styles.js text as a module and return what styleFor() gives
LOAD = """async (text) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
  const m = await import(url);
  return { fig: m.styleFor("kohler_curve"), dist: m.styleFor("solubility_distribution"), names: Object.keys(m.FIGURES) };
}"""


def download(page):
    with page.expect_download() as dl:
        page.click("#y-download")
    return Path(dl.value.path()).read_text(encoding="utf-8")


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

            # 1. every figure has a preview and controls
            page.goto(BASE + "#/style")
            page.wait_for_selector(f'{PAGE}[data-state="done"], {PAGE}[data-state="error"]', timeout=240_000)
            page.wait_for_timeout(500)
            cards = page.locator(".style-card").count()
            plots = page.locator(".style-card .js-plotly-plot").count()
            check("13 figures, 12 Plotly previews + the particle drawing", cards == 13 and plots == 12
                  and page.locator('[data-figure="particle_cartoon"] svg').count() == 1, f"{cards} cards, {plots} plots")
            check("style_options.js covers figure_styles.js", not page.is_visible("#y-problems"), page.inner_text("#y-problems") if page.is_visible("#y-problems") else "")
            check("17 common settings", page.locator("#y-default .style-row").count() == 17)
            check("status: no changes", page.get_attribute(PAGE, "data-changed") == "false")
            if shots:
                page.screenshot(path=str(shots / "style.png"), full_page=True)

            # 2. unchanged download = the file on disk
            disk = (ROOT / "web" / "styles" / "figure_styles.js").read_text(encoding="utf-8")
            check("download without changes = file on disk", download(page) == disk)

            # 3. a figure's own setting redraws its preview
            kc = '[data-figure="kohler_curve"]'
            stroke = lambda: page.evaluate(f"getComputedStyle(document.querySelector('{kc} .scatterlayer .trace path.js-line')).stroke")
            before = stroke()
            page.locator(f'{kc} [data-part="parts"] input[type="color"]').first.fill("#cc0000")
            page.wait_for_timeout(300)
            check("own setting (curve colour) redraws at once", before != stroke() and stroke() == "rgb(204, 0, 0)", f"{before} -> {stroke()}")

            # 4. a common setting redraws every preview
            size = lambda: page.evaluate("""document.querySelector('[data-figure="partition_kernel"] .xtitle').style.fontSize""")
            s0 = size()
            page.select_option("#y-default .style-row:has(label:text-is('font size')) select", label="18")
            page.wait_for_timeout(800)
            check("common setting (font size) redraws all", s0 == "16px" and size() == "18px"
                  and page.locator(".style-card .js-plotly-plot").count() == 12, f"{s0} -> {size()}")

            # 5. override a common setting for one figure, then remove it
            sd = '[data-figure="solubility_distribution"]'
            page.select_option(f'{sd} [data-part="add"]', "aspect")
            page.select_option(f'{sd} [data-part="overrides"] .style-row:has(label:text-is("aspect")) select', label="16:9")
            page.wait_for_timeout(400)
            box = page.locator(f"{sd} .js-plotly-plot .nsewdrag").first.bounding_box()
            check("override (aspect 16:9) for one figure", abs(box["width"] / box["height"] - 16 / 9) < 0.05, f"{box['width']:.0f} x {box['height']:.0f}")
            check("status: changed", page.get_attribute(PAGE, "data-changed") == "true" and "not saved" in page.inner_text("#y-status"))
            if shots:
                page.locator(sd).screenshot(path=str(shots / "style_changed.png"))

            # 6. the downloaded file is a valid module and says what the page shows
            text = download(page)
            got = page.evaluate(LOAD, text)
            check("downloaded file loads and holds the changes", got["fig"]["parts"]["curve_color"] == "#CC0000" and got["fig"]["font_size"] == 18
                  and got["dist"]["aspect"] == "16:9" and got["dist"]["grid"] == "none" and len(got["names"]) == 13,
                  f"curve {got['fig']['parts']['curve_color']}, font {got['fig']['font_size']}, aspect {got['dist']['aspect']}")
            check("downloaded file keeps the notes", '// options: "1:1", "4:3", "3:2", "16:9"' in text and "export function styleFor(name)" in text)

            # 7. remove the override, undo everything
            page.click(f'{sd} [data-part="overrides"] .style-row:has(label:text-is("aspect")) button')
            page.wait_for_timeout(300)
            box = page.locator(f"{sd} .js-plotly-plot .nsewdrag").first.bounding_box()
            check("override removed -> common aspect again", abs(box["width"] / box["height"] - 1) < 0.05)
            page.click("#y-reset")
            page.wait_for_timeout(800)
            check("undo all changes", page.get_attribute(PAGE, "data-changed") == "false" and download(page) == disk and stroke() == before)

            # 8. the real pages are not affected after a reload
            page.goto(BASE + "#/distribution")
            page.reload()
            page.wait_for_selector('[data-page="distribution"][data-state="done"]', timeout=180_000)
            check("site still works after using the tool", page.locator("#d-dist .barlayer .point").count() == 4)

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
