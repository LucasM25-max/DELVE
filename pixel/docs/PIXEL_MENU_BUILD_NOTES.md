# Pixel menu + boot build — notes, deviations and where to plug in next

Companion to `pixel/README.md`. This file is for whoever picks the build up next: what was
built, every place the output deviates from GDD-07 and why, and the exact seams to extend.

Build date: 2026-09-23 · branch `arena/01a0cedd-delve` · spec: GDD-06, GDD-07 v1.0.

---

## 1. Scope of this build

Two passes, both on this branch:

1. *"build the game menu, including boot up sequence, but do not make the buttons do
   anything for now. Keep the background of the menu plain white."*
2. *"build the Play, Continue and Options menus completely per §5.5/§5.6 — but buttons in
   Play and Continue that are meant to move out of the game menu must just return to the
   menu, while keeping the proper spec text."*

Shipped:

| Ring | Contents |
|---|---|
| P0 (partial) | boot sequence: legal screen → logo sting → menu; **§5.5 PLAY** (First Run contract page + `Begin a new contract?` overlay card); **§5.5 CONTINUE** (eight-slot ledger, `DELETE` confirm, corrupt-save card); **§5.6 Options** (5 tabs, 39 schema-driven rows, pills / toggles / 10-pip sliders / rebinds, save v2 on BACK) |
| Stubbed on purpose | Loading (§5.9) and the yard (§6) do not exist, so the two buttons that lead to them return to the menu instead — §2.8 |
| Still a placeholder card | CODEX (§5.7) and CREDITS (§5.8) |
| Not built | §5.9 loading, §6 yard |

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

### 2.6 Placeholder cards for the last two pages

CODEX and CREDITS still show a parchment card: title, one-line body, hint and `BACK`.
Titles and bodies live in `data/strings.json` as `STR_STUB_<ID>_TITLE` / `_BODY`, so
replacing a card with the real page touches one call site
(`screen_menu.gd::_on_item_activated`). PLAY, CONTINUE and OPTIONS now route to their real
screens.

CONTINUE follows §5.4 exactly even in this build: dimmed to 40 % with no contract, tooltip
`No contracts signed yet.` on hover, `SFX_UI_DENY` when pressed.

### 2.7 Audio files are not committed

