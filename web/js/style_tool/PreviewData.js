/*
 * PreviewData.js — example data and figure classes for the previews on the style page.
 *
 * WHAT IT DOES
 *   loadPreviewData(engine) runs the α-pinene example once through the real Python code
 *   (small Monte Carlo and a very short κ fit, so it takes a few seconds) and returns, for
 *   every key of figure_styles.js, the data its figure class needs. PREVIEW_CLASSES says which
 *   class draws which key. The previews therefore show real figures, not mock-ups.
 *
 * HOW TO CHANGE
 *   A new figure            -> add its class to PREVIEW_CLASSES and its data to loadPreviewData().
 *   Faster / finer previews -> SETTINGS below.
 *   Which example is shown  -> EXAMPLE.
 */
import { SpectraComparisonFigure } from "../plots/SpectraComparisonFigure.js";
import { SseFigure } from "../plots/SseFigure.js";
import { ReconScatterFigure } from "../plots/ReconScatterFigure.js";
import { PartitionKernelFigure } from "../plots/PartitionKernelFigure.js";
import { SolubilityDistributionFigure } from "../plots/SolubilityDistributionFigure.js";
import { AlphaFitFigure } from "../plots/AlphaFitFigure.js";
import { McHistogramFigure } from "../plots/McHistogramFigure.js";
import { KohlerCurveFigure } from "../plots/KohlerCurveFigure.js";
import { DissolvedBarsFigure, KappaContributionFigure } from "../plots/ComponentBarsFigure.js";
import { KappaFitFigure, KappaIntrHistogramFigure } from "../plots/KappaFitFigures.js";
import { TWO_PHASE_THRESHOLD } from "../ui/ParticleCartoon.js";

const EXAMPLE = "alpha_pinene";
const SETTINGS = {
  mc_iterations: 2000,                        // page ① preview
  exclude_mz: "12-20",                        // so the "not used in fit" colour is visible
  fit: { draws: 8, tolerances: [0.3], seed: 1 },   // loose and short: only to have points to draw
};

/** figure_styles.js key -> class that draws it ("particle_cartoon" is not a Plotly figure: see style_page.js). */
export const PREVIEW_CLASSES = {
  spectra_comparison: SpectraComparisonFigure, sse_vs_alpha: SseFigure, recon_vs_measured: ReconScatterFigure,
  partition_kernel: PartitionKernelFigure, solubility_distribution: SolubilityDistributionFigure,
  alpha_fit: AlphaFitFigure, mc_histograms: McHistogramFigure,
  kohler_curve: KohlerCurveFigure, dissolved_fraction_bars: DissolvedBarsFigure,
  kappa_contribution_bars: KappaContributionFigure, kappa_fit_scatter: KappaFitFigure,
  kappa_intr_histograms: KappaIntrHistogramFigure,
};

const signed = (v) => String(Number(Number(v).toFixed(2))).replace("-", "−");

export async function loadPreviewData(engine) {
  const [defaults, examples] = await Promise.all([
    engine.call("defaults"),
    fetch("examples/examples.json", { cache: "no-cache" }).then((r) => r.json()),
  ]);
  const ex = examples[EXAMPLE];

  // ⓪ spectra
  const csv = await fetch(ex.spectra.file, { cache: "no-cache" }).then((r) => r.text());
  const unmix = await engine.call("unmix", { csv_text: csv, exclude: SETTINGS.exclude_mz });
  const fit0 = unmix.fits[0];

  // ① inversion
  const inv = await engine.call("invert", {
    vr: ex.alpha.vr, alpha: ex.alpha.value, uncertainty: ex.alpha.vr.map(() => defaults.MC_UNCERTAINTY),
    bin_centers: ex.bin_centers, n: SETTINGS.mc_iterations, seed: 1,
  });

  // ② Köhler
  const k = ex.kohler;
  const [a, b] = defaults.KOW_S_RELATIONS[defaults.DEFAULT_KOW_S_RELATION];
  const bins = k.log_kow.map((kow, i) => ({ log_s: (kow - a) / b, mass_fraction: k.mass_fraction[i], density: k.density[i], kappa_intr: k.kappa_intr[i] }));
  const particle = { bins, wiom_fraction: k.wiom_fraction, wiom_kappa: k.wiom_kappa, temperature: k.temperature };
  const curve = await engine.call("kohler", { ...particle, ss_percent: k.ss_percent });
  const ic = curve.critical.index;
  const first = (test) => curve.d_nm.findIndex((_, i) => i > 0 && test(i));
  const near = first((i) => curve.s[i] >= 0.99), full = first((i) => 1 - curve.dissolved[i] <= TWO_PHASE_THRESHOLD);
  const marks = [near, ic, full].filter((i) => i > 0).map((index, n) => ({ index, label: ["i", "ii", "iii"][n] }));
  const shown = curve.components.map((c, i) => ({ ...c, i })).filter((c) => c.volume_fraction > 0);
  const labels = shown.map((c) => (c.kind === "WSOM" ? `log S = ${signed(c.log_s)}` : c.kind));
  const eps = shown.map((c) => curve.eps[ic][c.i]);

  // ② κ fit (very short)
  let fit = null;
  try {
    fit = await engine.call("kappa_fit", { ...particle, measured: k.measured, ...SETTINGS.fit });
  } catch (err) { fit = null; }
  const fitOk = fit && fit.ok;

  return {
    spectra_comparison: { ...fit0, excluded: unmix.excluded },
    sse_vs_alpha: { ...fit0, uncertainty: unmix.settings.mc_uncertainty },
    recon_vs_measured: fit0,
    partition_kernel: inv.kernel,
    solubility_distribution: inv,
    alpha_fit: inv.alpha_fit,
    mc_histograms: { centers: inv.histograms.centers, width: inv.histograms.width, fraction: inv.histograms.fraction[0] },
    kohler_curve: { d_nm: curve.d_nm, s: curve.s, index: ic, marks, two_phase_until_nm: full > 0 ? curve.d_nm[full] : null },
    particle_cartoon: { d_nm: curve.d_nm[ic], dd_nm: curve.dd_nm, dmax_nm: curve.d_nm[curve.d_nm.length - 1], undissolved: 1 - curve.dissolved[ic] },
    dissolved_fraction_bars: { labels, eps },
    kappa_contribution_bars: {
      labels, values: shown.map((c, n) => c.volume_fraction * eps[n] * c.kappa_intr),
      max: Math.max(...shown.map((c) => c.volume_fraction * c.kappa_intr)),
    },
    kappa_fit_scatter: fitOk ? { samples: fit.samples } : null,
    kappa_intr_histograms: fitOk ? { values: fit.accepted.map((row) => row[1]), mean: fit.mean[1], step: 0.01 } : null,
  };
}
