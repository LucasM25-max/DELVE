# Pixel menu + boot build — notes, deviations and where to plug in next

Companion to `web/README.md`. This file is for whoever picks the build up next: what was
built, every place the output deviates from GDD-07 and why, and the exact seams to extend.

Build date: 2026-09-23 · branches `arena/01a0cedd-delve` and `arena/01a0cf8b-delve` ·
spec: GDD-06 v2.0, GDD-07 v1.1.
Gates: `tools/check_project.py`, `tools/check_strings.py`, `web/tests/run.mjs`,
`web/tests/smoke.mjs`, `web/tests/shoot.mjs` — all five run in CI on every push.

---

## 1. Scope of this build

Passes, in order:

1. *"build the game menu, including boot up sequence, but do not make the buttons do
   anything for now. Keep the background of the menu plain white."*
2. *"build the Play, Continue and Options menus completely per §5.5/§5.6 — but buttons in
   Play and Continue that are meant to move out of the game menu must just return to the
   menu, while keeping the proper spec text."*
3. *"the pixel font looks horrific please fix it so it uses normal non pixel fonts. Also it
   isn't full screen so fix that as well."* — §2.2 (rewritten) and §2.13.

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

Implementation: `Ui.white()` in `js/ui/kit.js`, called from `js/screens/menu.js`'s `draw()`.
Replacing it with the §5.3 backdrop is a change in that one method; `data/shell_timings.json`
keeps the spec's layer-speed numbers as a reminder. The two footer texts use ink rather than the
spec's parchment because the spec assumes a painted (dark) backdrop — swap the colour at
the same time as the backdrop.

### 2.2 The type is Inter, not a pixel face (requested, third pass)

The first build followed §4.8/§5.1 and drew every string as a bitmap face (a 5×7 system
table for chrome, Silkscreen for prose, the 5×7 table at 2× for headings). At 480×270 that
is legible; scaled to a real window it is not, and the request was explicit: **normal
typefaces, not a pixel font**.

| Spec | Shipped now | Licence |
|---|---|---|
| `pixel_ui_5` — "m5x7-class 5×7" | **Inter SemiBold** at 9 px | OFL-1.1, notice committed |
| `pixel_body_8` — "Pixel Operator-class 8 px" | **Inter Regular** at 9 px | OFL-1.1, notice committed |
| §5.4 "menu items 34 px → 10 px display" | **Inter SemiBold** at 15 px (`display`) | same |

What changed underneath, and why each piece exists:

* **The faces ship as subset webfonts** — `web/assets/fonts/delve_sans_400.woff2` and
  `…_600.woff2`, ~6 KB each. `tools/build_text_faces.py` cuts them from the OFL Inter
  sources in `tools/sources/` to `tools/lib/strings.charset()` (printable ASCII, the
  typographic marks the copy uses, plus whatever else the strings reach for). The
  stylesheet declares them; the page draws text with `ctx.fillText` in `js/ui/render.js`.
* **Widths still come from a baked table.** `web/assets/fonts/font_metrics.json` carries
  every character's advance in font units, and `TextFace` (`js/ui/font.js`) rounds each one
  to whole design pixels. `tools/check_project.py` measures the page layouts from the same
  table, so a width the gate computes and a width the page draws are the same integer — the
  property the bitmap build kept with `.fnt` xadvance, kept without `.fnt`. Notably there is
  no `measureText` anywhere in the shipped code: it returns fractions, and fractions drift.
* **The offline renderers kept working.** They have no font rasteriser (a Node process, and
  a Python previewer), so `tools/build_text_faces.py` also bakes a 1:1 coverage atlas of
  every face into `tools/atlas/` — that is what `web/tests/shoot.mjs` and
  `tools/preview_screen.py` blit. The page never loads the atlas; it draws the real font.
* **The coverage gate got sharper.** `check_project.py` fails if the shipped faces, their
  metrics or the atlases miss any character in the charset — which is how the one visible
  bug of the conversion was caught: `1920×1080` in the options schema needed a `9` that no
  other shipped string carried, and the subset (driven by the strings) had quietly left it
  out. The charset now includes printable ASCII wholesale; the atlas-builder also refuses
  to drop a glyph that does not fit its line box (that is how `body.ascent` went 9 and
  `display.ascent` 15 — `|` and `$` are taller than cap height).

The legal screen therefore names the real type (`Type: Inter (OFL-1.1), subset for this
build`); `STR_FONT_LINE` is a build string, not a §5.11 spec string, so the spec-parity
gate is unaffected. To go back to the spec's pixel faces: put them in `tools/sources/`,
point the builder at them, re-run `tools/build_all.py --check`, and restore the line.

