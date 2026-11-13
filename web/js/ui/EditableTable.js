/*
 * EditableTable.js — a small table whose cells are text boxes, with add / remove row.
 *
 * WHAT IT DOES
 *   Used for the inputs a user types or corrects by hand (Vr / α / ±% on page ①,
 *   bins on page ②). It only stores text; the page converts and checks the numbers.
 *
 *       const table = new EditableTable(element, {
 *         columns: [ { key: "vr", label: "Vr" }, { key: "alpha", label: "α", placeholder: "0–1" } ],
 *                    // a column with  options: [ { value, label } ]  is shown as a menu instead of a text box
 *         rowName: "condition",                       // used in "Remove condition" labels
 *         onChange: () => { … },                      // any edit, add or remove
 *       });
 *       table.setRows([{ vr: "1.78", alpha: "0.44" }]);
 *       table.rows        // -> [{ vr: "1.78", alpha: "0.44" }]
 *       table.addRow();   // empty row
 *       table.setColumns([...]);   // show other columns; values of hidden columns are kept
 *
 *   A row can carry more values than there are columns (e.g. O/C and H/C while the
 *   table shows density). They are kept with the row and returned by table.rows.
 *
 * HOW TO CHANGE
 *   Look of the cells -> styles/site.css (.edit-table).   Columns -> where the table is created.
 */
export class EditableTable {
  constructor(element, { columns, rowName = "row", onChange = () => {} }) {
    this.el = element;
    this.columns = columns;
    this.rowName = rowName;
    this.onChange = onChange;
    this.el.classList.add("table-scroll");
    this.el.innerHTML = `<table class="edit-table"><thead></thead><tbody></tbody></table>`;
    this.head = this.el.querySelector("thead");
    this.body = this.el.querySelector("tbody");
    this._renderHead();
    this.body.addEventListener("input", () => this.onChange());
    this.body.addEventListener("change", (e) => { if (e.target.tagName === "SELECT") this.onChange(); });
    this.body.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-remove]");
      if (!btn) return;
      btn.closest("tr").remove();
      this.onChange();
    });
  }

  get rows() {
    return [...this.body.querySelectorAll("tr")].map((tr) => ({
      ...tr._hidden,
      ...Object.fromEntries(this.columns.map((c) => [c.key, tr.querySelector(`[data-key="${c.key}"]`).value.trim()])),
    }));
  }

  /** Show other columns. Values of columns that disappear stay with their row. */
  setColumns(columns) {
    const rows = this.rows;
    this.columns = columns;
    this._renderHead();
    this.setRows(rows);
  }

  _renderHead() {
    this.head.innerHTML = `<tr>${this.columns.map((c) => `<th scope="col">${c.label}</th>`).join("")}<th><span class="sr-only">Remove</span></th></tr>`;
  }

  setRows(rows) {
    this.body.innerHTML = "";
    rows.forEach((r) => this._append(r));
  }

  addRow(row = {}) {
    this._append(row);
    this.body.lastElementChild.querySelector("input, select").focus();
    this.onChange();
  }

  _append(row) {
    const tr = document.createElement("tr");
    tr.innerHTML = this.columns.map((c) => (c.options
      ? `<td><select data-key="${c.key}" aria-label="${c.aria || c.key}">${c.options.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}</select></td>`
      : `<td><input data-key="${c.key}" ${c.text ? "" : 'inputmode="decimal"'} aria-label="${c.aria || c.key}" placeholder="${c.placeholder || ""}"></td>`)).join("") +
      `<td><button type="button" class="icon-btn" data-remove aria-label="Remove ${this.rowName}">×</button></td>`;
    this.columns.forEach((c) => {
      const cell = tr.querySelector(`[data-key="${c.key}"]`);
      if (!c.options || row[c.key] !== undefined) cell.value = row[c.key] ?? "";
    });
    const shown = new Set(this.columns.map((c) => c.key));
    tr._hidden = Object.fromEntries(Object.entries(row).filter(([k]) => !shown.has(k)));
    this.body.appendChild(tr);
  }
}
