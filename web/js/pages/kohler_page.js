/*
 * kohler_page.js — tool ②: solubility distribution  →  Köhler curve, dissolved fractions, κ.
 *
 * WHAT IT DOES
 *   Left: one row per solubility bin (log S, mass fraction, density or O/C + H/C,
 *   κ_intr), typed, uploaded, loaded from an example or sent from ①; then the
 *   particle and model parameters. "Run Köhler model" sends them to Python
 *   (web_api.kohler -> solubility_toolkit.KohlerModel) and the right side shows:
 *     - Köhler curve with a movable marker             figure key: kohler_curve
 *     - drawing of the droplet at that diameter        style key:  particle_cartoon
 *     - dissolved fraction ε of every component        figure key: dissolved_fraction_bars
 *     - contribution of every component to κ_eff       figure key: kappa_contribution_bars
 *     - critical point, κ_CCN at the given supersaturations, composition used
 *   Python runs once per "Run" and returns the whole curve; moving the slider only
 *   redraws in the browser.
 *   Examples are shared by all pages (StepStore slot "example"): picking one here makes ⓪ and ①
 *   load it too, and one picked there is loaded here when this tab is opened. Whatever happened
 *   last wins: a newer "Send distribution to ②" from ① replaces an older example choice, and the reverse.
 *
 *   "Sample shown" switches the model between the whole particle and the solutions derived
 *   from it: A0 (the WSOM = the bins) and A1A0 / O1A0 at a volume ratio (the bins times the
 *   partitioning kernel). The Vr offered are those of the measured-κ table.
 *   A particle = WSOM + WIOM (+ ammonium sulfate). "Particle (online)" is offered only when a
 *   WIOM or ammonium-sulfate fraction is entered: with both 0 it would be the same as A0
 *   (e.g. mosquito coil and peat, where only the water extracts were measured).
 *
 *   The folding section "Fit κ_intr" holds the measured κ_CCN of each fraction and runs
 *   web_api.kappa_fit -> solubility_toolkit.KappaIntrinsicFitter (minutes in a browser;
 *   progress bar and Cancel). Results:
 *     - modelled vs measured κ_CCN                     figure key: kappa_fit_scatter
 *     - accepted κ_intr of every component             figure key: kappa_intr_histograms
 *   "Use these κ_intr values" copies the fitted values into the bin table and reruns the model.
 *
 * HOW TO CHANGE
 *   Default σ, T, dry diameter, WIOM solubility   -> solubility_toolkit/config.py (read at start and by "Reset")
 *   Fit defaults (draws, tolerances, first range)  -> solubility_toolkit/config.py (KFIT_…)
 *   Names of the fractions                         -> FRACTIONS below
 *   Example particles                              -> web/examples/examples.json ("kohler" entries)
 *   Input limits                                   -> LIMITS below
 *   Which states get a jump button (i, ii, …)      -> findMarks() below
 *   Wording                                        -> the template at the bottom and assumptionsText()
 *   Figure looks                                   -> styles/figure_styles.js
 *   The calculation                                -> NOT here: solubility_toolkit/kohler.py, kappa_fit.py (+ pytest)
 */
import { BasePage } from "./BasePage.js";
import { EditableTable } from "../ui/EditableTable.js";
import { FigureCard } from "../ui/FigureCard.js";
import { ParticleCartoon, TWO_PHASE_THRESHOLD } from "../ui/ParticleCartoon.js";
import { bindUpload, downloadText } from "../ui/CsvIO.js";
import { steps } from "../ui/StepStore.js";
import { KohlerCurveFigure } from "../plots/KohlerCurveFigure.js";
import { DissolvedBarsFigure, KappaContributionFigure } from "../plots/ComponentBarsFigure.js";
import { KappaFitFigure, KappaIntrHistogramFigure } from "../plots/KappaFitFigures.js";

const EXAMPLES_URL = "examples/examples.json";
const LIMITS = { dd_nm: [5, 2000], slider_steps: 1000, s_mark: 0.99, draws: [5, 2000], kappa_step: 0.01 };
// The samples that can be modelled / measured. needsVr: defined by a volume ratio.
const FRACTIONS = {
  particle: { label: "Particle (online)", short: "Particle (online)", needsVr: false },
  A0: { label: "A0: WSOM (water extract)", short: "A0", needsVr: false },
  A1A0: { label: "A1A0 (aqueous phase at Vr)", short: "A1A0", needsVr: true },
  O1A0: { label: "O1A0 (octanol phase at Vr)", short: "O1A0", needsVr: true },
};
const fractionName = (f) => (FRACTIONS[f.type].needsVr ? `${FRACTIONS[f.type].short} [Vr ${f.vr}]` : FRACTIONS[f.type].short);
const MEASURED_COLUMNS = [
  { key: "type", label: "Fraction", aria: "fraction", options: Object.entries(FRACTIONS).map(([value, f]) => ({ value, label: f.short })) },
  { key: "vr", label: "Vr", aria: "volume ratio of this fraction", placeholder: "—" },
  { key: "ss", label: "SS (%)", aria: "supersaturations in percent, separated by commas", placeholder: "0.33, 0.46", text: true },
  { key: "kappa", label: "Measured κ<sub>CCN</sub>", aria: "measured kappa, one per supersaturation", placeholder: "0.13, 0.13", text: true },
];
const list = (values, digits) => (values || []).map((v) => Number(v.toFixed(digits))).join(", ");
const COLUMNS = {
  rho: [
    { key: "log_s", label: "log S", aria: "log S" },
    { key: "mass", label: "Mass fr.", aria: "mass fraction" },
    { key: "rho", label: "ρ", aria: "density in g per cubic centimetre" },
    { key: "kappa", label: "κ<sub>intr</sub>", aria: "intrinsic kappa" },
  ],
  oc: [
    { key: "log_s", label: "log S", aria: "log S" },
    { key: "mass", label: "Mass fr.", aria: "mass fraction" },
    { key: "oc", label: "O/C", aria: "O to C ratio" },
    { key: "hc", label: "H/C", aria: "H to C ratio" },
    { key: "kappa", label: "κ<sub>intr</sub>", aria: "intrinsic kappa" },
  ],
};
const num = (v, d = 3) => Number(v).toFixed(d);
const signed = (v, d = 2) => String(Number(Number(v).toFixed(d))).replace("-", "−");
const text = (v) => (v === null || v === undefined ? "" : String(v));

