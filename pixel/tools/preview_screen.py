#!/usr/bin/env python3
"""Render the shell's screens to PNG **without Godot**, from the shipped assets.

This is the layout lint: it draws the same rects, the same strings, the same
fonts and the same nine-patches the engine does, so a preview that looks right
is strong evidence the in-engine screen looks right too — and it catches text
that would overflow its panel before anyone opens the editor.

    python3 tools/preview_screen.py                 # every screen
    python3 tools/preview_screen.py menu sting      # just those two
    python3 tools/preview_screen.py --scale 2       # 2x for legibility

Output lands in `pixel/preview/<screen>.png` (git-ignored). The previewer knows
nothing about Godot: it reads `data/`, `assets/fonts/*.fnt`, `assets/pixel/ui/`
and the same layout constants the screens use.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.pixel_io import Canvas, hex_to_rgba  # noqa: E402
from lib.png_read import read_png  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UI_DIR = os.path.join(ROOT, "assets", "pixel", "ui")
FONT_DIR = os.path.join(ROOT, "assets", "fonts")
OUT_DIR = os.path.join(ROOT, "preview")

WIDTH, HEIGHT = 480, 270


# --------------------------------------------------------------------------
# fonts
# --------------------------------------------------------------------------
class BitmapFont:
    def __init__(self, name: str) -> None:
        self.name = name
        path = os.path.join(FONT_DIR, "%s.fnt" % name)
        self.chars: dict[str, dict] = {}
        self.line_height = 8
        self.ascent = 7
        page = None
        for line in open(path, encoding="utf-8").read().splitlines():
            tag, _, rest = line.partition(" ")
            if tag == "common":
                values = dict(item.split("=") for item in rest.split(" ") if "=" in item)
                self.line_height = int(values.get("lineHeight", 8))
                self.ascent = int(values.get("base", 7))
            elif tag == "page":
                page = rest.split('file="')[1].split('"')[0]
            elif tag == "char":
                values = dict(item.split("=") for item in rest.split(" ") if "=" in item)
                self.chars[chr(int(values["id"]))] = {
                    key: int(values[key]) for key in ("x", "y", "width", "height",
                                                      "xoffset", "yoffset", "xadvance")
                }
        self.atlas = read_png(os.path.join(FONT_DIR, page))

    def advance(self, char: str) -> int:
        glyph = self.chars.get(char)
        return glyph["xadvance"] if glyph else 0

    def text_width(self, text: str) -> int:
        return sum(self.advance(char) for char in text)

    def draw(self, canvas: Canvas, text: str, x: int, y: int, colour) -> None:
        pen = x
        for char in text:
            glyph = self.chars.get(char)
            if glyph is None:
                continue
            for gy in range(glyph["height"]):
                for gx in range(glyph["width"]):
                    if self.atlas.get(glyph["x"] + gx, glyph["y"] + gy)[3] > 0:
                        canvas.set(pen + glyph["xoffset"] + gx,
                                   y + glyph["yoffset"] + gy, colour)
            pen += glyph["xadvance"]

    def draw_centred(self, canvas: Canvas, text: str, centre_x: int, y: int, colour) -> None:
        self.draw(canvas, text, centre_x - self.text_width(text) // 2, y, colour)

    def draw_right(self, canvas: Canvas, text: str, right_x: int, y: int, colour) -> None:
        self.draw(canvas, text, right_x - self.text_width(text), y, colour)

    def wrap(self, text: str, width: float) -> str:
        lines: list[str] = []
        current = ""
        for word in text.split(" "):
            candidate = word if not current else current + " " + word
            if self.text_width(candidate) > width and current:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        return "\n".join(lines)

    def measure(self, text: str, width: float, line_spacing: int = 0) -> tuple[int, int]:
        wrapped = self.wrap(text, width)
        lines = wrapped.split("\n")
        return max(self.text_width(line) for line in lines), len(lines) * (self.line_height + line_spacing)


# --------------------------------------------------------------------------
# assets
# --------------------------------------------------------------------------
class Shell:
    def __init__(self) -> None:
        self.strings = json.load(open(os.path.join(ROOT, "data", "strings.json"), encoding="utf-8"))
        self.timings = json.load(open(os.path.join(ROOT, "data", "shell_timings.json"), encoding="utf-8"))
        self.kit = json.load(open(os.path.join(UI_DIR, "ui_kit.json"), encoding="utf-8"))
        self.fonts = {
            "ui": BitmapFont("pixel_ui_5"),
            "body": BitmapFont("pixel_body_8"),
            "display": BitmapFont("pixel_display_10"),
        }
        self._images: dict[str, Canvas] = {}

    def t(self, key: str) -> str:
        return self.strings["spec"].get(key) or self.strings["build"].get(key, "<%s>" % key)

    def image(self, name: str) -> Canvas:
        if name not in self._images:
            self._images[name] = read_png(os.path.join(UI_DIR, name))
        return self._images[name]

    def blit(self, canvas: Canvas, image: Canvas, x: int, y: int) -> None:
        """Alpha-composite `image` onto `canvas` at (x, y)."""
        for iy in range(image.height):
            for ix in range(image.width):
                r, g, b, a = image.get(ix, iy)
                if a == 0:
                    continue
                if a == 255:
                    canvas.set(x + ix, y + iy, (r, g, b, 255))
                    continue
                dr, dg, db, _ = canvas.get(x + ix, y + iy)
                mix = a / 255.0
                canvas.set(x + ix, y + iy, (
                    int(r * mix + dr * (1 - mix)),
                    int(g * mix + dg * (1 - mix)),
                    int(b * mix + db * (1 - mix)),
                    255,
                ))

    def panel(self, canvas: Canvas, style: str, rect: tuple[int, int, int, int]) -> None:
        """Nine-patch draw: corners 1:1, edges stretched, middle tiled.

        Mirrors Godot's `NinePatchRect` with `patch_margin_*` = the kit margin.
        """
        entry = self.kit["styles"][style]
        source = self.image(entry["file"].replace("{state}", "normal"))
        margin = entry["margin"]
        size = source.width
        middle = size - margin * 2
        x, y, w, h = rect
        for py in range(h):
            if py < margin:
                sy = py
            elif py >= h - margin:
                sy = size - (h - py)
            else:
                sy = margin + (py - margin) % middle
            for px in range(w):
                if px < margin:
                    sx = px
                elif px >= w - margin:
                    sx = size - (w - px)
                else:
                    sx = margin + (px - margin) % middle
                colour = source.get(sx, sy)
                if colour[3]:
                    canvas.set(x + px, y + py, colour)


# --------------------------------------------------------------------------
# screens
# --------------------------------------------------------------------------
INK = hex_to_rgba("#101418")
PARCHMENT = hex_to_rgba("#E9DFC8")
PARCH_1 = hex_to_rgba("#D6C6A3")
BRONZE = hex_to_rgba("#B0793A")
BRONZE_3 = hex_to_rgba("#D9A463")
MINT = hex_to_rgba("#74E0B4")
WHITE = (255, 255, 255, 255)


def screen_legal(shell: Shell) -> Canvas:
    canvas = Canvas(WIDTH, HEIGHT, INK)
    shell.blit(canvas, shell.image("logo_emblem.png"), 228, 20)
    body = shell.fonts["body"]
    ui = shell.fonts["ui"]
    cursor = 56.0
    for key, anchor, colour in (
        ("STR_DISCLAIMER_FULL", 56, PARCHMENT),
        ("STR_SRD_ATTRIBUTION", 116, PARCH_1),
        ("STR_ENGINE_LINE", 168, PARCH_1),
        ("STR_FONT_LINE", 180, PARCH_1),
    ):
        text = shell.t(key)
        wrapped = body.wrap(text, 384)
        _, height = body.measure(text, 384, -2)
        y = max(anchor, cursor)
        for index, line in enumerate(wrapped.split("\n")):
            body.draw_centred(canvas, line, 240, int(y) + index * (body.line_height - 2), colour)
        cursor = y + height + 8
    ui.draw_centred(canvas, shell.t("STR_BOOT_ANY"), 240, 250, BRONZE_3)
    return canvas


def screen_menu(shell: Shell, hover: int = 0) -> Canvas:
    layout = shell.timings["menu"]
    canvas = Canvas(WIDTH, HEIGHT, WHITE)
    display = shell.fonts["display"]
    ui = shell.fonts["ui"]

    lock_x, lock_y = layout["lockup_rect"][0], layout["lockup_rect"][1]
    shell.blit(canvas, shell.image("logo_menu.png"), lock_x, lock_y)

    item_x, item_y, item_w, item_h = layout["item_rect"]
    pitch = layout["item_pitch"]
    labels = ["STR_MENU_PLAY", "STR_MENU_CONTINUE", "STR_MENU_OPTIONS",
              "STR_MENU_CODEX", "STR_MENU_CREDITS"]
    for index, key in enumerate(labels):
        text = shell.t(key)
        y = item_y + pitch * index
        text_y = y + (item_h - display.line_height) // 2 + 1
        display.draw(canvas, text, item_x, text_y, INK)
        if index == hover:
            canvas.rect(item_x, y + layout["underline_offset_y"],
                        display.text_width(text), layout["underline_height"], BRONZE)
        elif index == hover:
            pass

    footer = _blend(INK, WHITE, layout["disclaimer_alpha"])
    disclaimer = shell.t("STR_DISCLAIMER_ABRIDGED")
    ui.draw(canvas, disclaimer, layout["disclaimer_rect"][0], layout["disclaimer_rect"][1], footer)
    stamp = shell.t("STR_VERSION_STAMP").format("0.4.0-pixel", "2026-09-23")
    stamp_rect = layout["version_stamp_rect"]
    ui.draw_right(canvas, stamp, stamp_rect[0] + stamp_rect[2], stamp_rect[1], footer)
    return canvas


def screen_menu_tooltip(shell: Shell) -> Canvas:
    """The menu with CONTINUE dimmed and its tooltip showing (§5.4)."""
    canvas = screen_menu(shell, hover=1)
    display = shell.fonts["display"]
    ui = shell.fonts["ui"]
    layout = shell.timings["menu"]
    item_x, item_y, item_w, item_h = layout["item_rect"]
    y = item_y + layout["item_pitch"]
    # dim CONTINUE to 40 % by redrawing it lightened
    canvas.rect(item_x, y - 2, display.text_width(shell.t("STR_MENU_CONTINUE")),
                item_h, WHITE)
    display.draw(canvas, shell.t("STR_MENU_CONTINUE"), item_x,
                 y + (item_h - display.line_height) // 2 + 1,
                 _blend(INK, WHITE, layout["disabled_dim"]))
    shell.panel(canvas, "panel_parchment", (177, y - 1, 164, 12))
    ui.draw(canvas, shell.t("STR_MENU_NOSAVE"), 181, y + 1, INK)
    return canvas


def screen_sting_end(shell: Shell) -> Canvas:
    """The sting's end frame: emblem with all three steps lit, wordmark, sublock."""
    canvas = Canvas(WIDTH, HEIGHT, INK)
    shell.blit(canvas, shell.image("logo_emblem.png"), 228, 40)
    brand = json.load(open(os.path.join(ROOT, "data", "brand.json"), encoding="utf-8"))
    for step in brand["emblem"]["steps"]:
        canvas.rect(228 + step["x"], 40 + step["y"], step["w"], 2, MINT)
    strip = shell.image("logo_wordmark_strip.png")
    for cell in range(5):
        region = strip.crop(cell * 14, 0, 14, strip.height)
        shell.blit(canvas, region, 205 + cell * 14, 84)
    ui = shell.fonts["ui"]
    ui.draw_centred(canvas, shell.t("STR_SUBLOCK_1"), 240, 120, BRONZE_3)
    ui.draw_centred(canvas, shell.t("STR_SUBLOCK_2"), 240, 132, BRONZE_3)
    return canvas


