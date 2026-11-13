"""
Worked example: alpha-pinene SOM (Lee et al., ES&T 2023), steps ① and ②.
Run from the package folder:   python examples/alpha_pinene.py
"""
from solubility_toolkit import (Kernel, Inversion, SolubilityDistribution, Composition,
                                KohlerModel)

# ① alpha -> solubility distribution --------------------------------------------
vr = [1.78, 0.32, 0.06, 0.01]                 # V_octanol / V_aqueous
alpha = [0.44, 0.555, 0.66, 0.77]             # mass fraction in the aqueous phase
kernel = Kernel(vr, bin_centers=[-1, 0, 1, 2])
result = Inversion(kernel).monte_carlo(alpha, uncertainty=0.10, n=10000, seed=1)

print("log K_OW  log S   mean    SD     normalized")
for row in result.table():
    print(f"{row['log_kow']:6.0f}  {row['log_s']:6.2f}  {row['mean']:.3f}  {row['sd']:.3f}  {row['normalized']:.3f}")

# ② distribution -> Köhler -------------------------------------------------------
a0 = result.distribution().normalized()
densities = [1.393, 1.146, 1.146, 1.146]       # g cm^-3 (from O/C, H/C of the ME-2 factors)
kappa_intr = [0.200, 0.068, 0.079, 0.109]      # per bin (Lee et al., 2023)
particle = Composition.from_distribution(a0, densities, kappa_intr,
                                         wiom_fraction=0.07, wiom_kappa=0.137, label="online")
model = KohlerModel(particle)
curve = model.curve(dd_nm=100)
print(f"\nDd = 100 nm: s_c = {curve.s_crit:.5f}, D_act = {curve.d_act_nm:.0f} nm, "
      f"dissolved at s_c = {curve.dissolved_fraction():.3f} ({curve.phase_state(curve.i_crit)})")
print("kappa_CCN at SS 0.35/0.48/0.60/0.77 %:", model.kappa_at_ss([0.35, 0.48, 0.60, 0.77]).round(3))
