# DELVE — Godot 4 + Blender Production Plan

**Version 1.0 · 2026-09-19 · status: AWAITING GREENLIGHT**
Companion docs: `01_CHAPTER1_TUTORIAL_AND_TACTICAL_COMBAT.md` (GDD-01 v2.2), `02_DELVE_SHELL_SPEC.md` (GDD-02), `03_NEVERWINTER_YARD_LEVEL_SPEC.md` (GDD-03). Web shell: `delve-shell/` (v1.7.0, complete GDD-02 surface).

> **ENGINE DECISION (supersedes round-2):** the full build is **Godot 4.x (4.5 LTS track)**, not Unreal.
> User instruction, 2026-09-19. All prior UE5.7 references in older docs are historical only.
>
> **PRODUCTION MANDATE:** **I (the agent) author 100% of the code and 100% of the 3D models.**
> No asset packs, no store purchases, no Mixamo/ready-made rigs, no hand-DCC sessions.
> Every mesh, rig, texture and animation is produced by **version-controlled Blender Python (bpy) scripts**
> that I write, run headless, and QA from rendered turntables. Every game system is GDScript I write.
> The only borrowed binaries are OFL fonts and the AI-generated audio the player uploads themselves.

---

## 1. Art direction for agent-made 3D

**"The living tabletop."** Stylised low-poly miniatures brought to life: chunky silhouettes,
hand-painted-look baked textures, visible facet charm, painterly dawn lighting. This is a deliberate
fit for (a) D&D's miniature heritage, (b) the fan-work tone, and (c) the reality that every model is
script-generated — stylisation reads as intent, not limitation. Reference mood: the menu panorama's
warm dawn; palette anchors `INK #101418`, `PARCHMENT #E9DFC8`, `BRONZE #B0793A`, obelisk teal accents.

Budgets (triangles, LOD0): hero 6 k, named NPCs 4–5 k, goblin 3 k, bugbear 5 k, dummy 1.2 k,
props 100–600, trees 250–400, yard terrain tile 8 k. One UV set + baked maps per asset; no lightmaps
(GI via probes); textures 1 k for props / 2 k for characters (basecolor + roughness + normal).

## 2. Toolchain (all headless, all scripted)

| Tool | Version | How I run it |
|---|---|---|
| Godot | 4.5.x linux.x86_64 | downloaded zip; `godot --headless --script …` for CI, `--export-release` for builds; editor never required |
| Blender | 4.2 LTS tarball | `blender -b -P script.py` per asset; deterministic seeds |
| Web export | Godot HTML5 | served with **COOP/COEP headers** (SharedArrayBuffer) via `tools/serve_web.py` in-sandbox and `vercel.json` headers for production |
| Fonts | Cinzel / Alegreya / IM Fell English | fetched from the OFL upstream repos into `res://ui/fonts/` (license files kept) |
| Tests | custom GDScript assert runner + Playwright (web build) + Playwright (shell) | `tools/ci.gd` headless; screenshots via `SubViewport` capture or `--screenshot` where available |

Repo layout (new, beside `delve-shell/`):

```
delve-game/
├── project.godot            # Godot 4 project, GL Compatibility renderer (web-safe)
├── addons/                  # none at M0; none ever unless I write them
├── scenes/  ui/  world/  actors/  combat/
├── scripts/
│   ├── autoload/            # Rules, TurnManager, OptStore, SaveGame, AudioRig, CodexDB
│   ├── rules/               # d20.gd, cover.gd, conditions.gd, reactions.gd, masteries.gd
│   ├── actors/  camera/  ui/  load/
├── data/                    # strings.json (ported from shell STR + §4), codex.json, tips.txt, options.defaults.json
├── assets/
│   ├── art/                 # copied from delve-shell/assets/img (panorama, map, logos, parchment)
│   ├── audio/               # same manifest.json contract as the shell
│   ├── models/              # exported .glb  (SM_* static, SK_* skinned)
│   └── textures/            # baked PNGs (T_*)
├── models/
│   ├── bpy/                 # ONE script per asset: hero.py, dummy.py, gundren.py, pine.py …
│   ├── lib/                 # shared bpy helpers (materials, bake, rig, anim, export, qa_render)
│   └── qa/                  # rendered turntables + ortho sheets I inspect each run
└── tools/                   # ci.gd, export_web.sh, serve_web.py, shot_diff.py
```

Naming: `SM_` static mesh · `SK_` skinned · `T_` texture · `M_` material · `A_` action · `S_` scene.
Blender exports glTF-Binary, +Y up, metres, origins at ground pivot, tangents on, no embedded textures.

## 3. Blender pipeline (how every model gets made by me)

1. **Script per asset** (`models/bpy/<name>.py`): builds mesh from primitives + modifiers
   (skin/subsurf/bevel/displace/boolean), applies them, sets UVs (smart-project + seam hints),
   assigns procedural Principled material.
