/* =====================================================================
   HALLATEC FORGE - SHARED COMPONENT LIBRARY
   Dependency-free. Import, never fork. Powers every tool in the suite.
   ===================================================================== */
(function (w, d) {
  "use strict";
  const HTC = (w.HTC = w.HTC || {});
  const reduce = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r) => (r || d).querySelector(s);
  const $$ = (s, r) => Array.from((r || d).querySelectorAll(s));
  HTC.$ = $; HTC.$$ = $$;

  /* ---- shared HTML-escape (security-sensitive): the single escaper for the suite.
     Any user-controlled or externally-sourced value (domain, DKIM selector, CVE id,
     scanner-supplied strings) MUST pass through HTC.esc before it enters innerHTML.
     Do not fork this into per-tool helpers. ---- */
  HTC.esc = function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  /* ---- shared result factory (B06): the single normalised result shape for the suite.
     Every tool that produces a verdict/score SHOULD emit through HTC.result so downstream
     UI, exports and any future API speak one schema. Honesty defaults matter:
       - status:  "demo_only" | "unverified" | "live"     (default demo_only)
       - confidence: "sample" (prototype calc) | "none" (no live check) | "live"
     Never pass status:"live" or confidence:"live" unless a real live check ran.
     Do not fork this into per-tool factories. ---- */
  HTC.result = function result(input) {
    input = input || {};
    return {
      toolId: input.toolId || "unknown",
      status: input.status || "demo_only",
      verdict: input.verdict || "unverified",
      label: input.label || "Demo result",
      summary: input.summary ||
        "This result is based on prototype logic and should be verified before production use.",
      score: typeof input.score === "number" ? input.score : null,
      severity: input.severity || null,
      confidence: input.confidence || "sample",
      evidence: Array.isArray(input.evidence) ? input.evidence : [],
      recommendations: Array.isArray(input.recommendations) ? input.recommendations : [],
      timestamp: input.timestamp || new Date().toISOString()
    };
  };

  /* ---- inject the shared gradient defs once (used by all gauges) ---- */
  function injectDefs() {
    if ($("#htc-defs")) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "htc-defs"; svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0";
    svg.innerHTML =
      '<defs>' +
      '<linearGradient id="hgrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#f26530"/><stop offset="1" stop-color="#ef495d"/>' +
      '</linearGradient>' +
      /* userSpaceOnUse so each radial tick samples the warm gradient by its position on the arc */
      '<linearGradient id="hgauge" x1="14" y1="106" x2="106" y2="14" gradientUnits="userSpaceOnUse">' +
      '<stop offset="0" stop-color="#f26530"/><stop offset="1" stop-color="#ef495d"/>' +
      '</linearGradient>' +
      '</defs>';
    d.body.appendChild(svg);
  }

  /* ---- number helpers ---- */
  HTC.fmt = (n) => (Math.round(n)).toLocaleString("en-US");
  HTC.aed = (n) => "AED " + HTC.fmt(n);
  HTC.clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  /* ---- SCORE GAUGE (segmented radial, modern) ----
     A ring of tapered ticks; the filled arc samples the Hallatec gradient by position.
     One consistent number scale per size variant (no per-tool font overrides). ---- */
  const G_TICKS = 44, G_SWEEP = 300, G_ROUT = 57, G_RIN = 45, G_C = 60;
  function gPolar(r, deg) { const a = (deg - 90) * Math.PI / 180; return [G_C + r * Math.cos(a), G_C + r * Math.sin(a)]; }
  function gaugeMarkup(ticks, sweep, max) {
    const gap = 360 - sweep, start = 180 + gap / 2, step = ticks > 1 ? sweep / (ticks - 1) : 0;
    let s = "";
    for (let i = 0; i < ticks; i++) {
      const deg = start + i * step;
      const p1 = gPolar(G_RIN, deg), p2 = gPolar(G_ROUT, deg);
      s += '<line class="gt" x1="' + p1[0].toFixed(2) + '" y1="' + p1[1].toFixed(2) +
           '" x2="' + p2[0].toFixed(2) + '" y2="' + p2[1].toFixed(2) + '"/>';
    }
    return '<svg viewBox="0 0 120 120" aria-hidden="true">' + s + '</svg>' +
      '<div class="center"><div class="num" role="status" aria-live="polite">0</div>' +
      '<div class="den">/ ' + max + '</div><div class="band-label grad-text"></div></div>';
  }
  HTC.gauge = function (el, value, opts) {
    opts = opts || {};
    const max = opts.max || +el.dataset.max || 100;
    const band = opts.band != null ? opts.band : (el.dataset.band || "");
    const ticks = +el.dataset.ticks || G_TICKS;
    const sweep = +el.dataset.sweep || G_SWEEP;
    const empty = opts.empty === true || value == null || value === "" || !isFinite(+value);
    if (!$("svg", el)) el.innerHTML = gaugeMarkup(ticks, sweep, max);
    const gts = $$(".gt", el), num = $(".num", el), den = $(".den", el), lab = $(".band-label", el);
    if (empty) {
      gts.forEach((t) => t.classList.remove("on"));
      if (num) { num.classList.add("is-empty"); num.textContent = opts.emptyText || "N/A"; }
      if (den) den.textContent = "";
      if (lab) lab.textContent = opts.band || "No verdict";
      el.setAttribute("aria-label", (opts.label || "Score") + ": no verdict issued");
      return;
    }
    if (num) num.classList.remove("is-empty");
    if (den) den.textContent = "/ " + max;
    if (lab) lab.textContent = band;
    const pct = HTC.clamp(+value / max, 0, 1), target = Math.round(pct * ticks);
    el.setAttribute("aria-label", (opts.label || "Score") + " " + Math.round(+value) + " of " + max + (band ? ", " + band : ""));
    function paint(nOn, shown) {
      for (let i = 0; i < gts.length; i++) gts[i].classList.toggle("on", i < nOn);
      if (num) num.textContent = shown;
    }
    if (reduce) { paint(target, Math.round(+value)); return; }
    const t0 = performance.now(), dur = 1100;
    (function tick(t) {
      const p = HTC.clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
      paint(Math.round(target * e), Math.round(+value * e));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  };
  HTC.initGauges = (root) => $$(".gauge[data-value]", root).forEach((g) => HTC.gauge(g, +g.dataset.value));

  /* ---- TRACK METER (horizontal slider-style sub-metric, gradient fill + handle) ----
     Markup: <div class="track-meter" data-value="72" data-label="Protect" data-max="100"></div>
     or call HTC.trackMeter(el, value, {label, max, unit, display, target}). ---- */
  HTC.trackMeter = function (el, value, opts) {
    opts = opts || {};
    const max = opts.max || +el.dataset.max || 100;
    const label = opts.label != null ? opts.label : (el.dataset.label || "");
    const unit = opts.unit != null ? opts.unit : (el.dataset.unit || "");
    const display = opts.display != null ? opts.display : el.dataset.display;
    const target = opts.target != null ? opts.target : el.dataset.target;
    const valText = display != null ? display : (Math.round(+value) + unit);
    if (!$(".tm-track", el)) {
      el.innerHTML =
        '<div class="tm-head"><span class="tm-label">' + HTC.esc(label) + '</span>' +
        '<span class="tm-val">' + HTC.esc(valText) + '</span></div>' +
        '<div class="tm-track">' + (target != null ? '<i class="tm-target" style="left:' +
          HTC.clamp(+target / max, 0, 1) * 100 + '%"></i>' : '') +
        '<span class="tm-fill"><i class="tm-knob"></i></span></div>';
    } else {
      $(".tm-label", el).textContent = label;
      $(".tm-val", el).textContent = valText;
    }
    const pct = HTC.clamp(+value / max, 0, 1) * 100, fill = $(".tm-fill", el);
    requestAnimationFrame(() => { fill.style.width = pct + "%"; });
    el.setAttribute("role", "meter");
    el.setAttribute("aria-valuenow", String(Math.round(+value)));
    el.setAttribute("aria-valuemin", "0");
    el.setAttribute("aria-valuemax", String(max));
    if (label) el.setAttribute("aria-label", label + " " + valText);
  };
  HTC.meters = (root) => $$(".track-meter[data-value]", root).forEach((m) => HTC.trackMeter(m, +m.dataset.value));

  /* ---- animate sub-score bars (legacy .subbar; track-meter preferred for new work) ---- */
  HTC.bars = (root) => $$(".subbar .tr > span[data-w]", root).forEach((s) => {
    requestAnimationFrame(() => (s.style.width = s.dataset.w + "%"));
  });

  /* ---- copy-to-clipboard for .code blocks ---- */
  HTC.wireCopy = (root) => $$(".code", root).forEach((box) => {
    if ($(".copy", box)) return;
    const btn = d.createElement("button");
    btn.className = "copy"; btn.type = "button"; btn.textContent = "Copy";
    btn.addEventListener("click", () => {
      const txt = box.getAttribute("data-copy") || box.textContent.replace(/Copy$/, "").trim();
      if (navigator.clipboard) navigator.clipboard.writeText(txt);
      btn.textContent = "Copied"; setTimeout(() => (btn.textContent = "Copy"), 1400);
    });
    box.appendChild(btn);
  });

  /* ---- toast ---- */
  HTC.toast = function (msg) {
    let t = $("#htc-toast");
    if (!t) { t = d.createElement("div"); t.id = "htc-toast";
      t.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:200;background:#1c1f28;border:1px solid rgba(255,255,255,.16);color:#f5f6f8;padding:12px 18px;border-radius:999px;font:500 13.5px Poppins,sans-serif;box-shadow:0 20px 50px -20px #000;opacity:0;transition:.25s";
      d.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = "1"; t.style.bottom = "34px";
    clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = "0"; t.style.bottom = "26px"; }, 1900);
  };

  HTC.print = () => w.print();

  /* ---- verdict handoff (the "Next move" step of the honest flow) ----
     One canonical destination for every tool result: the parent site's
     single funnel. Tagged with the tool and topic so the conversation
     starts from what the visitor just measured.

     The handoff is plain HTML in each tool so it works with no JS. This
     helper exists so anything generated at runtime builds the SAME url -
     do not hand-write assessment links elsewhere.

     Optionally carries the score band (not the score itself, and never
     the target/domain) so sales has context without the tool leaking
     what was scanned. Honesty rule: nothing identifying leaves the page. */
  HTC.PATH_BASE = "https://hallatec.com/assessment/";
  HTC.pathHref = function pathHref(toolId, topic, band) {
    const p = new URLSearchParams();
    p.set("source", toolId || "forge");
    if (topic) p.set("topic", topic);
    if (band) p.set("band", band);          // "low" | "medium" | "high"
    return HTC.PATH_BASE + "?" + p.toString();
  };
  /* Map a 0-100 score to a coarse band. Deliberately coarse. */
  HTC.scoreBand = (score) =>
    typeof score !== "number" ? null : score >= 70 ? "low" : score >= 40 ? "medium" : "high";

  /* smooth-scroll a result section into view (guarded for environments without scrollIntoView) */
  HTC.reveal = function (el) {
    if (!el) return;
    el.classList.remove("hidden");
    el.classList.add("result-appear");
    if (el.scrollIntoView) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  /* =====================================================================
     QUESTIONNAIRE ENGINE  (shared infra - H-Score's Phase-1 deliverable)
     Renders a versioned bank, 0-4 maturity per item, progress by group.
     Reused by H-Score, EmailGuard, TrustKey, Lockfall, Aegis365.
     ===================================================================== */
  const MATURITY = [
    { v: 0, label: "None" }, { v: 1, label: "Ad-hoc" }, { v: 2, label: "Defined" },
    { v: 3, label: "Managed" }, { v: 4, label: "Automated" }
  ];
  HTC.Questionnaire = function (cfg) {
    const mount = typeof cfg.mount === "string" ? $(cfg.mount) : cfg.mount;
    const labels = cfg.labels || MATURITY;
    const answers = {};
    const total = cfg.groups.reduce((n, g) => n + g.items.length, 0);

    const prog = d.createElement("div");
    prog.className = "qprogress";
    prog.innerHTML =
      '<div class="wrap"><div class="meta"><span><b class="qcount">0</b> of ' + total + " answered</span>" +
      '<span class="qpct">0%</span></div><div class="bar"><span></span></div>' +
      '<div class="fn-track">' + cfg.groups.map((g, i) =>
        '<span class="fn-dot" data-fn="' + i + '"><i></i>' + (g.fn || g.title) + "</span>").join("") + "</div></div>";
    mount.appendChild(prog);

    const body = d.createElement("div"); body.className = "wrap"; mount.appendChild(body);

    cfg.groups.forEach((g, gi) => {
      const sec = d.createElement("section"); sec.className = "qgroup"; sec.dataset.g = gi;
      sec.innerHTML =
        '<div class="qg-head"><span class="fn-badge">' + (g.fn || "") + '</span><h3>' + g.title + "</h3></div>" +
        (g.note ? '<p class="muted">' + g.note + "</p>" : "");
      g.items.forEach((it) => {
        const scale = it.scale || labels;
        const q = d.createElement("div"); q.className = "question";
        q.innerHTML =
          '<div class="qtext">' + it.text +
          (it.why ? ' <span class="qwhy" title="' + it.why.replace(/"/g, "&quot;") + '">why?</span>' : "") + "</div>" +
          '<div class="segmented" role="group" aria-label="' + it.text.replace(/"/g, "&quot;") + '">' +
          scale.map((s) =>
            '<button type="button" data-id="' + it.id + '" data-v="' + s.v + '" aria-pressed="false">' +
            '<span class="lv">' + s.v + '</span>' + s.label + "</button>").join("") + "</div>";
        sec.appendChild(q);
      });
      body.appendChild(sec);
    });

    const actions = d.createElement("div"); actions.className = "wrap"; actions.style.marginTop = "26px";
    actions.innerHTML = '<button class="btn btn-primary qcompute" disabled>' +
      (cfg.computeLabel || "See my result") + " &nbsp;&rarr;</button>" +
      '<p class="muted" style="margin-top:10px">Nothing you enter leaves your browser. No account, no storage.</p>';
    mount.appendChild(actions);

    const barSpan = $(".qprogress .bar > span", mount);
    const cntEl = $(".qcount", mount), pctEl = $(".qpct", mount), computeBtn = $(".qcompute", mount);

    function refresh() {
      const done = Object.keys(answers).length;
      const pct = Math.round((done / total) * 100);
      if (barSpan) barSpan.style.width = pct + "%";
      if (cntEl) cntEl.textContent = done;
      if (pctEl) pctEl.textContent = pct + "%";
      /* light up the per-function progress dots as each group is fully answered */
      cfg.groups.forEach((g, gi) => {
        const dot = $('.fn-dot[data-fn="' + gi + '"]', mount);
        if (!dot) return;
        const answeredInGroup = g.items.filter((it) => answers[it.id] != null).length;
        dot.classList.toggle("done", answeredInGroup === g.items.length && g.items.length > 0);
        dot.classList.toggle("partial", answeredInGroup > 0 && answeredInGroup < g.items.length);
      });
      if (computeBtn) computeBtn.disabled = done < total;
    }

    /* answer selection - event-delegated so it survives re-render */
    body.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      const v = +btn.getAttribute("data-v");
      answers[id] = v;
      const seg = btn.parentNode;
      $$("button[data-id]", seg).forEach((b) => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      refresh();
    });

    if (computeBtn) {
      computeBtn.addEventListener("click", () => {
        if (Object.keys(answers).length < total) return;
        if (typeof cfg.onCompute === "function") cfg.onCompute(Object.assign({}, answers));
      });
    }

    refresh();

    return {
      answers: answers,
      isComplete: () => Object.keys(answers).length >= total,
      reset: () => {
        Object.keys(answers).forEach((k) => delete answers[k]);
        $$("button[data-id]", body).forEach((b) => b.setAttribute("aria-pressed", "false"));
        refresh();
      },
      scrollTop: () => { if (mount && mount.scrollIntoView) mount.scrollIntoView({ behavior: "smooth", block: "start" }); }
    };
  };

  /* ---- auto-init shared components on DOM ready ---- */
  function boot() {
    injectDefs();
    HTC.initGauges(d);
    HTC.meters(d);
    HTC.bars(d);
    HTC.wireCopy(d);
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot);
  else boot();

  w.HTC = HTC;
})(window, document);
