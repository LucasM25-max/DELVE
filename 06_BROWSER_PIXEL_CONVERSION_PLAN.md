# DELVE — GDD-06 · BROWSER PIXEL CONVERSION PLAN

**From: Godot 4.7.2 3D menu shell + 3D blockout yard → To: 2D pixel-art browser game (Godot 4.7.2, Web export)**

| Field | Value |
|---|---|
| Document | `06_BROWSER_PIXEL_CONVERSION_PLAN.md` (GDD-06) |
| Version | 1.0 |
| Date | 2026-09-23 |
| Status | **Proposed — awaiting approval of §16 open questions** |
| Author | Arena.ai agent session (`arena/01a0cd23-delve`) |
| Supersedes (in part) | GDD-00 Part 1 (§1.1–1.6 art direction & technology), GDD-04 (Godot+Blender 3D production plan) |
| Extends / honours | GDD-01 (combat & turn model), GDD-02 (shell spec), GDD-03 (yard level spec) |
| Target engine | Godot 4.7.2 Standard · GDScript · **Compatibility renderer** · single-threaded Web export |
| Scope of the build this plan produces | The **shell** (boot → menu → contract → options/codex/credits → loading) **plus one genuinely playable top-down pixel yard** with turn-based grid combat |

---

## 0. HOW TO READ THIS DOCUMENT

Every claim about the current codebase in §2 was taken from the repository at commit `17c5fbc` on 2026-09-23
(file counts, line counts, node types, asset sizes). Every engine-level claim in §4, §9 and §11 was checked
against current Godot documentation/community practice rather than memory; where a setting name or tag could
not be verified from here, it is flagged **[VERIFY]** and given a backlog task.

Conventions used throughout:

- **[NEW]** — a file, scene or system that does not exist yet and must be created.
- **[CONVERT]** — an existing file that survives but changes (scene type, layout, asset paths).
- **[KEEP]** — an existing file that ships unchanged.
- **[RETIRE]** — an existing asset/system that leaves the build (and where it goes instead).
- **T-xx** — a task identifier, collected in §13.
- **M0–M8** — milestone identifiers, defined in §12.

The single most important structural fact this plan is built on: **the conversion is roughly 25 % new game
code and 75 % re-skin of code that already exists.** The shell is 1 482 lines of Godot `Control` code that is
engine-agnostic in principle — it needs a new palette, new fonts, a new layout grid and new art, not a rewrite.
The genuinely new subsystems are the tile world, the rules grid and the turn engine (§6).

---

## 1. EXECUTIVE SUMMARY

### 1.1 Locked decisions (from the 2026-09-23 clarification round)

| # | Question | Decision |
|---|---|---|
| D1 | Build target | **Stay in Godot.** Rebuild as a 2D pixel game with a low-res viewport and a Web export. The engine, GDScript, scene structure, save system and shell state machine are kept. |
| D2 | Scope of the first playable | **Port what exists now**: the full shell + **one playable pixel yard** (not the full 13-area prologue, not Chapter 1). |
| D3 | Camera & combat | **Top-down, turn-based on a grid.** Free exploration; on encounter, a 5-ft grid appears and combat runs on initiative with actions/bonus actions/reactions/movement. This is GDD-01's "Table Mode", rendered top-down. |
| D4 | Art | **AI-generated pixel art, curated in-session to a locked palette** through a deterministic downscale/quantise/clean/pack toolchain (§5). |
| D5 | IP route | **Keep the fan-project names** (Neverwinter, Phandalin, Corwin, Gundren…). Non-commercial, never sold, disclaimer retained on the legal screen and in the credits. §15 lists the obligations that *survive* this choice. |
| D6 | Deliverable of this round | **This document.** No code is written in this round. |

### 1.2 What changes, in one page

| Layer | Today | After |
|---|---|---|
| Renderer target | 3D (`CharacterBody3D`, `Camera3D`, glTF characters, `Sky3D`, `Terrain3D` adopted) | 2D (`TileMapLayer`, `CharacterBody2D`, `Camera2D`, `Sprite2D`/`Polygon2D` rigs, no plugins) |
| Viewport | 1600×900, `stretch/mode = canvas_items`, `aspect = expand` | **480×270**, `stretch/mode = viewport`, `aspect = keep`, `scale_mode = integer`, nearest filtering |
| Art | 41 MB of glTF characters + 32 MB of PBR textures + a matte painting | ≈1–3 MB of atlases: 16×16 tiles, 16×24 character rigs, nine-patch UI, pixel FX |
| World | 44 m × 44 m 3D blockout (`test_yard.tscn`, 15 `M_YRD_*.glb` props, heightfield ground) | **29 × 29 tile** top-down yard (1 tile = 5 ft = 1.524 m → 464 × 464 px), built from the same GDD-03 area plan |
| Player | `CharacterBody3D`, WASD + mouse-look, pointer lock, first/third-person toggle, 43-clip animation library | `CharacterBody2D`, 8-way movement, no pointer lock, dialogue/camera-facing, 9 hand-authored animation states |
| Combat | none (an empty sparring sandbox) | **Turn-based grid combat**: initiative queue, movement budget, action/bonus/reaction, attack rolls, cover, line of sight, elevation, AoE templates, weapon masteries, conditions, enemy AI |
| Shell | 1 482 lines of `Control` code absolutely positioned on a 1600×900 grid (69 hard-coded `Rect2` calls) | Same state machine, re-laid-out on a 480×270 grid with a pixel nine-patch UI kit; same JSON content (`shell_content.json`, `options_schema.json`) |
| Audio | 1.2 MB Ogg music loop + 3 Ogg VO lines, Web-Audio-flavoured startup gating | Same sources, **transcoded to MP3 for the web build** (Safari/iOS compatibility, §8) |
| Plugins | `Sky3D` (12 MB, GDScript) + `Terrain3D` (GDExtension, *experimental on web*) | **Both retired.** Sky becomes a palette-keyed gradient + parallax card; terrain becomes tiles |
| Export | Manual: install Godot + templates locally, then Editor → Export | **CI-exported** on tag via a pinned Godot 4.7.2 container, deployed as a versioned static bundle |
| Repo | 337 MB working tree, a 69 MB ZIP tracked in Git, 80 MB of now-dead 3D assets tracked | ≈35 MB conservative tree, binaries in Releases, project folder renamed out of the `.godot` trap (§10.1) |
| First-load download | ~40 MB+ (WASM + PCK carrying 3D assets) | **≈10–14 MB** (≈8–11 MB WASM + ≤2 MB PCK + shell) |

### 1.3 The three numbers that define this project

1. **480 × 270** — base render resolution. 16:9, integer-scales exactly to 1920×1080 (×4), 960×540 (×2) and
   3840×2160 (×8). On 2560×1440 it renders ×5 (2400×1350) with 80 px pillars — acceptable, and the alternative
   (320×180) is too cramped for the 15 long-form codex entries we already ship.
2. **16 px** — tile size, and simultaneously the **rules scale**: 1 tile = 1 five-foot square = 1.524 m.
   The whole 5e grid therefore becomes literally countable on screen, which is this project's entire
   presentational thesis (GDD-00 pillar 1: "rules you can see are rules players trust").
3. **32 + 8 colours** — the locked palette: 32 "surface" colours (dawn Neverwinter, warm, lovable) and 8
   "below" colours (obelisk teal, psychic violet, bone). The *below* ramp is a **runtime LUT remap**, so the
   same tiles can be shown "infected" without a single new texture — GDD-00's "warmth above, wrongness below"
   pillar implemented as a shader rather than as an art budget.

### 1.4 What "shipped" means

The M8 release is done when, from a cold browser cache on a mid-range laptop:

1. The build loads in under ~8 s on a 10 Mbps link, with no console errors, in Chrome, Firefox, Edge and
   Safari (desktop), and in landscape on a modern phone.
2. A new player can: read the attribution screen → skip the logo sting → use every menu item → sign a
   contract → land in the yard → walk the yard → trigger the dummy-line encounter → fight a complete
   turn-based combat with movement, an attack, a bonus action and an enemy turn → win or yield → ring the
   practice bell to reset.
3. A returning player's contract ledger, options and tutorial progress persist across a reload and across a
   deploy of the next version at a stable URL.
4. All of it runs from a ≤15 MB payload at a locked 60 fps at 1080p, and the shipped tree contains no 3D-only
   asset, no plugin, no binary ≥ 5 MB outside Releases.

---

## 2. CURRENT-STATE AUDIT

### 2.1 Three artifacts live in this repository

| Artifact | Path | What it is | Verdict |
|---|---|---|---|
| Legacy web shell | `/index.html`, `/js/` (857 lines), `/css/` (838 lines), `/assets/img`, `/assets/audio` | The original zero-build vanilla-JS DELVE menu shell, deployed at the repo root (Vercel). Generated logo art, Web-Audio synthesis fallbacks, `localStorage` contract save (`delve.contract.v1`). | **[KEEP]** as the public landing page; it is *reference material* for the pixel shell's screen order and copy. Never becomes the game. |
| Godot project | `/.godot/` (**this is the project root, not the engine cache**) | Godot 4.7.2 Standard, Compatibility renderer, v0.3.0-godot. Native port of the shell + a 3D movement blockout with a CC0 humanoid. 392 tracked files, ~2 409 lines of GDScript. | **[CONVERT]** — this is what the pixel build grows from. |
| Design corpus | `/00_…`–`/05_…md` (≈216 KB), `AUDIO_*.md`, `/README.md` | GDD-00 art direction/mechanics, GDD-01 chapter 1 + combat, GDD-02 shell spec, GDD-03 yard spec, GDD-04 3D production plan, GDD-05 how-to-play. | **[KEEP]** with supersede banners (§10.4). |

### 2.2 Godot project inventory — file by file

