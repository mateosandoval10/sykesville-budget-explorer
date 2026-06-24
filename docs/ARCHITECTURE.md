# Architecture — Sykesville Budget Explorer

> How the tool delivers AI-powered budget understanding to residents **for $0/month**, in a way a small town can sustain forever.

## The problem this design solves

A naive version of this tool would call a paid LLM API every time a resident asks a question. For a town of ~4,000 people that might field thousands of questions, that's a recurring bill nobody budgeted for — and the tool quietly dies when the free credits run out. The whole point is civic infrastructure that *lasts*, so the architecture is built around a hard constraint: **no per-request cost, no backend server, no API key required to use it.**

This mirrors the real constraint nonprofits and small governments live with — and engineering around it is the point, not a workaround.

## The three layers

### 1. Data layer — the facts (`data/budget.json`)
The real Town of Sykesville FY2026 budget, parsed from the official PDF into clean, structured JSON: every revenue source and expenditure category, multi-year figures for trends, per-capita and per-household derivations, and provenance (which document and page each number came from). This layer contains **only verifiable numbers from official sources** — no AI, no estimates.

### 2. Intelligence layer — the understanding (`data/intelligence.json`)
This is where Claude does its work — **at build time, not at runtime.** Using the Claude session that built this project, we pre-generate:
- a plain-English explainer for every line item,
- "what changed and why" narratives across fiscal years,
- a library of answered resident questions ("How much goes to police vs. parks?", "Why might my taxes go up even if the rate didn't?"), each grounded in specific line items,
- per-capita / "your share" framings.

Because this is generated once and baked into static JSON, **serving it to a resident costs nothing and is instant.** Every AI-written sentence is traceable to the underlying numbers in the data layer.

### 3. Presentation layer — the experience (`index.html`, `app.js`, `styles.css`)
A static single-page app: interactive revenue/expenditure charts, a "where does my tax dollar go?" personal calculator, jargon tooltips powered by `glossary.json`, and an **"Ask the Budget"** box that answers from the pre-built question library instantly and offline.

## The "live AI" toggle (bring-your-own-key)

For anyone who *does* have an Anthropic API key — including a reviewer evaluating this project — an optional **🔑 Live AI** toggle enables true real-time Q&A. The key is entered in the browser, used directly from the browser for that session, and **never stored, logged, or committed.** This demonstrates the live capability without imposing any cost on the town or on most visitors.

| Mode | Who it's for | Cost | Default |
| --- | --- | --- | --- |
| Pre-built intelligence | Every resident | $0 | ✅ on |
| Live AI (BYO key) | Reviewers / power users | Their own key | optional |

## Why no build step / no framework

The app is plain HTML/CSS/JS with charts from a CDN — **no Node toolchain, no compilation.** A town staffer can host it on free static hosting (GitHub Pages) by committing files, and it will keep working for years with zero maintenance. Choosing boring, durable technology *is* the engineering decision here: the tool has to outlive the person who built it.

## Data flow

```
Official Sykesville FY2026 Budget PDF (townofsykesville.gov)
        │
        ▼   scripts/extract_budget.py  (PDF → structured JSON, with page-level provenance)
   data/budget.json   ───────────────┐
        │                            │
        ▼   (Claude, at build time)  │
   data/intelligence.json            │
        │                            │
        ▼                            ▼
   index.html + app.js  ◀── reads ── data/glossary.json
        │
        ▼
   GitHub Pages (static, free)  ──▶  Residents
```

## Honesty & trust principles

- **Every number traces to an official source.** The data layer records the source document and page for each figure.
- **AI explanations are labeled as such** and never invent numbers — they explain the real ones.
- **No tracking, no accounts, no data collection.** A civic tool should not surveil the residents it serves.
