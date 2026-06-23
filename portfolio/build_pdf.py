#!/usr/bin/env python3
"""Build a downloadable PDF from the Exodus Tunisia catalogue Markdown."""
import os
import markdown
from weasyprint import HTML

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "exodus-tunisia-portfolio.md")
OUT = os.path.join(HERE, "Depart-Travel-Tunisia-Catalogue.pdf")

with open(SRC, encoding="utf-8") as f:
    text = f.read()

html_body = markdown.markdown(
    text, extensions=["tables", "fenced_code", "sane_lists", "nl2br"]
)

CSS = """
@page { size: A4; margin: 18mm 16mm; @bottom-center {
    content: "Depart Travel Services  ·  Tunisia Catalogue for Exodus Adventure Travels  ·  page " counter(page);
    font-size: 8pt; color: #888; } }
body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt;
    line-height: 1.5; color: #222; }
h1 { font-size: 22pt; color: #b5562a; border-bottom: 3px solid #b5562a;
    padding-bottom: 6px; page-break-after: avoid; }
h2 { font-size: 15pt; color: #8a4220; margin-top: 1.4em; page-break-after: avoid; }
h3 { font-size: 12.5pt; color: #555; page-break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9pt;
    page-break-inside: avoid; }
th, td { border: 1px solid #ddd; padding: 5px 7px; text-align: left;
    vertical-align: top; }
th { background: #f4e9e1; color: #8a4220; }
tr:nth-child(even) td { background: #faf6f2; }
img { max-width: 100%; max-height: 95mm; border-radius: 4px; margin: 6px 0;
    page-break-inside: avoid; }
blockquote { border-left: 4px solid #b5562a; background: #faf3ee; margin: 10px 0;
    padding: 6px 14px; color: #5a3a28; }
hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
code { background: #f2f2f2; padding: 1px 4px; border-radius: 3px; font-size: 9pt; }
a { color: #b5562a; text-decoration: none; }
strong { color: #222; }
"""

full = f"<!DOCTYPE html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{html_body}</body></html>"

HTML(string=full, base_url=HERE).write_pdf(OUT)
print("Wrote", OUT)
