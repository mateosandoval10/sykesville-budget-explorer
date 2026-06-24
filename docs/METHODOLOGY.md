# Methodology — how the data was sourced and verified

The credibility of a budget-transparency tool rests entirely on its numbers being right and traceable. Here's exactly where every figure comes from and how it's checked.

## 1. Source documents

All figures come from official, public documents:

| Document | Used for | Link |
| --- | --- | --- |
| Town of Sykesville FY2026 Annual Budget (Draft, May 12 2025) | All revenue, expenditure, capital, reserve, and tax-rate figures | [PDF](https://www.townofsykesville.gov/DocumentCenter/View/4477/DRAFT-FY2026-Budget-Book) |
| U.S. Census Bureau, 2020 Decennial Census | Population (4,316) and households (1,648) for per-capita framing | [Census](https://www.census.gov/) |

The raw PDFs are kept in [`data/raw/`](../data/raw/) so anyone can check the tool against the original.

## 2. The authoritative table

The Town's budget contains many tables, but the **Combined Budget Summary on page 16** is the official roll-up: six revenue categories and sixteen expenditure lines, each summing to the same **$6,872,516** balanced total. That table is the backbone of the tool.

[`scripts/extract_budget.py`](../scripts/extract_budget.py) parses page 16 directly from the PDF and runs three integrity checks:

```
Parsed page 16: 6 revenue lines, 16 expenditure lines.
Revenues total:     $6,872,516  (lines sum $6,872,516)
Expenditures total: $6,872,516  (lines sum $6,872,516)
  [OK] revenue_lines_sum_to_total
  [OK] expenditure_lines_sum_to_total
  [OK] budget_is_balanced
```

If any figure were mistyped, the sums wouldn't reconcile and the script would exit with an error.

## 3. Decomposing the opaque buckets

The official summary is accurate but not always *legible*. Two categories are large catch-alls:

- **Other Sources — $2,677,250 (39% of revenue).** Shown as one line on page 16, this is actually mostly one-time money. Using the budget narrative (pp. 11–12), it's decomposed into Federal Recovery Funds ($1.2M), capital grants ($960K), reserves drawn down ($360K), and interest income ($157K).
- **Intergovernmental — $1,928,575.** Decomposed using pp. 10–11 into the local income-tax share ($1.24M), state police aid ($352K), and Highway User Revenue ($327K).

Where a narrative decomposition doesn't tie *exactly* to the page-16 total, a small explicit reconciling line is added and labeled as such in [`data/budget.json`](../data/budget.json). Nothing is hidden; the parts always sum to the official whole.

## 4. The "intelligence layer"

The plain-English explainers, year-over-year narratives, and answered questions in [`data/intelligence.json`](../data/intelligence.json) were generated with Claude at build time. Each answer is grounded in — and only in — the figures in `budget.json`. The glossary ([`data/glossary.json`](../data/glossary.json)) reflects standard Maryland municipal-finance conventions (fiscal year July 1–June 30; tax rates per $100 of assessed value).

## 5. Known limitations

- The budget is a **draft**; adopted figures may differ slightly. The tool labels this clearly.
- Per-capita and per-household figures use 2020 Census counts, the most recent official decennial data.
- "Other property tax" (~$45K) and "Other intergovernmental" (~$5K) are reconciling lines for the difference between the page-16 summary totals and the specific figures named in the narrative.
