"""
kohler.py — tool ②: solubility distribution  ->  Köhler curve, dissolved fraction, kappa.

Solubility distribution model (Riipinen et al., 2015) as used in Lee et al. (2022, eq. 6)
and Lee et al. (2023). For component i with volume fraction f_i, solubility C_i and
intrinsic hygroscopicity kappa_intr,i, at wet diameter D and dry diameter Dd:

    eps_i  = min[1, (D^3/Dd^3 - 1) * C_i / f_i]                 dissolved fraction of bin i
    ln s   = 4 sigma Mw / (R T rho_w D)  -  Dd^3/(D^3 - Dd^3) * sum_i f_i eps_i kappa_intr,i
    s_c    = max over D of s                                     critical saturation ratio
    kappa_CCN = 4 A^3 / (27 Dd^3 ln^2 s_c),  A = 4 sigma_w Mw / (R T rho_w)
                                                                 (Petters & Kreidenweis, 2008)

"paper" settings reproduce Riipinen_model_AP_4bins_20221117_step*.m exactly.

HOW TO CHANGE
    Surface tension, temperature:         KohlerSettings(sigma=0.0657, temperature=298)
    Solubility as volume ratio (S/rho):   KohlerSettings(solubility_units="volume")
    Full kappa-Köhler water activity:     KohlerSettings(raoult="full")
    Finer wet-diameter grid:              KohlerSettings(grid="fine")
    Defaults are in config.py.
"""
from dataclasses import dataclass, field, replace

import numpy as np

from . import config


# --------------------------------------------------------------------------- composition
@dataclass
class Component:
    name: str
    volume_fraction: float
    solubility: float            # g cm^-3 (as in the papers)
    kappa_intr: float
    density: float = None        # g cm^-3; used only for solubility_units="volume"


@dataclass
class Composition:
    """A particle: list of components whose volume fractions sum to 1."""
    components: list
    label: str = ""

    @classmethod
    def from_distribution(cls, distribution, densities, kappa_intr, wiom_fraction=0.0,
                          wiom_kappa=0.0, as_fraction=0.0, label=None):
        """
        Build a particle the way the MATLAB code does:
          1. mass fractions (normalized) -> volume fractions with the bin densities
          2. append water-insoluble OM (WIOM) as volume fraction `wiom_fraction`
          3. prepend ammonium sulfate as volume fraction `as_fraction`
        kappa_intr: one value per WSOM bin (WIOM uses wiom_kappa).
        """
        m = np.asarray(distribution.mass_fraction, dtype=float)
        m = m / m.sum()
        rho = np.broadcast_to(np.asarray(densities, dtype=float), m.shape)
        v = m / rho
        v = v / v.sum()
        kappa = np.broadcast_to(np.asarray(kappa_intr, dtype=float), m.shape)
        comps = [Component(f"logKow={k:g}", float(f), float(s), float(kp), float(r))
                 for k, f, s, kp, r in zip(distribution.log_kow, v, distribution.solubility, kappa, rho)]
        comps.append(Component("WIOM", 0.0, 10.0 ** config.WIOM_LOG_S, float(wiom_kappa)))
        comp = cls(comps, label if label is not None else distribution.label)
        if wiom_fraction:
            comp = comp.with_added("WIOM", wiom_fraction)
        if as_fraction:
            comp.components.insert(0, Component("AS", 0.0, config.AS_SOLUBILITY, config.KAPPA_AS, 1.77))
            comp = comp.with_added("AS", as_fraction)
        return comp

    def with_added(self, name, fraction):
        """Set component `name` to volume fraction `fraction`, rescaling the others."""
        others = sum(c.volume_fraction for c in self.components if c.name != name)
        comps = []
        for c in self.components:
            f = fraction if c.name == name else c.volume_fraction * (1.0 - fraction) / others
            comps.append(replace(c, volume_fraction=f))
        return Composition(comps, self.label)

    def with_kappa(self, kappa_intr):
        """Same particle, new kappa_intr for every component (in order)."""
        return Composition([replace(c, kappa_intr=float(k)) for c, k in zip(self.components, kappa_intr)], self.label)

    @property
    def f(self):
        return np.array([c.volume_fraction for c in self.components])

    @property
    def kappa(self):
        return np.array([c.kappa_intr for c in self.components])

    def solubility(self, units="paper"):
        s = np.array([c.solubility for c in self.components])
        if units == "volume":
            rho = np.array([c.density if c.density else 1.0 for c in self.components])
            s = s / rho
        return s

    @property
    def names(self):
        return [c.name for c in self.components]


