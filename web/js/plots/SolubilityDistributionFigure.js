/*
 * SolubilityDistributionFigure.js — the main result of page ①: mass fraction per bin, mean ± SD.
 *
 * WHAT IT SHOWS
 *   One bar per K_OW bin (Monte Carlo mean) with ±1 SD error bars (the lower bar
 *   is cut at 0, a mass fraction cannot be negative). The bottom axis shows the
 *   primary variable, the top axis the other one (log K_OW <-> log S); the bars
 *   never move, only the labels swap.
 *
 * DATA (from web_api.invert)
 *   { log_kow: [..], log_s: [..], mean: [..], sd: [..], bin_width }
 *
 * HOW TO CHANGE
 *   Bar colour / width, error bars, default axis  -> "solubility_distribution" in styles/figure_styles.js
 *   Axis titles                                    -> TITLES below
 *   Switch the axis from the page                  -> figure.setMode("log_Kow" | "log_S")
 */
import { FigureBase } from "./FigureBase.js";

const TITLES = {
  log_Kow: "log <i>K</i><sub>OW</sub>",
  log_S: "log <i>S</i> (g cm<sup>−3</sup>)",
};
const fmt = (v) => String(Number(v.toFixed(2))).replace("-", "−");

export class SolubilityDistributionFigure extends FigureBase {
  static styleName = "solubility_distribution";

  constructor(container) {
    super(container);
    this.mode = this.parts.x_axis_mode;        // which variable is on the bottom axis
  }

  setMode(mode) {
    this.mode = mode;
    if (this.data) this.draw();
  }

  _margins() {
    const m = super._margins();
    return { ...m, t: m.b };                    // room for the top axis
  }

  traces(d) {
    const p = this.parts;
    return [
      {
        type: "bar", x: d.log_kow, y: d.mean, width: p.bar_width * d.bin_width,
        marker: { color: p.bar_color },
        error_y: {
          type: "data", symmetric: false, array: d.sd, arrayminus: d.sd.map((s, i) => Math.min(s, d.mean[i])),
          thickness: p.error_bar_width, width: p.error_bar_cap / 2, color: "currentColor",
        },
        customdata: d.log_kow.map((k, i) => [fmt(k), fmt(d.log_s[i]), d.sd[i]]),
        hovertemplate: "log K<sub>OW</sub> = %{customdata[0]}<br>log S = %{customdata[1]}<br>mean = %{y:.3f} ± %{customdata[2]:.3f}<extra></extra>",
      },
      // invisible points: Plotly only draws the top axis when a trace uses it
      { type: "scatter", xaxis: "x2", x: d.log_kow, y: d.log_kow.map(() => 0), mode: "markers", opacity: 0, hoverinfo: "skip" },
    ];
  }

  layout(d) {
    const kow = d.log_kow.map(fmt);
    const sol = d.log_s.map(fmt);
    const primaryIsKow = this.mode === "log_Kow";
    const half = d.bin_width / 2;
    const range = [Math.min(...d.log_kow) - half - 0.15, Math.max(...d.log_kow) + half + 0.15];
    const top = Math.max(...d.mean.map((m, i) => m + d.sd[i]));
    const ticks = (text) => ({ tickmode: "array", tickvals: d.log_kow, ticktext: text, range, showgrid: false, minor: {} });
    return {
      showlegend: false,
      xaxis: this.axis(TITLES[primaryIsKow ? "log_Kow" : "log_S"], ticks(primaryIsKow ? kow : sol)),
      xaxis2: this.axis(TITLES[primaryIsKow ? "log_S" : "log_Kow"], {
        ...ticks(primaryIsKow ? sol : kow), overlaying: "x", side: "top", mirror: false,
      }),
      yaxis: this.axis("Mass fraction", { range: [0, Math.max(0.1, Math.ceil(top * 10.5) / 10)], dtick: top > 0.5 ? 0.2 : 0.1 }),
    };
  }
}