Sizes are the spec's roles, not a literal re-use of its pixel counts (a 5 px chrome face is
unreadable in a real typeface): chrome/body 9 px on a 12 px line, display 15 px on an 18 px
line. Every rect in `data/` is unchanged; the labels sit inside them, verified by the
Python layout gate and by `shoot.mjs`.

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

### 2.5 Footer: back on one row, two pixels higher

The first build stacked the two footer lines because the 5 px bitmap face measured the
abridged disclaimer at 360 px and the version stamp at 252 px — 612 px of a 480 px row —
where §5.4 puts them on one line. The shipped 9 px Inter face is narrower: the disclaimer is
**249 px** and the stamp **195 px**, 444 px of the same row, so the spec's single row is
restored — disclaimer at x 10, stamp right-aligned to x 470, both at y 258.

The one pixel of deviation left is y: the row's line box is 12 px (ascent 9 + descent 3), so
at the spec's y 259 the bottom row of any descender would fall off the canvas. Both rects are
asserted in bounds, non-overlapping and right-aligned to 470 by `check_project.py` and
`web/tests/run.mjs`; the spec's original numbers stay in `menu.spec_rects`.

### 2.6 Placeholder cards for the last two pages

CODEX and CREDITS still show a parchment card: title, one-line body, hint and `BACK`.
Titles and bodies live in `data/strings.json` as `STR_STUB_<ID>_TITLE` / `_BODY`, so
replacing a card with the real page touches one call site
(`js/screens/menu.js` → `activate()`). PLAY, CONTINUE and OPTIONS now route to their real
screens.

CONTINUE follows §5.4 exactly even in this build: dimmed to 40 % with no contract, tooltip
`No contracts signed yet.` on hover, `SFX_UI_DENY` when pressed.

### 2.7 Audio files are not committed

The cue table (§5.10, §8, §9) is complete in `data/audio_cues.json`, and `Sound` plays by
id. Four of them are committed (the 90 s menu theme and Corwin's three VO lines, moved here
from the retired engine tree by `tools/fetch_audio.py --from-repo`); the rest land cue by
cue. Everything else stays out of Git, matching the repo's "no big binaries" convention.


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
call site each, named in the code: `js/screens/first_run.js::signAndDescend()` and
`js/screens/ledger.js::onRowSelected()`. When Loading lands, both calls become
`go_to('loading', …)`; nothing else in either page changes.

Two smaller, related decisions:

* **A full ledger refuses.** §5.5 does not cover `BEGIN NEW` with all eight slots used. The
  card plays `SFX_UI_DENY` and stays up rather than overwriting a contract; First Run cannot
  be reached in that state (PLAY only offers the card when a slot is free).
* **The ledger needed an exit.** §5.5 gives the ledger no exit control and §5.4 only forbids
  ESC from quitting the *menu*. `BACK` (60, 244, 80, 18) was added — the same rect the
  Options page uses — plus ESC. Without it a mouse player could not leave the page.

### 2.9 First Run: the spec's anchors are floors, and the help flows

§5.5 fixes the three group labels at y **56 / 104 / 152** — a 48 px pitch — and puts 8 px help
under each group. Label (8) + pills (16) + three 8 px help lines (24) = exactly 48, so the
groups stack with no gap *when the help is three lines or fewer*. It only works at all
because the shipped body face has an 11 px line height, so help blocks pass
`line_spacing: -3` (`data/shell_timings.json → screens.first_run.help_line_spacing`).

The first pass drew the groups at the anchors unconditionally, and the screenshots
(`shoot.mjs`) showed the result: the combat-pacing help ran straight through the
`Subtitles` / `Camera comfort preset` row. The layout now measures each help block with the
real face (`TextFace.measureBlock`) and places the next group at
`max(anchor, help bottom + 8)`, so the anchors hold whenever the prose fits and a group
drops only as far as it must. The comfort row keeps its two columns — subtitles 48…232,
camera comfort 240…432 — so neither help can run under the other's pills.

Content runs 48…432 — the panel's *inner* width rather than an arbitrary 360 px inset —
which keeps the difficulty help to two lines and the longer combat-pacing help to three.
`tools/check_project.py::check_screen_layouts()` re-measures both strings with the shipped
faces' metrics and fails the build if a help block would overrun its group.

### 2.10 Options: the help line, the scrolling Controls tab, one overhanging label

