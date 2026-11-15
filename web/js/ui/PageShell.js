/*
 * PageShell.js — the frame around every page: header, tabs, engine status, privacy note.
 *
 * WHAT IT DOES
 *   Builds the header once, then shows one page at a time according to the
 *   address (#/spectra, #/distribution, …). The Python engine is started once
 *   and stays alive when you switch tabs; each page is built the first time it
 *   is opened and then kept, so inputs and results are not lost on tab switches.
 *
 * HOW TO CHANGE
 *   Titles, pages, tab order  -> js/config.js (SITE, ROUTES)
 *   Colours, spacing          -> styles/site.css
 *   Status pill wording       -> STATUS_TEXT below
 */
const STATUS_TEXT = {
  idle: "Python engine",
  loading: "Loading Python engine…",
  ready: "Python engine ready",
  error: "Python engine failed",
};

/** True when the site is opened from this computer (local preview, tests), not from the web. */
const IS_LOCAL = ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname);

export class PageShell {
  constructor(root, { site, routes, defaultRoute, engine }) {
    this.root = root;
    this.site = site;
    this.routes = routes.filter((r) => !r.local_only || IS_LOCAL);   // author-only pages stay off the web
    this.defaultRoute = defaultRoute;
    this.engine = engine;
    this.pages = new Map();        // path -> page instance (kept alive)
    this.current = null;
  }

  start() {
    this._buildFrame();
    this.engine.onStatus((state, detail) => this._showStatus(state, detail));
    this.engine.start().catch(() => {});          // the pill shows the error
    window.addEventListener("hashchange", () => this._route());
    this._route();
  }

  // ------------------------------------------------------------ frame
  _buildFrame() {
    const link = (r, cls) => `<a class="${cls}" data-route="${r.path}" href="#/${r.path}">${r.label}</a>`;
    const tools = this.routes.filter((r) => r.kind === "tool").map((r) => link(r, "tab")).join("");
    const info = this.routes.filter((r) => r.kind === "info").map((r) => link(r, "btn")).join("");
    this.root.innerHTML = `
      <header class="site-header">
        <div class="site-header-row">
          <div>
            <div class="site-title">${this.site.title}</div>
            <div class="site-subtitle">${this.site.subtitle}</div>
          </div>
          <div class="site-actions">
            <span class="engine-pill" id="engine-pill" data-engine-state="idle" role="status"></span>
            ${info}
          </div>
        </div>
        <nav class="tabs" aria-label="Tools">${tools}</nav>
      </header>
      <div class="privacy-note"><div class="privacy-note-inner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>
        <span>${this.site.privacy_note}</span>
      </div></div>
      <div id="page-host"></div>`;
    this.pill = this.root.querySelector("#engine-pill");
    this.host = this.root.querySelector("#page-host");
  }

  _showStatus(state, detail) {
    this.pill.dataset.engineState = state;
    this.pill.textContent = "● " + (state === "loading" && detail ? detail : STATUS_TEXT[state]);
    this.pill.title = state === "error" ? detail : "";
  }

  // ------------------------------------------------------------ routing
  async _route() {
    const path = location.hash.replace(/^#\/?/, "").split("?")[0];
    const route = this.routes.find((r) => r.path === path);
    if (!route) {
      location.replace(`#/${this.defaultRoute}`);
      return;
    }
    for (const a of this.root.querySelectorAll("[data-route]")) {
      a.classList.toggle("active", a.dataset.route === route.path);
      if (a.dataset.route === route.path) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    let page = this.pages.get(route.path);
    if (!page) {
      const mod = await import(`../pages/${route.module}`);
      page = new mod.default({ engine: this.engine, site: this.site, route });
      this.pages.set(route.path, page);
      this.host.appendChild(page.root);
    }
    if (this.current && this.current !== page) this.current.hide();
    this.current = page;
    document.title = `${route.label} · ${this.site.title}`;
    await page.show();
  }
}
