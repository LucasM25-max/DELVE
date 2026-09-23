# DELVE

A Dungeons & Dragons adventure — *Phandelver and Below: The Shattered Obelisk*.
An unofficial, non-commercial fan project; **never for sale**.

**The game in this repository is a static website.** HTML, ES modules, JSON and
PNG, served by Vercel from the `web/` directory. There is no engine, no build
step, no Blender and no Godot: clone it, serve `web/`, and it runs.

```
web/          the game  — 480×270 pixel canvas, ES modules, no dependencies
tools/        the asset builders and the gates (Python 3, stdlib only)
docs          00…07 — the design and build specifications
.github       CI: the gates run on every push
vercel.json   outputDirectory: "web"
```

---

## Play it locally

```bash
git clone https://github.com/LucasM25-max/DELVE && cd DELVE
python3 -m http.server 8080 --directory web
# open http://localhost:8080
```

`file://` will not work — ES modules and `fetch` need an HTTP origin.

## What is built

The **prologue shell** (GDD-07 §5):

- **Boot** — the legal/attribution page (any input continues *and* unlocks audio,
  which browsers require a gesture for), then the 4.0 s logo sting, skippable
  after 1.5 s and shortened under reduced motion.
- **Main menu** — the §5.4 lockup, five items on a 21 px pitch, hover underline,
  `CONTINUE` dimmed to 40 % with no contract, footer disclaimer and version stamp.
- **Play** — the `Begin a new contract?` overlay when a contract exists, otherwise
  the First Run contract page (difficulty, combat pacing, subtitles, camera
  comfort) which writes a real slot into the eight-slot ledger.
- **Continue** — the contract ledger: emblem stamps that light with progress, per
  slot `DELETE` behind a blood-red confirm card, and the scorched-save card for a
  save that will not parse.
- **Options** — five schema-driven tabs (Graphics, Gameplay, Accessibility, Audio,
  Controls) with segmented pills, ten-pip sliders, key rebinding and a scrolling
  Controls page.
- **Codex / Credits** — placeholder cards; the pages themselves are the next work.

Two documented deviations shape the flow: the menu ground is plain **white**, and
controls that would leave the menu for the unbuilt Loading screen and yard return
to the menu with their spec text intact. Every deviation and its justification
lives in [`web/docs/PIXEL_MENU_BUILD_NOTES.md`](web/docs/PIXEL_MENU_BUILD_NOTES.md).

## Deploy

Vercel publishes [`web/`](web/README.md) as a static site — `vercel.json` sets
`outputDirectory`, so there is nothing else to configure. Connect the repository
once and every push gets a preview; `main` gets production.

Nothing reaches the public URL that has not passed the gates first:

```bash
python3 tools/check_project.py     # paths, module graph, data, fonts, palette, layouts, art lint
python3 tools/check_strings.py     # shipped copy against GDD-07, byte for byte
node web/tests/run.mjs             # unit suite (no dependencies)
node web/tests/smoke.mjs           # boots every page headless
node web/tests/shoot.mjs           # rasterises every page to web/preview/*.png
```

They all run in CI on every push (`.github/workflows/gates.yml`), which also
attaches the rendered pages to the run as a `shell-pages` artifact, so a commit
always comes with a picture of what the deploy will show. A second job records
the boot sequence — legal page, sting, menu, options, contract page — as
`web/preview/reel.gif` (`node web/tests/reel.mjs`, the `boot-reel` artifact):
the stills say the pages are right, the reel says the timings are.

## Documents

| # | Document | Status |
|---|---|---|
| 00 | Art direction & mechanics plan | active |
| 01 | Chapter 1 tutorial & tactical combat | active |
| 02 | Shell spec | active (converted to pixels by 07) |
| 03 | Neverwinter yard level spec | active (converted to pixels by 07) |
| 04 | Godot + Blender production plan | **retired** — kept for history only |
| 05 | How to play (engine build) | **retired** — kept for history only |
| **06** | **Browser pixel conversion plan** | **active — the plan this build follows** |
| **07** | **Pixel prologue build spec (menu + yard)** | **active — binding content spec** |

Documents 04 and 05 describe the retired engine pipeline. Nothing in this
repository builds, imports or ships them; the current build is documents 06 and
07 alone.

## Rights

Dungeons & Dragons, *Phandelver and Below: The Shattered Obelisk* and all
Wizards of the Coast characters and locations are trademarks of Wizards of the
Coast LLC, used here without permission and with no challenge to any trademark or
copyright. Rules text is sourced from the System Reference Document 5.2.1
(CC-BY-4.0); the attribution block ships on the game's legal screen, in the
credits and in [`07_PIXEL_PROLOGUE_YARD_AND_MENU_BUILD_SPEC.md`](07_PIXEL_PROLOGUE_YARD_AND_MENU_BUILD_SPEC.md) §14.2.
Typefaces are the 5×7 system face (MIT) and Silkscreen (OFL-1.1); the licences
sit beside the fonts in `web/assets/fonts/LICENCES`.
