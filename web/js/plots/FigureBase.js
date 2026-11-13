/*
 * FigureBase.js — parent class of every figure on the website.
 *
 * WHAT IT DOES
 *   Turns the style of one figure (styles/figure_styles.js -> styleFor(name))
 *   into a Plotly layout: size from aspect, fonts, axis lines, frame, ticks,
 *   minor ticks, grid, palette, legend position, PNG export scale.
 *   A figure class only says WHAT to draw:
 *
 *       export class MyFigure extends FigureBase {
 *         static styleName = "my_figure";              // key in figure_styles.js
 *         traces(data) { return [ { x: data.x, y: data.y, mode: "lines", line: this.line(0) } ]; }
 *         layout(data) { return { xaxis: this.axis("x label"), yaxis: this.axis("y label") }; }
 *       }
 *       const fig = new MyFigure(document.getElementById("box"));
 *       fig.render(data);          // call again with new data to update (fast: Plotly.react)
 *       fig.downloadPng("name");
 *
 * RULE
 *   No colour, width, font or size may be written in a figure class.
 *   Everything comes from this.style / this.parts / this.palette.
 *
 * HOW TO CHANGE
 *   The look of figures           -> styles/figure_styles.js (not here).
 *   How a style key is translated -> the matching method below
 *                                    (e.g. legend positions: _legend(), margins: _margins()).
 */
import { styleFor, PALETTES } from "../../styles/figure_styles.js";

const DASH = { solid: "solid", dashed: "dash", dotted: "dot" };
const SYMBOL = {
  circle: "circle", circle_open: "circle-open", square: "square", square_open: "square-open",
  diamond: "diamond", diamond_open: "diamond-open", triangle: "triangle-up",
};

export class FigureBase {
  static styleName = null;                    // set in every subclass

  constructor(container) {
    this.el = container;
    this.style = styleFor(this.constructor.styleName);
    this.parts = this.style.parts;
    this.palette = PALETTES[this.style.palette];
    this.data = null;
    this._width = 0;
    this.el.style.maxWidth = `${this.style.width_px}px`;
    this._observer = new ResizeObserver(() => {
      if (this.data && this._availableWidth() !== this._width) this.draw();
    });
    this._observer.observe(this.el);
  }

  // ------------------------------------------------------------ for subclasses
  /** Plotly traces for this data. Must be overridden. */
  traces(data) { throw new Error(`${this.constructor.name}.traces() is not implemented`); }

  /** Extra Plotly layout (axes, shapes, annotations). May be overridden. */
  layout(data) { return {}; }

  /** Colour i of the figure's palette (wraps around). */
  color(i) { return this.palette[i % this.palette.length]; }

  /** Line style for data series i. */
  line(i, extra = {}) { return { color: this.color(i), width: this.style.data_line_width, ...extra }; }

  /** Marker style for data series i; symbol = a name used in figure_styles.js. */
  marker(i, symbol = "circle", extra = {}) {
    return { color: this.color(i), size: this.style.marker_size, symbol: SYMBOL[symbol] || symbol, ...extra };
  }

  /** "dashed" / "dotted" / "solid" (figure_styles.js) -> Plotly dash name. */
  dash(name) { return DASH[name] || "solid"; }

  /** One axis in the figure's style. title may contain <i>, <sub>, <sup>. */
  axis(title, extra = {}) {
    const s = this.style;
    const box = s.frame === "box";
    const side = s.ticks === "inside" ? "inside" : "outside";
    return {
      title: { text: title, font: { size: s.font_size }, standoff: 8 },
      showline: true, linewidth: s.axis_line_width, linecolor: "currentColor", mirror: box,
      ticks: side, ticklen: s.tick_length, tickwidth: s.axis_line_width, tickcolor: "currentColor",
      tickfont: { size: s.font_size - 2 },
      minor: s.minor_ticks
        ? { ticks: side, ticklen: s.tick_length / 2, tickwidth: s.axis_line_width, tickcolor: "currentColor", showgrid: false }
        : {},
      showgrid: s.grid !== "none", gridcolor: s.grid_color, gridwidth: 1,
      zeroline: false, automargin: false,
      ...extra,
    };
  }

  // ------------------------------------------------------------ drawing
  /** Draw or update the figure with new data. */
  render(data) {
    this.data = data;
    return this.draw();
  }

  draw() {
    const layout = this._resolveColors({ ...this._baseLayout(), ...this.layout(this.data) });
    const traces = this._resolveColors(this.traces(this.data));
    return window.Plotly.react(this.el, traces, layout, { displayModeBar: false, responsive: false });
  }

  /** Save the figure as PNG (size x png_scale from the style). */
  downloadPng(filename) {
    const { width, height } = this._size();
    return window.Plotly.downloadImage(this.el, { format: "png", filename, width, height, scale: this.style.png_scale });
  }

  destroy() {
    this._observer.disconnect();
    window.Plotly.purge(this.el);
  }

  // ------------------------------------------------------------ style -> Plotly
  _availableWidth() {
    return Math.min(this.el.clientWidth || this.style.width_px, this.style.width_px);
  }

  _margins() {
    const f = this.style.font_size;
    const right = this.style.legend === "outside_right" ? f * 9.5 : f * 1.4;      // room for a legend beside the plot
    return { l: Math.round(f * 4.4), r: Math.round(right), t: Math.round(f * 1.2), b: Math.round(f * 3.8) };
  }

  /** Figure size: the PLOT AREA (not the whole image) has the requested aspect. */
  _size() {
    const [a, b] = this.style.aspect.split(":").map(Number);
    const m = this._margins();
    const width = this._availableWidth();
    const height = Math.round((width - m.l - m.r) * (b / a) + m.t + m.b);
    return { width, height };
  }

  _legend() {
    const base = { font: { size: this.style.font_size - 2 }, bgcolor: "rgba(0,0,0,0)" };
    const where = {
      inside_upper_right: { x: 0.98, y: 0.98, xanchor: "right", yanchor: "top" },
      inside_upper_left: { x: 0.02, y: 0.98, xanchor: "left", yanchor: "top" },
      inside_lower_left: { x: 0.02, y: 0.02, xanchor: "left", yanchor: "bottom" },
      inside_lower_right: { x: 0.98, y: 0.02, xanchor: "right", yanchor: "bottom" },
      outside_right: { x: 1.02, y: 1, xanchor: "left", yanchor: "top" },
    }[this.style.legend];
    return where ? { showlegend: true, legend: { ...base, ...where } } : { showlegend: false };
  }

  _baseLayout() {
    const s = this.style;
    const { width, height } = this._size();
    this._width = width;
    return {
      width, height, margin: this._margins(),
      font: { family: s.font_family, size: s.font_size, color: this._textColor() },
      paper_bgcolor: s.background, plot_bgcolor: s.background,
      colorway: this.palette,
      ...this._legend(),
    };
  }

  /** Text / axis colour = the page's text colour (site.css --text), so figures match the page. */
  _textColor() {
    return getComputedStyle(this.el).color;
  }

  /** Plotly does not understand "currentColor": replace it by the page text colour. */
  _resolveColors(obj) {
    const text = this._textColor();
    const walk = (v) => {
      if (v === "currentColor") return text;
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
      return v;
    };
    return walk(obj);
  }
}
