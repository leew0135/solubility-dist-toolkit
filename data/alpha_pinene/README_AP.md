# α-pinene SOM demo data (Lee et al., 2023 ES&T, doi 10.1021/acs.est.3c03039)

Everything here comes from the master workbook the paper's figures and tables were built from:
Dropbox `/Backup/PKU DATA (D) backup 20211206/2017_Stephen_analysis_redo/ToDo_high_conc.xlsx`
(sheets `UMR_MS_noNaNs`, `alpha`, `ME2_try11`, `O2C`, `O2C_PMF`, `density_kappa`).

## AP_mass_spectra.csv
UMR spectra (SQUIRREL), m/z 12–200 (NaN m/z removed), each column normalised to sum 1.
- `A0` = sample A0_1235_V (the "high_conc" A0 used in the paper; not the older AP0823_A0)
- `A1A0[Vr]`, `O1A0[Vr]_raw` (octanol background still included), `O1A0[Vr]_ME2` (background removed by ME-2, SI S1), Vr = 1.78 / 0.32 / 0.06 / 0.01
- Check against SI Table S1 (m/z 43/44/55): all 11 solutions match to the 4th decimal.

## α (fraction of A1A0 in A0)
| Vr | 1.78 | 0.32 | 0.06 | 0.01 |
|---|---|---|---|---|
| α | 0.44 | 0.55 | 0.66 | 0.77 |
| Monte Carlo range (±10%, `AP_Kow_dist_high_conc_20221025.m`) | 0.40–0.48 | 0.50–0.61 | 0.59–0.73 | 0.69–0.85 |

Method: grid search (step 0.01) minimising Σ(α·A1A0 + (1−α)·O1A0_ME2 − A0)² over all m/z. Running it on this CSV gives exactly 0.44 / 0.55 / 0.66 / 0.77.

## AP_ME2_factor_spectra.csv / AP_ME2_factor_fractions.csv
The 3-factor ME-2 solution of SI Fig. S7 (`ME2_try11 run7`), UMR, each profile sums to 1.
Factor 1 = O1A0 blank (octanol), Factor 2 = highly oxygenated/highly soluble, Factor 3 = less oxygenated.
The fractions file gives each factor's share of every solution, with and without the blank factor.

| Factor | O/C | H/C | density (g cm⁻³) |
|---|---|---|---|
| Factor 2 (high O/C) | 0.660 | 1.508 | 1.393 |
| Factor 3 (low O/C) | 0.321 | 1.603 | 1.146 |

Factor O/C and H/C come from `O2C_PMF_20221102.m`. They were fitted so that the factor-fraction-weighted sums reproduce the measured A1A0/A0 ratios; for A0 this gives 0.430 against the measured 0.431. Density uses Kuwata et al. (2012).

## AP_params.json
α values and ranges, solution O/C and H/C (SI Table S2), and the factor properties above.
