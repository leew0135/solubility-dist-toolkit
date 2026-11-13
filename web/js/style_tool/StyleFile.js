/*
 * StyleFile.js — writes the text of styles/figure_styles.js from a set of style values.
 *
 * WHAT IT DOES
 *   buildStyleFile({ DEFAULT, FIGURES, PALETTES })  ->  the complete text of a new figure_styles.js,
 *   with the same layout as the hand-written file: palettes, DEFAULT, one block per figure grouped
 *   by page, the styleFor() helper, and a "// options: …" note next to every value. The notes and
 *   figure descriptions come from styles/style_options.js.
 *   checkCoverage(...) lists settings that have no description there (so nothing is forgotten).
 *
 *   No screen code here: the style page (js/pages/style_page.js) calls it, and so can a test.
 *
 * HOW TO CHANGE
 *   The explanation at the top of figure_styles.js  -> HEADER below.
 *   Column where the notes start                    -> NOTE_COLUMN.
 *   The styleFor() helper written into the file     -> HELPER below (keep it equal to what the
 *                                                      figures expect: DEFAULT + figure + its parts).
 */
import { COMMON, FIGURE_OPTIONS, PAGES } from "../../styles/style_options.js";

const NOTE_COLUMN = 34;

const HEADER = `/*
 * figure_styles.js — the look of every figure on the website, in one place.
 *
 * HOW IT WORKS
 *   1. DEFAULT  : the style every figure starts from.
 *   2. FIGURES  : one block per figure. It holds ONLY what differs from DEFAULT;
 *                 anything left out is taken from DEFAULT.
 *   3. Each figure block also has its own "parts" (markers, bars, shading …)
 *      that exist only in that figure.
 *
 * HOW TO CHANGE SOMETHING
 *   - By clicking: open the style page (add #/style to the website address), try the
 *     options with live previews, press "Download figure_styles.js" and put the
 *     downloaded file here in place of this one.
 *   - By hand: change all figures -> edit DEFAULT. Change one figure only -> add the
 *     key to that figure's block, e.g.  kohler_curve: { aspect: "4:3", font_size: 14 }
 *   - Colors: hex codes ("#0072B2"). Palettes are listed in PALETTES below.
 *   - Save the file and reload the page. No Python changes needed.
 *
 * Allowed values are written after each key as  // options: …
 * (they are defined in styles/style_options.js).
 */`;

const HELPER = `// ---------------------------------------------------------------- helper
// Used by the plotting code: DEFAULT + the figure's own settings.
export function styleFor(name) {
  const fig = FIGURES[name] || {};
  return { ...DEFAULT, ...fig, parts: { ...(fig.parts || {}) } };
}
`;

const PALETTE_NOTES = { okabe_ito: "Okabe & Ito (2008): colour-blind safe. Order is fixed: series 1, 2, 3 …" };

const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
const value = (v) => JSON.stringify(v);

/** The note written after a value: its allowed values and / or the explanation. */
function noteFor(option) {
  if (!option) return "";
  const parts = [];
  if (option.kind === "choice") parts.push(`options: ${option.options.map(value).join(", ")}`);
  if (option.kind === "bool") parts.push("options: true, false");
  if (option.kind === "number") parts.push(`${option.min} to ${option.max}`);
  if (option.note) parts.push(option.note);
  return parts.join("; ");
}

function line(indent, k, v, option) {
  const code = `${" ".repeat(indent)}${key(k)}: ${value(v)},`;
  const note = noteFor(option);
  return note ? `${`${code} `.padEnd(NOTE_COLUMN)}// ${note}` : code;
}

function group(indent, k, values, option) {
  const pad = " ".repeat(indent);
  const head = `${pad}${key(k)}: {`;
  const note = option && option.note ? `${`${head} `.padEnd(NOTE_COLUMN)}// ${option.note}` : head;
  return [note, ...Object.entries(values).map(([name, v]) => `${pad}  ${key(name)}: ${value(v)},`), `${pad}},`];
}

function figureBlock(name, fig) {
  const meta = FIGURE_OPTIONS[name] || { parts: {} };
  const head = `  ${key(name)}: {`;
  const out = [meta.about ? `${`${head} `.padEnd(NOTE_COLUMN)}// ${meta.about}` : head];
  for (const [k, v] of Object.entries(fig)) {
    if (k !== "parts") out.push(line(4, k, v, COMMON[k]));
  }
  out.push("    parts: {");
  for (const [k, v] of Object.entries(fig.parts || {})) {
    const option = meta.parts[k];
    if (v !== null && typeof v === "object") out.push(...group(6, k, v, option));
    else out.push(line(6, k, v, option));
  }
  out.push("    },", "  },");
  return out;
}

/** Complete text of figure_styles.js for these values. */
export function buildStyleFile({ DEFAULT, FIGURES, PALETTES }) {
  const out = [HEADER, "", "// ---------------------------------------------------------------- palettes", "export const PALETTES = {"];
  for (const [name, colors] of Object.entries(PALETTES)) {
    if (PALETTE_NOTES[name]) out.push(`  // ${PALETTE_NOTES[name]}`);
    out.push(`  ${key(name)}: [${colors.map(value).join(", ")}],`);
  }
  out.push("};", "", "// ---------------------------------------------------------------- default", "export const DEFAULT = {");
  for (const [k, v] of Object.entries(DEFAULT)) out.push(line(2, k, v, COMMON[k]));
  out.push("};", "", "// ---------------------------------------------------------------- figures", "export const FIGURES = {");

  const names = Object.keys(FIGURES);
  const pages = [...Object.keys(PAGES), undefined];           // figures without a page come last
  let first = true;
  for (const page of pages) {
    const mine = names.filter((n) => (FIGURE_OPTIONS[n] || {}).page === page);
    if (mine.length === 0) continue;
    if (!first) out.push("");
    first = false;
    if (page) out.push(`  // ${PAGES[page]}`);
    for (const name of mine) out.push(...figureBlock(name, FIGURES[name]));
  }
  out.push("};", "", HELPER);
  return out.join("\n");
}

/** Settings present in the values but not described in style_options.js, and the reverse. Empty = all good. */
export function checkCoverage({ DEFAULT, FIGURES }) {
  const problems = [];
  for (const k of Object.keys(DEFAULT)) if (!COMMON[k]) problems.push(`DEFAULT.${k} has no entry in COMMON`);
  for (const k of Object.keys(COMMON)) if (!(k in DEFAULT)) problems.push(`COMMON.${k} has no value in DEFAULT`);
  for (const [name, fig] of Object.entries(FIGURES)) {
    const meta = FIGURE_OPTIONS[name];
    if (!meta) { problems.push(`figure ${name} has no entry in FIGURE_OPTIONS`); continue; }
    for (const k of Object.keys(fig)) if (k !== "parts" && !COMMON[k]) problems.push(`${name}.${k} is not a COMMON setting`);
    for (const k of Object.keys(fig.parts || {})) if (!meta.parts[k]) problems.push(`${name}.parts.${k} has no entry in FIGURE_OPTIONS`);
    for (const k of Object.keys(meta.parts)) if (!(k in (fig.parts || {}))) problems.push(`${name}.parts.${k} has no value in figure_styles.js`);
  }
  for (const name of Object.keys(FIGURE_OPTIONS)) if (!FIGURES[name]) problems.push(`FIGURE_OPTIONS.${name} has no block in figure_styles.js`);
  return problems;
}
