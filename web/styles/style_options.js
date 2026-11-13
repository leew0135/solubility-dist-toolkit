/*
 * style_options.js — describes every setting of figure_styles.js: what it is and which values are allowed.
 *
 * WHAT IT IS FOR
 *   1. The style page (address #/style, for the author only) builds its buttons and menus from this file.
 *   2. When the style page writes a new figure_styles.js, the "// options: …" notes and the short
 *      description of every figure come from here.
 *   figure_styles.js holds the VALUES; this file holds the CHOICES. The website itself (the figures)
 *   never reads this file.
 *
 * HOW TO CHANGE
 *   Allow another value (e.g. font size 20)       -> add it to the `options` of that setting.
 *   Add a setting to a figure                      -> add it under that figure's `parts` here, give it a value
 *                                                     in figure_styles.js, and use it in the figure's class
 *                                                     in js/plots/ (this.parts.<name>).
 *   Kinds of setting:  choice (options: [...]) · number (min, max, step) · color · bool · text ·
 *                      colors (a group of named colours)
 *   `note` is the comment written next to the value in figure_styles.js.
 */
const LINES = ["dashed", "dotted", "solid", "none"];
const MARKERS = ["circle", "circle_open", "square", "square_open", "diamond", "diamond_open", "triangle"];
const choice = (options, note = "") => ({ kind: "choice", options, note });
const number = (min, max, step, note = "") => ({ kind: "number", min, max, step, note });
const color = (note = "") => ({ kind: "color", note });
const bool = (note = "") => ({ kind: "bool", note });
const text = (note = "") => ({ kind: "text", note });

/** Settings every figure has (figure_styles.js: DEFAULT). A figure may override any of them. */
export const COMMON = {
  aspect: choice(["1:1", "4:3", "3:2", "16:9"], "shape of the plot area (width : height)"),
  width_px: number(240, 1000, 20, "largest plot width on screen; height follows aspect"),
  font_family: text("as in CSS; the first font found on the visitor's computer is used"),
  font_size: choice([10, 12, 14, 16, 18], "axis titles; tick labels = font_size - 2"),
  axis_line_width: choice([0.8, 1, 1.5, 2]),
  data_line_width: choice([1, 1.5, 2, 3]),
  marker_size: number(3, 16, 1, "px"),
  frame: choice(["box", "L"], '"box" = all four sides, "L" = left + bottom only'),
  ticks: choice(["outside", "inside"]),
  tick_length: number(2, 12, 1, "px"),
  minor_ticks: bool(),
  grid: choice(["none", "light"]),
  grid_color: color(),
  palette: choice(["okabe_ito", "viridis", "tableau", "grays"], "any key of PALETTES"),
  legend: choice(["inside_upper_right", "inside_upper_left", "inside_lower_left", "inside_lower_right", "outside_right", "none"]),
  background: color(),
  png_scale: number(1, 6, 1, "PNG download = screen size x png_scale pixels (3 ≈ 300 dpi at 8.6 cm)"),
};

/** The pages, in the order used in figure_styles.js. */
export const PAGES = {
  spectra: "Page ⓪ Spectra -> α",
  distribution: "Page ① α -> solubility distribution",
  kohler: "Page ② distribution -> Köhler",
};

