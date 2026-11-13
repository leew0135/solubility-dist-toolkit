/*
 * dev_page.js — "Engine check" (address: #/dev, not linked in the menu).
 *
 * WHAT IT DOES
 *   A self-test for the author: shows that Pyodide loaded, that
 *   solubility_toolkit can be imported and called, that config.py defaults reach
 *   the browser, and that a figure is drawn with the styles of figure_styles.js.
 *   web/tests/check_engine.py opens this page automatically.
 *
 * HOW TO CHANGE
 *   Test inputs -> TEST_INPUT below. Nothing here is used by the real pages.
 */
import { BasePage } from "./BasePage.js";
import { PartitionKernelFigure } from "../plots/PartitionKernelFigure.js";

const TEST_INPUT = { vr: [1.78, 0.32, 0.06, 0.01], bin_centers: [-1, 0, 1, 2] };   // α-pinene (Lee et al., 2023)

export default class DevPage extends BasePage {
  async build(root) {
    root.classList.add("page-narrow");
    root.innerHTML = `
      <h1>Engine check</h1>
      <div class="card">
        <table id="dev-info"><tbody><tr><td>Loading…</td></tr></tbody></table>
      </div>
      <figure class="card figure-card">
        <figcaption>Test figure: partition_kernel (computed by solubility_toolkit.Kernel)</figcaption>
        <div id="dev-figure" class="plot"></div>
        <div class="row"><button class="btn" id="dev-png" type="button">⬇ PNG</button></div>
      </figure>
      <div class="card">
        <div class="card-title">Kernel matrix (rows: Vr, columns: bins)</div>
        <div class="table-scroll"><table id="dev-kernel"></table></div>
      </div>`;

    const info = root.querySelector("#dev-info tbody");
    try {
      const versions = await this.engine.start();
      const defaults = await this.engine.call("defaults");
      const curves = await this.engine.call("kernel_curves", TEST_INPUT);

      const rows = [
        ["Pyodide", `${versions.pyodide} (${versions.source})`],
        ["solubility_toolkit", versions.toolkit],
        ["numpy", versions.numpy],
        ["config.py: MC_ITERATIONS", defaults.MC_ITERATIONS],
        ["config.py: MC_UNCERTAINTY", defaults.MC_UNCERTAINTY],
        ["config.py: SIGMA_WATER", defaults.SIGMA_WATER],
        ["config.py: DEFAULT_KOW_S_RELATION", defaults.DEFAULT_KOW_S_RELATION],
      ];
      info.innerHTML = rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join("");

      this.figure = new PartitionKernelFigure(root.querySelector("#dev-figure"));
      await this.figure.render(curves);
      root.querySelector("#dev-png").addEventListener("click", () => this.figure.downloadPng("partition_kernel"));

      const head = `<thead><tr><th class="num">Vr</th>${curves.bin_centers.map((c) => `<th class="num">log K<sub>OW</sub> = ${c}</th>`).join("")}</tr></thead>`;
      const body = curves.matrix.map((r, i) =>
        `<tr><td class="num">${curves.vr[i]}</td>${r.map((v) => `<td class="num">${v.toFixed(6)}</td>`).join("")}</tr>`).join("");
      root.querySelector("#dev-kernel").innerHTML = `${head}<tbody>${body}</tbody>`;
      root.dataset.devState = "ok";
    } catch (err) {
      info.innerHTML = `<tr><td class="error-text">${err.message}</td></tr>`;
      root.dataset.devState = "error";
    }
  }
}
