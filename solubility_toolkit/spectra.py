"""
spectra.py — tool ⓪: mass spectra  ->  alpha (Kuwata & Lee, 2017, eq. 13).

For each volume ratio the measured A0 spectrum is fitted as a mixture of the
aqueous-phase (A1A0) and octanol-phase (O1A0) spectra:

    min_alpha  sum_mz [ I_A0 - alpha * I_A1A0 - (1 - alpha) * I_O1A0 ]^2,   0 <= alpha <= 1

alpha = mass fraction of WSOM that partitioned to the aqueous phase. Only the
spectral shapes are used (each spectrum is normalized to unit sum), so
solution concentrations or dilution do not affect alpha.

As in the papers, alpha is found by a grid search: the sum of squared residuals
(SSE) is computed for alpha = 0, 0.01, ..., 1 and the smallest one is taken.
sse_curve() returns that whole curve (the "fit error vs alpha" figure).
With step=None the exact least-squares minimum is returned instead; it differs
from the grid value by less than half a step.

HOW TO CHANGE
    m/z window:          SpectraUnmixer(..., mz_min=12, mz_max=150)
    remove ions:         SpectraUnmixer(..., exclude="12-40, 57, 69-71")
    no renormalizing:    SpectraUnmixer(..., renormalize=False)
    finer / coarser alpha grid:  unmixer.fit(vr, step=0.001)   (default: config.ALPHA_GRID_STEP)
    exact minimum (no grid):     unmixer.fit(vr, step=None)
"""
from dataclasses import dataclass

import numpy as np

from . import config


def parse_exclusions(text):
    """'12-40, 57, 69-71' -> [(12, 40), (57, 57), (69, 71)]"""
    out = []
    for part in (text or "").replace(";", ",").split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            out.append((float(lo), float(hi)))
        else:
            out.append((float(part), float(part)))
    return out


@dataclass
class UnmixResult:
    vr: float
    alpha: float
    mz: np.ndarray
    measured: np.ndarray         # A0 (normalized, after exclusions)
    reconstructed: np.ndarray    # alpha * A1A0 + (1 - alpha) * O1A0
    r_squared: float
    slope: float                 # reconstructed vs measured, through origin
    sse: float = None            # sum of squared residuals at this alpha


class SpectraUnmixer:
    def __init__(self, mz, a0, aqueous, octanol, mz_min=None, mz_max=None,
                 exclude="", renormalize=True):
        """
        mz       : m/z values
        a0       : A0 spectrum
        aqueous  : {Vr: A1A0 spectrum}
        octanol  : {Vr: O1A0 spectrum}
        """
        self.mz = np.asarray(mz, dtype=float)
        keep = np.ones(self.mz.size, dtype=bool)
        if mz_min is not None:
            keep &= self.mz >= mz_min
        if mz_max is not None:
            keep &= self.mz <= mz_max
        for lo, hi in parse_exclusions(exclude):
            keep &= ~((self.mz >= lo) & (self.mz <= hi))
        self.keep = keep
        self.renormalize = renormalize
        self.a0 = self._prep(a0)
        if set(aqueous) != set(octanol):
            raise ValueError("every Vr needs both an A1A0 and an O1A0 spectrum")
        self.aqueous = {float(v): self._prep(s) for v, s in aqueous.items()}
        self.octanol = {float(v): self._prep(s) for v, s in octanol.items()}

    def _prep(self, spectrum):
        s = np.asarray(spectrum, dtype=float)[self.keep]
        return s / s.sum() if self.renormalize else s

    @property
    def vr(self):
        return sorted(self.aqueous, reverse=True)

    def sse_curve(self, vr, step=config.ALPHA_GRID_STEP):
        """(alpha grid, SSE at each alpha): sum over m/z of [alpha*A1A0 + (1-alpha)*O1A0 - A0]^2."""
        a1, o1, a0 = self.aqueous[vr], self.octanol[vr], self.a0
        alphas = np.round(np.arange(0.0, 1.0 + step / 2.0, step), 10)
        residual = alphas[:, None] * (a1 - o1)[None, :] + (o1 - a0)[None, :]
        return alphas, np.sum(residual ** 2, axis=1)

    def fit(self, vr, step=config.ALPHA_GRID_STEP):
        """
        alpha for one volume ratio.
        step : grid step of the search (papers: 0.01); None = exact least-squares minimum.
        """
        a1, o1, a0 = self.aqueous[vr], self.octanol[vr], self.a0
        if step:
            alphas, sse = self.sse_curve(vr, step)
            alpha = float(alphas[int(np.argmin(sse))])
        else:
            d = a1 - o1
            alpha = float(np.clip(np.dot(a0 - o1, d) / np.dot(d, d), 0.0, 1.0))
        rec = alpha * a1 + (1.0 - alpha) * o1
        ss_res = np.sum((a0 - rec) ** 2)
        ss_tot = np.sum((a0 - a0.mean()) ** 2)
        slope = float(np.dot(a0, rec) / np.dot(a0, a0))
        return UnmixResult(vr, alpha, self.mz[self.keep], a0, rec, float(1.0 - ss_res / ss_tot), slope, float(ss_res))

    def fit_all(self, step=config.ALPHA_GRID_STEP):
        return [self.fit(v, step) for v in self.vr]
