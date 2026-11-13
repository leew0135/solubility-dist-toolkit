/*
 * AlphaFitFigure.js — does the retrieved distribution reproduce the measured α? (page ①)
 *
 * WHAT IT SHOWS
 *   Measured α at each volume ratio (with its uncertainty range) and the α
 *   reconstructed from the distribution: α_fit(Vr) = Σ_j kernel[Vr, j] · F_j,
 *   with F = Monte Carlo mean. Points that fall outside the error bars mean the
 *   chosen bins cannot describe the data.
 *
 * DATA (web_api.invert -> alpha_fit)
 *   { vr: [..], alpha: [..], low: [..], high: [..], fitted: [..] }
 *
 * HOW TO CHANGE
 *   Markers, error-bar width  -> "alpha_fit" in styles/figure_styles.js
 *   Axis titles, legend names -> below
 */
import { FigureBase } from "./FigureBase.js";

export class AlphaFitFigure extends FigureBase {
  static styleName = "alpha_fit";

  traces(d) {
    const p = this.parts;
    return [
      {
        type: "scatter", mode: "markers", name: "Measured α", x: d.vr, y: d.alpha,
        marker: this.marker(0, p.measured_marker),
        error_y: {
          type: "data", symmetric: false,
          array: d.high.map((h, i) => h - d.alpha[i]), arrayminus: d.alpha.map((a, i) => a - d.low[i]),
          thickness: p.error_bar_width, width: this.style.marker_size / 2, color: this.color(0),
        },
        hovertemplate: "Vr = %{x}<br>measured α = %{y:.3f}<extra></extra>",
      },
      {
        type: "scatter", mode: "markers", name: "From distribution", x: d.vr, y: d.fitted,
        marker: this.marker(1, p.fitted_marker, { size: this.style.marker_size + 2, line: { width: this.style.data_line_width, color: this.color(1) } }),
        hovertemplate: "Vr = %{x}<br>reconstructed α = %{y:.3f}<extra></extra>",
      },
    ];
  }

  layout(d) {
    const lo = Math.log10(Math.min(...d.vr)), hi = Math.log10(Math.max(...d.vr));
    return {
      xaxis: this.axis("Volume ratio, <i>V</i><sub>r</sub> (octanol / aqueous)", { type: "log", range: [Math.floor(lo - 0.3), Math.ceil(hi + 0.3)], dtick: 1 }),
      yaxis: this.axis("Fraction in aqueous phase, α", { range: [0, 1], dtick: 0.2 }),
    };
  }
}
