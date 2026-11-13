"""
io.py — read the CSV templates and write results. Standard library + numpy only.

Templates (see README):
  spectra CSV       : mz, A0, A1A0_<Vr>, O1A0_<Vr>, ...       e.g. A1A0_1.78, O1A0_1.78
  alpha CSV         : Vr, alpha[, uncertainty_pct]
  distribution CSV  : log_kow, mass_fraction[, density][, o_c, h_c][, kappa_intr]
"""
import csv
import io as _io

import numpy as np

from .spectra import SpectraUnmixer


def _rows(source):
    text = source if "\n" in str(source) else open(source, newline="", encoding="utf-8-sig").read()
    return list(csv.DictReader(_io.StringIO(text)))


def read_spectra(source, **unmixer_options):
    rows = _rows(source)
    cols = rows[0].keys()
    col = lambda name: np.array([float(r[name]) for r in rows])
    aq = {float(c.split("_", 1)[1]): col(c) for c in cols if c.startswith("A1A0_")}
    oc = {float(c.split("_", 1)[1]): col(c) for c in cols if c.startswith("O1A0_")}
    return SpectraUnmixer(col("mz"), col("A0"), aq, oc, **unmixer_options)


def read_alpha(source):
    rows = _rows(source)
    vr = np.array([float(r["Vr"]) for r in rows])
    alpha = np.array([float(r["alpha"]) for r in rows])
    unc = np.array([float(r.get("uncertainty_pct") or 10) / 100 for r in rows])
    return vr, alpha, unc


def read_distribution(source):
    rows = _rows(source)
    out = {}
    for key in rows[0].keys():
        vals = [r[key] for r in rows]
        if all(v not in ("", None) for v in vals):
            out[key] = np.array([float(v) for v in vals])
    return out


def write_table(rows, path=None):
    """rows: list of dicts -> CSV text (and file if path given)."""
    buf = _io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
    if path:
        with open(path, "w", newline="", encoding="utf-8") as fh:
            fh.write(buf.getvalue())
    return buf.getvalue()
