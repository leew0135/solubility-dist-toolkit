/*
 * ComponentBarsFigure.js — the two horizontal bar charts of page ②, one bar per component
 * (solubility bin, WIOM, ammonium sulfate) at the wet diameter chosen with the slider.
 *
 *   DissolvedBarsFigure       ε_i: dissolved fraction of each component (rest = still in the organic phase)
 *                             style key: dissolved_fraction_bars
 *   KappaContributionFigure   f_i · ε_i · κ_intr,i: what each component adds to the particle's
 *                             effective κ at this diameter (their sum = κ_eff)
 *                             style key: kappa_contribution_bars
 *
 * DATA
 *   DissolvedBarsFigure      { labels: [..], eps: [..] }
 *   KappaContributionFigure  { labels: [..], values: [..], max }     max = largest value over all diameters,
 *                                                                     so the axis stays still while the slider moves
 *
 * HOW TO CHANGE
 *   Colours, size, font -> the two style keys in styles/figure_styles.js
 *   Axis titles         -> below
 */
import { FigureBase } from "./FigureBase.js";

class ComponentBars extends FigureBase {
  /** y axis with one row per component, first component on top. */
  categoryAxis() {
    return this.axis("", { type: "category", autorange: "reversed", showgrid: false, minor: {}, ticks: "" });
  }

  /** Number written to the right of the plot area, one per bar. */
  valueLabels(labels, values, digits) {
    return labels.map((label, i) => ({
      text: values[i].toFixed(digits), x: 1.02, y: label, xref: "paper", yref: "y", xanchor: "left",
      showarrow: false, font: { size: this.style.font_size - 2 },
    }));
  }

  _margins() {
    const m = super._margins();
    return { ...m, l: Math.round(this.style.font_size * 8.5), r: Math.round(this.style.font_size * 3.4) };
  }
}

export class DissolvedBarsFigure extends ComponentBars {
  static styleName = "dissolved_fraction_bars";

  traces(d) {
    const p = this.parts;
    const bar = (x, color, text) => ({
      type: "bar", orientation: "h", y: d.labels, x, marker: { color },
      hovertemplate: `%{y}<br>${text} = %{x:.2f}<extra></extra>`,
    });
    return [
      bar(d.eps, p.dissolved_color, "dissolved"),
      bar(d.eps.map((e) => 1 - e), p.undissolved_color, "in organic phase"),
    ];
  }

  layout(d) {
    return {
      barmode: "stack", bargap: 0.35,
      xaxis: this.axis("Dissolved fraction, ε", { range: [0, 1], dtick: 0.5 }),
      yaxis: this.categoryAxis(),
      annotations: this.valueLabels(d.labels, d.eps, 2),
    };
  }
}

export class KappaContributionFigure extends ComponentBars {
  static styleName = "kappa_contribution_bars";

  traces(d) {
    return [{
      type: "bar", orientation: "h", y: d.labels, x: d.values, marker: { color: this.parts.bar_color },
      hovertemplate: "%{y}<br>f·ε·κ<sub>intr</sub> = %{x:.4f}<extra></extra>",
    }];
  }

  layout(d) {
    const top = d.max > 0 ? d.max * 1.05 : 0.1;
    return {
      bargap: 0.35,
      xaxis: this.axis("Contribution to κ<sub>eff</sub>", { range: [0, top], nticks: 4 }),
      yaxis: this.categoryAxis(),
      annotations: this.valueLabels(d.labels, d.values, 3),
    };
  }
}
