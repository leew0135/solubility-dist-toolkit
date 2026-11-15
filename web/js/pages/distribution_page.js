/*
 * distribution_page.js — tool ①: α at several Vr  →  solubility distribution.
 *
 * WHAT IT DOES
 *   Left: α table (typed, uploaded CSV, example, or sent from ⓪) and the inversion
 *   parameters. "Run inversion" sends them to Python (web_api.invert ->
 *   solubility_toolkit.Inversion.monte_carlo) and the right side shows:
 *     - solubility distribution (mean ± SD)        figure key: solubility_distribution
 *     - result table, CSV download, "Send distribution to ②"
 *     - three folding sections (closed until the user opens them):
 *         partitioning functions and bins          figure key: partition_kernel
 *         check: does the result reproduce α?      figure key: alpha_fit
 *         Monte Carlo spread per bin               figure key: mc_histograms
 *   Python runs once per "Run"; the axis switch only relabels the figure in the browser.
 *   Examples are shared by all pages (StepStore slot "example"): picking one here makes ⓪ and ②
 *   load it too, and one picked there is loaded here when this tab is opened. Whatever happened
 *   last wins: a newer "Send α to ①" from ⓪ replaces an older example choice, and the reverse.
 *
 * HOW TO CHANGE
 *   Default numbers (iterations, ±10 %, noise, bin width, K_OW–S relations)
 *                                  -> solubility_toolkit/config.py  (read at start and by "Reset")
 *   Example data                   -> web/examples/examples.json
 *   Names shown for the relations  -> RELATION_LABELS below
 *   Input limits                   -> LIMITS below
 *   Wording                        -> the template in build() and assumptionsText()
 *   Figure looks                   -> styles/figure_styles.js
 *   The calculation                -> NOT here: solubility_toolkit/inversion.py (+ pytest)
 */
import { BasePage } from "./BasePage.js";
import { EditableTable } from "../ui/EditableTable.js";
import { FigureCard } from "../ui/FigureCard.js";
import { FlipTable } from "../ui/FlipTable.js";
import { bindUpload, downloadText } from "../ui/CsvIO.js";
import { steps } from "../ui/StepStore.js";
import { SolubilityDistributionFigure } from "../plots/SolubilityDistributionFigure.js";
import { PartitionKernelFigure } from "../plots/PartitionKernelFigure.js";
import { AlphaFitFigure } from "../plots/AlphaFitFigure.js";
import { McHistogramFigure } from "../plots/McHistogramFigure.js";

const RELATION_LABELS = {
  kenaga_goring_1980: "Kenaga & Goring (1980)",
  valvani_1981: "Valvani et al. (1981)",
  coates_1985: "Coates et al. (1985)",
  isnard_lambert_1989: "Isnard & Lambert (1989)",
};
const LIMITS = { iterations: [100, 200000], seed: 42 };
const EXAMPLES_URL = "examples/examples.json";

const num = (v, d = 3) => (v === null || v === undefined ? "—" : Number(v).toFixed(d));
/**
 * Bin centres suggested when α arrives without bins (from ⓪ with the user's own spectra).
 * A volume ratio Vr separates compounds around log K_OW = −log Vr (where f_A = 0.5), so the
 * bins run over the whole decades covered by the Vr used, plus one more soluble bin.
 * For the paper data this gives the bins of the papers (−1…2 and −2…2). Only a starting point.
 */
