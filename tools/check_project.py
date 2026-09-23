#!/usr/bin/env python3
"""Check the web build's internal consistency — the CI gate for this project.

The game is a static site: `web/index.html` + ES modules + `web/data/*.json` +
`web/assets/**`, served by Vercel from the repo. No engine, no build step.

What this verifies:

  1. every runtime path the page, stylesheet and modules reference exists
     (`data/…`, `assets/…`, `js/…`) — audio excepted, which lands cue by cue;
  2. `index.html` loads the module entry point, and every `import` in
     `web/js/**` resolves to a file that exists;
  3. every JSON under `web/data/` parses and carries the spec's counts, rects
     and timings;
  4. the text faces carry every glyph the shipped strings use — in the shipped
     webfonts, in their metrics table and in the offline atlases;
  5. `web/js/core/palette.js` mirrors `tools/build_palette.py` exactly;
  6. the nine-patch kit (`ui_kit.json`) matches the PNGs it points at;
  7. the §5.5/§5.6 page layouts fit their panels, measured with the real fonts;
  8. the art lint of GDD-07 §7.4: every pixel of every committed PNG sits inside
     the locked 40-colour palette, and `assets/pixel/` stays under 1.5 MB.

Run:  python3 tools/check_project.py
Exit code 0 = clean; 1 = at least one failure (details printed).
"""

from __future__ import annotations

import json
import os
import re
import sys
from typing import Sequence

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.png_read import read_png  # noqa: E402
from lib.strings import charset  # noqa: E402
import build_palette  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")

# Every `data/…`, `assets/…`, `js/…`, `css/…` string the shipped code references.
RUNTIME_PATH = re.compile(r'["\'(]\.?\.?/?(data|assets|js|css)/([A-Za-z0-9_./\-]+)')
IMPORT_LINE = re.compile(r'^\s*import\s[^\'"]*[\'"](\.[^\'"]+)[\'"]', re.M)
SCAN_SUFFIXES = (".html", ".js", ".css", ".json", ".py")
SKIP_DIRS = {"tools/sources", "web/preview", "__pycache__", "node_modules"}

failures: list[str] = []
notes: list[str] = []


def fail(message: str) -> None:
    failures.append(message)


def ok(message: str) -> None:
    notes.append(message)


def walk_files() -> list[str]:
    out: list[str] = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in {"__pycache__", ".git"} and not d.startswith(".")]
        for name in files:
            out.append(os.path.join(base, name))
    return out


def relative(path: str) -> str:
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


# --- 1 + 2: referenced paths -------------------------------------------

def check_referenced_paths() -> None:
    """Every runtime path the shipped code names must exist.

    Audio is the one exception: `data/audio_cues.json` declares the whole cue
    table up front so the game can ask for a cue before the sound design exists,
    and `Sound` skips a file that is not there yet. `check_audio_cues()` reports
    how many are in place.
    """
    missing: dict[str, str] = {}
    for path in walk_files():
        rel = relative(path)
        if not rel.endswith(SCAN_SUFFIXES) or any(s in rel for s in SKIP_DIRS):
            continue
        if rel.endswith(("check_project.py", "check_strings.py", "build_all.py")):
            continue
        try:
            text = open(path, encoding="utf-8").read()
        except UnicodeDecodeError:
            continue
        for prefix, tail in RUNTIME_PATH.findall(text):
            candidate = "%s/%s" % (prefix, tail)
            if prefix == "assets" and tail.startswith("audio/"):
                continue
            target = os.path.join(WEB, candidate)
            if not os.path.exists(target):
                missing.setdefault(candidate, rel)
    for target, source in sorted(missing.items()):
        fail("missing %s (referenced by %s)" % (target, source))
    if not missing:
        ok("every data/, assets/, js/ and css/ path the code names exists")


