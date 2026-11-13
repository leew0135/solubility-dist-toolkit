"""
config.py — every default value used by the toolkit, in one place.

HOW TO CHANGE A DEFAULT
    Edit the number here. Every tool (and the website) reads its defaults
    from this file, so a change here changes the "Reset to paper defaults"
    values everywhere. Run `pytest` afterwards: the tests tell you whether
    the published results are still reproduced.

Sources
    Kuwata & Lee (2017) AS&T 51, 602-613         -> partitioning theory, K_OW-S
    Lee, Chen & Kuwata (2020) AS&T 54, 1504-1514 -> inversion, Monte Carlo
    Lee et al. (2022) ES&T 56, 17924-17935       -> Köhler model (eq. 5-7)
    Lee et al. (2023) ES&T 57, 13439-13448       -> alpha-pinene example
"""

# --- K_OW - S relationship: log K_OW = a + b * log S  (S in g cm^-3) -------
# Kenaga & Goring (1980), selected in Kuwata & Lee (2017), Table 1.
KOW_S_RELATIONS = {
    "kenaga_goring_1980": (-0.642, -0.8),
    "valvani_1981": (-0.63, -1.05),
    "coates_1985": (-1.79, -0.94),
    "isnard_lambert_1989": (0.3, -0.72),
}
DEFAULT_KOW_S_RELATION = "kenaga_goring_1980"

# --- Spectra -> alpha (Kuwata & Lee, 2017, eq. 13) ---------------------------
ALPHA_GRID_STEP = 0.01         # alpha is searched on a grid 0, 0.01, ..., 1 (as in the papers)

# --- Kernel (bin-averaged partitioning functions) ----------------------------
KERNEL_GRID_STEP = 0.01        # log K_OW step used to average f_A over a bin (Igor: 0.01)
DEFAULT_BIN_WIDTH = 1.0        # log K_OW units (each bin = centre +/- 0.5)

# --- Monte Carlo inversion (Lee et al., 2020) --------------------------------
MC_ITERATIONS = 10_000
MC_UNCERTAINTY = 0.10          # relative uncertainty on alpha (10 %)
MC_NOISE = "uniform"           # "uniform" or "normal"

# --- Köhler model (Lee et al., 2022, 2023) -----------------------------------
SIGMA_WATER = 0.072            # N m^-1
M_WATER = 0.018                # kg mol^-1
RHO_WATER = 1000.0             # kg m^-3
R_GAS = 8.314                  # J mol^-1 K^-1
TEMPERATURE = 298.0            # K
DEFAULT_DRY_DIAMETER_NM = 100.0  # dry diameter of the Köhler curve shown first (website, examples)
WIOM_LOG_S = -6.0              # water-insoluble OM: S = 1e-6 g cm^-3
AS_SOLUBILITY = 0.744          # ammonium sulfate, g per g water (20 C)
KAPPA_AS = 0.61

# --- kappa_intr fit to measured kappa_CCN (Monte_Carlo_20221117.xlsx) ----------
KFIT_DRAWS = 200                          # random kappa_intr sets per round
KFIT_TOLERANCES = (0.02, 0.01, 0.0075)    # accept a set when sum of squared kappa errors < tolerance; one round each
KFIT_INITIAL_RANGE = (0.0, 0.30)          # kappa_intr range of every bin in the first round

# Wet-diameter grid, "paper" mode (as in the MATLAB code)
PAPER_GRID_POINTS = 1000
PAPER_GRID_DMAX_NM = 5000.0
# Dry diameters scanned to build s_c(D_d) -> kappa_CCN
DRY_DIAMETERS_NM = tuple(range(20, 501, 5))
