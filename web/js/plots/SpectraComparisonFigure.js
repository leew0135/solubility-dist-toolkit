/*
 * SpectraComparisonFigure.js — measured A0 spectrum next to the reconstructed one (page ⓪).
 *
 * WHAT IT SHOWS
 *   For one volume ratio: at each m/z, the measured A0 (left) and
 *   α·A1A0 + (1−α)·O1A0 (right). Where the two differ, the mixture of the two
 *   phases does not reproduce A0 at that ion. m/z left out of the fit are drawn
 *   in grey (measured A0 only).
 *
 * DATA (one entry of web_api.unmix -> fits, plus excluded)
 *   { mz: [..], measured: [..], reconstructed: [..], excluded: { mz: [..], a0: [..] } }
 *
 * HOW TO CHANGE
 *   Colours, sticks or bars, size  -> "spectra_comparison" in styles/figure_styles.js
 *   Axis titles, legend names      -> below
 */
import { FigureBase } from "./FigureBase.js";

// width of one mark and distance of its centre from the m/z value (in m/z units)
const SHAPE = { stick: { width: 0.28, shift: 0.18 }, bar: { width: 0.45, shift: 0.225 } };

export class SpectraComparisonFigure extends FigureBase {
  static styleName = "spectra_comparison";

  traces(d) {
    const p = this.parts;
    const g = SHAPE[p.bar_or_stick] || SHAPE.stick;
    const bars = (name, x, y, color, shift, hover) => ({
      type: "bar", name, x, y, width: g.width, offset: shift - g.width / 2,
      marker: { color }, hovertemplate: `m/z %{x}<br>${hover} = %{y:.4f}<extra></extra>`,
    });
    const out = [
      bars("Measured A<sub>0</sub>", d.mz, d.measured, p.measured_color, -g.shift, "measured"),
      bars("Reconstructed A<sub>0</sub>", d.mz, d.reconstructed, p.reconstructed_color, g.shift, "reconstructed"),
    ];
    if (d.excluded.mz.length) {
      out.push(bars("Not used in fit", d.excluded.mz, d.excluded.a0, p.excluded_mz_color, -g.shift, "measured (not used)"));
    }
    return out;
  }

  layout(d) {
    const all = [...d.mz, ...d.excluded.mz];
    const top = Math.max(...d.measured, ...d.reconstructed, ...d.excluded.a0);
    return {
      barmode: "overlay",
      xaxis: this.axis("<i>m/z</i>", { range: [Math.min(...all) - 2, Math.max(...all) + 2] }),
      yaxis: this.axis("Fraction of signal", { range: [0, top * 1.08] }),
    };
  }
}
