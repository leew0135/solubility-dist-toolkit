/*
 * cite_page.js — "How to cite": the method papers, export files, a Methods sentence.
 *
 * WHAT IT DOES
 *   Lists the papers of js/references.js with a link to each article, lets the
 *   visitor download them as BibTeX / EndNote / RIS or copy them, and offers a
 *   sentence for a Methods section and the citation of the software itself.
 *
 * HOW TO CHANGE
 *   The papers, the Methods sentence, the software citation -> js/references.js
 *   Website address, version, GitHub link                   -> SITE in js/config.js
 *   Wording of this page                                     -> the template in build()
 */
import { BasePage } from "./BasePage.js";
import { downloadText } from "../ui/CsvIO.js";
import { REFERENCES, referenceText, toBibTeX, toEndNote, toRIS, methodsText, softwareText } from "../references.js";

const FILE = "solubility_toolkit_references";

export default class CitePage extends BasePage {
  async build(root) {
    root.classList.add("page-narrow");
    const items = REFERENCES.map((r, i) => `
      <li>
        <span>${referenceText(r, true).replace(/ https:\/\/doi\.org\/\S+$/, "")}</span>
        <div class="ref-meta">
          <span class="muted">${r.role}</span>
          <a href="https://doi.org/${r.doi}" target="_blank" rel="noopener">Article ↗<span class="sr-only"> (opens in a new tab)</span></a>
          <button class="btn btn-small" type="button" data-copy-ref="${i}">Copy</button>
        </div>
      </li>`).join("");

    root.innerHTML = `
      <section>
        <h1>How to cite</h1>
        <p>If you use this toolkit in a publication, please cite the method papers below that match the tools you used, and the toolkit version.</p>
        <div class="row">
          <button class="btn btn-primary" type="button" data-file="bib">⬇ BibTeX (.bib)</button>
          <button class="btn btn-primary" type="button" data-file="enw">⬇ EndNote (.enw)</button>
          <button class="btn" type="button" data-file="ris">⬇ RIS (.ris)</button>
          <button class="btn" type="button" data-copy="all">Copy all</button>
          <span class="small ok-text" id="c-status" role="status"></span>
        </div>
      </section>

      <section>
        <h2>Method papers</h2>
        <ol class="ref-list">${items}</ol>
      </section>

      <section>
        <h2>Suggested Methods text</h2>
        <div class="assumptions" id="c-methods">${methodsText(this.site)}</div>
        <div class="row"><button class="btn" type="button" data-copy="methods">Copy text</button></div>
        <p class="where">Add Lee et al. (2022) when you used the Köhler model (tool ②), and Lee et al. (2023) when you used the α-pinene data or the κ<sub>intr</sub> fit.</p>
      </section>

      <section>
        <h2>Software</h2>
        <div id="c-software">${softwareText(this.site)}</div>
        <div class="row"><button class="btn" type="button" data-copy="software">Copy</button></div>
      </section>`;

    const text = {
      all: () => REFERENCES.map((r) => referenceText(r)).join("\n\n"),
      methods: () => methodsText(this.site),
      software: () => softwareText(this.site),
    };
    const files = {
      bib: () => downloadText(`${FILE}.bib`, toBibTeX(), "application/x-bibtex"),
      enw: () => downloadText(`${FILE}.enw`, toEndNote(), "application/x-endnote-refer"),
      ris: () => downloadText(`${FILE}.ris`, toRIS(), "application/x-research-info-systems"),
    };
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.file) files[btn.dataset.file]();
      else if (btn.dataset.copy) this.copy(text[btn.dataset.copy](), btn);
      else if (btn.dataset.copyRef !== undefined) this.copy(referenceText(REFERENCES[Number(btn.dataset.copyRef)]), btn);
    });
  }

  /** Copy to the clipboard and say so on the button for a moment. */
  async copy(value, button) {
    const label = button.textContent;
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = "Copied ✓";
    } catch (err) {
      // clipboard not allowed (old browser, or page not served over https): select-and-copy fallback
      const area = document.createElement("textarea");
      area.value = value;
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      button.textContent = ok ? "Copied ✓" : "Copy failed";
    }
    this.root.querySelector("#c-status").textContent = button.textContent === "Copy failed" ? "" : "Copied to the clipboard.";
    setTimeout(() => { button.textContent = label; }, 1500);
  }
}
