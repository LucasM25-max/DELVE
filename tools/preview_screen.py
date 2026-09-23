#!/usr/bin/env python3
"""Render the shell's screens to PNG without a browser, from the shipped assets.

This is the layout lint: it draws the same rects, the same strings, the same
fonts (the same coverage atlas `web/tests/shoot.mjs` draws through) and the same
nine-patches the pages do, so a preview that looks right is strong evidence the
live page looks right too — and it catches text that would
overflow its panel before anyone opens the site. `web/tests/shoot.mjs` is the
counterpart that renders the *JavaScript* screens through a real painter.

    python3 tools/preview_screen.py                 # every screen
    python3 tools/preview_screen.py menu sting-end  # just those two
    python3 tools/preview_screen.py --scale 2       # 2x for legibility

Output lands in `web/preview/<screen>.png` (git-ignored). The previewer reads
`web/data/`, the text faces' metrics and atlas (`web/assets/fonts/`, `tools/atlas/`),
`web/assets/pixel/ui/` and the same layout
constants the screens use.
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
WEB = os.path.join(ROOT, "web")
UI_DIR = os.path.join(WEB, "assets", "pixel", "ui")
FONT_DIR = os.path.join(WEB, "assets", "fonts")
ATLAS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "atlas")
OUT_DIR = os.path.join(WEB, "preview")

WIDTH, HEIGHT = 480, 270


# --------------------------------------------------------------------------
# fonts
# --------------------------------------------------------------------------
class TextFace:
    """One role's type, as the offline renderer draws it.

    Metrics come from `web/data/fonts.json` and `web/assets/fonts/font_metrics.json`
    (the same two files the page reads), and the ink comes from the 1:1 coverage
    atlas `tools/build_text_faces.py` bakes into `tools/atlas/` — a browser has a
    font rasteriser, this previewer does not. `draw()` takes the top-left of the
    line box, exactly as `TextFace.draw` does in the page.
    """

    def __init__(self, role: str) -> None:
        manifest = json.load(open(os.path.join(WEB, "data", "fonts.json"), encoding="utf-8"))
        metrics = json.load(open(os.path.join(FONT_DIR, "font_metrics.json"), encoding="utf-8"))
        atlas = json.load(open(os.path.join(ATLAS_DIR, "glyph_atlas.json"), encoding="utf-8"))
        self.role = role
        definition = manifest["faces"][role]
        entry = atlas["faces"][role]
        source = metrics["sources"][definition["source"]]
        self.size = int(definition["size"])
        self.ascent = int(definition["ascent"])
        self.descent = int(definition["descent"])
        self.line_height = int(definition["lineHeight"])
        self.units_per_em = int(source["unitsPerEm"])
        self.advances = {int(code): units for code, units in source["advances"].items()}
        self.glyphs = {int(code): rect for code, rect in entry["glyphs"].items()}
        self.atlas = read_png(os.path.join(ATLAS_DIR, entry["file"]))
        # A character with no advance (a browser fallback glyph) still needs a
        # width; half an em is what `js/ui/font.js` assumes too.
        self.fallback = max(1, round(self.size * 0.5))

    def advance(self, char: str) -> int:
        units = self.advances.get(ord(char))
        if units is None:
            return self.fallback
        return max(1, int(units * self.size / self.units_per_em + 0.5))

    def text_width(self, text: str) -> int:
        return sum(self.advance(char) for char in text)

    def draw(self, canvas: Canvas, text: str, x: int, y: int, colour) -> None:
        """Composite one run at (x, y): the top-left of its line box."""
        pen = int(x)
        top = int(y)
        for char in text:
            glyph = self.glyphs.get(ord(char))
            if glyph is not None:
                gx, gy, width, height, offset_x, offset_y = glyph
                for row in range(height):
                    for column in range(width):
                        coverage = self.atlas.get(gx + column, gy + row)[3]
                        if coverage <= 0:
                            continue
                        blend(canvas, pen + offset_x + column, top + offset_y + row,
                              colour, coverage / 255.0)
            pen += self.advance(char)

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
        return (max(self.text_width(line) for line in lines),
                len(lines) * (self.line_height + line_spacing))


def blend(canvas: Canvas, x: int, y: int, colour, coverage: float) -> None:
    """Alpha-composite one coverage-weighted pixel onto the canvas."""
    if coverage <= 0 or not canvas.in_bounds(x, y):
        return
    if coverage >= 1:
        canvas.set(x, y, colour)
        return
    r, g, b, a = canvas.get(x, y)
    alpha = min(1.0, coverage) * (colour[3] / 255.0)
    canvas.set(x, y, (
        int(round(colour[0] * alpha + r * (1 - alpha))),
        int(round(colour[1] * alpha + g * (1 - alpha))),
        int(round(colour[2] * alpha + b * (1 - alpha))),
        int(round(255 * (alpha + (a / 255.0) * (1 - alpha)))),
    ))


# --------------------------------------------------------------------------
# assets
# --------------------------------------------------------------------------
class Shell:
    def __init__(self) -> None:
        self.strings = json.load(open(os.path.join(WEB, "data", "strings.json"), encoding="utf-8"))
        self.timings = json.load(open(os.path.join(WEB, "data", "shell_timings.json"), encoding="utf-8"))
        self.kit = json.load(open(os.path.join(UI_DIR, "ui_kit.json"), encoding="utf-8"))
        self.fonts = {role: TextFace(role) for role in ("ui", "body", "display")}
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
                    round(r * mix + dr * (1 - mix)),
                    round(g * mix + dg * (1 - mix)),
                    round(b * mix + db * (1 - mix)),
                    255,
                ))

    def panel(self, canvas: Canvas, style: str, rect: tuple[int, int, int, int],
              state: str = "normal") -> None:
        """Nine-patch draw: corners 1:1, edges stretched, middle tiled.

        Corners blit 1:1 and the edges/middle stretch, exactly as
        `web/js/ui/kit.js` does with the kit's own margin, so a 16 px pill or tab
        stretches to whatever width the layout asks for.
        """
        entry = self.kit["styles"][style]
        filename = entry["file"].replace("{state}", state)
        if "{part}" in filename:
            filename = filename.replace("{part}", state)
        self.nine(canvas, filename, entry["margin"], rect)

    def nine(self, canvas: Canvas, filename: str, margin: int,
             rect: tuple[int, int, int, int]) -> None:
        """Nine-patch: corners 1:1, edges and middle stretched.

        The same nine slices `web/js/ui/render.js` draws, in the same order and
        with the same clamped margin, so a panel here and a panel in the game are
        identical — and both are nine blits rather than one per pixel-run.
        """
        source = self.image(filename)
        size = source.width
        x, y, w, h = rect
        if w <= 0 or h <= 0:
            return
        edge = max(1, min(margin, size // 2, w // 2, h // 2))
        inner = size - edge * 2
        far = size - edge
        across = w - edge * 2
        down = h - edge * 2

        def slice_(sx: int, sy: int, sw: int, sh: int, dx: int, dy: int,
                   dw: int, dh: int) -> None:
            if sw <= 0 or sh <= 0 or dw <= 0 or dh <= 0:
                return
            for py in range(dh):
                source_y = sy + min(sh - 1, (py * sh) // dh)
                for px in range(dw):
                    source_x = sx + min(sw - 1, (px * sw) // dw)
                    colour = source.get(source_x, source_y)
                    if colour[3]:
                        canvas.set(dx + px, dy + py, colour)

        slice_(0, 0, edge, edge, x, y, edge, edge)
        slice_(far, 0, edge, edge, x + w - edge, y, edge, edge)
        slice_(0, far, edge, edge, x, y + h - edge, edge, edge)
        slice_(far, far, edge, edge, x + w - edge, y + h - edge, edge, edge)
        slice_(edge, 0, inner, edge, x + edge, y, across, edge)
        slice_(edge, far, inner, edge, x + edge, y + h - edge, across, edge)
        slice_(0, edge, edge, inner, x, y + edge, edge, down)
        slice_(far, edge, edge, inner, x + w - edge, y + edge, edge, down)
        slice_(edge, edge, inner, inner, x + edge, y + edge, across, down)


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
    brand = json.load(open(os.path.join(WEB, "data", "brand.json"), encoding="utf-8"))
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



def _pill_row_selected(shell: Shell, canvas: Canvas, rect, values, selected) -> None:
    """Segmented pills exactly as PixelPillGroup lays them out (§5.5/§5.6):
    width = text + 6 px padding, height 16, gap 4, selected = bronze fill + ink."""
def _pill_row_selected(shell: Shell, canvas: Canvas, rect, values, selected) -> None:
    ui = shell.fonts["ui"]
    x, y, _, _ = rect
    for value in values:
        width = ui.text_width(value) + 6
        state = "selected" if value == selected else "normal"
        shell.panel(canvas, "pill", (x, y, width, 16), state)
        ui.draw_centred(canvas, value, x + width // 2, y + 5, INK)
        x += width + 4


def _help_block(shell: Shell, canvas: Canvas, text: str,
                rect: tuple[int, int, int, int]) -> None:
    """Help prose: body 8 px, wrapped to the rect, line pitch 8 px (§5.5)."""
    if not text:
        return
    body = shell.fonts["body"]
    pitch = body.line_height + shell.timings["screens"]["first_run"].get("help_line_spacing", -3)
    colour = _blend(INK, (214, 198, 163, 255), 0.78)
    for index, line in enumerate(body.wrap(text, rect[2]).split("\n")):
        body.draw(canvas, line, rect[0], rect[1] + index * pitch, colour)


def _control_width(shell: Shell, values) -> int:
    ui = shell.fonts["ui"]
    return sum(ui.text_width(value) + 6 for value in values) + 4 * (len(values) - 1)


def screen_new_contract(shell: Shell) -> Canvas:
    """The menu with the `Begin a new contract?` overlay card on top (§5.5)."""
    canvas = _dim(screen_menu(shell), 0.55)
    card = shell.timings["screens"]["new_contract_card"]
    rect = tuple(card["rect"])
    shell.panel(canvas, "panel_parchment", rect)
    shell.blit(canvas, shell.image("wax_seal.png"), card["seal_rect"][0], card["seal_rect"][1])
    ui, body = shell.fonts["ui"], shell.fonts["body"]
    title_rect = card["title_rect"]
    ui.draw(canvas, shell.t("STR_NEW_TITLE"), title_rect[0], title_rect[1] + 2, INK)
    text = shell.t("STR_NEW_BODY").format("New contract", "Unassigned", 1, "Prologue")
    body_rect = card["body_rect"]
    for index, line in enumerate(body.wrap(text, body_rect[2]).split("\n")):
        body.draw(canvas, line, body_rect[0], body_rect[1] + index * body.line_height, INK)
    _button(shell, canvas, tuple(card["begin_rect"]), shell.t("STR_NEW_BEGIN"))
    _button(shell, canvas, tuple(card["back_rect"]), shell.t("STR_BACK"), state="hover")
    return canvas


def screen_first_run(shell: Shell) -> Canvas:
    """The First Run contract page (§5.5): panel, three pill groups, footer."""
    layout = shell.timings["screens"]["first_run"]
    canvas = Canvas(WIDTH, HEIGHT, WHITE)
    panel = tuple(layout["panel"])
    shell.panel(canvas, "panel_parchment", panel)
    display, ui, body = shell.fonts["display"], shell.fonts["ui"], shell.fonts["body"]
    display.draw_centred(canvas, shell.t("STR_FR_TITLE"), panel[0] + panel[2] // 2,
                         panel[1] + 8, INK)

    content_x = layout["content_x"]
    content_w = layout["content_w"]
    group_ys = layout["group_ys"]
    pills_y = layout["label_to_pills"]
    schema = json.load(open(os.path.join(WEB, "data", "options_schema.json"), encoding="utf-8"))
    rows = {row["id"]: row for tab in schema["tabs"] for row in tab["rows"]}

    groups = [
        (shell.t("STR_FR_DIFF"), group_ys[0], "difficulty", rows["difficulty"]),
        (shell.t("STR_FR_PACE"), group_ys[1], "combat_pacing", rows["combat_pacing"]),
    ]
    help_y = layout["help_offset_y"]
    for label, y, row_id, row in groups:
        ui.draw(canvas, label, content_x, y, INK)
        _pill_row_selected(shell, canvas, (content_x, y + pills_y, 0, 0),
                           row["values"], row["default"])
        _help_block(shell, canvas, row.get("help", ""),
                    (content_x, y + help_y, content_w, 24))
    # Skirmish's SECONDARY tag, right-aligned on the Combat pacing label line.
    tag = "SECONDARY"
    tag_x = content_x + content_w - ui.text_width(tag) - 4
    ui.draw(canvas, tag, tag_x, group_ys[1], BRONZE)
    canvas.rect(tag_x, group_ys[1] + 7, ui.text_width(tag) + 4, 1, BRONZE_3)

    # Subtitles + Camera comfort preset share the third group's line.
    right_x = layout["right_column_x"]
    ui.draw(canvas, shell.t("STR_FR_SUBS"), content_x, group_ys[2], INK)
    _pill_row_selected(shell, canvas, (content_x, group_ys[2] + pills_y, 0, 0),
                       rows["subtitles"]["values"], rows["subtitles"]["default"])
    ui.draw(canvas, shell.t("STR_FR_COMFORT"), right_x, group_ys[2], INK)
    _pill_row_selected(shell, canvas, (right_x, group_ys[2] + pills_y, 0, 0),
                       rows["reduced_motion"]["values"], "Standard")
    _help_block(shell, canvas, rows["subtitles"].get("help", ""),
                tuple(layout["comfort_help_rect"]))
    _help_block(shell, canvas, rows["reduced_motion"].get("help", ""),
                tuple(layout["comfort_right_help_rect"]))

    _button(shell, canvas, tuple(layout["back_rect"]), shell.t("STR_BACK"))
    _button(shell, canvas, tuple(layout["go_rect"]), shell.t("STR_FR_GO"))
    return canvas


def screen_ledger(shell: Shell) -> Canvas:
    """The contract ledger (§5.5) with one signed contract in slot 1."""
    layout = shell.timings["screens"]["ledger"]
    canvas = Canvas(WIDTH, HEIGHT, WHITE)
    panel = tuple(layout["panel"])
    shell.panel(canvas, "panel_parchment", panel)
    display, ui = shell.fonts["display"], shell.fonts["ui"]
    display.draw_centred(canvas, shell.t("STR_LEDGER_TITLE"), panel[0] + panel[2] // 2,
                         layout["title_y"], INK)

    row_x, row_y, row_w, row_h = layout["row_rect"]
    pitch = layout["row_pitch"]
    samples = [
        {"name": "New contract", "class": "Unassigned", "chapter": "Prologue",
         "date": "2026-09-23", "stamp": "logo_emblem_step1.png"},
    ]
    for index in range(layout["row_count"]):
        y = row_y + pitch * index
        if index < len(samples):
            entry = samples[index]
            shell.blit(canvas, shell.image(entry["stamp"]), row_x + layout["stamp_x"], y)
            ui.draw(canvas, entry["name"], row_x + layout["name_x"], y + 2, INK)
            ui.draw(canvas, "%s · %s" % (entry["class"], entry["chapter"]),
                    row_x + layout["name_x"], y + 13, _blend(INK, (214, 198, 163, 255), 0.7))
            ui.draw_right(canvas, entry["date"], row_x + row_w - 52, y + 2,
                          _blend(INK, (214, 198, 163, 255), 0.6))
            _button(shell, canvas, (row_x + row_w - 46, y + 3, 46, 18),
                    shell.t("STR_LEDGER_DELETE"), "button_blood", PARCHMENT)
        else:
            ui.draw(canvas, shell.t("STR_LEDGER_EMPTY"), row_x + layout["name_x"],
                    y + 8, _blend(INK, (214, 198, 163, 255), 0.4))

    hint = layout["hint_rect"]
    ui.draw(canvas, shell.t("STR_LEDGER_HINT"), hint[0], hint[1], _blend(INK, WHITE, 0.6))
    _button(shell, canvas, tuple(layout["back_rect"]), shell.t("STR_BACK"))
    return canvas


def screen_ledger_confirm(shell: Shell) -> Canvas:
    """The blood confirm card: `Break this contract?` · `BREAK` · `KEEP`."""
    canvas = screen_ledger(shell)
    layout = shell.timings["screens"]["ledger"]
    canvas = _dim(canvas, 0.55)
    rect = tuple(layout["card_rect"])
    shell.panel(canvas, "panel_parchment", rect)
    ui = shell.fonts["ui"]
    ui.draw_centred(canvas, shell.t("STR_BREAK_TITLE"), rect[0] + rect[2] // 2, rect[1] + 28, INK)
    _button(shell, canvas, tuple(layout["break_rect"]), shell.t("STR_BREAK_YES"),
            "button_blood", PARCHMENT)
    _button(shell, canvas, tuple(layout["keep_rect"]), shell.t("STR_BREAK_NO"), state="hover")
    return canvas


def screen_options(shell: Shell, tab_index: int = 0, scroll: int = 0,
                   listening_row: str = "") -> Canvas:
    """The Options page (§5.6) for one tab: rail, rows, help line, BACK."""
    layout = shell.timings["screens"]["options"]
    canvas = Canvas(WIDTH, HEIGHT, WHITE)
    shell.panel(canvas, "panel_ink", tuple(layout["tab_rail"]))
    shell.panel(canvas, "panel_parchment", tuple(layout["rows_panel"]))

    labels = ["STR_OPTIONS_TAB_GRAPHICS", "STR_OPTIONS_TAB_GAMEPLAY",
              "STR_OPTIONS_TAB_ACCESSIBILITY", "STR_OPTIONS_TAB_AUDIO",
              "STR_OPTIONS_TAB_CONTROLS"]
    ui = shell.fonts["ui"]
    tab_x, tab_y, tab_w, tab_h = layout["tab_rect"]
    for index, key in enumerate(labels):
        y = tab_y + layout["tab_pitch"] * index
        state = "selected" if index == tab_index else "normal"
        shell.panel(canvas, "tab", (tab_x, y, tab_w, tab_h), state)
        colour = INK if index == tab_index else PARCHMENT
        ui.draw_centred(canvas, shell.t(key), tab_x + tab_w // 2, y + 9, colour)

    schema = json.load(open(os.path.join(WEB, "data", "options_schema.json"), encoding="utf-8"))
    tab = schema["tabs"][tab_index]
    rows = tab["rows"]
    row_x, row_y, row_w, row_h = layout["row_rect"]
    pitch = layout["row_pitch"]
    visible = layout["visible_rows"]
    for index in range(scroll, min(scroll + visible, len(rows))):
        row = rows[index]
        y = row_y + pitch * (index - scroll)
        ui.draw(canvas, row["label"], row_x + layout["label_x"], y + 5, INK)
        _draw_control(shell, canvas, row, row_x + layout["control_right"], y,
                      listening_row == row["id"])

    focused = rows[scroll] if rows else None
    if listening_row:
        # The page shows the capture prompt in its help line while it listens.
        ui.draw(canvas, shell.t("STR_REBIND_LISTEN"), layout["help_rect"][0],
                layout["help_rect"][1], _blend(INK, WHITE, 0.8))
    elif focused is not None:
        help_text = focused.get("help", "")
        for line_index, line in enumerate(ui.wrap(help_text, layout["help_rect"][2]).split("\n")):
            ui.draw(canvas, line, layout["help_rect"][0],
                    layout["help_rect"][1] + line_index * ui.line_height,
                    _blend(INK, WHITE, 0.8))
    if len(rows) > visible:
        ratio = visible / len(rows)
        span = len(rows) - visible
        offset = scroll / span if span else 0.0
        track = layout["scrollbar_rect"]
        shell.blit(canvas, shell.image("scrollbar_track.png"), track[0], track[1])
        height = max(8, int((track[3] - 8) * ratio))
        thumb_y = track[1] + 4 + int((track[3] - 8) * offset)
        shell.blit(canvas, shell.image("scrollbar_thumb.png"), track[0], thumb_y)
    _button(shell, canvas, tuple(layout["back_rect"]), shell.t("STR_BACK"))
    return canvas


def _draw_control(shell: Shell, canvas: Canvas, row: dict, right_x: int, y: int,
                  listening: bool) -> None:
    """One row's right-aligned control, drawn the way `PixelOptionsRow` builds it."""
    ui = shell.fonts["ui"]
    control = row["control"]
    if control in ("list", "toggle"):
        values = row.get("values", [])
        width = _control_width(shell, values)
        _pill_row_selected(shell, canvas, (right_x - width, y + 2, 0, 0),
                           values, row.get("default", ""))
        return
    if control == "slider":
        x = right_x - 95
        value = int(row.get("default", 50))
        filled = int(round(value / 10.0))
        for index in range(10):
            colour = BRONZE if index < filled else hex_to_rgba("#5E3D19")
            canvas.rect(x + index * 7, y + 5, 6, 10, colour)
        ui.draw_right(canvas, str(value), right_x, y + 5, INK)
        return
    if control == "rebind":
        text = shell.t("STR_REBIND_LISTEN") if listening else str(row.get("default", ""))
        width = max(60, ui.text_width(text) + 12)
        shell.panel(canvas, "pill", (right_x - width, y + 2, width, 16), "normal")
        ui.draw_centred(canvas, text, right_x - width // 2, y + 7, INK)
        return
    # locked: dimmed, read-only
    text = str(row.get("default", ""))
    ui.draw_right(canvas, text, right_x, y + 5, _blend(INK, (214, 198, 163, 255), 0.5))


def _button(shell: Shell, canvas: Canvas, rect: tuple[int, int, int, int], text: str,
            family: str = "button", colour=INK, state: str = "normal") -> None:
    """A nine-patched button: parchment `button` or blood `button_blood` (§5.5).

    `state` is the widget's, not the mouse's: a card focuses its first widget, and
    `Button` draws a focused button in its hover patch.
    """
    shell.panel(canvas, family, rect, state)
    ui = shell.fonts["ui"]
    ui.draw_centred(canvas, text, rect[0] + rect[2] // 2, rect[1] + 6, colour)


def _dim(canvas: Canvas, alpha: float = 0.5) -> Canvas:
    """The ink scrim behind a modal card. Cards pass 0.55 (widgets.js `Card`)."""
    keep = 1.0 - alpha
    for y in range(HEIGHT):
        for x in range(WIDTH):
            r, g, b, _ = canvas.get(x, y)
            canvas.set(x, y, (round(r * keep + 16 * alpha), round(g * keep + 20 * alpha),
                              round(b * keep + 24 * alpha), 255))
    return canvas


SCREENS = {
    "legal": screen_legal,
    "menu": screen_menu,
    "menu-tooltip": screen_menu_tooltip,
    "menu-new-contract": screen_new_contract,
    "sting-end": screen_sting_end,
    "stub": screen_stub,
    "first-run": screen_first_run,
    "ledger": screen_ledger,
    "ledger-confirm": screen_ledger_confirm,
    "options-graphics": lambda shell: screen_options(shell, 0),
    "options-accessibility": lambda shell: screen_options(shell, 2),
    "options-audio": lambda shell: screen_options(shell, 3),
    "options-controls": lambda shell: screen_options(shell, 4, scroll=2),
    "options-rebind": lambda shell: screen_options(shell, 4, scroll=1,
                                                   listening_row="bind_interact"),
}


def _blend(front, back, alpha: float):
    """`render.js` rounds every blend; truncating drifts a level per step."""
    return tuple(round(front[i] * alpha + back[i] * (1 - alpha)) for i in range(3)) + (255,)


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
        print("wrote %s (%dx%d, %dx scale)" % (os.path.relpath(path, ROOT),
                                               out.width, out.height, max(1, args.scale)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