§5.6 fixes the rail, the rows panel, the row height and the control types, but says nothing
about a help line or about tabs with more rows than fit. Three decisions:

1. **Help line.** The schema's `help` text is drawn at (176, 244, 288, 12) — to the right of
   `BACK`, on the white field below the panel — wrapped to that width in the chrome face
   (9 px on a 12 px line). Two lines is the most any row needs there.
   `check_screen_layouts()` fails if a help block would run off the 270 px canvas or run into
   its widgets.
2. **Scrolling.** Ten rows fit between the panel's top edge and the help line. Accessibility
   has 10 and Controls has 12, so the page scrolls (wheel, ↑/↓ at the ends) and shows the
   4 px scrollbar the kit already builds. The spec's row height and panel rect are unchanged.
3. **The widest tab label.** `Accessibility` is 54 px at the shipped 9 px face, inside the
   spec's 64 px tab, so the first build's 3 px overhang is no longer needed — the label is
   centred in its tab like the other four.

Rebinds behave as §5.6 describes: the control becomes `Press a key…`, ESC cancels with
`Rebind cancelled.`, and the choice is stored as a display string plus a
`<row id>_keycode` so `InputActions.applyOverrides()` re-applies it at boot. The twelve yard
actions are registered with the spec's default keys in `InputActions.YARD_BINDINGS`. Rebind
pills are right-aligned to the row's control edge like every other control, so the row label
keeps its column. Tabs are drawn after the two panels, so the one label wider than its 64 px
tab is not half-covered by the rows panel.

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
* **Corrupt save.** `SaveStore.hasCorruptSave()` is true when the document exists but does not
  parse; the ledger then shows the ink card from §5.5 with `RETRY` (re-reads the file) and
  `CONTINUE WITHOUT SAVING` (keeps the session in memory; a later successful write clears the
  flag).

### 2.12 The card and the overlay keep the menu behind them

§5.5 draws `Begin a new contract?` as an *overlay* — the menu stays visible behind it. The
card is therefore drawn by `js/screens/menu.js` (`openNewContractCard()`) inside the menu
page, not as a shell state: closing it returns the untouched menu, ESC closes it too, and the
menu's own input handler stands down while it is up. The wax seal, the title and the verbatim body
(`STR_NEW_BODY`) are laid out from `data/shell_timings.json → screens.new_contract_card`.

---

### 2.13 Full screen: the design space fills the window (requested)

§1.3 of GDD-06 (and the note in `index.html`) fixed the frame at 480×270 scaled by **whole
numbers only**, which on a 1920×1080 window gives a 1440×810 picture in a black field — 25 %
of the screen wasted on every side, and no way to use a phone at all. The request was
"it isn't full screen".

Now the canvas *is* the viewport: `Shell.resize()` sizes the backing store to the window in
device pixels (capped at 2.6 Mpx, DPR-aware) and `fitViewport()` maps the 480×270 design
space onto it with **one uniform scale** — the largest that fits, so the design keeps its
proportions and reaches two of the four edges. What the scale leaves over is split between
the other two sides and painted by the screen's own ground (`Painter.fillViewport`), so
there is never a black bar: white pages bleed white, the boot pages bleed ink. Input is
mapped back through the same transform (`Shell.toCanvas`).

What that costs, stated honestly: pixel art is still blitted nearest-neighbour, so art
pixels are no longer always exact squares of screen pixels (at 3.55× a 1 px rule can land
on 3 or 4 device pixels). The alternative — a fractional scale with smoothing on, or
letterboxing — is worse: one blurs the art that is the game's identity, the other is the
thing this change was asked to fix. Text is drawn by the browser at the final resolution,
so it is unaffected and stays crisp. Everything else about the frame is unchanged: all
rects, timings and layouts are still written in the 480×270 space, and the preview PNGs are
still 1:1 renders of it — `fitViewport()` is a pure function with its own unit tests in
`run.mjs` and a smoke-test assertion against the booted shell.

---

## 3. Seeing a screen without a browser

`node web/tests/reel.mjs` is the moving-picture sibling of the stills below: it drives the
same booted shell through the boot sequence with scripted input, writes one PNG per frame and
assembles `web/preview/reel.gif` with ImageMagick `convert`. It is not a gate — CI records it
in its own `reel` job and keeps the GIF as the `boot-reel` artifact, so a capture problem can
never read as a broken page.

`python3 tools/preview_screen.py` renders the shell's screens to PNG straight from the
shipped assets — same rects, same strings, the same text faces (through the baked
coverage atlas, since Python has no font rasteriser either), same nine-patches — into
`web/preview/` (git-ignored):