/** One entry per figure: where it is, what it shows, and its own settings ("parts"). */
export const FIGURE_OPTIONS = {
  spectra_comparison: {
    page: "spectra", title: "Measured vs reconstructed spectrum", about: "measured A0 vs α·A1A0 + (1−α)·O1A0, per m/z",
    parts: {
      measured_color: color(), reconstructed_color: color(),
      bar_or_stick: choice(["stick", "bar"]), excluded_mz_color: color("m/z left out of the fit"),
    },
  },
  sse_vs_alpha: {
    page: "spectra", title: "Fit error vs α", about: "residual vs α for the Vr shown",
    parts: {
      minimum_marker: choice(["circle", "diamond", "none"]),
      show_mc_range: bool("shade the α range that page ① samples by default"),
      mc_range_opacity: number(0, 1, 0.05),
    },
  },
  recon_vs_measured: {
    page: "spectra", title: "Reconstructed vs measured", about: "reconstructed vs measured A0, one point per m/z, 1:1 line",
    parts: { marker: choice(MARKERS), marker_color: color(), one_to_one_line: choice(LINES), one_to_one_color: color() },
  },

  partition_kernel: {
    page: "distribution", title: "Partitioning functions and bins", about: "f_A vs log K_OW, one curve per Vr",
    parts: { bin_edges: choice(["dashed", "dotted", "solid", "none"]), bin_edge_color: color() },
  },
  solubility_distribution: {
    page: "distribution", title: "Solubility distribution", about: "bar chart, mean ± SD per bin",
    parts: {
      bar_color: color(), bar_width: number(0.2, 1, 0.05, "fraction of bin width"),
      error_bar_width: number(0.5, 4, 0.5), error_bar_cap: number(0, 16, 1, "px"),
      x_axis_mode: choice(["log_Kow", "log_S"], "bottom axis when the page opens (the visitor can switch)"),
    },
  },
  alpha_fit: {
    page: "distribution", title: "Check: measured α vs α from the distribution", about: "measured α vs α reconstructed from the distribution",
    parts: { measured_marker: choice(MARKERS), fitted_marker: choice(MARKERS), error_bar_width: number(0.5, 4, 0.5) },
  },
  mc_histograms: {
    page: "distribution", title: "Monte Carlo spread per bin", about: "Monte Carlo spread per bin (small panels)",
    parts: { bar_color: color() },
  },

  kohler_curve: {
    page: "kohler", title: "Köhler curve", about: "saturation ratio vs wet diameter, with slider marker",
    parts: {
      curve_color: color(), s_equals_1_line: choice(["dashed", "dotted", "solid", "none"]),
      slider_marker_color: color(), slider_marker_size: number(6, 24, 1, "px"),
      point_labels: bool("the i, ii, iii points"),
      llps_shading: bool("shade the wet diameters where an undissolved organic phase is present"),
      llps_shading_color: color(), llps_shading_opacity: number(0, 1, 0.05),
    },
  },
  particle_cartoon: {
    page: "kohler", title: "Particle drawing", about: "the drawing of the droplet next to the Köhler curve",
    parts: {
      aqueous_fill: color(), aqueous_edge: color(), organic_fill: color(), organic_edge: color(),
      organic_position: choice(["off_center", "core", "none"]),
      label_single: text(), label_llps: text(),
    },
  },
  dissolved_fraction_bars: {
    page: "kohler", title: "Dissolved fraction per component", about: "ε per component at the chosen diameter (horizontal bars)",
    parts: { dissolved_color: color(), undissolved_color: color() },
  },
  kappa_contribution_bars: {
    page: "kohler", title: "Contribution to κ_eff", about: "f·ε·κ_intr per component (horizontal bars)",
    parts: { bar_color: color() },
  },
  kappa_fit_scatter: {
    page: "kohler", title: "κ fit: modelled vs measured", about: "modelled vs measured κ_CCN, 1:1 line",
    parts: {
      one_to_one_line: choice(LINES), one_to_one_color: color(),
      fraction_colors: { kind: "colors", note: 'fixed colour per fraction: online = the particle; "A1A0[1]", "A1A0[2]" … = 1st, 2nd … volume ratio (largest Vr first); O1A0 uses the colour of its A1A0' },
      A1A0_marker: choice(MARKERS), O1A0_marker: choice(MARKERS),
    },
  },
  kappa_intr_histograms: {
    page: "kohler", title: "κ fit: accepted κ_intr", about: "accepted κ_intr sets per component after the fit (small panels)",
    parts: { bar_color: color(), mean_line: choice(LINES), mean_line_color: color() },
  },
};
