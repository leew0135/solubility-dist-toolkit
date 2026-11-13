"""
test_web_build.py — the website runs the same Python code as this package.

The website loads web/py/solubility_toolkit.zip (made by scripts/build_web.py). This test
fails when a file in solubility_toolkit/ was changed but the zip was not rebuilt, so the
website and the package can never quietly disagree.

If it fails:   python scripts/build_web.py    then run pytest again.
"""
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_website_zip_matches_the_package():
    package = {f"solubility_toolkit/{p.name}": p.read_bytes() for p in (ROOT / "solubility_toolkit").glob("*.py")}
    with zipfile.ZipFile(ROOT / "web" / "py" / "solubility_toolkit.zip") as zf:
        in_zip = {name: zf.read(name) for name in zf.namelist()}
    stale = sorted(n for n in package if in_zip.get(n) != package[n])
    extra = sorted(n for n in in_zip if n not in package)
    assert not stale and not extra, (
        f"web/py/solubility_toolkit.zip is out of date (changed: {stale}, removed: {extra}). "
        "Run: python scripts/build_web.py")


def test_package_version_matches_the_website():
    import re
    init = (ROOT / "solubility_toolkit" / "__init__.py").read_text(encoding="utf-8")
    site = (ROOT / "web" / "js" / "config.js").read_text(encoding="utf-8")
    toml = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    v_pkg = re.search(r'__version__\s*=\s*"([^"]+)"', init).group(1)
    v_site = re.search(r'version:\s*"([^"]+)"', site).group(1)
    v_toml = re.search(r'^version\s*=\s*"([^"]+)"', toml, re.M).group(1)
    assert v_pkg == v_site == v_toml, f"versions differ: package {v_pkg}, website {v_site}, pyproject {v_toml}"
