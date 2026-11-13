/*
 * BasePage.js — parent class of every page.
 *
 * WHAT IT DOES
 *   Gives each page its own <main> element, builds the page the first time it
 *   is opened (build), and shows / hides it when the tab changes. The page stays
 *   in memory, so what the user typed and computed is still there on return.
 *
 * HOW TO WRITE A PAGE
 *       export default class MyPage extends BasePage {
 *         async build(root) { root.innerHTML = "…"; }   // create the content once
 *         onShow() { }                                    // optional: every time the tab opens
 *       }
 *   then add it to ROUTES in js/config.js.
 *   this.engine = Python engine (PyEngine), this.site = SITE, this.route = the ROUTES entry.
 */
export class BasePage {
  constructor({ engine, site, route }) {
    this.engine = engine;
    this.site = site;
    this.route = route;
    this.root = document.createElement("main");
    this.root.className = "page";
    this.root.dataset.page = route.path;
    this.root.hidden = true;
    this._built = false;
  }

  async show() {
    this.root.hidden = false;
    if (!this._built) {
      this._built = true;
      await this.build(this.root);
    }
    this.onShow();
  }

  hide() { this.root.hidden = true; }

  async build(root) {}
  onShow() {}
}
