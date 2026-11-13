/*
 * SseFigure.js — fit error versus α for one volume ratio (page ⓪).
 *
 * WHAT IT SHOWS
 *   Σ over m/z of [α·A1A0 + (1−α)·O1A0 − A0]², computed for every α on the
 *   search grid. The lowest point is the α reported for this condition. A sharp
 *   valley = α is well defined; a flat one = the two phase spectra are too
 *   similar to tell α precisely. The shaded band is the range that page ① will
 *   sample in its Monte Carlo (α ± the default uncertainty).
 *
 * DATA (one entry of web_api.unmix -> fits, plus the default uncertainty)
 *   { curve: { alpha: [..], sse: [..] }, alpha, sse, uncertainty }
 *
 * HOW TO CHANGE
 *   Minimum marker, shaded band  -> "sse_vs_alpha" in styles/figure_styles.js
 *   Axis titles, corner text     -> below
 */
import { FigureBase } from "./FigureBase.js";

export class SseFigure extends FigureBase {
  static styleName = "sse_vs_alpha";

  traces(d) {
    const p = this.parts;
    const out = [{
      type: "scatter", mode: "lines", x: d.curve.alpha, y: d.curve.sse, line: this.line(0),
      hovertemplate: "α = %{x:.2f}<br>Σ residual² = %{y:.2e}<extra></extra>",
    }];
    if (p.minimum_marker !== "none") {
      out.push({
        type: "scatter", mode: "markers", x: [d.alpha], y: [d.sse],
        marker: this.marker(1, p.minimum_marker, { size: this.style.marker_size + 2 }),
        hovertemplate: "minimum: α = %{x:.2f}<extra></extra>",
      });
    }
    return out;
  }

  layout(d) {
    const p = this.parts;
    const band = p.show_mc_range ? [{
      type: "rect", xref: "x", yref: "paper", layer: "below", line: { width: 0 },
      x0: Math.max(0, d.alpha * (1 - d.uncertainty)), x1: Math.min(1, d.alpha * (1 + d.uncertainty)), y0: 0, y1: 1,
      fillcolor: this.color(1), opacity: p.mc_range_opacity,
    }] : [];
    return {
      showlegend: false,
      xaxis: this.axis("α", { range: [0, 1], dtick: 0.2 }),
      yaxis: this.axis("Σ residual²", { rangemode: "tozero", exponentformat: "e", showexponent: "all", nticks: 6 }),
      shapes: band,
      annotations: [{
        text: `minimum at α = ${d.alpha.toFixed(2)}`,
        xref: "paper", yref: "paper", x: 0.5, y: 0.96, xanchor: "center", yanchor: "top",
        showarrow: false, font: { size: this.style.font_size - 2 },
      }],
    };
  }

  _margins() {
    const m = super._margins();
    return { ...m, l: Math.round(m.l * 1.25) };       // room for labels like 1.5e−3
  }
}
