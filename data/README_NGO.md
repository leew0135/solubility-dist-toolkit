# NGO Kow_dist demo data (2022 ES&T, mosquito coil & peat)

Experiments: Nagoya University, May–Jun 2019. Analysis: PKU, 2020–2022.

## Files
| File | Content |
|---|---|
| `MC_mass_spectra.csv` | MC HR-ToF-AMS UMR spectra, m/z 41–214 (NaN m/z removed), each column sums to 1. A0, A1A0[Vr], O1A0[Vr]_avg (raw average), O1A0[Vr]_PMF (octanol-removed O1 factor) |
| `Peat_mass_spectra.csv` | Same for peat. O1A0[10] also has the two selected runs; O1A0[5], [1] have PMF (fpeak −0.1/0/+0.1) and SoFi versions |
| `MC_PMF_factor_spectra.csv`, `Peat_PMF_factor_spectra.csv` | WSOM PMF factor profiles (Fig S10/S11), fpeak 0 |
| `PMF_factor_fractions.csv` | Factor fractions in each solution (Fig S12) |
| `kow_nnls_check.py` | NNLS Kow inversion (port of `a_MC/P_Kow_dist_5bins_20200611.m`); reproduces SI Tables S5/S6/S12 |
| `kohler_params.json` | All Köhler-model inputs: solubility, kernel, Kow distributions, bin densities, κ_intr, O/C & H/C, measured κ_HGF / κ_CCN |
| `kohler_model.py` | Python port of `Riipinen_model_application_*.m`; reproduces SI Table S7/S9 model values |

## α actually used in the paper (mass fraction of WSOM in aqueous phase), Vr = 10 / 5 / 1 / 0.1 / 0.01
- MC (case b "KL17", ±10% Monte Carlo): 0.47–0.57 / 0.51–0.63 / 0.64–0.78 / 0.86–0.99 / 0.89–0.99
- Peat: 0.36–0.38 / 0.41–0.43 / 0.50–0.52 / 0.60–0.62 / 0.78–0.80

Reconstruction check (m/z ≥ 41, A0 = α·A1A0 + (1−α)·O1A0):
- MC with O1A0 PMF columns → 0.48 / 0.56 / 0.72 / 0.94 / 1.00 (= case c, not the paper's case b)
- Peat with O1A0_avg → 0.50 / 0.44 / 0.52 / 0.62 / 0.80 (Vr 5–0.01 match; Vr 10 source of 0.37 not identified)

## Known SI issue
Table S6 (peat) A0 row duplicates Table S5 (MC). Correct peat A0 volume fraction ≈ 0.241 / 0.168 / 0.049 / 0.041 / 0.502.

## Original sources (Dropbox: /Backup/PKU DATA (D) backup 20211206/ALLDATA/)
- Spectra: `Data_analysis/AMS_data_analysis/MC/AMS_MS_reconstruction_20200610.pxp` (exported), `.../peat/Peat_ams_sq/P_AMS_MS_collection_20200513.xlsx` (sheet PMF_SoFi_collection)
- PMF factors: `.../MC/MC_A0A1O1_PMF_20200603/MC_A0A1O1_PMF_TS_20200603.xlsx`, `.../peat/Peat_ams_sq/P_A0A1O1_PMF_20200603/P_A0A1O1_PMF_TS_20200610_2fac.xlsx`
- Kow NNLS: `Data_analysis/NGO_Dist/a_MC_Kow_dist_5bins_20200611.m`, `bb_err_estimation_randi_5bins.m`
- Köhler: `Modeling/20220624_kappa_sfc_fit/MC/Riipinen_model_application_20220624_MC_test1.m`, `.../peat/Riipinen_model_application_20220403_Peat_test1.m` (R3 σ check: `Modeling/R3_sfc_check/`)