export default class KohlerPage extends BasePage {
  async build(root) {
    root.innerHTML = TEMPLATE;
    this.$ = (sel) => root.querySelector(sel);
    this.seenDistribution = 0;
    this.seenExample = 0;
    this.result = null;
    this.index = 1;               // position of the slider marker on the wet-diameter grid
    this.labelMode = "log_S";     // bin labels in the bar charts: "log_S" or "log_Kow"
    this.densityMode = "rho";     // "rho" (type the density) or "oc" (from O/C and H/C)
    this.relation = null;         // K_OW–S relation received from ① (null = config.py default)

    this.table = new EditableTable(this.$("#k-table"), { columns: COLUMNS.rho, rowName: "bin", onChange: () => this.markStale() });
    this.curve = new KohlerCurveFigure(this.$("#k-curve"));
    this.cartoon = new ParticleCartoon(this.$("#k-cartoon"));
    const row = this.$("#k-bars");
    this.epsCard = new FigureCard(row, { title: "", figure: DissolvedBarsFigure, file: "dissolved_fraction" });
    this.kappaCard = new FigureCard(row, { title: "", figure: KappaContributionFigure, file: "kappa_contribution" });

    // κ_intr fit
    this.measured = new EditableTable(this.$("#k-measured"), { columns: MEASURED_COLUMNS, rowName: "fraction", onChange: () => this.refreshSamples() });
    this.fitCard = new FigureCard(this.$("#k-fit-scatter"), {
      title: "Modelled vs measured κ<sub>CCN</sub>", figure: KappaFitFigure, file: "kappa_fit",
      note: "Modelled with the fitted κ<sub>intr</sub>. One point per fraction and supersaturation; points on the dashed line are reproduced exactly.",
    });
    this.fitHistCards = [];
    this.fitResult = null;
    this.engine.onProgress((done, total) => this.showFitProgress(done, total));
    FigureCard.fold(this.$("#k-fold-fit"), () => [this.fitCard, ...this.fitHistCards]);

    this.bindEvents();
    try {
      const [defaults, examples] = await Promise.all([
        this.engine.call("defaults"),
        fetch(EXAMPLES_URL, { cache: "no-cache" }).then((r) => r.json()),
      ]);
      this.defaults = defaults;
      this.examples = examples;
      this.$("#k-example").innerHTML = Object.entries(examples)
        .filter(([k, ex]) => !k.startsWith("_") && ex.kohler)
        .map(([k, ex]) => `<option value="${k}">${ex.kohler.label}</option>`).join("");
      this.resetParameters();
      this.resetFitSettings();
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
   * Take over what another page did since this page last looked: an example picked there, or a
   * distribution sent from ① — the newer of the two. first = true: building the page, so load
   * something in any case. Returns true when the inputs changed.
   */
  syncWithOtherPages(first = false) {
    const ex = steps.take("example", this.seenExample);
    const step = steps.take("distribution", this.seenDistribution);
    if (ex) this.seenExample = ex.sent;
    if (step && (!ex || step.sent > ex.sent)) return this.loadFromPreviousStep();
    if (step) this.seenDistribution = step.sent;                           // older than the example choice: superseded
    const key = ex && this.examples[ex.data.key] && this.examples[ex.data.key].kohler ? ex.data.key : null;
    const current = this.sourceKind === "example" ? this.$("#k-example").value : null;
    if (key && (first || key !== current)) {
      this.$("#k-example").value = key;
      this.resetParameters();
      this.loadExample(key);
      return true;
    }
    if (first) this.loadExample(this.$("#k-example").value);
    return first;
  }

  // ------------------------------------------------------------ inputs
  bindEvents() {
    const $ = this.$;
    $("#k-add").addEventListener("click", () => this.table.addRow());
    $("#k-example").addEventListener("change", (e) => {
      this.seenExample = steps.send("example", { key: e.target.value });      // the other pages follow
      this.resetParameters();
      this.loadExample(e.target.value);
      this.run();
    });
    $("#k-run").addEventListener("click", () => this.run());
    $("#k-reset").addEventListener("click", () => {
      this.resetParameters();
      if (this.sourceKind === "example") this.loadExample($("#k-example").value);
      this.run();
    });
    $("#k-params").addEventListener("input", () => this.markStale());
    // menus and tick boxes only: a text box also fires "change" when it loses focus, which would bring the
    // note back after a run and shift the page under the mouse just as the user clicks something below
    $("#k-params").addEventListener("change", (e) => { if (e.target.matches("select, input[type=checkbox]")) this.markStale(); });
    $("#k-rho").addEventListener("click", () => this.setDensityMode("rho"));
    $("#k-oc").addEventListener("click", () => this.setDensityMode("oc"));
    $("#k-label-s").addEventListener("click", () => this.setLabelMode("log_S"));
    $("#k-label-k").addEventListener("click", () => this.setLabelMode("log_Kow"));
    $("#k-csv").addEventListener("click", () => this.result && downloadText("kohler_curve.csv", this.result.csv));
    $("#k-png").addEventListener("click", () => this.curve.downloadPng("kohler_curve"));
    $("#k-slider").addEventListener("input", (e) => this.moveTo(this.indexFromSlider(Number(e.target.value))));
    $("#k-jumps").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-index]");
      if (btn) this.moveTo(Number(btn.dataset.index), true);
    });
    bindUpload($("#k-upload"), (csv, name) => this.loadCsv(csv, name));
    $("#k-sample").addEventListener("change", () => this.run());
    $("#k-measured-add").addEventListener("click", () => this.measured.addRow({ type: "A1A0" }));
    for (const id of ["#k-wiom", "#k-as"]) $(id).addEventListener("input", () => this.refreshParticleOptions());
    $("#k-fit").addEventListener("click", () => this.fit());
    $("#k-fit-cancel").addEventListener("click", () => this.engine.restart().catch(() => {}));
    $("#k-fit-apply").addEventListener("click", () => this.applyFit());
    $("#k-fit-reset").addEventListener("click", () => this.resetFitSettings());
  }

  resetFitSettings() {
    const d = this.defaults, $ = this.$;
    $("#k-fit-draws").value = d.KFIT_DRAWS;
    $("#k-fit-tol").value = d.KFIT_TOLERANCES.join(", ");
    $("#k-fit-lo").value = d.KFIT_INITIAL_RANGE[0];
    $("#k-fit-hi").value = d.KFIT_INITIAL_RANGE[1];
    $("#k-fit-seed").checked = false;
  }

  /** Rows of the measured-κ table from a list of { type, vr, ss_percent, kappa }. */
  setMeasured(rows) {
    const table = (rows || []).map((m) => ({ type: m.type, vr: text(m.vr), ss: list(m.ss_percent, 3), kappa: list(m.kappa, 4) }));
    this._particleShown = this.hasNonWsom() || table.some((r) => r.type === "particle");
    this.measured.setColumns(this.measuredColumns(this._particleShown));
    this.measured.setRows(table);
    this.refreshSamples();
  }

  /** WIOM or ammonium sulfate entered: only then is the whole particle different from A0. */
  hasNonWsom() {
    const v = (id) => Number(this.$(id).value) || 0;
    return v("#k-wiom") > 0 || v("#k-as") > 0;
  }

  /** Columns of the measured-κ table; withParticle = false leaves "Particle (online)" out of the Fraction menu. */
  measuredColumns(withParticle) {
    const cols = MEASURED_COLUMNS.map((c) => ({ ...c }));
    if (!withParticle) cols[0].options = cols[0].options.filter((o) => o.value !== "particle");
    return cols;
  }

  /** "Particle (online): WSOM + WIOM" — only the parts actually entered (WIOM and/or (NH₄)₂SO₄ > 0). */
  particleLabel() {
    const v = (id) => Number(this.$(id).value) || 0;
    const parts = ["WSOM", ...(v("#k-wiom") > 0 ? ["WIOM"] : []), ...(v("#k-as") > 0 ? ["(NH₄)₂SO₄"] : [])];
    return `${FRACTIONS.particle.label}: ${parts.join(" + ")}`;
  }

  /** After WIOM / (NH₄)₂SO₄ changed: offer "Particle (online)" or not, in both menus. */
  refreshParticleOptions() {
    const want = this.hasNonWsom() || this.measured.rows.some((r) => r.type === "particle");   // never drop a row's choice
    if (want !== this._particleShown) {
      this._particleShown = want;
      this.measured.setColumns(this.measuredColumns(want));
    }
    this.refreshSamples();
  }

  /** "Sample shown" menu: the particle (if it differs from A0), A0, and every A1A0 / O1A0 of the measured-κ table. */
  refreshSamples() {
    const menu = this.$("#k-sample");
    const keep = menu.value;
    const seen = new Set();
    const options = [...(this.hasNonWsom() ? [{ type: "particle" }] : []), { type: "A0" }];
    for (const r of this.measured.rows) {
      const vr = Number(r.vr);
      if (!FRACTIONS[r.type].needsVr || !(vr > 0) || seen.has(`${r.type}${vr}`)) continue;
      seen.add(`${r.type}${vr}`);
      options.push({ type: r.type, vr });
    }
    const label = (o) => (o.type === "particle" ? this.particleLabel() : FRACTIONS[o.type].needsVr ? fractionName(o) : FRACTIONS[o.type].label);
    menu.innerHTML = options.map((o) => `<option value='${JSON.stringify(o)}'>${label(o)}</option>`).join("");
    if ([...menu.options].some((o) => o.value === keep)) menu.value = keep;
  }

  /** "Reset to paper defaults": model parameters back to config.py (an example's own values are reloaded after). */
  resetParameters() {
    const d = this.defaults, $ = this.$;
    $("#k-dd").value = d.DEFAULT_DRY_DIAMETER_NM;
    $("#k-sigma").value = d.SIGMA_WATER;
    $("#k-temp").value = d.TEMPERATURE;
    $("#k-wiom").value = 0;
    $("#k-wiom-kappa").value = 0;
    $("#k-as").value = 0;
    $("#k-units").value = "paper";
    $("#k-raoult").value = "dilute";
    $("#k-grid").value = "paper";
  }

  setDensityMode(mode) {
    this.densityMode = mode;
    this.table.setColumns(COLUMNS[mode]);
    for (const [id, m] of [["#k-rho", "rho"], ["#k-oc", "oc"]]) {
      this.$(id).classList.toggle("active", m === mode);
      this.$(id).setAttribute("aria-pressed", String(m === mode));
    }
    this.markStale();
  }

  logS(logKow) {
    const [a, b] = this.relation ? [this.relation.a, this.relation.b]
      : this.defaults.KOW_S_RELATIONS[this.defaults.DEFAULT_KOW_S_RELATION];
    return Number(((logKow - a) / b).toFixed(4));
  }

  /** Rows of the bin table from an example's "kohler" entry (log S from its log K_OW bins). */
  exampleRows(k) {
    return k.log_kow.map((kow, i) => ({
      log_s: text(this.logS(kow)), mass: text(k.mass_fraction[i]), rho: text(k.density[i]),
      oc: text(k.o_c && k.o_c[i]), hc: text(k.h_c && k.h_c[i]), kappa: text(k.kappa_intr[i]),
    }));
  }

  loadExample(key) {
    const k = this.examples[key].kohler;
    this.relation = null;
    this.table.setRows(this.exampleRows(k));
    const $ = this.$;
    $("#k-wiom").value = k.wiom_fraction || 0;
    $("#k-wiom-kappa").value = k.wiom_kappa || 0;
    if (k.temperature) $("#k-temp").value = k.temperature;
    $("#k-ss").value = (k.ss_percent || []).map((s) => Number(s.toFixed(3))).join(", ");
    this.setMeasured(k.measured);
    this.clearFit();
    this.setSource(`Example: ${k.label}. ${k.note || ""}`, false);
    this.source = k.label;
    this.sourceKind = "example";
  }

  async loadCsv(csv, name) {
    try {
      const d = await this.engine.call("parse_distribution_csv", { text: csv });
      this.relation = null;
      this.table.setRows(d.log_s.map((s, i) => ({
        log_s: text(s), mass: text(d.mass_fraction[i]), rho: text(d.density && d.density[i]),
        oc: text(d.o_c && d.o_c[i]), hc: text(d.h_c && d.h_c[i]), kappa: text(d.kappa_intr && d.kappa_intr[i]),
      })));
      if (!d.density && d.o_c && d.h_c) this.setDensityMode("oc");
      this.setMeasured([]);
      this.clearFit();
      this.setSource(`✓ Loaded ${name} (${d.log_s.length} bins)`, true);
      this.source = name;
      this.sourceKind = "csv";
      await this.run();
    } catch (err) {
      this.showError(`Could not read ${name}: ${err.message}.`);
    }
  }

  /** Distribution sent by page ① (if any, and not seen yet). */
  loadFromPreviousStep() {
    const msg = steps.take("distribution", this.seenDistribution);
    if (!msg) return false;
    this.seenDistribution = msg.sent;
    const d = msg.data;
    this.relation = d.relation;
    // density and κ_intr are not part of the distribution: take them from the example when ① used one
    const k = d.example && this.examples[d.example] && this.examples[d.example].kohler;
    const known = k && k.log_kow.length === d.log_kow.length && k.log_kow.every((v, i) => v === d.log_kow[i]);
    this.table.setRows(d.log_s.map((s, i) => ({
      log_s: text(Number(s.toFixed(4))), mass: text(Number(d.mass_fraction[i].toFixed(4))),
      rho: known ? text(k.density[i]) : "", oc: known && k.o_c ? text(k.o_c[i]) : "",
      hc: known && k.h_c ? text(k.h_c[i]) : "", kappa: known ? text(k.kappa_intr[i]) : "",
    })));
    if (known) {
      this.$("#k-example").value = d.example;
      this.$("#k-wiom").value = k.wiom_fraction || 0;
      this.$("#k-wiom-kappa").value = k.wiom_kappa || 0;
      if (k.temperature) this.$("#k-temp").value = k.temperature;
      this.$("#k-ss").value = (k.ss_percent || []).map((s) => Number(s.toFixed(3))).join(", ");
    }
    this.setMeasured(known ? k.measured : []);
    this.clearFit();
    this.setSource(`✓ Received distribution from ① (${d.log_s.length} bins${d.normalized ? ", normalized" : ""}).`
      + (known ? " Density and κ_intr filled from the example." : " Enter the density (or O/C, H/C) and κ_intr of each bin."), true);
    this.source = d.source || "step ①";
    this.sourceKind = "step";
    return true;
  }

  setSource(message, ok) {
    const el = this.$("#k-source");
    el.textContent = message;
    el.className = ok ? "note note-ok" : "note";
  }

  /**
   * Read and check all inputs. Throws an Error with a message for the user.
   * needKappa = false: empty κ_intr cells are allowed (the fit does not use them).
   */
  readInputs(needKappa = true) {
    const $ = this.$;
    const number = (t, what, { min = -Infinity, max = Infinity, minOpen = false } = {}) => {
      const v = Number(t);
      if (t === "" || t === undefined || !Number.isFinite(v)) throw new Error(`${what} must be a number.`);
      if (v < min || v > max || (minOpen && v === min)) {
        throw new Error(`${what} must be ${minOpen ? "larger than" : "at least"} ${min}${max === Infinity ? "" : ` and at most ${max}`}.`);
      }
      return v;
    };
    const rows = this.table.rows.filter((r) => r.log_s !== "" || r.mass !== "");
    if (rows.length === 0) throw new Error("Enter at least one bin (log S and mass fraction).");
    const bins = rows.map((r, i) => {
      const where = `in row ${i + 1}`;
      const bin = {
        log_s: number(r.log_s, `log S ${where}`),
        mass_fraction: number(r.mass, `Mass fraction ${where}`, { min: 0 }),
        kappa_intr: !needKappa && r.kappa === "" ? 0 : number(r.kappa, `κ_intr ${where}`, { min: 0 }),
      };
      if (this.densityMode === "rho") bin.density = number(r.rho, `Density ρ ${where}`, { min: 0, minOpen: true });
      else {
        bin.o_c = number(r.oc, `O/C ${where}`, { min: 0 });
        bin.h_c = number(r.hc, `H/C ${where}`, { min: 0 });
      }
      return bin;
    });
    const wiom = number($("#k-wiom").value.trim(), "WIOM fraction", { min: 0, max: 0.99 });
    const as = number($("#k-as").value.trim(), "(NH₄)₂SO₄ fraction", { min: 0, max: 0.99 });
    if (wiom + as >= 1) throw new Error("WIOM fraction + (NH₄)₂SO₄ fraction must be smaller than 1.");
    const ss = $("#k-ss").value.split(/[,;\s]+/).filter(Boolean).map((t) => number(t, "Supersaturations", { min: 0, minOpen: true }));
    return {
      bins,
      dd_nm: number($("#k-dd").value.trim(), "Dry diameter", { min: LIMITS.dd_nm[0], max: LIMITS.dd_nm[1] }),
      sigma: number($("#k-sigma").value.trim(), "Surface tension", { min: 0, minOpen: true }),
      temperature: number($("#k-temp").value.trim(), "Temperature", { min: 0, minOpen: true }),
      wiom_fraction: wiom,
      wiom_kappa: number($("#k-wiom-kappa").value.trim(), "WIOM κ_intr", { min: 0 }),
      as_fraction: as,
      solubility_units: $("#k-units").value, raoult: $("#k-raoult").value, grid: $("#k-grid").value,
      ss_percent: ss, relation: this.relation,
      sample: JSON.parse($("#k-sample").value || '{"type":"particle"}'),
    };
  }

  /** The measured-κ table as a list of { type, vr, ss_percent, kappa }. Throws an Error for the user. */
  readMeasured() {
    const numbers = (t, what) => t.split(/[,;\s]+/).filter(Boolean).map((x) => {
      const v = Number(x);
      if (!Number.isFinite(v) || v <= 0) throw new Error(`${what} must be positive numbers separated by commas.`);
      return v;
    });
    const rows = this.measured.rows.filter((r) => r.ss !== "" || r.kappa !== "");
    if (rows.length === 0) throw new Error("Enter the measured κ_CCN of at least one fraction.");
    const names = new Set();
    return rows.map((r, i) => {
      const where = `in row ${i + 1} of the measured κ table`;
      const out = { type: r.type, ss_percent: numbers(r.ss, `SS ${where}`), kappa: numbers(r.kappa, `κ ${where}`) };
      if (out.ss_percent.length !== out.kappa.length || out.kappa.length === 0) {
        throw new Error(`Row ${i + 1} of the measured κ table needs one κ for every SS (now ${out.ss_percent.length} SS and ${out.kappa.length} κ).`);
      }
      if (FRACTIONS[r.type].needsVr) {
        out.vr = Number(r.vr);
        if (!(out.vr > 0)) throw new Error(`Vr ${where} must be a number larger than 0.`);
      }
      if (r.type === "particle" && !this.hasNonWsom()) {
        throw new Error(`Row ${i + 1} of the measured κ table is a whole particle, but the WIOM and (NH₄)₂SO₄ fractions are both 0, so it would be modelled exactly like A0. Enter the WIOM (or ammonium sulfate) fraction of the particle, or choose A0.`);
      }
      const name = fractionName(out);
      if (names.has(name)) throw new Error(`${name} is listed twice in the measured κ table.`);
      names.add(name);
      return out;
    });
  }

  readFitSettings() {
    const $ = this.$;
    const draws = Number($("#k-fit-draws").value.trim());
    if (!Number.isInteger(draws) || draws < LIMITS.draws[0] || draws > LIMITS.draws[1]) {
      throw new Error(`Draws per round must be a whole number between ${LIMITS.draws[0]} and ${LIMITS.draws[1]}.`);
    }
    const tolerances = $("#k-fit-tol").value.split(/[,;\s]+/).filter(Boolean).map(Number);
    if (tolerances.length === 0 || tolerances.some((t) => !(t > 0))) throw new Error("Tolerances must be positive numbers separated by commas (one per round).");
    const lo = Number($("#k-fit-lo").value.trim()), hi = Number($("#k-fit-hi").value.trim());
    if (!(lo >= 0 && hi > lo && hi <= 2)) throw new Error("First κ_intr range: the lower value must be at least 0 and smaller than the upper value.");
    return { draws, tolerances, initial_range: [lo, hi], seed: $("#k-fit-seed").checked ? 42 : null };
  }

  // ------------------------------------------------------------ run
  async run() {
    const btn = this.$("#k-run");
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
      this.result = await this.engine.call("kohler", inputs);
      this.inputs = inputs;
      this.showResult();
      this.root.dataset.state = "done";
    } catch (err) {
      this.showError(err.message);
      this.root.dataset.state = "error";
    } finally {
      btn.disabled = false;
      btn.textContent = "Run Köhler model";
    }
  }

  markStale() {
    if (this.result) this.$("#k-stale").hidden = false;
  }

  showError(message) {
    const el = this.$("#k-error");
    el.textContent = message;
    el.hidden = !message;
  }

  // ------------------------------------------------------------ results
  showResult() {
    const r = this.result, $ = this.$;
    $("#k-stale").hidden = true;
    $("#k-results").hidden = false;
    this.shown = r.components.map((c, i) => ({ ...c, i })).filter((c) => c.volume_fraction > 0);   // components drawn
    this.kappaMax = Math.max(...this.shown.map((c) => c.volume_fraction * c.kappa_intr));
    this.marks = this.findMarks();

    const sample = this.inputs.sample;
    $("#k-curve-title").innerHTML = `Köhler curve and particle state · D<sub>d</sub> = ${Number(r.dd_nm)} nm · ${sample.type === "particle" ? this.source || "" : fractionName(sample)}`;
    $("#k-sample-note").textContent = sample.type === "particle" ? ""
      : `Showing ${fractionName(sample)}: a particle made of this solution only (no WIOM, no ammonium sulfate).`;
    $("#k-jumps").innerHTML = this.marks.map((m) =>
      `<button type="button" class="btn btn-pill" data-index="${m.index}">${m.label} · ${m.text}</button>`).join("");

    const c = r.critical;
    const kappa = r.kappa_ccn;
    const rows = [
      [`Critical saturation ratio s<sub>c</sub> (D<sub>d</sub> ${Number(r.dd_nm)} nm)`, `${num(c.s, 5)} (SS ${num(c.ss_percent, 3)} %)`, "maximum of the Köhler curve"],
      ["Wet diameter at s<sub>c</sub>", `${num(c.d_nm, 0)} nm`, ""],
      ["Dissolved fraction at s<sub>c</sub> (volume)", num(c.dissolved, 3), c.phase],
    ];
    if (kappa.ss_percent.length) {
      rows.push([`κ<sub>CCN</sub> (apparent) at SS ${kappa.ss_percent.map((s) => Number(s.toFixed(3))).join(" / ")} %`,
        kappa.kappa.map((k, i) => (kappa.in_range[i] ? num(k) : "—")).join(" / "),
        kappa.in_range.every(Boolean) ? "from s<sub>c</sub>(D<sub>d</sub>) of the scanned dry diameters"
          : "— = outside the range reached by the scanned dry diameters"]);
    }
    $("#k-result-table tbody").innerHTML = rows.map((x) => `<tr><td>${x[0]}</td><td>${x[1]}</td><td class="muted">${x[2]}</td></tr>`).join("");

    $("#k-comp-table tbody").innerHTML = this.shown.map((x) => `<tr>
      <td>${x.kind === "WSOM" ? "WSOM bin" : x.kind === "AS" ? "(NH₄)₂SO₄" : "WIOM"}</td>
      <td class="num">${signed(x.log_s)}</td><td class="num">${x.log_kow === null ? "—" : signed(x.log_kow)}</td>
      <td class="num">${num(x.volume_fraction)}</td><td class="num">${x.density ? num(x.density) : "—"}</td>
      <td class="num">${num(x.kappa_intr)}</td></tr>`).join("");
    $("#k-assumptions").innerHTML = this.assumptionsText();

    this.moveTo(c.index, true);
  }

  /** Notable states along the curve, in order of wet diameter; they become the i, ii, … points and buttons. */
  findMarks() {
    const r = this.result;
    const found = [];
    const first = (test) => r.d_nm.findIndex((_, i) => i > 0 && test(i));
    const near = first((i) => r.s[i] >= LIMITS.s_mark);
    if (near > 0 && near < r.critical.index) found.push({ index: near, text: `s = ${LIMITS.s_mark}` });
    found.push({ index: r.critical.index, text: "s<sub>c</sub> (activation)" });
    const full = first((i) => 1 - r.dissolved[i] <= TWO_PHASE_THRESHOLD);
    this.fullIndex = full;
    if (full > 0) found.push({ index: full, text: "fully dissolved" });
    const roman = ["i", "ii", "iii", "iv"];
    return found.sort((a, b) => a.index - b.index).map((m, n) => ({ ...m, label: roman[n] }));
  }

  // slider position (0…slider_steps, logarithmic in D)  <->  index on the wet-diameter grid
  indexFromSlider(t) {
    const d = this.result.d_nm, lo = d[1], hi = d[d.length - 1];
    const target = lo * (hi / lo) ** (t / LIMITS.slider_steps);
    let a = 1, b = d.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (d[m] < target) a = m; else b = m; }
    return target - d[a] < d[b] - target ? a : b;
  }

  sliderFromIndex(i) {
    const d = this.result.d_nm, lo = d[1], hi = d[d.length - 1];
    return Math.round(LIMITS.slider_steps * Math.log(d[i] / lo) / Math.log(hi / lo));
  }

  /** Move the marker to grid index i and redraw everything that depends on it (no Python call). */
  moveTo(i, setSlider = false) {
    this.index = i;
    if (setSlider) this.$("#k-slider").value = this.sliderFromIndex(i);
    if (this._frame) return;                                  // at most one redraw per screen refresh
    this._frame = requestAnimationFrame(() => { this._frame = null; this.drawAt(this.index); });
  }

  binLabel(c) {
    if (c.kind === "AS") return "(NH₄)₂SO₄";
    if (c.kind === "WIOM") return `WIOM (log S = ${signed(c.log_s)})`;   // log S from config.py (WIOM_LOG_S)
    return this.labelMode === "log_S" ? `log S = ${signed(c.log_s)}` : `log K<sub>OW</sub> = ${signed(c.log_kow)}`;
  }

  drawAt(i) {
    const r = this.result, $ = this.$;
    const d = r.d_nm[i], s = r.s[i], undissolved = 1 - r.dissolved[i];
    const d1 = r.d_nm[r.d_nm.length - 1];
    this.curve.render({
      d_nm: r.d_nm, s: r.s, index: i, marks: this.marks,
      two_phase_until_nm: this.fullIndex > 0 ? r.d_nm[this.fullIndex] : null,
    });
    this.cartoon.update({ d_nm: d, dd_nm: r.dd_nm, dmax_nm: d1, undissolved });

    const labels = this.shown.map((c) => this.binLabel(c));
    const eps = this.shown.map((c) => r.eps[i][c.i]);
    this.epsCard.setTitle(`Dissolved fraction ε per component at ${num(d, 0)} nm`);
    this.epsCard.setNote(`Blue = dissolved in the aqueous phase, orange = still in the organic phase. Total dissolved (volume): <b>${num(r.dissolved[i])}</b>`);
    this.epsCard.figure.render({ labels, eps });
    this.kappaCard.setTitle("Water uptake per component: contribution to κ<sub>eff</sub>");
    this.kappaCard.setNote(`Each component lowers the water activity by f<sub>i</sub> · ε<sub>i</sub> · κ<sub>intr,i</sub> (volume fraction × dissolved fraction × hygroscopicity). Their sum is the effective κ of the particle at this diameter: <b>${num(r.kappa_eff[i])}</b>`);
    this.kappaCard.figure.render({ labels, values: this.shown.map((c, n) => c.volume_fraction * eps[n] * c.kappa_intr), max: this.kappaMax });

    const humidity = s < 1 ? `RH ${num(s * 100, 1)} %` : `SS ${num((s - 1) * 100, 3)} %`;
    $("#k-slider-label").innerHTML = `Drag to change the wet diameter: <b>${num(d, 0)} nm</b> · s = <b>${num(s, 4)}</b> (${humidity})`;
    $("#k-slider").setAttribute("aria-valuetext", `${num(d, 0)} nanometres, saturation ratio ${num(s, 4)}`);
  }

  setLabelMode(mode) {
    this.labelMode = mode;
    for (const [id, m] of [["#k-label-s", "log_S"], ["#k-label-k", "log_Kow"]]) {
      this.$(id).classList.toggle("active", m === mode);
      this.$(id).setAttribute("aria-pressed", String(m === mode));
    }
    if (this.result) this.drawAt(this.index);
  }

  // ------------------------------------------------------------ κ_intr fit
  async fit() {
    const $ = this.$;
    let args;
    try {
      const n = this.readInputs(false);
      args = {
        bins: n.bins, measured: this.readMeasured(), wiom_fraction: n.wiom_fraction, wiom_kappa: n.wiom_kappa,
        as_fraction: n.as_fraction, sigma: n.sigma, temperature: n.temperature, solubility_units: n.solubility_units,
        raoult: n.raoult, grid: n.grid, relation: n.relation, ...this.readFitSettings(),
      };
    } catch (err) {
      this.showFitError(err.message);
      return;
    }
    this.showFitError("");
    this.fitRounds = args.tolerances.length;
    this.fitStart = performance.now();
    $("#k-fit").disabled = true;
    $("#k-fit-cancel").hidden = false;
    $("#k-fit-progress").hidden = false;
    this.showFitProgress(0, args.draws * args.tolerances.length);
    this.root.dataset.fit = "running";
    try {
      this.fitResult = await this.engine.call("kappa_fit", args);
      this.fitSeconds = (performance.now() - this.fitStart) / 1000;
      this.showFit();
      this.root.dataset.fit = "done";
    } catch (err) {
      this.showFitError(err.cancelled ? "Fit cancelled. The Python engine is restarting; results on the other tabs are kept." : err.message);
      this.root.dataset.fit = err.cancelled ? "cancelled" : "error";
    } finally {
      $("#k-fit").disabled = false;
      $("#k-fit-cancel").hidden = true;
      $("#k-fit-progress").hidden = true;
    }
  }

  showFitProgress(done, total) {
    const box = this.$("#k-fit-progress");
    if (box.hidden) return;
    const elapsed = (performance.now() - this.fitStart) / 1000;
    const left = done > 0 ? elapsed / done * (total - done) : null;
    const round = Math.min(this.fitRounds, Math.floor(done / (total / this.fitRounds)) + 1);
    box.querySelector("progress").value = total ? done / total : 0;
    box.querySelector("span").textContent = `Round ${round} of ${this.fitRounds} · ${done} of ${total} κ sets`
      + (left === null ? "" : ` · about ${left < 90 ? `${Math.ceil(left)} s` : `${Math.ceil(left / 60)} min`} left`);
  }

  showFitError(message) {
    const el = this.$("#k-fit-error");
    el.textContent = message;
    el.hidden = !message;
  }

  clearFit() {
    this.fitResult = null;
    this.$("#k-fit-output").hidden = true;
    this.showFitError("");
  }

  componentLabel(c) {
    if (c.kind === "WIOM") return "WIOM";
    if (c.kind === "AS") return "(NH₄)₂SO₄";
    return `log S = ${signed(c.log_s)} (log K<sub>OW</sub> = ${signed(c.log_kow)})`;
  }

  showFit() {
    const f = this.fitResult, $ = this.$;
    $("#k-fit-output").hidden = false;
    $("#k-fit-rounds tbody").innerHTML = f.rounds.map((r, i) => `<tr>
      <td class="num">${i + 1}</td><td class="num">${r.tolerance}</td><td class="num">${r.n_accepted} of ${f.draws}</td>
      <td class="num">${num(r.best_score, 4)}</td></tr>`).join("");
    const minutes = this.fitSeconds >= 90 ? `${(this.fitSeconds / 60).toFixed(1)} min` : `${Math.round(this.fitSeconds)} s`;
    $("#k-fit-summary").className = f.ok ? "note note-ok" : "note note-wait";
    $("#k-fit-summary").textContent = f.ok
      ? `✓ ${f.n_accepted} sets accepted in the last round (computed in ${minutes}). κ_intr = their mean ± SD. Σ(κ_meas − κ_model)² with the mean values: ${num(f.score, 4)}.`
      : `Fewer than 2 sets were accepted in the last round, so no κ_intr can be reported. Try more draws per round or a larger last tolerance (the best set of the last round reached ${num(f.rounds[f.rounds.length - 1].best_score, 4)}).`;
    $("#k-fit-values").hidden = !f.ok;
    if (!f.ok) return;

    const current = this.inputs ? [...this.inputs.bins.map((b) => b.kappa_intr), this.inputs.wiom_kappa] : [];
    $("#k-fit-table tbody").innerHTML = f.components.map((c, i) => `<tr>
      <td>${this.componentLabel(c)}</td><td class="num">${current[i] === undefined ? "—" : num(current[i])}</td>
      <td class="num">${c.constrained ? num(f.mean[i]) : "—"}</td><td class="num">${c.constrained ? num(f.sd[i]) : "—"}</td></tr>`).join("");
    const free = f.components.filter((c) => !c.constrained).map((c) => c.kind);
    $("#k-fit-free").textContent = free.length
      ? `— = not constrained: ${free.join(", ")} has volume fraction 0 in every measured fraction, so the data say nothing about its κ_intr.` : "";
    this.fitCard.figure.render({ samples: f.samples });

    const shown = f.components.map((c, i) => ({ ...c, i })).filter((c) => c.constrained);
    const host = $("#k-fit-hist");
    this.fitHistCards.forEach((c) => c.figure.destroy());
    host.innerHTML = "";
    this.fitHistCards = shown.map((c) => {
      const card = new FigureCard(host, { title: this.componentLabel(c), figure: KappaIntrHistogramFigure, file: `kappa_intr_${c.name}`, note: `mean ${num(f.mean[c.i])} ± ${num(f.sd[c.i])}` });
      card.figure.render({ values: f.accepted.map((row) => row[c.i]), mean: f.mean[c.i], step: LIMITS.kappa_step });
      return card;
    });
  }

  /** "Use these κ_intr values": fitted means into the bin table (and WIOM κ), then rerun the model. */
  applyFit() {
    const f = this.fitResult;
    if (!f || !f.ok) return;
    let i = 0;
    const rows = this.table.rows.map((r) => {
      if (r.log_s === "" && r.mass === "") return r;
      const c = f.components[i], value = f.mean[i];
      i += 1;
      return c && c.constrained ? { ...r, kappa: String(Number(value.toFixed(4))) } : r;
    });
    this.table.setRows(rows);
    const wiom = f.components.findIndex((c) => c.kind === "WIOM");
    if (wiom >= 0 && f.components[wiom].constrained) this.$("#k-wiom-kappa").value = Number(f.mean[wiom].toFixed(4));
    this.run().then(() => { if (this.fitResult) this.showFit(); });
  }

  assumptionsText() {
    const s = this.result.settings, n = this.inputs;
    const eps = s.solubility_units === "paper"
      ? "S<sub>i</sub> in g cm⁻³ used directly (as in the paper code)" : "S<sub>i</sub>/ρ<sub>i</sub> (volume per volume)";
    const raoult = s.raoult === "dilute" ? "dilute-solution Raoult term (Lee et al., 2022, eq. 6)" : "full κ-Köhler water activity (Petters &amp; Kreidenweis, 2008)";
    const grid = s.grid === "paper" ? "wet-diameter grid as in the paper code (linear, 1000 points to 5 µm)" : "fine logarithmic wet-diameter grid";
    return `<b>Assumptions used in this run</b> — solubility distribution model (Riipinen et al., 2015; Lee et al., 2022, eq. 6);
      ε<sub>i</sub> = min[1, (D³/D<sub>d</sub>³ − 1) · S<sub>i</sub>/f<sub>i</sub>] with ${eps};
      mass fractions converted to volume fractions with ${this.densityMode === "rho" ? "the densities entered" : "densities from O/C and H/C (Kuwata et al., 2012)"};
      ${n.wiom_fraction > 0 ? `WIOM: volume fraction ${n.wiom_fraction}, S = 10<sup>${s.wiom_log_s}</sup> g cm⁻³; ` : ""}
      ${n.as_fraction > 0 ? `ammonium sulfate: volume fraction ${n.as_fraction}; ` : ""}
      ${raoult}; σ = ${s.sigma} N m⁻¹ in the Kelvin term, T = ${s.temperature} K; ${grid};
      κ<sub>CCN</sub> from s<sub>c</sub> with the surface tension of water (Petters &amp; Kreidenweis, 2008),
      s<sub>c</sub>(D<sub>d</sub>) computed for dry diameters ${this.defaults.DRY_DIAMETERS_NM[0]}–${this.defaults.DRY_DIAMETERS_NM[this.defaults.DRY_DIAMETERS_NM.length - 1]} nm.
      ${this.inputs.sample.type === "A1A0" || this.inputs.sample.type === "O1A0"
    ? `${fractionName(this.inputs.sample)} = the bins multiplied by the bin-averaged ${this.inputs.sample.type === "A1A0" ? "f<sub>A</sub>" : "(1 − f<sub>A</sub>)"} at that Vr (bin width ${s.bin_width} log units) and renormalized.` : ""}`;
  }
}

