# DELVE — the web build (`web/`)

The pixel version of DELVE: a static website. **No engine, no build step, no
Blender.** `index.html` loads ES modules, the data lives in JSON, the art is PNG
and the whole game is served straight from this repository by Vercel.

Built from **GDD-06** (browser pixel plan) and **GDD-07** (pixel prologue build
spec).

**Shipped:** the boot sequence (legal page → 4.0 s logo sting), the **main menu**
(§5.4 layout, strings, timings and cues to the letter), and the real **Play,
Continue and Options** pages — the First Run contract page and the `Begin a new
contract?` overlay (§5.5), the eight-slot contract ledger (§5.5), and the
schema-driven Options rail (§5.6).

**Stubbed on purpose, and documented:** the Loading screen and the yard do not
exist yet, so every control that would leave the menu for them returns to the menu
instead (its text is unchanged), and CODEX / CREDITS still open placeholder cards.
The full deviation list, each one justified, is in
[`docs/PIXEL_MENU_BUILD_NOTES.md`](docs/PIXEL_MENU_BUILD_NOTES.md).

---

## Run it

Any static file server works — there is nothing to compile:

```bash
python3 -m http.server 8080 --directory web   # then open http://localhost:8080
```

`file://` will not work: ES modules and `fetch` both need an HTTP origin. On
Windows, `npx serve web` or `php -S localhost:8080 -t web` are equivalent.

## Deploy it

Vercel publishes `web/` with the settings in [`../vercel.json`](../vercel.json):

```json
{ "outputDirectory": "web" }
```

Connect the GitHub repository to a Vercel project once; every push to a branch
gets a preview URL and every push to `main` gets production. Because the site is
static, the deploy is the repository: `tools/check_project.py` plus the two Node
suites in `.github/workflows/gates.yml` are what decide whether a commit is
good enough to serve.

## Layout

```
web/
├ index.html            the page: one full-window canvas, one module entry point
├ css/shell.css         the full-window canvas and the webfont faces
├ data/                 every string, rect, timing and schema the game draws
│  ├ strings.json       §5.11 master (spec block) + this build's strings
│  ├ shell_timings.json §5.2/§5.4/§5.5/§5.6 timings and rects, verbatim
│  ├ shell_content.json loading tips, credits blocks, legal block keys, beat list
│  ├ options_schema.json §5.6 rows (5 tabs, 39 rows)
│  ├ brand.json         lockup geometry (emblem steps, wordmark cells)
│  ├ fonts.json         the three text faces: source, size, ascent, line height
│  └ audio_cues.json    121 cues, played by id
├ js/
│  ├ main.js            entry point: boot the shell, start the frame loop
│  ├ shell.js           canvas, screen swap, frame clock, input routing
│  ├ core/              data · palette · brand · state · save · dice · input · sound
│  ├ ui/                render · font · kit · widgets
│  └ screens/           screen · legal · sting · menu · stub · first_run · ledger · options
├ assets/
│  ├ fonts/             delve_sans_400/600.woff2 · font_metrics.json (+ LICENCES)
│  ├ pixel/palette/     the locked 32 + 8 ramp and the below-LUT
│  ├ pixel/ui/          emblem, wordmark, lockups, nine-patches, buttons, seal
│  └ audio/             the four cues that already exist (menu theme + 3 VO lines)
├ tests/                run.mjs (unit) · smoke.mjs (boots every page headless)
│                       shoot.mjs (renders every page to web/preview/*.png)
├ docs/                 build notes: deviations, §5.4 conformance, next steps
└ preview/              rendered page sheets (regenerable, not committed)
```

## How the code is organised

- **Data drives the layout.** No screen hard-codes a rect, a label or a delay:
  they all come from `data/*.json`, which is also what the Python gate measures
  and what the offline previewer renders. Changing a rect is a data change.
- **One writer per concern.** `ui/render.js` is the only module that touches the
  canvas, `ui/kit.js` the only one that knows an asset path, `core/save.js` the
  only one that writes storage, `core/sound.js` the only one that starts audio.
- **Screens are pages, not widgets.** A screen builds its widget list, draws it
  and handles input; it never reaches into another screen. Navigation goes through
  `ShellScreen.go_to()` and the shell swaps the page.
- **Whole pixels everywhere.** Rects are integers and text is measured in whole
  pixels from the faces' baked advances (never `measureText`, which returns
  fractions). The canvas is the window: the 480×270 design space is mapped onto
  it by one uniform scale, pixel art is blitted nearest-neighbour, and the type
  is rasterised by the browser at that scale — so it is sharp on every screen.

## Gates

```bash
python3 tools/check_project.py     # paths, module graph, data, fonts, palette, layouts, art lint
python3 tools/check_strings.py     # shipped copy vs GDD-07, byte for byte
node web/tests/run.mjs             # 514 unit checks
node web/tests/smoke.mjs           # boots every page against a DOM stub
node web/tests/shoot.mjs           # renders every page through the real painter
python3 tools/build_all.py --check # asset builders are reproducible (needs fontTools)
python3 tools/build_text_faces.py  # re-cut the text faces after a copy change
python3 tools/preview_screen.py    # the static layout lint, straight from the assets
node web/tests/reel.mjs            # the boot sequence as web/preview/reel.gif (CI artifact)
```

The first five run on every push in
[`.github/workflows/gates.yml`](../.github/workflows/gates.yml), which uploads the
rendered pages as the `shell-pages` artifact. A red gate is the only thing standing
between a commit and a deploy, so keep them green.

`shoot.mjs` is the honest one: `preview_screen.py` re-implements the layout in
Python and can agree with a bug, whereas `shoot.mjs` boots the actual screens and
blits through a canvas that keeps its pixels. It also measures a tinted run on each
face and fails if the ink box comes up short, so clipped glyphs cannot ship. Between
them they caught the defects listed in
[`docs/PIXEL_MENU_BUILD_NOTES.md`](docs/PIXEL_MENU_BUILD_NOTES.md) §3.1 — the last of
which was found by watching the reel rather than the stills.

## Where the next piece plugs in

| Piece | Where it goes |
|---|---|
| Loading screen (§5.9) | `js/screens/loading.js` + `ShellScreen` state `loading`; rects already in `shell_timings.json.loading` |
| Yard (§6) | `js/screens/yard.js` plus `js/world/` for the tile renderer; map from `data/yard_map.json` in the GDD-07 §12 schema |
| Codex (§5.7) / Credits (§5.8) | replace `js/screens/stub.js` behind the same menu wiring — the strings and the rect are already in `data/` |
| Sound | drop files into `assets/audio/` with the names in `data/audio_cues.json`; the game picks them up with no code change |
| A moving capture | `node web/tests/reel.mjs` already records the boot path; extend its `SCRIPT` with the yard beats once they exist |
