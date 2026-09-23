#!/usr/bin/env python3
"""Build the two bitmap fonts the pixel shell ships (GDD-06 §4.8).

    pixel_ui_5       5x7 chrome face, drawn at 5 px  -> UI labels, HUD, stamps
    pixel_body_8     8 px body face                  -> legal text, tips, cards
    pixel_display_10 the 5x7 face at 2x (10 px)      -> menu items (§5.4)

All three are emitted as AngelCode BMFont: a `.fnt` descriptor next to a
white-on-transparent PNG atlas. Browsers cannot use a `.fnt`, so the game parses
the descriptor itself (`web/js/ui/bmfont.js`) and blits atlas cells; no webfont,
TTF or `fillText` is involved anywhere in the build.

Sources (both permissively licensed, notices in `assets/fonts/LICENSES/`):

  * `tools/sources/font_5x7.json` - packed 5x7 glyph table (MIT; see notice).
  * `tools/sources/silkscreen-latin-400-normal.woff2` - Silkscreen (OFL-1.1),
    rasterised once here to an 8 px pixel grid.

Rasterising the 8 px face needs fontTools + brotli:

    python3 -m pip install fonttools brotli

Run:  python3 tools/build_fonts.py [--preview]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Dict, List, Sequence, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.pixel_io import Canvas  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")
WEB = os.path.join(ROOT, "web")
SOURCES = os.path.join(TOOLS, "sources")
OUT_DIR = os.path.join(WEB, "assets", "fonts")

INK = (255, 255, 255, 255)

# Characters the game's strings use that the 5x7 table does not carry. They are
# authored here in the same column-packed form (bit 0 = top row).
EXTRA_5X7: Dict[int, List[int]] = {
    0x007E: [0x08, 0x04, 0x04, 0x08, 0x04],  # ~ tilde
    0x00A7: [0x26, 0x49, 0x49, 0x49, 0x32],  # § section sign
    0x00D7: [0x0A, 0x04, 0x00, 0x04, 0x0A],  # × multiplication sign
    0x2026: [0x40, 0x00, 0x40, 0x00, 0x40],  # … ellipsis
    0x2191: [0x04, 0x02, 0x7F, 0x02, 0x04],  # ↑ arrow up (height advantage)
    0x2193: [0x10, 0x20, 0x7F, 0x20, 0x10],  # ↓ arrow down
    0x2212: [0x08, 0x08, 0x08, 0x08, 0x08],  # − minus
    0x2264: [0x20, 0x20, 0x24, 0x2A, 0x31],  # ≤ less-or-equal
    0x2265: [0x31, 0x2A, 0x24, 0x20, 0x20],  # ≥ greater-or-equal
    0x00B7: [0x00, 0x00, 0x08, 0x00, 0x00],  # · middle dot
    0x2013: [0x00, 0x08, 0x08, 0x08, 0x00],  # – en dash
    0x2014: [0x08, 0x08, 0x08, 0x08, 0x08],  # — em dash
    0x2019: [0x02, 0x03, 0x01, 0x00, 0x00],  # ’ right single quote
    0x201C: [0x02, 0x03, 0x01, 0x03, 0x02],  # “ left double quote
    0x201D: [0x01, 0x03, 0x02, 0x03, 0x01],  # ” right double quote
}

# Character set both fonts must cover: printable ASCII plus the typographic
# marks that appear in the shipped strings.
CHARSET: List[int] = [code for code in range(0x20, 0x7F)] + sorted(EXTRA_5X7)


# --------------------------------------------------------------------------
# glyph data types
# --------------------------------------------------------------------------
class Glyph:
    """A rasterised glyph: `rows[y][x]` booleans plus metrics in pixels."""

    __slots__ = ("rows", "width", "height", "xoffset", "yoffset", "advance",
                 "atlas_x", "atlas_y")

    def __init__(
        self,
        rows: List[List[bool]],
        xoffset: int,
        yoffset: int,
        advance: int,
    ) -> None:
        self.rows = rows
        self.height = len(rows)
        self.width = len(rows[0]) if rows else 0
        self.xoffset = xoffset
        self.yoffset = yoffset
        self.advance = advance
        self.atlas_x = 0
        self.atlas_y = 0

    @property
    def is_empty(self) -> bool:
        return not any(any(row) for row in self.rows)


# --------------------------------------------------------------------------
# source 1: packed 5x7 table
# --------------------------------------------------------------------------
def load_packed_5x7() -> Dict[int, List[int]]:
    with open(os.path.join(SOURCES, "font_5x7.json"), encoding="utf-8") as fh:
        doc = json.load(fh)
    table = {int(k): list(v) for k, v in doc["glyphs"].items()}
    table.update(EXTRA_5X7)
    return table


def glyph_from_columns(columns: Sequence[int], height: int, advance: int) -> Glyph:
    rows = [[bool(col >> y & 1) for col in columns] for y in range(height)]
    return Glyph(rows, 0, 0, advance)


def scale_glyph(glyph: Glyph, factor: int) -> Glyph:
    """Nearest-neighbour upscale of a packed glyph, keeping it pixel-exact."""
    rows = [
        [cell for cell in row for _ in range(factor)]
        for row in glyph.rows
        for _ in range(factor)
    ]
    return Glyph(rows, glyph.xoffset * factor, glyph.yoffset * factor, glyph.advance * factor)


# --------------------------------------------------------------------------
# source 2: rasterise a TTF/OTF/WOFF2 to the pixel grid
# --------------------------------------------------------------------------
def _contours(font, codepoint: int) -> Tuple[List, int]:
    from fontTools.pens.recordingPen import RecordingPen  # noqa: PLC0415

    glyph_name = font.getBestCmap().get(codepoint)
    if glyph_name is None:
        return [], 0
    pen = RecordingPen()
    font.getGlyphSet()[glyph_name].draw(pen)
    return pen.value, font["hmtx"][glyph_name][0]


def _flatten(commands: Sequence[Tuple]) -> List[List[Tuple[float, float]]]:
    polygons: List[List[Tuple[float, float]]] = []
    current: List[Tuple[float, float]] = []
    for op, args in commands:
        if op == "moveTo":
            if current:
                polygons.append(current)
            current = [tuple(args[0])]
        elif op in ("lineTo", "qCurveTo", "curveTo"):
            points = args[:-1] if op != "lineTo" else args
            for point in points:
                current.append(tuple(point))
        elif op in ("closePath", "endPath"):
            if current:
                polygons.append(current)
                current = []
    if current:
        polygons.append(current)
    return polygons


def glyph_from_font(font, codepoint: int, px: int, ascent: int, descent: int) -> Glyph:
    """Rasterise one glyph on the pixel grid (grid-fitted, even-odd fill)."""
    commands, advance_units = _contours(font, codepoint)
    scale = px / font["head"].unitsPerEm
    advance = int(round(advance_units * scale)) + 1
    height = ascent + descent + 1

    polygons = []
    for poly in _flatten(commands):
        snapped = []
        for x, y in poly:
            # Grid-fit: round to whole pixels so pixel-font outlines stay crisp.
            snapped.append((round(x * scale), round(-y * scale) + ascent))
        polygons.append(snapped)

    rows = [[False] * advance for _ in range(height)]
    for y in range(height):
        centre_y = y + 0.5
        for x in range(advance):
            centre_x = x + 0.5
            inside = False
            for poly in polygons:
                count = len(poly)
                for i in range(count):
                    x1, y1 = poly[i]
                    x2, y2 = poly[(i + 1) % count]
                    if (y1 > centre_y) != (y2 > centre_y):
                        cross = x1 + (centre_y - y1) * (x2 - x1) / (y2 - y1)
                        if centre_x < cross:
                            inside = not inside
            rows[y][x] = inside
    return Glyph(rows, 0, 0, advance)


def synthesise(codepoint: int, ascent: int, descent: int, advance: int) -> Glyph | None:
    """Draw a fallback glyph for marks a source font does not carry.

    Silkscreen (the body face) ships no arrows, maths operators or dashes, so
    those marks are taken from the packed 5x7 table this build already owns and
    dropped onto the 8 px baseline. Purely a symbols fallback: letters, digits
    and punctuation all come from the real typeface.
    """
    columns = EXTRA_5X7.get(codepoint)
    if columns is None:
        return None
    height = ascent + descent + 1
    rows = [[False] * max(advance, len(columns)) for _ in range(height)]
    top = max(0, ascent - 7)
    for cx, col in enumerate(columns):
        for cy in range(7):
            if col >> cy & 1 and top + cy < height:
                rows[top + cy][cx] = True
    return Glyph(rows, 0, 0, max(advance, len(columns)) + 1)


# --------------------------------------------------------------------------
# packing + BMFont output
# --------------------------------------------------------------------------
def crop(glyph: Glyph) -> Glyph:
    """Trim to the ink box, keeping the offset from the pen origin."""
    if glyph.is_empty:
        return Glyph([], 0, 0, glyph.advance)
    top = next(y for y, row in enumerate(glyph.rows) if any(row))
    bottom = max(y for y, row in enumerate(glyph.rows) if any(row))
    left = min(x for row in glyph.rows for x, cell in enumerate(row) if cell)
    right = max(x for row in glyph.rows for x, cell in enumerate(row) if cell)
    rows = [[row[x] for x in range(left, right + 1)] for row in glyph.rows[top : bottom + 1]]
    return Glyph(rows, left, top, glyph.advance)


def pack(glyphs: Dict[int, Glyph], atlas_width: int = 128, pad: int = 1) -> Canvas:
    """Row-pack cropped glyphs into an atlas; pixel (0,0) stays blank for spaces."""
    order = sorted(glyphs.items(), key=lambda kv: (-kv[1].height, kv[0]))
    x, y, row_height = pad, pad, 0
    for _code, glyph in order:
        if glyph.width <= 0 or glyph.height <= 0:
            glyph.atlas_x, glyph.atlas_y = 0, 0
            continue
        if x + glyph.width + pad > atlas_width:
            x = pad
            y += row_height + pad
            row_height = 0
        glyph.atlas_x, glyph.atlas_y = x, y
        x += glyph.width + pad
        row_height = max(row_height, glyph.height)

    atlas_height = 1
    while atlas_height < y + row_height + pad:
        atlas_height *= 2
    canvas = Canvas(atlas_width, atlas_height)
    for _code, glyph in order:
        if glyph.width <= 0 or glyph.height <= 0:
            continue
        for gy, row in enumerate(glyph.rows):
            for gx, cell in enumerate(row):
                if cell:
                    canvas.set(glyph.atlas_x + gx, glyph.atlas_y + gy, INK)
    return canvas


def write_bmfont(
    path: str,
    png_name: str,
    face: str,
    size: int,
    line_height: int,
    ascent: int,
    atlas: Canvas,
    glyphs: Dict[int, Glyph],
) -> None:
    lines = [
        'info face="%s" size=%d bold=0 italic=0 charset="" unicode=1 stretchH=100 '
        "smooth=0 aa=0 padding=0,0,0,0 spacing=0,0 outline=0" % (face, size),
        "common lineHeight=%d base=%d scaleW=%d scaleH=%d pages=1 packed=0 "
        "alphaChnl=0 redChnl=4 greenChnl=4 blueChnl=4"
        % (line_height, ascent, atlas.width, atlas.height),
        'page id=0 file="%s"' % png_name,
        "chars count=%d" % len(glyphs),
    ]
    for code in sorted(glyphs):
        glyph = glyphs[code]
        x, y = glyph.atlas_x, glyph.atlas_y
        lines.append(
            "char id=%d x=%d y=%d width=%d height=%d xoffset=%d yoffset=%d "
            "xadvance=%d page=0 chnl=15"
            % (
                code,
                x,
                y,
                glyph.width,
                glyph.height,
                glyph.xoffset,
                glyph.yoffset,
                glyph.advance,
            )
        )
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


def build(
    name: str,
    face: str,
    px: int,
    ascent: int,
    descent: int,
    line_height: int,
    glyphs: Dict[int, Glyph],
    preview_text: str = "",
) -> None:
    cropped = {code: crop(g) for code, g in glyphs.items()}
    atlas = pack(cropped)
    atlas.save(os.path.join(OUT_DIR, "%s.png" % name))
    write_bmfont(
        os.path.join(OUT_DIR, "%s.fnt" % name),
        "%s.png" % name,
        face,
        px,
        line_height,
        ascent,
        atlas,
        cropped,
    )
    print(
        "wrote %-13s %3d glyphs  atlas %dx%d  lineHeight %d  ascent %d"
        % (name, len(cropped), atlas.width, atlas.height, line_height, ascent)
    )
    if preview_text:
        print(render_text(cropped, preview_text, line_height))


def render_text(glyphs: Dict[int, Glyph], text: str, line_height: int) -> str:
    """Terminal preview: draws `text` with the given glyphs as ASCII."""
    canvas_rows: List[List[str]] = [[" "] * 0]
    pen = 0
    for char in text:
        glyph = glyphs.get(ord(char))
        if glyph is None:
            pen += 5
            continue
        width_needed = pen + max(glyph.width + glyph.xoffset, glyph.advance)
        for row in canvas_rows:
            row.extend([" "] * (width_needed - len(row)))
        for gy, grow in enumerate(glyph.rows):
            y = gy + glyph.yoffset
            while len(canvas_rows) <= y:
                canvas_rows.append([" "] * width_needed)
            for gx, cell in enumerate(grow):
                if cell:
                    canvas_rows[y][pen + glyph.xoffset + gx] = "#"
        pen += glyph.advance
    return "\n".join("".join(row).rstrip() for row in canvas_rows)


# --------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", metavar="TEXT", nargs="?", const="DELVE — Handglooves 0123 ·")
    args = parser.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)

    # --- 5x7 chrome face -------------------------------------------------
    table = load_packed_5x7()
    chrome: Dict[int, Glyph] = {}
    for code in CHARSET:
        columns = table.get(code)
        if columns is None:
            print("warning: 5x7 table is missing U+%04X" % code)
            continue
        chrome[code] = glyph_from_columns(columns, 7, 6)

    # --- 8 px body face ---------------------------------------------------
    from fontTools.ttLib import TTFont  # noqa: PLC0415

    font = TTFont(os.path.join(SOURCES, "silkscreen-latin-400-normal.woff2"))
    body_px, body_ascent, body_descent, body_line = 8, 8, 2, 11
    body: Dict[int, Glyph] = {}
    for code in CHARSET:
        if code in font.getBestCmap():
            body[code] = glyph_from_font(font, code, body_px, body_ascent, body_descent)
        else:
            fallback = synthesise(code, body_ascent, body_descent, 6)
            if fallback is None:
                print("warning: body face is missing U+%04X" % code)
                continue
            body[code] = fallback

    if args.preview is not None:
        print("--- pixel_ui_5")
        print(render_text({k: crop(v) for k, v in chrome.items()}, args.preview, 8))
        print("--- pixel_body_8")
        print(render_text({k: crop(v) for k, v in body.items()}, args.preview, body_line))
        return 0

    build("pixel_ui_5", "pixel_ui_5", 5, 7, 0, 8, chrome)
    build("pixel_body_8", "pixel_body_8", body_px, body_ascent, body_descent, body_line, body)

    # Display raster: the same 5x7 chrome face at 2x = 10 px cap height, which is
    # what §5.4's menu items ("34 px -> 10 px display (5x7 x2)") call for.
    display = {code: scale_glyph(glyph, 2) for code, glyph in chrome.items()}
    build("pixel_display_10", "pixel_display_10", 10, 14, 0, 18, display)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
