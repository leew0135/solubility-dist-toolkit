/*
 * style_page.js — "Figure styles": the author's tool to choose the look of the figures.
 * Address: #/style (not linked in the menu; visitors do not need it).
 *
 * WHAT IT DOES
 *   Shows every figure of the site with real example data and, next to it, its settings as
 *   menus, number boxes, colour pickers and tick boxes. A change is drawn at once.
 *     - "All figures": the settings every figure starts from (DEFAULT in figure_styles.js).
 *     - Each figure: its own settings ("parts"), and any common setting it should have
 *       differently from the others ("Different from all figures").
 *   "Download figure_styles.js" writes the new file. Put it in web/styles/ in place of the old
 *   one and reload: nothing is saved until you do that.
 *
 *   While this tab is open the changes are only previews. Figures on the other tabs keep the
 *   saved look; reload the website to be sure nothing of a discarded trial remains.
 *
 * HOW TO CHANGE
 *   Which values are offered (e.g. another font size)  -> styles/style_options.js
 *   Example data of the previews                       -> js/style_tool/PreviewData.js
 *   Layout of the written file                         -> js/style_tool/StyleFile.js
 *   Wording                                            -> the template in build()
 */
import { BasePage } from "./BasePage.js";
import { DEFAULT, FIGURES, PALETTES } from "../../styles/figure_styles.js";
import { COMMON, FIGURE_OPTIONS, PAGES } from "../../styles/style_options.js";
import { buildStyleFile, checkCoverage } from "../style_tool/StyleFile.js";
import { loadPreviewData, PREVIEW_CLASSES } from "../style_tool/PreviewData.js";
import { ParticleCartoon } from "../ui/ParticleCartoon.js";
import { downloadText } from "../ui/CsvIO.js";

const clone = (v) => JSON.parse(JSON.stringify(v));
/** Put the contents of `source` into the object `target` without replacing the object itself. */
function refill(target, source) {
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, clone(source));
}
const pretty = (name) => name.replace(/_/g, " ");

export default class StylePage extends BasePage {
  async build(root) {
    this.saved = { DEFAULT: clone(DEFAULT), FIGURES: clone(FIGURES) };     // as in the file on disk
    this.previews = new Map();                                             // figure name -> { box, figure }
    root.innerHTML = `
      <div class="style-head">
        <h1>Figure styles</h1>
        <p class="muted">Author tool. Try the options: every change is drawn at once with the α-pinene example. Nothing is saved until you download the file and put it in <code>web/styles/</code> in place of <code>figure_styles.js</code>, then reload the website.</p>
        <div class="row">
          <button class="btn btn-primary" type="button" id="y-download">⬇ Download figure_styles.js</button>
          <button class="btn" type="button" id="y-reset">Undo all changes</button>
          <span class="small" id="y-status" role="status"></span>
        </div>
        <div class="note note-error" id="y-problems" hidden></div>
      </div>
      <details class="fold" id="y-common" open>
        <summary>All figures</summary>
        <div class="fold-body">
          <div class="hint">These apply to every figure, unless a figure below is set differently.</div>
          <div class="style-controls" id="y-default"></div>
        </div>
      </details>
      <div id="y-figures"><p class="muted" id="y-loading">Preparing the example figures…</p></div>`;
    this.$ = (sel) => root.querySelector(sel);
    this.$("#y-download").addEventListener("click", () => downloadText("figure_styles.js", this.fileText(), "text/javascript"));
    this.$("#y-reset").addEventListener("click", () => this.reset());

    const problems = checkCoverage({ DEFAULT, FIGURES });
    if (problems.length) {
      this.$("#y-problems").hidden = false;
      this.$("#y-problems").textContent = `figure_styles.js and style_options.js do not match: ${problems.join("; ")}`;
    }
    this.drawDefaultControls();
    try {
      this.data = await loadPreviewData(this.engine);
    } catch (err) {
      this.$("#y-loading").textContent = `The example figures could not be prepared: ${err.message}`;
      root.dataset.state = "error";
      return;
    }
    this.drawFigureCards();
    this.showStatus();
    root.dataset.state = "done";
  }

  fileText() {
    return buildStyleFile({ DEFAULT, FIGURES, PALETTES });
  }

