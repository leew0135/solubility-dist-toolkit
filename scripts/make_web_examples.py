"""
make_web_examples.py — writes the example spectra files of the website (web/examples/*.csv).

WHAT IT DOES
    The paper data in data/ keep their original column names (A1A0[1.78], O1A0[1.78]_ME2 ...)
    and several versions of the octanol-phase spectra. The website (and io.read_spectra)
    expects the template format:  mz, A0, A1A0_<Vr>, O1A0_<Vr>, ...
    This script copies the chosen columns into that format. data/ is never changed.

HOW TO USE (from the solubility-toolkit folder)
    python scripts/make_web_examples.py

HOW TO CHANGE
    Which octanol-phase version each example uses -> the `octanol` entry in EXAMPLES
    (a text that the column name must contain, after "O1A0[<Vr>]_").
    Add an example -> add an entry here, then add it to web/examples/examples.json.
"""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "examples"

EXAMPLES = {
    # ME-2 background-removed O1A0 (SI S1 of Lee et al., 2023): gives alpha = 0.44 / 0.55 / 0.66 / 0.77
    "alpha_pinene_spectra.csv": dict(source="data/alpha_pinene/AP_mass_spectra.csv",
                                     vr=["1.78", "0.32", "0.06", "0.01"], octanol="ME2"),
    # octanol-removed PMF factor ("case c" in data/README_NGO.md; the paper used case b)
    "mosquito_coil_spectra.csv": dict(source="data/mosquito_coil/MC_mass_spectra.csv",
                                      vr=["10", "5", "1", "0.1", "0.01"], octanol="PMF"),
    # raw average O1A0 (data/README_NGO.md)
    "peat_spectra.csv": dict(source="data/peat/Peat_mass_spectra.csv",
                             vr=["10", "5", "1", "0.1", "0.01"], octanol="avg"),
}
TEMPLATE = dict(name="spectra_template.csv", source="alpha_pinene_spectra.csv", columns=5, rows=8)
# small files that show the column names expected by pages ① and ② (alpha-pinene values)
OTHER_TEMPLATES = {
    "alpha_template.csv": "Vr,alpha,uncertainty_pct\n1.78,0.44,10\n0.32,0.55,10\n0.06,0.66,10\n0.01,0.77,10\n",
    "distribution_template.csv": "log_S,mass_fraction,density,kappa_intr\n0.4475,0.475,1.393,0.200\n-0.8025,0.089,1.146,0.068\n"
                                 "-2.0525,0.109,1.146,0.079\n-3.3025,0.223,1.146,0.109\n",
}


def convert(name, source, vr, octanol):
    rows = list(csv.DictReader(open(ROOT / source, encoding="utf-8-sig")))
    header, picks = ["mz", "A0"], ["mz", "A0"]
    for v in vr:
        o1 = [c for c in rows[0] if c.startswith(f"O1A0[{v}]_{octanol}")]
        if len(o1) != 1 and not (o1 and octanol == "PMF"):
            raise SystemExit(f"{source}: expected one O1A0[{v}]_{octanol} column, found {o1}")
        header += [f"A1A0_{v}", f"O1A0_{v}"]
        picks += [f"A1A0[{v}]", o1[0]]
    with open(OUT / name, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows([[r[c] for c in picks] for r in rows])
    print(f"wrote web/examples/{name}  ({len(rows)} m/z, Vr = {', '.join(vr)})")


def template():
    lines = open(OUT / TEMPLATE["source"], encoding="utf-8").read().splitlines()[: TEMPLATE["rows"] + 1]
    text = "\n".join(",".join(line.split(",")[: 2 + 2 * 2]) for line in lines) + "\n"
    (OUT / TEMPLATE["name"]).write_text(text, encoding="utf-8")
    print(f"wrote web/examples/{TEMPLATE['name']}")
    for name, text in OTHER_TEMPLATES.items():
        (OUT / name).write_text(text, encoding="utf-8")
        print(f"wrote web/examples/{name}")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, spec in EXAMPLES.items():
        convert(name, **spec)
    template()
