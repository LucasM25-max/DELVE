#!/usr/bin/env python3
"""Bake the shell's text faces (GDD-06 §4.8, re-cut for real type).

The shell draws every string with a webfont through the 2-D context
(`web/js/ui/font.js`). Three things have to exist next to that code, and this
builder is the one writer for all three:

  1. `web/assets/fonts/delve_sans_*.woff2` — the shipped faces, subset from the
     Inter sources in `tools/sources/` down to `lib/strings.charset()`: printable
     ASCII, the typographic marks the copy uses, and whatever else the shipped
     strings reach for. Subsetting is what keeps the page's font payload at a few
     kilobytes, and it is what makes the coverage gate meaningful — a string that
     needs a glyph the face does not carry fails `tools/check_project.py`.
  2. `web/assets/fonts/font_metrics.json` — per-character advance widths in font
     units, straight out of `hmtx`. The page and `tools/check_project.py` both
     measure text from this table, so a width the gate computes and a width the
     page draws are the same integer (the property the pixel build kept with
     `.fnt` xadvance).
  3. `tools/atlas/glyph_atlas.json` + `atlas_<face>.png` — a 1:1 coverage atlas
     of every face. The page never loads it (it draws the real font); the offline
     renderers do: `tools/preview_screen.py` and `web/tests/shoot.mjs`'s canvas
     stub have no font rasteriser, so the atlas is what lets them keep drawing
     readable text into the preview PNGs.

Sources are OFL-1.1 (notices in `web/assets/fonts/LICENSES/`):

  * `tools/sources/inter-regular-400.woff2`   — Inter Regular
  * `tools/sources/inter-semibold-600.woff2`  — Inter SemiBold

Needs fontTools + brotli:  python3 -m pip install fonttools brotli

Run:  python3 tools/build_text_faces.py [--preview]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Dict, List, Sequence, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.pixel_io import Canvas  # noqa: E402
from lib.strings import charset  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")
WEB = os.path.join(ROOT, "web")
SOURCES = os.path.join(TOOLS, "sources")
FONT_DIR = os.path.join(WEB, "assets", "fonts")
DATA_DIR = os.path.join(WEB, "data")
ATLAS_DIR = os.path.join(TOOLS, "atlas")

# Each face's font source: the file in `tools/sources/` and the weight it carries.
FONT_SOURCES: Dict[str, Dict[str, object]] = {
    "inter-400": {"weight": 400, "source": "inter-regular-400.woff2", "file": "delve_sans_400.woff2"},
    "inter-600": {"weight": 600, "source": "inter-semibold-600.woff2", "file": "delve_sans_600.woff2"},
}

SUPERSAMPLE = 4  # 4x4 coverage samples per pixel
CURVE_STEPS = 10  # line segments per outline curve
ATLAS_WIDTH = 256
ATLAS_PAD = 1


# --------------------------------------------------------------------------
# character set
# --------------------------------------------------------------------------
# --------------------------------------------------------------------------
# outline flattening + coverage raster
# --------------------------------------------------------------------------
def flatten(font, codepoint: int) -> List[List[Tuple[float, float]]]:
    """Contours of one glyph as polygons, in font units (y up).

    `fontTools.pens.basePen.BasePen` does the hard part — the implied on-curve
    points in TrueType `qCurveTo` runs — and the overrides below turn every
    curve into straight lines, which is all a scanline fill needs.
    """
    from fontTools.pens.basePen import BasePen

    name = font.getBestCmap().get(codepoint)
    if name is None:
        return []

    class Pen(BasePen):
        def __init__(self, glyph_set):
            super().__init__(glyph_set)
            self.contours: List[List[Tuple[float, float]]] = []
            self.current: List[Tuple[float, float]] = []

        def _moveTo(self, point):
            self.current = [point]
            self.contours.append(self.current)

        def _lineTo(self, point):
            self.current.append(point)

        def _curveToOne(self, p1, p2, p3):
            p0 = self.current[-1]
            for step in range(1, CURVE_STEPS + 1):
                t = step / CURVE_STEPS
                u = 1 - t
                self.current.append((
                    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
                    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
                ))

        def _qCurveToOne(self, p1, p2):
            p0 = self.current[-1]
            for step in range(1, CURVE_STEPS + 1):
                t = step / CURVE_STEPS
                u = 1 - t
                self.current.append((
                    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
                    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
                ))

        def _closePath(self):
            self.current = []

        def _endPath(self):
            self.current = []

    pen = Pen(font.getGlyphSet())
    font.getGlyphSet()[name].draw(pen)
    return [contour for contour in pen.contours if len(contour) > 2]


def coverage(font, codepoint: int, size: float, ascent: int, descent: int) -> Tuple[List[List[int]], int, int]:
    """Ink coverage 0..255 for one glyph: `(rows, offset_x, offset_y)`.

    The pen sits at column 0 and the baseline at row `ascent - offset_y`, so
    `offset_y` is measured from the top of the line box (it may be negative when
    a glyph reaches above its ascent, which the caller reports).
    """
    contours = flatten(font, codepoint)
    scale = size / font["head"].unitsPerEm
    name = font.getBestCmap().get(codepoint)
    advance = int(round(font["hmtx"][name][0] * scale)) if name else 0
    width = max(advance, 1)
    pad = int(size * 0.4) + 2
    baseline = ascent + pad
    height = baseline + descent + pad
    rows = [[0] * width for _ in range(height)]
    if not contours:
        return [], 0, 0
    # Font units -> device pixels, y flipped, baseline at `baseline`.
    scaled = [[(x * scale, baseline - y * scale) for x, y in contour] for contour in contours]
    step = 1.0 / SUPERSAMPLE
    for row in range(height):
        for column in range(width):
            hits = 0
            for sy in range(SUPERSAMPLE):
                y = row + (sy + 0.5) * step
                crossings: List[float] = []
                for contour in scaled:
                    count = len(contour)
                    for index in range(count):
                        x1, y1 = contour[index]
                        x2, y2 = contour[(index + 1) % count]
                        if (y1 > y) != (y2 > y):
                            crossings.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
                if not crossings:
                    continue
                crossings.sort()
                for sx in range(SUPERSAMPLE):
                    x = column + (sx + 0.5) * step
                    inside = False
                    for cross in crossings:
                        if cross > x:
                            break
                        inside = not inside
                    if inside:
                        hits += 1
            rows[row][column] = round(hits * 255 / (SUPERSAMPLE * SUPERSAMPLE))
    trimmed, offset_x, offset_y = crop(rows)
    return trimmed, offset_x, offset_y - pad


def crop(rows: List[List[int]]) -> Tuple[List[List[int]], int, int]:
    """Trim to the ink box; returns `(rows, offset_x, offset_y)` from the pen."""
    top, bottom = None, None
    for index, row in enumerate(rows):
        if any(row):
            if top is None:
                top = index
            bottom = index
    if top is None:
        return [], 0, 0
    left = min(x for row in rows for x, value in enumerate(row) if value)
    right = max(x for row in rows for x, value in enumerate(row) if value)
    return [row[left:right + 1] for row in rows[top:bottom + 1]], left, top


# --------------------------------------------------------------------------
# atlas
# --------------------------------------------------------------------------
def place(glyphs: Dict[int, Dict], atlas_width: int = ATLAS_WIDTH,
          pad: int = ATLAS_PAD) -> Dict[int, Tuple[int, int]]:
    """Row-pack cropped glyphs; pixel (0,0) stays blank so blanks have a cell."""
    order = sorted(glyphs.items(), key=lambda item: (-len(item[1]["rows"]), item[0]))
    x, y, row_height = pad, pad, 0
    placements: Dict[int, Tuple[int, int]] = {}
    for code, glyph in order:
        rows = glyph["rows"]
        width = len(rows[0]) if rows else 0
        if width == 0 or not rows:
            placements[code] = (0, 0)
            continue
        if x + width + pad > atlas_width:
            x = pad
            y += row_height + pad
            row_height = 0
        placements[code] = (x, y)
        x += width + pad
        row_height = max(row_height, len(rows))
    return placements


def build_atlas(glyphs: Dict[int, Dict], placements: Dict[int, Tuple[int, int]]) -> Canvas:
    depth = max((y + len(glyph["rows"]) for y, glyph in
                 ((placements[code][1], glyph) for code, glyph in glyphs.items())), default=1)
    canvas = Canvas(ATLAS_WIDTH, max(depth + ATLAS_PAD, 1))
    for code, glyph in glyphs.items():
        rows = glyph["rows"]
        if not rows:
            continue
        x, y = placements[code]
        for ry, row in enumerate(rows):
            for rx, value in enumerate(row):
                if value:
                    canvas.set(x + rx, y + ry, (255, 255, 255, value))
    return canvas


def ascii_preview(canvas: Canvas) -> str:
    ramp = " .:-=+*#%@"
    lines = []
    for y in range(canvas.height):
        lines.append("".join(ramp[min(9, canvas.get(x, y)[3] * 10 // 256)] for x in range(canvas.width)))
    return "\n".join(lines)


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------
def subset(source_path: str, out_path: str, codepoints: Sequence[int]) -> None:
    from fontTools.subset import Options, Subsetter
    from fontTools.ttLib import TTFont

    font = TTFont(source_path)
    options = Options()
    options.layout_features = []     # the shell shapes nothing: no GSUB/GPOS needed
    options.drop_tables += ["DSIG"]
    options.name_IDs = [1, 2, 4, 6]  # family, subfamily, full name, PostScript name
    options.recalc_bounds = True
    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(out_path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true", help="print every atlas as ASCII")
    args = parser.parse_args()

    from fontTools.ttLib import TTFont

    manifest = json.load(open(os.path.join(DATA_DIR, "fonts.json"), encoding="utf-8"))
    faces = manifest["faces"]
    codes = charset(WEB)
    os.makedirs(FONT_DIR, exist_ok=True)
    os.makedirs(ATLAS_DIR, exist_ok=True)

    metrics: Dict[str, Dict] = {"schema": 1, "sources": {}}
    for source_id, entry in FONT_SOURCES.items():
        source_path = os.path.join(SOURCES, entry["source"])
        font = TTFont(source_path)
        cmap = font.getBestCmap()
        advances = {str(code): int(font["hmtx"][cmap[code]][0]) for code in codes if code in cmap}
        units_per_em = int(font["head"].unitsPerEm)
        out_path = os.path.join(FONT_DIR, entry["file"])
        subset(source_path, out_path, codes)
        metrics["sources"][source_id] = {
            "file": entry["file"],
            "weight": entry["weight"],
            "unitsPerEm": units_per_em,
            "advances": advances,
        }
        print("  %-22s %6d bytes, subset of %s (%d glyphs)"
              % (entry["file"], os.path.getsize(out_path), entry["source"], len(advances)))

    with open(os.path.join(FONT_DIR, "font_metrics.json"), "w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    atlas: Dict[str, Dict] = {"schema": 1, "faces": {}}
    for role, face in faces.items():
        source = FONT_SOURCES[face["source"]]
        font = TTFont(os.path.join(SOURCES, source["source"]))
        size = float(face["size"])
        ascent, descent = int(face["ascent"]), int(face["descent"])
        glyphs: Dict[int, Dict] = {}
        clipped: List[str] = []
        for code in codes:
            if code not in font.getBestCmap():
                continue
            rows, offset_x, offset_y = coverage(font, code, size, ascent, descent)
            if rows and (offset_y < 0 or offset_y + len(rows) > ascent + descent):
                clipped.append("%s (%s)" % (chr(code), offset_y))
                continue
            glyphs[code] = {"rows": rows, "x": offset_x, "y": offset_y}
        if clipped:
            print("  FAIL %s: glyphs do not fit ascent %d / descent %d: %s"
                  % (role, ascent, descent, ", ".join(clipped)), file=sys.stderr)
            return 1
        placements = place(glyphs)
        canvas = build_atlas(glyphs, placements)
        filename = "atlas_%s.png" % role
        canvas.save(os.path.join(ATLAS_DIR, filename))
        atlas["faces"][role] = {
            "file": filename,
            "source": face["source"],
            "size": size,
            "weight": source["weight"],
            "ascent": ascent,
            "descent": descent,
            "lineHeight": face["lineHeight"],
            "glyphs": {
                str(code): [placements[code][0], placements[code][1],
                            len(glyph["rows"][0]) if glyph["rows"] else 0,
                            len(glyph["rows"]), glyph["x"], glyph["y"]]
                for code, glyph in glyphs.items()
            },
        }
        print("  %-22s %dx%d coverage atlas for the offline renderers"
              % (filename, canvas.width, canvas.height))
        if args.preview:
            print(ascii_preview(canvas))

    with open(os.path.join(ATLAS_DIR, "glyph_atlas.json"), "w", encoding="utf-8") as handle:
        json.dump(atlas, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print("faces built: %d source(s), %d face(s), %d codepoints"
          % (len(FONT_SOURCES), len(faces), len(codes)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
