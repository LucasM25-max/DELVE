#!/usr/bin/env python3
"""Check the pixel project's internal consistency — the CI gate for this build.

What it verifies:

  1. every `res://` path mentioned in project.godot, *.tscn or *.gd exists;
  2. every autoload script and the main scene exist;
  3. every JSON under data/ and every declared asset parses / matches its PNG;
  4. the font atlases are internally consistent (.fnt char rects inside the
     page PNG, and every glyph the shipped strings need is present);
  5. `scripts/core/palette.gd` mirrors `tools/build_palette.py` exactly;
  6. the nine-patch kit (`ui_kit.json`) matches the PNGs it points at;
  7. the art lint of GDD-07 §7.4: every pixel of every committed PNG sits inside
     the locked 40-colour palette, and `assets/pixel/` stays under 1.5 MB.

Run:  python3 tools/check_project.py
Exit code 0 = clean; 1 = at least one failure (details printed).
"""

from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.png_read import read_png  # noqa: E402
import build_palette  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RES_PATTERN = re.compile(r'res://([A-Za-z0-9_./\-]+)')
SCAN_SUFFIXES = (".gd", ".tscn", ".tres", ".godot", ".cfg", ".json")
SKIP_DIRS = {".godot", "exports", "tools/sources", "__pycache__"}

failures: list[str] = []
notes: list[str] = []


def fail(message: str) -> None:
    failures.append(message)


def ok(message: str) -> None:
    notes.append(message)


def walk_files() -> list[str]:
    out: list[str] = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in {".godot", "exports", "__pycache__"}]
        for name in files:
            out.append(os.path.join(base, name))
    return out


def relative(path: str) -> str:
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


# --- 1 + 2: referenced paths -------------------------------------------

def check_referenced_paths() -> None:
    """Every res:// path must exist — except audio, which lands cue by cue.

    `data/audio_cues.json` declares the full GDD-07 cue table up front so the
    code can call cues by id before the sound design exists; `Sound` skips a cue
    whose file is absent. `check_audio_cues()` reports how many are in place.
    """
    missing: dict[str, str] = {}
    for path in walk_files():
        rel = relative(path)
        if not rel.endswith(SCAN_SUFFIXES) or any(s in rel for s in SKIP_DIRS):
            continue
        if rel.endswith("check_project.py"):
            continue
        try:
            text = open(path, encoding="utf-8").read()
        except UnicodeDecodeError:
            continue
        for match in RES_PATTERN.findall(text):
            if match.startswith("assets/audio/"):
                continue
            target = os.path.join(ROOT, match)
            if not os.path.exists(target):
                missing.setdefault(match, rel)
    for target, source in sorted(missing.items()):
        fail("missing res://%s (referenced by %s)" % (target, source))
    if not missing:
        ok("every res:// path referenced by the project exists")


def check_autoloads_and_main_scene() -> None:
    config = open(os.path.join(ROOT, "project.godot"), encoding="utf-8").read()
    for match in re.findall(r'^\w+="\*?(res://[^"]+)"$', config, re.M):
        if not os.path.exists(os.path.join(ROOT, match.replace("res://", ""))):
            fail("autoload target missing: %s" % match)
    main = re.search(r'run/main_scene="(res://[^"]+)"', config)
    if main is None:
        fail("project.godot has no run/main_scene")
    elif not os.path.exists(os.path.join(ROOT, main.group(1).replace("res://", ""))):
        fail("main scene missing: %s" % main.group(1))
    else:
        ok("autoloads and main scene all exist")


# --- 3: data files -----------------------------------------------------

def load_json(rel: str) -> dict:
    path = os.path.join(ROOT, rel)
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
    if menu.get("lockup_rect") != [29, 22, 96, 24]:
        fail("menu lockup rect must be (29,22,96,24) per §5.4")
    if menu.get("item_rect", [0, 0, 0, 0])[:3] != [29, 92, 140]:
        fail("menu item rect must start at (29,92,140,18) per §5.4")
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
    for section, filename in (("emblem", "logo_emblem.png"),
                              ("wordmark", "logo_wordmark.png"),
                              ("lockup", "logo_menu.png")):
        declared = brand.get(section, {}).get("size")
        path = os.path.join(ROOT, "assets", "pixel", "ui", filename)
        if declared is None or not os.path.exists(path):
            fail("brand.json/%s or %s is missing" % (section, filename))
            continue
        image = read_png(path)
        if [image.width, image.height] != declared:
            fail("brand.json says %s is %s but the PNG is %dx%d"
                 % (section, declared, image.width, image.height))
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
        path = os.path.join(ROOT, str(entry.get("file", "")).replace("res://", ""))
        if os.path.exists(path):
            present.append(cue_id)
    menu_cues = [c for c in cues if c.startswith(("SFX_UI_", "SFX_BOOT", "MUS_BOOT", "MUS_MENU"))]
    ok("audio: %d/%d cues have files (%d/%d menu + boot cues)"
       % (len(present), len(cues),
          len([c for c in present if c in menu_cues]), len(menu_cues)))


def parse_fnt(path: str) -> dict:
    lines = open(path, encoding="utf-8").read().splitlines()
    out: dict = {"chars": []}
    for line in lines:
        parts = line.split(" ", 1)
        if len(parts) != 2:
            continue
        tag, rest = parts
        if tag == "char":
            entry = {}
            for key, value in re.findall(r'(\w+)=("[^"]*"|\S+)', rest):
                entry[key] = value.strip('"')
            out["chars"].append(entry)
        else:
            for key, value in re.findall(r'(\w+)=("[^"]*"|\S+)', rest):
                out[key] = value.strip('"')
    return out


