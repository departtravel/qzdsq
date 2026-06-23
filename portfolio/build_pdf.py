#!/usr/bin/env python3
"""Build downloadable PDFs from the Tunisia catalogue Markdown files."""
import os
import markdown
from weasyprint import HTML

HERE = os.path.dirname(os.path.abspath(__file__))

# (source markdown, output pdf, footer label, cover image, cover title, cover subtitle)
DOCS = [
    ("exodus-tunisia-portfolio.md",
     "Depart-Travel-Tunisia-Catalogue.pdf",
     "Tunisia Catalogue for Exodus Adventure Travels",
     "images/mountain-oasis.jpg",
     "TUNISIA",
     "Product Catalogue for Exodus Adventure Travels"),
    ("exodus-style-product-pages.md",
     "Depart-Travel-Tunisia-Product-Pages.pdf",
     "Tunisia Product Pages for Exodus Adventure Travels",
     "images/sidi-bou-said.jpg",
     "TUNISIA",
     "Grand Tunisia Journey (12 days) · Highlights of Tunisia (8 days)"),
    ("highlights-of-tunisia-8day.md",
     "Depart-Travel-Highlights-of-Tunisia-8day.pdf",
     "Highlights of Tunisia (8 days) — for Exodus Adventure Travels",
     "images/dougga.webp",
     "HIGHLIGHTS OF TUNISIA",
     "A short cultural week · 8 days — proposed for Exodus Adventure Travels"),
]

CSS_TEMPLATE = """
@page {{ size: A4; margin: 18mm 16mm; @bottom-center {{
    content: "Depart Travel Services  ·  {label}  ·  page " counter(page);
    font-size: 8pt; color: #888; }} }}
body {{ font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt;
    line-height: 1.5; color: #222; }}
h1 {{ font-size: 22pt; color: #b5562a; border-bottom: 3px solid #b5562a;
    padding-bottom: 6px; page-break-after: avoid; }}
h2 {{ font-size: 15pt; color: #8a4220; margin-top: 1.4em; page-break-after: avoid; }}
h3 {{ font-size: 12.5pt; color: #555; page-break-after: avoid; }}
table {{ border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9pt;
    page-break-inside: avoid; }}
th, td {{ border: 1px solid #ddd; padding: 5px 7px; text-align: left;
    vertical-align: top; }}
th {{ background: #f4e9e1; color: #8a4220; }}
tr:nth-child(even) td {{ background: #faf6f2; }}
img {{ display: block; margin: 10px auto; width: 150mm; height: 90mm;
    object-fit: cover; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.18);
    page-break-inside: avoid; }}
blockquote {{ border-left: 4px solid #b5562a; background: #faf3ee; margin: 10px 0;
    padding: 6px 14px; color: #5a3a28; }}
hr {{ border: none; border-top: 1px solid #ddd; margin: 16px 0; }}
code {{ background: #f2f2f2; padding: 1px 4px; border-radius: 3px; font-size: 9pt; }}
a {{ color: #b5562a; text-decoration: none; }}
strong {{ color: #222; }}
@page cover {{ size: A4; margin: 0; }}
.cover {{ page: cover; page-break-after: always; width: 210mm; height: 297mm;
    background-image: linear-gradient(rgba(0,0,0,0.05), rgba(60,25,10,0.78)), url("{cover}");
    background-size: cover; background-position: center; position: relative; }}
.cover .band {{ position: absolute; left: 0; right: 0; bottom: 0; padding: 22mm 20mm 24mm;
    color: #fff; }}
.cover .kicker {{ font-size: 11pt; letter-spacing: 5px; text-transform: uppercase;
    color: #f0d8c8; margin-bottom: 6mm; }}
.cover h1.ct {{ font-size: 52pt; color: #fff; border: none; margin: 0 0 5mm;
    letter-spacing: 3px; padding: 0; }}
.cover .sub {{ font-size: 15pt; color: #fbeee6; max-width: 150mm; line-height: 1.35; }}
.cover .brand {{ position: absolute; top: 18mm; left: 20mm; color: #fff;
    font-size: 13pt; letter-spacing: 2px; }}
"""

for src, out, label, cover, ctitle, csub in DOCS:
    with open(os.path.join(HERE, src), encoding="utf-8") as f:
        text = f.read()
    html_body = markdown.markdown(
        text, extensions=["tables", "fenced_code", "sane_lists", "nl2br"]
    )
    css = CSS_TEMPLATE.format(label=label, cover=cover)
    cover_html = (
        f'<div class="cover"><div class="brand">DEPART TRAVEL SERVICES</div>'
        f'<div class="band"><div class="kicker">Depart Travel Services · Tunisia</div>'
        f'<h1 class="ct">{ctitle}</h1><div class="sub">{csub}</div></div></div>'
    )
    full = (f"<!DOCTYPE html><html><head><meta charset='utf-8'>"
            f"<style>{css}</style></head><body>{cover_html}{html_body}</body></html>")
    HTML(string=full, base_url=HERE).write_pdf(os.path.join(HERE, out))
    print("Wrote", out)