| File | Lines / size | Role today | Disposition |
|---|---|---|---|
| `project.godot` | 48 lines | Autoloads `GameState`, `Sound`; 1600×900; `canvas_items`; Compatibility; Sky3D plugin enabled | **[CONVERT]** → §4.2 exact diff |
| `scenes/ui/shell.tscn` | 9 lines | Root `Control` with `shell.gd`; *UI is built in code* | **[CONVERT]** → pixel root `Control` at 480×270 |
| `scenes/world/test_yard.tscn` | generated by `tools/scene/build_test_yard.py` (534 lines) | 3D blockout: heightfield ground, 15 GLB props, NPC, player, WorldEnvironment | **[RETIRE]** the scene; **[KEEP]** the builder idea (becomes the tile-map builder, T-24) |
| `scenes/actors/player.tscn` / `npc_corwin.tscn` | 32 / 33 lines | `CharacterBody3D` + Quaternius hero + `SpringArm3D`; NPC with `AudioStreamPlayer3D` VO | **[CONVERT]** → `CharacterBody2D` + 2D rig + `AudioStreamPlayer2D` |
| `scripts/ui/shell.gd` | 832 | Screen state machine: `legal→sting→menu→{new,ledger,options,codex,credits,contract}→loading→yard`; threaded `ResourceLoader`; motes; ledger; credits scroll | **[CONVERT]** — logic survives; 63 of the 69 hard-coded `Rect2` rects live here |
| `scripts/ui/shell_ui.gd` | 303 | Palette constants, font loading, `StyleBoxFlat` factories, button/label/pill factories, procedural motes | **[CONVERT]** → pixel UI kit (`ui_pixel.gd`) + nine-patch textures; palette constants become the locked palette resource |
| `scripts/ui/options_page.gd` | 282 | Schema-driven settings UI + key rebinding from `options_schema.json` (6 categories, 50 rows) | **[KEEP]** logic → **[CONVERT]** presentation |
| `scripts/ui/backdrop.gd` | 110 | Panorama drift, mist/gull layers, reduced-motion support | **[CONVERT]** → 3-layer pixel parallax + palette-keyed dawn ramp |
| `scripts/ui/load_route.gd` | 30 | "Ink route" loading road animation | **[CONVERT]** → pixel route, or retire if the yard loads inside one frame (T-35) |
| `scripts/core/game_state.gd` | 149 | Settings, validation, input bindings, 8-slot contract ledger, atomic JSON writes to `user://delve_v1.json` | **[KEEP]** ~90 %; add schema v2 + migration (§4.10) |
| `scripts/core/sound.gd` | 52 | Bundled OGG playback, user-gesture startup, volume/focus/ducking | **[KEEP]**; add MP3 source set for web (§8) |
| `scripts/world/player.gd` | 101 | `CharacterBody3D`: camera-relative movement, sprint/jump, 8 locomotion states from the 43-clip UAL library, first-person toggle | **[RETIRE]** → new `player_2d.gd` (movement, facing, animation state machine, grid snap) |
| `scripts/world/npc_corwin.gd` | 231 | Idle lean/scan poses, `say()` VO playback, TR_A_LANE hook, `AudioStreamPlayer3D` | **[CONVERT]** → `npc_2d.gd`, same dialogue data |
| `scripts/world/test_yard.gd` | 319 | Pause overlay, pointer lock, focus-loss detection, Sky3D time/weather wiring, HUD, return to menu | **[CONVERT]** → `yard.gd`: no pointer lock at all (a genuine simplification), pause menu, HUD, day-time, weather overlays |
| `data/options_schema.json` | 6 categories / 50 rows | Settings schema with live/future flags | **[KEEP]**; prune 3D-only rows, add pixel-relevant ones (§6.12) |
| `data/shell_content.json` | 15 `rules`, 2 `lore`, 16 `tips`, 7 default groups | Codex text, loading tips, defaults | **[KEEP]** subject to §15 text-provenance review |
| `assets/audio/*.ogg` | 1.30 MB (1 music loop + 3 VO) | Menu theme + Corwin VO | **[KEEP]** + transcode to MP3 |
| `assets/fonts/*.ttf` | 2.4 MB (Cinzel ×5, Alegreya ×5, IM Fell ×2 + OFL) | Vector display/body fonts | **[CONVERT]** → pixel bitmap fonts; keep the OFL notices, retire the TTFs from the export filter |
| `assets/images/*` | 4.6 MB (`yard_dawn_panorama.jpg`, `parchment.*`, `logo_*`, `sword_coast_map.jpg`) | Menu matte, paper grain, logo | **[CONVERT]** — logo/paper become pixel assets; the matte is retired |
| `assets/characters/**` | **41 MB** (Quaternius bodies + 7.3 MB UAL glb + PBR/roughness/normal maps) | 3D hero + NPC + animations | **[RETIRE]** → archive (§10.2) |
| `assets/textures/**` | **32 MB** (cobble/dirt albedo-normal-roughness) | 3D ground materials | **[RETIRE]** → archive |
| `assets/models/*.glb` + `manifest.json` | 748 KB, 15 props (barrel, gatehouse, gate doors, ground, guard box, lantern post, notice board, portcullis, wall pieces) with vertex/triangle/bounds metadata | 3D yard kit | **[RETIRE]** as 3D, but **its prop list is the authoritative shopping list for the 2D prop kit** (§5.6) |
| `addons/sky_3d/**` | 12 MB | Sky/time-of-day, wired into the yard HUD | **[RETIRE]** — replaced by a palette ramp + parallax card |
| `addons/terrain_3d` (referenced in docs; not committed) | — | Adopted, never wired; **experimental on web** | **[RETIRE]** — removes the single largest portable-build risk in the current plan |
| `tests/smoke_test.gd` + `.tscn` | 298 lines, 67 `check()` calls (docs claim 80 — drift, T-44) | Headless regression scene: screens, options, save/reload, ledger cap, loading, 3D controller | **[CONVERT]** → pixel test scene, plus new grid/combat coverage |
| `tests/shot_walk.gd`, `yard_shot.gd`, `qa_yard.gd` | 66 / 71 / ~40 | Screenshot walk of every screen | **[CONVERT]** → pixel screenshot walk (combat UI included) |
| `tools/export_web.py`, `serve_web.py`, `package_project.py` | 28 / 30 / 27 | Local export, static server, ZIP packaging | **[KEEP]**; export moves to CI, `package_project.py` learns to exclude retired assets |
| `tools/scene/build_test_yard.py` | 534 | Generates the 3D blockout | **[CONVERT]** → `tools/scene/build_tile_yard.py` (emits a `.tscn` + tile data from the GDD-03 plan) |

### 2.3 The 3D surface area is smaller than it looks

A node-type census across all GDScript (`scripts/**`):

| Node type | References | Where |
|---|---|---|
| `Control` | 72 | Shell / options / HUD **only** |
| `Button` / `Label` / `TextureRect` / `VBox` / `HBox` / `Panel` / `ScrollContainer` / `RichTextLabel` | 16 / 15 / 13 / 10 / 6 / 8 / 6 / 3 | Shell UI **only** |
| `Node3D` | 6 | `player.gd`, `test_yard.gd`, `npc_corwin.gd` |
| `CharacterBody3D` / `SpringArm3D` / `Camera3D` / `CollisionShape3D` | 2 / 3 / 2 / 1 | The player controller |
| `MeshInstance3D` / `ArrayMesh` | 2 / 2 | Ground collision rebuild in the yard |
| `AudioStreamPlayer3D` | 1 | Corwin's VO |

**Conclusion:** the *entire* 3D surface to rewrite is three scripts and three scenes (~650 lines), all of it
already written in a way that separates concerns (`Visuals` node holds the model, collision is separate,
settings drive camera behaviour). The 2D rebuild is therefore a **rewrite of the world layer and a re-skin of
the shell**, not a port of a 3D game.

### 2.4 Repository hygiene debt discovered during this audit

| # | Finding | Risk | Fix |
|---|---|---|---|
| H1 | **The Godot project lives at `.godot/`** — the same name Godot uses for its own import cache. Godot's cache therefore nests at `.godot/.godot/`, and every doc (GDD-05, `GETTING_STARTED.md`) tells contributors the folder is `godot/`. | Contributor confusion; tooling that ignores `**/.godot/**` will silently skip the whole project; CI path assumptions break | Rename to **`godot/`** (T-01). `res://` paths are unaffected; only docs/CI/config references change |
| H2 | `.gitignore` says `godot/.godot/` and `godot/exports/` — neither path matches the current layout (the real ignores come from a nested `.godot/.gitignore`) | A future export to `.godot/exports/` is ignored only by luck of that nested file | Consolidate into one root `.gitignore` after the rename |
| H3 | **`DELVE_Godot_4.7.2.zip` (69 MB) is tracked in Git** — the project's own rules say binary artifacts belong in Releases | Clone time, GH limits, `git gc` pain | Move to a GitHub Release asset; keep `package_project.py`; add `*.zip` to `.gitignore` |
| H4 | **73 MB of 3D-only assets are tracked and would ship in the PCK** (41 MB characters + 32 MB textures) | Direct hit on the browser download budget — the whole point of the pivot | Archive to a Release + a `3d-legacy` tag; delete from the working tree (§10.2) |
| H5 | `Sky3D` (12 MB) is committed; `Terrain3D` is adopted in docs although **its web export is experimental upstream** | Terrain3D would have blocked the browser build had it been wired | Retire both; document the reversal |
| H6 | Codex entries carry provenance labels like *"Core mechanic · PHB 2024, ch. 1"* — **PHB** text is not CC-licensed, unlike SRD 5.2.1 | The one legal exposure that survives the "keep fan names" decision | Re-source every codex entry from SRD 5.2.1 and ship the CC-BY attribution block (§15, T-47) |
| H7 | `smoke_test.gd` has 67 `check()` calls; docs advertise "80 checks" | Docs drift → false confidence | Reconcile in T-44; make the count printed by the test itself the single source of truth |
| H8 | The root web shell and the Godot game would both want to publish at `/` | Two products fighting over one origin, and over one `localStorage` namespace | Define the topology in §9.3: root = landing page, game at a versioned path |

### 2.5 Docs vs implementation gap (what the papers promise that the build does not have)

| GDD | Promises | Built today | Reality for the pixel build |
|---|---|---|---|
| 01 | Chapter 1, 6-party statblocks, tactical combat, dialogue trees | nothing | **Out of scope** (D2). Combat *systems* land in M5–M6; *content* does not. |
| 02 | 5 menu items, first-run contract page, options (50 rows), codex (3 tabs), credits, loading screen, exact strings | ≈95 % of it | **In scope** — this is the shell we port |
| 03 | 13 areas (A–M), 10 tutorial beats (T1–T10), 44 m × 44 m yard, full model/texture/audio/VO lists | one 3D sandbox with a gate, some props and one NPC | **Partially in scope**: the *map* is built from GDD-03's plan, and beats T1/T3/T4/T8 are implemented (§3.1) |
| 04 | Blender→glTF 3D pipeline, headless generation, milestone plan | 15 blockout props | **Superseded** by §5 of this document |
| 00 | UE5 + 3D "lit miniature", technology table, five pillars | — | Pillars **retained** (readability, palette scripting, diegetic dice, silhouette-first); engine/3D specifics superseded |

---

## 3. TARGET PRODUCT DEFINITION

### 3.1 The slice — exactly what ships, and what is deferred

**In scope (this build):**

| Item | Source | Notes |
|---|---|---|
| Full shell | GDD-02 §1–§4 | Legal screen, logo sting, menu, PLAY/first-run contract, ledger, options, codex, credits, loading screen — all real, all in-engine |
| Yard exploration | GDD-03 areas A, F, G, J, M (+ dressing from B/C/D/I) | Top-down walk of the yard built from GDD-03 §3's coordinate plan |
| Tutorial beats | T1 (movement), T3 (basic attack), T4 (bonus action & masteries), T8 (full turn-based loop) | The four beats that make the yard a *game*; beacon system supports the rest later |
| NPCs | Corwin (guard), 2 gate guards (dressed, non-talking), Gundren (voice-over only), 3 training dummies, 1 sparring partner | All pixel rigs; dialogue data from `npc_corwin.gd` |
| Combat | Initiative, movement, attack/damage, cover, LoS, reactions (opportunity attacks), weapon masteries (2), conditions (Prone), enemy AI | Table Mode, turn-based, grid on |
| HUD/UI | Exploration HUD, tactical HUD, dice Roll Moment, pause menu, tutorial toasts | Pixel nine-patch kit |
| Persistence | Contract ledger (8 slots), options, tutorial progress, codex unlocks | Save v2 schema |

