/*
 * figure_styles.js — the look of every figure on the website, in one place.
 *
 * HOW IT WORKS
 *   1. DEFAULT  : the style every figure starts from.
 *   2. FIGURES  : one block per figure. It holds ONLY what differs from DEFAULT;
 *                 anything left out is taken from DEFAULT.
 *   3. Each figure block also has its own "parts" (markers, bars, shading …)
 *      that exist only in that figure.
 *
 * HOW TO CHANGE SOMETHING
 *   - By clicking: open the style page (add #/style to the website address), try the
 *     options with live previews, press "Download figure_styles.js" and put the
 *     downloaded file here in place of this one.
 *   - By hand: change all figures -> edit DEFAULT. Change one figure only -> add the
 *     key to that figure's block, e.g.  kohler_curve: { aspect: "4:3", font_size: 14 }
 *   - Colors: hex codes ("#0072B2"). Palettes are listed in PALETTES below.
 *   - Save the file and reload the page. No Python changes needed.
 *
 * Allowed values are written after each key as  // options: …
 * (they are defined in styles/style_options.js).
 */

// ---------------------------------------------------------------- palettes
export const PALETTES = {
  // Okabe & Ito (2008): colour-blind safe. Order is fixed: series 1, 2, 3 …
  okabe_ito: ["#0072B2", "#E69F00", "#009E73", "#D55E00", "#CC79A7", "#56B4E9", "#F0E442", "#000000"],
  viridis: ["#440154", "#31688E", "#35B779", "#C8B400"],
  tableau: ["#4E79A7", "#F28E2B", "#59A14F", "#E15759", "#76B7B2", "#EDC948"],
  grays: ["#000000", "#555555", "#888888", "#BBBBBB"],
};

// ---------------------------------------------------------------- default
export const DEFAULT = {
  aspect: "1:1",                  // options: "1:1", "4:3", "3:2", "16:9"; shape of the plot area (width : height)
  width_px: 520,                  // 240 to 1000; largest plot width on screen; height follows aspect
  font_family: "Arial, Helvetica, sans-serif", // as in CSS; the first font found on the visitor's computer is used
  font_size: 16,                  // options: 10, 12, 14, 16, 18; axis titles; tick labels = font_size - 2
  axis_line_width: 1,             // options: 0.8, 1, 1.5, 2
  data_line_width: 2,             // options: 1, 1.5, 2, 3
  marker_size: 10,                // 3 to 16; px
  frame: "box",                   // options: "box", "L"; "box" = all four sides, "L" = left + bottom only
  ticks: "outside",               // options: "outside", "inside"
  tick_length: 6,                 // 2 to 12; px
  minor_ticks: true,              // options: true, false
  grid: "light",                  // options: "none", "light"
  grid_color: "#E0E0E0",
  palette: "okabe_ito",           // options: "okabe_ito", "viridis", "tableau", "grays"; any key of PALETTES
  legend: "inside_upper_right",   // options: "inside_upper_right", "inside_upper_left", "inside_lower_left", "inside_lower_right", "outside_right", "none"
  background: "#FFFFFF",
  png_scale: 3,                   // 1 to 6; PNG download = screen size x png_scale pixels (3 ≈ 300 dpi at 8.6 cm)
};

