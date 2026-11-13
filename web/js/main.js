/*
 * main.js — starting point of the website (loaded by index.html).
 *
 * It only connects the pieces: settings (config.js) + Python engine (PyEngine.js)
 * + page frame (PageShell.js). To change what the site contains, edit config.js.
 */
import { SITE, ROUTES, DEFAULT_ROUTE } from "./config.js";
import { engine } from "./engine/PyEngine.js";
import { PageShell } from "./ui/PageShell.js";

new PageShell(document.getElementById("app"), {
  site: SITE, routes: ROUTES, defaultRoute: DEFAULT_ROUTE, engine,
}).start();
