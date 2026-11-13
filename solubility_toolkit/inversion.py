"""
inversion.py — tool ①: alpha at several Vr  ->  K_OW (solubility) distribution.

    alpha_Vr = sum_j  K[Vr, j] * F_j  + e,     F_j >= 0        (Lee et al., 2020, eq. 4-5)

F is found by non-negative least squares (NNLS). Because the problem is
ill-posed, the reported result is a Monte Carlo mean +/- SD: alpha is perturbed
within its uncertainty many times and NNLS is solved for each perturbation.

HOW TO CHANGE
    Number of iterations / uncertainty / noise type:
        Inversion(kernel).monte_carlo(alpha, n=10000, uncertainty=0.10, noise="uniform")
    Reproduce a run exactly:        ... monte_carlo(..., seed=42)
    Reproduce the MATLAB scripts:   ... monte_carlo(..., ranges=[(0.40, 0.48), ...], discrete_percent=True)
        (MATLAB drew alpha with randi([lo, hi])/100, i.e. whole percents.)
    Defaults live in config.py.
"""
from dataclasses import dataclass

import numpy as np

from . import config
from .nnls import nnls
from .distribution import SolubilityDistribution


@dataclass
class InversionResult:
    """Output of a Monte Carlo inversion."""
    kernel: object
    alpha: np.ndarray            # central alpha values used
    samples: np.ndarray          # (n, n_bins) NNLS solution of every iteration
    central: np.ndarray          # NNLS solution of the central alpha (reported in CSV only)

    @property
    def mean(self):
        return self.samples.mean(axis=0)

    @property
    def sd(self):
        return self.samples.std(axis=0, ddof=1)

    def distribution(self, relation=None):
        """Monte Carlo mean as a SolubilityDistribution (not normalized)."""
        kw = {} if relation is None else {"relation": relation}
        return SolubilityDistribution(self.kernel.bin_centers, self.mean, sd=self.sd, **kw)

    def table(self, relation=None):
        """Rows: log K_OW, log S, mean, SD, normalized mean, central-value NNLS."""
        d = self.distribution(relation)
        norm = d.normalized().mass_fraction
        return [
            {"log_kow": float(k), "log_s": round(float(s), 2), "mean": float(m),
             "sd": float(sd), "normalized": float(nm), "central_nnls": float(c)}
            for k, s, m, sd, nm, c in zip(d.log_kow, d.log_s, self.mean, self.sd, norm, self.central)
        ]


class Inversion:
    def __init__(self, kernel):
        self.kernel = kernel

    def solve(self, alpha):
        """Single NNLS solve for one alpha vector."""
        x, _ = nnls(self.kernel.matrix, np.asarray(alpha, dtype=float))
        return x

    def monte_carlo(self, alpha, n=config.MC_ITERATIONS, uncertainty=config.MC_UNCERTAINTY,
                    noise=config.MC_NOISE, seed=None, ranges=None, discrete_percent=False):
        """
        alpha        : central alpha for each Vr, in kernel.vr order
        uncertainty  : relative; scalar or one value per Vr. uniform -> +/-u, normal -> 1 SD = u
        ranges       : optional explicit (low, high) per Vr; overrides uncertainty (uniform)
        """
        alpha = np.asarray(alpha, dtype=float)
        if alpha.size != self.kernel.vr.size:
            raise ValueError("alpha needs one value per volume ratio in the kernel")
        rng = np.random.default_rng(seed)

        if ranges is not None:
            lo, hi = np.asarray(ranges, dtype=float).T
            if discrete_percent:
                draws = rng.integers(np.rint(lo * 100), np.rint(hi * 100) + 1, size=(n, alpha.size)) / 100.0
            else:
                draws = rng.uniform(lo, hi, size=(n, alpha.size))
        else:
            u = np.broadcast_to(np.asarray(uncertainty, dtype=float), alpha.shape)
            if noise == "uniform":
                draws = alpha * (1.0 + rng.uniform(-u, u, size=(n, alpha.size)))
            elif noise == "normal":
                draws = alpha * (1.0 + u * rng.standard_normal(size=(n, alpha.size)))
            else:
                raise ValueError("noise must be 'uniform' or 'normal'")
            draws = np.clip(draws, 0.0, 1.0)

        samples = np.array([self.solve(d) for d in draws])
        return InversionResult(self.kernel, alpha, samples, self.solve(alpha))