// ---------------------------------------------------------------- figures
export const FIGURES = {
  // Page ⓪ Spectra -> α
  spectra_comparison: {           // measured A0 vs α·A1A0 + (1−α)·O1A0, per m/z
    aspect: "16:9",               // options: "1:1", "4:3", "3:2", "16:9"; shape of the plot area (width : height)
    width_px: 820,                // 240 to 1000; largest plot width on screen; height follows aspect
    parts: {
      measured_color: "#000000",
      reconstructed_color: "#1AC155",
      bar_or_stick: "stick",      // options: "stick", "bar"
      excluded_mz_color: "#BBBBBB", // m/z left out of the fit
    },
  },
  sse_vs_alpha: {                 // residual vs α for the Vr shown
    parts: {
      minimum_marker: "circle",   // options: "circle", "diamond", "none"
      show_mc_range: true,        // options: true, false; shade the α range that page ① samples by default
      mc_range_opacity: 0.15,     // 0 to 1
    },
  },
  recon_vs_measured: {            // reconstructed vs measured A0, one point per m/z, 1:1 line
    marker_size: 6,               // 3 to 16; px
    parts: {
      marker: "circle",           // options: "circle", "circle_open", "square", "square_open", "diamond", "diamond_open", "triangle"
      marker_color: "#000000",
      one_to_one_line: "dashed",  // options: "dashed", "dotted", "solid", "none"
      one_to_one_color: "#888888",
    },
  },

  // Page ① α -> solubility distribution
  partition_kernel: {             // f_A vs log K_OW, one curve per Vr
    legend: "inside_lower_left",  // options: "inside_upper_right", "inside_upper_left", "inside_lower_left", "inside_lower_right", "outside_right", "none"
    minor_ticks: false,           // options: true, false
    grid: "none",                 // options: "none", "light"
    parts: {
      bin_edges: "dashed",        // options: "dashed", "dotted", "solid", "none"
      bin_edge_color: "#888888",
    },
  },
  solubility_distribution: {      // bar chart, mean ± SD per bin
    grid: "none",                 // options: "none", "light"
    parts: {
      bar_color: "#0072B2",
      bar_width: 0.7,             // 0.2 to 1; fraction of bin width
      error_bar_width: 1.5,       // 0.5 to 4
      error_bar_cap: 6,           // 0 to 16; px
      x_axis_mode: "log_Kow",     // options: "log_Kow", "log_S"; bottom axis when the page opens (the visitor can switch)
    },
  },
  alpha_fit: {                    // measured α vs α reconstructed from the distribution
    parts: {
      measured_marker: "circle",  // options: "circle", "circle_open", "square", "square_open", "diamond", "diamond_open", "triangle"
      fitted_marker: "square_open", // options: "circle", "circle_open", "square", "square_open", "diamond", "diamond_open", "triangle"
      error_bar_width: 1.5,       // 0.5 to 4
    },
  },
  mc_histograms: {                // Monte Carlo spread per bin (small panels)
    aspect: "4:3",                // options: "1:1", "4:3", "3:2", "16:9"; shape of the plot area (width : height)
    font_size: 12,                // options: 10, 12, 14, 16, 18; axis titles; tick labels = font_size - 2
    minor_ticks: false,           // options: true, false
    parts: {
      bar_color: "#888888",
    },
  },

  // Page ② distribution -> Köhler
  kohler_curve: {                 // saturation ratio vs wet diameter, with slider marker
    aspect: "4:3",                // options: "1:1", "4:3", "3:2", "16:9"; shape of the plot area (width : height)
    legend: "none",               // options: "inside_upper_right", "inside_upper_left", "inside_lower_left", "inside_lower_right", "outside_right", "none"
    parts: {
      curve_color: "#0072B2",
      s_equals_1_line: "dashed",  // options: "dashed", "dotted", "solid", "none"
      slider_marker_color: "#E69F00",
      slider_marker_size: 12,     // 6 to 24; px
      point_labels: true,         // options: true, false; the i, ii, iii points
      llps_shading: true,         // options: true, false; shade the wet diameters where an undissolved organic phase is present
      llps_shading_color: "#E69F00",
      llps_shading_opacity: 0.1,  // 0 to 1
    },
  },
  particle_cartoon: {             // the drawing of the droplet next to the Köhler curve
    parts: {
      aqueous_fill: "#CFE0F3",
      aqueous_edge: "#0072B2",
      organic_fill: "#F2C48D",
      organic_edge: "#A35A12",
      organic_position: "off_center", // options: "off_center", "core", "none"
      label_single: "Single aqueous phase",
      label_llps: "Two phases (LLPS)",
    },
  },
  dissolved_fraction_bars: {      // ε per component at the chosen diameter (horizontal bars)
    aspect: "3:2",                // options: "1:1", "4:3", "3:2", "16:9"; shape of the plot area (width : height)
    font_size: 14,                // options: 10, 12, 14, 16, 18; axis titles; tick labels = font_size - 2
    legend: "none",               // options: "inside_upper_right", "inside_upper_left", "inside_lower_left", "inside_lower_right", "outside_right", "none"
    minor_ticks: false,           // options: true, false
    parts: {
      dissolved_color: "#0072B2",
      undissolved_color: "#F2C48D",
    },
  },
  kappa_contribution_bars: {      // f·ε·κ_intr per component (horizontal bars)
    aspect: "3:2",                // options: "1:1", "4:3", "3:2", "16:9"; shape of the plot area (width : height)
    font_size: 14,                // options: 10, 12, 14, 16, 18; axis titles; tick labels = font_size - 2
    legend: "none",               // options: "inside_upper_right", "inside_upper_left", "inside_lower_left", "inside_lower_right", "outside_right", "none"
    minor_ticks: false,           // options: true, false
    parts: {
      bar_color: "#56B4E9",
    },
  },
  kappa_fit_scatter: {            // modelled vs measured κ_CCN, 1:1 line
    legend: "outside_right",      // options: "inside_upper_right", "inside_upper_left", "inside_lower_left", "inside_lower_right", "outside_right", "none"
    font_size: 14,                // options: 10, 12, 14, 16, 18; axis titles; tick labels = font_size - 2
    width_px: 600,                // 240 to 1000; largest plot width on screen; height follows aspect
    parts: {
      one_to_one_line: "dashed",  // options: "dashed", "dotted", "solid", "none"
      one_to_one_color: "#888888",
      fraction_colors: {          // fixed colour per fraction: online = the particle; "A1A0[1]", "A1A0[2]" … = 1st, 2nd … volume ratio (largest Vr first); O1A0 uses the colour of its A1A0
        online: "#888888",
        A0: "#000000",
        "A1A0[1]": "#0072B2",
        "A1A0[2]": "#56B4E9",
        "A1A0[3]": "#E69F00",
        "A1A0[4]": "#009E73",
        "A1A0[5]": "#CC79A7",
        "A1A0[6]": "#D55E00",
      },
      A1A0_marker: "circle",      // options: "circle", "circle_open", "square", "square_open", "diamond", "diamond_open", "triangle"
      O1A0_marker: "square_open", // options: "circle", "circle_open", "square", "square_open", "diamond", "diamond_open", "triangle"
    },
  },
  kappa_intr_histograms: {        // accepted κ_intr sets per component after the fit (small panels)
    aspect: "4:3",                // options: "1:1", "4:3", "3:2", "16:9"; shape of the plot area (width : height)
    font_size: 12,                // options: 10, 12, 14, 16, 18; axis titles; tick labels = font_size - 2
    minor_ticks: false,           // options: true, false
    parts: {
      bar_color: "#888888",
      mean_line: "dashed",        // options: "dashed", "dotted", "solid", "none"
      mean_line_color: "#000000",
    },
  },
};

// ---------------------------------------------------------------- helper
// Used by the plotting code: DEFAULT + the figure's own settings.
export function styleFor(name) {
  const fig = FIGURES[name] || {};
  return { ...DEFAULT, ...fig, parts: { ...(fig.parts || {}) } };
}
