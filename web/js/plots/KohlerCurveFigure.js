/*
 * KohlerCurveFigure.js — saturation ratio versus wet diameter, with the movable marker (page ②).
 *
 * WHAT IT SHOWS
 *   The Köhler curve of one dry particle. The maximum is the critical saturation
 *   ratio s_c (activation). The big marker and vertical line follow the slider
 *   under the figure. Small labelled points (i, ii, …) mark notable states.
 *   The shaded range is where an undissolved organic phase is still present
 *   (two phases); to the right of it everything is dissolved.
 *
 * DATA (built by the page from web_api.kohler)
 *   { d_nm: [..], s: [..], index,                  index = position of the slider marker
 *     marks: [ { index, label } ],                  the i, ii, … points
 *     two_phase_until_nm }                          end of the shaded range (null = to the end)
 *
 * HOW TO CHANGE
 *   Colours, marker size, shading, s = 1 line, labels on/off -> "kohler_curve" in styles/figure_styles.js
 *   How much of the curve is shown vertically                  -> Y_WINDOW below
 *   Axis titles                                                 -> below
 */
import { FigureBase } from "./FigureBase.js";

// The y axis runs from 1 − below·(s_c − 1) to 1 + above·(s_c − 1), so the maximum is always visible.
const Y_WINDOW = { below: 8, above: 1.7, min_span: 0.002 };

/** Tick positions 1, 2, 5 × 10^n inside [lo, hi] (labelled) and every 1…9 × 10^n (small ticks). */
function logTicks(lo, hi) {
  const major = [], minor = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
    for (let m = 1; m <= 9; m++) {
      const v = m * 10 ** e;
      if (v < lo * 0.999 || v > hi * 1.001) continue;
      ([1, 2, 5].includes(m) ? major : minor).push(v);
    }
  }
  return { major, minor };
}

export class KohlerCurveFigure extends FigureBase {
  static styleName = "kohler_curve";

  yRange(d) {
    const sc = Math.max(...d.s.filter((v) => v !== null));
    const span = Math.max(sc - 1, Y_WINDOW.min_span);
    return [1 - Y_WINDOW.below * span, 1 + Y_WINDOW.above * span];
  }

  traces(d) {
    const p = this.parts;
    const [lo] = this.yRange(d);
    const clamp = (v) => Math.max(v, lo);                 // keep markers visible when s is below the axis
    const out = [{
      type: "scatter", mode: "lines", x: d.d_nm, y: d.s, line: this.line(0, { color: p.curve_color }),
      hovertemplate: "D = %{x:.0f} nm<br>s = %{y:.4f}<extra></extra>",
    }];
    if (p.point_labels && d.marks.length) {
      out.push({
        type: "scatter", mode: "markers+text", cliponaxis: false,
        x: d.marks.map((m) => d.d_nm[m.index]), y: d.marks.map((m) => clamp(d.s[m.index])),
        text: d.marks.map((m) => `<i>${m.label}</i>`), textposition: "bottom center",
        textfont: { size: this.style.font_size - 2 },
        marker: { color: "currentColor", size: this.style.marker_size - 1 }, hoverinfo: "skip",
      });
    }
    out.push({
      type: "scatter", mode: "markers", x: [d.d_nm[d.index]], y: [clamp(d.s[d.index])], cliponaxis: false,
      marker: { color: p.slider_marker_color, size: p.slider_marker_size, line: { color: this.style.background, width: 2 } },
      hoverinfo: "skip",
    });
    return out;
  }

  layout(d) {
    const p = this.parts;
    const x0 = d.d_nm[0], x1 = d.d_nm[d.d_nm.length - 1];
    const shapes = [{
      type: "line", xref: "x", yref: "paper", x0: d.d_nm[d.index], x1: d.d_nm[d.index], y0: 0, y1: 1,
      line: { color: p.slider_marker_color, width: this.style.axis_line_width * 1.5 },
    }];
    if (p.s_equals_1_line !== "none") {
      shapes.push({
        type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: 1, y1: 1, layer: "below",
        line: { color: "currentColor", width: this.style.axis_line_width, dash: this.dash(p.s_equals_1_line) },
      });
    }
    if (p.llps_shading) {
      shapes.push({
        type: "rect", xref: "x", yref: "paper", layer: "below", line: { width: 0 },
        x0, x1: d.two_phase_until_nm === null ? x1 : d.two_phase_until_nm, y0: 0, y1: 1,
        fillcolor: p.llps_shading_color, opacity: p.llps_shading_opacity,
      });
    }
    return {
      xaxis: this.logAxis("Wet diameter (nm)", x0, x1),
      yaxis: this.axis("Saturation ratio, <i>s</i>", { range: this.yRange(d), tickformat: ".3f", nticks: 7 }),
      shapes,
    };
  }

  /** Logarithmic axis labelled at 1, 2, 5 × 10^n (Plotly's own log labels are hard to read). */
  logAxis(title, lo, hi) {
    const ticks = logTicks(lo, hi);
    const axis = this.axis(title, { type: "log", range: [Math.log10(lo), Math.log10(hi)], tickmode: "array", tickvals: ticks.major });
    if (this.style.minor_ticks) axis.minor = { ...axis.minor, tickmode: "array", tickvals: ticks.minor };
    return axis;
  }

  _margins() {
    const m = super._margins();
    return { ...m, l: Math.round(m.l * 1.2) };              // room for labels like 1.004
  }
}