  // ------------------------------------------------------------ controls
  /** One labelled control for a setting. onChange(newValue) is called with a value of the right type. */
  control(name, option, value, onChange, { removable = false, onRemove = null } = {}) {
    const row = document.createElement("div");
    row.className = "style-row";
    const id = `y-${Math.random().toString(36).slice(2, 9)}`;
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = pretty(name);
    if (option.note) label.title = option.note;
    let input;
    if (option.kind === "choice") {
      input = document.createElement("select");
      option.options.forEach((o, i) => input.add(new Option(String(o), String(i), false, o === value)));
      if (!option.options.includes(value)) input.add(new Option(`${value} (not in the list)`, "-1", true, true));
      input.addEventListener("change", () => { if (input.value !== "-1") onChange(option.options[Number(input.value)]); });
    } else if (option.kind === "bool") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(value);
      input.addEventListener("change", () => onChange(input.checked));
    } else if (option.kind === "number") {
      input = document.createElement("input");
      input.type = "number";
      Object.assign(input, { min: option.min, max: option.max, step: option.step, value });
      input.addEventListener("input", () => {
        const v = Number(input.value);
        if (input.value !== "" && v >= option.min && v <= option.max) onChange(v);
      });
    } else if (option.kind === "color") {
      input = document.createElement("input");
      input.type = "color";
      input.value = String(value).toLowerCase();
      input.addEventListener("input", () => { code.textContent = input.value.toUpperCase(); onChange(input.value.toUpperCase()); });
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.value = value;
      input.addEventListener("input", () => onChange(input.value));
    }
    input.id = id;
    const code = document.createElement("code");
    code.className = "style-hex";
    if (option.kind === "color") code.textContent = String(value).toUpperCase();
    row.append(label, input, code);
    if (removable) {
      const x = document.createElement("button");
      x.type = "button";
      x.className = "icon-btn";
      x.textContent = "×";
      x.setAttribute("aria-label", `Use the common ${pretty(name)} again`);
      x.addEventListener("click", onRemove);
      row.append(x);
    }
    return row;
  }

  drawDefaultControls() {
    const host = this.$("#y-default");
    host.innerHTML = "";
    for (const [name, option] of Object.entries(COMMON)) {
      host.append(this.control(name, option, DEFAULT[name], (v) => { DEFAULT[name] = v; this.changed(null); }));
    }
  }

  drawFigureCards() {
    const host = this.$("#y-figures");
    host.innerHTML = "";
    for (const [page, title] of Object.entries(PAGES)) {
      const h = document.createElement("h2");
      h.textContent = title.replace("->", "→");
      host.append(h);
      for (const [name, meta] of Object.entries(FIGURE_OPTIONS)) {
        if (meta.page !== page) continue;
        const card = document.createElement("section");
        card.className = "card style-card";
        card.dataset.figure = name;
        card.innerHTML = `
          <div class="style-preview"><div class="card-title">${meta.title}</div><div class="hint"><code>${name}</code> — ${meta.about}</div><div class="plot"></div></div>
          <div class="style-settings">
            <div class="section-label">Own settings</div><div class="style-controls" data-part="parts"></div>
            <div class="section-label">Different from all figures</div><div class="style-controls" data-part="overrides"></div>
            <div class="style-row"><label for="y-add-${name}">Set differently</label><select id="y-add-${name}" data-part="add"></select></div>
          </div>`;
        host.append(card);
        this.previews.set(name, { box: card.querySelector(".plot"), figure: null });
        this.drawFigureControls(name);
        this.drawPreview(name);
      }
    }
  }

  drawFigureControls(name) {
    const card = this.$(`[data-figure="${name}"]`);
    const meta = FIGURE_OPTIONS[name], fig = FIGURES[name];
    const parts = card.querySelector('[data-part="parts"]');
    parts.innerHTML = "";
    for (const [k, option] of Object.entries(meta.parts)) {
      if (option.kind === "colors") {
        for (const [who, hex] of Object.entries(fig.parts[k])) {
          parts.append(this.control(`${k}: ${who}`, { kind: "color", note: option.note }, hex, (v) => { fig.parts[k][who] = v; this.changed(name); }));
        }
      } else {
        parts.append(this.control(k, option, fig.parts[k], (v) => { fig.parts[k] = v; this.changed(name); }));
      }
    }
    const over = card.querySelector('[data-part="overrides"]');
    over.innerHTML = "";
    const mine = Object.keys(fig).filter((k) => k !== "parts");
    for (const k of mine) {
      over.append(this.control(k, COMMON[k], fig[k], (v) => { fig[k] = v; this.changed(name); }, {
        removable: true, onRemove: () => { delete fig[k]; this.drawFigureControls(name); this.changed(name); },
      }));
    }
    if (mine.length === 0) over.innerHTML = `<div class="hint">Nothing: this figure follows “All figures”.</div>`;
    const add = card.querySelector('[data-part="add"]');
    add.innerHTML = `<option value="">Choose a setting…</option>` + Object.keys(COMMON).filter((k) => !mine.includes(k))
      .map((k) => `<option value="${k}">${pretty(k)}</option>`).join("");
    add.onchange = () => {
      if (!add.value) return;
      const parts0 = fig.parts;                       // keep "parts" as the last key of the block
      delete fig.parts;
      fig[add.value] = DEFAULT[add.value];
      fig.parts = parts0;
      this.drawFigureControls(name);
      this.changed(name);
    };
  }

  // ------------------------------------------------------------ previews
  drawPreview(name) {
    const p = this.previews.get(name);
    if (p.figure && p.figure.destroy) p.figure.destroy();
    p.box.innerHTML = "";
    p.box.removeAttribute("style");
    p.box.className = "plot";
    const data = this.data[name];
    if (!data) {
      p.box.innerHTML = `<div class="hint">No example data for this figure.</div>`;
      p.figure = null;
      return;
    }
    if (name === "particle_cartoon") {
      p.figure = new ParticleCartoon(p.box);
      p.figure.update(data);
    } else {
      p.figure = new PREVIEW_CLASSES[name](p.box);      // reads the current style
      p.figure.render(data);
    }
  }

  /** A value changed. name = the figure it belongs to, or null for "All figures". */
  changed(name) {
    if (!this.data) return;
    if (name) this.drawPreview(name);
    else for (const n of this.previews.keys()) this.drawPreview(n);
    this.showStatus();
  }

  showStatus() {
    const same = JSON.stringify({ DEFAULT, FIGURES }) === JSON.stringify(this.saved);
    const el = this.$("#y-status");
    el.textContent = same ? "No changes: the previews show the saved file." : "Changed, not saved yet: download the file to keep it.";
    el.className = same ? "small muted" : "small note-wait style-flag";
    this.root.dataset.changed = String(!same);
  }

  reset() {
    refill(DEFAULT, this.saved.DEFAULT);
    refill(FIGURES, this.saved.FIGURES);
    this.drawDefaultControls();
    for (const name of this.previews.keys()) this.drawFigureControls(name);
    this.changed(null);
  }
}
