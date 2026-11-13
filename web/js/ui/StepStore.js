/*
 * StepStore.js — passes a result from one tool to the next ("Send α to ①", "Send distribution to ②").
 *
 * WHAT IT DOES
 *   A tiny shared notebook with named slots. A page writes its result, the next
 *   page reads it when its tab opens. It lives in the browser tab only
 *   (sessionStorage): it survives a page reload, is gone when the tab is closed,
 *   and is never sent anywhere.
 *
 *       steps.send("alpha", { vr: [..], alpha: [..] });      // page ⓪
 *       const msg = steps.take("alpha", lastSeen);            // page ①: null if nothing new
 *       if (msg) { use(msg.data); lastSeen = msg.sent; }
 *
 * SLOTS IN USE
 *   "alpha"         ⓪ -> ①   { vr, alpha, source, example }   (example = key in examples.json, or null)
 *   "example"       any page -> all pages   { key }   (key in examples.json; picking an example on
 *                   one page makes the other pages load the same example when they are opened)
 *   "distribution"  ① -> ②   { log_kow, log_s, mass_fraction, sd, normalized, relation, source, example }
 *
 * HOW TO CHANGE
 *   Keep results after the tab is closed -> use localStorage instead of sessionStorage below.
 */
const PREFIX = "solubility-toolkit:";

class StepStore {
  /** Store a message; returns its `sent` value (always larger than any earlier one). */
  send(slot, data) {
    this._last = Math.max(Date.now(), (this._last || 0) + 1);
    const msg = { sent: this._last, data };
    this._memory = { ...(this._memory || {}), [slot]: msg };
    try { sessionStorage.setItem(PREFIX + slot, JSON.stringify(msg)); } catch (err) { /* private mode: memory only */ }
    return msg.sent;
  }

  /** Latest message in the slot, or null if there is none newer than `after` (a `sent` value). */
  take(slot, after = 0) {
    let msg = this._memory && this._memory[slot];
    if (!msg) {
      try { msg = JSON.parse(sessionStorage.getItem(PREFIX + slot)); } catch (err) { msg = null; }
    }
    return msg && msg.sent > after ? msg : null;
  }
}

export const steps = new StepStore();
