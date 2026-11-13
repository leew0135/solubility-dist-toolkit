/*
 * MathText.js — typesets equations with KaTeX (loaded by index.html from vendor/katex/).
 *
 *       import { tex } from "../ui/MathText.js";
 *       element.innerHTML = tex("f_A = \\frac{1}{V_r K_{OW} + 1}");            // centred equation
 *       element.innerHTML = `where ${tex("V_r", false)} is the volume ratio`;   // inside a sentence
 *
 *   In JavaScript text every backslash of LaTeX must be doubled (\\frac), or write the
 *   formula with String.raw`\frac{…}` as readme_page.js does.
 *
 * HOW TO CHANGE
 *   Shortcuts used in many formulas (\Kow, \kintr, …) -> MACROS below.
 */
const MACROS = {
  "\\Kow": "K_{\\mathrm{OW}}",
  "\\kintr": "\\kappa_{\\mathrm{intr}}",
  "\\kccn": "\\kappa_{\\mathrm{CCN}}",
  "\\keff": "\\kappa_{\\mathrm{eff}}",
  "\\Azero": "\\mathrm{A_0}",
  "\\Aone": "\\mathrm{A_1A_0}",
  "\\Oone": "\\mathrm{O_1A_0}",
};

/** LaTeX -> HTML. display = true: an equation on its own line; false: inline in a sentence. */
export function tex(latex, display = true) {
  if (!window.katex) return `<code>${latex}</code>`;          // KaTeX missing: show the source, never fail
  return window.katex.renderToString(latex, { displayMode: display, throwOnError: false, macros: { ...MACROS } });
}
