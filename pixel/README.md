# DELVE — pixel build (`pixel/`)

The pixel version of DELVE, built from **GDD-06** (browser pixel conversion plan) and
**GDD-07** (pixel prologue build spec).

**This build ships the shell rings it was asked for: the boot sequence (legal →
logo sting) and the main menu.** The five menu items are inert — activating one opens a
small placeholder card instead of the real page. Everything else in §5 is wired but not
built: the enum values, strings, timings, options schema and audio cue table are already
in place, so each page is a drop-in.

```
pixel/
├ project.godot, export_presets.cfg, gdlintrc
├ data/            strings, timings, brand geometry, options schema, audio cues
├ scripts/
│  ├ core/          palette · brand · shell_data · game_state · save_store ·
│  │                rng_streams · dice · sound · input_actions
│  └ ui/            ui_pixel · shell_screen · pixel_menu_item · menu_background ·
│                   screen_legal · screen_sting · screen_menu · screen_stub · shell
├ scenes/ui/        shell.tscn + screens/{legal,sting,menu,stub}.tscn
├ assets/
│  ├ fonts/         pixel_ui_5 · pixel_body_8 · pixel_display_10 (+ LICENCES)
│  ├ pixel/palette/ the locked 32 + 8 ramp + LUT
│  └ pixel/ui/      emblem, wordmark, lockups, nine-patches, buttons, seal
├ tests/           test_runner.gd — 100+ headless checks
└ tools/           deterministic asset builders + project/string checkers
```

Nothing here is shared with the retired web shell at the repository root or the old 3D
blockout under `godot/`: this is a clean, self-contained Godot 4.7.2 project.

---

## Run it

Requires **Godot 4.7.2** (standard build; the version is pinned in `project.godot`).

```bash
godot --path pixel                     # play: legal → sting → menu
godot -e --path pixel                  # open in the editor
godot --path pixel -- --screen=menu    # skip straight to a page
godot --path pixel -- --screen=menu --reduced-motion
```

First open imports the assets (`.fnt`, PNGs) and creates `pixel/.godot/` — that folder is
ignored by Git.

### Controls

| Input | Action |
|---|---|
| ↑ / ↓, W / S, d-pad, left stick | move the menu selection |
| mouse hover | select the row under the pointer |
| Enter / Space / F / pad A | activate the selected row |
| Esc | **does nothing on the menu** (§5.4: there is no back-exit) |
| Esc | closes a placeholder card (back) |

### Test hooks

`--screen=legal|sting|menu|stub` (CLI) and `?s=legal|sting|menu|stub` (web export) jump to
a page. Hooks only run when the flag or query string is present; shipped behaviour is
untouched without them.

---

## What is built (and what §5 says)