**Deliberately out of scope (deferred, named so they are not missed):**

- Character-creation stations C1–C6 (species/class/background/appearance/name tables) — the contract page
  remains the only "creation" surface, as today.
- Tutorial beats T2 (first-person toggle — no first-person in 2D; replaced by a "zoom in" camera cue), T5
  (in-world signing — remains at the menu contract page), T6 (archery lane: ranged combat arrives in a
  fast-follow, its AoE/cover foundations *do* ship), T7 (hide/surprise/advantage — deferred), T9 (rest &
  hit dice — deferred), T10 (pack/folio/codex lectern UI — codex ships in the shell).
- Areas H (archery), K (rest nook), L (lectern) as *interactive* stations; they ship as dressed geometry.
- R1 dock lane beyond the gate and the R2 city vista ship only as a painted backdrop card.
- Skirmish (real-time) mode, Chapter 1, companions, saves in the yard position, cloud saves, mobile
  touch as a *first-class* target (it must not *break*, §4.9).

### 3.2 Player journey (frame-by-frame)

```
[COLD LOAD]  index.html → engine boot → canvas focus → audio unlock on first gesture
   ↓
LEGAL        attribution + fan disclaimer (any key/click continues, unlocks audio)
   ↓
STING        4.0 s logo sting, skippable after 1.5 s
   ↓
MENU         yard-at-dawn pixel backdrop (3 parallax layers + drifting motes)
   ├ PLAY ──(no save)──► CONTRACT page (difficulty / pacing / subtitles / camera comfort)
   │                      └ SIGN & DESCEND ► LOADING (ink route, min dwell) ► YARD
   ├ PLAY ──(save exists)─► "Begin a new contract?" card ► same path
   ├ CONTINUE ► ledger (up to 8 contracts, confirm-delete) ► LOADING ► YARD
   ├ OPTIONS / CODEX / CREDITS ► pixel re-skins of the existing screens
   └ ESC does nothing (per GDD-02)
   ↓
YARD (EXPLORE MODE)   8-way walk, beacons guide T1; interactables bark hints;
                      pause overlay (Esc) with RESUME / OPTIONS / RETURN TO MENU
   ↓ step onto a marked encounter tile (dummy line or sparring circle) and press F
ENCOUNTER TRANSITION  0.6 s: participants snap to cells, grid fades in, initiative rolls
   ↓
COMBAT (TABLE MODE)   turn queue at top; budget pips; click-to-move within 6-cell budget;
                      attack/bonus-action bar; enemy AI turns with telegraphs; Roll Moment on every d20
   ↓ win / yield (sparring rule: nobody dies in the yard — yield at 1 HP)
RESULT                loot-free summary card ("Training complete") ► back to EXPLORE
   ↓ ring the practice bell (M) ► resets dummies, re-arms encounters, replays any completed beat
```

### 3.3 Content manifest (what must be produced, counted)

| Category | Count | Detail |
|---|---|---|
| Tileset sources | 5 | packed dirt, forecourt cobble, yard verge/grass, plank (dock), wall stone |
| Autotile variants | 5 × up to 47 | generated programmatically from corner/edge kits (§5.4) |
| Props | 22 | from the existing `M_YRD_*` kit: barrel ×2, gatehouse, gate doors ×2, portcullis, guard box, lantern post ×2, notice board, wall pieces ×4, crate, table, canopy, dummy ×3, target butt, pedestal ×3, lectern, bell, rack, fence, torch sconce |
| Character rigs | 6 | player, Corwin, gate guard, sparring partner, dummy (static), Gundren (portrait/VO only) |
| Character animations | 9 states × 6 rigs where applicable | idle, walk ×4 dirs, attack, hurt, down, interact |
| UI nine-patches | 3 | parchment panel, oak/bronze panel, dark ink panel + button states ×3 + tab ×2 + seal + emblem |
| FX sprites | 8 | hit spark, crit flash, dust puff, beacon wisp, mist layer, rain, torch flicker, dice tumble (6 frames + result states) |
| Backdrops | 2 | menu yard-dawn (3 parallax layers), R2 city vista card |
| Audio files | 4 keep + ≈14 new | see §8 |
| Data files | 2 keep + 3 new | `shell_content.json`, `options_schema.json` kept; new `yard_map.json`, `encounters.json`, `bestiary.json` |

---

## 4. TECHNICAL ARCHITECTURE

### 4.1 Engine pinning

- **Godot 4.7.2 Standard (GDScript)** — identical to the shipped project; no .NET, no Forward+. The CI
  container is pinned to the matching export-template tag (observed available: `4.7.2-stable` on the
  `abarichello/godot-ci` image — **[VERIFY]** the exact tag at T-40).
- Renderer stays **`gl_compatibility`** (WebGL2): mandatory for browser targets, already configured.
- No GDExtension plugins at runtime (kills the Terrain3D web-export risk permanently).

### 4.2 `project.godot` — the exact pixel block (T-02)

Replace/add in the current file:

```ini
[application]
config/version="0.4.0-pixel"

[display]
window/size/viewport_width=480
window/size/viewport_height=270
window/size/window_width_override=1920
window/size/window_height_override=1080
window/stretch/mode="viewport"
window/stretch/aspect="keep"
window/stretch/scale_mode="integer"

[gui]
theme/default_font_antialiasing=0
theme/default_font_subpixel_positioning=0
theme/default_font_hinting=0

[input]
; see §4.9 — game_view/game_jump removed; grid_* and interact added (T-11;
; until then actions are registered at runtime by game_state.gd)

[rendering]
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
textures/canvas_textures/default_texture_filter=0
2d/snap/snap_2d_transforms_to_pixel=true
2d/snap/snap_2d_vertices_to_pixel=true
; ink-1 clear colour
environment/defaults/default_clear_color=Color(0.039, 0.051, 0.063, 1)

[editor_plugins]
; Sky3D removed
enabled=PackedStringArray()
```

Rationale, point by point: `viewport` stretch renders the *whole frame* (including text) at 480×270 and
integer-upscales it — the honest pixel look; `scale_mode=integer` prevents fractional pixel sizes; nearest
filtering globally; the two `snap_2d` flags kill sub-pixel shimmer (camera smoothing must also stay off, or
use pixel-snapped smoothing); the `[gui]` block makes bitmap fonts rasterise without antialiasing/hinting
mush. **[VERIFIED — T-02, 2026-09-23]** every key above exists under that exact name in Godot 4.7.2
(checked against the 4.7 `ProjectSettings` class reference and `TextServer` enums): **no renames were
needed**, and each `=0` value maps onto the intended enum member — `FONT_ANTIALIASING_NONE`, `HINTING_NONE`,
`SUBPIXEL_POSITIONING_DISABLED`, texture filter Nearest. Annotations are carried as full-line `;` comments
in the shipped file (ConfigFile documents full-line comment lines); the executable import pass is the CI
gate per §11.1. Full record in Appendix A.

### 4.3 Directory layout (new tree under `godot/`)

```
godot/
├ project.godot, export_presets.cfg, icon.png
├ data/            options_schema.json · shell_content.json
│                  yard_map.json [NEW] · encounters.json [NEW] · bestiary.json [NEW]
├ scenes/
│  ├ ui/shell.tscn                     [CONVERT]
│  ├ world/yard.tscn                   [NEW] (TileMapLayers + actors + camera + HUD)
│  ├ world/encounter.tscn              [NEW] (combat controller, grid overlay, queue UI)
│  └ actors/{player,npc_corwin,guard,dummy,sparring_partner}.tscn  [NEW/CONVERT]
├ scripts/
│  ├ core/{game_state,sound,dice,rng_streams}.gd      [KEEP/KEEP/NEW/NEW]
│  ├ ui/{shell,ui_pixel,options_page,backdrop_pixel,load_route}.gd
│  ├ world/{yard,player_2d,npc_2d,interactable,beacon,day_clock,weather}.gd
│  └ combat/{turn_engine,combatant,rules_grid,pathing,los,aoe,conditions,masteries,enemy_ai,ui_tactical}.gd
├ assets/
│  ├ pixel/                            [NEW — all generated art lands here]
│  │  ├ tiles/ props/ chars/ ui/ fx/ backdrops/ dice/
│  │  └ palette/{palette_surface.png, palette_below.png, palette_lut.json}
│  ├ fonts/{pixel_body_8.fnt+png, pixel_ui_5.fnt+png, *OFL/CC0 notices}
│  └ audio/{*.mp3 (web) + *.ogg (desktop keep)}
├ addons/                              [RETIRE sky_3d]
├ tests/ tools/ docs/ licenses/        [as today, extended per §11]
```

Everything under `assets/pixel/` is **machine-verifiable** (§5.7): an atlas manifest JSON lists every
expected PNG with size, palette-group and source prompt id; a CI lint fails on drift.

### 4.4 Autoloads

| Autoload | Script | Why |
|---|---|---|
| `GameState` | `core/game_state.gd` | unchanged role; gains save v2 + localStorage migration hook |
| `Sound` | `core/sound.gd` | unchanged; source set switches by platform |
| `Dice` **[NEW]** | `core/dice.gd` | seeded d20 engine (§6.4); single authority for every roll in the game |
| `Streams` **[NEW]** | `core/rng_streams.gd` | named, independently-seeded RNG streams (`world`, `combat`, `ai`, `fx`) so combat determinism is never polluted by particle effects |

### 4.5 Scene graph — the three runtime scenes

```
yard.tscn
└ Yard (Node2D, script yard.gd)
   ├ GroundLayer   (TileMapLayer — painted surfaces, z 0)
   ├ ObjectLayer   (TileMapLayer — walls/fences, occlusion + collision, z 1)
   ├ Props         (Node2D, y-sorted)   22 prop scenes
   ├ Actors        (Node2D, y-sorted)   player + NPCs + dummies (CharacterBody2D rigs)
   ├ FX            (CanvasLayer)        mist, weather, torch flicker, beacon wisps
   ├ Camera2D                          pixel-snapped, clamped to 464×464 world bounds, zoom 1×
   ├ GridOverlay   (CanvasLayer, hidden until encounter)  cell highlight + LoS mask + AoE preview
   ├ HUD           (CanvasLayer)        exploration HUD / pause overlay
   └ EncounterController (script combat scene owner)

encounter.tscn (instantiated into yard on trigger)
└ Encounter (Node)
   ├ TurnEngine     (node, script turn_engine.gd — state machine, queue, budgets)
   ├ RulesGrid      (ref into yard's tile data: cost / solid / cover / elevation / los layers)
   ├ Pathing        (AStarGrid2D wrapper)
   ├ Combatants[]   (wrappers referencing actor rigs)
   ├ EnemyAI
   └ TacticalUI (CanvasLayer: queue strip, action bar, budget pips, tooltips)
```

The player scene becomes:

```
player.tscn → CharacterBody2D
 ├ SpriteRig (Node2D; children are Sprite2D/polygon parts, animation via AnimationPlayer)
 ├ Hitbox / InteractArea (Area2D, radius 1.2 tiles)
 └ AudioStreamPlayer2D (grunts/footsteps)
```

