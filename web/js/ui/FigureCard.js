/*
 * FigureCard.js — the box around a figure: title, short explanation, the plot, a PNG button.
 *
 * WHAT IT DOES
 *       const card = new FigureCard(parentElement, {
 *         title: "Solubility distribution",      // may contain <sub>, <i>; "" when a folding section already shows the title
 *         note: "Bars: Monte Carlo mean …",       // optional, can be changed later with setNote()
 *         figure: SolubilityDistributionFigure,   // a class from js/plots/
 *         file: "solubility_distribution",        // PNG file name (no extension)
 *       });
 *       card.figure.render(data);
 *
 *   FigureCard.fold(detailsElement, cards) — for figures inside a folding section
 *   (<details>): redraws them when the section is opened, so they get the right size.
 *
 * HOW TO CHANGE
 *   Look of the card -> styles/site.css (.card, .figure-card).   The plot itself -> js/plots/.
 */
export class FigureCard {
  constructor(parent, { title, note = "", figure, file, png = true }) {
    this.el = document.createElement("figure");
    this.el.className = "card figure-card";
    this.el.innerHTML = `
      <div class="figure-head">
        <figcaption>${title}</figcaption>
        ${png ? `<button type="button" class="btn btn-small" data-png aria-label="Download this figure as PNG">⬇ PNG</button>` : ""}
      </div>
      <div class="figure-note muted"></div>
      <div class="plot"></div>`;
    parent.appendChild(this.el);
    this.noteEl = this.el.querySelector(".figure-note");
    this.setNote(note);
    this.figure = new figure(this.el.querySelector(".plot"));
    if (png) this.el.querySelector("[data-png]").addEventListener("click", () => this.figure.downloadPng(file));
  }

  static fold(details, cards) {
    details.addEventListener("toggle", () => {
      if (details.open) cards().forEach((c) => c.figure.data && c.figure.draw());
    });
  }

  setTitle(html) {
    this.el.querySelector("figcaption").innerHTML = html;
  }

  setNote(html) {
    this.noteEl.innerHTML = html;
    this.noteEl.hidden = !html;
  }
}