def check_module_graph() -> None:
    """`index.html` must load a module entry point, and every relative import in
    `web/js/**` must resolve — the static-site equivalent of a project manifest.
    """
    index = os.path.join(WEB, "index.html")
    if not os.path.exists(index):
        fail("web/index.html is missing — Vercel has nothing to serve")
        return
    html = open(index, encoding="utf-8").read()
    entry = re.search(r'<script[^>]+type="module"[^>]+src="([^"]+)"', html)
    if entry is None:
        fail("index.html has no <script type=\"module\" src=…> entry point")
        return
    if not os.path.exists(os.path.join(WEB, entry.group(1))):
        fail("index.html loads %s, which does not exist" % entry.group(1))
    unresolved: list[str] = []
    for path in walk_files():
        rel = relative(path)
        if not rel.startswith("web/js/") or not rel.endswith(".js"):
            continue
        text = open(path, encoding="utf-8").read()
        for target in IMPORT_LINE.findall(text):
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), target))
            if not os.path.exists(resolved):
                unresolved.append("%s -> %s" % (rel, target))
    for row in unresolved:
        fail("unresolved import: %s" % row)
    config_path = os.path.join(ROOT, "vercel.json")
    if not os.path.exists(config_path):
        fail("vercel.json is missing")
    else:
        try:
            config = json.load(open(config_path, encoding="utf-8"))
        except ValueError as error:
            fail("vercel.json does not parse: %s" % error)
            config = {}
        if config.get("outputDirectory") != "web":
            fail("vercel.json must set \"outputDirectory\": \"web\" so the static "
                 "site published at / is the game")
    if not unresolved:
        ok("index.html loads js/%s and every module import resolves"
           % entry.group(1).replace("js/", "", 1))


# --- 3: data files -----------------------------------------------------

def load_json(rel: str) -> dict:
    path = os.path.join(WEB, rel)
    if not os.path.exists(path):
        fail("missing data file %s" % rel)
        return {}
    try:
        return json.load(open(path, encoding="utf-8"))
    except json.JSONDecodeError as error:
        fail("%s does not parse: %s" % (rel, error))
        return {}