# --------------------------------------------------------------------------- settings
@dataclass
class KohlerSettings:
    sigma: float = config.SIGMA_WATER          # surface tension in the Kelvin term
    temperature: float = config.TEMPERATURE
    solubility_units: str = "paper"            # "paper": S in g cm^-3 used directly; "volume": S/rho
    raoult: str = "dilute"                     # "dilute" (paper eq. 6) or "full" kappa-Köhler
    grid: str = "paper"                        # "paper": linear 1000 pts to 5 um; "fine": log-spaced
    dmax_nm: float = config.PAPER_GRID_DMAX_NM
    n_points: int = config.PAPER_GRID_POINTS
    dry_diameters_nm: tuple = field(default=config.DRY_DIAMETERS_NM)

    @property
    def kelvin_A(self):
        return 4 * self.sigma * config.M_WATER / (config.R_GAS * self.temperature * config.RHO_WATER)

    @property
    def kappa_A(self):
        """A in the kappa_CCN conversion; always the surface tension of water (as in the papers)."""
        return 4 * config.SIGMA_WATER * config.M_WATER / (config.R_GAS * self.temperature * config.RHO_WATER)

    def wet_grid_nm(self, dd_nm):
        if self.grid == "paper":
            return np.linspace(dd_nm, self.dmax_nm, self.n_points)
        return np.concatenate([[dd_nm], np.geomspace(dd_nm * 1.0005, self.dmax_nm, 4 * self.n_points)])


# --------------------------------------------------------------------------- results
@dataclass
class KohlerCurve:
    dd_nm: float
    d_nm: np.ndarray             # wet diameters
    s: np.ndarray                # saturation ratio (first point NaN: D = Dd)
    eps: np.ndarray              # (n_D, n_components) dissolved fraction
    composition: Composition

    @property
    def i_crit(self):
        return int(np.nanargmax(self.s))

    @property
    def s_crit(self):
        return float(self.s[self.i_crit])

    @property
    def d_act_nm(self):
        return float(self.d_nm[self.i_crit])

    def dissolved_fraction(self, i=None):
        """Total dissolved volume fraction of the particle at index i (default: s_c)."""
        i = self.i_crit if i is None else i
        return float(np.sum(self.composition.f * self.eps[i]))

    def kappa_contribution(self, i):
        """f_i * eps_i * kappa_intr,i at index i (sum = kappa_eff at that D)."""
        return self.composition.f * self.eps[i] * self.composition.kappa

    def phase_state(self, i, threshold=1e-3):
        return "two phases (LLPS)" if 1.0 - self.dissolved_fraction(i) > threshold else "single aqueous phase"


# --------------------------------------------------------------------------- model
class KohlerModel:
    def __init__(self, composition, settings=None):
        self.composition = composition
        self.settings = settings or KohlerSettings()

    def _ln_s(self, d_m, dd_m, eps):
        st = self.settings
        comp = self.composition
        keff = (comp.f * eps * comp.kappa).sum(axis=-1)
        with np.errstate(divide="ignore", invalid="ignore"):
            if st.raoult == "dilute":
                raoult = -(dd_m ** 3 / (d_m ** 3 - dd_m ** 3)) * keff
            else:
                raoult = np.log((d_m ** 3 - dd_m ** 3) / (d_m ** 3 - dd_m ** 3 * (1.0 - keff)))
            return st.kelvin_A / d_m + raoult

    def _eps(self, d_m, dd_m):
        comp = self.composition
        c = comp.solubility(self.settings.solubility_units)
        f = comp.f
        g = ((d_m ** 3 - dd_m ** 3) / dd_m ** 3)[..., None]
        with np.errstate(divide="ignore", invalid="ignore"):
            e = np.where(f > 0, g * c / np.where(f > 0, f, 1.0), 1.0)
        return np.clip(e, 0.0, 1.0)

    def curve(self, dd_nm):
        d_nm = self.settings.wet_grid_nm(dd_nm)
        d_m, dd_m = d_nm * 1e-9, dd_nm * 1e-9
        eps = self._eps(d_m, dd_m)
        ln_s = self._ln_s(d_m, dd_m, eps)
        ln_s[0] = np.nan                      # D = Dd: undefined (MATLAB gives NaN here too)
        return KohlerCurve(float(dd_nm), d_nm, np.exp(ln_s), eps, self.composition)

    def critical_table(self, dry_diameters_nm=None):
        """For each Dd: critical supersaturation (%) and apparent kappa_CCN."""
        dds = np.asarray(dry_diameters_nm or self.settings.dry_diameters_nm, dtype=float)
        ss, kap = [], []
        A = self.settings.kappa_A
        for dd in dds:
            c = self.curve(dd)
            ln_sc = np.log(c.s_crit)
            ss.append((c.s_crit - 1.0) * 100.0)
            kap.append(4 * A ** 3 / (27 * (dd * 1e-9) ** 3 * ln_sc ** 2))
        return dds, np.array(ss), np.array(kap)

    def kappa_at_ss(self, ss_percent):
        """Apparent kappa_CCN at the given supersaturations (%), as compared with CCNC data."""
        _, ss, kap = self.critical_table()
        order = np.argsort(ss)
        return np.interp(np.asarray(ss_percent, dtype=float), ss[order], kap[order])