def screen_stub(shell: Shell, stub: str = "play") -> Canvas:
    canvas = screen_menu(shell)
    # Dim the menu behind the card, exactly as the stub screen does with a
    # 50 % ink overlay.
    for y in range(HEIGHT):
        for x in range(WIDTH):
            r, g, b, _ = canvas.get(x, y)
            canvas.set(x, y, (int(r * 0.5 + 8), int(g * 0.5 + 10), int(b * 0.5 + 12), 255))
    rect = tuple(shell.timings["screens"]["stub_card_rect"])
    shell.panel(canvas, "panel_parchment", rect)
    display, body, ui = shell.fonts["display"], shell.fonts["body"], shell.fonts["ui"]
    cx = rect[0] + rect[2] // 2
    display.draw_centred(canvas, shell.t("STR_STUB_%s_TITLE" % stub.upper()), cx,
                         rect[1] + 12, INK)
    wrapped = body.wrap(shell.t("STR_STUB_%s_BODY" % stub.upper()), rect[2] - 40)
    for index, line in enumerate(wrapped.split("\n")):
        body.draw(canvas, line, rect[0] + 20, rect[1] + 40 + index * body.line_height, INK)
    hint = ui.wrap(shell.t("STR_STUB_CARD_HINT"), rect[2] - 40)
    for index, line in enumerate(hint.split("\n")):
        ui.draw(canvas, line, rect[0] + 20, rect[1] + 82 + index * ui.line_height,
                _blend(INK, PARCHMENT, 0.7))
    button_rect = (rect[0] + (rect[2] - 88) // 2, rect[1] + rect[3] - 30, 88, 18)
    shell.panel(canvas, "button", button_rect)
    ui.draw_centred(canvas, shell.t("STR_BACK"), button_rect[0] + button_rect[2] // 2,
                    button_rect[1] + 6, INK)
    return canvas


def _blend(front, back, alpha: float):
    return tuple(int(front[i] * alpha + back[i] * (1 - alpha)) for i in range(3)) + (255,)


SCREENS = {
    "legal": screen_legal,
    "menu": screen_menu,
    "menu-tooltip": screen_menu_tooltip,
    "sting-end": screen_sting_end,
    "stub": screen_stub,
}


def upscale(canvas: Canvas, factor: int) -> Canvas:
    out = Canvas(canvas.width * factor, canvas.height * factor)
    for y in range(canvas.height):
        for x in range(canvas.width):
            colour = canvas.get(x, y)
            for sy in range(factor):
                for sx in range(factor):
                    out.set(x * factor + sx, y * factor + sy, colour)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("screens", nargs="*", help="screen ids (default: all)")
    parser.add_argument("--scale", type=int, default=2, help="integer upscale for legibility")
    args = parser.parse_args()

    wanted = args.screens or list(SCREENS)
    unknown = [name for name in wanted if name not in SCREENS]
    if unknown:
        print("unknown screen(s): %s (known: %s)" % (", ".join(unknown), ", ".join(SCREENS)))
        return 2

    os.makedirs(OUT_DIR, exist_ok=True)
    shell = Shell()
    for name in wanted:
        canvas = SCREENS[name](shell)
        out = upscale(canvas, max(1, args.scale))
        path = os.path.join(OUT_DIR, "%s.png" % name)
        out.save(path)
        print("wrote %s (%dx%d, %dx scale)" % (os.path.relpath(path, os.path.dirname(ROOT)),
                                               out.width, out.height, max(1, args.scale)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
