/*
 * readme_page.js — "Read me": what the toolkit does, file formats, the theory with all equations,
 * how to run the same code on your own computer, default assumptions, privacy.
 *
 * WHAT IT DOES
 *   A text page. Equations are written in LaTeX in EQ below and typeset with KaTeX
 *   (js/ui/MathText.js). Numbers that are defaults of the model (a, b, iterations, σ, T …)
 *   are read from solubility_toolkit/config.py through the Python engine, so the text
 *   follows the code; until the engine has loaded, the paper values in FALLBACK are shown.
 *
 * HOW TO CHANGE
 *   An equation            -> EQ below (LaTeX; String.raw keeps the backslashes as typed)
 *   The wording            -> the template in render()
 *   Contact, GitHub link, version, the optional overview picture -> SITE in js/config.js
 *   Template files         -> scripts/make_web_examples.py (written to web/examples/)
 *   The code example       -> CODE_EXAMPLE below (it is real, working code: keep it so)
 */
import { BasePage } from "./BasePage.js";
import { tex } from "../ui/MathText.js";

const FALLBACK = {
  KOW_S_RELATIONS: { kenaga_goring_1980: [-0.642, -0.8] }, DEFAULT_KOW_S_RELATION: "kenaga_goring_1980",
  ALPHA_GRID_STEP: 0.01, KERNEL_GRID_STEP: 0.01, DEFAULT_BIN_WIDTH: 1.0, MC_ITERATIONS: 10000, MC_UNCERTAINTY: 0.1,
  MC_NOISE: "uniform", SIGMA_WATER: 0.072, TEMPERATURE: 298.0, WIOM_LOG_S: -6.0, DRY_DIAMETERS_NM: [20, 500],
  KFIT_DRAWS: 200, KFIT_TOLERANCES: [0.02, 0.01, 0.0075], KFIT_INITIAL_RANGE: [0.0, 0.3],
  PAPER_GRID_POINTS: 1000, PAPER_GRID_DMAX_NM: 5000,
};

const R = String.raw;
const EQ = {
  partition: R`\Kow = \frac{C^{\mathrm{O}}}{C^{\mathrm{A}}}, \qquad f_A = \frac{1}{V_r\,\Kow + 1}, \qquad f_O = 1 - f_A, \qquad V_r = \frac{V^{\mathrm{O}}}{V^{\mathrm{A}}}`,
  relation: R`\log \Kow = a + b\,\log S`,
  alpha: R`\alpha(V_r) = \underset{0 \le \alpha \le 1}{\arg\min}\; \sum_{m/z} \Big[\, I_{\Azero} - \alpha\, I_{\Aone} - (1-\alpha)\, I_{\Oone} \Big]^2`,
  kernel: R`\bar f_{A,j}(V_r) = \frac{1}{\Delta} \int_{x_j - \Delta/2}^{x_j + \Delta/2} \frac{\mathrm{d}x}{V_r\,10^{x} + 1}, \qquad x = \log \Kow`,
  inversion: R`\alpha(V_r) = \sum_j \bar f_{A,j}(V_r)\, F_j + e, \qquad F_j \ge 0`,
  montecarlo: R`\alpha^{(k)}(V_r) = \alpha(V_r)\,\big(1 + u\,\xi^{(k)}\big), \qquad F_j = \operatorname{mean}_k F_j^{(k)} \;\pm\; \operatorname{SD}_k F_j^{(k)}`,
  fractions: R`F_j^{\Aone}(V_r) = \frac{\bar f_{A,j}(V_r)\, F_j}{\sum_i \bar f_{A,i}(V_r)\, F_i}, \qquad F_j^{\Oone}(V_r) = \frac{\big(1 - \bar f_{A,j}(V_r)\big)\, F_j}{\sum_i \big(1 - \bar f_{A,i}(V_r)\big)\, F_i}`,
  density: R`\rho = \frac{12 + \mathrm{H/C} + 16\,\mathrm{O/C}}{7 + 5\,\mathrm{H/C} + 4.15\,\mathrm{O/C}} \quad \mathrm{g\,cm^{-3}}`,
  volume: R`f_i = \big(1 - f_{\mathrm{AS}}\big)\big(1 - f_{\mathrm{WIOM}}\big)\, \frac{F_i / \rho_i}{\sum_j F_j / \rho_j}`,
  epsilon: R`\varepsilon_i = \min\!\left[\, 1,\; \left(\frac{D^3}{D_d^3} - 1\right) \frac{S_i}{f_i} \right]`,
  kohler: R`\ln s = \frac{A}{D} \;-\; \frac{D_d^3}{D^3 - D_d^3} \sum_i f_i\, \varepsilon_i\, \kappa_{\mathrm{intr},i}, \qquad A = \frac{4\,\sigma\,M_w}{R\,T\,\rho_w}`,
  keff: R`\keff(D) = \sum_i f_i\, \varepsilon_i(D)\, \kappa_{\mathrm{intr},i}`,
  kohlerFull: R`\ln s = \frac{A}{D} + \ln \frac{D^3 - D_d^3}{D^3 - D_d^3\,\big(1 - \keff\big)}`,
  kccn: R`s_c = \max_D\, s(D), \qquad \kccn = \frac{4\,A_w^3}{27\, D_d^3\, \ln^2 s_c}, \qquad A_w = \frac{4\,\sigma_w\,M_w}{R\,T\,\rho_w}`,
  fit: R`\sum_{\text{fractions}}\; \sum_{SS} \Big[\, \kccn^{\text{meas}} - \kccn^{\text{model}}\big(\kintr\big) \Big]^2 \;<\; \text{tolerance}`,
};

