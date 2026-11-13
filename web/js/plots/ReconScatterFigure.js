/*
 * ReconScatterFigure.js — reconstructed versus measured A0, one point per m/z (page ⓪).
 *
 * WHAT IT SHOWS
 *   The same comparison as the spectra figure, as a scatter plot with the 1:1
 *   line. Points on the line = that ion is reproduced by α·A1A0 + (1−α)·O1A0.
 *   Slope (through the origin) and R² are written in the corner.
 *
 * DATA (one entry of web_api.unmix -> fits)
 *   { mz: [..], measured: [..], reconstructed: [..], slope, r_squared }
 *
 * HOW TO CHANGE
 *   Marker, colours, 1:1 line  -> "recon_vs_measured" in styles/figure_styles.js
 *   Axis titles, corner text   -> below
 */
import { FigureBase } from "./FigureBase.js";

export class ReconScatterFigure extends FigureBase {
  static styleName = "recon_vs_measured";

  traces(d) {
    const p = this.parts;
    return [{
      type: "scatter", mode: "markers", x: d.measured, y: d.reconstructed, customdata: d.mz,
      marker: this.marker(0, p.marker, { color: p.marker_color }),
      hovertemplate: "m/z %{customdata}<br>measured = %{x:.4f}<br>reconstructed = %{y:.4f}<extra></extra>",
    }];
  }

  layout(d) {
    const p = this.parts;
    const top = Math.max(...d.measured, ...d.reconstructed) * 1.08;
    const line = p.one_to_one_line === "none" ? [] : [{
      type: "line", x0: 0, y0: 0, x1: top, y1: top, layer: "below",
      line: { color: p.one_to_one_color, width: this.style.axis_line_width, dash: this.dash(p.one_to_one_line) },
    }];
    return {
      showlegend: false,
      xaxis: this.axis("Measured A<sub>0</sub>", { range: [0, top] }),
      yaxis: this.axis("Reconstructed A<sub>0</sub>", { range: [0, top] }),
      shapes: line,
      annotations: [{
        text: `slope ${d.slope.toFixed(3)} · R² ${d.r_squared.toFixed(3)}`,
        xref: "paper", yref: "paper", x: 0.04, y: 0.96, xanchor: "left", yanchor: "top",
        showarrow: false, font: { size: this.style.font_size - 2 },
      }],
    };
  }
}
