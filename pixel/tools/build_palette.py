#!/usr/bin/env python3
"""Build the locked 32 + 8 colour palette deliverables (GDD-06 §5.3, GDD-07 §7.4).

Emits, under `assets/pixel/palette/`:

    palette_surface.png   32 x 1   the surface ramp, index order
    palette_below.png      8 x 1   the "below" (obelisk) ramp, index order
    palette_lut.json               surface index -> below index remap + both ramps

The same hex values are mirrored by `scripts/core/palette.gd`; if you change one,
change both (`tools/check_project.py` asserts the two agree).

Run:  python3 tools/build_palette.py [--preview]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.pixel_io import Canvas, hex_to_rgba  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "pixel", "palette")

# --- Surface ramp (32 colours, GDD-06 §5.3) ----------------------------
SURFACE: dict[str, list[str]] = {
    "ink": ["#0A0C10", "#101418", "#1A2126", "#263038"],
    "stone": ["#2C3238", "#474F55", "#6C757B", "#9AA3A8"],
    "parchment": ["#B9A67F", "#D6C6A3", "#E9DFC8", "#F6EFDD"],
    "bronze": ["#5E3D19", "#8A5A26", "#B0793A", "#D9A463", "#F0CD8E"],
    "oak": ["#3F2410", "#5A3418", "#7A4B2A", "#A06A3C"],
    "blood": ["#5C1C17", "#8E2F26", "#B4553F"],
    "moss": ["#3C4823", "#5B6B34", "#7F8F4A"],
    "skin": ["#8A5636", "#C08356", "#E8B58C"],
    "dawn_sky": ["#E0A06A", "#F2C98A"],
}

# --- Below ramp (8 colours, the infection) -----------------------------
BELOW: list[tuple[str, str]] = [
    ("#16343A", "teal_0"),
    ("#1C4F52", "teal_1"),
    ("#2F8F7A", "teal_2"),
    ("#74E0B4", "mint"),
    ("#2E2140", "violet_0"),
    ("#4B2E6B", "violet_1"),
    ("#8A4FD0", "violet_2"),
    ("#C9C2A8", "bone"),
]

# Ramp-for-ramp remap (GDD-06 §5.3): stone <-> teal, ink <-> violet,
# parchment <-> bone, bronze <-> mint. Families with no stated counterpart
# (oak, blood, moss, skin, dawn sky) are mapped by luminance to the nearest
# below ramp so the LUT stays total; those rows are marked in the JSON.
LUT_NOTES = {
    "ink": "ink <-> violet (spec)",
    "stone": "stone <-> teal (spec)",
    "parchment": "parchment <-> bone (spec)",
    "bronze": "bronze <-> mint (spec)",
    "oak": "unmapped in spec; wood keys to the teal ramp by luminance",
    "blood": "unmapped in spec; rust keys to the violet ramp by luminance",
    "moss": "unmapped in spec; verge keys to the teal ramp by luminance",
    "skin": "unmapped in spec; skin keys to bone",
    "dawn_sky": "unmapped in spec; sky keys to the teal ramp by luminance",
}

LUT_BY_FAMILY: dict[str, list[int]] = {
    "ink": [4, 5, 5, 6],
    "stone": [0, 1, 2, 2],
    "parchment": [7, 7, 7, 7],
    "bronze": [3, 3, 3, 3, 3],
    "oak": [0, 1, 1, 2],
    "blood": [4, 5, 6],
    "moss": [0, 1, 2],
    "skin": [7, 7, 7],
    "dawn_sky": [1, 2],
}


def surface_entries() -> list[tuple[str, str, str]]:
    """Flatten the surface ramp to [(family, name, hex)] in index order."""
    out: list[tuple[str, str, str]] = []
    for family, colours in SURFACE.items():
        for i, hex_value in enumerate(colours):
            out.append((family, "%s_%d" % (family, i), hex_value))
    return out


def build_lut() -> dict:
    entries = surface_entries()
    if len(entries) != 32:
        raise SystemExit("surface ramp must hold exactly 32 colours, got %d" % len(entries))
    remap: list[int] = []
    for family, colours in SURFACE.items():
        mapping = LUT_BY_FAMILY[family]
        if len(mapping) != len(colours):
            raise SystemExit(
                "LUT row for %r has %d entries for %d colours"
                % (family, len(mapping), len(colours))
            )
        remap.extend(mapping)
    return {
        "schema": 1,
        "description": (
            "Surface->below palette remap for the 'infection' LUT shader "
            "(GDD-06 §5.3). Index i of `remap` is the below-ramp index that "
            "surface colour i swaps to."
        ),
        "surface": [
            {"index": i, "family": f, "name": n, "hex": h}
            for i, (f, n, h) in enumerate(entries)
        ],
        "below": [
            {"index": i, "name": n, "hex": h} for i, (h, n) in enumerate(BELOW)
        ],
        "remap": remap,
        "notes": LUT_NOTES,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--preview", action="store_true", help="print the ramp as hex, write nothing"
    )
    args = parser.parse_args()

    entries = surface_entries()

    if args.preview:
        for i, (family, name, hex_value) in enumerate(entries):
            print("%2d  %-12s %-12s %s" % (i, family, name, hex_value))
        print("--")
        for i, (hex_value, name) in enumerate(BELOW):
            print("%2d  below        %-12s %s" % (i, name, hex_value))
        return 0

    os.makedirs(OUT_DIR, exist_ok=True)

    surface_canvas = Canvas(len(entries), 1)
    for i, (_f, _n, hex_value) in enumerate(entries):
        surface_canvas.set(i, 0, hex_to_rgba(hex_value))
    surface_canvas.save(os.path.join(OUT_DIR, "palette_surface.png"))

    below_canvas = Canvas(len(BELOW), 1)
    for i, (hex_value, _n) in enumerate(BELOW):
        below_canvas.set(i, 0, hex_to_rgba(hex_value))
    below_canvas.save(os.path.join(OUT_DIR, "palette_below.png"))

    with open(os.path.join(OUT_DIR, "palette_lut.json"), "w", encoding="utf-8") as fh:
        json.dump(build_lut(), fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print("wrote %d surface + %d below colours to %s" % (len(entries), len(BELOW), OUT_DIR))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
