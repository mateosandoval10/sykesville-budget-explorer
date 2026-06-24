#!/usr/bin/env python3
"""
make_social_card.py — generate the Open Graph / Twitter social preview image.

Produces assets/social-card.png (1200x630), the card shown when the live URL is
shared on Facebook, iMessage, or X. Numbers are pulled from data/budget.json so
the card never drifts from the real budget.

Usage:  python3 scripts/make_social_card.py
Dependencies: pillow  (pip install pillow)
"""

import json
import os

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
PRIMARY = (21, 82, 122)
PRIMARY_DARK = (15, 60, 90)
WHITE = (255, 255, 255)
SUBTLE = (200, 218, 232)
GREEN = (120, 200, 160)

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
BOLD_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(candidates, size):
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def short(n):
    if abs(n) >= 1e6:
        return "$" + ("%.2f" % (n / 1e6)).rstrip("0").rstrip(".") + "M"
    if abs(n) >= 1e3:
        return "$" + str(round(n / 1e3)) + "K"
    return "$" + str(round(n))


def main():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    budget = json.load(open(os.path.join(here, "data", "budget.json")))
    h = budget["headline"]
    pop = budget["meta"]["population"]
    per_resident = round(h["total_budget"] / pop)

    img = Image.new("RGB", (W, H), PRIMARY)
    d = ImageDraw.Draw(img)
    for y in range(H):  # vertical gradient
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(round(PRIMARY[i] + (PRIMARY_DARK[i] - PRIMARY[i]) * t) for i in range(3)))

    pad = 80
    d.text((pad, 86), "SYKESVILLE BUDGET EXPLORER", font=load_font(BOLD_CANDIDATES, 30), fill=SUBTLE)
    d.text((pad, 138), "Where your town's", font=load_font(BOLD_CANDIDATES, 76), fill=WHITE)
    d.text((pad, 220), "money goes.", font=load_font(BOLD_CANDIDATES, 76), fill=WHITE)
    d.text((pad, 326), "The Town of Sykesville's FY2026 budget — in plain English.",
           font=load_font(FONT_CANDIDATES, 32), fill=SUBTLE)

    # stat strip
    stats = [
        (short(h["total_budget"]), "total budget"),
        ("$" + format(per_resident, ","), "per resident"),
        ("$%.2f" % h["property_tax_rate"], "tax rate /$100"),
        ("$0", "long-term debt"),
    ]
    box_w, gap, y0 = 230, 18, 430
    num_font, lbl_font = load_font(BOLD_CANDIDATES, 46), load_font(FONT_CANDIDATES, 24)
    for i, (num, lbl) in enumerate(stats):
        x = pad + i * (box_w + gap)
        d.rounded_rectangle([x, y0, x + box_w, y0 + 110], radius=14, fill=None, outline=(110, 150, 178), width=2)
        d.text((x + 20, y0 + 18), num, font=num_font, fill=GREEN if i == 3 else WHITE)
        d.text((x + 20, y0 + 72), lbl, font=lbl_font, fill=SUBTLE)

    d.text((pad, 588), "Independent civic-transparency project · Built with Claude",
           font=load_font(FONT_CANDIDATES, 22), fill=(150, 175, 195))

    out_dir = os.path.join(here, "assets")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "social-card.png")
    img.save(out, "PNG")
    print("Wrote", out, img.size)


if __name__ == "__main__":
    main()
