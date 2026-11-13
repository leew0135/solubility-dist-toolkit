/*
 * KappaFitFigures.js — the two figures of the κ_intr fit on page ②.
 *
 *   KappaFitFigure            modelled κ_CCN (with the fitted κ_intr) against measured κ_CCN,
 *                             one colour per fraction, 1:1 line.   style key: kappa_fit_scatter
 *   KappaIntrHistogramFigure  the κ_intr values of ONE component in the sets accepted in the
 *                             last round, with their mean.          style key: kappa_intr_histograms
 *
 * DATA
 *   KappaFitFigure            { samples: [ { name, type, vr, measured: [..], modelled: [..], ss_percent: [..] } ] }
 *                             type: "particle" | "A0" | "A1A0" | "O1A0"
 *   KappaIntrHistogramFigure  { values: [..], mean, step }      step = bin width of the histogram
 *
 * COLOURS OF THE FRACTIONS (kappa_fit_scatter.parts.fraction_colors)
 *   "online" = the particle, "A0", and "A1A0[1]", "A1A0[2]", … = 1st, 2nd … volume ratio
 *   (largest Vr first). O1A0 at the same Vr uses the same colour with the O1A0 marker.
 *   Fractions beyond the listed colours take the next colours of the palette.
 *
 * HOW TO CHANGE
 *   Colours, markers, legend place, size -> the two style keys in styles/figure_styles.js
 *   Axis titles, legend names            -> below
 */
import { FigureBase } from "./FigureBase.js";

const LEGEND_NAME = { particle: () => "Particle", A0: () => "A<sub>0</sub>", A1A0: (vr) => `A<sub>1</sub>A<sub>0</sub> [${vr}]`, O1A0: (vr) => `O<sub>1</sub>A<sub>0</sub> [${vr}]` };

export class KappaFitFigure extends FigureBase {
  static styleName = "kappa_fit_scatter";

  colorOf(sample, ranks) {
    const fixed = this.parts.fraction_colors;
    if (sample.type === "particle") return fixed.online;
    if (sample.type === "A0") return fixed.A0;
    const rank = ranks.indexOf(sample.vr) + 1;
    if (fixed[`A1A0[${rank}]`]) return fixed[`A1A0[${rank}]`];
    // more volume ratios than fixed colours: next palette colour not used by a fixed colour
    const used = new Set(Object.values(fixed).map((c) => c.toUpperCase()));
    const free = this.palette.filter((c) => !used.has(c.toUpperCase()));
    return free.length ? free[(rank - 1) % free.length] : this.color(rank);
  }

  traces(d) {
    const p = this.parts;
    const ranks = [...new Set(d.samples.filter((s) => s.vr !== null && s.vr !== undefined).map((s) => s.vr))].sort((a, b) => b - a);
    return d.samples.map((s) => {
      const color = this.colorOf(s, ranks);
      const open = s.type === "O1A0";
      return {
        type: "scatter", mode: "markers", name: LEGEND_NAME[s.type](s.vr),
        x: s.measured, y: s.modelled, customdata: s.ss_percent,
        marker: this.marker(0, open ? p.O1A0_marker : p.A1A0_marker, { color, line: { color, width: this.style.data_line_width } }),
        hovertemplate: "SS %{customdata:.2f} %<br>measured κ = %{x:.3f}<br>modelled κ = %{y:.3f}<extra>%{fullData.name}</extra>",
      };
    });
  }

  layout(d) {
    const p = this.parts;
    const all = d.samples.flatMap((s) => [...s.measured, ...s.modelled]);
    const pad = (Math.max(...all) - Math.min(...all)) * 0.12 || 0.01;
    const lo = Math.max(0, Math.min(...all) - pad), hi = Math.max(...all) + pad;
    return {
      xaxis: this.axis("Measured κ<sub>CCN</sub>", { range: [lo, hi], nticks: 5 }),
      yaxis: this.axis("Modelled κ<sub>CCN</sub>", { range: [lo, hi], nticks: 5 }),
      shapes: p.one_to_one_line === "none" ? [] : [{
        type: "line", x0: lo, y0: lo, x1: hi, y1: hi, layer: "below",
        line: { color: p.one_to_one_color, width: this.style.axis_line_width, dash: this.dash(p.one_to_one_line) },
      }],
    };
  }
}

export class KappaIntrHistogramFigure extends FigureBase {
  static styleName = "kappa_intr_histograms";

  traces(d) {
    return [{
      type: "histogram", x: d.values, marker: { color: this.parts.bar_color },
      xbins: { start: Math.floor(Math.min(...d.values) / d.step) * d.step - d.step / 2, size: d.step },
      hovertemplate: "κ<sub>intr</sub> = %{x:.2f}<br>%{y} sets<extra></extra>",
    }];
  }

  /** Whole-number tick step for the count axis (about 4 ticks). */
  countStep(d) {
    const counts = new Map();
    for (const v of d.values) { const k = Math.round(v / d.step); counts.set(k, (counts.get(k) || 0) + 1); }
    return Math.max(1, Math.ceil(Math.max(...counts.values()) / 4));
  }

  layout(d) {
    const p = this.parts;
    const lo = Math.min(...d.values), hi = Math.max(...d.values);
    const pad = Math.max(d.step * 2, (hi - lo) * 0.25);
    return {
      showlegend: false, bargap: 0.05,
      xaxis: this.axis("κ<sub>intr</sub>", { range: [Math.max(0, lo - pad), hi + pad], nticks: 4 }),
      yaxis: this.axis("Accepted sets", { rangemode: "tozero", tick0: 0, dtick: this.countStep(d) }),
      shapes: p.mean_line === "none" ? [] : [{
        type: "line", xref: "x", yref: "paper", x0: d.mean, x1: d.mean, y0: 0, y1: 1,
        line: { color: p.mean_line_color, width: this.style.data_line_width, dash: this.dash(p.mean_line) },
      }],
    };
  }
}
