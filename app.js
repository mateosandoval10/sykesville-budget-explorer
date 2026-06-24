/* Sykesville Budget Explorer — app logic
   Loads budget.json, intelligence.json, glossary.json and renders the page.
   No frameworks, no build step, no third-party requests (except the optional
   bring-your-own-key live AI call the user explicitly turns on). */

(function () {
  "use strict";

  const PALETTE = ["--c1", "--c2", "--c3", "--c4", "--c5", "--c6", "--c7", "--c8"];
  const LIVE_MODEL = "claude-haiku-4-5-20251001"; // cheap, fast; only used with the user's own key

  // Display label -> glossary key (only terms that exist in glossary.json)
  const GLOSSARY_MAP = {
    "Property Taxes": "property_tax",
    "Real property tax": "property_tax",
    "Intergovernmental": "intergovernmental_revenue",
    "Local income tax": "income_tax",
    "Highway User Revenue": "highway_user_revenue",
    "Capital Projects": "capital_budget",
    "Capital Outlays": "capital_budget"
  };

  let DATA = {};

  /* ---------- helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const fmtFull = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const fmtShort = (n) => {
    const a = Math.abs(n);
    if (a >= 1e6) return "$" + (n / 1e6).toFixed(2).replace(/\.00$/, "") + "M";
    if (a >= 1e3) return "$" + Math.round(n / 1e3) + "K";
    return "$" + Math.round(n);
  };
  const pct = (n, total) => (total ? (100 * n / total) : 0);
  const fmtPct = (n, total) => pct(n, total).toFixed(1) + "%";

  function glossify(label) {
    const key = GLOSSARY_MAP[label];
    if (!key || !DATA.glossary || !DATA.glossary.terms[key]) return escapeHtml(label);
    return `<span class="gloss" data-term="${key}" tabindex="0">${escapeHtml(label)}</span>`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- load ---------- */
  async function load() {
    try {
      const [budget, intelligence, glossary] = await Promise.all([
        fetch("data/budget.json").then(okJson),
        fetch("data/intelligence.json").then(okJson),
        fetch("data/glossary.json").then(okJson)
      ]);
      DATA = { budget, intelligence, glossary };
      render();
    } catch (err) {
      showLoadError(err);
    }
  }
  function okJson(r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  function showLoadError() {
    $("#status-badge").textContent = "Data not loaded";
    const banner = el("div", "error-banner",
      "<strong>Couldn't load the budget data.</strong> If you opened this file directly, browsers block local file reads. " +
      "Run a tiny local server in this folder — <code>python3 -m http.server</code> — then open " +
      "<code>http://localhost:8000</code>. (On the live site it loads automatically.)");
    $("#main").prepend(banner);
  }

  /* ---------- render orchestrator ---------- */
  function render() {
    const b = DATA.budget;
    $("#status-badge").textContent = b.meta.fiscal_year + " · " + b.meta.status;
    $("#source-link").href = b.meta.source.url;

    renderHero();
    renderBreakdown("rev", b.revenues.categories, b.revenues.total, "revenue");
    renderBreakdown("exp", b.expenditures.groups, b.expenditures.total, "spending");
    renderAsk();
    renderCalculator();
    renderCapital();
    renderReserves();
    renderFacts();
    wireTooltips();
  }

  /* ---------- hero ---------- */
  function renderHero() {
    const h = DATA.budget.headline;
    const m = DATA.budget.meta;
    const perResident = h.total_budget / m.population;
    const perResidentOp = h.operating_budget / m.population;

    const stats = [
      { num: fmtShort(h.total_budget), label: "Total FY2026 budget", sub: (h.change_pct * 100).toFixed(0) + "% vs. last year" },
      { num: "$" + Math.round(perResident).toLocaleString(), label: "Per resident", sub: "$" + Math.round(perResidentOp).toLocaleString() + " operating" },
      { num: "$" + h.property_tax_rate.toFixed(2), label: "Property tax rate (per $100)", sub: "was $" + h.property_tax_rate_prior.toFixed(2) + " in FY25" },
      { num: fmtFull(h.long_term_debt), label: "Long-term debt", sub: "fully funded reserves", danger: true }
    ];
    const grid = $("#stat-grid");
    grid.innerHTML = "";
    stats.forEach((s) => {
      const node = el("div", "stat" + (s.danger ? " danger" : ""));
      node.innerHTML = `<div class="num">${s.num}</div><div class="label">${s.label}</div><div class="sub">${s.sub}</div>`;
      grid.appendChild(node);
    });

    $("#hero-note").innerHTML =
      `A balanced budget for a town of ${m.population.toLocaleString()} residents. ` +
      `About ${fmtPct(h.capital_and_one_time, h.total_budget)} is one-time capital and federal money that won't repeat — ` +
      `the recurring, day-to-day operating budget is ${fmtShort(h.operating_budget)}.`;
  }

  /* ---------- breakdown (donut + legend + drill-down) ---------- */
  function renderBreakdown(prefix, items, total, word) {
    $("#" + prefix + "-total").textContent = fmtFull(total);

    const colored = items
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .map((it, i) => ({ ...it, color: cssVar(PALETTE[i % PALETTE.length]) }));

    // donut via conic-gradient
    let acc = 0;
    const stops = colored.map((it) => {
      const start = pct(acc, total);
      acc += it.amount;
      const end = pct(acc, total);
      return `${it.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    });
    const donut = $("#" + prefix + "-donut");
    donut.style.background = `conic-gradient(${stops.join(",")})`;
    donut.setAttribute("data-center", fmtShort(total) + " total");

    // legend (clickable -> drill-down)
    const legend = $("#" + prefix + "-legend");
    legend.innerHTML = "";
    const detail = $("#" + prefix + "-detail");
    colored.forEach((it) => {
      const row = el("button", "legend-row");
      row.type = "button";
      row.setAttribute("aria-expanded", "false");
      row.innerHTML =
        `<span class="swatch" style="background:${it.color}"></span>` +
        `<span class="legend-name">${glossify(it.name)}</span>` +
        `<span class="legend-amt">${fmtShort(it.amount)}</span>` +
        `<span class="legend-pct">${fmtPct(it.amount, total)}</span>`;
      row.addEventListener("click", () => {
        const open = row.getAttribute("aria-expanded") === "true";
        legend.querySelectorAll(".legend-row").forEach((r) => r.setAttribute("aria-expanded", "false"));
        if (open) {
          detail.hidden = true;
        } else {
          row.setAttribute("aria-expanded", "true");
          showDetail(detail, it, word);
        }
      });
      legend.appendChild(row);
    });
  }

  function showDetail(container, item, word) {
    container.hidden = false;
    container.innerHTML = "";
    container.appendChild(el("h3", null, glossify(item.name) + " — " + fmtFull(item.amount)));
    if (item.blurb) container.appendChild(el("p", "detail-blurb", escapeHtml(item.blurb)));

    const kids = item.children && item.children.length ? item.children : [{ name: item.name, amount: item.amount, note: item.note }];
    const maxAmt = Math.max(...kids.map((k) => k.amount));
    kids.forEach((k) => {
      const row = el("div", "bar-row");
      const oneTime = k.recurring === false ? '<span class="one-time-tag">one-time</span>' : "";
      row.innerHTML =
        `<div class="bar-head"><span class="bn">${glossify(k.name)}${oneTime}</span><span class="ba">${fmtFull(k.amount)} · ${fmtPct(k.amount, item.amount)}</span></div>` +
        `<div class="bar-track"><div class="bar-fill" style="width:${(100 * k.amount / maxAmt).toFixed(1)}%;background:${item.color}"></div></div>` +
        (k.note ? `<p class="bar-note">${escapeHtml(k.note)}</p>` : "");
      container.appendChild(row);
    });
    container.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ---------- Ask the Budget ---------- */
  let liveMode = false;
  function renderAsk() {
    const sug = DATA.intelligence.suggested_questions || [];
    const box = $("#ask-suggestions");
    box.innerHTML = "";
    sug.forEach((q) => {
      const chip = el("button", "chip", escapeHtml(q));
      chip.type = "button";
      chip.addEventListener("click", () => {
        $("#ask-input").value = q;
        answer(q);
      });
      box.appendChild(chip);
    });

    $("#ask-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = $("#ask-input").value.trim();
      if (q) answer(q);
    });

    const toggle = $("#live-toggle");
    toggle.addEventListener("click", () => {
      liveMode = !liveMode;
      toggle.classList.toggle("on", liveMode);
      toggle.textContent = liveMode ? "🔑 Live AI: on" : "🔑 Live AI: off";
      toggle.setAttribute("aria-expanded", String(liveMode));
      $("#live-panel").hidden = !liveMode;
    });
  }

  function bestMatch(query) {
    const q = " " + query.toLowerCase().replace(/[^a-z0-9\s]/g, " ") + " ";
    let best = null, bestScore = 0;
    DATA.intelligence.faq.forEach((item) => {
      let score = 0;
      (item.keywords || []).forEach((kw) => {
        if (q.includes(" " + kw.toLowerCase() + " ") || q.includes(kw.toLowerCase())) {
          score += Math.min(3, kw.split(" ").length) + kw.length / 12;
        }
      });
      // light overlap with the canonical question
      item.question.toLowerCase().split(/\s+/).forEach((w) => {
        if (w.length > 3 && q.includes(" " + w + " ")) score += 0.4;
      });
      if (score > bestScore) { bestScore = score; best = item; }
    });
    return bestScore >= 1 ? best : null;
  }

  async function answer(query) {
    const out = $("#ask-answer");
    out.hidden = false;
    out.className = "ask-answer";

    if (liveMode) {
      const key = $("#api-key").value.trim();
      if (key) return liveAnswer(query, key, out);
    }

    const match = bestMatch(query);
    if (match) {
      out.innerHTML =
        `<p class="aa-q">${escapeHtml(query)}</p>` +
        `<p class="aa-a">${escapeHtml(match.answer)}</p>` +
        srcLine(match.cites);
    } else {
      const sug = (DATA.intelligence.suggested_questions || []).slice(0, 4).map((q) => `“${escapeHtml(q)}”`).join(" · ");
      out.innerHTML =
        `<p class="aa-q">${escapeHtml(query)}</p>` +
        `<p class="aa-a">I don't have a pre-written answer for that yet. The free version covers the most common questions — try one of these: ${sug}. ` +
        `Or flip on <strong>🔑 Live AI</strong> above and add your own key for any question.</p>`;
    }
  }

  function srcLine(cites) {
    if (!cites || !cites.length) return `<p class="aa-src">Source: Town of Sykesville FY2026 budget.</p>`;
    const names = cites.map((c) => categoryName(c)).filter(Boolean);
    return `<p class="aa-src">Based on: ${names.map(escapeHtml).join(", ")} · Town of Sykesville FY2026 budget.</p>`;
  }
  function categoryName(key) {
    if (key === "reserves") return "Reserves";
    const r = (DATA.budget.revenues.categories || []).find((c) => c.key === key);
    if (r) return r.name;
    const e = (DATA.budget.expenditures.groups || []).find((g) => g.key === key);
    if (e) return e.name;
    return null;
  }

  async function liveAnswer(query, key, out) {
    out.classList.add("live-loading");
    out.innerHTML = `<p class="aa-q">${escapeHtml(query)}</p><p class="aa-a"></p>`;
    const system =
      "You answer questions about the Town of Sykesville, Maryland FY2026 budget for residents. " +
      "Use ONLY the JSON budget data below. Be concise (2–4 sentences), plain-English, and cite specific dollar figures. " +
      "If the answer isn't in the data, say so plainly. Do not invent numbers.\n\nBUDGET DATA:\n" +
      JSON.stringify({ headline: DATA.budget.headline, revenues: DATA.budget.revenues, expenditures: DATA.budget.expenditures, reserves: DATA.budget.reserves, capital_projects: DATA.budget.capital_projects, facts: DATA.budget.facts });

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: LIVE_MODEL,
          max_tokens: 600,
          system: system,
          messages: [{ role: "user", content: query }]
        })
      });
      const data = await res.json();
      out.classList.remove("live-loading");
      if (!res.ok) {
        const msg = (data && data.error && data.error.message) || ("HTTP " + res.status);
        out.innerHTML = `<p class="aa-q">${escapeHtml(query)}</p><p class="aa-a">Live AI error: ${escapeHtml(msg)}. Your free pre-built answers still work — just turn Live AI off.</p>`;
        return;
      }
      const text = (data.content || []).map((c) => c.text || "").join("").trim();
      out.innerHTML =
        `<p class="aa-q">${escapeHtml(query)}</p>` +
        `<p class="aa-a">${escapeHtml(text)}</p>` +
        `<p class="aa-src">Answered live by Claude (${LIVE_MODEL}), grounded in the Sykesville FY2026 budget.</p>`;
    } catch (e) {
      out.classList.remove("live-loading");
      out.innerHTML = `<p class="aa-q">${escapeHtml(query)}</p><p class="aa-a">Couldn't reach the AI service from your browser (${escapeHtml(String(e.message || e))}). The free pre-built answers still work with Live AI off.</p>`;
    }
  }

  /* ---------- tax calculator ---------- */
  function renderCalculator() {
    const form = $("#calc-form");
    form.addEventListener("submit", (e) => { e.preventDefault(); runCalc(); });
    const input = $("#home-value");
    input.addEventListener("blur", () => {
      const v = parseMoney(input.value);
      if (!isNaN(v)) input.value = v.toLocaleString("en-US");
    });
    runCalc();
  }
  function parseMoney(s) { return parseFloat(String(s).replace(/[^0-9.]/g, "")); }

  function runCalc() {
    const b = DATA.budget;
    const assessed = parseMoney($("#home-value").value);
    const out = $("#calc-result");
    if (isNaN(assessed) || assessed <= 0) { out.innerHTML = `<p class="muted">Enter a home value above.</p>`; return; }

    const rate = b.headline.property_tax_rate;
    const townTax = assessed / 100 * rate;
    const groups = b.expenditures.groups.slice().sort((a, c) => c.amount - a.amount);
    const total = b.expenditures.total;
    const maxAmt = Math.max(...groups.map((g) => g.amount));

    let bars = "";
    groups.forEach((g, i) => {
      const yourShare = townTax * g.amount / total;
      const color = cssVar(PALETTE[i % PALETTE.length]);
      bars +=
        `<div class="bar-row"><div class="bar-head"><span class="bn">${glossify(g.name)}</span>` +
        `<span class="ba">${fmtMoney(yourShare)} · ${fmtPct(g.amount, total)}</span></div>` +
        `<div class="bar-track"><div class="bar-fill" style="width:${(100 * g.amount / maxAmt).toFixed(1)}%;background:${color}"></div></div></div>`;
    });

    out.innerHTML =
      `<p class="calc-headline">Your annual <em>town</em> property tax: <strong>${fmtMoney(townTax)}</strong></p>` +
      `<p class="calc-sub">That's ${fmtMoney(townTax / 12)} a month — $${rate.toFixed(2)} per $100 of your $${assessed.toLocaleString()} assessment. Here's how it splits across town services:</p>` +
      bars +
      `<p class="bar-note" style="margin-top:14px">Note: this is only the <strong>Town</strong> portion. Most of your total property-tax bill goes to Carroll County and the State of Maryland, which set their own separate rates.</p>`;
  }
  function fmtMoney(n) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  /* ---------- capital projects ---------- */
  function renderCapital() {
    const list = $("#cap-list");
    list.innerHTML = "";
    DATA.budget.capital_projects.slice().sort((a, b) => b.amount - a.amount).forEach((p) => {
      const item = el("div", "cap-item");
      item.innerHTML =
        `<span class="cn">${escapeHtml(p.name)}</span>` +
        `<span class="ca">${fmtFull(p.amount)}</span>` +
        `<span class="cf">${escapeHtml(p.category)} · <span class="cap-fund-tag">${escapeHtml(p.funding)}</span></span>`;
      list.appendChild(item);
    });
  }

  /* ---------- reserves ---------- */
  function renderReserves() {
    const r = DATA.budget.reserves;
    const wrap = $("#res-content");
    let rows = "";
    r.items.forEach((it) => {
      rows += `<div class="res-row"><span class="rn">${escapeHtml(it.name)}</span><span class="rv">${fmtFull(it.amount)}</span>` +
        (it.note ? `<span class="rnote">${escapeHtml(it.note)}</span>` : "") + `</div>`;
    });
    wrap.innerHTML =
      `<div class="res-debt"><div class="label muted" style="margin:0">Long-term debt</div>` +
      `<div class="big">${fmtFull(r.long_term_debt)}</div>` +
      `<p class="micro" style="margin:6px 0 0">Sykesville owes nothing long-term — capital projects are funded from grants, reserves, and federal money rather than borrowing.</p></div>` +
      `<div class="res-list">${rows}</div>`;
  }

  /* ---------- facts ---------- */
  function renderFacts() {
    const ul = $("#facts-list");
    ul.innerHTML = "";
    DATA.budget.facts.forEach((f) => ul.appendChild(el("li", null, escapeHtml(f))));
  }

  /* ---------- glossary tooltips ---------- */
  function wireTooltips() {
    const tip = $("#tooltip");
    function show(e) {
      const term = e.target.getAttribute("data-term");
      const g = DATA.glossary.terms[term];
      if (!g) return;
      tip.innerHTML = `<strong>${escapeHtml(g.term)}</strong><br>${escapeHtml(g.plain_english)}`;
      tip.hidden = false;
      const rect = e.target.getBoundingClientRect();
      const top = window.scrollY + rect.bottom + 8;
      let left = window.scrollX + rect.left;
      left = Math.min(left, window.scrollX + document.documentElement.clientWidth - 300);
      tip.style.top = top + "px";
      tip.style.left = Math.max(8, left) + "px";
    }
    function hide() { tip.hidden = true; }
    document.addEventListener("mouseover", (e) => { if (e.target.classList && e.target.classList.contains("gloss")) show(e); });
    document.addEventListener("mouseout", (e) => { if (e.target.classList && e.target.classList.contains("gloss")) hide(); });
    document.addEventListener("focusin", (e) => { if (e.target.classList && e.target.classList.contains("gloss")) show(e); });
    document.addEventListener("focusout", (e) => { if (e.target.classList && e.target.classList.contains("gloss")) hide(); });
  }

  /* ---------- go ---------- */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();
