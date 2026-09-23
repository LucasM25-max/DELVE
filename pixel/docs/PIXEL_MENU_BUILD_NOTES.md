# Pixel menu + boot build — notes, deviations and where to plug in next

Companion to `pixel/README.md`. This file is for whoever picks the build up next: what was
built, every place the output deviates from GDD-07 and why, and the exact seams to extend.

Build date: 2026-09-23 · branch `arena/01a0cedd-delve` · spec: GDD-06, GDD-07 v1.0.

---

## 1. Scope of this build

Requested: *"build the game menu, including boot up sequence, but do not make the buttons do
anything for now. Keep the background of the menu plain white."*

Shipped:

| Ring | Contents |
|---|---|
| P0 (partial) | boot sequence: legal screen → logo sting → menu, plus placeholder cards behind the five menu items |
| Not built | §5.5 first run / ledger, §5.6 options, §5.7 codex, §5.8 credits, §5.9 loading, §6 yard |

Everything the unbuilt pages need is already in `data/`: the string master (§5.11), the
timings (§5.2/§5.4), the options schema (§5.6, 39 rows over 5 tabs), the brand geometry,
and the audio cue table (§5.10 + §8, 121 cues).

---

## 2. Deviations from GDD-07, and why

### 2.1 Plain white menu background (requested)

§5.3 specifies a three-layer painted parallax of the yard at 06:10 with eight motes and a
90 s ±60 px drift. The menu background is **flat white** in this build, as requested.

Implementation: `scripts/ui/menu_background.gd` (`MenuBackground`). Replacing it with the
§5.3 backdrop is a one-line change in `screen_menu.gd::_build()`; the class keeps the
layer-speed constants from §5.3 as a reminder. The two footer texts use ink rather than the
spec's parchment because the spec assumes a painted (dark) backdrop — swap the colour at
the same time as the backdrop.

### 2.2 Fonts are not the spec's exact typefaces

§4.8/§5.1 name *Pixel Operator* (8 px body) and *m5x7* (5 px chrome). Neither is vendored
in this repository, and this sandbox cannot reach the font sites that host them.

| Spec | Shipped | Licence |
|---|---|---|
| `pixel_ui_5` — "m5x7-class 5×7" | 5×7 system font (the glcdfont-class table, packed as JSON) | MIT, notice committed |
| `pixel_body_8` — "Pixel Operator-class 8 px" | **Silkscreen** at 8 px | OFL-1.1, notice committed |
| §5.4 "menu items 34 px → **10 px display** (5×7 ×2)" | `pixel_display_10`, the same 5×7 table at 2× | same as chrome |

Both faces are converted to AngelCode BMFont (`.fnt` + atlas PNG) by
`tools/build_fonts.py`; no TTF is rasterised at runtime. The body face is rasterised once
from the OFL source with fontTools (grid-fitted to whole pixels, no antialiasing).

The legal screen therefore names the real fonts (`UI type: 5x7 system font (MIT) &
Silkscreen (OFL)`) — a required-honest change: the spec's `Pixel Operator & m5x7 (CC0)`
line would be false as shipped.

To restore the spec's exact typefaces: drop the two fonts into `tools/sources/`, point
`build_fonts.py` at them, re-run `tools/build_all.py --check`, and update
`STR_FONT_LINE`.

### 2.3 Wordmark: 6×9 grid at 2×, not "5×7 at 18 px"

§5.1 asks for the wordmark in a "5×7-pixel display face" with "cap height 18 px",
"letter-spacing 2 px". 18 ÷ 7 is not an integer, so a 5×7 face cannot reach an 18 px cap
height on a pixel grid (it would need a 2.57× scale = half pixels, which this project
forbids everywhere else).

Resolution: the wordmark's four letterforms (D, E, L, V) are authored on a **6×9 grid and
rendered at 2×**, giving exactly **18 px cap height** and **2 px letter-spacing**, with the
spec's bronze face, 1 px ink keyline, 1 px mint lower-left rim-light, chisel-flat right
arms on E and the V apex 2 px below the baseline. Menu item text keeps the true 5×7 face
at 2× (10 px), exactly as §5.4 says.

### 2.4 Emblem construction

§5.1: "downward equilateral triangle (d20 face), three descending 2-px steps cut from the
top edge toward centre, 2 px bronze stroke, 2 px mint pip at centroid." The shipped emblem
is a 24×24 triangle frame (2 px bronze, 1 px ink keyline) with a descending three-step
ziggurat inside it and a 2 px mint pip below the steps. The steps' rects are published in
`data/brand.json`, so the boot sting and (later) the loading seal light them from one
source of truth.

### 2.5 Footer: the two bottom lines are stacked, not on one row

§5.4 places the abridged disclaimer at **(10, 259, 300, 8)** and the version stamp
right-aligned to **(470, 259)** — one row, 480 px wide. At the shipped 5 px face the
disclaimer measures **360 px** (text plus the default 4 px inner margin) and the stamp
**252 px**: 612 px of 480, so one row overprints by ~132 px. The spec also sizes the row
for the *full* disclaimer (which is 626 px at 5 px and cannot fit at all).

Resolution: the two strings are **stacked** — disclaimer at (10, 254, 348, 8), version
stamp right-aligned to 470 at y 262 — both verbatim, both anchored to their spec edges and
both inside the canvas. The spec's original numbers and the reasoning are recorded in
`data/shell_timings.json` (`menu._footer_note`, `menu.spec_rects`), and
`tools/check_project.py` + `tests/test_runner.gd` assert the shipped rects stay in bounds,
stay right-aligned to 470 and never overlap. Both labels also set `clip_text`, so no
future font change can spill them.

