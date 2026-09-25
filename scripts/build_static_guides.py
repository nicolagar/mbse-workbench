#!/usr/bin/env python3
"""Refresh the three static guides while preserving their established content.

The existing guide PDFs remain the visual/content baseline. This script replaces
their cover with the current one-page introduction and appends the maintained
Architect/Modeler answer reference with PDF bookmarks and an internal index.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "tmp" / "pdfs" / "originals"
WORK_DIR = ROOT / "tmp" / "pdfs" / "generated"
OUTPUT_DIR = ROOT / "output" / "pdf"
REPO_GUIDE_DIR = ROOT / "docs" / "guides"
MARKDOWN = ROOT / "docs" / "user-guides" / "ARCHITECT_MODELER_GUIDE.md"

NAVY = colors.HexColor("#122238")
BLUE = colors.HexColor("#2563EB")
TEAL = colors.HexColor("#0E7490")
SLATE = colors.HexColor("#475569")
LIGHT = colors.HexColor("#EFF6FF")
LINE = colors.HexColor("#CBD5E1")

GUIDES = {
    "MBSE_MBPLE_Workbench_First_Use_Guide_With_Clickable_Index.pdf": {
        "title": "First Use Guide",
        "subtitle": "Build, simulate and compare MBSE / MBPLE models step by step",
        "audience": "For domain experts who are new to the website, MBSE and MBPLE.",
        "appendix": "Architect and Modeler answer handbook - first-use edition",
    },
    "MBSE_MBPLE_Workbench_Expert_Use_Guide_With_Clickable_Index.pdf": {
        "title": "Expert Use Guide",
        "subtitle": "Operational semantics, completion predicates and evidence flow",
        "audience": "For practitioners with MBSE / MBPLE knowledge.",
        "appendix": "Architect and Modeler answer handbook - expert edition",
    },
    "MBSE_MBPLE_Workbench_Full_Guide_Hierarchical_Index.pdf": {
        "title": "Full Guide",
        "subtitle": "Every menu, field, formula, model activity and analysis path",
        "audience": "Complete reference for the current Architect and Modeler perspectives.",
        "appendix": "Part XIII - Architect and Modeler answer handbook",
    },
}


def clean(text: str) -> str:
    """Keep generated PDFs ASCII-safe while retaining readable semantics."""
    replacements = {
        "\u2013": "-", "\u2014": "-", "\u2212": "-", "\u2192": "->", "\u2190": "<-",
        "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u2264": "<=",
        "\u2265": ">=", "\u00b7": " - ", "\u2026": "...", "\u00a0": " ",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text.encode("ascii", "replace").decode("ascii")


def inline(text: str) -> str:
    text = clean(text.strip())
    text = re.sub(r"`([^`]+)`", r"<font name='Courier'>\1</font>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = text.replace("&", "&amp;").replace("<b>", "@@B@@").replace("</b>", "@@/B@@")
    text = text.replace("<font name='Courier'>", "@@C@@").replace("</font>", "@@/C@@")
    text = text.replace("<", "&lt;").replace(">", "&gt;")
    return (text.replace("@@B@@", "<b>").replace("@@/B@@", "</b>")
                .replace("@@C@@", "<font name='Courier'>").replace("@@/C@@", "</font>"))


def slug(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", clean(text).lower()).strip("-")
    return value[:90] or "section"


def make_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("TitleX", parent=base["Title"], fontName="Helvetica-Bold", fontSize=25, leading=29, textColor=colors.white, alignment=TA_LEFT, spaceAfter=5 * mm),
        "subtitle": ParagraphStyle("SubtitleX", parent=base["Normal"], fontName="Helvetica", fontSize=11, leading=15, textColor=colors.white),
        "cover_body": ParagraphStyle("CoverBody", parent=base["BodyText"], fontName="Helvetica", fontSize=9.2, leading=13, textColor=NAVY),
        "cover_small": ParagraphStyle("CoverSmall", parent=base["BodyText"], fontName="Helvetica", fontSize=7.7, leading=11, textColor=SLATE),
        "h1": ParagraphStyle("H1X", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=NAVY, spaceAfter=4 * mm, keepWithNext=True),
        "h2": ParagraphStyle("H2X", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=14, leading=17, textColor=BLUE, spaceBefore=3 * mm, spaceAfter=2 * mm, keepWithNext=True),
        "h3": ParagraphStyle("H3X", parent=base["Heading3"], fontName="Helvetica-Bold", fontSize=10.5, leading=13, textColor=NAVY, spaceBefore=3 * mm, spaceAfter=1.5 * mm, keepWithNext=True),
        "body": ParagraphStyle("BodyX", parent=base["BodyText"], fontName="Helvetica", fontSize=8.2, leading=11.2, textColor=colors.HexColor("#1E293B"), spaceAfter=2 * mm),
        "bullet": ParagraphStyle("BulletX", parent=base["BodyText"], fontName="Helvetica", fontSize=8, leading=10.8, leftIndent=4 * mm, firstLineIndent=-2.5 * mm, bulletIndent=0, textColor=colors.HexColor("#1E293B"), spaceAfter=1.2 * mm),
        "toc": ParagraphStyle("TocX", parent=base["BodyText"], fontName="Helvetica", fontSize=8.4, leading=12, leftIndent=4 * mm, textColor=BLUE, spaceAfter=1.5 * mm),
        "table": ParagraphStyle("TableX", parent=base["BodyText"], fontName="Helvetica", fontSize=7.1, leading=9.2, textColor=colors.HexColor("#1E293B")),
        "table_head": ParagraphStyle("TableHeadX", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=7.1, leading=9, textColor=colors.white),
    }


STYLES = make_styles()


class BookmarkDocTemplate(BaseDocTemplate):
    def afterFlowable(self, flowable):
        key = getattr(flowable, "_bookmark_name", None)
        level = getattr(flowable, "_bookmark_level", None)
        title = getattr(flowable, "_bookmark_title", None)
        if key is not None and level is not None and title:
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(clean(title), key, level=level, closed=level < 1)


def header_footer(canvas, doc, short_title: str):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, 281 * mm, 192 * mm, 281 * mm)
    canvas.setFont("Helvetica", 6.5)
    canvas.setFillColor(SLATE)
    canvas.drawString(18 * mm, 284 * mm, f"MBSE / MBPLE Workbench - {short_title}")
    canvas.drawRightString(192 * mm, 284 * mm, "Workflow v1.5.3 - schema 9")
    canvas.line(18 * mm, 15 * mm, 192 * mm, 15 * mm)
    canvas.drawString(18 * mm, 10 * mm, "03_Architect_view_v01 documentation update - 4 September 2026")
    canvas.drawRightString(192 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def heading(text: str, level: int) -> Paragraph:
    key = slug(text)
    style = STYLES["h1" if level == 0 else "h2" if level == 1 else "h3"]
    p = Paragraph(f"<a name='{key}'/>{inline(text)}", style)
    p._bookmark_name = key
    p._bookmark_level = level
    p._bookmark_title = text
    return p


def parse_markdown_sections() -> list[tuple[str, list[object]]]:
    lines = MARKDOWN.read_text(encoding="utf-8").splitlines()
    start = next(i for i, line in enumerate(lines) if line.startswith("## How to answer Architect questions"))
    lines = lines[start:]
    sections: list[tuple[str, list[object]]] = []
    current_title = "Architect and Modeler answer handbook"
    current: list[object] = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if line.startswith("## "):
            if current:
                sections.append((current_title, current))
            current_title = line[3:].strip()
            current = []
        elif line.startswith("### "):
            current.append(("heading", line[4:].strip()))
        elif line.startswith("| "):
            table_lines = []
            while i < len(lines) and lines[i].startswith("|"):
                table_lines.append(lines[i])
                i += 1
            rows = [[cell.strip() for cell in row.strip().strip("|").split("|")] for row in table_lines]
            if len(rows) >= 2 and all(re.fullmatch(r"[-: ]+", cell) for cell in rows[1]):
                rows.pop(1)
            current.append(("table", rows))
            i -= 1
        elif line.startswith("- "):
            current.append(("bullet", line[2:].strip()))
        elif line and not line.startswith("#"):
            current.append(("paragraph", line))
        i += 1
    if current:
        sections.append((current_title, current))
    return sections


def build_cover(path: Path, cfg: dict[str, str]):
    from reportlab.pdfgen import canvas as canvas_module

    c = canvas_module.Canvas(str(path), pagesize=A4)
    width, height = A4
    c.setFillColor(colors.white)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.roundRect(18 * mm, 206 * mm, 174 * mm, 63 * mm, 5 * mm, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.circle(174 * mm, 260 * mm, 10 * mm, fill=1, stroke=0)
    c.setFillColor(TEAL)
    c.circle(159 * mm, 213 * mm, 6 * mm, fill=1, stroke=0)
    frame = Frame(25 * mm, 216 * mm, 148 * mm, 42 * mm, showBoundary=0)
    story = [Paragraph(clean(cfg["title"]), STYLES["title"]), Paragraph(clean(cfg["subtitle"]), STYLES["subtitle"])]
    frame.addFromList(story, c)

    y = 194 * mm
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(BLUE)
    c.drawString(18 * mm, y, "What this workbench does")
    y -= 8 * mm
    body = (
        "It turns a mission into a connected early engineering model: stakeholder needs and objectives lead to "
        "requirements; functions and components describe the solution; parameters, verification and simulations "
        "provide evidence; configurable alternatives can be compared and approved. It supports preliminary "
        "programme and architecture work, not certified detailed-design analysis."
    )
    f = Frame(18 * mm, 157 * mm, 174 * mm, 29 * mm, showBoundary=0)
    f.addFromList([Paragraph(body, STYLES["cover_body"])], c)

    c.setFillColor(LIGHT)
    c.roundRect(18 * mm, 104 * mm, 174 * mm, 46 * mm, 3 * mm, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(23 * mm, 140 * mm, "Two synchronized ways to work")
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(BLUE)
    c.drawString(23 * mm, 130 * mm, "Architect view")
    c.setFillColor(SLATE)
    c.setFont("Helvetica", 8)
    architect = "One guided question at a time, with answer guidance, examples, progress and readiness."
    c.drawString(54 * mm, 130 * mm, architect)
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(TEAL)
    c.drawString(23 * mm, 118 * mm, "Modeler view")
    c.setFillColor(SLATE)
    c.setFont("Helvetica", 8)
    modeler = "Dashboard plus direct tables, graphs, matrices, formulas, variability, analysis and delivery."
    c.drawString(54 * mm, 118 * mm, modeler)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 8.3)
    c.drawString(23 * mm, 108 * mm, "Both views update the same canonical project; switching never creates a second model.")

    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(BLUE)
    c.drawString(18 * mm, 92 * mm, "Choose a scope")
    rows = [
        ["Architecture definition", "Traceable product and industrial-system architecture"],
        ["Architecture and simulation", "Architecture plus KPI evidence for the current model"],
        ["Trade-off", "Configurable 100% alternatives, comparable runs and a decision"],
    ]
    table = Table([[Paragraph(f"<b>{a}</b>", STYLES["table"]), Paragraph(b, STYLES["table"])] for a, b in rows], colWidths=[55 * mm, 111 * mm])
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, LINE), ("BACKGROUND", (0, 0), (0, -1), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    table.wrapOn(c, width, height)
    table.drawOn(c, 22 * mm, 55 * mm)

    c.setFont("Helvetica", 7.5)
    c.setFillColor(SLATE)
    c.drawString(18 * mm, 40 * mm, clean(cfg["audience"]))
    c.drawString(18 * mm, 35 * mm, "Current branch: 03_Architect_view_v01 - application v1.5.3 - schema 9")
    c.drawString(18 * mm, 30 * mm, "Guide refreshed 4 September 2026. The introduction occupies this single page.")
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(18 * mm, 20 * mm, "Continue with the existing guide, then use the appended answer handbook for every Architect question group.")
    c.save()


def build_supplement(path: Path, cfg: dict[str, str]):
    doc = BookmarkDocTemplate(str(path), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=19 * mm, bottomMargin=19 * mm)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=lambda c, d: header_footer(c, d, cfg["title"]))])

    sections = parse_markdown_sections()
    story: list[object] = [heading(cfg["appendix"], 0)]
    story.append(Paragraph(
        "This branch-accurate handbook supplements the established guide. It explains what an unfamiliar user should enter, "
        "what the answer creates or changes, and when a question is review-only. Dynamic questions repeat for each item in the project.",
        STYLES["body"],
    ))
    story.append(Spacer(1, 2 * mm))
    story.append(heading("Handbook index", 1))
    for section_title, items in sections:
        story.append(Paragraph(f"<a href='#{slug(section_title)}'>{inline(section_title)}</a>", STYLES["toc"]))
        for kind, value in items:
            if kind == "heading":
                story.append(Paragraph(f"<a href='#{slug(value)}'>- {inline(value)}</a>", STYLES["toc"]))
    story.append(PageBreak())

    for section_title, items in sections:
        story.append(heading(section_title, 1))
        for kind, value in items:
            if kind == "heading":
                story.append(heading(value, 2))
            elif kind == "paragraph":
                story.append(Paragraph(inline(value), STYLES["body"]))
            elif kind == "bullet":
                story.append(Paragraph(inline(value), STYLES["bullet"], bulletText="-"))
            elif kind == "table":
                rows = value
                if not rows:
                    continue
                col_count = max(len(row) for row in rows)
                normalized = [row + [""] * (col_count - len(row)) for row in rows]
                data = []
                for row_index, row in enumerate(normalized):
                    style = STYLES["table_head"] if row_index == 0 else STYLES["table"]
                    data.append([Paragraph(inline(cell), style) for cell in row])
                if col_count == 3:
                    widths = [41 * mm, 64 * mm, 69 * mm]
                elif col_count == 2:
                    widths = [55 * mm, 119 * mm]
                else:
                    widths = [174 * mm / col_count] * col_count
                table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
                table.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 3.5), ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
                    ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]))
                story.extend([table, Spacer(1, 2 * mm)])
    doc.build(story)


def merge_guide(name: str, cfg: dict[str, str]):
    source = SOURCE_DIR / name
    if not source.exists():
        raise FileNotFoundError(source)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    REPO_GUIDE_DIR.mkdir(parents=True, exist_ok=True)
    cover = WORK_DIR / f"cover-{name}"
    supplement = WORK_DIR / f"supplement-{name}"
    build_cover(cover, cfg)
    build_supplement(supplement, cfg)

    base_reader = PdfReader(str(source))
    cover_reader = PdfReader(str(cover))
    supplement_reader = PdfReader(str(supplement))
    writer = PdfWriter()
    writer.clone_document_from_reader(base_reader)
    writer.pages[0].merge_page(cover_reader.pages[0], over=True)
    writer.append(supplement_reader, import_outline=True, outline_item=clean(cfg["appendix"]))
    writer.add_metadata({
        "/Title": clean(cfg["title"] + " - MBSE / MBPLE Workbench"),
        "/Subject": "Workflow v1.5.3 / schema 9 / 03_Architect_view_v01",
        "/Author": "MBSE / MBPLE Workbench",
        "/Keywords": "MBSE MBPLE Architect Modeler user guide",
    })
    out = OUTPUT_DIR / name
    with out.open("wb") as handle:
        writer.write(handle)
    (REPO_GUIDE_DIR / name).write_bytes(out.read_bytes())


def main():
    for name, cfg in GUIDES.items():
        merge_guide(name, cfg)
        print(OUTPUT_DIR / name)


if __name__ == "__main__":
    main()
