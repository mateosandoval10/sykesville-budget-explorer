# 🏛️ Sykesville Budget Explorer

**An interactive, plain-English tool that shows residents of Sykesville, Maryland where their town's money comes from and where it goes — built from the Town's official FY2026 budget.**

> 🔗 **Live demo:** **https://mateosandoval10.github.io/sykesville-budget-explorer/**
> 📄 **Data source:** [Town of Sykesville FY2026 Annual Budget Document](https://www.townofsykesville.gov/DocumentCenter/View/4477/DRAFT-FY2026-Budget-Book)

---

## Why this exists

Every year the Town of Sykesville adopts a ~$6.9 million budget that decides how much goes to police, parks, road repair, and trash pickup — and how much you pay in property tax. That budget is public, but it lives in an 18-page PDF that almost no resident will ever read.

This tool turns that PDF into something a neighbor can actually use in two minutes: clear charts, plain-English explanations of budget jargon, a calculator that shows your personal share, and an **"Ask the Budget"** box that answers questions in everyday language — all from the real, official numbers.

It's civic infrastructure designed to **cost the Town nothing to run** and to keep working for years with no maintenance.

## What it does

- **The budget in plain terms** — a four-line summary up top so anyone gets the gist in 15 seconds.
- **Is the Town financially healthy?** — a plain-language verdict (balanced budget, no debt, funded reserves, conservative planning) so residents get the bottom line, not just numbers.
- **Where the money comes from / goes** — interactive donut charts with click-to-expand detail. The opaque "Other Sources" line that's 39% of revenue? Broken down so you can see it's mostly one-time federal and grant money.
- **🤝 Services you actually use** — the same spending, regrouped by the everyday services it pays for (police, trash, parks, the museum…).
- **💬 Ask the Budget** — type a question in plain English ("How much do we spend on police vs. parks?") and get an answer grounded in the actual budget, instantly and for free. Plus a browseable list of common questions.
- **Where does *my* tax dollar go?** — enter your home's assessed value (with a link to look it up on Maryland SDAT) to see your annual town property tax and how it splits across services.
- **Year-over-year** — how this year's total and tax rate compare to last year, in context.
- **Major projects** — every capital project this year, *where* it is, and who's paying for it (grant, federal funds, reserves, or local taxes).
- **Reserves & financial health** — the Town's savings and its zero long-term debt.
- **🗣️ Have your say** — the real Mayor & Council, how the budget gets adopted, and one-tap ways to act on it (call the Town, visit the site).
- **Plain-English glossary** — hover any underlined term ("Highway User Revenue," "Constant Yield Rate") for a jargon-free explanation.
- **Print / Save as PDF** and a shareable social-preview card — so it works on paper and looks clean when posted to a neighborhood group.
- **Accessible by design** — screen-reader announcements, reduced-motion support, keyboard navigation.

## How the AI works — and why it's free

The standout feature is "Ask the Budget," and it's powered by Claude. But a tool that called a paid AI API on every question would hand a small town a recurring bill it can't sustain. So the AI runs in two modes:

1. **Pre-built intelligence (default, $0 forever).** Claude generated a plain-English explainer for every line item and a library of answered resident questions *at build time*, baked into static data. Serving them is instant, offline-capable, and free. Every AI-written sentence traces back to a real number in the budget.
2. **Live AI (optional, bring-your-own-key).** Anyone with an Anthropic API key can flip on live mode for real-time Q&A on any question. The key is used only in their browser and never stored.

Engineering around the "no per-request budget" constraint — the same constraint nonprofits and small governments live with — *is* the point, not a workaround. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Built with deliberate constraints

- **No build step, no framework, no dependencies.** Plain HTML/CSS/JS. A town staffer can host it on free static hosting forever.
- **No third-party requests, no tracking, no accounts.** A civic tool shouldn't surveil the residents it serves. (The only outbound call that ever happens is the optional live-AI request the user explicitly turns on.)
- **Every number is traceable.** Totals come verbatim from the budget's Combined Budget Summary; a reproducible script ([`scripts/extract_budget.py`](scripts/extract_budget.py)) re-derives them from the source PDF and checks that they reconcile.

## Project structure

```
.
├── index.html              # the app
├── styles.css
├── app.js                  # rendering, charts, Ask-the-Budget, calculator, glossary
├── data/
│   ├── budget.json         # structured FY2026 budget (the facts)
│   ├── intelligence.json   # Claude-generated explainers & answered questions
│   ├── glossary.json       # plain-English term definitions
│   └── raw/                # the original source PDFs
├── scripts/
│   └── extract_budget.py   # PDF → JSON, with integrity checks
└── docs/
    ├── ARCHITECTURE.md     # the free-AI design and why
    └── METHODOLOGY.md      # how the data was sourced & verified
```

## Run it locally

No install needed beyond Python (for a tiny local file server):

```bash
git clone <your-repo-url>
cd sykesville-budget-explorer
python3 -m http.server 8000
# open http://localhost:8000
```

To re-derive the summary figures from the source PDF:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 scripts/extract_budget.py        # prints integrity checks, writes data/budget.summary.json
python3 scripts/make_social_card.py      # regenerates assets/social-card.png from the budget data
```

## Deploy

Free, on GitHub Pages:

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**, branch `main`, folder `/ (root)`.
3. Wait ~1 minute; your tool is live at `https://<username>.github.io/<repo>/`.
4. Put that URL at the top of this README.

## Accuracy & honesty

Figures come from the Town's **draft** FY2026 budget (dated May 12, 2025) and may change on adoption. This is an independent civic project, not an official Town of Sykesville website. The plain-English explanations are AI-generated to *explain* the official numbers — they never invent them.

---

*Built by a Sykesville resident who thinks people deserve to understand how their own town spends their money. Made with [Claude](https://claude.ai).*