2. **Bake**: procedural → 2 k/1 k PNG (basecolor, roughness, normal) via `lib/bake.py`;
   material swapped to baked maps before export (Godot gets plain Principled + textures).
3. **Rig** (`lib/rig.py`): scripted armature builder — humanoid template (22 bones: root, hips,
   spine×2, neck, head, clavicle×2, upper/lower arm×2, hand×2, thigh/shin/foot×2),
   dwarf/goblin variants = proportion params; `parent_set(ARMATURE_AUTO)` weights, then scripted
   weight cleanup (normalize, limit 4 influences, symmetrize).
4. **Animation** (`lib/anim.py`): procedural keyframe library baked to actions —
   `A_idle` (breath + weight shift), `A_walk` (8-key contact/down/pass/up cycle, foot IK solved from
   sine stride), `A_run`, `A_attack_slash` (3-phase arc with anticipation), `A_attack_thrust`,
   `A_block`, `A_hit`, `A_death` (collapse with knee fold), `A_interact`. Curves generated as
   mathematical functions of time → inserted as keys → baked at 24 fps.
5. **QA**: `lib/qa_render.py` renders a 4-view turntable + wireframe sheet to `models/qa/<name>.png`;
   I read the images, fix the script, re-run until it passes my eye (same loop as the shell screenshots).
6. **Export**: `.glb` with actions as takes; checksum manifest `models/exports.json` for CI drift checks.

**Phase asset lists**
- **P1 — the yard (GDD-03 area A):** `SK_hero_recruit`, `SK_training_dummy`, `SK_gundren`,
  `SM_sword`, `SM_shield`, `SM_bell_post`, `SM_target_rack`, `SM_targets×3`, `SM_fence_*` (3 segments),
  `SM_crate`, `SM_barrel`, `SM_bench`, `SM_weapon_rack`, `SM_gate_arch`, `SM_pine_low`, `SM_grass_card`,
  `SM_rock_set`, `T_yard_ground` terrain tile (displaced noise + painted paths).
- **P2 — the trail & ambush (Ch1 beat T0–T3):** `SM_road_patch`, `SM_wagon` (static, wheel turned),
  `SM_boulder_set`, `SM_pine_mid`, `SM_fallen_log`, `SK_goblin` (hero-rig variant, green skin bake),
  `SK_wolf` (quadruped rig, 16 bones) — stretch.
- **P3 — Cragmaw mouth:** `SM_cave_mouth`, `SM_crag_gate`, `SK_bugbear_klarg` (scaled rig + belly bone),
  `SK_goblin_arrow` variants (2 bakes).

## 4. Godot architecture (systems I write, mirroring shipped shell logic)

- **`Rules.gd` (autoload)** — the Codex Rules folio as executable law: d20 test with advantage
  (roll-two, no stacking), DC/AC comparisons, cover table (+2/+5/untargetable), difficult terrain
  ×2, conditions enum with glossary effects, passive scores, surprise, knock-out mercy rule,
  all eight weapon masteries as strategy objects. Unit-tested by `tools/ci.gd` against fixed dice seeds.
- **`TurnManager.gd`** — Table Mode default: initiative order, move+action economy per Codex
  "Anatomy of a Turn", reaction queue with prompt modal honouring `play.react` / `play.rtimer`,
  enemy-turn pace presets, auto-end option. Skirmish Mode = separate real-time controller behind
  the same Rules calls (pausable), opt-in per Options.
- **`OptStore.gd`** — same keys/defaults as the shell (`delve.options.v1` mirror) in
  `user://options.cfg`; Options scene is a 1:1 port of the shell page (rail, rows, sliders, rebinds,
  live classes → Godot theme/viewport effects: reduced motion, high contrast, colourblind LUTs).
- **`CameraRig.gd`** — BG3-style over-shoulder spring arm + first-person parity (same aim ray,
  same cover computation), `V` toggle, fov/boom/shake/snapping from OptStore, combat framing modes.
- **UI port** — Menu, First Run, Loading (§3 behaviours incl. 1.2 s minimum, tip rotation, seal
  steps, error card), Codex folio, Credits crawl rebuilt as Godot scenes reusing the shell's PNG art,
  strings from `data/strings.json`, parchment Theme resource; loading progress = real
  `ResourceLoader.load_threaded_*` fractions weighted 70/20/10 like the shell.
- **`SaveGame.gd`** — `user://contract.save` JSON compatible with the shell's save shape
  (slot/name/class/level/chapter/ts) so CONTINUE semantics carry over.
- **`AudioRig.gd`** — buses master/music/sfx/voice; same `assets/audio/manifest.json` contract;
  silence-by-design until the player uploads AI-generated files (guide unchanged).
- **`CodexDB.gd`** — codex.json drives in-game Codex; lore/bestiary entries unlock on events
  (signing, first encounter) exactly as the shell's ledger does.
- **Combat presentation** — dice theatre panel (real d20 simulation shown), hit-chance toggles,
  grid overlay option (invisible rules layer, 5 ft), cover/difficult-terrain outlines per accessibility opts.

