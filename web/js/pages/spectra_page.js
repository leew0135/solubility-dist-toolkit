/*
 * spectra_page.js — tool ⓪: mass spectra of A0, A1A0 and O1A0  →  α for each Vr.
 *
 * WHAT IT DOES
 *   Left: the spectra file (uploaded CSV or an example), which conditions (Vr) to
 *   use (the Vr value read from the column name can be corrected), the m/z window and exclusions. "Run" sends the file text to Python
 *   (web_api.unmix -> solubility_toolkit.SpectraUnmixer) and the right side shows,
 *   for the condition picked with the Vr buttons:
 *     - measured vs reconstructed A0 spectrum      figure key: spectra_comparison
 *     - reconstructed vs measured, 1:1 line        figure key: recon_vs_measured
 *     - fit error (SSE) vs α                       figure key: sse_vs_alpha
 *   and a table of α for all conditions, CSV download and "Send α to ①".
 *   Python runs once per "Run"; the Vr buttons only switch what is drawn.
 *   Picking an example here makes pages ① and ② load the same example (StepStore slot "example"),
 *   and an example picked on ① or ② is loaded here when this tab is opened again.
 *
 * HOW TO CHANGE
 *   α grid step default            -> solubility_toolkit/config.py (ALPHA_GRID_STEP)
 *   Example files                  -> web/examples/examples.json (+ scripts/make_web_examples.py)
 *   Template file                  -> TEMPLATE_URL below
 *   Input limits                   -> LIMITS below
 *   Wording                        -> the template at the bottom and assumptionsText()
 *   Figure looks                   -> styles/figure_styles.js
 *   The calculation                -> NOT here: solubility_toolkit/spectra.py (+ pytest)
 */
import { BasePage } from "./BasePage.js";
import { FigureCard } from "../ui/FigureCard.js";
import { bindUpload, downloadText } from "../ui/CsvIO.js";
import { steps } from "../ui/StepStore.js";
import { SpectraComparisonFigure } from "../plots/SpectraComparisonFigure.js";
import { ReconScatterFigure } from "../plots/ReconScatterFigure.js";
import { SseFigure } from "../plots/SseFigure.js";

const EXAMPLES_URL = "examples/examples.json";
const TEMPLATE_URL = "examples/spectra_template.csv";
const LIMITS = { step: [0.0001, 0.1] };
const num = (v, d = 3) => Number(v).toFixed(d);

export default class SpectraPage extends BasePage {
  async build(root) {
    root.innerHTML = TEMPLATE;
    this.$ = (sel) => root.querySelector(sel);
    this.csvText = null;       // the spectra file currently loaded (text)
    this.unchecked = new Set(); // Vr (as named in the file) the user switched off
    this.labels = new Map();    // Vr as named in the file -> Vr typed by the user
    this.result = null;
    this.current = null;       // Vr shown in the figures

    this.spectraCard = new FigureCard(this.$("#s-spectra"), {
      title: "", figure: SpectraComparisonFigure, file: "spectra_comparison",
      note: "Reconstructed A<sub>0</sub> = α · A<sub>1</sub>A<sub>0</sub> + (1 − α) · O<sub>1</sub>A<sub>0</sub>. At each m/z: measured on the left, reconstructed on the right.",
    });
    const row = this.$("#s-figures");
    this.scatterCard = new FigureCard(row, {
      title: "", figure: ReconScatterFigure, file: "recon_vs_measured",
      note: "Each point = one m/z. Points on the dashed 1:1 line are reproduced by the mixture.",
    });
    this.sseCard = new FigureCard(row, {
      title: "", figure: SseFigure, file: "sse_vs_alpha",
      note: "Σ over m/z of [α · A<sub>1</sub>A<sub>0</sub> + (1 − α) · O<sub>1</sub>A<sub>0</sub> − A<sub>0</sub>]², for every α on the search grid. The minimum is the α reported. Shaded: the α range that ① samples by default.",
    });

    this.bindEvents();
    try {
      const [defaults, examples] = await Promise.all([
        this.engine.call("defaults"),
        fetch(EXAMPLES_URL, { cache: "no-cache" }).then((r) => r.json()),
      ]);
      this.defaults = defaults;
      this.examples = examples;
      this.$("#s-example").innerHTML = Object.entries(examples)
        .filter(([k, ex]) => !k.startsWith("_") && ex.spectra)
        .map(([k, ex]) => `<option value="${k}">${ex.label}</option>`).join("");
      this.resetParameters();
      const shared = steps.take("example");
      this.seenExample = shared ? shared.sent : 0;
      if (shared && examples[shared.data.key] && examples[shared.data.key].spectra) this.$("#s-example").value = shared.data.key;
      await this.loadExample(this.$("#s-example").value);
    } catch (err) {
      this.showError(err.message);
    }
  }

