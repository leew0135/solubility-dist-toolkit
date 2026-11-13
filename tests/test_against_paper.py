"""
Validation: the package must reproduce Leew's original Igor / MATLAB / Excel results.
Run with:   pytest -q
"""
import numpy as np
import pytest

from solubility_toolkit import (Kernel, Inversion, nnls, SolubilityDistribution,
                                Composition, KohlerModel, KohlerSettings, SpectraUnmixer,
                                parse_exclusions, density_from_oc_hc)

# --------------------------------------------------------------------------- kernels
# K_fun_1st from 20181107_Kow_Theory_Kernel_5bins.pxp (Vr 10, 5, 1, 0.1, 0.01; log K_OW -2..2)
IGOR_5BINS = np.array([
    [0.893893, 0.5, 0.106107, 0.0121973, 0.00123889],
    [0.942871, 0.651675, 0.18658, 0.0239854, 0.00247344],
    [0.987803, 0.893893, 0.5, 0.106107, 0.0121973],
    [0.998761, 0.987803, 0.893893, 0.5, 0.106107],
    [0.999876, 0.998761, 0.987803, 0.893893, 0.5],
])
# K_fun_1st + k_A1_5 from AP_kernel_4bins_20220909.pxp (Vr 1.78, 0.32, 0.06, 0.01; log K_OW -1..2)
IGOR_AP = np.array([
    [0.82949, 0.372717, 0.0635786, 0.0069043],
    [0.962375, 0.737894, 0.257895, 0.0367884],
    [0.992631, 0.932494, 0.613242, 0.161906],
    [0.998761, 0.987803, 0.893893, 0.5],
])
AP_VR = [1.78, 0.32, 0.06, 0.01]


def test_kernel_5bins_matches_igor():
    k = Kernel([10, 5, 1, 0.1, 0.01], [-2, -1, 0, 1, 2])
    assert np.allclose(k.matrix, IGOR_5BINS, atol=2e-6)


def test_kernel_ap_matches_igor():
    k = Kernel(AP_VR, [-1, 0, 1, 2])
    assert np.allclose(k.matrix, IGOR_AP, atol=2e-6)


# --------------------------------------------------------------------------- NNLS
def test_nnls_matches_scipy():
    scipy_nnls = pytest.importorskip("scipy.optimize").nnls
    rng = np.random.default_rng(0)
    for _ in range(300):
        A = rng.random((5, 5))
        b = rng.random(5)
        assert np.allclose(nnls(A, b)[0], scipy_nnls(A, b)[0], atol=1e-9)
    for _ in range(300):                       # the real, ill-conditioned kernel
        b = rng.uniform(0.3, 0.9, 4)
        assert np.allclose(nnls(IGOR_AP, b)[0], scipy_nnls(IGOR_AP, b)[0], atol=1e-9)


# --------------------------------------------------------------------------- inversion
def test_ap_monte_carlo_matches_matlab():
    """AP_Kow_dist_high_conc_20221025.m (ME2_10%) -> dist_AP_A0 used in the Köhler code."""
    inv = Inversion(Kernel(AP_VR, [-1, 0, 1, 2]))
    res = inv.monte_carlo([0.44, 0.555, 0.66, 0.77], n=10000, seed=1,
                          ranges=[(0.40, 0.48), (0.50, 0.61), (0.59, 0.73), (0.69, 0.85)],
                          discrete_percent=True)
    matlab = [0.475017629, 0.088952705, 0.109490529, 0.223205736]
    assert np.allclose(res.mean, matlab, atol=0.006)       # Monte Carlo noise ~0.002


# --------------------------------------------------------------------------- Köhler
def ap_samples():
    k = Kernel(AP_VR, [-1, 0, 1, 2])
    a0 = SolubilityDistribution([-1, 0, 1, 2], [0.475017629, 0.088952705, 0.109490529, 0.223205736], label="A0")
    rho = [1.393064595, 1.146406521, 1.146406521, 1.146406521]
    kap = [0.2, 0.067818182, 0.078545455, 0.108909091]
    wk = 0.137090909
    s = {"online": Composition.from_distribution(a0, rho, kap, wiom_fraction=0.07, wiom_kappa=wk, label="online"),
         "A0": Composition.from_distribution(a0, rho, kap, wiom_kappa=wk)}
    for vr in (1.78, 0.32, 0.06):
        d = a0.aqueous_phase(k, vr)
        s[d.label] = Composition.from_distribution(d, rho, kap, wiom_kappa=wk)
    return s


# Monte_Carlo_20221117.xlsx, sheet step_2, mat_kappa_model
EXCEL_KAPPA = {
    "online": [0.111376953372691, 0.11110314821002, 0.111216560163934, 0.111582153430636],
    "A0": [0.119744826685943, 0.119301067250044, 0.11930994117585, 0.119700547591085],
    "A1A0[1.78]": [0.186970008530357, 0.187605533270122, 0.188223025066514, 0.189179035991668],
    "A1A0[0.32]": [0.174759256439689, 0.175398325620654, 0.176072282340588, 0.176924060223075],
    "A1A0[0.06]": [0.160973981564719, 0.160172263303603, 0.1599880748292, 0.160230140582409],
}
SS_ONLINE = [0.351718437, 0.4806735, 0.603655162, 0.771566928]
SS_FRACTIONS = [0.329479, 0.458184, 0.586997, 0.769875]


