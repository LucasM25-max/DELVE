#!/usr/bin/env python3
"""Build the DELVE brand lockups as pixel art (GDD-07 §5.1).

Outputs, under `assets/pixel/ui/`:

    logo_emblem.png         24x24  d20 face: stepped top edge, 2 px bronze
                                   stroke, ink keyline, 2 px mint centroid pip
    logo_emblem_steps.png   24x24  same asset with the three steps lit mint
                                   (load-complete / seal stamp in the sting)
    logo_wordmark.png       72x22  DELVE in the display face: 18 px cap height,
                                   2 px letter-spacing, bronze face, 1 px ink
                                   keyline, 1 px mint lower-left rim-light
    logo_menu.png           96x24  menu lockup = emblem + wordmark side by side,
                                   matching the §5.4 rect (29, 22, 96, 24)
    icon.png                64x64  project/window icon (emblem x2 on ink)

Spec note (documented in `assets/pixel/art_manifest.json`): §5.1 asks for a
"5x7-pixel display face" at "cap height 18 px". Those two numbers are mutually
exclusive on a pixel grid (18 / 7 is not an integer), so the display face here is
authored on a 6x9 grid and rendered at 2x, which keeps every pixel whole *and*
hits the specified 18 px cap height and 2 px letter-spacing exactly. Menu item
text still uses the genuine 5x7 chrome face at 2x (= 10 px), per §5.4.

Run:  python3 tools/build_brand.py [--preview]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.pixel_io import Canvas, hex_to_rgba, preview_grid  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
OUT_DIR = os.path.join(WEB, "assets", "pixel", "ui")
DATA_DIR = os.path.join(WEB, "data")

# Locked palette (GDD-06 §5.3)
INK = hex_to_rgba("#101418")
BRONZE = hex_to_rgba("#B0793A")
MINT = hex_to_rgba("#74E0B4")
CLEAR = (0, 0, 0, 0)

# --- display face: 6 x 9 grid, authored for the wordmark --------------------
# Only the glyphs the wordmark needs are authored; extend the dict to add more.
DISPLAY_FACE: dict[str, list[str]] = {
    "D": [
        "#####.",
        "#....#",
        "#....#",
        "#....#",
        "#....#",
        "#....#",
        "#....#",
        "#....#",
        "#####.",
    ],
    "E": [  # chisel-flat right arms (§5.1)
        "######",
        "#.....",
        "#.....",
        "#.....",
        "#####.",
        "#.....",
        "#.....",
        "#.....",
        "######",
    ],
    "L": [
        "#.....",
        "#.....",
        "#.....",
        "#.....",
        "#.....",
        "#.....",
        "#.....",
        "#.....",
        "######",
    ],
    "V": [  # apex drops 2 px below the baseline (one extra grid row at 2x)
        "#....#",
        "#....#",
        "#....#",
        "#....#",
        "#....#",
        "#....#",
        "#....#",
        ".#..#.",
        ".#..#.",
        "..##..",
    ],
}

DISPLAY_SCALE = 2
LETTER_SPACING = 2
CAP_HEIGHT = 9 * DISPLAY_SCALE  # 18 px — the §5.1 number
GLYPH_CELL = 6 * DISPLAY_SCALE + LETTER_SPACING  # 14 px: 12 px glyph + 2 px gap

# The three descending steps of the emblem, in emblem-local pixels. The sting
# lights them top to bottom, and the loading seal lights them at 33/66/100 %
# (GDD-07 §5.1 / §5.9), so the geometry is published in data/brand.json rather
# than hard-coded in two screens.
EMBLEM_STEPS: list[tuple[int, int, int]] = [
    (12 - 12 // 2, 5, 12),
    (12 - 8 // 2, 9, 8),
    (12 - 4 // 2, 13, 4),
]
EMBLEM_PIP: tuple[int, int, int, int] = (11, 17, 2, 2)


def draw_display_text(
    canvas: Canvas,
    text: str,
    x: int,
    y: int,
    scale: int = DISPLAY_SCALE,
    spacing: int = LETTER_SPACING,
) -> tuple[int, int]:
    """Blit `text` in the display face; returns (width, height) of the ink box."""
    pen = x
    top = None
    bottom = 0
    for char in text:
        mask = DISPLAY_FACE.get(char)
        if mask is None:
            raise KeyError("display face has no glyph for %r" % char)
        for ry, row in enumerate(mask):
            for rx, cell in enumerate(row):
                if cell != "#":
                    continue
                for sy in range(scale):
                    for sx in range(scale):
                        canvas.set(pen + rx * scale + sx, y + ry * scale + sy, BRONZE)
        top = y if top is None else min(top, y)
        bottom = max(bottom, y + len(mask) * scale)
        pen += len(mask[0]) * scale + spacing
    width = pen - spacing - x
    return width, bottom - (top if top is not None else y)


def outline_and_rim(canvas: Canvas, mask: Canvas) -> None:
    """Add the 1 px ink keyline plus the mint lower-left rim-light around `mask`.

    `mask` holds the bronze face pixels in *canvas* coordinates; every empty
    pixel that touches the face is keylined. A keyline pixel whose upper-right
    neighbour is face metal is on the lower-left side of the letterform and
    takes mint instead of ink (the fore-shadow rim-light, §5.1).
    """
    width, height = canvas.width, canvas.height
    for y in range(height):
        for x in range(width):
            if mask.get(x, y)[3]:
                continue
            touches = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height and mask.get(nx, ny)[3]:
                    touches = True
                    break
            if not touches:
                continue
            above_right = 0 <= x + 1 < width and 0 <= y - 1 < height
            rim = above_right and mask.get(x + 1, y - 1)[3]
            canvas.set(x, y, MINT if rim else INK)


def build_wordmark() -> Canvas:
    """Wordmark = display text + keyline + rim-light, cropped to the ink box."""
    face = Canvas(96, 32)  # untouched bronze letterforms, used as the mask
    draw_display_text(face, "DELVE", 2, 2)
    canvas = Canvas(96, 32)
    for y in range(face.height):
        for x in range(face.width):
            canvas.set(x, y, face.get(x, y))
    outline_and_rim(canvas, face)
    return canvas.crop(0, 0, 72, 22)


def build_emblem(steps_lit: bool = False, lit_steps: int = -1) -> Canvas:
    """24x24 d20 face: downward triangle, three descending steps, mint pip.

    Spec (§5.1): downward equilateral triangle, three descending 2 px steps cut
    from the top edge toward the centre, 2 px bronze stroke, 2 px mint pip at
    the centroid. Rendered as a silhouette (the triangle's 2 px stroke plus the
    steps) that is then dilated by one pixel into the ink keyline the rest of
    the brand lockups use, so the emblem reads on parchment or on ink.
    """
    size = 24
    top_y, apex_y = 1, 22
    left_x, right_x, apex_x = 2, 21, 11  # apex spans x 11..12

    triangle = Canvas(size, size)
    for y in range(top_y, apex_y + 1):
        t = (y - top_y) / float(apex_y - top_y)
        xl = int(round(left_x + (apex_x - left_x) * t))
        xr = int(round(right_x - (right_x - apex_x - 1) * t))
        triangle.rect(xl, y, 2, 1, BRONZE)
        triangle.rect(xr - 1, y, 2, 1, BRONZE)
    triangle.rect(left_x, top_y, right_x - left_x + 1, 2, BRONZE)

    canvas = Canvas(size, size)
    # Keyline: every empty pixel touching the triangle silhouette (outside only,
    # so the interior stays open and the steps read as cut stone).
    for y in range(size):
        for x in range(size):
            if triangle.get(x, y)[3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < size and 0 <= ny < size and triangle.get(nx, ny)[3]:
                    canvas.set(x, y, INK)
                    break

    # The three descending 2 px steps, cut from the top edge toward the centre.
    step_colour = MINT if steps_lit else BRONZE
    for x, y, width in EMBLEM_STEPS:
        canvas.rect(x, y, width, 2, step_colour)

    # 2 px mint pip at the face's centroid, below the steps.
    canvas.rect(EMBLEM_PIP[0], EMBLEM_PIP[1], EMBLEM_PIP[2], EMBLEM_PIP[3], MINT)

    for y in range(size):
        for x in range(size):
            if triangle.get(x, y)[3]:
                canvas.set(x, y, triangle.get(x, y))
    return canvas


def build_wordmark_strip(wordmark: Canvas) -> Canvas:
    """The wordmark sliced into the five letter cells the sting chisels in.

    Each cell is `GLYPH_CELL` px wide; the letters are drawn one at a time, so
    the boot sting can reveal DELVE letter by letter (GDD-07 §5.2).
    """
    strip = Canvas(GLYPH_CELL * 5, wordmark.height)
    for cell in range(5):
        source_x = 2 + cell * GLYPH_CELL
        for y in range(wordmark.height):
            for x in range(GLYPH_CELL):
                if source_x + x < wordmark.width:
                    strip.set(cell * GLYPH_CELL + x, y, wordmark.get(source_x + x, y))
    return strip


def build_menu_lockup(wordmark: Canvas, emblem: Canvas) -> Canvas:
    """Emblem + wordmark side by side, sized to the §5.4 lockup rect (96x24)."""
    canvas = Canvas(96, 24)
    for y in range(emblem.height):
        for x in range(emblem.width):
            canvas.set(x, y, emblem.get(x, y))
    offset_x, offset_y = 96 - wordmark.width, (24 - wordmark.height) // 2
    for y in range(wordmark.height):
        for x in range(wordmark.width):
            if wordmark.get(x, y)[3]:
                canvas.set(offset_x + x, offset_y + y, wordmark.get(x, y))
    return canvas


def build_icon(emblem: Canvas) -> Canvas:
    """64x64 window/project icon: the emblem at 2x on an ink field."""
    canvas = Canvas(64, 64, INK)
    for y in range(emblem.height):
        for x in range(emblem.width):
            pixel = emblem.get(x, y)
            if not pixel[3]:
                continue
            for sy in range(2):
                for sx in range(2):
                    canvas.set(8 + x * 2 + sx, 8 + y * 2 + sy, pixel)
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true", help="ASCII preview only")
    args = parser.parse_args()

    wordmark = build_wordmark()
    emblem = build_emblem()
    emblem_lit = build_emblem(steps_lit=True)
    ledger_stamps = {count: build_emblem(lit_steps=count) for count in (1, 2)}
    lockup = build_menu_lockup(wordmark, emblem)
    icon = build_icon(emblem)

    if args.preview:
        print("wordmark %dx%d  emblem %dx%d  lockup %dx%d"
              % (wordmark.width, wordmark.height, emblem.width, emblem.height,
                 lockup.width, lockup.height))
        print(preview_grid([emblem, emblem_lit, lockup]))
        return 0

    os.makedirs(OUT_DIR, exist_ok=True)
    strip = build_wordmark_strip(wordmark)
    for name, canvas in (
        ("logo_emblem.png", emblem),
        ("logo_emblem_steps.png", emblem_lit),
        ("logo_emblem_step1.png", ledger_stamps[1]),
        ("logo_emblem_step2.png", ledger_stamps[2]),
        ("logo_wordmark.png", wordmark),
        ("logo_wordmark_strip.png", strip),
        ("logo_menu.png", lockup),
        ("icon.png", icon),
    ):
        canvas.save(os.path.join(OUT_DIR, name))
        print("wrote %-24s %dx%d" % (name, canvas.width, canvas.height))

    # Brand geometry, consumed by the boot sting and the menu screen.
    brand = {
        "schema": 1,
        "description": "DELVE brand lockup geometry (GDD-07 §5.1). Generated by tools/build_brand.py.",
        "emblem": {
            "size": [24, 24],
            "variants": {
                "stamp_0": "logo_emblem.png",
                "stamp_1": "logo_emblem_step1.png",
                "stamp_2": "logo_emblem_step2.png",
                "stamp_3": "logo_emblem_steps.png",
            },
            "comment_stamps": "Save stamps light one step per third of the beat list completed (steps lit = beats completed, §5.5).",
            "steps": [{"x": x, "y": y, "w": w, "h": 2} for x, y, w in EMBLEM_STEPS],
            "pip": {"x": EMBLEM_PIP[0], "y": EMBLEM_PIP[1], "w": EMBLEM_PIP[2], "h": EMBLEM_PIP[3]},
            "comment": "Steps light top to bottom on load-complete and at 33/66/100 % on the loading seal.",
        },
        "wordmark": {
            "size": [wordmark.width, wordmark.height],
            "strip": [strip.width, strip.height],
            "cell_width": GLYPH_CELL,
            "cap_height": CAP_HEIGHT,
            "letter_spacing": LETTER_SPACING,
            "letters": list("DELVE"),
        },
        "lockup": {"size": [lockup.width, lockup.height]},
    }
    with open(os.path.join(DATA_DIR, "brand.json"), "w", encoding="utf-8") as fh:
        json.dump(brand, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("wrote data/brand.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