### 4.6 The Grid — one data source, three consumers

The yard's `TileMapLayer` custom-data layers are the single source of truth; nothing else stores geometry:

| Layer key | Type | Meaning | Consumers |
|---|---|---|---|
| `solid` | bool | blocks movement | pathing, physics, LoS |
| `cost` | float | movement cost multiplier (1 normal, 2 difficult terrain) | pathing |
| `cover` | int 0/2/5 | none / half / three-quarters cover granted to a creature behind this cell (against an attack through it) | combat maths |
| `elev` | int | elevation step in 5-ft units | combat maths, sprite y-offset |
| `los_block` | bool | blocks line of sight (walls, solid props) | LoS raycast |
| `encounter` | string | encounter id triggered when stepped on (`dummy_line`, `sparring`) | yard script |
| `interact` | string | interactable id | interactables |

Combat never mutates these layers; transient state (who occupies which cell, active AoEs) lives in the
`TurnEngine` as dictionaries keyed by `Vector2i` cell coords — cheap, serialisable, testable.

### 4.7 Rendering & camera rules (non-negotiable)

1. All zoom values are **integers** (world 1×; dialogue/cut-in 2×). Half-zooms are forbidden — they create
   half-sized pixels.
2. `Camera2D.position_smoothing_enabled = false`; movement "feel" comes from tile-snapped positions and
   2-frame walk cycles, not from float interpolation.
3. Y-sort is on for `Props` and `Actors`; sprite origins at the feet.
4. Characters are drawn in a 16 × 32 frame (16 × 24 body) on 16-px cells; tall props may overdraw up to 48 px.
5. World-space text (damage numbers, "HIT!") uses the 5×7 pixel font at integer scale and is culled at bounds.
6. One `CanvasItemMaterial` + LUT shader per *zone* (not per sprite) applies the surface→below palette remap
   when a scene demands it — never per-frame material swaps.

### 4.8 Fonts & text (T-21)

| Use | Font | Size | Source/licence |
|---|---|---|---|
| UI chrome, HUD labels, buttons | `m5x7`-class 5×7 pixel font | 5 px | CC0 (verify licence file ships) |
| Body text: codex, options help, contract, dialogue | `Pixel Operator`-class 8 px pixel font | 8 px | CC0 (verify) |
| "Reading magnification" (accessibility) | same, at 2× via `ui_scale = 2` (§6.12) | 10/16 px | — |

Imported as BMFont (`.fnt` + PNG atlas), which Godot 4 loads as a bitmap `FontFile`; no runtime TTF
rasterisation in-game. The Cinzel/Alegreya/IM Fell TTFs remain in the repo for the *landing page* and are
excluded from the export filter. Codex text at 8 px / 480 px wide = ~58 chars per line — validated against the
longest existing SRD entry (T-21 acceptance test).

### 4.9 Input model

| Binding (default) | Action | Notes |
|---|---|---|
| WASD / arrows / d-pad | move (explore) | 8-way, normalised |
| F / A button | interact · confirm target | context label in HUD |
| Space | end turn (combat) · confirm | reused per existing schema |
| Esc | pause / back | never captured; no pointer lock anywhere in this build |
| G | toggle grid overlay (explore) | "on-hover/always" per options |
| 1/2/3 | select party slot (future) | reserved |
| Tab | folio/codex quick-open | per existing schema |

- Mouse in combat: hover cell = highlight; click = move/attack target; right-click = cancel selection.
- **Touch:** not designed for, but must not break: taps map to clicks, a minimal screen-edge d-pad appears on
  coarse pointers (CSS `pointer: coarse` in the HTML shell sets a flag the engine reads). T-46.
- Removed vs today: `game_view` (no first person), `game_jump` (no jumping; ladders/ledges are later),
  mouse-capture actions.

### 4.10 Persistence & migration

- File: `user://delve_v2.json` (atomic tmp+rename, debounced — same mechanics as v1).
- Schema v2 = v1 fields **plus** `tutorial: {completed_beats: ["T1","T3","T4","T8"], seen_toasts: []}`,
  `codex_unlocks: []`, `combat_stats: {}`, `schema: 2`.
- Web bridge (T-38): on boot, when `OS.has_feature("web")`, read `localStorage["delve.contract.v1"]` and
  `["delve.options.v1"]` via `JavaScriptBridge.eval()`, convert, write once to v2, then flag
  `delve.migrated.v2 = true`. One-way, idempotent, logged.
- Also on web: call `navigator.storage.persist()` on first successful save (eviction hardening, T-38).
- Version path stability (§9.3) means the origin never changes under a signed save; a deploy at a *new* path
  ships with a redirect from the old path so saves follow.

### 4.11 Performance budget (measured in CI, §11)

| Metric | Budget | How |
|---|---|---|
| Draw calls (yard, worst combat) | ≤ 32 | atlas everything; `Performance.get_monitor(MONITOR_RENDER_TOTAL_DRAW_CALLS_IN_FRAME)` asserted in a test |
| Triangles/objects | trivial (2D) | — |
| PCK size | ≤ 2.5 MB | export-filter excludes; CI asserts file size |
| Total transfer | ≤ 15 MB | CI asserts `index.wasm + index.pck + shell` after host compression |
| Frame time | ≤ 8 ms p95 on CI runner headless-render proxy; 60 fps target desktop | screenshot-walk timing harness |
| First playable | ≤ 8 s on 10 Mbps simulated | Playwright network-throttle test |

---

## 5. ART PIPELINE — AI-GENERATED PIXEL ART, DETERMINISTICALLY CURATED

### 5.1 Honest constraints (why the pipeline looks the way it does)

Image models are excellent at *painting* and bad at the four things pixel art actually requires:

1. **Exact low resolution** — generations come out 1024² with soft edges and gradients;
2. **Locked palettes** — every generation invents its own colours;
3. **Tileability** — generated "tilesets" almost never wrap seamlessly;
4. **Cross-asset consistency** — two prompts produce two different games.

Therefore the model is used as a *painter of sources*, and everything pixel-specific is done by a
deterministic Python toolchain (Pillow + NumPy in a project venv — verified working in this environment):

```
GENERATE ──► DOWNSCALE ──► QUANTISE ──► CLEAN ──► PACK
 (image       (box/Lanczos    (nearest       (despeckle,    (atlas,
  model)       to 16/32 px)    in OKLab to     1-px outline,  .import,
                               palette)        silhouette     manifest)
                                               QA)
```

Every stage after GENERATE is a pure function of (source image, palette, parameters), which means: re-runs
are reproducible, CI can lint the output, and a human can approve a *locked* atlas that never drifts.

### 5.2 Stage detail

**GENERATE.** One generation per *asset family* (never per tile): e.g. "stone wall running, dawn light,
flat limited palette, hard edges, no gradient" at 1024×1024; "training dummy, front 3/4 view" isolated on a
flat background. Keep every raw generation as `raw_<id>.png` beside a `prompts.json` entry (id, family,
prompt, seed, date, approval status) — provenance for the credits and for regeneration.

**DOWNSCALE.** Box-filter to the target grid (16×16 tiles from 256×256 crops; 16×24 characters from
256×384). Box filtering collapses soft gradients into hard steps *before* quantisation, which is what makes
the result read as pixel art instead of a blurry photo.

**QUANTISE.** Map every pixel to the nearest palette entry in OKLab (perceptual) space, **no dithering** for
sprites/props/tiles (dithering at 16 px reads as noise), ordered 4×4 Bayer dither allowed *only* for sky and
mist gradients. Output: indexed PNG.

**CLEAN.** Automated passes, each with a threshold in `art_pipeline.json`:
- despeckle (remove isolated pixels and 1-px holes),
- contrast boost within ramp (push mid-greys to their ramp ends so shapes stay readable at 1×),
- **silhouette test** (GDD-00 pillar 1): downsample to 8 px, threshold alpha, assert the outline is a single
  connected blob for characters/props; failures go to a `needs_redraw/` folder, not into the atlas,
- 1-px dark outline pass on characters only (readability on busy floors).

**PACK.** Compose family atlases (one PNG per family + one `atlas_manifest.json`), generate Godot `.import`
sidecars (or let the CI import pass write them, T-40), slice autotiles (§5.4), and write `assets/pixel/`.
The packer is the only writer into `assets/pixel/`; hand-edited files there fail the CI lint.

### 5.3 The locked palette

**Surface ramp — 32 colours** (existing shell colours are embedded and marked ★):

| Group | 0 (dark) | 1 | 2 | 3 | 4 (light) |
|---|---|---|---|---|---|
| Ink/shadow | `#0A0C10` | `#101418`★ | `#1A2126`★ | `#263038` | — |
| Stone | `#2C3238` | `#474F55` | `#6C757B` | `#9AA3A8` | — |
| Parchment | `#B9A67F` | `#D6C6A3` | `#E9DFC8`★ | `#F6EFDD`★ | — |
| Bronze/gold | `#5E3D19`★ | `#8A5A26` | `#B0793A`★ | `#D9A463`★ | `#F0CD8E` |
| Oak/wood | `#3F2410` | `#5A3418` | `#7A4B2A` | `#A06A3C` | — |
| Blood/rust | `#5C1C17` | `#8E2F26`★ | `#B4553F` | — | — |
| Moss/verge | `#3C4823` | `#5B6B34` | `#7F8F4A` | — | — |
| Skin | `#8A5636` | `#C08356` | `#E8B58C` | — | — |
| Dawn sky | `#E0A06A` | `#F2C98A` | — | — | — |

**Below ramp — 8 colours** (the infection): teal `#16343A → #1C4F52 → #2F8F7A`, mint accent `#74E0B4`★
(existing OBELISK/MINT), violet `#2E2140 → #4B2E6B → #8A4FD0`, bone `#C9C2A8`.

**The LUT.** `palette_lut.json` maps each surface index → below index ramp-for-ramp (stone↔teal, ink↔violet,
parchment↔bone, bronze↔mint). The remap shader samples a 32×1 `NEAREST` texture: `below.rgb =
texture(lut, vec2((surface_index+0.5)/32.0, 0.5))`. One uniform (`infection`, 0–1) blends per-zone. This
delivers GDD-00's "the art direction itself is the horror story" for zero extra textures, and is unit-tested
by asserting pixel-exact output on a reference tile (§11).

Palette deliverables: `palette_surface.png` (32×1), `palette_below.png` (8×1), `palette_lut.json`, plus the
CI lint (§5.7) that rejects any committed PNG containing a colour outside the 40.

### 5.4 Tilesets & autotiling (the cheap trick that makes 5 tilesets feel like 50)

For each ground family we author **five source tiles** — centre, N/S/E/W edges, four corners — then generate
the full **47-tile blob set** programmatically by compositing edge/corner strips over the centre (standard
Wang-blob construction; fully deterministic). Godot 4's TileSet **terrain sets in "match corners and sides"
mode** consume exactly this 47-bitmask layout, so autotiling in-editor becomes paint-and-done.