def check_data_files() -> None:
    strings = load_json("data/strings.json")
    timings = load_json("data/shell_timings.json")
    content = load_json("data/shell_content.json")
    schema = load_json("data/options_schema.json")
    brand = load_json("data/brand.json")
    cues = load_json("data/audio_cues.json")

    if strings and len(strings.get("spec", {})) != 34:
        fail("strings.json spec block should hold the 34 §5.11 strings, has %d"
             % len(strings.get("spec", {})))
    if content and len(content.get("loading_tips", [])) != 16:
        fail("shell_content.json should hold the 16 §5.9 tips, has %d"
             % len(content.get("loading_tips", [])))
    if schema:
        rows = sum(len(tab.get("rows", [])) for tab in schema.get("tabs", []))
        if rows != 39:
            fail("options_schema.json should hold 39 rows (§5.6), has %d" % rows)
    menu = timings.get("menu", {})
    expected = {"column_x": 29, "item_pitch": 21, "underline_draw_ms": 180,
                "emblem_flicker_ms": 200}
    for key, value in expected.items():
        if menu.get(key) != value:
            fail("shell_timings.menu.%s should be %s (§5.4), is %s"
                 % (key, value, menu.get(key)))
    if timings.get("boot", {}).get("sting", {}).get("total_ms") != 4000:
        fail("shell_timings.boot.sting.total_ms should be 4000 (§5.2)")
    if menu.get("item_rect", [0, 0, 0, 0])[:3] != [29, 92, 140]:
        fail("menu item rect must start at (29,92,140,18) per §5.4")
    # The menu's composition (third pass): a header block, the item column, the
    # contract card and the footer. Each piece must sit inside the canvas and the
    # pieces must not collide — the card is what keeps the right half from being
    # empty, and the item column's foot is where the §5.4 tooltip goes.
    header = menu.get("header", {})
    card = menu.get("contract_panel", {})
    item = menu.get("item_rect", [0, 0, 0, 0])
    item_bottom = item[1] + menu.get("item_pitch", 21) * (menu.get("item_count", 5) - 1) + item[3]
    mark = header.get("mark_rect", [0, 0, 0, 0])
    if mark[0] != item[0]:
        fail("the menu header must share the item column's x (%s)" % item[0])
    if mark[3] != 48 or mark[2] != 48:
        fail("the menu header mark must be the emblem at 2x (48x48), is %s" % mark[2:4])
    if mark[1] + mark[3] > item[1]:
        fail("the menu header runs into the first item row")
    wordmark = header.get("wordmark_rect", [0, 0, 0, 0])
    face = font_manifest().get("faces", {}).get("wordmark", {})
    if face.get("size") != 22:
        fail("the wordmark face must be 22 px (the §5.1 cap height at 2x)")
    text_width = FaceWidths("wordmark").width("DELVE")
    if text_width > wordmark[2]:
        fail("the typed wordmark needs %d px, its field is %d" % (text_width, wordmark[2]))
    panel = card.get("rect", [0, 0, 0, 0])
    _inside(panel, [0, 0, 480, 270], "menu.contract_panel.rect")
    if panel[0] <= item[0] + item[2]:
        fail("the contract card would sit under the item column (%s vs item right edge %d)"
             % (panel, item[0] + item[2]))
    if panel[1] < mark[1] + mark[3]:
        fail("the contract card starts above the header block's bottom")
    for key in ("stamp_rect", "title_rect", "name_rect", "detail_rect", "rule_rect", "hint_rect"):
        _inside(card.get(key, [0, 0, 0, 0]), panel, "menu.contract_panel.%s" % key)
    keys = menu.get("keys_rect", [0, 0, 0, 0])
    if keys[1] < item_bottom:
        fail("the menu key hint at y %d sits on the last item row (ends at %d)" % (keys[1], item_bottom))
    if keys[0] + keys[2] > panel[0]:
        fail("the menu key hint (and the §5.4 tooltip that takes its line) runs under the card")
    rule = menu.get("footer_rule_rect", [0, 0, 0, 0])
    if not (panel[1] + panel[3] <= rule[1] <= menu.get("disclaimer_rect", [0, 0, 0, 8])[1]):
        fail("the footer rule must sit between the contract card and the disclaimer")

    # Footer: the two strings are stacked (see menu._footer_note); both rects
    # must still sit entirely inside the 480x270 canvas.
    for key in ("disclaimer_rect", "version_stamp_rect"):
        rect = menu.get(key)
        if rect is None:
            fail("shell_timings.menu.%s is missing" % key)
            continue
        x, y, w, h = rect
        if x < 0 or y < 0 or x + w > 480 or y + h > 270:
            fail("menu.%s %s falls outside the 480x270 canvas" % (key, rect))
    stamp_x = menu.get("version_stamp_rect", [0, 0, 0, 0])
    if stamp_x[0] + stamp_x[2] != 470:
        fail("the version stamp must stay right-aligned to x = 470 (§5.4)")

    # Brand geometry must describe the PNGs that actually shipped.
    # The retired lockup is gone: the header block below asserts what replaced it.
    for section, filename in (("emblem", "logo_emblem.png"),
                              ("wordmark", "logo_wordmark.png")):
        declared = brand.get(section, {}).get("size")
        path = os.path.join(WEB, "assets", "pixel", "ui", filename)
        if declared is None or not os.path.exists(path):
            fail("brand.json/%s or %s is missing" % (section, filename))
            continue
        image = read_png(path)
        if [image.width, image.height] != declared:
            fail("brand.json says %s is %s but the PNG is %dx%d"
                 % (section, declared, image.width, image.height))
    variants = brand.get("emblem", {}).get("variants", {})
    if variants.get("mark_2x") != "logo_emblem_2x.png":
        fail("brand.json must name the 2x menu mark (logo_emblem_2x.png)")
    if variants.get("mark_2x_steps") != "logo_emblem_steps_2x.png":
        fail("brand.json must name the 2x lit mark (logo_emblem_steps_2x.png)")
    # Both 2x marks must be whole-number doubles of the 24 px originals, or the
    # header would draw its flicker a pixel off the mark underneath it.
    for small_name, big_name in (("logo_emblem.png", "logo_emblem_2x.png"),
                                 ("logo_emblem_steps.png", "logo_emblem_steps_2x.png")):
        small = read_png(os.path.join(WEB, "assets", "pixel", "ui", small_name))
        big = read_png(os.path.join(WEB, "assets", "pixel", "ui", big_name))
        if (big.width, big.height) != (small.width * 2, small.height * 2):
            fail("%s is not a 2x %s (%dx%d vs %dx%d)"
                 % (big_name, small_name, big.width, big.height, small.width, small.height))
            continue
        for y in range(big.height):
            for x in range(big.width):
                if big.get(x, y) != small.get(x // 2, y // 2):
                    fail("%s differs from %s at (%d,%d)" % (big_name, small_name, x, y))
                    break
    if brand.get("wordmark", {}).get("text") != "DELVE":
        fail("brand.json must carry the typed wordmark's text")
    if brand.get("emblem", {}).get("size") != [24, 24]:
        fail("emblem must be 24x24 per §5.1")
    if len(brand.get("emblem", {}).get("steps", [])) != 3:
        fail("emblem must carry three descending steps per §5.1")
    if not cues.get("cues"):
        fail("audio_cues.json is empty")
    else:
        for cue_id in ["SFX_UI_MOVE", "SFX_UI_CONFIRM", "SFX_UI_DENY", "SFX_BOOT_STONE",
                       "SFX_BOOT_EMBERS", "SFX_BOOT_CHISEL", "MUS_BOOT_STING",
                       "MUS_MENU_THEME", "SFX_LOAD_STAMP"]:
            if cue_id not in cues["cues"]:
                fail("audio cue %s is missing (§5.10)" % cue_id)
    if not failures:
        ok("data files parse and carry the spec's counts, rects and timings")


def check_audio_cues() -> None:
    """Report which cue files are present. Missing ones are not an error yet."""
    cues = load_json("data/audio_cues.json").get("cues", {})
    present = []
    for cue_id, entry in cues.items():
        # Cue paths are page-relative (`assets/audio/...`), the same spelling
        # `Sound` fetches, so a cue that resolves here resolves in the browser.
        tail = str(entry.get("file", ""))
        if tail.startswith("assets/audio/"):
            tail = tail[len("assets/audio/"):]
        if os.path.exists(os.path.join(WEB, "assets", "audio", tail)):
            present.append(cue_id)
    menu_cues = [c for c in cues if c.startswith(("SFX_UI_", "SFX_BOOT", "MUS_BOOT", "MUS_MENU"))]
    ok("audio: %d/%d cues have files (%d/%d menu + boot cues)"
       % (len(present), len(cues),
          len([c for c in present if c in menu_cues]), len(menu_cues)))


# --- 4: text faces -----------------------------------------------------

def font_manifest() -> dict:
    return load_json("data/fonts.json")


def font_metrics() -> dict:
    return load_json("assets/fonts/font_metrics.json")


def round_half_up(value: float) -> int:
    """`Math.round` in the page rounds halves up; Python's `round` does not."""
    return int(value + 0.5) if value >= 0 else -int(-value + 0.5)


class FaceWidths:
    """One role's text metrics: advances in whole pixels, plus its line box.

    This is the Python half of `web/js/ui/font.js`: both read
    `data/fonts.json` and `assets/fonts/font_metrics.json`, so a width measured
    here and a width the page draws are the same integer, and a layout the gate
    accepts is a layout the page fits.
    """

    def __init__(self, role: str) -> None:
        self.role = role
        self.size = 0.0
        self.ascent = 0
        self.descent = 0
        self.line_height = 0
        self.advances: dict[str, int] = {}
        face = font_manifest().get("faces", {}).get(role)
        if face is None:
            fail("data/fonts.json has no '%s' face" % role)
            return
        source = font_metrics().get("sources", {}).get(face.get("source"), {})
        upem = source.get("unitsPerEm") or 1
        self.size = float(face.get("size", 0))
        self.ascent = int(face.get("ascent", 0))
        self.descent = int(face.get("descent", 0))
        self.line_height = int(face.get("lineHeight", 0))
        # A character with no advance of its own (a glyph the browser substitutes)
        # still needs a width; the page guesses half an em, and so does this.
        self.fallback = max(1, round_half_up(self.size * 0.5))
        for code, units in source.get("advances", {}).items():
            self.advances[code] = max(1, round_half_up(units * self.size / upem))

    def advance(self, character: str) -> int:
        return self.advances.get(str(ord(character)), self.fallback)

    def width(self, text: str) -> int:
        return sum(self.advance(character) for character in str(text))

    def wrap(self, text: str, width: int) -> list[str]:
        """The page's `TextFace.wrap`, word for word."""
        limit = max(1, int(width))
        lines: list[str] = []
        for paragraph in str(text).split("\n"):
            line = ""
            for word in [word for word in paragraph.split() if word]:
                candidate = "%s %s" % (line, word) if line else word
                if self.width(candidate) <= limit:
                    line = candidate
                    continue
                if line:
                    lines.append(line)
                    line = ""
                if self.width(word) <= limit:
                    line = word
                    continue
                rest = word
                while rest and self.width(rest) > limit:
                    cut = len(rest) - 1
                    while cut > 1 and self.width(rest[:cut]) > limit:
                        cut -= 1
                    lines.append(rest[:cut])
                    rest = rest[cut:]
                line = rest
            lines.append(line)
        return lines

    def block_height(self, text: str, width: int, line_spacing: int = 0) -> int:
        lines = self.wrap(text, width)
        return len(lines) * self.line_height + max(0, len(lines) - 1) * line_spacing


def check_fonts() -> None:
    """The shipped type: the files, the glyph coverage, and the offline atlases.

    Three things have to line up:

      * every face in `data/fonts.json` names a source `assets/fonts/font_metrics.json`
        carries, and that source's woff2 is on disk (the stylesheet's `@font-face`);
      * the metrics cover every character in `lib/strings.charset()` — the set the
        faces are cut to. A string that reaches for a character outside it fails
        here, and `tools/build_text_faces.py` is what fixes it;
      * the offline atlases (`tools/atlas/`) match the manifest and cover the same
        characters, because `tools/preview_screen.py` and `web/tests/shoot.mjs`
        draw their text through them.
    """
    manifest = font_manifest()
    metrics = font_metrics()
    if manifest.get("schema") != 2:
        fail("data/fonts.json should carry schema 2 (webfont faces)")
    faces = manifest.get("faces", {})
    for role in ("ui", "body", "display", "wordmark"):
        if role not in faces:
            fail("data/fonts.json has no '%s' face" % role)
    needed = set(charset(WEB))
    for role, face in sorted(faces.items()):
        source_id = face.get("source")
        source = metrics.get("sources", {}).get(source_id)
        if source is None:
            fail("fonts.json face '%s' names source '%s', which font_metrics.json "
                 "does not carry" % (role, source_id))
            continue
        font_path = os.path.join(WEB, "assets", "fonts", str(source.get("file", "")))
        if not os.path.exists(font_path):
            fail("missing shipped font %s (face '%s')" % (source.get("file"), role))
        advances = source.get("advances", {})
        missing = sorted(chr(code) for code in needed if str(code) not in advances)
        if missing:
            fail("the '%s' face (%s) carries no advance for: %s — rerun "
                 "tools/build_text_faces.py" % (role, source.get("file"), "".join(missing)))

    atlas_path = os.path.join(ROOT, "tools", "atlas", "glyph_atlas.json")
    if not os.path.exists(atlas_path):
        fail("tools/atlas/glyph_atlas.json is missing — the offline renderers draw "
             "their text from it; run tools/build_text_faces.py")
    else:
        atlas = json.load(open(atlas_path, encoding="utf-8"))
        for role, face in sorted(faces.items()):
            entry = atlas.get("faces", {}).get(role)
            if entry is None:
                fail("the offline atlas has no '%s' face" % role)
                continue
            for key in ("size", "ascent", "descent", "lineHeight"):
                if float(entry.get(key, -1)) != float(face.get(key, -2)):
                    fail("atlas face '%s' disagrees with data/fonts.json on %s: %s vs %s"
                         % (role, key, entry.get(key), face.get(key)))
            image_path = os.path.join(ROOT, "tools", "atlas", str(entry.get("file", "")))
            if not os.path.exists(image_path):
                fail("missing offline atlas %s" % entry.get("file"))
                continue
            image = read_png(image_path)
            covered = set()
            for code, rect in entry.get("glyphs", {}).items():
                x, y, w, h = (int(value) for value in rect[:4])
                if w and h and (x + w > image.width or y + h > image.height):
                    fail("atlas face '%s' glyph %s falls outside %s"
                         % (role, code, entry.get("file")))
                covered.add(int(code))
            missing = sorted(chr(code) for code in needed - covered)
            if missing:
                fail("the '%s' offline atlas is missing glyphs: %s" % (role, "".join(missing)))
    if not failures:
        ok("the %d text faces carry every glyph the shipped strings use, on disk "
           "and in the offline atlases" % len(faces))


# --- 5: palette mirror -------------------------------------------------

def check_palette_mirror() -> None:
    js = open(os.path.join(WEB, "js", "core", "palette.js"), encoding="utf-8").read()
    script_hexes = re.findall(r'"(#[0-9A-Fa-f]{6})"', js)
    surface_hexes = [h for _f, _n, h in build_palette.surface_entries()]
    below_hexes = [h for h, _n in build_palette.BELOW]
    if script_hexes[: len(surface_hexes)] != surface_hexes:
        fail("palette.js SURFACE_HEX does not match build_palette.py")
    if script_hexes[len(surface_hexes) : len(surface_hexes) + len(below_hexes)] != below_hexes:
        fail("palette.js BELOW_HEX does not match build_palette.py")
    lut = load_json("assets/pixel/palette/palette_lut.json")
    remap = lut.get("remap", [])
    script_remap = re.search(r"const REMAP = \[(.*?)\]", js, re.S)
    if script_remap is None:
        fail("palette.js has no REMAP table")
    else:
        values = [int(v) for v in re.findall(r"\d+", script_remap.group(1))]
        if values != remap:
            fail("palette.js REMAP does not match palette_lut.json")
    if len(surface_hexes) != 32 or len(below_hexes) != 8:
        fail("palette must be 32 surface + 8 below colours (GDD-06 §5.3)")
    if not failures:
        ok("palette.js mirrors the 32+8 ramp and the LUT remap exactly")


# --- 6: nine-patch kit -------------------------------------------------

def check_ui_kit() -> None:
    kit = load_json("assets/pixel/ui/ui_kit.json")
    styles = kit.get("styles", {})
    if not styles:
        fail("ui_kit.json declares no styles")
    for name, entry in styles.items():
        declared = entry.get("size")
        pattern: str = entry.get("file", "")
        files = [pattern]
        # `states` covers both the {state} and the {part} placeholder families.
        if "{state}" in pattern or "{part}" in pattern:
            files = [
                pattern.replace("{state}", state).replace("{part}", state)
                for state in entry.get("states", [])
            ]
        for filename in files:
            path = os.path.join(WEB, "assets", "pixel", "ui", filename)
            if not os.path.exists(path):
                fail("ui_kit.json/%s points at missing %s" % (name, filename))
                continue
            image = read_png(path)
            if declared and [image.width, image.height] != declared:
                fail("ui_kit.json/%s says %s but %s is %dx%d"
                     % (name, declared, filename, image.width, image.height))
    for sprite, entry in kit.get("sprites", {}).items():
        path = os.path.join(WEB, "assets", "pixel", "ui", entry.get("file", ""))
        if not os.path.exists(path):
            fail("ui_kit.json sprite %s points at missing %s" % (sprite, entry.get("file")))
    if not failures:
        ok("ui_kit.json matches the nine-patch PNGs it points at")


# --- 7: art lint (§7.4) ------------------------------------------------

def check_art_lint() -> None:
    locked_rgb = _locked_colours()
    total_bytes = 0
    offenders: list[str] = []
    for base, _dirs, files in os.walk(os.path.join(WEB, "assets", "pixel")):
        for name in sorted(files):
            path = os.path.join(base, name)
            total_bytes += os.path.getsize(path)
            if not name.endswith(".png"):
                continue
            image = read_png(path)
            outside = set()
            for y in range(image.height):
                for x in range(image.width):
                    r, g, b, a = image.get(x, y)
                    if a == 0:
                        continue  # transparent pixels carry no colour
                    hex_rgb = "#%02X%02X%02X" % (r, g, b)
                    if hex_rgb not in locked_rgb:
                        outside.add(hex_rgb)
            if outside:
                offenders.append("%s uses %d colour(s) outside the lock: %s"
                                 % (relative(path), len(outside), ", ".join(sorted(outside)[:6])))
    for message in offenders:
        fail("art lint: " + message)
    megabytes = total_bytes / (1024 * 1024)
    if megabytes > 1.5:
        fail("art lint: assets/pixel/ is %.2f MB (budget 1.5 MB, §7.4)" % megabytes)
    if not offenders:
        ok("art lint: every pixel of assets/pixel/ is inside the locked palette (%.0f KB)"
           % (total_bytes / 1024))


def _locked_colours() -> set[str]:
    """The locked ramp as "#RRGGBB" strings (alpha is not part of the lock)."""
    return {h[:7].upper() for _f, _n, h in build_palette.surface_entries()} | {
        h[:7].upper() for h, _n in build_palette.BELOW
    }


# --- main --------------------------------------------------------------



def _inside(rect: Sequence, bounds: Sequence, label: str, margins: int = 0) -> None:
    x, y, w, h = rect
    bx, by, bw, bh = bounds
    if x < bx - margins or y < by or x + w > bx + bw + margins or y + h > by + bh:
        fail("%s %s falls outside %s" % (label, list(rect), list(bounds)))


def check_screen_layouts() -> None:
    """Every rect the Play / Continue / Options pages draw must fit its panel.

    These are the numbers a screenshot alone cannot prove: the body face is 11 px
    tall per line while §5.5's group pitch is 48 px, so the help blocks pass
    `line_spacing: -3` and must land inside their group; the overlay card's body
    must fit above its buttons; the ledger's eighth row must clear the hint.
    """
    timings = load_json("data/shell_timings.json").get("screens", {})
    schema = load_json("data/options_schema.json")
    rows = {row["id"]: row for tab in schema.get("tabs", []) for row in tab.get("rows", [])}
    ui = FaceWidths("ui")
    body = FaceWidths("body")
    canvas = [0, 0, 480, 270]

    first_run = timings.get("first_run", {})
    panel = first_run.get("panel")
    if panel != [40, 16, 400, 238]:
        fail("first_run panel must be (40,16,400,238) per §5.5")
    group_ys = first_run.get("group_ys", [])
    pitch = 48
    for index, y in enumerate(group_ys):
        if y != 56 + pitch * index:
            fail("first_run group %d must sit at y %d per §5.5" % (index, 56 + pitch * index))
    pills_y = first_run.get("label_to_pills", 8)
    help_y = first_run.get("help_offset_y", 24)
    spacing = first_run.get("help_line_spacing", -3)
    line_pitch = body.line_height + spacing
    for index, y in enumerate(group_ys):
        if pills_y + 16 > help_y:
            fail("first_run pills overlap the help block at group %d" % index)
        # A group may use the whole 48 px pitch for label + pills + help.
        limit = y + pitch - (pitch if index == len(group_ys) - 1 else 0)
        for row_id in ("difficulty", "combat_pacing")[index:index + 1]:
            text = rows.get(row_id, {}).get("help", "")
            lines = body.wrap(text, first_run.get("content_w", 384))
            bottom = y + help_y + len(lines) * line_pitch
            if bottom > limit:
                fail("first_run %s help runs to y %d, past the y %d group pitch "
                     "(§5.5 fixes the group ys)" % (row_id, bottom, limit))
    for key in ("back_rect", "go_rect"):
        rect = first_run.get(key)
        if rect is None:
            fail("first_run.%s is missing" % key)
            continue
        _inside(rect, canvas, "first_run.%s" % key)
    footer_ok = (first_run.get("back_rect") == [56, 224, 148, 18]
                 and first_run.get("go_rect") == [276, 224, 148, 18])
    if not footer_ok:
        fail("first_run footer buttons must be (56,224,148,18) and (276,224,148,18) per §5.5")
    for key in ("comfort_help_rect", "comfort_right_help_rect"):
        rect = first_run.get(key, [0, 0, 0, 0])
        if rect[0] + rect[2] > panel[0] + panel[2] - 8 or rect[1] + 3 * line_pitch > 224:
            fail("first_run.%s %s collides with the footer or the panel edge" % (key, rect))

    card = timings.get("new_contract_card", {})
    card_rect = card.get("rect", [0, 0, 0, 0])
    body_rect = card.get("body_rect", [0, 0, 0, 0])
    text = load_json("data/strings.json").get("spec", {}).get("STR_NEW_BODY", "")
    for token, value in (("{0}", "New contract"), ("{1}", "Unassigned"),
                         ("{2}", "1"), ("{3}", "Prologue")):
        text = text.replace(token, value)
    lines = body.wrap(text, body_rect[2])
    if body_rect[1] + len(lines) * body.line_height > card.get("begin_rect", [0, 0, 0, 0])[1]:
        fail("the Begin-a-new-contract body needs %d lines and would run into its buttons"
             % len(lines))
    for key in ("seal_rect", "title_rect", "body_rect", "begin_rect", "back_rect"):
        _inside(card.get(key, [0, 0, 0, 0]), card_rect, "new_contract_card.%s" % key)

    ledger = timings.get("ledger", {})
    led_panel = ledger.get("panel")
    if led_panel != [60, 24, 360, 222]:
        fail("ledger panel must be (60,24,360,222) per §5.5")
    row_rect = ledger.get("row_rect", [0, 0, 0, 0])
    pitch = ledger.get("row_pitch", 24)
    count = ledger.get("row_count", 8)
    last_bottom = row_rect[1] + pitch * (count - 1) + row_rect[3]
    if last_bottom > led_panel[1] + led_panel[3]:
        fail("ledger row %d ends at y %d, past the panel bottom %d"
             % (count, last_bottom, led_panel[1] + led_panel[3]))
    hint = ledger.get("hint_rect", [0, 0, 0, 0])
    if hint[1] < last_bottom:
        fail("the ledger hint at y %d would sit on row %d (rows end at y %d)"
             % (hint[1], count, last_bottom))

    options = timings.get("options", {})
    opt_panel = options.get("rows_panel")
    if opt_panel != [88, 16, 384, 238]:
        fail("options rows panel must be (88,16,384,238) per §5.6")
    if options.get("tab_rail") != [8, 16, 72, 238]:
        fail("options tab rail must be (8,16,72,238) per §5.6")
    tab_rect, tab_pitch = options.get("tab_rect", [0, 0, 0, 0]), options.get("tab_pitch", 28)
    tabs = len(schema.get("tabs", []))
    rail_bottom = options["tab_rail"][1] + options["tab_rail"][3]
    if tab_rect[1] + tab_pitch * (tabs - 1) + tab_rect[3] > rail_bottom:
        fail("the %d options tabs do not fit the rail: widen tab_rect or tab_pitch" % tabs)
    row_rect, row_pitch = options.get("row_rect", [0, 0, 0, 0]), options.get("row_pitch", 20)
    visible = options.get("visible_rows", 10)
    if row_rect[0] + row_rect[2] > opt_panel[0] + opt_panel[2]:
        fail("options rows %s run past the rows panel" % row_rect)
    if row_rect[1] + row_pitch * visible > options.get("help_rect", [0, 0, 0, 0])[1]:
        fail("options rows reach y %d and would sit under the help line at y %d"
             % (row_rect[1] + row_pitch * visible, options["help_rect"][1]))
    help_rect = options.get("help_rect", [0, 0, 0, 0])
    help_line = options.get("help_line_height", ui.line_height)
    if help_line != ui.line_height:
        fail("options.help_line_height should be the ui face's line height (%d), is %s"
             % (ui.line_height, help_line))
    longest = max((ui.wrap(row.get("help", ""), help_rect[2]) for row in rows.values()),
                  key=len, default=[""])
    if help_rect[1] + len(longest) * help_line > 270:
        fail("the longest options help (%d lines) runs off the 270 px canvas" % len(longest))
    back_rect = options.get("back_rect", [0, 0, 0, 0])
    if help_rect[0] < back_rect[0] + back_rect[2]:
        fail("the options help line at x %d overlaps BACK (%s)" % (help_rect[0], list(back_rect)))
    _inside(options.get("scrollbar_rect", [0, 0, 0, 0]), canvas, "options.scrollbar_rect")

    if not failures:
        ok("screen layouts: First Run, contract card, ledger and Options all fit their panels")



def main() -> int:
    check_referenced_paths()
    check_module_graph()
    check_data_files()
    check_audio_cues()
    check_fonts()
    check_palette_mirror()
    check_ui_kit()
    check_screen_layouts()
    check_art_lint()

    for message in notes:
        print("  ok   %s" % message)
    for message in failures:
        print("  FAIL %s" % message)
    if failures:
        print("\n%d problem(s) found" % len(failures))
        return 1
    print("\nproject check clean")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
