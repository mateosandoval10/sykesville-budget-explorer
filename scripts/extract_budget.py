#!/usr/bin/env python3
"""
extract_budget.py — Sykesville Budget Explorer ETL

Parses the Town of Sykesville's official FY2026 budget PDF into structured JSON,
reading the authoritative "Combined Budget Summary" table (page 16) so that every
top-level figure in the app is traceable to a single official source.

The richer sub-item decomposition and the plain-English "intelligence layer"
(data/intelligence.json) are curated from the budget's narrative pages with Claude;
this script handles the deterministic, machine-checkable part: the summary totals.

Usage:
    python3 scripts/extract_budget.py \
        --pdf data/raw/sykesville-fy2026-budget.pdf \
        --out data/budget.summary.json

Dependencies: pdfplumber  (pip install pdfplumber)
"""

import argparse
import json
import re
import sys

SOURCE_URL = "https://www.townofsykesville.gov/DocumentCenter/View/4477/DRAFT-FY2026-Budget-Book"
LINE_RE = re.compile(r"^(.*?)\s+\$?([\d,]+)\s*$")


def find_summary_page(pdf):
    """Return (page_index, text) of the Combined Budget Summary page.

    Require the actual totals to be present so we don't match the
    Table of Contents entry ("Combined Budget Summary ... 16").
    """
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ""
        up = text.upper()
        if "COMBINED BUDGET SUMMARY" in up and "TOTAL REVENUES" in up and "TOTAL EXPENDITURES" in up:
            return i, text
    raise SystemExit("Could not find the Combined Budget Summary page in the PDF.")


def parse_section(lines, start_label, end_label):
    """Parse 'Name   1,234,567' rows between a start and end label."""
    items, total, capturing = [], None, False
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if start_label.lower() in line.lower():
            capturing = True
            continue
        if capturing and end_label.lower() in line.lower():
            m = LINE_RE.match(line)
            if m:
                total = int(m.group(2).replace(",", ""))
            break
        if capturing:
            m = LINE_RE.match(line)
            if m:
                name = m.group(1).strip()
                amount = int(m.group(2).replace(",", ""))
                items.append({"name": name, "amount": amount})
    return items, total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", default="data/raw/sykesville-fy2026-budget.pdf")
    ap.add_argument("--out", default="data/budget.summary.json")
    args = ap.parse_args()

    try:
        import pdfplumber
    except ImportError:
        sys.exit("pdfplumber is required: pip install pdfplumber")

    with pdfplumber.open(args.pdf) as pdf:
        page_idx, text = find_summary_page(pdf)

    lines = text.splitlines()
    revenues, rev_total = parse_section(lines, "Revenues:", "Total Revenues")
    expenditures, exp_total = parse_section(lines, "Expenditures:", "Total Expenditures")

    # Integrity checks — the whole point of a transparency tool is that the numbers tie out.
    rev_sum = sum(i["amount"] for i in revenues)
    exp_sum = sum(i["amount"] for i in expenditures)
    checks = {
        "revenue_lines_sum_to_total": rev_sum == rev_total,
        "expenditure_lines_sum_to_total": exp_sum == exp_total,
        "budget_is_balanced": rev_total == exp_total,
    }

    result = {
        "meta": {
            "town": "Town of Sykesville, Maryland",
            "fiscal_year": "FY2026",
            "source_document": "Town of Sykesville Annual Budget Document FY 2026 (Draft)",
            "source_url": SOURCE_URL,
            "source_table": f"Combined Budget Summary (PDF page {page_idx + 1})",
        },
        "revenues": {"items": revenues, "total": rev_total},
        "expenditures": {"items": expenditures, "total": exp_total},
        "integrity_checks": checks,
    }

    with open(args.out, "w") as f:
        json.dump(result, f, indent=2)

    print(f"Parsed page {page_idx + 1}: {len(revenues)} revenue lines, {len(expenditures)} expenditure lines.")
    print(f"Revenues total:     ${rev_total:,}  (lines sum ${rev_sum:,})")
    print(f"Expenditures total: ${exp_total:,}  (lines sum ${exp_sum:,})")
    for name, ok in checks.items():
        print(f"  [{'OK' if ok else 'FAIL'}] {name}")
    print(f"Wrote {args.out}")
    if not all(checks.values()):
        sys.exit("Integrity check failed — figures do not reconcile.")


if __name__ == "__main__":
    main()