@pytest.mark.parametrize("name", list(EXCEL_KAPPA))
def test_kappa_ccn_matches_excel(name):
    comp = ap_samples()[name]
    ss = SS_ONLINE if name == "online" else SS_FRACTIONS
    model = KohlerModel(comp).kappa_at_ss(ss)
    assert np.allclose(model, EXCEL_KAPPA[name], rtol=1e-6)


def test_online_100nm_critical_point_matches_excel():
    """step2_online_ep_dist: Sc 1.0035 at D 394.29 nm, dissolved fraction 0.70464."""
    c = KohlerModel(ap_samples()["online"]).curve(100)
    assert c.s_crit == pytest.approx(1.0035, abs=5e-5)
    assert c.d_act_nm == pytest.approx(394.29429, abs=1e-3)
    assert c.dissolved_fraction() == pytest.approx(0.70464, abs=5e-5)


def test_kappa_fit_progress_does_not_change_the_result():
    """fit(progress=...) reports every draw and gives the same numbers as fit() with the same seed."""
    from solubility_toolkit.kappa_fit import KappaIntrinsicFitter
    samples = {k: v for k, v in ap_samples().items() if k in ("online", "A0")}
    measured = {"online": (SS_ONLINE, EXCEL_KAPPA["online"]), "A0": (SS_FRACTIONS, EXCEL_KAPPA["A0"])}
    fitter = KappaIntrinsicFitter(samples, measured, draws=4, tolerances=(1.0, 0.5))
    seen = []
    with_progress = fitter.fit(seed=3, progress=lambda done, total: seen.append((done, total)))
    plain = fitter.fit(seed=3)
    assert seen == [(i, 8) for i in range(1, 9)]
    assert np.array_equal(with_progress.last.draws, plain.last.draws)
    assert np.allclose(with_progress.last.score, plain.last.score)
    # the paper's kappa_intr reproduce the Excel kappa exactly, so their score is ~0
    paper = np.array([0.2, 0.067818182, 0.078545455, 0.108909091, 0.137090909])
    assert fitter.score(paper) < 1e-10


def test_volume_units_option_changes_little():
    comp = ap_samples()["online"]
    paper = KohlerModel(comp).kappa_at_ss(SS_ONLINE)
    vol = KohlerModel(comp, KohlerSettings(solubility_units="volume")).kappa_at_ss(SS_ONLINE)
    assert np.all(np.abs(vol / paper - 1) < 0.01)


# --------------------------------------------------------------------------- spectra
def test_unmixer_recovers_known_alpha():
    rng = np.random.default_rng(3)
    mz = np.arange(12, 151)
    a1, o1 = rng.random(mz.size), rng.random(mz.size)
    a1, o1 = a1 / a1.sum(), o1 / o1.sum()
    a0 = 0.37 * a1 + 0.63 * o1
    u = SpectraUnmixer(mz, a0, {1.0: a1}, {1.0: o1}, renormalize=False)
    r = u.fit(1.0)
    assert r.alpha == pytest.approx(0.37, abs=1e-12)
    assert r.r_squared == pytest.approx(1.0)


def _ap_unmixer(**options):
    """alpha-pinene spectra of the paper (data/alpha_pinene), O1A0 after ME-2 background removal."""
    import csv
    from pathlib import Path
    path = Path(__file__).resolve().parents[1] / "data" / "alpha_pinene" / "AP_mass_spectra.csv"
    rows = list(csv.DictReader(open(path, encoding="utf-8-sig")))
    col = lambda name: np.array([float(r[name]) for r in rows])
    return SpectraUnmixer(col("mz"), col("A0"), {v: col(f"A1A0[{v}]") for v in AP_VR},
                          {v: col(f"O1A0[{v}]_ME2") for v in AP_VR}, **options)


def test_ap_alpha_grid_search_matches_paper():
    """Lee et al. (2023): alpha = 0.44 / 0.55 / 0.66 / 0.77 by grid search (step 0.01) over all m/z."""
    u = _ap_unmixer()
    assert [r.alpha for r in u.fit_all()] == pytest.approx([0.44, 0.55, 0.66, 0.77], abs=1e-12)
    # the paper's result does not depend on cutting the spectrum at m/z 150
    assert [r.alpha for r in _ap_unmixer(mz_max=150).fit_all()] == pytest.approx([0.44, 0.55, 0.66, 0.77], abs=1e-12)


def test_sse_curve_and_exact_minimum_agree():
    u = _ap_unmixer()
    for vr in AP_VR:
        alphas, sse = u.sse_curve(vr)
        grid, exact = u.fit(vr), u.fit(vr, step=None)
        assert alphas[0] == 0.0 and alphas[-1] == 1.0 and alphas.size == 101
        assert grid.sse == pytest.approx(sse.min())
        assert abs(grid.alpha - exact.alpha) <= 0.005 + 1e-12      # within half a grid step
        assert exact.sse <= grid.sse + 1e-15                        # exact minimum is never worse


def test_parse_exclusions():
    assert parse_exclusions("12-40, 57, 69-71") == [(12, 40), (57, 57), (69, 71)]


def test_density_formula():
    # Kuwata et al. (2012); O/C 0.66, H/C 1.508 -> 1.393 (AP factor 1)
    assert density_from_oc_hc(0.66, 1.5078) == pytest.approx(1.39306, abs=1e-4)