def check_fonts() -> None:
    fonts_dir = os.path.join(ROOT, "assets", "fonts")
    expected = {
        "pixel_ui_5": 5,
        "pixel_body_8": 8,
        "pixel_display_10": 10,
    }
    strings = load_json("data/strings.json")
    content = load_json("data/shell_content.json")
    needed = set()
    for block in ("spec", "build"):
        for value in strings.get(block, {}).values():
            needed.update(value)
    for tip in content.get("loading_tips", []):
        needed.update(tip)
    needed = {c for c in needed if ord(c) >= 32}

    for name in expected:
        fnt_path = os.path.join(fonts_dir, "%s.fnt" % name)
        if not os.path.exists(fnt_path):
            fail("missing font %s.fnt" % name)
            continue
        fnt = parse_fnt(fnt_path)
        page = os.path.join(fonts_dir, fnt.get("file", "%s.png" % name))
        if not os.path.exists(page):
            fail("%s.fnt page %s is missing" % (name, fnt.get("file")))
            continue
        image = read_png(page)
        if int(fnt.get("scaleW", 0)) != image.width or int(fnt.get("scaleH", 0)) != image.height:
            fail("%s.fnt atlas size does not match %s" % (name, os.path.basename(page)))
        covered = set()
        for char in fnt["chars"]:
            x, y = int(char["x"]), int(char["y"])
            w, h = int(char["width"]), int(char["height"])
            if w and h and (x + w > image.width or y + h > image.height):
                fail("%s.fnt glyph %s falls outside the atlas" % (name, char["id"]))
            covered.add(chr(int(char["id"])))
        missing = sorted(needed - covered)
        if missing:
            fail("%s.fnt is missing glyphs: %s" % (name, "".join(missing)))
    if not failures:
        ok("fonts carry every glyph the shipped strings use, inside their atlases")


# --- 5: palette mirror -------------------------------------------------

def check_palette_mirror() -> None:
    gd = open(os.path.join(ROOT, "scripts", "core", "palette.gd"), encoding="utf-8").read()
    script_hexes = re.findall(r'"(#[0-9A-Fa-f]{6})"', gd)
    surface_hexes = [h for _f, _n, h in build_palette.surface_entries()]
    below_hexes = [h for h, _n in build_palette.BELOW]
    if script_hexes[: len(surface_hexes)] != surface_hexes:
        fail("palette.gd SURFACE_HEX does not match build_palette.py")
    if script_hexes[len(surface_hexes) : len(surface_hexes) + len(below_hexes)] != below_hexes:
        fail("palette.gd BELOW_HEX does not match build_palette.py")
    lut = load_json("assets/pixel/palette/palette_lut.json")
    remap = lut.get("remap", [])
    script_remap = re.search(r"const REMAP: PackedInt32Array = PackedInt32Array\(\[(.*?)\]\)", gd, re.S)
    if script_remap is None:
        fail("palette.gd has no REMAP constant")
    else:
        values = [int(v) for v in re.findall(r"\d+", script_remap.group(1))]
        if values != remap:
            fail("palette.gd REMAP does not match palette_lut.json")
    if len(surface_hexes) != 32 or len(below_hexes) != 8:
        fail("palette must be 32 surface + 8 below colours (GDD-06 §5.3)")
    if not failures:
        ok("palette.gd mirrors the 32+8 ramp and the LUT remap exactly")


# --- 6: nine-patch kit -------------------------------------------------

def check_ui_kit() -> None:
    kit = load_json("assets/pixel/ui/ui_kit.json")
    styles = kit.get("styles", {})
    if not styles:
        fail("ui_kit.json declares no styles")
    for name, entry in styles.items():
        declared = entry.get("size")
        files = [entry.get("file", "")] if "{state}" not in entry.get("file", "") else [
            entry["file"].replace("{state}", state) for state in entry.get("states", [])
        ]
        for filename in files:
            path = os.path.join(ROOT, "assets", "pixel", "ui", filename)
            if not os.path.exists(path):
                fail("ui_kit.json/%s points at missing %s" % (name, filename))
                continue
            image = read_png(path)
            if declared and [image.width, image.height] != declared:
                fail("ui_kit.json/%s says %s but %s is %dx%d"
                     % (name, declared, filename, image.width, image.height))
    for sprite, entry in kit.get("sprites", {}).items():
        path = os.path.join(ROOT, "assets", "pixel", "ui", entry.get("file", ""))
        if not os.path.exists(path):
            fail("ui_kit.json sprite %s points at missing %s" % (sprite, entry.get("file")))
    if not failures:
        ok("ui_kit.json matches the nine-patch PNGs it points at")


# --- 7: art lint (§7.4) ------------------------------------------------

def check_art_lint() -> None:
    locked_rgb = _locked_colours()
    total_bytes = 0
    offenders: list[str] = []
    for base, _dirs, files in os.walk(os.path.join(ROOT, "assets", "pixel")):
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

def main() -> int:
    check_referenced_paths()
    check_autoloads_and_main_scene()
    check_data_files()
    check_audio_cues()
    check_fonts()
    check_palette_mirror()
    check_ui_kit()
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
