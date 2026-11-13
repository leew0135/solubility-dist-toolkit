/*
 * ParticleCartoon.js — the small drawing of the droplet next to the Köhler curve (page ②).
 *
 * WHAT IT SHOWS
 *   A droplet (aqueous phase) that grows with the wet diameter and, while some
 *   organic material is still undissolved, an organic inclusion inside it.
 *   It is a schematic: the model gives the VOLUME of undissolved organic matter,
 *   not its shape or the number of inclusions. The inclusion is drawn with the
 *   right volume ratio (radius ratio = cube root of the undissolved fraction × Dd / D),
 *   but never smaller than MIN_INCLUSION_PX so it stays visible.
 *
 *       const cartoon = new ParticleCartoon(element);
 *       cartoon.update({ d_nm, dd_nm, dmax_nm, undissolved });    // undissolved: 0–1, of the dry volume
 *
 * HOW TO CHANGE
 *   Colours, inclusion position ("off_center", "core", "none"), the two captions
 *        -> "particle_cartoon" in styles/figure_styles.js
 *   Drawing size and how fast the droplet grows -> SIZE below
 *   When a particle counts as two phases         -> TWO_PHASE_THRESHOLD (same value as the Python package)
 */
import { styleFor } from "../../styles/figure_styles.js";

const SIZE = { box: 240, r_min: 30, r_max: 104 };     // px: droplet radius at D = Dd and at the largest D
const MIN_INCLUSION_PX = 4;
export const TWO_PHASE_THRESHOLD = 1e-3;              // undissolved volume fraction (kohler.py: phase_state)

export class ParticleCartoon {
  constructor(element) {
    this.el = element;
    this.style = styleFor("particle_cartoon");
    const p = this.style.parts, c = SIZE.box / 2;
    this.el.classList.add("cartoon");
    this.el.innerHTML = `
      <svg viewBox="0 0 ${SIZE.box} ${SIZE.box}" role="img" aria-label="Schematic of the particle">
        <circle data-part="aqueous" cx="${c}" cy="${c}" r="${SIZE.r_min}" fill="${p.aqueous_fill}" stroke="${p.aqueous_edge}" stroke-width="2"></circle>
        <circle data-part="organic" cx="${c}" cy="${c}" r="0" fill="${p.organic_fill}" stroke="${p.organic_edge}" stroke-width="1.5"></circle>
      </svg>
      <div class="cartoon-legend">
        <span><span class="swatch" style="background:${p.aqueous_fill};border-color:${p.aqueous_edge}"></span>aqueous</span>
        <span><span class="swatch" style="background:${p.organic_fill};border-color:${p.organic_edge}"></span>organic phase</span>
      </div>
      <div class="cartoon-state" data-part="state"></div>
      <div class="hint">Schematic. The model gives the volume of the undissolved organic phase, not its shape or how many inclusions it forms.</div>`;
    this.aqueous = this.el.querySelector('[data-part="aqueous"]');
    this.organic = this.el.querySelector('[data-part="organic"]');
    this.state = this.el.querySelector('[data-part="state"]');
    this.svg = this.el.querySelector("svg");
    this.el.style.fontFamily = this.style.font_family;
  }

  update({ d_nm, dd_nm, dmax_nm, undissolved }) {
    const p = this.style.parts, c = SIZE.box / 2;
    const grow = Math.log(d_nm / dd_nm) / Math.log(dmax_nm / dd_nm);          // 0 at Dd, 1 at the largest D
    const r = SIZE.r_min + Math.min(Math.max(grow, 0), 1) * (SIZE.r_max - SIZE.r_min);
    const twoPhases = undissolved > TWO_PHASE_THRESHOLD;
    const show = twoPhases && p.organic_position !== "none";
    const ri = show ? Math.min(r - 3, Math.max(MIN_INCLUSION_PX, r * Math.cbrt(undissolved) * dd_nm / d_nm)) : 0;
    this.aqueous.setAttribute("r", r.toFixed(1));
    this.organic.setAttribute("r", ri.toFixed(1));
    this.organic.setAttribute("cx", (p.organic_position === "core" ? c : c + r - ri - 3).toFixed(1));
    this.organic.style.display = show ? "" : "none";
    const text = twoPhases ? p.label_llps : p.label_single;
    this.state.textContent = text;
    this.svg.setAttribute("aria-label", `Schematic of the particle: ${text}`);
  }
}
