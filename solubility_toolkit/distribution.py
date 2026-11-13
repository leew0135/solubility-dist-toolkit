"""
distribution.py — a solubility (K_OW) distribution and what can be derived from it.

    SolubilityDistribution(log_kow, mass_fraction)   one sample, e.g. A0
      .log_s                 bin positions on the log S axis (via the K_OW-S relation)
      .normalized()          scaled to sum to 1 (done before Köhler modelling)
      .aqueous_phase(kernel, vr)  distribution of A1A0 at that Vr  (F_j * f_A,j, normalized)
      .octanol_phase(kernel, vr)  distribution of O1A0 at that Vr  (F_j * f_O,j, normalized)

    density_from_oc_hc(o_c, h_c)  organic density (g cm^-3), Kuwata et al. (2012):
        rho = (12 + H/C + 16 O/C) / (7 + 5 H/C + 4.15 O/C)
"""
import numpy as np

from .relations import KowSolubilityRelation


def density_from_oc_hc(o_c, h_c):
    """Density in g cm^-3 from elemental ratios (Kuwata, Zorn & Martin, 2012)."""
    o_c = np.asarray(o_c, dtype=float)
    h_c = np.asarray(h_c, dtype=float)
    return (12.0 + h_c + 16.0 * o_c) / (7.0 + 5.0 * h_c + 4.15 * o_c)


class SolubilityDistribution:
    def __init__(self, log_kow, mass_fraction, sd=None, relation=None, label=""):
        self.log_kow = np.asarray(log_kow, dtype=float)
        self.mass_fraction = np.asarray(mass_fraction, dtype=float)
        self.sd = None if sd is None else np.asarray(sd, dtype=float)
        self.relation = relation or KowSolubilityRelation()
        self.label = label
        if self.log_kow.shape != self.mass_fraction.shape:
            raise ValueError("log_kow and mass_fraction must have the same length")

    @property
    def log_s(self):
        return self.relation.log_s(self.log_kow)

    @property
    def solubility(self):
        """S in g cm^-3."""
        return 10.0 ** self.log_s

    def normalized(self):
        total = self.mass_fraction.sum()
        sd = None if self.sd is None else self.sd / total
        return SolubilityDistribution(self.log_kow, self.mass_fraction / total, sd, self.relation, self.label)

    def _split(self, weights, label):
        f = self.mass_fraction * weights
        return SolubilityDistribution(self.log_kow, f / f.sum(), None, self.relation, label)

    def aqueous_phase(self, kernel, vr):
        return self._split(kernel.row(vr), f"A1A0[{vr:g}]")

    def octanol_phase(self, kernel, vr):
        return self._split(1.0 - kernel.row(vr), f"O1A0[{vr:g}]")

    def __repr__(self):
        return f"SolubilityDistribution({self.label!r}, log_kow={self.log_kow.tolist()}, mass_fraction={np.round(self.mass_fraction, 4).tolist()})"