```bash
python3 tools/preview_screen.py                    # every screen
python3 tools/preview_screen.py menu --scale 2     # one screen, 2x for legibility
python3 tools/preview_screen.py first-run ledger options-rebind
```

Screens: `legal` · `menu` · `menu-tooltip` · `menu-new-contract` · `sting-end` · `stub` ·
`first-run` · `ledger` · `ledger-confirm` · `options-graphics` · `options-audio` ·
`options-accessibility` · `options-controls` (scrolled) · `options-rebind` (capturing a key).
These are the **static** pages — the ones whose pixels come from data rather than from a
running screen — and §3.1 below covers the animated ones, which only the JavaScript
renderer can reach.

It is how the footer collision (§2.5), the first-run help overflow (§2.9) and the ledger
hint landing on row 8 (§2.11) were all found — and it is the fastest way to check a layout
change without opening a browser. `check_project.py` enforces the same numbers statically.

### 3.1 …and the same thing again, through the JavaScript

`python3 tools/preview_screen.py` re-implements the layout in Python, which means it can
agree with a bug. `node web/tests/shoot.mjs` does not: it boots the **real** `Shell` against
a DOM stub whose canvas keeps its pixels — `fillRect`, `drawImage` (source rects, alpha, and
the `source-in` composite the text tinting uses) and `clearRect` all rasterise into an RGBA
buffer, which is then written out as a PNG.

```bash
node web/tests/shoot.mjs                     # every page → web/preview/shell-*.png
node web/tests/shoot.mjs menu ledger         # just those pages
node web/tests/shoot.mjs faces               # the faces and panel patches, as a measuring stick
```

The nineteen shots: `legal` · `sting` · `sting-end` (all three emblem steps lit, wordmark and
sublock) · `menu` · `menu-hover` · `menu-tooltip` · `menu-new-contract` · `first-run` ·
`ledger` · `ledger-confirm` · `ledger-corrupt` (a scorched slot read back from a wrecked save) ·
`options-graphics` · `options-audio` · `options-controls` (scrolled) · `options-rebind`
(capturing a key) · `options-accessibility` · `codex` · `credits` (the two stub cards) ·
`faces`.

Shots carry the same names as `preview_screen.py`'s screens, so the same page can be rendered
by both renderers and compared — `web/preview/menu.png` (Python) against
`web/preview/shell-menu.png` (JavaScript). Where the two disagree, `shoot.mjs` is right: it
draws what the game draws.

It is the fifth gate (CI runs it and uploads the images as the `shell-pages` artifact), and
it has already paid for itself five times:

* the menu drew **nothing but rectangles** — `render.js` resolved image loads into a local
  promise and never put the decoded image back into its cache, so every `drawImage` found
  `null` (the smoke test could not see this: its canvas throws pixels away);
* every label was **short**. `font.px` is the `.fnt`'s nominal em — 10 px on the display face
  — while its glyphs are 14 px tall, because that face is baked at 2×. The tint surface was
  sized from the em, and then the `source-in` fill covered only the top `font.px` rows, so the
  bottom of every glyph stayed white: `PLAY` drew as a stem, a box and a Y, and no other gate
  could see it. Both halves use `PixelFont.inkHeight` now, and *this* gate measures the ink
  box (`checkTextInk()`) so the class of bug cannot come back;
* the first-run page **darkened as you looked at it** — `first_run.draw()` opened with
  `Ui.dim(0.6)` and never painted a ground, so every frame re-dimmed the previous frame's
  pixels and the page settled from white to ink over about a dozen frames. Every screen now
  paints its own ground on the first line;
* exiting Options with a rebind armed **threw** — the screen called `stopListening()` on a
  widget whose method is `cancel()`;
* the nine-patch cost **one `drawImage` per pixel-run**: 3,421,636 calls to paint the suite.
  Corners, edges and middle are nine blits now — 7,443 calls, for pixels proved identical to
  the old tiling on all nineteen pages — and the offline previewer was brought into step, so
  the two renderers still agree.

The last point is the one to keep: after those fixes `tools/preview_screen.py` and
`shoot.mjs` agree to within a few hundred pixels on every page — the residue is the widget
focus and hover states a static lint draws at rest. Where they do disagree, `shoot.mjs` is
right: it draws what the game draws.

---

## 4. Layout conformance (§5.4)