function suggestBins(vr) {
  const x = vr.map((v) => -Math.log10(v));
  const lo = Math.floor(Math.min(...x) - 0.5), hi = Math.round(Math.max(...x));
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

const signed = (v, d = 2) => String(Number(Number(v).toFixed(d))).replace("-", "−");

export default class DistributionPage extends BasePage {
  async build(root) {
    root.innerHTML = TEMPLATE;
    this.$ = (sel) => root.querySelector(sel);
    this.seenAlpha = 0;
    this.seenExample = 0;
    this.result = null;
    this.histCards = [];

    this.table = new EditableTable(this.$("#d-table"), {
      columns: [
        { key: "vr", label: "Vr", aria: "Volume ratio Vr" },
        { key: "alpha", label: "α", aria: "alpha", placeholder: "0–1" },
        { key: "unc", label: "± %", aria: "uncertainty percent", placeholder: "default" },
      ],
      rowName: "condition",
      onChange: () => this.markStale(),
    });

    this.distCard = new FigureCard(this.$("#d-dist"), {
      title: "Solubility distribution of WSOM (A<sub>0</sub>)", figure: SolubilityDistributionFigure, file: "solubility_distribution",
    });
    this.kernelCard = new FigureCard(this.$("#d-kernel"), {
      title: "",
      note: "f<sub>A</sub> = 1/(Vr·K<sub>OW</sub> + 1) for each volume ratio. Dashed lines: bin edges. A bin is well resolved when the curves differ inside it.",
      figure: PartitionKernelFigure, file: "partition_kernel",
    });
    this.resultTable = new FlipTable(this.$("#d-result-table"), [
      { label: "log K<sub>OW</sub>" }, { label: "log S (g cm⁻³)" }, { label: "Mean" }, { label: "SD" }, { label: "Normalized (→ ②)" },
    ]);
    this.fitCard = new FigureCard(this.$("#d-fit"), {
      title: "",
      note: "A check of the result. Filled circles: the α you entered, with the uncertainty range used in the Monte Carlo. Open squares: the α that the retrieved distribution predicts at the same Vr, Σ<sub>j</sub> f̄<sub>A,j</sub>(Vr)·F<sub>j</sub>. If the squares fall inside the error bars, the distribution explains your measurements; if not, the chosen bins cannot describe the data (try other bin centres).",
      figure: AlphaFitFigure, file: "alpha_fit",
    });
    FigureCard.fold(this.$("#d-fold-kernel"), () => [this.kernelCard]);
    FigureCard.fold(this.$("#d-fold-fit"), () => [this.fitCard]);
    FigureCard.fold(this.$("#d-fold-hist"), () => this.histCards);

    this.bindEvents();
    this.setMode(this.distCard.figure.mode);

    // defaults from config.py and the example list, then a first run
    try {
      const [defaults, examples] = await Promise.all([
        this.engine.call("defaults"),
        fetch(EXAMPLES_URL, { cache: "no-cache" }).then((r) => r.json()),
      ]);
      this.defaults = defaults;
      this.examples = examples;
      this.fillRelationMenu();
      this.fillExampleMenu();
      this.resetParameters();
      this.syncWithOtherPages(true);
      await this.run();
    } catch (err) {
      this.showError(err.message);
    }
  }

  onShow() {
    if (this.defaults && this.syncWithOtherPages()) this.run();
  }

  /**
   * Take over what another page did since this page last looked: an example picked there, or α sent
   * from ⓪ — the newer of the two. first = true: building the page, so load something in any case.
   * Returns true when the inputs changed.
   */
  syncWithOtherPages(first = false) {
    const ex = steps.take("example", this.seenExample);
    const step = steps.take("alpha", this.seenAlpha);
    if (ex) this.seenExample = ex.sent;
    if (step && (!ex || step.sent > ex.sent)) return this.loadFromPreviousStep();
    if (step) this.seenAlpha = step.sent;                                  // older than the example choice: superseded
    const key = ex && this.examples[ex.data.key] && this.examples[ex.data.key].alpha ? ex.data.key : null;
    const current = this.sourceKind === "example" ? this.$("#d-example").value : null;
    if (key && (first || key !== current)) {
      this.$("#d-example").value = key;
      this.loadExample(key);
      return true;
    }
    if (first) this.loadExample(this.$("#d-example").value);
    return first;
  }

  // ------------------------------------------------------------ inputs
  bindEvents() {
    const $ = this.$;
    $("#d-add").addEventListener("click", () => this.table.addRow());
    $("#d-example").addEventListener("change", (e) => {
      this.seenExample = steps.send("example", { key: e.target.value });      // the other pages follow
      this.loadExample(e.target.value);
      this.run();
    });
    $("#d-run").addEventListener("click", () => this.run());
    $("#d-reset").addEventListener("click", () => { this.resetParameters(true); this.run(); });
    $("#d-relation").addEventListener("change", (e) => this.pickRelation(e.target.value));
    for (const id of ["#d-a", "#d-b"]) $(id).addEventListener("input", () => { $("#d-relation").value = "custom"; });
    $("#d-params").addEventListener("input", () => this.markStale());
    // menus and tick boxes only: a text box also fires "change" when it loses focus, which would bring the
    // note back after a run and shift the page under the mouse just as the user clicks something below
    $("#d-params").addEventListener("change", (e) => { if (e.target.matches("select, input[type=checkbox]")) this.markStale(); });
    $("#d-axis-kow").addEventListener("click", () => this.setMode("log_Kow"));
    $("#d-axis-s").addEventListener("click", () => this.setMode("log_S"));
    $("#d-csv").addEventListener("click", () => this.result && downloadText("solubility_distribution.csv", this.result.csv));
    $("#d-send").addEventListener("click", () => this.sendToNextStep());
    bindUpload($("#d-upload"), (text, name) => this.loadCsv(text, name));
  }

  fillRelationMenu() {
    const options = Object.keys(this.defaults.KOW_S_RELATIONS)
      .map((k) => `<option value="${k}">${RELATION_LABELS[k] || k}</option>`).join("");
    this.$("#d-relation").innerHTML = options + `<option value="custom">Custom</option>`;
  }

  fillExampleMenu() {
    this.$("#d-example").innerHTML = Object.entries(this.examples)
      .filter(([k]) => !k.startsWith("_"))
      .map(([k, ex]) => `<option value="${k}" ${ex.available && ex.alpha ? "" : "disabled"}>${ex.label}${ex.available && ex.alpha ? "" : " — coming"}</option>`).join("");
  }

  pickRelation(key) {
    const ab = this.defaults.KOW_S_RELATIONS[key];
    if (!ab) return;
    this.$("#d-a").value = ab[0];
    this.$("#d-b").value = ab[1];
  }

  /**
   * "Reset to paper defaults": every parameter back to config.py.
   * With an example loaded, its α table and bins are restored too; your own data (CSV, typed, from ⓪) is not touched.
   */
  resetParameters(reloadExample = false) {
    const d = this.defaults;
    const $ = this.$;
    $("#d-unc").value = d.MC_UNCERTAINTY * 100;
    $("#d-noise").value = d.MC_NOISE;
    $("#d-n").value = d.MC_ITERATIONS;
    $("#d-width").value = d.DEFAULT_BIN_WIDTH;
    $("#d-relation").value = d.DEFAULT_KOW_S_RELATION;
    this.pickRelation(d.DEFAULT_KOW_S_RELATION);
    $("#d-normalize").checked = true;
    $("#d-seed").checked = false;
    if (reloadExample && this.sourceKind === "example") this.loadExample($("#d-example").value);
  }

  loadExample(key) {
    const ex = this.examples[key];
    if (!ex || !ex.alpha) return;
    const unc = ex.alpha.uncertainty_pct;
    this.table.setRows(ex.alpha.vr.map((v, i) => ({ vr: String(v), alpha: String(ex.alpha.value[i]), unc: unc ? String(unc[i]) : "" })));
    this.$("#d-bins").value = ex.bin_centers.join(", ");
    this.setSource(`Example: ${ex.label}${ex.note ? ` ${ex.note}` : ""}`, false);
    this.source = ex.label;
    this.sourceKind = "example";
  }

  async loadCsv(text, name) {
    try {
      const d = await this.engine.call("parse_alpha_csv", { text });
      const hasUnc = /uncertainty_pct/i.test(text.split("\n")[0]);
      this.table.setRows(d.vr.map((v, i) => ({ vr: String(v), alpha: String(d.alpha[i]), unc: hasUnc ? String(d.uncertainty_pct[i]) : "" })));
      this.setSource(`✓ Loaded ${name} (${d.vr.length} conditions)`, true);
      this.source = name;
      this.sourceKind = "csv";
      await this.run();
    } catch (err) {
      this.showError(`Could not read ${name}: ${err.message}. Expected columns: Vr, alpha, uncertainty_pct (optional).`);
    }
  }

  /** α sent by page ⓪ (if any, and not seen yet). Bins: the example's, or suggested from the Vr range. */
  loadFromPreviousStep() {
    const msg = steps.take("alpha", this.seenAlpha);
    if (!msg) return false;
    this.seenAlpha = msg.sent;
    const d = msg.data;
    this.table.setRows(d.vr.map((v, i) => ({ vr: String(v), alpha: String(d.alpha[i]), unc: "" })));
    const ex = d.example && this.examples[d.example];
    if (ex && ex.bin_centers) {
      this.$("#d-example").value = d.example;
      this.$("#d-bins").value = ex.bin_centers.join(", ");
      this.setSource(`✓ Received α from ⓪ (${d.vr.length} conditions)`, true);
    } else {
      this.$("#d-bins").value = suggestBins(d.vr).join(", ");
      this.setSource(`✓ Received α from ⓪ (${d.vr.length} conditions). Bin centres were suggested from your Vr range; change them if needed.`, true);
    }
    this.source = d.source || "step ⓪";
    this.sourceKind = "step";
    this.stepExample = ex && ex.bin_centers ? d.example : null;   // ⓪ used an example: ② can still fill its densities, κ_intr, WIOM
    return true;
  }

  setSource(text, ok) {
    const el = this.$("#d-source");
    el.textContent = text;
    el.className = ok ? "note note-ok" : "note";
  }

  /** Read and check all inputs. Throws an Error with a message for the user. */
  readInputs() {
    const $ = this.$;
    const number = (text, what) => {
      const v = Number(text);
      if (text === "" || !Number.isFinite(v)) throw new Error(`${what} must be a number.`);
      return v;
    };
    const defaultUnc = number($("#d-unc").value.trim(), "Default uncertainty");
    const rows = this.table.rows.filter((r) => r.vr !== "" || r.alpha !== "");
    if (rows.length === 0) throw new Error("Enter at least one condition (Vr and α).");
    const vr = [], alpha = [], uncertainty = [];
    rows.forEach((r, i) => {
      const v = number(r.vr, `Vr in row ${i + 1}`), a = number(r.alpha, `α in row ${i + 1}`);
      const u = r.unc === "" ? defaultUnc : number(r.unc, `± % in row ${i + 1}`);
      if (v <= 0) throw new Error(`Vr in row ${i + 1} must be larger than 0.`);
      if (a < 0 || a > 1) throw new Error(`α in row ${i + 1} must be between 0 and 1.`);
      if (u < 0 || u > 100) throw new Error(`± % in row ${i + 1} must be between 0 and 100.`);
      vr.push(v); alpha.push(a); uncertainty.push(u / 100);
    });
    if (new Set(vr).size !== vr.length) throw new Error("Each Vr can appear only once.");

    const bins = $("#d-bins").value.split(/[,;\s]+/).filter(Boolean).map((t) => number(t, "Bin centres"));
    if (bins.length === 0) throw new Error("Enter at least one bin centre.");
    if (new Set(bins).size !== bins.length) throw new Error("Bin centres must be different from each other.");
    const width = number($("#d-width").value.trim(), "Bin width");
    if (width <= 0) throw new Error("Bin width must be larger than 0.");
    const n = number($("#d-n").value.trim(), "Monte Carlo iterations");
    if (!Number.isInteger(n) || n < LIMITS.iterations[0] || n > LIMITS.iterations[1]) {
      throw new Error(`Monte Carlo iterations must be a whole number between ${LIMITS.iterations[0]} and ${LIMITS.iterations[1]}.`);
    }
    const a = number($("#d-a").value.trim(), "a (intercept)"), b = number($("#d-b").value.trim(), "b (slope)");
    if (b === 0) throw new Error("b (slope) cannot be 0.");

    return {
      vr, alpha, uncertainty, bin_centers: bins.sort((x, y) => x - y), bin_width: width, n,
      noise: $("#d-noise").value,
      seed: $("#d-seed").checked ? LIMITS.seed : null,
      relation: { a, b, name: $("#d-relation").value },
    };
  }

  // ------------------------------------------------------------ run
  async run() {
    const btn = this.$("#d-run");
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
    const t0 = performance.now();
    try {
      this.result = await this.engine.call("invert", inputs);
      this.inputs = inputs;
      this.elapsed = (performance.now() - t0) / 1000;
      this.showResult();
      this.root.dataset.state = "done";
    } catch (err) {
      this.showError(err.message);
      this.root.dataset.state = "error";
    } finally {
      btn.disabled = false;
      btn.textContent = "Run inversion";
    }
  }

  markStale() {
    if (this.result) this.$("#d-stale").hidden = false;
  }

  showError(text) {
    const el = this.$("#d-error");
    el.textContent = text;
    el.hidden = !text;
  }

  // ------------------------------------------------------------ results
  showResult() {
    const r = this.result, s = r.settings;
    const $ = this.$;
    $("#d-stale").hidden = true;
    $("#d-results").hidden = false;
    const noise = `±${this.uncertaintyText()} ${s.noise}`;

    this.distCard.setNote(`Bars: Monte Carlo mean · error bars: ±1 SD (n = ${s.n.toLocaleString("en-US")}, ${noise}) · ${this.source || ""}`);
    this.distCard.figure.render(r);
    this.kernelCard.figure.render(r.kernel);
    this.fitCard.figure.render(r.alpha_fit);
    this.showHistograms(r);

    this.resultTable.setRows(r.table.map((row) =>
      [signed(row.log_kow), signed(row.log_s), num(row.mean), num(row.sd), num(row.normalized)]));
    $("#d-sum").innerHTML = `Σ mean = ${num(r.sum_mean)}. ${$("#d-normalize").checked
      ? "Normalized to 1 before ②." : "Sent to ② as it is (not normalized)."}
      The CSV also contains the single NNLS solution from the central α values. Computed in ${this.elapsed.toFixed(1)} s.`;
    $("#d-assumptions").innerHTML = this.assumptionsText();
  }

  uncertaintyText() {
    const u = [...new Set(this.inputs.uncertainty.map((x) => Math.round(x * 1000) / 10))];
    return u.length === 1 ? `${u[0]} %` : `${Math.min(...u)}–${Math.max(...u)} %`;
  }

  showHistograms(r) {
    const host = this.$("#d-hist");
    if (this.histCards.length !== r.log_kow.length) {
      this.histCards.forEach((c) => c.figure.destroy());
      host.innerHTML = "";
      this.histCards = r.log_kow.map((k) => new FigureCard(host, {
        title: `log K<sub>OW</sub> = ${signed(k)}`, figure: McHistogramFigure, file: `mc_histogram_logKow_${k}`,
      }));
    }
    r.log_kow.forEach((k, i) => {
      this.histCards[i].el.querySelector("figcaption").innerHTML = `log K<sub>OW</sub> = ${signed(k)}`;
      this.histCards[i].setNote(`mean ${num(r.mean[i])} ± ${num(r.sd[i])}`);
      this.histCards[i].figure.render({
        centers: r.histograms.centers, width: r.histograms.width, fraction: r.histograms.fraction[i],
      });
    });
  }

  assumptionsText() {
    const r = this.result, s = r.settings, rel = r.relation;
    const relName = RELATION_LABELS[rel.name] ? `after ${RELATION_LABELS[rel.name]}` : "custom";
    const noise = s.noise === "uniform"
      ? `±${this.uncertaintyText()} uniform noise on α` : `normal noise on α (1 SD = ${this.uncertaintyText()})`;
    return `<b>Assumptions used in this run</b> — Monte Carlo: ${noise}, ${s.n.toLocaleString("en-US")} iterations${s.seed === null ? "" : `, fixed seed ${s.seed}`},
      result = mean ± SD; α<sub>Vr</sub> = Σ<sub>j</sub> f̄<sub>A,j</sub>(Vr)·F<sub>j</sub> (Lee et al., 2020);
      kernel = bin-average of 1/(Vr·K<sub>OW</sub> + 1) over ±${signed(r.bin_width / 2)} log units;
      NNLS (Lawson–Hanson, as MATLAB lsqnonneg);
      log K<sub>OW</sub> = ${signed(rel.a, 4)} ${rel.b < 0 ? "−" : "+"} ${Math.abs(rel.b)}·log S, ${relName}${rel.name === "kenaga_goring_1980" ? ", uncertainty Δlog S ≈ ±0.39 (Kuwata &amp; Lee, 2017)" : ""}.`;
  }

  setMode(mode) {
    this.distCard.figure.setMode(mode);
    for (const [id, m] of [["#d-axis-kow", "log_Kow"], ["#d-axis-s", "log_S"]]) {
      this.$(id).classList.toggle("active", m === mode);
      this.$(id).setAttribute("aria-pressed", String(m === mode));
    }
  }

  sendToNextStep() {
    if (!this.result) return;
    const r = this.result, normalize = this.$("#d-normalize").checked;
    steps.send("distribution", {
      log_kow: r.log_kow, log_s: r.log_s,
      mass_fraction: normalize ? r.normalized : r.mean,
      sd: normalize ? r.sd_normalized : r.sd,
      normalized: normalize, relation: r.relation, source: this.source || "",
      // which example the bins belong to, so ② can fill the densities, κ_intr and WIOM fraction
      example: this.sourceKind === "example" ? this.$("#d-example").value : this.sourceKind === "step" ? this.stepExample : null,
    });
    location.hash = "#/kohler";
  }
}

// ---------------------------------------------------------------- page template
const TEMPLATE = `
<div class="tool">
  <aside class="panel" id="d-params">
    <section class="panel-section">
      <p class="section-label">1 · Input</p>
      <div class="note" id="d-source"></div>
      <label class="upload" id="d-upload">
        <span><b>Upload CSV</b> or drop file here</span>
        <span class="muted small">Columns: Vr, alpha, uncertainty_pct (optional)</span>
        <input type="file" accept=".csv,text/csv" class="sr-only">
      </label>
      <div class="field"><label for="d-example">Or load example (all values stay editable)</label>
        <select id="d-example"></select></div>
      <div id="d-table"></div>
      <div class="hint">Vr = V<sub>octanol</sub> / V<sub>aqueous</sub>; α = mass fraction in the aqueous phase. Leave ± % empty to use the default uncertainty.</div>
      <button class="btn" type="button" id="d-add">+ Add condition</button>
    </section>

    <section class="panel-section">
      <p class="section-label">2 · Parameters</p>
      <div class="field-grid">
        <div class="field"><label for="d-unc">Default uncertainty (±%)</label><input id="d-unc" inputmode="decimal"></div>
        <div class="field"><label for="d-noise">Noise distribution</label>
          <select id="d-noise"><option value="uniform">Uniform (random)</option><option value="normal">Normal</option></select></div>
        <div class="field"><label for="d-n">Monte Carlo iterations</label><input id="d-n" inputmode="numeric"></div>
        <div class="field"><label for="d-width">Bin width (log units)</label><input id="d-width" inputmode="decimal"></div>
      </div>
      <div class="field"><label for="d-bins">Bin centres, log K<sub>OW</sub></label><input id="d-bins"></div>
      <div class="field"><label for="d-relation">K<sub>OW</sub>–S relationship</label><select id="d-relation"></select></div>
      <div class="field-grid">
        <div class="field"><label for="d-a">a (intercept)</label><input id="d-a" inputmode="decimal"></div>
        <div class="field"><label for="d-b">b (slope)</label><input id="d-b" inputmode="decimal"></div>
      </div>
      <div class="hint">log K<sub>OW</sub> = a + b · log S (S in g cm⁻³). Choosing a relationship fills a and b; typing your own values switches to “Custom”.</div>
      <details>
        <summary>Advanced</summary>
        <div class="details-body">
          <label class="check"><input type="checkbox" id="d-normalize" checked> Normalize Monte Carlo mean before ② (paper method)</label>
          <label class="check"><input type="checkbox" id="d-seed"> Reproducible Monte Carlo</label>
          <div class="hint indent">Uses a fixed random seed, so running the same inputs again gives exactly the same numbers. Turn on when you need to report or reproduce a result. Off by default: each run differs slightly within the uncertainty.</div>
        </div>
      </details>
      <div class="note note-error" id="d-error" role="alert" hidden></div>
      <div class="row">
        <button class="btn btn-primary" type="button" id="d-run">Run inversion</button>
        <button class="btn" type="button" id="d-reset">Reset to paper defaults</button>
      </div>
    </section>
  </aside>

  <section class="results" id="d-results" hidden>
    <div class="note note-wait" id="d-stale" hidden>Inputs changed since the last run. Press “Run inversion” to update the results.</div>
    <div class="row spread">
      <div class="row" role="group" aria-label="Primary x axis">
        <span class="small muted">Primary axis:</span>
        <button type="button" class="btn btn-pill" id="d-axis-kow">log K<sub>OW</sub></button>
        <button type="button" class="btn btn-pill" id="d-axis-s">log S</button>
      </div>
      <button class="btn" type="button" id="d-csv">⬇ CSV</button>
    </div>

    <div class="split">
      <div class="split-figure" id="d-dist"></div>
      <div class="card split-side">
        <div class="card-title">Results table</div>
        <div id="d-result-table"></div>
        <div class="hint" id="d-sum"></div>
        <div class="row"><button class="btn btn-primary" type="button" id="d-send">Send distribution to ② →</button></div>
      </div>
    </div>

    <details class="fold" id="d-fold-kernel">
      <summary>Partitioning functions and bins</summary>
      <div class="fold-body" id="d-kernel"></div>
    </details>
    <details class="fold" id="d-fold-fit">
      <summary>Check: does the distribution reproduce the measured α?</summary>
      <div class="fold-body" id="d-fit"></div>
    </details>
    <details class="fold" id="d-fold-hist">
      <summary>Monte Carlo spread per bin</summary>
      <div class="fold-body">
        <div class="hint">How often each mass fraction was obtained. A narrow peak = well constrained by the measured α; a pile at 0 with a long tail = poorly constrained (large SD).</div>
        <div class="figure-grid" id="d-hist"></div>
      </div>
    </details>

    <div class="assumptions" id="d-assumptions"></div>
  </section>
</div>`;