  /** Tab opened again: load the example picked meanwhile on another page, if any. */
  onShow() {
    const msg = this.examples && steps.take("example", this.seenExample);
    if (!msg) return;
    this.seenExample = msg.sent;
    const ex = this.examples[msg.data.key];
    if (!ex || !ex.spectra || msg.data.key === this.exampleKey) return;
    this.$("#s-example").value = msg.data.key;
    this.loadExample(msg.data.key);
  }

  // ------------------------------------------------------------ inputs
  bindEvents() {
    const $ = this.$;
    $("#s-example").addEventListener("change", (e) => {
      this.seenExample = steps.send("example", { key: e.target.value });      // the other pages follow
      this.loadExample(e.target.value);
    });
    $("#s-run").addEventListener("click", () => this.run());
    $("#s-reset").addEventListener("click", () => { this.resetParameters(); this.run(); });
    $("#s-params").addEventListener("input", () => this.markStale());
    $("#s-conditions").addEventListener("change", (e) => {
      if (e.target.type !== "checkbox") return;
      const vr = Number(e.target.dataset.vr);
      if (e.target.checked) this.unchecked.delete(vr); else this.unchecked.add(vr);
      this.markStale();
    });
    $("#s-conditions").addEventListener("input", (e) => {
      if (e.target.dataset.label === undefined) return;
      this.labels.set(Number(e.target.dataset.label), e.target.value.trim());
    });
    $("#s-pick").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-vr]");
      if (btn) this.showCondition(Number(btn.dataset.vr));
    });
    $("#s-csv").addEventListener("click", () => this.result && downloadText("alpha.csv", this.result.csv));
    $("#s-send").addEventListener("click", () => this.sendToNextStep());
    bindUpload($("#s-upload"), (text, name) => this.loadText(text, name, `✓ Loaded ${name}`, true));
  }

  /** "Reset to paper defaults": all m/z, no exclusions, unit-sum spectra, grid step from config.py, all Vr used. */
  resetParameters() {
    const $ = this.$;
    $("#s-mzmin").value = "";
    $("#s-mzmax").value = "";
    $("#s-exclude").value = "";
    $("#s-renorm").checked = true;
    $("#s-step").value = this.defaults.ALPHA_GRID_STEP;
    this.unchecked.clear();
    this.labels.clear();
  }

  async loadExample(key) {
    const ex = this.examples[key];
    const text = await fetch(ex.spectra.file, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${ex.spectra.file}`);
      return r.text();
    });
    await this.loadText(text, ex.label, `Example: ${ex.label}. ${ex.spectra.note || ""}`, false);
    this.exampleKey = key;
  }

  async loadText(text, name, message, ok) {
    this.csvText = text;
    this.exampleKey = null;
    this.source = name;
    this.unchecked.clear();
    this.labels.clear();
    this.current = null;
    const el = this.$("#s-source");
    el.textContent = message;
    el.className = ok ? "note note-ok" : "note";
    await this.run();
  }

  readInputs() {
    const $ = this.$;
    const optional = (id, what) => {
      const t = $(id).value.trim();
      if (t === "") return null;
      const v = Number(t);
      if (!Number.isFinite(v)) throw new Error(`${what} must be a number (or empty for the whole file).`);
      return v;
    };
    if (!this.csvText) throw new Error("Upload a spectra CSV or pick an example first.");
    const mz_min = optional("#s-mzmin", "m/z min"), mz_max = optional("#s-mzmax", "m/z max");
    if (mz_min !== null && mz_max !== null && mz_min >= mz_max) throw new Error("m/z min must be smaller than m/z max.");
    const exclude = $("#s-exclude").value.trim();
    if (exclude && !/^[\d.\s,;-]+$/.test(exclude)) throw new Error("Exclude m/z: use numbers and ranges separated by commas, e.g. 12-40, 57, 69-71.");
    const step = Number($("#s-step").value.trim());
    if (!(step >= LIMITS.step[0] && step <= LIMITS.step[1])) throw new Error(`α search step must be between ${LIMITS.step[0]} and ${LIMITS.step[1]}.`);
    const inputs = { csv_text: this.csvText, mz_min, mz_max, exclude, renormalize: $("#s-renorm").checked, step };
    if (this.result) {
      const used = this.result.vr_found.filter((v) => !this.unchecked.has(v));
      if (used.length === 0) throw new Error("Select at least one condition (Vr).");
      if (this.unchecked.size) inputs.use_vr = used;
      // Vr values corrected by the user (the file's column names stay as they are)
      const shown = used.map((v) => (this.labels.has(v) ? Number(this.labels.get(v)) : v));
      shown.forEach((v, i) => {
        if (!(v > 0)) throw new Error(`Vr for the column pair "${used[i]}" must be a number larger than 0.`);
      });
      if (new Set(shown).size !== shown.length) throw new Error("Each condition needs a different Vr.");
      const changed = used.filter((v, i) => shown[i] !== v);
      if (changed.length) inputs.vr_labels = Object.fromEntries(changed.map((v) => [String(v), shown[used.indexOf(v)]]));
    }
    return inputs;
  }

  // ------------------------------------------------------------ run
  async run() {
    const btn = this.$("#s-run");
    let inputs;
    try {
      inputs = this.readInputs();
    } catch (err) {
      this.showError(err.message);
      this.root.dataset.state = "error";
      return;
    }
    this.showError("");
    btn.disabled = true;
    btn.textContent = "Running…";
    this.root.dataset.state = "running";
    try {
      this.result = await this.engine.call("unmix", inputs);
      this.showResult();
      this.root.dataset.state = "done";
    } catch (err) {
      this.showError(err.message);
      this.root.dataset.state = "error";
    } finally {
      btn.disabled = false;
      btn.textContent = "Run";
    }
  }

  markStale() {
    if (this.result) this.$("#s-stale").hidden = false;
  }

  showError(text) {
    const el = this.$("#s-error");
    el.textContent = text;
    el.hidden = !text;
  }

  // ------------------------------------------------------------ results
  showResult() {
    const r = this.result, $ = this.$;
    $("#s-stale").hidden = true;
    $("#s-results").hidden = false;

    $("#s-conditions").innerHTML = r.vr_found.map((v, i) => `<tr>
      <td><input type="checkbox" data-vr="${v}" aria-label="Use the condition ${v}" ${r.vr_used.includes(v) ? "checked" : ""}></td>
      <td><input data-label="${v}" inputmode="decimal" aria-label="Vr for the columns A1A0_${v} and O1A0_${v}" value="${this.labels.has(v) ? this.labels.get(v) : r.vr_labels[i]}"></td>
      <td class="small ok-text">✓ A1A0_${v}, O1A0_${v}</td></tr>`).join("");
    $("#s-file-info").textContent = `File: m/z ${r.mz_file[0]}–${r.mz_file[1]} (${r.n_mz_file} values). Used in fit: m/z ${r.mz_used[0]}–${r.mz_used[1]} (${r.n_mz} values).`;
    $("#s-mzmin").placeholder = r.mz_file[0];
    $("#s-mzmax").placeholder = r.mz_file[1];

    $("#s-pick").innerHTML = r.fits.map((f) => `<button type="button" class="btn btn-pill" data-vr="${f.vr_file}">Vr ${f.vr}</button>`).join("");
    $("#s-table tbody").innerHTML = r.fits.map((f) => `<tr>
      <td class="num">${f.vr}</td><td class="num">${num(f.alpha, 2)}</td><td class="num">${num(1 - f.alpha, 2)}</td>
      <td class="num">${num(f.r_squared)}</td><td class="num">${num(f.slope)}</td></tr>`).join("");
    $("#s-assumptions").innerHTML = this.assumptionsText();
    this.showCondition(r.vr_used.includes(this.current) ? this.current : r.vr_used[0]);
  }

  /** Draw the three figures for one condition (vrFile = Vr as named in the file). No Python call. */
  showCondition(vrFile) {
    const r = this.result;
    const fit = r.fits.find((f) => f.vr_file === vrFile);
    if (!fit) return;
    this.current = vrFile;
    const vr = fit.vr;
    for (const b of this.$("#s-pick").querySelectorAll("button")) {
      const on = Number(b.dataset.vr) === vrFile;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    }
    const title = (text) => `${text} (Vr ${vr})`;
    this.spectraCard.setTitle(title("A<sub>0</sub>: measured vs reconstructed mass spectrum"));
    this.scatterCard.setTitle(title("Reconstructed vs measured"));
    this.sseCard.setTitle(title("Fit error vs α"));
    this.spectraCard.figure.render({ ...fit, excluded: r.excluded });
    this.scatterCard.figure.render(fit);
    this.sseCard.figure.render({ ...fit, uncertainty: r.settings.mc_uncertainty });
  }

  assumptionsText() {
    const s = this.result.settings;
    return `<b>Assumptions used in this run</b> — α is the value (grid step ${s.step}) that minimizes the sum of squared residuals
      between the measured and reconstructed A<sub>0</sub> spectra (Kuwata &amp; Lee, 2017, eq. 13);
      ${s.renormalize ? "each spectrum is normalized to unit sum over the m/z used" : "spectra are used as given (not renormalized)"};
      A<sub>0</sub> is a linear mixture of A<sub>1</sub>A<sub>0</sub> and O<sub>1</sub>A<sub>0</sub> at each Vr, with 0 ≤ α ≤ 1.
      Only spectral shapes are used, so how concentrated or diluted each solution was does not change α.
      R² and slope describe how well the mixture reproduces A<sub>0</sub>; a low R² flags a separation or measurement artifact.`;
  }

  sendToNextStep() {
    if (!this.result) return;
    steps.send("alpha", {
      vr: this.result.fits.map((f) => f.vr), alpha: this.result.fits.map((f) => f.alpha),
      source: this.source || "", example: this.exampleKey || null,
    });
    location.hash = "#/distribution";
  }
}

// ---------------------------------------------------------------- page template
const TEMPLATE = `
<div class="tool">
  <aside class="panel" id="s-params">
    <section class="panel-section">
      <p class="section-label">1 · Input</p>
      <div class="note" id="s-source"></div>
      <label class="upload" id="s-upload">
        <span><b>Upload CSV</b> or drop file here</span>
        <span class="muted small">Normalized spectra: mz, A0, and for each Vr A1A0_&lt;Vr&gt; and O1A0_&lt;Vr&gt;</span>
        <input type="file" accept=".csv,text/csv" class="sr-only">
      </label>
      <div class="row spread small">
        <a href="${TEMPLATE_URL}" download>Download CSV template</a>
        <a href="#/readme?formats">Format help</a>
      </div>
      <div class="field"><label for="s-example">Or load example</label><select id="s-example"></select></div>
    </section>

    <section class="panel-section">
      <p class="section-label">2 · Parameters</p>
      <div class="hint">Conditions (Vr = V<sub>octanol</sub> / V<sub>aqueous</sub>) are read from the column names A1A0_&lt;Vr&gt; and O1A0_&lt;Vr&gt;. Untick a condition to leave it out. If the true volume ratio differs from the column name, type it in the Vr box: α does not depend on it, but it is the Vr sent to ①.</div>
      <div class="table-scroll"><table class="edit-table">
        <thead><tr><th scope="col">Use</th><th scope="col">Vr</th><th scope="col">Columns in file</th></tr></thead>
        <tbody id="s-conditions"></tbody>
      </table></div>
      <div class="hint" id="s-file-info"></div>
      <div class="field-grid">
        <div class="field"><label for="s-mzmin">m/z min</label><input id="s-mzmin" inputmode="decimal"></div>
        <div class="field"><label for="s-mzmax">m/z max</label><input id="s-mzmax" inputmode="decimal"></div>
      </div>
      <div class="hint">Leave empty to use every m/z in the file.</div>
      <div class="field"><label for="s-exclude">Exclude m/z — single values or ranges, separated by commas</label>
        <input id="s-exclude" placeholder="e.g. 12-40, 57, 69-71"></div>
      <details>
        <summary>Advanced</summary>
        <div class="details-body">
          <label class="check"><input type="checkbox" id="s-renorm" checked> Renormalize spectra to unit sum after excluding m/z</label>
          <div class="field"><label for="s-step">α search step</label><input id="s-step" inputmode="decimal"></div>
        </div>
      </details>
      <div class="note note-error" id="s-error" role="alert" hidden></div>
      <div class="row">
        <button class="btn btn-primary" type="button" id="s-run">Run</button>
        <button class="btn" type="button" id="s-reset">Reset to paper defaults</button>
      </div>
    </section>
  </aside>

  <section class="results" id="s-results" hidden>
    <div class="note note-wait" id="s-stale" hidden>Inputs changed since the last run. Press “Run” to update the results.</div>
    <div class="row spread">
      <div class="row" role="group" aria-label="Condition shown in the figures">
        <span class="small muted">Show condition:</span>
        <span class="row" id="s-pick"></span>
      </div>
      <button class="btn" type="button" id="s-csv">⬇ CSV</button>
    </div>

    <div id="s-spectra"></div>
    <div class="figure-row" id="s-figures"></div>

    <div class="card stack">
      <div class="card-title">Results: α for each condition</div>
      <div class="table-scroll">
        <table id="s-table">
          <thead><tr><th class="num">Vr</th><th class="num">α (aqueous)</th><th class="num">1 − α (octanol)</th><th class="num">R² of fit</th><th class="num">Slope</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="hint">R² and slope (reconstructed vs measured, through the origin): how well α·A<sub>1</sub>A<sub>0</sub> + (1−α)·O<sub>1</sub>A<sub>0</sub> reproduces the measured A<sub>0</sub> spectrum. A low R² flags a separation or measurement artifact.</div>
      <div class="row"><button class="btn btn-primary" type="button" id="s-send">Send α to ① →</button></div>
    </div>

    <div class="assumptions" id="s-assumptions"></div>
  </section>
</div>`;
