#!/usr/bin/env python3
"""Build the pixel UI kit: nine-patch panels, buttons, seal and cursor marks.

Outputs, under `assets/pixel/ui/`, plus the machine-readable
`assets/pixel/ui/ui_kit.json` that the Godot `UiPixel` factory reads:

    panel_parchment.png   48x48  8 px corners  (cards, tips, rule cards)
    panel_oak.png         48x48  6 px corners  (options, class cards)
    panel_ink.png         48x48  4 px corners  (legal, pause, error)
    button_normal/hover/pressed/disabled.png   16x16, 4 px corners
    wax_seal.png          24x24  emblem stamped in blood red wax
    item_cursor.png       10x10  bronze chevron for list selection

Every panel source is a 48x48 nine-patch: Godot stretches the middle, so the
corner art stays 1:1 at any panel size (GDD-07 §7.4).

Run:  python3 tools/build_ui_kit.py [--preview]
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.pixel_io import Canvas, hex_to_rgba, preview_grid  # noqa: E402
from build_brand import build_emblem  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "pixel", "ui")

# Locked palette (GDD-06 §5.3)
INK = hex_to_rgba("#101418")
INK_0 = hex_to_rgba("#0A0C10")
INK_2 = hex_to_rgba("#1A2126")
STONE_1 = hex_to_rgba("#474F55")
PARCH_0 = hex_to_rgba("#B9A67F")
PARCH_1 = hex_to_rgba("#D6C6A3")
PARCH_2 = hex_to_rgba("#E9DFC8")
PARCH_3 = hex_to_rgba("#F6EFDD")
BRONZE_0 = hex_to_rgba("#5E3D19")
BRONZE_1 = hex_to_rgba("#8A5A26")
BRONZE_2 = hex_to_rgba("#B0793A")
BRONZE_3 = hex_to_rgba("#D9A463")
BLOOD_0 = hex_to_rgba("#5C1C17")
BLOOD_1 = hex_to_rgba("#8E2F26")
OAK_0 = hex_to_rgba("#3F2410")
OAK_1 = hex_to_rgba("#5A3418")
OAK_2 = hex_to_rgba("#7A4B2A")
CLEAR = (0, 0, 0, 0)

KIT = {
    "schema": 1,
    "comment": "Nine-patch sources for the DELVE pixel UI kit (GDD-07 §7.4). "
    "`margin` is the number of pixels kept 1:1 on each side when stretched.",
    "styles": {
        "panel_parchment": {
            "file": "panel_parchment.png",
            "size": [48, 48],
            "margin": 8,
            "use": "contract, ledger, tips, rule cards, stub cards",
        },
        "panel_oak": {
            "file": "panel_oak.png",
            "size": [48, 48],
            "margin": 6,
            "use": "options, class cards",
        },
        "panel_ink": {
            "file": "panel_ink.png",
            "size": [48, 48],
            "margin": 4,
            "use": "legal, pause, error",
        },
        "button": {
            "file": "button_{state}.png",
            "size": [16, 16],
            "margin": 4,
            "states": ["normal", "hover", "pressed", "disabled"],
            "use": "all confirm/back buttons in cards",
        },
        "button_blood": {
            "file": "button_blood_{state}.png",
            "size": [16, 16],
            "margin": 4,
            "states": ["normal", "hover", "pressed", "disabled"],
            "use": "destructive confirms: ledger DELETE and the BREAK button (§5.5 blood #8E2F26)",
        },
        "pill": {
            "file": "pill_{state}.png",
            "size": [16, 16],
            "margin": 4,
            "states": ["normal", "selected", "hover"],
            "use": "segmented pill groups (h 16, gap 4); selected = bronze fill + ink text (§5.5)",
        },
        "tab": {
            "file": "tab_{state}.png",
            "size": [16, 16],
            "margin": 4,
            "states": ["normal", "selected", "hover"],
            "use": "options tab rail (tabs x3, §7.4)",
        },
        "scrollbar": {
            "file": "scrollbar_{part}.png",
            "size": [4, 16],
            "margin": 2,
            "states": ["thumb", "track"],
            "use": "options/tab scrolling",
        },
        "tooltip": {
            "file": "tooltip_box.png",
            "size": [16, 16],
            "margin": 4,
            "use": "hover tooltips (menu CONTINUE, SECONDARY pill)",
        },
    },
    "sprites": {
        "wax_seal": {"file": "wax_seal.png", "size": [24, 24], "use": "save stamps, cards"},
        "item_cursor": {"file": "item_cursor.png", "size": [10, 10], "use": "menu/list selection"},
        "portrait_frame": {"file": "portrait_frame.png", "size": [24, 24],
                           "use": "initiative queue and journal portrait frames"},
    },
}


def panel(corner: int, fill: tuple, light: tuple, dark: tuple, outer: tuple | None) -> Canvas:
    """A nine-patch panel: flat fill, lit top-left, shaded bottom-right."""
    size = 48
    canvas = Canvas(size, size)
    inner = corner
    canvas.rect(inner, inner, size - inner * 2, size - inner * 2, fill)
    canvas.rect(0, 0, size, size, CLEAR)
    canvas.rect(inner, 0, size - inner * 2, size, fill)
    canvas.rect(0, inner, size, size - inner * 2, fill)

    # Corner blocks, so a stretched panel keeps hand-drawn corners.
    canvas.rect(0, 0, inner, inner, fill)
    canvas.rect(size - inner, 0, inner, inner, fill)
    canvas.rect(0, size - inner, inner, inner, fill)
    canvas.rect(size - inner, size - inner, inner, inner, fill)

    # Lit top/left edge, shaded bottom/right edge (1 px inside the border).
    canvas.hline(0, 0, size, light)
    canvas.vline(0, 0, size, light)
    canvas.hline(0, size - 1, size, dark)
    canvas.vline(size - 1, 0, size, dark)
    # Corner accents: darken the outer corners by one step for a cut-stone feel.
    for cx, cy in ((0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1)):
        canvas.set(cx, cy, dark if (cx + cy) % 2 else light)
    if outer is not None:
        canvas.frame(0, 0, size, size, outer)
        canvas.frame(1, 1, size - 2, size - 2, light)
        canvas.hline(1, size - 2, size - 2, dark)
        canvas.vline(size - 2, 1, size - 2, dark)
    return canvas


def button(state: str) -> Canvas:
    """4 px corner button frame; fill flips to bronze for hover/pressed."""
    size = 16
    canvas = Canvas(size, size)
    fills = {
        "normal": (PARCH_2, PARCH_3, PARCH_0),
        "hover": (BRONZE_3, hex_to_rgba("#F0CD8E"), BRONZE_1),
        "pressed": (BRONZE_2, BRONZE_3, BRONZE_0),
        "disabled": (STONE_1, hex_to_rgba("#6C757B"), hex_to_rgba("#2C3238")),
    }
    fill, light, dark = fills[state]
    canvas.rect(0, 0, size, size, fill)
    canvas.hline(0, 0, size, light)
    canvas.vline(0, 0, size, light)
    canvas.hline(0, size - 1, size, dark)
    canvas.vline(size - 1, 0, size, dark)
    canvas.frame(0, 0, size, size, INK_0)
    if state == "pressed":
        canvas.hline(1, 0, size - 2, dark)
        canvas.vline(0, 1, size - 2, dark)
    return canvas


def button_blood(state: str) -> Canvas:
    """Blood-faced button for destructive confirms (§5.5 `DELETE` / `BREAK`).

    Same 4 px frame as `button()`, so a card can mix faces without the geometry
    shifting; only the fill changes (blood #8E2F26, per the palette's
    "destructive confirms" entry).
    """
    size = 16
    canvas = Canvas(size, size)
    fills = {
        # Locked-palette blood family: BLOOD_0 #5C1C17, BLOOD_1 #8E2F26, #B4553F.
        "normal": (BLOOD_1, hex_to_rgba("#B4553F"), BLOOD_0),
        "hover": (hex_to_rgba("#B4553F"), hex_to_rgba("#B4553F"), BLOOD_0),
        "pressed": (BLOOD_0, BLOOD_1, BLOOD_0),
        "disabled": (STONE_1, hex_to_rgba("#6C757B"), hex_to_rgba("#2C3238")),
    }
    fill, light, dark = fills[state]
    canvas.rect(0, 0, size, size, fill)
    canvas.hline(0, 0, size, light)
    canvas.vline(0, 0, size, light)
    canvas.hline(0, size - 1, size, dark)
    canvas.vline(size - 1, 0, size, dark)
    canvas.frame(0, 0, size, size, INK_0)
    if state == "pressed":
        canvas.hline(1, 0, size - 2, dark)
        canvas.vline(0, 1, size - 2, dark)
    return canvas


def pill(state: str) -> Canvas:
    """Segmented pill: parchment when idle, bronze fill when selected (§5.5)."""
    size = 16
    canvas = Canvas(size, size)
    fill, border, highlight = {
        "normal": (PARCH_2, BRONZE_1, PARCH_3),
        "hover": (PARCH_3, BRONZE_2, PARCH_3),
        "selected": (BRONZE_2, BRONZE_0, BRONZE_3),
    }[state]
    canvas.rect(0, 0, size, size, fill)
    canvas.frame(0, 0, size, size, border)
    canvas.hline(1, 1, size - 2, highlight)
    return canvas


def tab(state: str) -> Canvas:
    """Options tab: ink slab when idle, bronze when selected (§5.6)."""
    size = 16
    canvas = Canvas(size, size)
    fill, border, highlight = {
        "normal": (INK_2, hex_to_rgba("#2C3238"), hex_to_rgba("#263038")),
        "hover": (hex_to_rgba("#263038"), BRONZE_1, hex_to_rgba("#474F55")),
        "selected": (BRONZE_2, BRONZE_0, BRONZE_3),
    }[state]
    canvas.rect(0, 0, size, size, fill)
    canvas.frame(0, 0, size, size, border)
    canvas.hline(1, 1, size - 2, highlight)
    # A fat left edge marks the active tab even in monochrome.
    if state == "selected":
        canvas.rect(1, 1, 2, size - 2, BRONZE_0)
    return canvas


def scrollbar(part: str) -> Canvas:
    """4 px wide scroll parts: a stone track and a bronze thumb."""
    canvas = Canvas(4, 16)
    if part == "track":
        canvas.rect(0, 0, 4, 16, INK_2)
        canvas.vline(0, 0, 16, hex_to_rgba("#2C3238"))
        canvas.vline(3, 0, 16, INK_0)
    else:
        canvas.rect(0, 0, 4, 16, BRONZE_1)
        canvas.vline(0, 0, 16, BRONZE_2)
        canvas.vline(3, 0, 16, BRONZE_0)
        canvas.hline(0, 0, 4, BRONZE_3)
    return canvas


def tooltip_box() -> Canvas:
    """Small parchment nine-patch for hover tooltips."""
    canvas = Canvas(16, 16)
    canvas.rect(0, 0, 16, 16, PARCH_2)
    canvas.frame(0, 0, 16, 16, BRONZE_1)
    canvas.hline(1, 1, 14, PARCH_3)
    return canvas


def portrait_frame() -> Canvas:
    """24 px portrait frame for the initiative queue and the journal."""
    canvas = Canvas(24, 24)
    canvas.frame(0, 0, 24, 24, BRONZE_0)
    canvas.frame(1, 1, 22, 22, BRONZE_2)
    canvas.frame(2, 2, 20, 20, INK_0)
    canvas.hline(2, 2, 20, BRONZE_1)
    # Corner nicks, so the frame reads as beaten metal rather than a plain box.
    for corner in ((1, 1), (22, 1), (1, 22), (22, 22)):
        canvas.set(corner[0], corner[1], BRONZE_3)
    return canvas


def wax_seal() -> Canvas:
    """24 px emblem pressed into blood-red wax."""
    canvas = Canvas(24, 24)
    for y in range(24):
        for x in range(24):
            # Wax disc: a rounded blob, darkest at the rim.
            dx, dy = x - 11.5, y - 11.5
            distance = (dx * dx + dy * dy) ** 0.5
            if distance > 11.5:
                continue
            if distance > 10.5:
                canvas.set(x, y, BLOOD_0)
            elif distance > 9.0:
                canvas.set(x, y, BLOOD_1)
            elif distance > 7.6:
                canvas.set(x, y, BLOOD_0)
            else:
                canvas.set(x, y, BLOOD_1)
    emblem = build_emblem()
    for y in range(24):
        for x in range(24):
            pixel = emblem.get(x, y)
            if pixel[3] and canvas.get(x, y)[3]:
                canvas.set(x, y, pixel)
    # Wax highlight sweep, lower-right.
    for y in range(13, 21):
        canvas.set(20 - (y - 13) // 3, y, hex_to_rgba("#B4553F"))
    return canvas


def item_cursor() -> Canvas:
    canvas = Canvas(10, 10)
    canvas.blit_mask(
        0,
        1,
        [
            "#.........",
            "##........",
            "###.......",
            "####......",
            "#####.....",
            "####......",
            "###.......",
            "##........",
            "#.........",
        ],
        BRONZE_2,
    )
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()

    panels = {
        "panel_parchment": panel(8, PARCH_2, PARCH_3, PARCH_0, BRONZE_1),
        "panel_oak": panel(6, OAK_2, hex_to_rgba("#A06A3C"), OAK_0, INK_0),
        "panel_ink": panel(4, INK_2, hex_to_rgba("#263038"), INK_0, INK_0),
    }
    buttons = {state: button(state) for state in ("normal", "hover", "pressed", "disabled")}
    blood_buttons = {state: button_blood(state) for state in ("normal", "hover", "pressed", "disabled")}
    pills = {state: pill(state) for state in ("normal", "hover", "selected")}
    tabs = {state: tab(state) for state in ("normal", "hover", "selected")}
    scroll = {part: scrollbar(part) for part in ("thumb", "track")}
    extras = {
        "wax_seal": wax_seal(),
        "item_cursor": item_cursor(),
        "tooltip_box": tooltip_box(),
        "portrait_frame": portrait_frame(),
    }

    if args.preview:
        print(preview_grid(list(panels.values())))
        print(preview_grid(list(buttons.values()) + list(extras.values()))[:80])
        return 0

    os.makedirs(OUT_DIR, exist_ok=True)
    for name, canvas in panels.items():
        canvas.save(os.path.join(OUT_DIR, "%s.png" % name))
    for state, canvas in buttons.items():
        canvas.save(os.path.join(OUT_DIR, "button_%s.png" % state))
    for state, canvas in blood_buttons.items():
        canvas.save(os.path.join(OUT_DIR, "button_blood_%s.png" % state))
    for state, canvas in pills.items():
        canvas.save(os.path.join(OUT_DIR, "pill_%s.png" % state))
    for state, canvas in tabs.items():
        canvas.save(os.path.join(OUT_DIR, "tab_%s.png" % state))
    for part, canvas in scroll.items():
        canvas.save(os.path.join(OUT_DIR, "scrollbar_%s.png" % part))
    for name, canvas in extras.items():
        canvas.save(os.path.join(OUT_DIR, "%s.png" % name))
    with open(os.path.join(OUT_DIR, "ui_kit.json"), "w", encoding="utf-8") as fh:
        json.dump(KIT, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("wrote %d panels, %d buttons (+%d blood), %d pills, %d tabs, %d scroll parts, "
          "%d sprites"
          % (len(panels), len(buttons), len(blood_buttons), len(pills), len(tabs),
             len(scroll), len(extras)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