The cue table (§5.10, §8, §9) is complete in `data/audio_cues.json`, and `Sound` plays by
id. Files are not in Git: the tracks that already exist in the repository are copied by
`tools/fetch_audio.py --from-repo` (menu theme + Corwin's three VO lines), and
`--generate` synthesises placeholder one-shots for the menu/boot cues so the shell is not
silent. `pixel/assets/audio/` is git-ignored, matching the repo's existing "no big binaries
in Git" convention.


### 2.8 The two exits that would leave the menu return to the menu (requested)

§5.5 ends both play routes with **Loading (§5.9) → YARD (§6)**:

* `SIGN & DESCEND` → save slot created → Loading → YARD
* Ledger: select a slot → Loading → YARD (resume)

Neither screen is built, and the request for this pass was explicit: *buttons that move out
of the game menu must just return to the menu, with the spec text unchanged*. So:

| Button | Spec effect | Shipped |
|---|---|---|
| `SIGN & DESCEND` | writes the next free slot (`New contract`, P1 label), then Loading → YARD | writes the slot **and every chosen option** through `SaveStore` (contract, difficulty, pacing, subtitles, comfort), flushes save v2, then returns to the menu — where CONTINUE lights up and the ledger shows the contract |
| Ledger row (select) | resumes that contract → Loading → YARD | returns to the menu with `{"resume_slot", "resume_name"}` in `GameState.payload`, so the yard can consume it unchanged |

Text, layout, sounds and the save format are exactly as specified. Each deviation is one
call site, named in the code: `screen_first_run.gd::_sign_and_descend()` and
`screen_ledger.gd::_on_row_selected()`. When Loading lands, those two calls become
`go_to(GameState.State.LOADING, …)`; nothing else in either page changes.

Two smaller, related decisions:

* **A full ledger refuses.** §5.5 does not cover `BEGIN NEW` with all eight slots used. The
  card plays `SFX_UI_DENY` and stays up rather than overwriting a contract; First Run cannot
  be reached in that state (PLAY only offers the card when a slot is free).
* **The ledger needed an exit.** §5.5 gives the ledger no exit control and §5.4 only forbids
  ESC from quitting the *menu*. `BACK` (60, 244, 80, 18) was added — the same rect the
  Options page uses — plus ESC. Without it a mouse player could not leave the page.

### 2.9 First Run help: the spec's own 48 px group pitch

§5.5 fixes the three group labels at y **56 / 104 / 152** — a 48 px pitch — and puts 8 px help
under the group. Label (8) + pills (16) + three 8 px help lines (24) = exactly 48, so the
groups stack with no gap. That only works if the help line pitch is 8 px, but the shipped
body face has an 11 px line height, so help blocks pass `line_spacing: -3`
(`data/shell_timings.json → screens.first_run.help_line_spacing`).

Content runs 48…432 — the panel's *inner* width rather than an arbitrary 360 px inset —
which keeps the difficulty help to two lines and the longer combat-pacing help to three.
`tools/check_project.py::check_screen_layouts()` re-measures both strings with the shipped
`.fnt` metrics and fails the build if a help block would overrun its group.

The third group's two prose notes ("subtitles drive VO captions", "comfort freezes
motes…") are drawn under their own columns at y 178, where the spec leaves 48 px of free
panel above the footer buttons.

### 2.10 Options: the help line, the scrolling Controls tab, one overhanging label

§5.6 fixes the rail, the rows panel, the row height and the control types, but says nothing
about a help line or about tabs with more rows than fit. Three decisions:

1. **Help line.** The schema's `help` text is drawn at (176, 246, 288, 8) — to the right of
   `BACK`, inside the panel — wrapped to that width. The longest string (Difficulty, 111
   characters) takes three 8 px-class lines and overhangs the panel's bottom edge by the
   same 8 px `BACK` already does at its spec rect. Ink reads on both the parchment panel and
   the white field, so no colour swap is needed. `check_screen_layouts()` fails if a help
   block would run off the 270 px canvas.
2. **Scrolling.** Ten rows fit between the panel's top edge and the help line. Accessibility
   has 10 and Controls has 12, so the page scrolls (wheel, ↑/↓ at the ends) and shows the
   4 px scrollbar the kit already builds. The spec's row height and panel rect are unchanged.
3. **One label overhangs.** `Accessibility` is 78 px at the shipped 5 px face — 3 px wider
   each side than the spec's 64 px tab. The label is centred and `clip_text` is off, so the
   overhang falls inside the rail's unused 8 px gutter and clears the rows panel at x 88.
   Nothing else in the rail moves.

Rebinds are unchanged from the retired `options_page.gd`: the pill becomes `Press a key…`,
ESC cancels with `Rebind cancelled.`, and the choice is stored as a display string plus a
`<row id>_keycode` so `InputActions.apply_overrides()` re-applies it at boot. The twelve
yard actions are registered with the spec's default keys in `InputActions.YARD_BINDINGS`.

### 2.11 Ledger details the spec left open

* **Stamps.** "steps lit = beats completed" with three steps and a five-beat P1 list
  (`T0 T1 T3 T4 T8`, now in `data/shell_content.json → tutorial_beats.p1`) is read as one
  step per third completed, rounded up: `Brand.steps_lit_for(completed, total)` →
  `logo_emblem.png` / `logo_emblem_step1.png` / `logo_emblem_step2.png` /
  `logo_emblem_steps.png` (variants published in `data/brand.json → emblem.variants`).
* **Date.** The save's `signed_at` ISO stamp trimmed to its date half, right-aligned on the row.
* **Keyboard hint.** Rows end at y 240 and the panel at y 246, so the hint sits beside BACK
  on the white field at (148, 250) — `check_screen_layouts()` asserts it can never land on
  the eighth row.
* **Corrupt save.** `SaveStore.has_corrupt_save()` is true when the file exists but does not
  parse; the ledger then shows the ink card from §5.5 with `RETRY` (re-reads the file) and
  `CONTINUE WITHOUT SAVING` (keeps the session in memory; a later successful write clears the
  flag).

### 2.12 The card and the overlay keep the menu behind them

§5.5 draws `Begin a new contract?` as an *overlay* — the menu stays visible behind it. The
card is therefore a child of `screen_menu.gd` (`_show_new_contract_card()`), not a shell
state: closing it returns the untouched menu, ESC closes it too, and the menu's own input
handler stands down while it is up. The wax seal, the title and the verbatim body
(`STR_NEW_BODY`) are laid out from `data/shell_timings.json → screens.new_contract_card`.

---

## 3. Seeing a screen without the engine

`python3 tools/preview_screen.py` renders the shell's screens to PNG straight from the
shipped assets — same rects, same strings, same `.fnt` fonts, same nine-patches — into
`pixel/preview/` (git-ignored):

```bash
python3 tools/preview_screen.py                    # every screen
python3 tools/preview_screen.py menu --scale 2     # one screen, 2x for legibility
python3 tools/preview_screen.py first-run ledger options-rebind
```

Screens: `legal` · `menu` · `menu-tooltip` · `menu-new-contract` · `sting-end` · `stub` ·
`first-run` · `ledger` · `ledger-confirm` · `options-graphics` · `options-audio` ·
`options-accessibility` · `options-controls` (scrolled) · `options-rebind` (capturing a key).

It is how the footer collision (§2.5), the first-run help overflow (§2.9) and the ledger
hint landing on row 8 (§2.11) were all found — and it is the fastest way to check a layout
change on a machine without Godot. `check_project.py` now enforces the same numbers
statically.

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

First Run, ledger and Options (§5.5/§5.6), same verification:

| Element | Spec | Shipped |
|---|---|---|
| First Run panel | (40, 16, 400, 238) | same |
| First Run groups | y 56 / 104 / 152, pills h 16 gap 4 | same; help stacked to the 48 px pitch (§2.9) |
| First Run footer | (56, 224, 148, 18) `BACK` · (276, 224, 148, 18) `SIGN & DESCEND` | same |
| Contract card | parchment nine-patch, wax emblem 24 px, title + verbatim body, `BEGIN NEW` · `BACK` | same; body wraps to 4 lines and clears the buttons by 28 px |
| Ledger panel | (60, 24, 360, 222) | same |
| Ledger rows | 8 × 24 px at y 48 + 24i | same; last row ends at y 240, hint outside the panel |
| Options tab rail | (8, 16, 72, 238) | same |
| Options rows panel | (88, 16, 384, 238), row h 20 | same; rows at x 96, controls right-aligned to 460 |
| Options `BACK` | (88, 244, 80, 18) | same (commits + writes save v2 atomically) |

Boot timings (§5.2) live in `data/shell_timings.json` and are read, not hard-coded:
0.8 s reveal · steps at 800/1200/1600 ms · chisel at 2000/2200/2400/2600/2800 ms · sublock
fade at 3000 ms with the sweep to 3600 ms · 4.0 s total · skip from 1.5 s · reduced-motion
minimum 1.0 s.

---

## 5. Where the next piece plugs in

| Next piece | Touch points |
|---|---|
| §5.3 painted backdrop | `scripts/ui/menu_background.gd`; drop the layer PNGs in `assets/pixel/backdrops/` |
| §5.9 loading → §6 yard | `data/shell_timings.json → loading` has the dwell and weights, the 16 tips are in `shell_content.json`; the two call sites listed in §2.8 become `go_to(GameState.State.LOADING, …)` and the yard consumes `GameState.payload.resume_slot` |
| §5.7 codex / §5.8 credits | copy a `screen_stub.gd` page, register it in `SCREENS` + `DEBUG_SCREEN_IDS`; rules text R1–R15 is in GDD-07 §4 |
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
3. **Only what shipped is exercised.** Codex, credits and loading still exist only as
   strings, timings and data; the yard is not started.
4. **Sound is silent until files land.** `Sound` prints one line per missing cue the first
   time it is asked for it (`[sound] cue 'X' not loaded yet`) — that is expected, not an
   error, until `tools/fetch_audio.py` has been run or real audio is dropped in.
5. **`gdlintrc`** is tuned (max line length 110, max 8 function arguments); `gdlint` and
   `gdformat` are optional developer tools and are not required to build or run.
