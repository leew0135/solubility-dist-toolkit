/*
 * placeholder_page.js — temporary page for tabs that are not built yet.
 *
 * Each tab in js/config.js (ROUTES) that still points to this file shows a short
 * "not built yet" note. When the real page exists, change `module` in ROUTES;
 * when no route uses this file any more, it can be deleted.
 */
import { BasePage } from "./BasePage.js";

export default class PlaceholderPage extends BasePage {
  async build(root) {
    root.classList.add("page-narrow");
    root.innerHTML = `
      <h1>${this.route.label}</h1>
      <p class="muted">This page is not built yet.</p>`;
  }
}
