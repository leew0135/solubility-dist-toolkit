"""
kappa_fit.py — fit kappa_intr of each solubility bin to measured kappa_CCN.

Procedure (Monte_Carlo_20221117.xlsx, Lee et al., 2022, 2023):
  each round:
    1. draw a random kappa_intr for every bin, uniformly within that bin's range
       (whole percents, as randi(...)/100 in MATLAB)
    2. model kappa_CCN for every sample at its measured supersaturations
    3. accept the set if  sum over samples and SS of (kappa_meas - kappa_model)^2  < tolerance
  next round: range = accepted mean +/- SD; tolerance tightens.
  final kappa_intr = mean of the sets accepted in the last round.

Defaults follow the Excel file: 200 draws per round, ranges 0-0.30,
tolerances 0.02 -> 0.01 -> 0.0075.

The fit is slow (draws x rounds x samples Köhler models). fit(progress=f) calls
f(done, total) after every draw, so a program can show how far it is.

HOW TO CHANGE
    defaults for all fits:   config.py (KFIT_DRAWS, KFIT_TOLERANCES, KFIT_INITIAL_RANGE)
    one fit:                 KappaIntrinsicFitter(samples, measured, tolerances=(0.02, 0.01, 0.0075), draws=200)
"""
from dataclasses import dataclass

import numpy as np

from . import config
from .kohler import KohlerModel


@dataclass
class FitRound:
    ranges: np.ndarray        # (n_bins, 2)
    tolerance: float
    draws: np.ndarray         # (n, n_bins)
    score: np.ndarray         # (n,)
    accepted: np.ndarray      # bool (n,)


@dataclass
class FitResult:
    rounds: list

    @property
    def last(self):
        return self.rounds[-1]

    @property
    def ok(self):
        """False when fewer than 2 sets were accepted: use more draws or a looser tolerance."""
        return self.n_accepted >= 2

    @property
    def mean(self):
        return self.last.draws[self.last.accepted].mean(axis=0) if self.ok else None

    @property
    def sd(self):
        return self.last.draws[self.last.accepted].std(axis=0, ddof=1) if self.ok else None

    @property
    def n_accepted(self):
        return int(self.last.accepted.sum())


class KappaIntrinsicFitter:
    def __init__(self, samples, measured, settings=None, tolerances=config.KFIT_TOLERANCES,
                 draws=config.KFIT_DRAWS, initial_range=config.KFIT_INITIAL_RANGE):
        # initial_range: (low, high) for all bins, or one (low, high) row per bin
        """
        samples  : {name: Composition}   (e.g. "online", "A0", "A1A0[1.78]", ...)
        measured : {name: (ss_percent list, kappa list)}  — same names; missing names are skipped
        """
        self.samples = samples
        self.measured = {k: (np.asarray(v[0], float), np.asarray(v[1], float)) for k, v in measured.items()}
        self.settings = settings
        self.tolerances = tolerances
        self.draws = draws
        self.initial_range = initial_range

    def score(self, kappa_intr):
        total = 0.0
        for name, (ss, kap) in self.measured.items():
            comp = self.samples[name].with_kappa(kappa_intr)
            model = KohlerModel(comp, self.settings).kappa_at_ss(ss)
            total += float(np.sum((kap - model) ** 2))
        return total

    def model_vs_measured(self, kappa_intr):
        """{name: (ss, measured, modelled)} for the scatter plot."""
        out = {}
        for name, (ss, kap) in self.measured.items():
            comp = self.samples[name].with_kappa(kappa_intr)
            out[name] = (ss, kap, KohlerModel(comp, self.settings).kappa_at_ss(ss))
        return out

    def fit(self, seed=None, progress=None):
        """progress: optional function(done, total), called after every draw (total = draws x rounds)."""
        rng = np.random.default_rng(seed)
        done, total = 0, self.draws * len(self.tolerances)
        n_bins = len(next(iter(self.samples.values())).components)
        r0 = np.asarray(self.initial_range, float)
        ranges = r0.copy() if r0.ndim == 2 else np.tile(r0, (n_bins, 1))
        rounds = []
        for tol in self.tolerances:
            lo = np.rint(ranges[:, 0] * 100)
            hi = np.rint(ranges[:, 1] * 100)
            draws = rng.integers(lo, hi + 1, size=(self.draws, n_bins)) / 100.0
            score = np.empty(self.draws)
            for i, k in enumerate(draws):
                score[i] = self.score(k)
                done += 1
                if progress is not None:
                    progress(done, total)
            accepted = score < tol
            rounds.append(FitRound(ranges.copy(), tol, draws, score, accepted))
            if accepted.sum() >= 2:
                acc = draws[accepted]
                m, s = acc.mean(axis=0), acc.std(axis=0, ddof=1)
                ranges = np.column_stack([np.maximum(0.0, m - s), m + s])
        return FitResult(rounds)
