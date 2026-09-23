# DELVE on Godot — how to get it playing, step by step

**Version:** 1.0.0-godot · **Date:** 2026-09-19 · **Engine:** Godot 4.5-stable
**What this is:** the entire GDD-02 shell (menu, first run, options, codex, credits,
loading road, contract end-card) rebuilt natively in GDScript — milestone **M3-shell**
of `04_GODOT_BLENDER_PRODUCTION_PLAN.md`. No web tech left inside; the old HTML shell
(v1.7.0 zip) remains only as the design reference.

You have three ways to play, easiest first.

---

## Way 1 — Play it right now in your browser (zero install)

**The game's browser home is [`/play/`](/play/)** — a stable redirect into the versioned pixel
build (`/play/v0.4.x/`, per GDD-06 §9.3). From milestone **M7** (the web release candidate) that
path serves the 480×270 pixel build: open it, click the canvas once (focus + audio unlock), press
any key at the attribution screen — legal → sting → menu → contract → yard.

Until that deploy flips the path on, the browser-playable artifacts are:

- the **legacy HTML shell at the site root** — the original GDD-02 menu shell, kept there on
  purpose as the fan-project front door and design reference;
- exported Godot builds on the **[Releases](https://github.com/LucasM25-max/DELVE/releases) page**
  (e.g. [`v0.3.0-godot-3d`](https://github.com/LucasM25-max/DELVE/releases/tag/v0.3.0-godot-3d)) —
  unzip the export and serve the folder with any static server (`godot/tools/serve_web.py` is
  included). The build is single-threaded, so COOP/COEP headers are recommended but not required.

There is no in-chat preview and no fixed local port anymore.

## Way 2 — Run it in the Godot editor (recommended for development)

1. Install **Godot 4.5-stable** (standard build, not .NET): https://godotengine.org/download
2. Unzip `DELVE_godot_v1.0.0.zip`.
3. Launch Godot → **Import** → pick `delve-godot/project.godot` → **Import & Edit**.
   The first open re-imports fonts/textures (~10 s).
4. Press **F5** (run the main scene). The game boots exactly like the browser build,
   natively at 1600×900 (stretch = canvas_items, so any window size works).

## Way 3 — Export your own desktop/web builds

Presets are already configured in `export_presets.cfg` (Web / Windows Desktop / Linux/X11).

1. In the editor: **Project → Export…** → choose a preset → **Export Release…**.
   First time Godot asks to download the 4.5 export templates — accept (~1.4 GB).
2. Or headless, from a terminal:

```bash
godot --headless --path delve-godot --export-release "Web" ../out-web/index.html
godot --headless --path delve-godot --export-release "Windows Desktop" ../out-win/DELVE.exe
godot --headless --path delve-godot --export-release "Linux/X11" ../out-linux/delve.x86_64
```

3. Serve the web folder with `tools/serve_web.py` (see Way 1); the desktop binaries run
   by double-click (Windows may show a SmartScreen notice for unsigned builds).

---

## Controls (shell surfaces)

| Where | Input |
|---|---|
| Attribution / sting | any key or click (sting skippable after 1.5 s) |
| Menu | `W/S` or `↑/↓` select, `Enter` activate, `C` codex, mouse hover/click |
| First Run / Options / Codex | mouse or `Tab` focus + `Enter`; `Esc` back to menu |
| Options key-caps | click the cap → press the new key (`Esc` cancels the capture) |
| Credits crawl | hold `Space`/`Shift` to hasten, mouse wheel scrubs, click near the end skips |
| Loading road | `Esc` aborts back to menu; error state offers RETRY / QUIT |

Everything else (camera view `V`, folio `Tab`, journal `J`, hide `H`, end-turn `Space`…)
is listed — and re-bindable — under **Options → Controls**; the bindings persist in
`user://options.cfg`, the signed contract in `user://contract.save`.

## What you will see (all verified by automated playtest, 2026-09-19)

legal → sting → **menu** (panorama, lockup, 5 items, new-contract modal) →
**first run** (4 questions, wax seal stamp) → **loading** (real threaded loads, ink
route + nib + waypoints, rotating seal, 3 pips, 16 rotating field-advice tips, slow-load
hint, error card with retry) → **end card** (CONTRACT SIGNED / RESTORED) →
**options** (6 sections, live sliders/segments, key-caps, reset binds) →
**codex** (Rules of Engagement ·15 PHB-2024 excerpts with tables, The Ledger ·2 after
signing, Bestiary empty-state) → **credits** (crawl → wax-seal end card).

Evidence: `shots/g9-01 … g9-14` (Playwright, web export) + headless CI
(`godot --headless -- --ci` → `CI_ALL_GREEN`), both with **zero console errors**.

## Audio

Silent by design until you supply files: drop generated OGG/WAV into
`delve-godot/assets/audio/` exactly as named in `manifest.json`
(see `AUDIO_GENERATION_GUIDE.md` for prompts + tools + upload steps). The buses
Master/Music/Sfx/Voice and the menu-theme/ambience logic are already wired.

## Where the game itself is

This doc describes the **shell** as built under the old 3D plan. The game around it — the
Neverwinter yard, turn-based grid combat, milestones and the pixel pivot — is now planned in
`06_BROWSER_PIXEL_CONVERSION_PLAN.md` (GDD-06): the first playable is the full shell plus one
playable pixel yard (GDD-06 §3.1), delivered by milestones **M0–M8** (GDD-06 §12).
`04_GODOT_BLENDER_PRODUCTION_PLAN.md` (GDD-04) is **superseded** by GDD-06.
