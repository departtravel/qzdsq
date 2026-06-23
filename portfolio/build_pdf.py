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
@page {{ size: A4; margin: 20mm 17mm 18mm;
    @top-right {{ content: "DEPART TRAVEL SERVICES"; font-family: Georgia, serif;
        font-size: 7.5pt; letter-spacing: 2px; color: #b08968; }}
    @bottom-center {{
        content: "{label}  ·  page " counter(page);
        font-size: 7.5pt; color: #9a9a9a; letter-spacing: 0.5px; }} }}
body {{ font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt;
    line-height: 1.55; color: #2b2b2b; }}
h1 {{ font-family: Georgia, 'Times New Roman', serif; font-size: 24pt; color: #9c4521;
    margin: 0 0 4mm; padding-bottom: 4mm; border-bottom: 2px solid #d8a24a;
    letter-spacing: 0.5px; page-break-after: avoid; }}
h2 {{ font-family: Georgia, serif; font-size: 15.5pt; color: #9c4521;
    margin: 12mm 0 3mm; padding: 2mm 0 2mm 4mm; border-left: 4px solid #d8a24a;
    background: linear-gradient(90deg, #faf3ec, rgba(250,243,236,0)); page-break-after: avoid; }}
h3 {{ font-family: Georgia, serif; font-size: 12.5pt; color: #6b4a2f;
    margin: 6mm 0 2mm; page-break-after: avoid; }}
p {{ margin: 4px 0; }}
.day {{ background: #f6ece2; border-left: 5px solid #9c4521; border-radius: 4px;
    padding: 5px 12px; margin: 14px 0 6px; page-break-after: avoid;
    page-break-inside: avoid; }}
.day strong {{ font-family: Georgia, serif; font-size: 12pt; color: #9c4521;
    letter-spacing: 0.3px; }}
table {{ border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9pt;
    page-break-inside: avoid; box-shadow: 0 1px 3px rgba(0,0,0,0.07); }}
th, td {{ border: 1px solid #ead9c9; padding: 6px 8px; text-align: left;
    vertical-align: top; }}
th {{ background: #9c4521; color: #fff; font-family: Georgia, serif;
    letter-spacing: 0.3px; border-color: #9c4521; }}
tr:nth-child(even) td {{ background: #faf5ef; }}
img {{ display: block; margin: 8px auto 4px; width: 155mm; height: 88mm;
    object-fit: cover; border-radius: 7px; box-shadow: 0 3px 10px rgba(60,30,10,0.22);
    page-break-inside: avoid; }}
blockquote {{ border-left: 4px solid #d8a24a; background: #faf3ec; margin: 10px 0;
    padding: 8px 16px; color: #5a3a28; border-radius: 0 4px 4px 0; }}
blockquote h3 {{ margin-top: 0; color: #9c4521; }}
hr {{ border: none; border-top: 1px solid #e7d6c4; margin: 14px 0; }}
code {{ background: #f2ece4; padding: 1px 5px; border-radius: 3px; font-size: 9pt; color: #7a4a2a; }}
ul {{ margin: 4px 0 4px 0; }}
li {{ margin: 2px 0; }}
a {{ color: #9c4521; text-decoration: none; }}
strong {{ color: #2b2b2b; }}
em {{ color: #6b4a2f; }}
@page cover {{ size: A4; margin: 0; }}
.cover {{ page: cover; page-break-after: always; width: 210mm; height: 297mm;
    background-image: linear-gradient(rgba(0,0,0,0.10), rgba(55,22,8,0.82)), url("{cover}");
    background-size: cover; background-position: center; position: relative; }}
.cover .band {{ position: absolute; left: 0; right: 0; bottom: 0; padding: 22mm 22mm 26mm;
    color: #fff; }}
.cover .rule {{ width: 26mm; height: 3px; background: #d8a24a; margin-bottom: 8mm; }}
.cover .kicker {{ font-family: Georgia, serif; font-size: 11pt; letter-spacing: 6px;
    text-transform: uppercase; color: #f0d8c8; margin-bottom: 5mm; }}
.cover h1.ct {{ font-family: Georgia, serif; font-size: 50pt; color: #fff; border: none;
    margin: 0 0 5mm; padding: 0; letter-spacing: 2px; line-height: 1.05; }}
.cover .sub {{ font-size: 15pt; color: #fbeee6; max-width: 155mm; line-height: 1.4; }}
.cover .brand {{ position: absolute; top: 20mm; left: 22mm; color: #fff;
    font-family: Georgia, serif; font-size: 13pt; letter-spacing: 3px; }}
.cover .brand img {{ height: 20mm; width: auto; margin: 0; border-radius: 0;
    box-shadow: none; object-fit: contain; display: block; }}
"""

for _logo_candidate in ("images/logo.png", "images/logodts.jpeg", "images/logodts.jpg"):
    if os.path.exists(os.path.join(HERE, _logo_candidate)):
        brand_html = f'<img src="{_logo_candidate}" alt="Depart Travel Services">'
        break
else:
    brand_html = "DEPART TRAVEL SERVICES"

for src, out, label, cover, ctitle, csub in DOCS:
    with open(os.path.join(HERE, src), encoding="utf-8") as f:
        text = f.read()
    html_body = markdown.markdown(
        text, extensions=["tables", "fenced_code", "sane_lists", "nl2br"]
    )
    # style day-by-day entries as accent cards
    html_body = html_body.replace('<p><strong>Day ', '<p class="day"><strong>Day ')
    css = CSS_TEMPLATE.format(label=label, cover=cover)
    cover_html = (
        f'<div class="cover"><div class="brand">{brand_html}</div>'
        f'<div class="band"><div class="rule"></div>'
        f'<div class="kicker">Depart Travel Services · Tunisia</div>'
        f'<h1 class="ct">{ctitle}</h1><div class="sub">{csub}</div></div></div>'
    )
    full = (f"<!DOCTYPE html><html><head><meta charset='utf-8'>"
            f"<style>{css}</style></head><body>{cover_html}{html_body}</body></html>")
    HTML(string=full, base_url=HERE).write_pdf(os.path.join(HERE, out))
    print("Wrote", out)