Walls/fences use the same idea in 16×32 (wall face + cap). Water/mist edges animate with 2-frame swaps.
Every autotile variant is written into the atlas by the packer, so art cost stays at 5 tiles per family
regardless of map complexity. The yard's 29×29 ground is painted from GDD-03 §3's plan (cobble forecourt,
packed dirt lanes, verge borders, plank dock sliver at the gate).

### 5.5 Characters — cutout rigs, not sprite sheets

Sprite-sheet generation cannot keep limbs consistent across frames. Instead each character is a **cutout
rig**: 6–9 flat pixel parts (head, torso, arm L/R, leg L/R, weapon, cloak) generated once per family, then
animated by transform tracks in an `AnimationPlayer` (rotation/offset per part). Frames are therefore
consistent *by construction*.

- Nine authored states: `idle` (2-f), `walk_{N,S,E,W}` (4-f each; N/S mirrored from one drawing, E/W from one),
  `attack` (3-f + FX), `hurt` (1-f flash), `down` (1-f), `interact` (2-f).
- Two export modes, chosen per rig: **live rig** (fewer files, tiny runtime cost — fine for ≤ 8 on-screen
  actors) or **baked atlas** (a headless bake script renders the rig to a spritesheet for the FX-heavy dummy
  resets). Default: live rig.
- The existing Quaternius bodies/UAL animations **[RETIRE]**; their *motion intent* (speed thresholds in
  `player.gd`) is preserved as 2D timings: walk 4.5 → 3 tiles/s, sprint 7.5 → 5 tiles/s at 16 px/tile.

### 5.6 Props, UI, FX, dice

- **Props:** the 15-name `M_YRD_*` kit + §3.3 additions, each generated isolated → cleaned → foot-anchored at
  16-px grid multiples (a barrel is 16×16, the gatehouse is 64×48). Occlusion flags from the same JSON that
  feeds TileMap `los_block`.
- **UI nine-patches:** three panel styles generated as 48×48 sources with margins declared in
  `ui_kit.json` (parchment: 8 px corners; oak/bronze: 6; ink: 4) + buttons (normal/hover/pressed/disabled),
  tabs, wax seal, delve emblem (pixel redraw of the existing SVG lockup), scrollbar thumb/track.
- **FX:** hit spark (3-f), crit flash (2-f), dust puff, beacon wisp (4-f loop), mist band (2-f), rain (2-f
  tile), torch flicker (3-f). All palette-locked; FX may use the below ramp freely.
- **Dice:** the d20 is a generated 6-frame tumble + 4 result states (fail/success/crit/fumble) in bronze and
  mint variants. It is the same visual object in the world (contract table) and in the UI — GDD-00 pillar 5,
  kept literally.

### 5.7 Naming, manifest, and the palette lint (CI-enforced)

```
assets/pixel/tiles/T_YRD_COBBLE.png        — one PNG per family atlas
assets/pixel/chars/C_PLAYER.png + .rig.json
atlas_manifest.json: [{path, family, grid, palette_group, source_prompt_id, sha256}…]
```

CI lint (`tools/pixelart/lint_artifacts.py`, no Godot required):
1. every PNG under `assets/pixel/` ∈ manifest (and vice versa);
2. every PNG's unique colours ⊆ palette (exact RGB match on indexed PNGs);
3. tile atlases are multiples of 16; character frames are multiples of 16×32;
4. no PNG larger than 256 KB; total `assets/pixel/` ≤ 1.5 MB;
5. `.rig.json` parts reference existing atlas regions.

### 5.8 Art production order

1. Palette + UI kit (unblocks shell work, M2).
2. Ground families + wall kit (unblocks the yard greybox in tiles, M4).
3. Player rig + Corwin rig (unblocks movement and dialogue, M4).
4. Props pass 1: gate, walls, dummies, bell, lanterns (dressing, M4).
5. Combat FX + dice (M5).
6. Backdrops: menu dawn parallax + R2 vista card (polish, M7).
7. Props pass 2 + weather/mist (polish, M7–M8).

Each item exits only when its lint passes and a screenshot lands in the M-gate evidence folder.

---

## 6. GAME SYSTEMS

### 6.1 Yard exploration (`yard.gd`, `player_2d.gd`)

- Movement: 8-way `CharacterBody2D`, walk 3 tiles/s, sprint 5 tiles/s (Shift), accel/decel 12 tiles/s²;
  positions snap to whole pixels, not tiles (tile snapping is combat-only).
- Collision from `ObjectLayer` physics polygons + per-prop `StaticBody2D` (authored with the tile builder).
- Facing: 4-way sprite swap on dominant axis; `interact` raycast 1.2 tiles forward picks the nearest
  `interact`-tagged cell → HUD context chip ("F — Ring the bell").
- Beacons (`beacon.gd`): wisp FX + floating chevron at the next tutorial station; shown only when the
  previous beat is complete/skipped; each carries its toast copy.
