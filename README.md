# Solubility Distribution Toolkit

Retrieve the water-solubility distribution of water-soluble organic matter (WSOM)
from 1-octanol–water partitioning experiments, and use it in Köhler theory.
The same code runs on the website (in the browser, via Pyodide) and on your computer.

| Step | What it does | Main class | File |
|---|---|---|---|
| ⓪ | normalized AMS spectra of A0, A1A0, O1A0 → α | `SpectraUnmixer` | `spectra.py` |
| ① | α at several Vr → solubility distribution (NNLS + Monte Carlo) | `Kernel`, `Inversion` | `kernel.py`, `inversion.py` |
| ② | distribution → Köhler curve, dissolved fraction ε, κ_CCN | `Composition`, `KohlerModel` | `kohler.py` |
| ② fit | measured κ_CCN → κ_intr per bin | `KappaIntrinsicFitter` | `kappa_fit.py` |

Requires Python ≥ 3.9 and numpy. (scipy is used only to cross-check the tests.)

```bash
pip install -e .          # from this folder
python examples/alpha_pinene.py
pytest -q                 # checks that the published results are reproduced
```

## The website

`web/` is a website that runs this package in the browser (Pyodide): nothing is installed and no
data leave the visitor's computer. Three tool tabs (⓪ ① ②), Read me (theory and equations) and
How to cite.

```bash
python scripts/build_web.py --serve      # then open http://localhost:8000
```

Opening `web/index.html` by double-click does not work (browsers block it); use the command above.

| I want to change… | Where |
|---|---|
| title, contact e-mail, GitHub link, version | `web/js/config.js` (`SITE`) |
| the look of the figures | open `http://localhost:8000/#/style`, try the options, download the new `figure_styles.js` into `web/styles/`; or edit that file by hand |
| colours and spacing of the pages | variables at the top of `web/styles/site.css` |
| example data offered on the pages | `web/examples/examples.json` (spectra files: `scripts/make_web_examples.py`) |
| the papers on "How to cite" | `web/js/references.js` |
| a calculation | `solubility_toolkit/` only, then `pytest` and `python scripts/build_web.py` |

After any change in `solubility_toolkit/`, run `python scripts/build_web.py`: the website loads its own
copy of the package (`web/py/solubility_toolkit.zip`), and `pytest` fails until that copy is up to date.

Browser checks (need `pip install playwright` and `playwright install chromium`):
`python web/tests/check_engine.py`, `check_spectra.py`, `check_distribution.py`, `check_kohler.py`,
`check_info.py`, `check_style.py`, `check_sync.py`. Each prints PASS / FAIL lines.

Deployment: `vercel.json` serves `web/` as a static site (no build step). Everything the site needs,
including Pyodide, numpy, Plotly and KaTeX, is in `web/vendor/`.

## Repository layout

```
solubility_toolkit/   the Python package (all calculations; defaults in config.py)
tests/                pytest: reproduces the published results
examples/             alpha_pinene.py: the package used from Python
data/                 data of the papers used by the examples and tests (see data/README_*.md)
scripts/              build_web.py (website build and preview), make_web_examples.py
web/                  the website (index.html, js/, py/web_api.py, styles/, examples/, vendor/, tests/)
```

## Where to change what

| I want to change… | Where |
|---|---|
| any default number (σ, T, Monte Carlo iterations, ±10 %, WIOM solubility…) | `solubility_toolkit/config.py` |
| the K_OW–S relationship | `KowSolubilityRelation(a=…, b=…)` or a preset in `config.KOW_S_RELATIONS` |
| volume ratios or bins | `Kernel(vr=[…], bin_centers=[…], bin_width=1)` |
| uncertainty / noise type / reproducible runs | `Inversion(kernel).monte_carlo(alpha, uncertainty=0.1, noise="uniform", seed=42)` |
| densities from O/C and H/C | `density_from_oc_hc(o_c, h_c)` in `distribution.py` |
| solubility units, Raoult form, wet-diameter grid | `KohlerSettings(solubility_units=…, raoult=…, grid=…)` |
| κ_intr fitting rounds and tolerances | `KappaIntrinsicFitter(…, tolerances=(0.02, 0.01, 0.0075), draws=200)` |
| CSV column names | `io.py` |

Each file starts with a comment that names the equation it implements and the paper it comes from.

## Defaults (as in the original papers)

- Partitioning: f_A = 1/(Vr·K_OW + 1); kernel = average of f_A over each bin (±0.5 log K_OW, step 0.01).
- K_OW–S: log K_OW = −0.642 − 0.8 log S (Kenaga & Goring, 1980); uncertainty Δlog S ≈ ±0.39.
- Inversion: NNLS (Lawson–Hanson, as MATLAB `lsqnonneg`); Monte Carlo, ±10 % uniform noise on α, 10 000 iterations; result = mean ± SD, normalized before step ②.
- Köhler: solubility-distribution model of Riipinen et al. (2015) as in Lee et al. (2022, eq. 6): dilute Raoult term; S in g cm⁻³ used directly in ε; WIOM S = 10⁻⁶ g cm⁻³; σ = 0.072 N m⁻¹; T = 298 K; κ_CCN from s_c with the surface tension of water.

## Validation (tests/test_against_paper.py)

| Check | Reference | Agreement |
|---|---|---|
| kernels, 5-bin and α-pinene 4-bin | Igor `K_Sol_4/5` (.pxp) | < 2 × 10⁻⁶ |
| NNLS | `scipy.optimize.nnls` | < 10⁻⁹ |
| α-pinene distribution | `AP_Kow_dist_high_conc_20221025.m` | within Monte Carlo noise |
| κ_CCN, 5 fractions × 4 SS | `Monte_Carlo_20221117.xlsx` (step_2) | relative 10⁻⁶ |
| s_c, D_act, dissolved fraction at 100 nm | same, `step2_online_ep_dist` | exact |

## Data

`data/` and `web/examples/` contain data of Lee et al. (2022, 2023): AMS mass spectra of the
partitioned fractions, PMF / ME-2 factors, retrieved distributions and measured κ. Sources and
known issues are described in `data/README_NGO.md` and `data/alpha_pinene/README_AP.md`.
If you use these data themselves, cite the corresponding paper.

## License

Code: MIT (see `LICENSE`). Libraries in `web/vendor/` keep their own licenses
(Pyodide MPL-2.0, NumPy BSD-3-Clause, Plotly.js MIT, KaTeX MIT).

## Please cite

Kuwata & Lee (2017) *AS&T* 51, 602–613 · Lee et al. (2019) *ES&T* 53, 8047–8056 ·
Lee, Chen & Kuwata (2020) *AS&T* 54, 1504–1514 · Lee et al. (2022) *ES&T* 56, 17924–17935 ·
Lee et al. (2023) *ES&T* 57, 13439–13448.
