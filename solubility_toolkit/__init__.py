"""
Solubility Distribution Toolkit

Retrieve the water-solubility distribution of water-soluble organic matter from
1-octanol-water partitioning experiments, and use it in Köhler theory.

    ⓪ SpectraUnmixer        mass spectra            -> alpha        (spectra.py)
    ① Kernel + Inversion    alpha at several Vr     -> distribution (kernel.py, inversion.py)
    ② KohlerModel           distribution            -> Köhler curve, eps, kappa (kohler.py)
       KappaIntrinsicFitter  measured kappa          -> kappa_intr   (kappa_fit.py)

All default values: config.py.  Method papers: see README.md.
"""
from .relations import KowSolubilityRelation
from .kernel import Kernel, fraction_aqueous, fraction_octanol
from .nnls import nnls
from .spectra import SpectraUnmixer, parse_exclusions
from .distribution import SolubilityDistribution, density_from_oc_hc
from .inversion import Inversion, InversionResult
from .kohler import Component, Composition, KohlerSettings, KohlerModel, KohlerCurve
from .kappa_fit import KappaIntrinsicFitter

__version__ = "0.1.0"