- Day clock (`day_clock.gd`): game-time 06:40→08:20 across ~18 min real time (matches GDD-03 §1); drives a
  5-stop dawn colour ramp applied to a fullscreen `CanvasModulate` + the backdrop card. Weather: clear with
  light mist until 07:30, then clear — two overlay states, no gameplay effect (per the zone's sandbox rules).
- Pause: Esc → `get_tree().paused` overlay (RESUME / OPTIONS / RETURN TO MENU). **No pointer lock anywhere** —
  the most fragile browser behaviour in the current build is deleted outright.

### 6.2 Encounter → combat transition

1. Player steps on an `encounter` cell and presses F (or an NPC triggers it on proximity for the sparring
   circle when T8 is armed).
2. `EncounterController.load(id)` reads `encounters.json` → participant list, start cells, rules overrides.
3. 0.6 s transition: exploration input frozen; each participant tweens (pixel-snapped, 4 steps) to its start
   cell; `GridOverlay` fades in; initiative rolls; queue builds; Tactical UI slides in; music crossfades.
4. Yard rules overrides apply automatically (from GDD-03 §1): **no death** — any combatant reduced to 0 HP
   yields at 1 HP ("The spar ends…"); dummies reset 6 s after their last hit; no alert states.

### 6.3 Turn engine (`turn_engine.gd`)

State machine: `AWAITING_START → ROLLING_INITIATIVE → TURN(active) → RESOLVING → TURN(next)… → ENDED`.

- **Initiative:** `1d20 + DEX mod`, ties broken by DEX then player-side priority; queue rendered as a
  horizontal pixel strip (portraits + HP pips); current actor highlighted.
- **Turn economy** (per GDD-01 §4.3): Movement budget = `speed / 5` cells (30 ft → 6); one Action; one
  Bonus Action; one Reaction (refreshes at start of the actor's next turn); one free object interaction.
- Budgets render as pips; unspent movement converts to nothing (no banking). End Turn: Space/button, with the
  `autoend` option honoured.
- **Enemy turn pace** option (Cinematic/Brisk/Instant) scales AI animation and dwell times — data-driven,
  tested at all three settings.
- Everything the engine does is expressed as **events** (`turn_started`, `moved`, `attack_resolved`, …) on an
  event bus; the UI and the golden test (§11.2) are two subscribers of the same stream.

### 6.4 Dice & the Roll Moment (`dice.gd`)

- `Dice.roll("1d20+5", advantage=false, stream="combat") -> Roll {parts, total, natural, crit, fumble}`.
- All rolls draw from `Streams.combat`, seeded per-encounter from the save's `rng_seed`; **no roll in combat
  ever touches the world/fx streams**, which is what makes the golden test deterministic.
- Crit rules (nat 20 hit / nat 1 miss) per SRD; advantage/disadvantage = roll twice, keep best/worst.
- **Roll Moment (GDD-01 §2.2.1):** every player-facing d20 plays the 6-frame dice tumble, holds 0.4 s on the
  result, stamps `HIT/MISS/CRIT!` in the 5×7 font, then resolves. Skippable under the Brisk/Instant pace;
  never longer than 1.5 s total.

### 6.5 Combat maths (SRD 5.2.1, shown not told)

| Rule | Implementation | On-screen truth |
|---|---|---|
| Attack roll | `1d20 + STR/DEX mod + proficiency` vs target AC | to-hit preview on hover: `1d20+5 vs AC 13` |
| Advantage/Disadvantage | second die, keep best/worst | two-die Roll Moment variant |
| Cover | ray from attacker through target cell reads `cover` layer of intervening cells: half +2 AC, ¾ +5 AC | cover arc glyphs on target cell |
| Line of sight | supercover Bresenham over `los_block`; melee adjacent always sees | dimmed cells = unseen |
| Elevation | `elev` delta ≥ 1 grants high-ground advantage flag on ranged attacks | ↑/↓ chevrons |
| Difficult terrain | `cost = 2` cells spend 2 budget | hatched cells |
| Opportunity attack | leaving an enemy's 8-neighbourhood without Disengage triggers a Reaction prompt (auto-resolves under `react: Auto-*` settings) | red arc flash on the vacated cell |
| AoE | templates computed in cell space: sphere (Euclidean radius), cube (Chebyshev), cone (45° fan), line; preview before commit | coloured template + affected count |
| Damage | weapon dice + mod; crit doubles dice | floating numbers, blood ramp flash |
| Conditions | `Prone` (attacks vs prone: advantage melee/disadvantage ranged; standing costs half movement) | icon on portrait + cell glyph |
| Non-lethal | yard override: yield at 1 HP | "YIELDED" card instead of death |

### 6.6 Weapon masteries shipped (two, per scope)

- **Push** (melee, on hit): target pushed 1 cell directly away if the destination cell is free and
  non-solid; else no push. Teaches positioning in the dummy line.
- **Topple** (melee, on hit, DC 8 + prof + STR/DEX save): applies `Prone`. Teaches conditions + saves in the
  sparring circle.
  Both are data rows in `bestiary.json → masteries`, rendered as chips on the attack button; the other 2024
  masteries arrive with Chapter 1.

### 6.7 Enemy AI (`enemy_ai.gd`)

Utility-scored, deterministic (uses `Streams.ai`): score = target priority (lowest HP, closest, player-first)
× threat (can I hit? cover?) − risk (am I exposed? prone?). Behaviour set for the slice: **advance** (path to
adjacency via `Pathing`, respecting difficult terrain), **attack** (best weapon by expected damage incl.
advantage flags), **brace** (take half cover when available and wounded), **yield check** (yard rule). Every
AI decision is logged as an event for the golden test. Telegraphs: a 0.4 s cell flash + intent icon above the
acting enemy before its move resolves (GDD-01 §2.4 "readable enemies").

### 6.8 The two encounters (content)

**Dummy line (Area G, id `dummy_line`, teaches T3/T4):** 3 static dummies, AC 11, HP 10, no turns. Scripted
coach barks (text, Gundren-voiced where VO exists): first attack, then bonus action, then a mastery. Dummies
reset after 6 s idle. Win = all three dropped once. Impossible to lose.

**Sparring circle (Area J, id `sparring`, teaches T8):** 1 sparring partner (AC 12, HP 14, longsword + shield,
uses Push) + Corwin refereeing from the edge. Full loop: surprise-free, initiative, ≥ 3 rounds expected,
opportunity attacks wired, Topple available to the player. Win = partner yielded; lose = you yield — both end
on the same friendly card ("Good spar."). This encounter is the **acceptance test of the whole combat system.**

### 6.9 Tutorial beacon system

`beacon.gd` + `tutorial.json` (beat id → station cell, toast lines, completion predicate, skippable flag).
Completion predicates: T1 "reach the far marker", T3 "land one hit", T4 "use a bonus action", T8 "finish a
spar". Completed beats persist in save v2; the practice bell (M) resets encounter state and re-arms any beat
for replay. Beacons never point south of the gate (GDD-03 §2 boundary rule).

### 6.10 Dialogue, VO, codex

- Dialogue = single-cue barks (no branching in this slice): portrait chip (pixel, 48×48) + name + 8 px body
  text, typewriter at 30 cps, skippable. Drives `vo_grd_001..003` and new Corwin lines via `AudioStreamPlayer2D`.
- Codex (shell) keeps its three tabs; **Rules tab text re-sourced to SRD 5.2.1** (T-47); Bestiary gains the
  two encounter statblocks after first meeting (gives the bestiary its first real entries — cheap win).

### 6.11 UI/HUD spec

- **Exploration HUD:** bottom-left context chip (interact label), bottom-right minimap-free (yard fits ~2
  screens; no minimap), top-left time-of-day glyph + weather word, top-right PAUSE button. Tutorial toasts
  centre-top, parchment nine-patch, 4 s or on-advance.
- **Tactical HUD:** top queue strip (24 px portraits + HP pips + turn arrow); bottom action bar (ATTACK /
  BONUS / END TURN + budget pips); right-side tooltip panel (to-hit preview, cover, conditions); grid overlay
  tints: move = mint, attack = blood, AoE = bronze, enemy threat = violet.
- All text ≥ 5 px, contrast ≥ 4.5:1 within the palette (lint-checked pairs, T-22).

### 6.12 Options & accessibility (reconciling the 50-row schema)

- **Live rows kept:** reduced motion (freezes motes/backdrop drift + skips dice tumble), high-contrast UI,
  subtitles + size, colourblind filter (3 LUT variants of the *overlay tints only* — the art palette never
  changes), frame cap, master/music/sfx/voice volumes, mute-on-focus-loss, grid overlay mode, hit-chance
  display, reaction prompts, enemy turn pace, difficulty, rebinds.
- **New rows:** `ui_scale` (1×/2×, §4.8), `touch_controls` (Auto/Off), `combat_text_size` (ties to reading
  magnification).
- **Stored-only rows (†):** 3D-camera rows (FOV, boom, snap turn, head bob) are **deleted from the schema**
  rather than carried as dead weight — one fewer class of player confusion; the schema version bumps to
  record the removal.

---

## 7. SHELL CONVERSION — SCREEN BY SCREEN

### 7.1 The layout conversion rule

The shell is absolutely positioned on a 1600×900 design grid (69 `Rect2` literals: 63 in `shell.gd`, 2 in
`options_page.gd`, 4 elsewhere). The pixel grid is 480×270 — exactly ÷ 10/3. Conversion rule:

1. **First pass (automated):** `tools/pixelart/convert_layout.py` parses every `Rect2(x, y, w, h)` from the
   UI scripts, emits a `layout_480.json` of ÷3.333-snapped-to-integer candidates and a diff preview. This is a
   *starting point*, not the answer — many 1600-space elements are smaller than one pixel at 480-space.
2. **Second pass (by hand, per screen):** re-author each screen on a 12×24 px margin grid using the nine-patch
   kit, keeping the GDD-02 §2.3 safe-area percentages (logo anchor 6 %, 8 %; column 6 %, 34 %; item height
   6.5 % ≈ 18 px; disclaimer bottom-left; version stamp bottom-right).
3. Acceptance: every screen renders unclipped at `ui_scale` 1 and 2, keyboard-only navigable, captured in the
   screenshot walk.

### 7.2 Screen table

| Screen | Source (today) | Pixel target | Work |
|---|---|---|---|
| Legal/attribution | `build_legal()` 138–173 | 8 px body text on ink, emblem top, "press any key" pulse; fan disclaimer + SRD CC-BY block (§15) | small |
| Logo sting | `build_sting()` 179–229 | pixel emblem + wordmark on ink, 4-f flicker steps, 4.0 s / skip 1.5 s, `MUS_BOOT_STING` | small |
| Menu | `build_menu()` 230–293 | backdrop = 3-layer pixel parallax + motes; 5 items in 5×7 display-scale font; hover = bronze underline draw + pip; CONTINUE dim 40 % + tooltip string | **medium** |
| PLAY overlay ("Begin a new contract?") | `build_new()` 365–380 | parchment card + wax seal sprite | small |
| First Run contract page | `build_contract()` 381–485 | three pill groups (difficulty / pacing / subtitles+comfort) as nine-patch panels; `SIGN & DESCEND` + `BACK` | medium |
| Ledger | `build_ledger()` 495–527 | 8-slot parchment list, confirm-delete card | small |
| Options | `options_page.gd` (282) | same schema-driven code, pixel controls (sliders = segmented pips; lists = pill buttons); rebind flow unchanged; 3D rows deleted (§6.12) | medium |
| Codex | `build_codex()` 537–580 | 3-tab rail + folio page-turn (2-f), SRD-re-sourced Rules text, bestiary gets 2 entries | medium |
| Credits | `build_credits()` 581–649 | vertical scroll 15 px/s (480-space equiv of 60 px/s @1600), hold ×3, end card emblem with three steps lit | small |
| Loading | `build_loading()` 659–715 | ink-route pixel road + tip cycle; **min-dwell retained** even when the yard loads in one frame — the spec's pacing is part of the identity | small |

### 7.3 The pixel UI kit (`ui_pixel.gd` replaces `shell_ui.gd`)

Same factory surface (`label/button/pill_button/panel/rule/scroll_column/image/centered_text`) so call sites
change minimally; internals switch from `StyleBoxFlat` to `StyleBoxTexture` nine-patches + bitmap fonts.
Palette constants move to a preloaded `palette.tres` (typed `Dictionary`) so tests can assert on them.
Motes survive as 8 drifting 1-px bronze/mint dots (cheap, existing code adapts in ~10 lines).

### 7.4 Loading screen in an instant-loading world

The yard PCK-resident scene loads in < 100 ms. Keep the loading screen **only** as a staged transition
(minimum dwell 1.2 s, tip rotation, route animation) — identical behaviour to today's `load_route.gd`, which
already enforces a minimum dwell. If telemetry later shows players skip it, the dwell becomes an option.

---

## 8. AUDIO PLAN

### 8.1 Format reality (verified 2026-09)

Ogg Vorbis is still **not playable in Safari on iOS before 18.4** (March 2025) and only partial on desktop
Safari ≤ 18.3; MP3 is universal. Godot's web build decodes through the browser, so the shipped format decides
who hears the game. Decision: **every shipped track gets an MP3 twin**; the web export filter ships MP3 only,
desktop keeps OGG.

### 8.2 Pipeline

1. `tools/audio/transcode.py` (ffmpeg via `ffmpeg-static` npm binary — no system dependency): OGG → MP3
   (192 kbps VBR for music, 128 for VO), loudness-normalised to −16 LUFS, length-checked against source.
2. `Sound.gd` selects by extension preference per platform (`mp3` on web, `ogg` elsewhere) — ~10 lines.
3. New cues (synthesised first, replaced by generated files when approved — same pattern as the web shell's
   `AUDIO_PROMPTS.md`): `MUS_YARD_DAWN` (90 s loop), `MUS_COMBAT_TRAINING` (60 s loop), `SFX_UI_MOVE/CONFIRM/
   BACK/DENY/PAGE`, `AMB_YRD_DAWN` (gulls + harbour), `SFX_STEP_*` (dirt/cobble/plank, 3 each), `SFX_HIT/
   MISS/CRIT`, `SFX_DICE_ROLL`, `SFX_BELL`. 14 files, all ≤ 150 KB each.
4. Mix buses unchanged (Master/Music/SFX/Voice) + ducking on VO kept from `sound.gd`.

### 8.3 Budget

All audio ≤ 1.2 MB total in the PCK (4 existing tracks ≈ 600 KB MP3 + 14 small cues).

---

## 9. WEB EXPORT & DEPLOYMENT

### 9.1 Export preset changes (`export_presets.cfg`)

| Key | Current | New | Why |
|---|---|---|---|
| `export_path` | `exports/web/index.html` | `exports/web/index.html` (keep) | CI picks it up unchanged |
| `variant/thread_support` | `false` | `false` (keep) | single-threaded = **no COOP/COEP headers needed**, widest host compatibility (Godot ≥ 4.3 default) |
| `variant/extensions_support` | `false` | `false` (keep) | no GDExtension in the pixel build |
| `exclude_filter` | tests/tools/md/font licences | **+ `assets/characters/**,assets/textures/**,assets/models/**,addons/**,assets/fonts/*.ttf,assets/audio/*.ogg`** | retired assets must not ride into the PCK |
| `include_filter` | `data/*.json` | + `data/*.json` (keep) | content files |
| `html/custom_html_shell` | empty | `tools/web/delve_shell.html` | §9.2 |
| `html/canvas_resize_policy` | 2 (Adaptive) | keep 2 | engine letterboxes internally at integer scale |
| `progressive_web_app/enabled` | false | evaluate at M7 (nice-to-have offline cache) | optional, T-45 |

### 9.2 Custom HTML shell (`tools/web/delve_shell.html`)

Responsibilities, in order:
1. Boot splash (pure CSS, pixel emblem, ink background) that is replaced by the canvas on engine init —
   the user sees DELVE, not a blank page, inside 1 s.
2. `image-rendering: pixelated` on the canvas (belt-and-braces under Adaptive resize); CSS letterbox colour
   = ink-1 to match the clear colour.
3. Input hygiene: `touch-action: none`, `overscroll-behavior: none`, prevent context menu on long-press,
   keyboard focus on the canvas at first gesture; coarse-pointer detection → engine flag (§4.9).
4. Audio unlock: any first gesture resumes the `AudioContext` (existing shell.js pattern, ported).
5. Version stamp injected by CI (`window.DELVE_BUILD`) shown in the boot splash and readable by Playwright.
6. No analytics, no third-party requests, no fonts fetched at runtime (all bundled) — an offline-capable page.

### 9.3 Hosting topology (resolves hygiene finding H8)

```
https://<site>/                 landing page (today's root shell, lightly edited: PLAY button → /play/,
                                legal + credits retained; becomes the fan-project front door)
https://<site>/play/            redirect → /play/v0.4.0/
https://<site>/play/v0.4.0/     immutable game deploy (index.html, index.wasm, index.pck, icons, licences)
https://<site>/play/v0.4.1/     next deploy; /play/ redirect updated atomically
```

- **Vercel** (existing account/config): extend `vercel.json` — immutable `Cache-Control` for
  `/play/v*/index.{wasm,pck}`; `no-store` for the `/play/` redirect and `index.html`; `.wasm` MIME is
  automatic on Vercel. No COOP/COEP headers required (single-threaded build).
- **itch.io** second front (fan-game audience): zip of the versioned folder with `index.html` at the root,
  uploaded by CI (`butler push` if a key is provided; manual until then).
- **GitHub Pages** as fallback mirror of the same folder (T-43).
- Save-data consequence: the game always lives at a *stable origin*; version changes path but not origin, so
  IndexedDB saves persist across deploys. §4.10 handles the one-time localStorage migration.

### 9.4 Budgets enforced at deploy time

| Check | Limit | Fails the deploy if |
|---|---|---|
| `index.wasm` size | ≤ 12 MB raw (≈ 8–9 MB gzipped) | exceeded — investigate export flags |
| `index.pck` size | ≤ 2.5 MB | retired assets leaked into the filter |
| total files | ≤ 12 | forgotten debug junk |
| Playwright load test | playable canvas + zero console errors within 15 s on throttled 10 Mbps | any failure |

---

## 10. REPOSITORY, RELEASES & CI

### 10.1 Hygiene tasks (M0, before any pixel work)

| T | Task | Notes |
|---|---|---|
| T-01 | `git mv .godot godot` + fix root `.gitignore` (`godot/.godot/`, `godot/exports/`, `*.zip`, `deliverables/`, `__pycache__/`) + update doc paths + Vercel ignore nothing at root | one commit; nothing inside uses absolute paths |
| T-02 | apply the §4.2 `project.godot` block; disable Sky3D plugin | CI import pass proves it parses |
| T-03 | move `DELVE_Godot_4.7.2.zip` out of Git into a GitHub Release (`v0.3.0-godot-3d`) | `git rm --cached`; file stays downloadable |

### 10.2 3D asset retirement (M0/M1)

1. Tag the current tree `archive/3d-v0.3.0`; build + attach `DELVE_3D_ASSETS_v0.3.0.zip` (characters +
   textures + models + sky_3d, ≈ 86 MB) to a Release — provenance preserved, clones stay light.
2. `git rm -r` those paths from the working tree; drop them from the export include set.
3. Replace `assets/models/manifest.json` with a **2D prop manifest** that keeps the same prop names and
   footprints (the names are now the contract between §3.3 and the art pipeline).
4. Working-tree target: ≤ 40 MB total; clone < 60 s on broadband.

### 10.3 CI (GitHub Actions — new because the sandbox has no Godot binary)

`/.github/workflows/delve.yml`, all jobs inside the pinned `godot-ci` container (4.7.2-stable tag
**[VERIFY]** at T-40):

| Job | Steps | Gate |
|---|---|---|
| `lint` (no Godot) | palette/artifact lint (§5.7), JSON schema validation for `data/*.json`, GDScript static checks via `--check-only` headless parse | always |
| `import` | `godot --headless --path godot --import`; commits regenerated `.import`/uid files back on a bot branch when they drift | main |
| `smoke` | `godot --headless res://tests/smoke_pixel.tscn -- --test-mode` → expects `SMOKE_ALL_GREEN` + prints its own check count | main |
| `golden-combat` | scripted encounter with fixed seed → JSON of every event → diff vs committed golden file | main |
| `shots` | `xvfb-run godot …shot_walk.tscn --shots=artifacts/` (incl. combat UI states) → uploaded artifacts | main |
| `export-web` | `godot --headless --export-release "Web" exports/web/index.html` + size checks (§9.4) | tags `v*` |
| `browser-smoke` | Playwright (Chromium): serve `exports/web/` locally, load, assert canvas + build stamp + no console errors, screenshot | tags `v*` |
| `deploy` | push versioned folder to Vercel prod path + update `/play/` redirect + (optional) `butler` itch push | tags `v*` |

PRs run `lint + import + smoke`; tags run everything. This mirrors the project's *existing* verification
doctrine (GDD-04 §6, GETTING_STARTED §7.3) but moves it where it can actually run.

### 10.4 Doc reconciliation (M0)

- Add supersede banners to GDD-00 Part 1 and GDD-04 pointing at this document.
- GDD-05 rewritten: "Way 1 — play in your browser" becomes the live `/play/` URL; the editor route unchanged.
- This document (GDD-06) is the single owner of pixel-tech decisions; future changes land here first.

---

## 11. VERIFICATION & QA DOCTRINE

### 11.1 Execution topology (who runs what)

This planning environment has **no Godot binary and no browser**, but has Node 22, Python 3.11 (venv with
Pillow 12.3 + NumPy 2.4 verified), and network access. Therefore:

| Work | Runs where |
|---|---|
| All Godot execution (import, smoke, shots, export) | **CI container** (or a developer machine with Godot 4.7.2 + templates) |
| Art pipeline, palette lint, layout converter, JSON validation, golden-file tooling | **agent sandbox** (Python/Node) |
| Browser verification | **CI Playwright job**; manual matrix left to humans |

Nothing in this plan requires the agent to *run* Godot; everything it authors must be checkable by CI.

### 11.2 Test layers

1. **Unit (GDScript, headless):** `dice.gd` roll distributions & crit rules; pathing distances (assert
   `AStarGrid2D` returns Chebyshev-correct 5e distances on a reference grid — this also validates the
   heuristic choice, §13 T-27); LoS rays; AoE templates (known cell sets); cover/elevation modifiers;
   conditions; initiative tie-breaks.
2. **Golden combat test:** fixed-seed scripted encounter (player + partner, 4 rounds) emits the full event
   stream as JSON; committed golden file diffed in CI. Any engine/rules regression is caught without a human.
3. **Smoke scene (`smoke_pixel.tscn`):** the existing 67-check structure extended to ≈ 90 checks: all 10
   shell screens build; ledger cap 8 + delete-confirm; options round-trip + rebind swap; save v2 write/read/
   migrate-from-localStorage-fixture; yard loads; both encounters reach `ENDED`; budget/pause; ui_scale 1&2.
4. **Screenshot walk:** every screen + yard noon/dawn + combat (turn 1, AoE preview, reaction prompt, result
   card) at 960×540. Deterministic: animations frozen by `--still` flag; near-zero-tolerance diff allowed.
5. **Art lint** (§5.7) + **contrast lint** (overlay tint pairs ≥ 4.5:1, computed from the palette JSON).
6. **Browser smoke (Playwright, Chromium):** load → engine print `DELVE_BUILD` → canvas non-blank → click to
   legal → one screenshot; repeated with network throttle for the ≤ 8 s budget.
7. **Perf harness:** the screenshot walk records frame timings; CI asserts p95 ≤ 8 ms on the runner as a
   *trend* alarm (absolute budget enforced by manual device pass at M8).

### 11.3 Acceptance per milestone — see §12 gates; M8 additionally runs the §1.4 checklist on real
Chrome/Firefox/Safari desktop + one Android and one iOS device (human pass, scripted steps provided).

---

## 12. MILESTONES & SCHEDULE

Estimates in **agent-days** (an agent-day ≈ one focused session producing reviewable commits); calendar
assumes sequential agent work with human review between milestones.

| M | Name | Deliverable (all committed, CI green) | Gate | Effort |
|---|---|---|---|---|
| **M0** | Hygiene & freeze | T-01..T-03 + doc banners (§10.4) + archive tag/release; repo ≤ 40 MB | clone size check; docs consistent | 0.5–1 d |
| **M1** | Pixel skeleton | §4.2 project block; empty 480×270 scene rendering a palette-swatch test card through the integer pipeline; input map v2; autoloads incl. `Dice`; CI `lint+import+smoke` green on the skeleton | swatch screenshot shows uniform pixels, no shimmer | 1–2 d |
| **M2** | Art pipeline + UI kit | §5 toolchain (`generate→pack`), locked palette files, UI nine-patch kit, both fonts, art lint in CI; one reference screen ("menu" mock) built from the kit | palette lint passes; menu mock screenshot approved | 2–3 d |
| **M3** | Shell port | All 10 screens at 480×270 (§7.2), save v2 + migration, options pruned, codex re-sourced, credits, loading dwell; smoke ≈ 90 checks | screenshot walk matches GDD-02 strings exactly | 3–5 d |
| **M4** | Yard playable (no combat) | Tile yard from GDD-03 plan, 22 props, player + 4 NPC rigs walking, beacons T1, day clock + mist, pause menu, interactables, bell stub | T1 completable; 60 fps; draw calls ≤ 32 | 3–5 d |
| **M5** | Combat core | Grid overlay, turn engine, initiative, movement budget, attack/damage/crit, dice Roll Moment, pathing + LoS + cover data wired | dummy-line encounter (T3/T4) winnable; golden test v1 committed | 3–5 d |
| **M6** | Combat depth | Reactions/OA, AoE templates, masteries (Push/Topple), Prone, enemy AI + telegraphs, sparring encounter (T8), bestiary entries | sparring loop passes golden + human playtest script | 4–6 d |
| **M7** | Web release candidate | Export preset + custom HTML shell + audio MP3 twins; hosting topology live at `/play/v0.4.x`; deploy CI; size budgets green; loading on Safari/Chrome/Firefox | Playwright smoke green on throttled network; ≤ 15 MB total | 2–3 d |
| **M8** | Polish & ship | Accessibility pass (ui_scale, colourblind LUTs, reduced motion), touch fallback, weather/mist pass, backdrops, credits VO sync, device matrix, release notes, v1.0.0-pixel tag | §1.4 checklist fully green | 3–5 d |

**Total: ≈ 22–35 agent-days** (median ≈ 28). Critical path: M2 → M3 → M4 → M5 → M6 (art kit unblocks shell;
shell unblocks yard; yard unblocks combat). M7/M8 can overlap M6's tail.

---

## 13. TASK BACKLOG

| ID | M | Task | Deps | Definition of done |
|---|---|---|---|---|
| T-01 | M0 | Rename `.godot/` → `godot/`; consolidate `.gitignore` | — | `git grep "\.godot/"` finds only docs about history; clone clean |
| T-02 | M0 | Apply §4.2 project settings; verify key names in-editor | T-01 | import pass green; appendix updated with any renames |
| T-03 | M0 | Move 69 MB ZIP to Release; `*.zip` ignored | T-01 | Release asset exists; tree < 40 MB path set |
| T-04 | M0 | Archive 3D assets (tag + Release zip + `git rm`) | T-03 | export filter test proves PCK without them |
| T-05 | M0 | Supersede banners on GDD-00/04; rewrite GDD-05 Way 1 | T-01 | doc review |
| T-10 | M1 | Pixel skeleton scene + swatch test card | T-02 | screenshot, no shimmer |
| T-11 | M1 | Input map v2 (§4.9) | T-10 | rebind test passes |
| T-12 | M1 | `Dice` + `Streams` autoloads + unit tests | T-10 | deterministic under fixed seed |
| T-13 | M1 | CI workflow skeleton (`lint/import/smoke`) | T-10 | green on PR |
| T-20 | M2 | Palette files + LUT + shader + infection test | T-10 | pixel-exact reference test |
| T-21 | M2 | Fonts: BMFont import of 5×7 + 8 px; codex-fit test | T-10 | longest SRD entry unclipped |
| T-22 | M2 | Nine-patch UI kit + `ui_pixel.gd` factory | T-20 | kit screen shot |
| T-23 | M2 | Art toolchain v1 (downscale/quantise/clean/pack) | — | one family end-to-end |
| T-24 | M2 | Art lint + atlas manifest in CI | T-23 | lint red on injected bad PNG |
| T-30 | M3 | Layout converter + per-screen re-author (10 screens) | T-22 | GDD-02 string parity |
| T-31 | M3 | Save v2 schema + migration + tests | T-30 | round-trip + fixture migrate |
| T-32 | M3 | Options schema prune (delete 3D rows) + pixel controls | T-30 | 100 % of live rows act |
| T-33 | M3 | Codex SRD re-source + attribution block | T-30 | §15 review passed |
| T-34 | M3 | Credits + sting + loading dwell in pixel | T-30 | walk captures |
| T-40 | M4 | CI Godot tag verify + import-commit bot | T-13 | `.import` drift auto-committed |
| T-41 | M4 | Tile yard builder (`build_tile_yard.py` → `.tscn` + data layers) | T-23 | yard loads, layers populated |
| T-42 | M4 | Player + NPC rigs (6) + 9 anim states | T-23 | walk/attack reads at 1× |
| T-43 | M4 | Day clock + mist + pause + interactables + bell stub | T-41 | T1 beat completable |
| T-44 | M4 | Smoke scene extension (target ≈ 90 checks, printed) | T-31 | `SMOKE_ALL_GREEN` |
| T-47 | M5 | Rules grid consumers: pathing/LoS/cover/elevation + tests | T-41 | distance/LoS unit tests |
| T-48 | M5 | Turn engine + queue UI + budgets | T-47 | scripted 1-round test |
| T-49 | M5 | Dice Roll Moment UI | T-23 | pace settings honoured |
| T-50 | M5 | Dummy-line encounter (T3/T4) | T-48 | winnable; golden v1 |
| T-55 | M6 | Reactions/OA + AoE templates + previews | T-48 | template unit tests |
| T-56 | M6 | Masteries + Prone + conditions UI | T-55 | sparring uses both |
| T-57 | M6 | Enemy AI + telegraphs + pace settings | T-48 | AI golden assertions |
| T-58 | M6 | Sparring encounter (T8) + bestiary entries | T-56 | §6.8 acceptance |
| T-60 | M7 | Export preset update + custom HTML shell | T-40 | local export boots |
| T-61 | M7 | Audio MP3 twins + platform pick | — | Safari audition pass |
| T-62 | M7 | Hosting topology (`/play/v*`, redirect, caching) | T-60 | deploy green, saves persist across versions |
| T-63 | M7 | Playwright browser smoke + size budget gates | T-60 | CI tag run green |
| T-70 | M8 | Accessibility pass (ui_scale, CB LUTs, reduced motion) | all | lint + manual pass |
| T-71 | M8 | Touch fallback (coarse-pointer d-pad) | T-60 | phone checklist |
| T-72 | M8 | Weather/mist/backdrops polish pass | T-42 | shots approved |
| T-73 | M8 | Device matrix + release notes + v1.0.0-pixel tag | all | §1.4 checklist |

---

## 14. RISKS & MITIGATIONS

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | AI-generated art fails the silhouette/palette bar repeatedly, inflating M2 | med | schedule | §5 pipeline is iterative by design; fallback = CC0 pixel packs recoloured to the palette for *props only* (licence-clean), characters stay bespoke |
| R2 | Shell re-layout uncovers hidden coupling to 1600×900 (motes math, credits speed) | med | M3 overrun | converter first pass exposes all 69 rects up front; budget already includes re-author |
| R3 | Godot web build quirks (audio unlock, canvas focus, Safari WebGL) discovered late | med | M7 overrun | browser smoke enters CI at M7 *start*, not end; MP3 twins remove the known Safari audio failure |
| R4 | Chebyshev/AStar pathing does not yield 5e-legal distances | low | combat correctness | explicit unit test before any encounter content (T-47); fallback = custom 8-way Dijkstra on the 29×29 grid (trivial size) |
| R5 | CI Godot image tag drift / template mismatch | low | pipeline | pin exact tag at T-40; smoke runs on every PR so breakage is same-day |
| R6 | Save loss across deploy paths | low | player trust | origin never changes; §9.3 redirect keeps URLs stable; migration is one-way and logged |
| R7 | WotC trademark pressure (fan names kept, D5) | low-med | takedown | non-commercial posture, visible disclaimer, no sales, no mind-flayer/illithid content in this slice; Route B rename plan already exists in GDD-00 if ever forced |
| R8 | Scope creep back toward 3D or Chapter 1 | med | project death | §3.1 deferred list is explicit; any addition requires striking something of equal size |
| R9 | Repo bloat returns | med | DX | CI size gates (§9.4, §10.2) fail the build on regression |

---

## 15. RIGHTS, LICENSING & ATTRIBUTION

1. **Fan-work disclaimer** stays verbatim on the legal screen and credits (D5 decision; it is already in
   `shell.gd` `LEGAL`).
2. **SRD 5.2.1 (CC-BY-4.0)** is the rules source; its attribution block (GDD-00 §Part 0) must appear in
   credits and the legal screen *regardless* of the fan-name choice — CC-BY requires it whenever SRD text is
   used, and the codex does use it.
3. **Codex provenance (T-33/T-47):** every `rules[]` entry in `shell_content.json` currently labelled
   "PHB 2024" must be verified sentence-by-sentence against SRD 5.2.1 and reworded to the SRD text where it
   differs. Anything with no SRD counterpart is cut, not paraphrased.
4. **Fonts:** pixel fonts must be CC0/OFL with notice files committed (same discipline as the existing
   Cinzel/Alegreya OFL files).
5. **Generated art:** prompts and raws retained (`prompts.json`) as provenance; no third-party copyrighted
   references in prompts.
6. **Quaternius assets** being retired still get their CC0 credit line preserved in `THIRD_PARTY.md` history.

---

## 16. OPEN QUESTIONS (answer to unblock M-gates)

| # | Question | Default if unanswered | Blocks |
|---|---|---|---|
| Q1 | Combat zoom: keep world at 1× during combat (see ~30×17 cells) or add a 2× "lean-in" on the acting combatant? | 1× flat + animated camera nudge (cheaper, pixel-pure) | M5 |
| Q2 | Should the legacy root web shell gain a playable iframe of `/play/`, or just a link? | Link + embed card (iframe adds pointer/keyboard focus friction) | M7 |
| Q3 | itch.io publishing: set up a butler key now, or manual uploads until v1.0? | Manual until v1.0 | M7 |
| Q4 | Keep IM Fell English as a third UI accent anywhere in the pixel build? | No — two pixel fonts only | M2 |
| Q5 | Codex reading magnification: runtime `ui_scale` toggle vs a dedicated "large text" options row? | Options row (discoverable) | M8 |
| Q6 | Is a desktop (native) export worth keeping alongside web, given the OGG originals exist? | Web-only for v1.0; desktop later | post-M8 |

---

## 17. APPENDICES

### A. `project.godot` diff summary
See §4.2 (complete block). Removed keys: `window/size/viewport_*` 1600/900 pair, `stretch/mode=canvas_items`,
`stretch/aspect=expand`, Sky3D from `editor_plugins`. Added: `[gui]` pixel-font block, nearest filter, 2D
snapping, 480×270 viewport + overrides.

**T-02 verification record (2026-09-23)** — every §4.2 key name confirmed **exact** against the Godot 4.7
class/enum references; **zero renames**:

- `display/window/size/*` and `window/stretch/{mode,aspect}` — pre-existing keys, values swapped in place;
  `window/stretch/scale_mode="integer"` confirmed present (enum `fractional`/`integer`).
- `gui/theme/default_font_{antialiasing,subpixel_positioning,hinting}` — confirmed; `0` = `NONE`,
  `DISABLED`, `NONE` respectively (engine default is `1` in all three).
- `rendering/textures/canvas_textures/default_texture_filter` — confirmed (`0` = Nearest); written as
  `textures/canvas_textures/…` under `[rendering]`.
- `rendering/2d/snap/snap_2d_{transforms,vertices}_to_pixel` — confirmed.
- `rendering/environment/defaults/default_clear_color`, `renderer/rendering_method{,.mobile}`,
  `editor_plugins/enabled`, `application/config/version` — confirmed (already in use or standard).
- Applied-form notes: the block's two inline `;` annotations are written as full-line comments in the
  shipped file (ConfigFile documents full-line `;` comment lines — a trailing comment can be absorbed into
  the value text); the pre-existing `textures/vram_compression/import_etc2_astc=true` key was kept
  ("replace/add"); the `[input]` comment defers the actual action edits to T-11, because actions today are
  registered at runtime by `game_state.gd`, not by `project.godot`.
- Import gate: the sandbox has no Godot binary (§11.1) and the release CDN is unreachable, so the
  executable `--headless --import` pass is the CI gate (`import` job, §10.3 / T-13). The local gate was a
  ConfigFile-grammar validation of the shipped file (sections, keys, value syntax, no inline comments,
  full §4.2 block parity) — PASS.

### B. Palette tables
Surface 32 + Below 8 — exact hex in §5.3. Machine-readable copies land at
`assets/pixel/palette/palette_{surface,below}.png` + `palette_lut.json` (M2, T-20).

### C. New project tree
See §4.3.

### D. Asset manifest (counts)
See §3.3; machine-readable `atlas_manifest.json` generated by the packer (M2).

### E. Command cheat-sheet (post-M1)

```sh
# local dev (requires Godot 4.7.2 + templates on the developer machine)
godot --headless --path godot --import                 # regenerate imports
godot --headless --path godot res://tests/smoke_pixel.tscn -- --test-mode
godot --headless --path godot res://tests/shot_walk.tscn -- --test-mode --still --shots=/tmp/shots
python3 godot/tools/export_web.py --godot /path/to/godot
python3 godot/tools/serve_web.py                        # http://localhost:8080

# agent-sandbox toolchain (no Godot needed)
python3 -m venv .venv && .venv/bin/pip install pillow numpy
.venv/bin/python godot/tools/pixelart/lint_artifacts.py
.venv/bin/python godot/tools/pixelart/convert_layout.py --dry-run
npm i --no-save ffmpeg-static && node godot/tools/audio/transcode.js
```

### F. Glossary of shipped systems
`Dice` (seeded d20 authority) · `Streams` (isolated RNG lanes) · `TurnEngine` (queue/economy state machine) ·
`RulesGrid` (tile custom-data consumers) · `Pathing` (AStarGrid2D, Chebyshev) · `EncounterController`
(data-driven combat loader) · `ui_pixel` (nine-patch factory) · art pipeline (`generate→pack`, lint-gated).

### G. Plan changelog
- **v1.0 (2026-09-23):** initial plan from clarification round (D1–D6) + full repo audit at `17c5fbc`.
- **T-01 (2026-09-23):** `.godot/` → `godot/` rename + root `.gitignore` consolidation landed.
- **T-02 (2026-09-23):** §4.2 applied to `godot/project.godot` (v0.4.0-pixel, 480×270 integer pipeline,
  Sky3D plugin disabled); key names verified — no renames (Appendix A).

---

*End of GDD-06. Approval of §16 defaults (or overrides) starts M0.*
