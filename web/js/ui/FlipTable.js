/*
 * FlipTable.js — a read-only results table that turns sideways when it does not fit.
 *
 * WHAT IT DOES
 *   Draws one row per item (e.g. one per bin) with one-line column titles. When the table is wider
 *   than its box, it is drawn transposed instead: one row per quantity, one column per item. It checks
 *   again whenever the box changes size (window resized, phone turned).
 *
 *       const t = new FlipTable(element, [
 *         { label: "log K<sub>OW</sub>" }, { label: "Mean" }, …            // label may contain HTML
 *       ]);
 *       t.setRows([["−2", "0.481", …], …]);                                // cell text (may contain HTML)
 *
 * HOW TO CHANGE
 *   Look -> styles/site.css (.flip-table).   When to flip -> fits() below.
 */
export class FlipTable {
  constructor(element, columns) {
    this.box = element;
    this.columns = columns;
    this.rows = [];
    this.box.classList.add("table-scroll");
    this.table = document.createElement("table");
    this.table.className = "flip-table";
    this.box.appendChild(this.table);
    this.width = 0;
    new ResizeObserver(() => {
      if (this.box.clientWidth !== this.width) this.draw();
    }).observe(this.box);
  }

  setRows(rows) {
    this.rows = rows;
    this.draw();
  }

  /** Normal layout first; transposed if it is too wide for the box. */
  draw() {
    this.width = this.box.clientWidth;
    this.table.innerHTML = this.normal();
    this.table.dataset.layout = "rows";
    if (this.rows.length && !this.fits()) {
      this.table.innerHTML = this.transposed();
      this.table.dataset.layout = "columns";
    }
  }

  fits() {
    return this.width === 0 || this.table.scrollWidth <= this.width + 1;   // width 0: page hidden, decide later
  }

  normal() {
    const head = this.columns.map((c) => `<th class="num">${c.label}</th>`).join("");
    const body = this.rows.map((r) => `<tr>${r.map((v) => `<td class="num">${v}</td>`).join("")}</tr>`).join("");
    return `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`;
  }

  transposed() {
    return `<tbody>${this.columns.map((c, j) =>
      `<tr><th>${c.label}</th>${this.rows.map((r) => `<td class="num">${r[j]}</td>`).join("")}</tr>`).join("")}</tbody>`;
  }
}
