/*
 * McHistogramFigure.js — spread of the Monte Carlo solutions for ONE bin (page ①, small panels).
 *
 * WHAT IT SHOWS
 *   How often each mass fraction was obtained for this bin over all Monte Carlo
 *   runs. A narrow peak = well constrained; a pile at 0 with a long tail = the
 *   bin is poorly constrained by the measured α (its SD is then large).
 *
 * DATA
 *   { centers: [..], width, fraction: [..] }
 *   (web_api.invert -> histograms; the page makes one figure per bin)
 *
 * HOW TO CHANGE
 *   Bar colour, panel size, font  -> "mc_histograms" in styles/figure_styles.js
 *   Axis titles                   -> below
 */
import { FigureBase } from "./FigureBase.js";

export class McHistogramFigure extends FigureBase {
  static styleName = "mc_histograms";

  traces(d) {
    return [{
      type: "bar", x: d.centers, y: d.fraction, width: d.width,
      marker: { color: this.parts.bar_color },
      hovertemplate: "mass fraction ≈ %{x:.2f}<br>%{y:.1%} of runs<extra></extra>",
    }];
  }

  layout(d) {
    const top = d.centers[d.centers.length - 1] + d.width / 2;
    return {
      showlegend: false, bargap: 0,
      xaxis: this.axis("Mass fraction", { range: [0, top], dtick: 0.5 }),
      yaxis: this.axis("Fraction of runs", { rangemode: "tozero", tickformat: ".0%", nticks: 5 }),
    };
  }
}