Verified by `tools/check_project.py` (numbers) and `web/tests/run.mjs` + `web/tests/smoke.mjs`
(the live layout, drawn in Node):

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
| First Run groups | y 56 / 104 / 152, pills h 16 gap 4 | anchors as floors; a group drops only when the help above it needs the room (§2.9) |
| First Run footer | (56, 224, 148, 18) `BACK` · (276, 224, 148, 18) `SIGN & DESCEND` | same |
| Contract card | parchment nine-patch, wax emblem 24 px, title + verbatim body, `BEGIN NEW` · `BACK` | same; body wraps to 4 lines and clears the buttons by 28 px |
| Ledger panel | (60, 24, 360, 222) | same |
| Ledger rows | 8 × 24 px at y 48 + 24i | same; last row ends at y 240, hint outside the panel |
| Options tab rail | (8, 16, 72, 238) | same |
| Options rows panel | (88, 16, 384, 238), row h 20 | same; rows at x 96, controls right-aligned to 460 |
| Options `BACK` | (88, 244, 80, 18) | same (commits + writes the save document) |

Boot timings (§5.2) live in `data/shell_timings.json` and are read, not hard-coded:
0.8 s reveal · steps at 800/1200/1600 ms · chisel at 2000/2200/2400/2600/2800 ms · sublock
fade at 3000 ms with the sweep to 3600 ms · 4.0 s total · skip from 1.5 s · reduced-motion
minimum 1.0 s.

---

## 5. Where the next piece plugs in

| Next piece | Touch points |
|---|---|
| §5.3 painted backdrop | `js/screens/menu.js` draws the lockup today; a backdrop layer renderer belongs in `js/ui/` with the layer PNGs in `assets/pixel/backdrops/` |
| §5.7 codex / §5.8 credits | replace `js/screens/stub.js` from the same menu wiring; the strings and the rect are already in `data/` |
| §5.9 loading | `data/shell_timings.json → loading` has the dwell and weights, the 16 tips are in `shell_content.json`; add `js/screens/loading.js` and register the `loading` state in `shell.js` — the two call sites listed in §2.8 become `go_to('loading', …)` and the yard consumes `GameState.payload.resume_slot` |
| §6 yard | new `js/screens/yard.js` plus `js/world/` for the tile renderer; the tile builder will read `data/yard_map.json` in the schema of GDD-07 §12 |

Rules plumbing that already exists and is tested: `Dice` (R1/R2/R3/R4 maths, the maths line
for the Roll Moment), `RngStreams` (deterministic, per-domain seeds), `InputActions`
(rebinding), `Sound` (cue table, buses, the gesture gate) and `SaveStore` (schema 2 with
`tutorial.completed_beats`, `codex_unlocks`, `combat_stats`).

---

## 6. Known gaps and honest risks

1. **The rasteriser is an emulation of a canvas, not a canvas.** `web/tests/shoot.mjs`
   exercises the real screens, the real fonts and the real drawing calls, and its output is
   how the bugs in §3.1 were found — but it re-implements the canvas, so anything that depends
   on a browser-only behaviour (sub-pixel filtering, colour management, the actual
   `localStorage` quota, WebAudio) is still first exercised by a human on the live preview.
   When a picture and the served page disagree, the served page is right.
2. **Browser differences are real.** Canvas 2D, WebAudio decoding and `localStorage` are
   implemented everywhere this ships, but Safari is stricter about autoplay (the gesture gate
   in `legal.js` covers it) and about `localStorage` in private mode (`SaveStore.flush()`
   reports and keeps the in-memory state rather than throwing).
3. **Only what shipped is exercised.** Codex, credits and loading still exist only as
   strings, timings and data; the yard is not started.
4. **Sound is silent until files land.** Four cues have audio (the menu theme and three
   Corwin lines); `Sound` prints one line per missing cue the first time it is asked for one
   (`[sound] cue 'X' has no audio file yet`) — that is expected, not an error, until more
   audio lands or `tools/fetch_audio.py` copies it in.
5. **The OGG keeper is above the web budget.** GDD-07 §8 asks for cues ≤ 150 KB as MP3; the
   committed 90 s menu theme is a 1.2 MB OGG. It is the file the spec names as an existing
   keeper, and a 90 s music bed cannot honestly fit 150 KB — transcode to MP3 (or serve it
   Brotli-compressed) when the audio pass happens.
6. **Colour-blind and magnification rows are stored, not yet applied.** Every §5.6 row is
   persisted and read back, but `ui_scale` and the overlay-tint LUTs have nothing to act on
   until the yard draws.