// ---------------------------------------------------------------- page template
const TEMPLATE = `
<div class="tool">
  <aside class="panel panel-wide" id="k-params">
    <section class="panel-section">
      <p class="section-label">1 · Input</p>
      <div class="note" id="k-source"></div>
      <label class="upload" id="k-upload">
        <span><b>Upload CSV</b> or drop file here</span>
        <span class="muted small">Columns: log_S, mass_fraction, density (or O_C and H_C), kappa_intr</span>
        <input type="file" accept=".csv,text/csv" class="sr-only">
      </label>
      <div class="field"><label for="k-example">Or load example (all values stay editable)</label><select id="k-example"></select></div>
      <div class="row small" role="group" aria-label="How the density of each bin is given">
        <span class="muted">Density:</span>
        <button type="button" class="btn btn-pill btn-small active" id="k-rho" aria-pressed="true">enter ρ</button>
        <button type="button" class="btn btn-pill btn-small" id="k-oc" aria-pressed="false">from O/C, H/C</button>
      </div>
      <div id="k-table"></div>
      <div class="hint">One row per solubility bin of the water-soluble organic matter. S in g cm⁻³, ρ in g cm⁻³. Mass fractions are normalized to 1. ρ from O/C and H/C: Kuwata et al. (2012).</div>
      <button class="btn" type="button" id="k-add">+ Add bin</button>
    </section>

    <section class="panel-section">
      <p class="section-label">2 · Parameters</p>
      <div class="field-grid">
        <div class="field"><label for="k-dd">Dry diameter D<sub>d</sub> (nm)</label><input id="k-dd" inputmode="decimal"></div>
        <div class="field"><label for="k-sigma">Surface tension σ (N m⁻¹)</label><input id="k-sigma" inputmode="decimal"></div>
        <div class="field"><label for="k-temp">Temperature (K)</label><input id="k-temp" inputmode="decimal"></div>
        <div class="field"><label for="k-as">(NH₄)₂SO₄ volume fraction</label><input id="k-as" inputmode="decimal"></div>
        <div class="field"><label for="k-wiom">WIOM volume fraction</label><input id="k-wiom" inputmode="decimal"></div>
        <div class="field"><label for="k-wiom-kappa">WIOM κ<sub>intr</sub></label><input id="k-wiom-kappa" inputmode="decimal"></div>
      </div>
      <div class="hint">WIOM = water-insoluble organic matter (log S = −6), added to the bins above as a fraction of the organic volume (= of the whole dry particle when there is no ammonium sulfate). Particle = WSOM + WIOM (+ ammonium sulfate). Enter the WIOM fraction to model whole particles, e.g. online measurements (α-pinene SOM: 0.07). Leave 0 when only the water extract and its fractions (A0, A1A0, O1A0) were measured, as for mosquito coil and peat: the particle is then not offered as a sample. As in the papers, WIOM is "sparingly soluble" rather than strictly insoluble (log S = −6): it dissolves only at wet diameters of a few µm (α-pinene example, D<sub>d</sub> = 100 nm: ≈ 4.4 µm), far beyond activation, so s<sub>c</sub> and κ<sub>CCN</sub> are not affected. This is why "fully dissolved" lies well above the point where all WSOM has dissolved.</div>
      <div class="field"><label for="k-ss">Supersaturations for κ<sub>CCN</sub> (%), separated by commas</label>
        <input id="k-ss" placeholder="e.g. 0.35, 0.48, 0.60, 0.77"></div>
      <details>
        <summary>Advanced</summary>
        <div class="details-body">
          <div class="field"><label for="k-units">Solubility in the ε term</label>
            <select id="k-units"><option value="paper">S in g cm⁻³ used directly (paper code)</option><option value="volume">S / ρ (volume per volume)</option></select></div>
          <div class="field"><label for="k-raoult">Raoult term</label>
            <select id="k-raoult"><option value="dilute">Dilute approximation (Lee et al., 2022, eq. 6)</option><option value="full">Full κ-Köhler</option></select></div>
          <div class="field"><label for="k-grid">Wet-diameter grid</label>
            <select id="k-grid"><option value="paper">Paper-compatible: linear, 1000 points to 5 µm</option><option value="fine">Fine: logarithmic</option></select></div>
        </div>
      </details>
      <div class="note note-error" id="k-error" role="alert" hidden></div>
      <div class="row">
        <button class="btn btn-primary" type="button" id="k-run">Run Köhler model</button>
        <button class="btn" type="button" id="k-reset">Reset to paper defaults</button>
      </div>
    </section>
  </aside>

  <section class="results" id="k-results" hidden>
    <div class="note note-wait" id="k-stale" hidden>Inputs changed since the last run. Press “Run Köhler model” to update the results.</div>
    <div class="row spread">
      <div class="inline-field">
        <label for="k-sample" class="muted">Sample shown:</label>
        <select id="k-sample"></select>
      </div>
      <button class="btn" type="button" id="k-csv">⬇ CSV</button>
    </div>
    <div class="hint" id="k-sample-note"></div>

    <figure class="card figure-card">
      <div class="figure-head">
        <figcaption id="k-curve-title"></figcaption>
        <button type="button" class="btn btn-small" id="k-png" aria-label="Download the Köhler curve as PNG">⬇ PNG</button>
      </div>
      <div class="figure-note muted">Shaded: wet diameters where an undissolved organic phase is still present.</div>
      <div class="curve-row">
        <div class="plot" id="k-curve"></div>
        <div id="k-cartoon"></div>
      </div>
      <div class="slider-block">
        <label for="k-slider" id="k-slider-label"></label>
        <input id="k-slider" type="range" min="0" max="${LIMITS.slider_steps}" step="1" value="0">
        <div class="row" id="k-jumps"></div>
      </div>
    </figure>

    <div class="row spread">
      <span class="small muted">The two charts below follow the slider.</span>
      <div class="row" role="group" aria-label="Label of the bins">
        <span class="small muted">Label bins by:</span>
        <button type="button" class="btn btn-pill btn-small active" id="k-label-s" aria-pressed="true">log S</button>
        <button type="button" class="btn btn-pill btn-small" id="k-label-k" aria-pressed="false">log K<sub>OW</sub></button>
      </div>
    </div>
    <div class="figure-row" id="k-bars"></div>

    <div class="card stack">
      <div class="card-title">Results</div>
      <div class="table-scroll">
        <table id="k-result-table"><thead><tr><th>Quantity</th><th>Value</th><th>Note</th></tr></thead><tbody></tbody></table>
      </div>
    </div>

    <details class="fold">
      <summary>Composition used in the model</summary>
      <div class="fold-body">
        <div class="table-scroll">
          <table id="k-comp-table">
            <thead><tr><th>Component</th><th class="num">log S (g cm⁻³)</th><th class="num">log K<sub>OW</sub></th><th class="num">Volume fraction</th><th class="num">ρ (g cm⁻³)</th><th class="num">κ<sub>intr</sub></th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </details>

    <details class="fold" id="k-fold-fit">
      <summary>Fit κ<sub>intr</sub> to measured κ<sub>CCN</sub></summary>
      <div class="fold-body stack">
        <div class="hint">Finds the κ<sub>intr</sub> of every bin (and of WIOM) that reproduces the κ<sub>CCN</sub> measured for several fractions of the same sample. Each round draws random κ<sub>intr</sub> sets, keeps those with Σ(κ<sub>meas</sub> − κ<sub>model</sub>)² below the tolerance, and narrows the range to their mean ± SD for the next round (Lee et al., 2022, 2023). The κ<sub>intr</sub> typed in the bin table are not used. Takes about a minute in a browser for 5 fractions (longer with more fractions or draws); the page stays usable and the fit can be cancelled.</div>
        <div id="k-measured"></div>
        <div class="hint">One row per fraction. SS and κ: one κ for every supersaturation, separated by commas. Vr only for A1A0 and O1A0. “Particle (online)” = WSOM + the WIOM and/or ammonium sulfate fraction entered on the left (the sample menu names the parts); offered only when one of them is entered. A0, A1A0 and O1A0 are solutions of the WSOM bins only.</div>
        <div class="row"><button class="btn" type="button" id="k-measured-add">+ Add fraction</button></div>
        <details>
          <summary>Fit settings</summary>
          <div class="details-body">
            <div class="field-grid">
              <div class="field"><label for="k-fit-draws">Draws per round</label><input id="k-fit-draws" inputmode="numeric"></div>
              <div class="field"><label for="k-fit-tol">Tolerances, one per round</label><input id="k-fit-tol"></div>
              <div class="field"><label for="k-fit-lo">First κ<sub>intr</sub> range: from</label><input id="k-fit-lo" inputmode="decimal"></div>
              <div class="field"><label for="k-fit-hi">to</label><input id="k-fit-hi" inputmode="decimal"></div>
            </div>
            <div class="hint">The reported κ<sub>intr</sub> is the mean ± SD of the sets accepted in the <b>last</b> round. If fewer than 2 sets pass the last tolerance, no value is reported: nothing is wrong with the program, the data and these settings simply give no set that is good enough. Then use more draws per round or a larger last tolerance.</div>
            <label class="check"><input type="checkbox" id="k-fit-seed"> Reproducible fit (fixed random seed)</label>
            <div class="row"><button class="btn btn-small" type="button" id="k-fit-reset">Reset fit settings to paper defaults</button></div>
          </div>
        </details>
        <div class="note note-error" id="k-fit-error" role="alert" hidden></div>
        <div class="row">
          <button class="btn btn-primary" type="button" id="k-fit">Fit κ<sub>intr</sub></button>
          <button class="btn" type="button" id="k-fit-cancel" hidden>Cancel</button>
        </div>
        <div class="fit-progress" id="k-fit-progress" hidden><progress max="1" value="0" aria-label="Progress of the fit"></progress><span role="status"></span></div>

        <div class="stack" id="k-fit-output" hidden>
          <div class="note" id="k-fit-summary"></div>
          <div class="table-scroll">
            <table id="k-fit-rounds"><thead><tr><th class="num">Round</th><th class="num">Tolerance</th><th class="num">Accepted sets</th><th class="num">Best Σ(κ<sub>meas</sub> − κ<sub>model</sub>)²</th></tr></thead><tbody></tbody></table>
          </div>
          <div class="stack" id="k-fit-values">
            <div class="fit-result">
              <div class="stack">
                <div class="table-scroll">
                  <table id="k-fit-table"><thead><tr><th>Component</th><th class="num">κ<sub>intr</sub> now</th><th class="num">Fitted mean</th><th class="num">SD</th></tr></thead><tbody></tbody></table>
                </div>
                <div class="hint" id="k-fit-free"></div>
                <div class="row"><button class="btn btn-primary" type="button" id="k-fit-apply">Use these κ<sub>intr</sub> values</button></div>
              </div>
              <div id="k-fit-scatter"></div>
            </div>
            <div>
              <div class="card-title">Accepted κ<sub>intr</sub> of every component (last round)</div>
              <div class="figure-grid" id="k-fit-hist"></div>
            </div>
          </div>
        </div>
      </div>
    </details>

    <div class="assumptions" id="k-assumptions"></div>
  </section>
</div>`;