const CODE_EXAMPLE = `git clone [GITHUB LINK]
cd solubility-dist-toolkit
pip install -e .

# tool ①: alpha at several volume ratios -> solubility distribution
from solubility_toolkit import Kernel, Inversion

kernel = Kernel(vr=[1.78, 0.32, 0.06, 0.01], bin_centers=[-1, 0, 1, 2])
result = Inversion(kernel).monte_carlo([0.44, 0.55, 0.66, 0.77], uncertainty=0.10, n=10000)
print(result.mean, result.sd)`;

export default class ReadmePage extends BasePage {
  async build(root) {
    root.classList.add("page-narrow");
    this.render(FALLBACK);                                   // show the page at once …
    try {
      this.render(await this.engine.call("defaults"));       // … then again with the numbers of config.py
    } catch (err) { /* engine not available: the paper values stay */ }
    this.onShow();
  }

  /** Addresses like #/readme?formats open the page at that section. */
  onShow() {
    const id = location.hash.split("?")[1];
    const el = id && this.root.querySelector(`#${CSS.escape(id)}`);
    if (el) el.scrollIntoView();
    else if (!id) window.scrollTo(0, 0);
  }

  render(d) {
    const site = this.site;
    const [a, b] = d.KOW_S_RELATIONS[d.DEFAULT_KOW_S_RELATION];
    const i = (latex) => tex(latex, false);                  // inline math
    const eq = (name) => `<div class="equation">${tex(EQ[name])}</div>`;
    const github = site.github.startsWith("http") ? `<a href="${site.github}">${site.github}</a>` : site.github;
    const dry = d.DRY_DIAMETERS_NM;

    this.root.innerHTML = `
    <section>
      <h1>Read me</h1>
      <p>This toolkit retrieves the water-solubility distribution of water-soluble organic matter (WSOM) from 1-octanol–water partitioning experiments, and uses it to predict water uptake and cloud droplet activation with Köhler theory.</p>
      ${site.overview_image ? `<img class="overview-image" src="${site.overview_image}" alt="Method overview: partitioning between 1-octanol and water, mass spectra of both phases, and inversion to a solubility distribution">` : ""}
      <nav class="toc" aria-label="On this page">
        <a href="#/readme?workflow">Workflow</a><a href="#/readme?formats">File formats</a><a href="#/readme?theory">Theory</a>
        <a href="#/readme?code">Run it yourself</a><a href="#/readme?defaults">Default assumptions</a><a href="#/readme?privacy">Your data</a>
      </nav>
    </section>

    <section id="workflow">
      <h2>Workflow</h2>
      <div class="workflow">
        <a href="#/spectra"><b>⓪ Spectra → α</b><span>Normalized mass spectra of A<sub>0</sub>, A<sub>1</sub>A<sub>0</sub> and O<sub>1</sub>A<sub>0</sub> at each volume ratio → mass fraction partitioned to the aqueous phase, α.</span></a>
        <a href="#/distribution"><b>① α → Solubility distribution</b><span>α at several volume ratios → mass fraction in each log K<sub>OW</sub> / log S bin, by non-negative least squares with Monte Carlo uncertainty.</span></a>
        <a href="#/kohler"><b>② Distribution → Köhler</b><span>Distribution + κ<sub>intr</sub> + density → Köhler curve, dissolved fraction per bin, phase state, s<sub>c</sub> and κ<sub>CCN</sub>; fit of κ<sub>intr</sub> to measured κ<sub>CCN</sub>.</span></a>
      </div>
      <p class="where">Each step can be used on its own with a CSV upload, or chained with the “Send to …” buttons. A<sub>0</sub> = the WSOM solution; A<sub>1</sub>A<sub>0</sub> and O<sub>1</sub>A<sub>0</sub> = its aqueous and 1-octanol phases after one partitioning step at volume ratio V<sub>r</sub> (1-octanol / water).</p>
    </section>

    <section id="formats">
      <h2>Input file formats (CSV)</h2>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Step</th><th>Columns</th><th>Template</th></tr></thead>
          <tbody>
            <tr><td>⓪</td><td><code>mz, A0</code> and, for each volume ratio, <code>A1A0_&lt;Vr&gt;, O1A0_&lt;Vr&gt;</code> (for example <code>A1A0_1.78</code>). Intensities of unit-mass-resolution spectra; they are normalized to unit sum.</td><td><a href="examples/spectra_template.csv" download>spectra_template.csv</a></td></tr>
            <tr><td>①</td><td><code>Vr, alpha</code>, optional <code>uncertainty_pct</code> (default ${d.MC_UNCERTAINTY * 100})</td><td><a href="examples/alpha_template.csv" download>alpha_template.csv</a></td></tr>
            <tr><td>②</td><td><code>log_S, mass_fraction</code>, and <code>density</code> or (<code>O_C, H_C</code>), <code>kappa_intr</code>. S in g cm⁻³, density in g cm⁻³.</td><td><a href="examples/distribution_template.csv" download>distribution_template.csv</a></td></tr>
          </tbody>
        </table>
      </div>
      <p class="where">Comma-separated, first row = column names, decimal point. Results can be downloaded as CSV, every figure as PNG.</p>
    </section>

    <section id="theory">
      <h2>Theory: equations used</h2>

      <h3>Partitioning between 1-octanol and water (Kuwata &amp; Lee, 2017)</h3>
      <p>A compound with 1-octanol–water partition coefficient ${i(R`\Kow`)} is shared between the two phases according to the volume ratio ${i("V_r")}. ${i("f_A")} and ${i("f_O")} are the fractions found in the aqueous and the 1-octanol phase.</p>
      ${eq("partition")}
      <p>${i(R`\Kow`)} is converted to water solubility ${i("S")} (g cm⁻³) with an empirical relationship; the default is Kenaga &amp; Goring (1980), ${i(`a = ${a}`)}, ${i(`b = ${b}`)}. Other relationships can be chosen on page ①.</p>
      ${eq("relation")}

      <h3>⓪ α from mass spectra (Kuwata &amp; Lee, 2017)</h3>
      <p>The spectrum of the WSOM solution, ${i(R`I_{\Azero}`)}, is a mixture of the spectra of its two phases. α is the mass fraction in the aqueous phase. It is searched on a grid of step ${d.ALPHA_GRID_STEP}; each spectrum is normalized to unit sum, so only spectral shapes matter.</p>
      ${eq("alpha")}

      <h3>① Inversion to a solubility distribution (Lee et al., 2020)</h3>
      <p>The ${i(R`\log \Kow`)} axis is divided into bins of width ${i(R`\Delta`)} (default ${d.DEFAULT_BIN_WIDTH}) centred at ${i("x_j")}. The kernel is the average of ${i("f_A")} over each bin (numerically, on a grid of step ${d.KERNEL_GRID_STEP}):</p>
      ${eq("kernel")}
      <p>The measured α at each volume ratio is the kernel-weighted sum of the mass fractions ${i("F_j")} of the bins. ${i("F_j")} is obtained by non-negative least squares (Lawson–Hanson, as MATLAB <code>lsqnonneg</code>):</p>
      ${eq("inversion")}
      <p>Uncertainty: the inversion is repeated ${d.MC_ITERATIONS.toLocaleString("en-US")} times with α perturbed within its relative uncertainty ${i("u")} (default ${d.MC_UNCERTAINTY * 100} %; ${i(R`\xi`)} uniform in [−1, 1], or standard normal). The result is the mean and standard deviation over the runs; the mean is normalized to 1 before it is used in ②.</p>
      ${eq("montecarlo")}
      <p>The distribution of a partitioned fraction follows from the distribution of ${i(R`\Azero`)} and the kernel (used for the samples A<sub>1</sub>A<sub>0</sub> and O<sub>1</sub>A<sub>0</sub> on page ②):</p>
      ${eq("fractions")}

      <h3>② Köhler model with a solubility distribution (Riipinen et al., 2015; Lee et al., 2022, 2023)</h3>
      <p>Mass fractions are converted to volume fractions ${i("f_i")} of the dry particle with the density of each bin, which can be estimated from elemental ratios (Kuwata et al., 2012). Water-insoluble organic matter (WIOM) is added as the volume fraction ${i(R`f_{\mathrm{WIOM}}`)} of the organic material, and ammonium sulfate (AS) as the volume fraction ${i(R`f_{\mathrm{AS}}`)} of the whole dry particle.</p>
      ${eq("density")}
      ${eq("volume")}
      <p>At wet diameter ${i("D")} (dry diameter ${i("D_d")}), the dissolved fraction of component ${i("i")} is limited by its solubility:</p>
      ${eq("epsilon")}
      <p>The saturation ratio ${i("s")} over the droplet is the sum of the Kelvin term and the Raoult term of the dissolved material, each component contributing with its intrinsic hygroscopicity ${i(R`\kintr`)}:</p>
      ${eq("kohler")}
      <p>The sum in the Raoult term is the effective hygroscopicity of the particle at that diameter, shown on page ② together with the contribution of each component:</p>
      ${eq("keff")}
      <p>Option “Full κ-Köhler” replaces the dilute-solution Raoult term by:</p>
      ${eq("kohlerFull")}
      <p>The maximum of the curve is the critical saturation ratio ${i("s_c")}. The apparent ${i(R`\kccn`)}, as derived from CCN counter data, uses the surface tension of water ${i(R`\sigma_w`)} (Petters &amp; Kreidenweis, 2008); ${i("s_c(D_d)")} is computed for dry diameters ${dry[0]}–${dry[dry.length - 1]} nm and interpolated to the measured supersaturations.</p>
      ${eq("kccn")}
      <p>A particle is reported as two phases while more than 0.1 % of its dry volume is undissolved.</p>

      <h3>Fit of ${i(R`\kintr`)} to measured ${i(R`\kccn`)} (Lee et al., 2022, 2023)</h3>
      <p>Random sets of ${i(R`\kintr`)} (one value per bin and for WIOM) are drawn; a set is accepted when the modelled ${i(R`\kccn`)} of all measured fractions agree with the measurements:</p>
      ${eq("fit")}
      <p>Defaults: ${d.KFIT_DRAWS} sets per round, first range ${d.KFIT_INITIAL_RANGE[0]}–${d.KFIT_INITIAL_RANGE[1]}, tolerances ${d.KFIT_TOLERANCES.join(" → ")}. After each round the range of every component is narrowed to mean ± SD of the accepted sets. The result is the mean ± SD of the sets accepted in the last round.</p>
    </section>

    <section id="code">
      <h2>Run it on your own computer</h2>
      <p>The website and the Python package are the same object-oriented code: on the website it runs inside your browser (Pyodide), so results are identical. The first visit downloads about 15 MB, which the browser then keeps.</p>
      <p>Source code: ${github}</p>
      <pre class="code"><code>${CODE_EXAMPLE.replace("[GITHUB LINK]", site.github)}</code></pre>
      <p class="where">Main classes: <code>SpectraUnmixer</code> (⓪), <code>Kernel</code>, <code>Inversion</code> (①), <code>Composition</code>, <code>KohlerModel</code>, <code>KappaIntrinsicFitter</code> (②). All default values are in <code>solubility_toolkit/config.py</code>; <code>pytest</code> checks the code against the published results.</p>
    </section>

    <section id="defaults">
      <h2>Default assumptions (from the original papers)</h2>
      <ul>
        <li>Partitioning: dilute solutions; phase volumes set by the solvent volumes (Kuwata &amp; Lee, 2017).</li>
        <li>K<sub>OW</sub>–S: log K<sub>OW</sub> = ${a} ${b < 0 ? "−" : "+"} ${Math.abs(b)} log S (Kenaga &amp; Goring, 1980); uncertainty Δlog S ≈ ±0.39 (Kuwata &amp; Lee, 2017).</li>
        <li>⓪: α by grid search, step ${d.ALPHA_GRID_STEP}; all m/z of the file unless a window or exclusions are set.</li>
        <li>①: bins of ${d.DEFAULT_BIN_WIDTH} log K<sub>OW</sub> unit; Monte Carlo with ±${d.MC_UNCERTAINTY * 100} % ${d.MC_NOISE} noise on α, ${d.MC_ITERATIONS.toLocaleString("en-US")} iterations; result = mean ± SD.</li>
        <li>②: solubility in g cm⁻³ used directly in ε (as in the paper code); dilute-solution Raoult term (Lee et al., 2022, eq. 6); WIOM S = 10<sup>${d.WIOM_LOG_S}</sup> g cm⁻³; σ = ${d.SIGMA_WATER} N m⁻¹; T = ${d.TEMPERATURE} K; wet-diameter grid: ${d.PAPER_GRID_POINTS} points, linear, up to ${d.PAPER_GRID_DMAX_NM / 1000} µm.</li>
      </ul>
      <p class="where">Every default can be changed on the pages; “Reset to paper defaults” restores them. Each result page ends with the assumptions actually used in that run.</p>
    </section>

    <section id="privacy" class="assumptions">
      <h2>Your data stays with you</h2>
      <p>All calculations run in your browser. Uploaded files are never sent to a server or stored; closing the page discards them. Download your results as CSV and PNG.</p>
    </section>

    <section>
      <h2>How to cite</h2>
      <p>See <a href="#/cite">How to cite</a> for the reference list, BibTeX, EndNote and RIS files, and a suggested Methods sentence.</p>
    </section>

    <section class="footer-note">
      <div>Questions or bug reports: ${site.email}</div>
      <div>Version ${site.version} · source code: ${github}</div>
    </section>`;
  }
}
