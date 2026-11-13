"""
web_api.py — the only Python file that belongs to the website.

WHAT IT DOES
    A thin adapter between the browser and solubility_toolkit. The browser
    sends a method name and JSON arguments; this file calls the toolkit and
    returns JSON. It contains NO science: every number is computed by
    solubility_toolkit, so the website and the downloadable package always agree.

        browser (js/engine/PyEngine.js)  ->  call("kernel_curves", '{"vr": [...]}')
                                         <-  '{"log_kow": [...], "f_a": [...]}'

HOW TO CHANGE
    Add something a page needs   -> add a method to WebApi (public name = callable
                                    from JavaScript as engine.call("name", {...})).
    Change a calculation         -> do NOT do it here; edit solubility_toolkit/ and run pytest.
    Change a default value       -> solubility_toolkit/config.py (defaults() reads it).
"""
import json
import math

import numpy as np

import solubility_toolkit as st
from solubility_toolkit import config
from solubility_toolkit import io as toolkit_io
from solubility_toolkit.distribution import density_from_oc_hc


def _plain(obj):
    """numpy / tuples / NaN -> plain JSON-safe Python objects."""
    if isinstance(obj, dict):
        return {str(k): _plain(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_plain(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return _plain(obj.tolist())
    if isinstance(obj, np.generic):
        return _plain(obj.item())
    if isinstance(obj, float) and not math.isfinite(obj):
        return None
    return obj


class WebApi:
    """Every public method can be called from JavaScript."""

    # ------------------------------------------------------------ general
    def version(self):
        return {"toolkit": st.__version__, "numpy": np.__version__}

    def defaults(self):
        """All values of config.py (used by 'Reset to paper defaults')."""
        return {k: getattr(config, k) for k in dir(config) if k.isupper()}

    # ------------------------------------------------------------ ⓪ spectra -> alpha
    def unmix(self, csv_text, mz_min=None, mz_max=None, exclude="", renormalize=True, step=None, use_vr=None,
              vr_labels=None):
        """
        Tool ⓪: spectra CSV (mz, A0, A1A0_<Vr>, O1A0_<Vr>, ...) -> alpha for each Vr.
        Returns, for each Vr used: alpha, R², slope, the measured and reconstructed A0 spectra
        and the SSE-vs-alpha curve; plus the excluded part of A0 (drawn in grey) and the result CSV.
          use_vr    : list of Vr to fit, as named in the file (default: all found in the file)
          vr_labels : {"<Vr in file>": corrected Vr}; alpha depends only on the spectra, so this
                      only changes the Vr written in the results (and sent to tool ①)
        """
        header = [h.strip() for h in csv_text.lstrip("\ufeff").split("\n", 1)[0].split(",")]
        if "mz" not in header or "A0" not in header or not any(h.startswith("A1A0_") for h in header):
            raise ValueError("The file needs the columns mz, A0 and, for each Vr, A1A0_<Vr> and O1A0_<Vr> "
                             "(for example A1A0_1.78, O1A0_1.78)")
        step = config.ALPHA_GRID_STEP if step is None else float(step)
        options = dict(mz_min=mz_min, mz_max=mz_max, exclude=exclude or "")
        try:
            unmixer = toolkit_io.read_spectra(csv_text, renormalize=bool(renormalize), **options)
            raw = toolkit_io.read_spectra(csv_text, renormalize=False)          # whole file, as given
        except ValueError as err:
            if "could not convert" in str(err):
                raise ValueError("The file has an empty or non-numeric cell; every cell must be a number") from None
            raise
        keep = unmixer.keep
        if keep.sum() < 2:
            raise ValueError("Fewer than 2 m/z are left after applying the m/z window and exclusions")
        scale = 1.0 / raw.a0[keep].sum() if renormalize else 1.0

        found = unmixer.vr
        used = [v for v in found if use_vr is None or any(np.isclose(v, u) for u in use_vr)]
        if not used:
            raise ValueError("Select at least one condition (Vr)")
        labels = {float(k): float(v) for k, v in (vr_labels or {}).items()}
        label = lambda v: next((new for old, new in labels.items() if np.isclose(old, v)), v)
        fits, rows = [], []
        for vr_file in used:
            r = unmixer.fit(vr_file, step)
            alphas, sse = unmixer.sse_curve(vr_file, step)
            vr = label(vr_file)
            fits.append({"vr": vr, "vr_file": vr_file, "alpha": r.alpha, "r_squared": r.r_squared, "slope": r.slope, "sse": r.sse,
                         "mz": r.mz, "measured": r.measured, "reconstructed": r.reconstructed,
                         "curve": {"alpha": alphas, "sse": sse}})
            rows.append({"Vr": vr, "alpha": r.alpha, "one_minus_alpha": 1.0 - r.alpha,
                         "r_squared": r.r_squared, "slope": r.slope, "sse": r.sse})
        return {
            "vr_found": found, "vr_used": used, "vr_labels": [label(v) for v in found], "fits": fits,
            "excluded": {"mz": raw.mz[~keep], "a0": raw.a0[~keep] * scale},
            "mz_file": [raw.mz.min(), raw.mz.max()], "mz_used": [unmixer.mz[keep].min(), unmixer.mz[keep].max()],
            "n_mz": int(keep.sum()), "n_mz_file": int(raw.mz.size),
            "settings": {"step": step, "renormalize": bool(renormalize), "exclude": exclude or "",
                         "mc_uncertainty": config.MC_UNCERTAINTY},
            "csv": toolkit_io.write_table(rows),
        }

    # ------------------------------------------------------------ ① kernel
    def kernel_curves(self, vr, bin_centers, bin_width=None, margin=1.5, points=401):
        """f_A(log K_OW) for each Vr, bin edges and the kernel matrix (figure partition_kernel)."""
        width = config.DEFAULT_BIN_WIDTH if bin_width is None else float(bin_width)
        kernel = st.Kernel(vr, bin_centers, bin_width=width)
        centers = kernel.bin_centers
        lo, hi = centers.min() - width / 2 - margin, centers.max() + width / 2 + margin
        grid = np.linspace(lo, hi, int(points))
        edges = np.unique(np.concatenate([centers - width / 2, centers + width / 2]))
        return {
            "vr": kernel.vr,
            "bin_centers": centers,
            "bin_edges": edges,
            "log_kow": grid,
            "f_a": [st.fraction_aqueous(grid, v) for v in kernel.vr],
            "matrix": kernel.matrix,
        }

    # ------------------------------------------------------------ ① inversion
    def parse_alpha_csv(self, text):
        """Uploaded alpha CSV (Vr, alpha[, uncertainty_pct]) -> rows for the input table."""
        vr, alpha, unc = toolkit_io.read_alpha(text if "\n" in text else text + "\n")
        return {"vr": vr, "alpha": alpha, "uncertainty_pct": unc * 100}

    def invert(self, vr, alpha, uncertainty, bin_centers, bin_width=None, noise=None, n=None,
               seed=None, relation=None, hist_bins=40):
        """
        Monte Carlo NNLS inversion (tool ①). Returns everything page ① shows:
        the result table, the alpha fit, Monte Carlo histograms, kernel curves and the CSV text.
          uncertainty : relative (0.10 = 10 %), one value per Vr
          relation    : {"a": .., "b": .., "name": ..} or None for the config.py default
        """
        width = config.DEFAULT_BIN_WIDTH if bin_width is None else float(bin_width)
        noise = noise or config.MC_NOISE
        n = int(n or config.MC_ITERATIONS)
        rel = st.KowSolubilityRelation(**relation) if relation else st.KowSolubilityRelation()
        kernel = st.Kernel(vr, bin_centers, bin_width=width)
        alpha = np.asarray(alpha, dtype=float)
        u = np.asarray(uncertainty, dtype=float)

        result = st.Inversion(kernel).monte_carlo(alpha, n=n, uncertainty=u, noise=noise, seed=seed)
        table = result.table(rel)
        mean, sd = result.mean, result.sd
        total = float(mean.sum())

        top = max(1.0, float(result.samples.max()))
        edges = np.linspace(0.0, top, int(hist_bins) + 1)
        hist = [np.histogram(result.samples[:, j], bins=edges)[0] / n for j in range(mean.size)]

        return {
            "table": table,
            "csv": toolkit_io.write_table(table),
            "log_kow": kernel.bin_centers,
            "log_s": rel.log_s(kernel.bin_centers),
            "mean": mean, "sd": sd, "central": result.central,
            "normalized": mean / total if total > 0 else mean,
            "sd_normalized": sd / total if total > 0 else sd,
            "sum_mean": total,
            "bin_width": width,
            "relation": {"a": rel.a, "b": rel.b, "name": rel.name},
            "settings": {"n": n, "noise": noise, "seed": seed},
            "alpha_fit": {
                "vr": kernel.vr, "alpha": alpha,
                "low": np.clip(alpha * (1 - u), 0, 1), "high": np.clip(alpha * (1 + u), 0, 1),
                "fitted": kernel.matrix @ mean,
            },
            "histograms": {"centers": (edges[:-1] + edges[1:]) / 2, "width": edges[1] - edges[0], "fraction": hist},
            "kernel": self.kernel_curves(vr, bin_centers, bin_width=width),
        }

    # ------------------------------------------------------------ ② Köhler
    def parse_distribution_csv(self, text):
        """Uploaded distribution CSV -> columns (log_S, mass_fraction, density or O_C + H_C, kappa_intr)."""
        cols = toolkit_io.read_distribution(text if "\n" in text else text + "\n")
        cols = {k.strip().lower(): v for k, v in cols.items()}
        if "log_s" not in cols or "mass_fraction" not in cols:
            raise ValueError("The file needs the columns log_S and mass_fraction "
                             "(optional: density or O_C and H_C, kappa_intr)")
        return {k: cols[k] for k in ("log_s", "mass_fraction", "density", "o_c", "h_c", "kappa_intr") if k in cols}

    @staticmethod
    def _sample_name(sample):
        """{"type": "A1A0", "vr": 1.78} -> "A1A0[1.78]"   (types: particle, A0, A1A0, O1A0)"""
        kind = (sample or {}).get("type", "particle")
        return f"{kind}[{float(sample['vr']):g}]" if kind in ("A1A0", "O1A0") else kind

    def _particle_inputs(self, bins, relation):
        """Bin table of page ② -> (distribution of A0, densities, kappa_intr)."""
        rel = st.KowSolubilityRelation(**relation) if relation else st.KowSolubilityRelation()
        log_s = np.array([b["log_s"] for b in bins], dtype=float)
        mass = np.array([b["mass_fraction"] for b in bins], dtype=float)
        kappa = np.array([b["kappa_intr"] for b in bins], dtype=float)
        rho = np.array([b["density"] if b.get("density") is not None else density_from_oc_hc(b["o_c"], b["h_c"])
                        for b in bins], dtype=float)
        if mass.sum() <= 0:
            raise ValueError("The mass fractions must add up to more than 0")
        return st.SolubilityDistribution(rel.log_kow(log_s), mass, relation=rel, label="A0"), rho, kappa

    def _composition(self, sample, dist, rho, kappa, wiom_fraction, wiom_kappa, as_fraction, kernel=None):
        """
        Composition of one sample:
          particle : the bins (A0) + WIOM + ammonium sulfate, as entered
          A0       : the bins only (the WSOM solution)
          A1A0/O1A0: the part of A0 found in the aqueous / octanol phase at the volume ratio "vr"
                     (distribution x partitioning kernel, renormalized)
        """
        kind = (sample or {}).get("type", "particle")
        if kind == "particle":
            return st.Composition.from_distribution(dist, rho, kappa, wiom_fraction=float(wiom_fraction),
                                                    wiom_kappa=float(wiom_kappa), as_fraction=float(as_fraction),
                                                    label="particle")
        if kind == "A0":
            part = dist
        elif kind == "A1A0":
            part = dist.aqueous_phase(kernel, float(sample["vr"]))
        elif kind == "O1A0":
            part = dist.octanol_phase(kernel, float(sample["vr"]))
        else:
            raise ValueError(f"unknown sample type '{kind}'")
        return st.Composition.from_distribution(part, rho, kappa, wiom_kappa=float(wiom_kappa),
                                                label=self._sample_name(sample))

    @staticmethod
    def _kernel(dist, samples, bin_width):
        vr = sorted({float(s["vr"]) for s in samples if s and s.get("type") in ("A1A0", "O1A0")}, reverse=True)
        if not vr:
            return None
        width = config.DEFAULT_BIN_WIDTH if bin_width is None else float(bin_width)
        return st.Kernel(vr, dist.log_kow, bin_width=width)

    @staticmethod
    def _settings(sigma, temperature, solubility_units, raoult, grid):
        return st.KohlerSettings(
            sigma=config.SIGMA_WATER if sigma is None else float(sigma),
            temperature=config.TEMPERATURE if temperature is None else float(temperature),
            solubility_units=solubility_units, raoult=raoult, grid=grid)

    @staticmethod
    def _components(comp, rel):
        out = []
        for c in comp.components:
            wsom = c.name.startswith("logKow=")
            out.append({
                "name": c.name, "kind": "WSOM" if wsom else c.name,
                "volume_fraction": c.volume_fraction, "log_s": float(np.log10(c.solubility)),
                "log_kow": float(rel.log_kow(np.log10(c.solubility))) if wsom else None,
                "kappa_intr": c.kappa_intr, "density": c.density,
            })
        return out

    def kohler(self, bins, dd_nm=None, sigma=None, temperature=None, wiom_fraction=0.0, wiom_kappa=0.0,
               as_fraction=0.0, solubility_units="paper", raoult="dilute", grid="paper", ss_percent=None,
               relation=None, sample=None, bin_width=None):
        """
        Tool ②: solubility distribution + kappa_intr + density -> Köhler curve for one dry diameter,
        dissolved fraction of every component at every wet diameter, critical point, kappa_CCN.
          bins   : list of {"log_s", "mass_fraction", "kappa_intr", and "density" or ("o_c", "h_c")}
                   (WSOM bins = A0; WIOM and ammonium sulfate are added as volume fractions)
          sample : which sample to model, see _composition (default: the particle as entered)
          relation : K_OW-S relation, used to place the bins on the log K_OW axis
        """
        dist, rho, kappa = self._particle_inputs(bins, relation)
        rel = dist.relation
        dd = config.DEFAULT_DRY_DIAMETER_NM if dd_nm is None else float(dd_nm)
        comp = self._composition(sample, dist, rho, kappa, wiom_fraction, wiom_kappa, as_fraction,
                                 self._kernel(dist, [sample], bin_width))
        settings = self._settings(sigma, temperature, solubility_units, raoult, grid)
        model = st.KohlerModel(comp, settings)
        curve = model.curve(dd)
        if not np.isfinite(curve.s[1:]).all():
            raise ValueError("The Köhler curve could not be computed with these inputs")

        f, kap = comp.f, comp.kappa
        dissolved = (f * curve.eps).sum(axis=1)
        k_eff = (f * curve.eps * kap).sum(axis=1)
        dds, ss_crit, kappa_ccn = model.critical_table()
        ss = [] if not ss_percent else [float(x) for x in ss_percent]
        order = np.argsort(ss_crit)
        at_ss = np.interp(ss, ss_crit[order], kappa_ccn[order]) if ss else []
        in_range = [bool(ss_crit.min() <= x <= ss_crit.max()) for x in ss]

        components = self._components(comp, rel)
        i = curve.i_crit
        table = [{"D_nm": d, "s": s, "dissolved_fraction": x, "kappa_eff": k,
                  **{f"eps_{c['name']}": e for c, e in zip(components, row)}}
                 for d, s, x, k, row in zip(curve.d_nm[1:], curve.s[1:], dissolved[1:], k_eff[1:], curve.eps[1:])]
        return {
            "sample": self._sample_name(sample),
            "dd_nm": dd, "d_nm": curve.d_nm, "s": curve.s, "eps": curve.eps,
            "dissolved": dissolved, "kappa_eff": k_eff, "components": components,
            "critical": {"index": i, "s": curve.s_crit, "ss_percent": (curve.s_crit - 1) * 100,
                         "d_nm": curve.d_act_nm, "dissolved": curve.dissolved_fraction(),
                         "phase": curve.phase_state(i)},
            "kappa_ccn": {"ss_percent": ss, "kappa": at_ss, "in_range": in_range},
            "critical_table": {"dd_nm": dds, "ss_percent": ss_crit, "kappa": kappa_ccn},
            "settings": {"sigma": settings.sigma, "temperature": settings.temperature,
                         "solubility_units": solubility_units, "raoult": raoult, "grid": grid,
                         "wiom_log_s": config.WIOM_LOG_S,
                         "bin_width": config.DEFAULT_BIN_WIDTH if bin_width is None else float(bin_width)},
            "csv": toolkit_io.write_table(table),
        }

    def kappa_fit(self, bins, measured, wiom_fraction=0.0, wiom_kappa=0.0, as_fraction=0.0, sigma=None,
                  temperature=None, solubility_units="paper", raoult="dilute", grid="paper", relation=None,
                  bin_width=None, draws=None, tolerances=None, initial_range=None, seed=None):
        """
        Tool ②, fit: kappa_intr of every bin (and of WIOM) from measured kappa_CCN
        (solubility_toolkit.KappaIntrinsicFitter; the kappa_intr typed in the bin table are not used).
          measured : list of {"type", "vr" (for A1A0 / O1A0), "ss_percent": [...], "kappa": [...]}
        Progress is reported through progress_hook(done, total) after every draw.
        """
        if float(as_fraction) > 0:
            raise ValueError("The fit does not support ammonium sulfate: set its volume fraction to 0")
        dist, rho, kappa = self._particle_inputs(bins, relation)
        kernel = self._kernel(dist, measured, bin_width)
        settings = self._settings(sigma, temperature, solubility_units, raoult, grid)
        samples, data, info = {}, {}, []
        for m in measured:
            name = self._sample_name(m)
            if name in samples:
                raise ValueError(f"The fraction {name} is listed twice")
            samples[name] = self._composition(m, dist, rho, kappa, wiom_fraction, wiom_kappa, 0.0, kernel)
            data[name] = (m["ss_percent"], m["kappa"])
            info.append({"name": name, "type": m.get("type", "particle"), "vr": m.get("vr")})
        if not samples:
            raise ValueError("Enter measured kappa_CCN for at least one fraction")

        fitter = st.KappaIntrinsicFitter(
            samples, data, settings,
            tolerances=tuple(tolerances) if tolerances else config.KFIT_TOLERANCES,
            draws=int(draws) if draws else config.KFIT_DRAWS,
            initial_range=tuple(initial_range) if initial_range else config.KFIT_INITIAL_RANGE)
        result = fitter.fit(seed=seed, progress=progress_hook)

        first = next(iter(samples.values()))
        components = self._components(first, dist.relation)
        constrained = [bool(any(c.f[j] > 0 for c in samples.values())) for j in range(len(components))]
        out = {
            "ok": result.ok, "n_accepted": result.n_accepted, "draws": fitter.draws,
            "rounds": [{"tolerance": r.tolerance, "n_accepted": int(r.accepted.sum()), "ranges": r.ranges,
                        "best_score": float(r.score.min())} for r in result.rounds],
            "components": [{"name": c["name"], "kind": c["kind"], "log_s": c["log_s"], "log_kow": c["log_kow"],
                            "constrained": ok} for c, ok in zip(components, constrained)],
            "mean": result.mean, "sd": result.sd,
            "accepted": result.last.draws[result.last.accepted] if result.ok else [],
            "samples": [],
        }
        if result.ok:
            out["score"] = fitter.score(result.mean)
            compare = fitter.model_vs_measured(result.mean)
            for s in info:
                ss, meas, model = compare[s["name"]]
                out["samples"].append({**s, "ss_percent": ss, "measured": meas, "modelled": model})
        return out


# Set by js/engine/py_worker.js: a function(done, total) that reports the progress of long calculations.
progress_hook = None

API = WebApi()


def call(name, args_json="{}"):
    """Entry point used by js/engine/py_worker.js."""
    if name.startswith("_") or not callable(getattr(API, name, None)):
        raise AttributeError(f"web_api has no method '{name}'")
    return json.dumps(_plain(getattr(API, name)(**json.loads(args_json or "{}"))))