| Spec | State |
|---|---|
| §5.2.1 legal screen: emblem, disclaimer, SRD block, engine + font lines, 0.8 s pulse on "Press any button", any input continues and unlocks audio | built |
| §5.2.2 logo sting: 4.0 s, emblem draws in 8 steps, three steps light, five chisel strikes, sublock fade + bronze sweep, skippable after 1.5 s, reduced-motion cut | built |
| §5.2.3/§5.4 menu: exact 480×270 rects, 10 px display items on a 21 px pitch, bronze underline drawn in 0.18 s, selection flicker, CONTINUE dim 40 % + tooltip + deny cue, abridged disclaimer, version stamp, Esc inert | built |
| §5.4 background: three-layer painted dawn parallax + motes | **flat white for now** (see below) |
| §5.5 PLAY/CONTINUE/first-run/ledger flows, §5.6 options, §5.7 codex, §5.8 credits, §5.9 loading | strings, timings, schema and cue table ship in `data/`; screens are placeholder cards |
| §5.10 audio cues | all 121 cues declared and wired by id; files land via `tools/fetch_audio.py` (the menu theme and Corwin's VO keepers are copied from this repo) |

### Deliberate deviations (all documented in `docs/PIXEL_MENU_BUILD_NOTES.md`)

1. **Plain white menu background.** Requested for this step. `MenuBackground` is its own
   class so dropping in the §5.3 parallax is a one-line change.
2. **Fonts.** §5.1/§4.8 name *Pixel Operator* and *m5x7*. Those are not vendored in this
   repository, so the build ships a MIT 5×7 system face for chrome and Silkscreen
   (OFL-1.1) at 8 px for body text; menu items use the 5×7 face at 2× (= 10 px), exactly
   as §5.4 describes. Notices are committed; the legal screen names the real fonts.
3. **Wordmark face grid.** §5.1 asks for a "5×7-pixel display face" with an **18 px cap
   height** — impossible on a pixel grid (18 ÷ 7 is not an integer), so the wordmark is
   authored on a 6×9 grid at 2× to hit 18 px and 2 px letter-spacing exactly.
4. **Placeholder cards.** Activating a menu item opens a parchment card whose title and
   body already live in `data/strings.json` (`STR_STUB_<ID>_*`) — the real screen drops
   into the same slot.

---

## Verifying

Three gates, all runnable without Godot installed except the last:

```bash
cd pixel
python3 tools/build_all.py --check      # rebuild every asset, then run both checkers
python3 tools/check_project.py          # paths, data, fonts, palette mirror, art lint
python3 tools/check_strings.py          # byte-for-byte string parity with GDD-07
gdlint scripts/ tests/                  # optional: gdtoolkit lint (see gdlintrc)

godot --headless --path pixel res://tests/test_runner.tscn   # 100+ runtime checks
```

* `tools/preview_screen.py` renders the screens to PNG **without Godot** (same rects,
  strings, fonts and nine-patches) into `pixel/preview/` — the quickest way to eyeball a
  layout change:

  ```bash
  python3 tools/preview_screen.py                 # every screen
  python3 tools/preview_screen.py menu --scale 2  # one screen, enlarged
  ```
* `check_project.py` also runs the **§7.4 art lint**: every pixel of every committed PNG
  must sit inside the locked 40-colour palette, and `assets/pixel/` must stay under
  1.5 MB (currently ~9 KB).
* `check_strings.py` parses the GDD itself and compares 55 strings
  (§5.11 master, the 16 loading tips, the sublock, both disclaimers, the SRD block).
* `tests/test_runner.gd` covers the palette mirror, string master, save ledger, dice and
  RNG streams, the shell state machine, text wrapping, the §5.4 menu rects, screen
  build-out and brand geometry.

Asset builders are deterministic: running `tools/build_all.py` twice produces
byte-identical PNGs and JSON.

---

## Extending it

**Add a screen.** Create `scenes/ui/screens/<name>.tscn` with a script extending
`ShellScreen`, override `_build()` (construct nodes through `UiPixel`), emit
`finished(next_state, payload)` when the page is done, then add one row to
`SCREENS` in `scripts/ui/shell.gd` and one value to `GameState.State`.

**Add a string.** Put it in `data/strings.json` (never inline in a scene) — `spec` for
GDD-07 verbatim text, `build` for anything this build introduces — and read it with
`ShellData.t("STR_…")`.

**Add art.** Add a builder in `tools/`, draw only with `Palette` hexes, run
`tools/build_all.py --check`; the art lint will reject a colour outside the lock.

**Add a sound.** Add the cue to `data/audio_cues.json`, drop the file in
`assets/audio/`, call `Sound.play("CUE_ID")`. A missing file is skipped, never fatal.

---

## Attribution

An unofficial, non-commercial fan project. *Dungeons & Dragons*, *Phandelver and Below:
The Shattered Obelisk* and all Wizards of the Coast characters and locations are
trademarks of Wizards of the Coast LLC. Used here without permission; no challenge to any
trademark or copyright. This game will never be sold.

Rules text is sourced from the System Reference Document 5.2.1 (CC-BY-4.0); the required
attribution paragraph ships on the legal screen and in the credits. Fonts: 5×7 system font
(MIT) and Silkscreen (OFL-1.1) — notices in `assets/fonts/LICENSES/`.
