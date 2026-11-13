/*
 * config.js — site-wide settings. The first file to open when something
 * about the website (not the science, not the figure styles) should change.
 *
 * HOW TO CHANGE
 *   - Site title / subtitle / contact / GitHub link      -> SITE
 *   - Pyodide version or where it is downloaded from     -> PYODIDE
 *       local: a copy inside web/vendor/pyodide/ (tried first; used for offline work and tests)
 *       cdn:   used automatically when the local copy is missing
 *       When you change the version, change BOTH the cdn URL and the files in vendor/pyodide/.
 *   - Add / rename / reorder a page                       -> ROUTES
 *       module = file in js/pages/ whose default export is the page class.
 *       kind: "tool" = numbered tab, "info" = button at the top right, "hidden" = no link.
 *
 * Scientific defaults are NOT here: solubility_toolkit/config.py.
 * Figure styles are NOT here: styles/figure_styles.js.
 */
export const SITE = {
  title: "Solubility Distribution Toolkit",
  subtitle: "1-octanol–water partitioning method · data inversion · Köhler theory",
  privacy_note: "All calculations run locally in your browser. No data is uploaded or stored.",
  email: "[YOUR EMAIL]",                 // shown on the Read me page
  github: "https://github.com/leew0135/solubility-dist-toolkit", // repository address (Read me, How to cite)
  url: "[URL]",                          // address of this website, used in the suggested Methods text
  version: "0.1.0",                      // toolkit version shown on the pages (keep equal to solubility_toolkit.__version__)
  year: "2026",
  overview_image: "",                    // optional picture at the top of Read me, e.g. "images/overview.png"
};

export const PYODIDE = {
  local: "vendor/pyodide/",
  cdn: "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/",
  packages: ["numpy"],                       // Pyodide packages the toolkit needs
  toolkit_zip: "py/solubility_toolkit.zip",  // made by scripts/build_web.py
  web_api: "py/web_api.py",
};

export const ROUTES = [
  { path: "spectra",      kind: "tool",   label: "⓪ Spectra → α",                 module: "spectra_page.js" },
  { path: "distribution", kind: "tool",   label: "① α → Solubility distribution", module: "distribution_page.js" },
  { path: "kohler",       kind: "tool",   label: "② Distribution → Köhler",       module: "kohler_page.js" },
  { path: "readme",       kind: "info",   label: "Read me",                       module: "readme_page.js" },
  { path: "cite",         kind: "info",   label: "How to cite",                   module: "cite_page.js" },
  { path: "dev",          kind: "hidden", label: "Engine check",                  module: "dev_page.js" },
  { path: "style",        kind: "hidden", label: "Figure styles (author tool)",   module: "style_page.js" },
];
export const DEFAULT_ROUTE = "spectra";