## 5. Milestones (each ends in a playable web-export build + QA shots + zip for you)

| # | Deliverable | Definition of done |
|---|---|---|
| **M0** | Toolchain + repo + CI | Godot & Blender run headless in-sandbox; `ci.gd` green; web export boots to menu graybox with COOP/COEP server; fonts loaded |
| **M1** | Graybox yard, playable loop | Hero controller (WASD/sprint/jump), camera rig, interact with dummy, **turn-based combat vs dummy** with d20 theatre, reaction prompt, end-turn; Options partial (camera+gameplay); save/continue |
| **M2** | Art pass 1 | P1 assets replace graybox; baked textures; dawn GI probe + fog matching menu panorama; loading screen shows real yard bundle progress |
| **M3** | Shell parity in-engine | Menu/First Run/Loading/Codex/Credits scenes live; strings + art identical to shell v1.7; full Options incl. rebinds & accessibility |
| **M4** | Rules depth | Masteries, cover/terrain visuals, conditions, knock-out, companion hot-swap scaffold (Sildar joins at yard end), reaction auto-pass/take |
| **M5** | Chapter 1 opening | Trail + ambush beats T0–T3 per GDD-03 with goblins; bestiary/lore unlocks fire; travel card → chapter loading (CH1 title) |
| **M6** | Polish & ship-pass | Audio integration hooks, perf pass (web export < 60 MB, 60 fps target on mid GPU), codex complete for Ch1 scope, accessibility audit, final playtest matrix |

Every milestone: headless test run + scripted input playthrough + screenshot set I review visually
(the same loop that produced `shots/v2…v8`) + versioned zip + README changelog.

## 6. Verification doctrine

- `tools/ci.gd`: asserts for Rules (fixed-seed dice), TurnManager ordering, OptStore persistence,
  save compatibility with shell JSON, codex unlock triggers.
- Input-playback bots: scripted runs (menu→first run→sign→load→yard→combat→end) capturing frames.
- Blender QA turntables reviewed by me per asset; exports.json checksums gate CI.
- Web export smoke via Playwright against the COOP/COEP server (reuse `pwtest/` harness).

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Agent-made humanoids look wrong | miniature stylisation + proportion templates; QA turntables each iteration; dummy/gundren before hero polish |
| Procedural animation stiffness | limited, well-blended action set + AnimationTree states; combat reads turn-based (poses, not flows) |
| Godot web export size/perf | GL Compatibility renderer, 1 k props textures, VRAM compression, lazy chapter bundles |
| COOP/COEP hosting quirks | `serve_web.py` locally + vercel headers; fallback desktop/Linux builds per milestone |
| bpy/Godot version drift | pinned 4.2 LTS / 4.5.x; checksums; CI re-run on any tool bump |
| Scope creep vs Ch1 | milestone gates; P2/P3 asset lists trimmed to GDD-03 beats; stretch items labelled |

## 8. Coordination note

Your separate Blender chat stays exploratory. All production Blender runs happen **here**, headless,
scripted. If you ever want to drop something from that chat into this pipeline, it must arrive as a
`.blend` obeying §2 conventions (naming, units, origins) — `tools/import_external.blend.py` will
validate and re-export it, or reject it with a report.

## 9. Immediate next actions on greenlight (M0 checklist)

1. Download Godot 4.5 linux + export templates; Blender 4.2 LTS tarball; verify `--version` both.
2. Scaffold `delve-game/` (project.godot, folders, .gitignore, CI stub).
3. Fetch OFL fonts; build parchment Theme from shell CSS values.
4. `ci.gd` v0 green; `serve_web.py` with COOP/COEP; first web export = graybox menu with panorama.
5. First bpy asset: `SM_training_dummy` (the yard's straw sentinel) + QA turntable — the pipeline proof.

*End of plan v1.0.*

---

## Addendum R13 (2026-09-20) — engine stack, plugins, character kit

- **Engine lock:** Godot 4.7.2 (all gameplay/shell code) + Blender (all future custom
  models and the clothing/outfit pass). UE5.7 remains superseded.
- **Plugins adopted:** Terrain3D (MIT, GDExtension) for editable clipmap terrain —
  desktop-first, Web export experimental upstream; Sky3D (MIT, GDScript) for the day/night
  cycle — web-safe. Both verified/adopted in round 13, scene wiring scheduled with the
  Neverwinter yard-to-adventure transition.
- **Character pipeline:** CC0 Quaternius Universal Base Characters (bodies) + Universal
  Animation Library (43 free clips) share one 65-bone universal rig — the retargeting
  budget is zero. Mixamo-compatible naming means future Blender rigs can join the same
  skeleton family. Clothing/hair = next art pass (Modular Outfits CC0 or Blender cloth).
- **Sync routine:** `godot/GITHUB_SYNC.md` is the canonical human-facing workflow
  (GitHub Desktop or git; zips merge over `godot/` without touching `addons/`).
