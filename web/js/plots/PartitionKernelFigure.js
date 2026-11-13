/*
 * PartitionKernelFigure.js — f_A versus log K_OW, one curve per volume ratio (page ①).
 *
 * WHAT IT SHOWS
 *   f_A = 1 / (Vr · K_OW + 1): the fraction of a compound that stays in the
 *   aqueous phase. Vertical lines mark the edges of the K_OW bins used in the inversion.
 *
 * DATA (from web_api.kernel_curves)
 *   { vr: [..], log_kow: [..], f_a: [[..] per Vr], bin_edges: [..] }
 *
 * HOW TO CHANGE
 *   Look (colours, bin-edge lines, size)  -> "partition_kernel" in styles/figure_styles.js
 *   Axis titles / legend text              -> below
 */
import { FigureBase } from "./FigureBase.js";

export class PartitionKernelFigure extends FigureBase {
  static styleName = "partition_kernel";

  traces(data) {
    return data.vr.map((vr, i) => ({
      type: "scatter", mode: "lines",
      x: data.log_kow, y: data.f_a[i],
      name: `Vr = ${vr}`,
      line: this.line(i),
      hovertemplate: "log K<sub>OW</sub> = %{x:.2f}<br>f<sub>A</sub> = %{y:.3f}<extra>Vr = " + vr + "</extra>",
    }));
  }

  layout(data) {
    const p = this.parts;
    const edges = p.bin_edges === "none" ? [] : data.bin_edges.map((x) => ({
      type: "line", xref: "x", yref: "paper", x0: x, x1: x, y0: 0, y1: 1, layer: "below",
      line: { color: p.bin_edge_color, width: this.style.axis_line_width, dash: this.dash(p.bin_edges) },
    }));
    return {
      xaxis: this.axis("log <i>K</i><sub>OW</sub>", { range: [data.log_kow[0], data.log_kow[data.log_kow.length - 1]], dtick: 1 }),
      yaxis: this.axis("Fraction in aqueous phase, <i>f</i><sub>A</sub>", { range: [0, 1], dtick: 0.2 }),
      shapes: edges,
    };
  }
}
