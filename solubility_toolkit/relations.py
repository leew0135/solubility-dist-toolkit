"""
relations.py — conversion between K_OW and water solubility S.

    log K_OW = a + b * log S        (S in g cm^-3)

Default: Kenaga & Goring (1980), a = -0.642, b = -0.8 (Kuwata & Lee, 2017).

HOW TO CHANGE
    Use another published relation:  KowSolubilityRelation.preset("coates_1985")
    Use your own numbers:            KowSolubilityRelation(a=-0.5, b=-0.9)
    Add a preset for everyone:       add a line to KOW_S_RELATIONS in config.py
"""
from dataclasses import dataclass

import numpy as np

from . import config


@dataclass(frozen=True)
class KowSolubilityRelation:
    a: float = config.KOW_S_RELATIONS[config.DEFAULT_KOW_S_RELATION][0]
    b: float = config.KOW_S_RELATIONS[config.DEFAULT_KOW_S_RELATION][1]
    name: str = config.DEFAULT_KOW_S_RELATION

    @classmethod
    def preset(cls, name):
        a, b = config.KOW_S_RELATIONS[name]
        return cls(a=a, b=b, name=name)

    def log_s(self, log_kow):
        """log S (g cm^-3) from log K_OW."""
        return (np.asarray(log_kow, dtype=float) - self.a) / self.b

    def log_kow(self, log_s):
        """log K_OW from log S (g cm^-3)."""
        return self.a + self.b * np.asarray(log_s, dtype=float)