### 2.6 Placeholder cards instead of the real pages (requested)

Activating a menu item shows a parchment card: title, one-line body, hint and `BACK`.
Titles and bodies live in `data/strings.json` as `STR_STUB_<ID>_TITLE` / `_BODY`, so
replacing the card with the real page touches one call site
(`screen_menu.gd::_on_item_activated`).

CONTINUE follows §5.4 exactly even in this build: dimmed to 40 % with no contract, tooltip
`No contracts signed yet.` on hover, `SFX_UI_DENY` when pressed.

### 2.7 Audio files are not committed

The cue table (§5.10, §8, §9) is complete in `data/audio_cues.json`, and `Sound` plays by
id. Files are not in Git: the tracks that already exist in the repository are copied by
`tools/fetch_audio.py --from-repo` (menu theme + Corwin's three VO lines), and
`--generate` synthesises placeholder one-shots for the menu/boot cues so the shell is not
silent. `pixel/assets/audio/` is git-ignored, matching the repo's existing "no big binaries
in Git" convention.

---

## 3. Seeing a screen without the engine

`python3 tools/preview_screen.py` renders the shell's screens to PNG straight from the
shipped assets — same rects, same strings, same `.fnt` fonts, same nine-patches — into
`pixel/preview/` (git-ignored):

```bash
python3 tools/preview_screen.py                 # legal, menu, menu-tooltip, sting-end, stub
python3 tools/preview_screen.py menu --scale 2  # one screen, 2x for legibility
```

It is how the footer collision above was found, and it is the fastest way to check a
layout change on a machine without Godot.

---

## 4. Layout conformance (§5.4)

Verified by `tools/check_project.py` (numbers) and `tests/test_runner.gd` (runtime nodes):

| Element | Spec rect | Shipped |
|---|---|---|
| menu lockup | (29, 22, 96, 24) | same |
| menu column x | 29 | same |
| item 1 PLAY | (29, 92, 140, 18) | same |
| item pitch / gap | 21 px / 3 px | same (92 → 113 → 134 → 155 → 176) |
| hover underline | (29, item_y + 14, w_draw, 2) | same; `w_draw` measured from the font |
| underline draw | 0.18 s, L→R | same |
| selection flicker | 0.2 s emblem steps | same |
| disclaimer line | (10, 259, 300, 8), 60 % alpha | (10, 254, 348, 8) — stacked, see §2.5 |
| version stamp | right-aligned to (470, 259) | right-aligned to 470 at y 262 — stacked |
| top-right | clean — nothing | same |

Boot timings (§5.2) live in `data/shell_timings.json` and are read, not hard-coded:
0.8 s reveal · steps at 800/1200/1600 ms · chisel at 2000/2200/2400/2600/2800 ms · sublock
fade at 3000 ms with the sweep to 3600 ms · 4.0 s total · skip from 1.5 s · reduced-motion
minimum 1.0 s.

---

## 5. Where the next piece plugs in

| Next piece | Touch points |
|---|---|
| §5.3 painted backdrop | `scripts/ui/menu_background.gd`; drop the layer PNGs in `assets/pixel/backdrops/` |
| §5.5 first run + ledger | new `screen_first_run.gd` / `screen_ledger.gd`; `SaveStore.create_contract()`, `slots()`, `delete_contract()` are done; add rows to `SCREENS` + `DEBUG_SCREEN_IDS` |
| §5.6 options | `data/options_schema.json` is the whole row set; build a generic row renderer (pill / toggle / 10-pip slider) in `ui_pixel.gd`, persist through `SaveStore.set_setting()` |
| §5.7 codex | `data/shell_content.json` + the rules primer R1–R15 of GDD-07 §4 (SRD-sourced) |
| §5.9 loading | `data/shell_timings.json → loading` has the dwell and weights; the 16 tips are already in `shell_content.json` |
| §6 yard | new `scenes/world/yard.tscn`; the tile builder will read a `data/yard_map.json` in the schema of GDD-07 §12 |

Rules plumbing that already exists and is tested: `Dice` (R1/R2/R3/R4 maths, maths line for
the Roll Moment), `Streams` (deterministic, per-domain seeds), `SaveStore` (schema 2 with
`tutorial.completed_beats`, `codex_unlocks`, `combat_stats`).

---

## 6. Known gaps and honest risks

1. **No Godot binary in this build sandbox.** The project was authored against the Godot
   4.7 API and is verified by: GDScript parse + lint on every script (gdtoolkit), a
   project-integrity checker (paths, JSON, fonts, palette mirror, nine-patch metadata, art
   lint) and a string-parity checker against the spec. It has **not** been executed in the
   engine here. Run `godot --path pixel` and the headless test runner first; expect the
   usual first-open import step.
2. **Font import.** `.fnt` files import as bitmap `FontFile`. If an atlas fails to import,
   `UiPixel.font()` pushes an error naming the file — check the atlas PNG sits beside the
   `.fnt` (it does) and that the `.fnt`'s `page` line names it.
3. **Only the boot + menu path is exercised.** The unbuilt screens exist only as enum
   values, strings and data.
4. **Sound is silent until files land.** `Sound` prints one line per missing cue the first
   time it is asked for it (`[sound] cue 'X' not loaded yet`) — that is expected, not an
   error, until `tools/fetch_audio.py` has been run or real audio is dropped in.
5. **`gdlintrc`** is tuned (max line length 110, max 8 function arguments); `gdlint` and
   `gdformat` are optional developer tools and are not required to build or run.
