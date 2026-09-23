# 11 — CORWIN GUARD NPC: IMPLEMENTATION PLAN (GDD-03 §4.A)

**Status:** PLAN ONLY — no code changed by this document.
**Spec sources:** `03_NEVERWINTER_YARD_LEVEL_SPEC.md` (GDD-03 v1.0). Current build
state: `docs/10_YARD_BUILD_REPORT.md` (Area A + perimeter COMPLETE; Corwin listed
under *Deferred*: "Corwin NPC (guard box interior is dark-set for it)").
**Engine:** Godot 4.7.2, GL Compatibility. Project root = this folder (`.godot/`).

---

## 1. Spec extraction — everything GDD-03 says about Corwin

| # | Requirement | Source |
|---|---|---|
| S1 | "A1 `M_YRD_GUARD_BOX` (2.5,1.5,0) r0 — Corwin's post, shutter open." | §4.A props |
| S2 | "**NPC:** Corvin (guard): home A1; idle: leans, scans lane; blocks nothing (cordon does)." | §4.A NPC |
| S3 | "`M_NPC_GUARD` — Guard Corvin (+ city pair re-use) — 1.8 h — HERO_NPC — A,lane" (HERO_NPC tier = 30–45 k tris) | §5 model list |
| S4 | VO (delivery "flat"): `VO_GRD_001` `Mornin'. Contract folk through the gate, city folk wait — them's the orders, not mine.` · `VO_GRD_002` `Barred till the muster's done. Ye've a yard to be in, friend.` · `VO_GRD_003` `Orders: none leaves muster-less. Sign the dwarf's paper first.` | §9 VO script |
| S5 | `TR_A_LANE` sphere r3 @(0,−4) first-entry → `VO_GRD_001` + journal margin note `STR_J_LANE` | §4.A triggers |
| S6 | `TR_A_DEPART` box x±3, y −1..1: if !signed → `VO_GRD_003` + beacon snap to E | §4.A triggers |
| S7 | `TR_A_CITYGATE` @(0,−54) → guards cross arms anim (`VO_GRD_002` context = city-gate guard **pair** at A9 (±1.2,−58), i.e. the §5 "city pair re-use") | §4.A / §2 |
| S8 | "gate portcullis half-lowered until T11 (Corwin lifts it at departure)" | §2 boundary logic |
| S9 | `T_YRD_CLOTH_TABARD` set, 1 K — "NPC tabards (Guard blue, trainee grey)" | §6 textures |
| S10 | VO mix: duck bed −6 dB during lines; every line fires exactly once per intended trigger | §7 mix notes / §12 QA item 14 |

**Naming note:** the spec is internally inconsistent — §2 and §4.A prop A1 spell
**Corwin**; the §4.A NPC line, §5 and §9 spell **Corvin**. The build report already
uses *Corwin*. **Decision D0:** canonical node/asset name `Corwin`; the VO ids stay
`VO_GRD_*` exactly as specced.

**Coordinate frame** (per `tools/scene/build_test_yard.py` header): spec +X east =
Godot +X; spec +Y north = Godot +Z; spec +Z up = Godot +Y. So A1 (2.5, 1.5, 0) →
Godot (2.5, 0, 1.5) — exactly the existing `GuardBox` placement.

---

## 2. Current-state audit (what already exists)

1. **Guard box A1 is built** (`Level/GuardBox`, `tf(ROT180, 2.5, 0, 1.5)`); interior
   carries `DarkMat` explicitly "no NPC yet"; world AABB x 1.8..3.2, y 0..2.4,
   z 0.50..2.2; open shutter faces the gate (−Z). Interior floor slab top at
   **world y = 0.16**; clear interior x −0.54..0.54 / z −0.54..0.54 local
   (≈ x 1.96..3.04, z 0.96..2.04 world); window opening local y 0.75..1.85
   (world y ≈ 0.91..2.01).
2. **The yard scene is generated, not hand-edited:**
   `tools/scene/build_test_yard.py` regenerates `scenes/world/test_yard.tscn`
   byte-for-byte. **Every scene change must go through that script.**
3. **Character pipeline precedent:** the Player (`scenes/actors/player.tscn` +
   `scripts/world/player.gd`) is the CC0 Quaternius *Superhero_Male_FullBody* body
   driven at runtime by the CC0 UAL clip library
   (`res://assets/characters/universal/UAL1_Standard.glb`, 43 clips; Godot's glTF
   import trims `_Loop` suffixes, so clips are stored as `Idle`, `Idle_Talking`,
   `Walk`, …). Per GDD-04 Addendum R13 this CC0 rig family is the adopted character
   pipeline (zero-retargeting). The rig exposes `Head`, `neck_01`, `spine_01..03`,
   `root` bones → procedural posing (lean/head-scan) is possible via `Skeleton3D`.
4. **Corwin's VO already exists, committed but not imported:**
   `assets/audio/vo_grd_001.ogg` (≈6.96 s), `vo_grd_002.ogg` (≈4.36 s),
   `vo_grd_003.ogg` (≈5.52 s), all 24 kHz OGG. They have **no `.import` sidecars**
   yet (only `mus_menu_theme.ogg.import` exists) — Godot has never imported them.
5. **No trigger system exists.** No `Area3D`, no `TR_*` volumes anywhere; the whole
   trigger/logic layer of Area A (`TR_A_ARRIVE/LANE/CITYGATE/DEPART`), audio beds,
   journal and beacons is explicitly *Deferred* in the build report.
6. **QA pipeline:** `tools/qa_yard.gd` (headless, 16 checks, prints
   `QA_YARD_PASS/FAIL`), screenshot scripts in `tests/` (`yard_shot.gd`), smoke
   suite `tests/smoke_test.gd` (11 checks). Godot binary: build headless via
   `tools/rebuild_godot_headless.sh` → `$CACHE/godot-src/bin/godot…` if absent.
7. No changes to `tools/meshes/gltf_lib.py` are needed: Corwin is an animated
   character, and the mesh pipeline (static prop GLBs only) cannot author rigs —
   the existing CC0 body is the correct vehicle at this build stage.

---

## 3. Implementation steps (ordered)

### Step 1 — Import the committed VO (S4)

Run the import pass (Step 9 commands) so Godot generates
`assets/audio/vo_grd_00{1,2,3}.ogg.import` with `loop=false` (VO lines, not beds).
Commit the three sidecars, mirroring the committed `mus_menu_theme.ogg.import`
precedent. No audio files are created or modified — the lines already match the §9
verbatim texts (delivery described as "flat" guard voice).

### Step 2 — NPC scene: `scenes/actors/npc_corwin.tscn` (new file; S2, S3, S9)

Hand-authored `.tscn` following the `player.tscn` precedent (the scene file owns its
own sub-resources; the yard generator only instances it):

```text
Corwin (Node3D)  ← script: res://scripts/world/npc_corwin.gd
├── Visuals (Node3D)
│   └── Hero (instance: res://assets/characters/hero/Superhero_Male_FullBody.gltf)
│       └── <mesh child> · surface_material_override/0 = SubResource("GuardBlueMat")
├── Anim (AnimationPlayer)           # built at runtime from UAL, as in player.gd
└── Voice (AudioStreamPlayer3D)      # pos ≈ (0, 1.65, 0); unit_size/attenuation tuned
                                       for forecourt audibility (~25 m max distance)
```

- **Body (S3):** same `Superhero_Male_FullBody` body as the Player (CC0 placeholder
  per the adopted R13 pipeline; standing height ≈ 1.8 m, matching `M_NPC_GUARD`
  "1.8 h"). Final 30–45 k-tri HERO_NPC art remains an art-pass task — recorded as
  deviation D6, consistent with how the Player was delivered at this stage.
- **Guard blue tabard (S9):** one `StandardMaterial3D` sub-resource
  `GuardBlueMat` (flat guard-blue albedo, e.g. `Color(0.16, 0.24, 0.44)`, roughness
  ≈ 0.9) applied via `surface_material_override/0` on the body mesh child. This
  stands in for `T_YRD_CLOTH_TABARD` "Guard blue" at greybox grade — deviation D7.
  Implementation detail: instantiate the hero GLB once and print its child-node names
  to fix the exact `<mesh child>` node name in the scene file (multi-primitive GLB
  children import as `<MODEL>_p0/…`; single-primitive as `<MODEL>` — same rule QA
  already relies on for props).
- **No physics, no collision shapes (S2 "blocks nothing"):** Corwin is deliberately
  *not* a body of any kind — the player walks through him; the guard-box collision
  (`GuardShape`) already keeps the player outside the box. QA asserts this absence.
- **Voice:** a single `AudioStreamPlayer3D`; the script swaps streams per line.
  Spatialised playback follows the §4.A convention ("VO_GUN_001 spatialised").

### Step 3 — Behaviour script: `scripts/world/npc_corwin.gd` (new file; S2)

GDScript on the root node, modelled on `player.gd`'s UAL-loading pattern:

1. **`_ready()`:** locate the `Skeleton3D` under `Visuals/Hero`; cache bone indices
   for `Head`, `neck_01`, `spine_01..03`. Build the `AnimationPlayer` from the UAL
   library exactly as `player.gd::_build_animations()` does (load
   `UAL1_Standard.glb`, copy the library, add as child of `Hero`), then
   `anim.play("Idle")` (looping). Corwin never changes state — he is a post guard.
2. **"leans" (S2):** UAL ships no lean clip (verified against the 43-clip list).
   Approximation: after the animation step each frame, add a small constant pose
   offset to the cached spine bones (slight lateral tilt + hip shift, e.g. a few
   degrees on `spine_01/02` roll), producing a settled lean on top of the breathing
   idle. **Deviation D8** — documented; a baked lean action can replace it in the
   animation pass without interface change.
3. **"scans lane" (S2):** procedural head sweep aimed at the dock lane south of the
   gate. Bearings computed from Corwin's world position (2.5, 1.5) toward the gate
   centre (0, 0) and down the lane (−Z); the head yaw oscillates ± ≈30° about the
   gate-centre bearing with smooth lerp, randomised dwells (~2–4 s) and an ~8 s
   period. Split the offset ~50/50 across `neck_01` + `Head` so it reads natural.
   All numeric timings are invention (the spec gives no numbers) → collected in
   `const`s at the top of the script for tuning.
4. **`say(line: String) -> bool`:** public API mapping
   `"VO_GRD_001"/"002"/"003"` → the matching `vo_grd_00x.ogg` stream
   (preloaded in `_ready`), played on `Voice`; refuses to overlap an in-flight line.
   Bed-ducking (S10, −6 dB) is **deferred**: no ambience beds or voice bus exist yet
   (Sound autoload is music-only).
5. Nothing else: no movement, no navigation, no interaction, no blocking.

### Step 4 — Scene integration via `tools/scene/build_test_yard.py` (S1, S2)

The generator (not the `.tscn`) gets these edits, keeping the build deterministic:

1. Add ext resource
   `[ext_resource type="PackedScene" path="res://scenes/actors/npc_corwin.tscn" id="41_corwin"]`
   and bump the header `load_steps` 69 → **70** (recount at implementation time; the
   NPC scene encapsulates its own sub-resources, so +1 ext only).
2. Add a new parent + instance after the GuardBox block:
   ```text
   [node name="NPCs" type="Node3D" parent="."]
   [node name="Corwin" parent="NPCs" instance=ExtResource("41_corwin")]
   transform = Transform3D(-1, 0, 0, 0, 1, 0, 0, 0, -1, 2.5, 0.16, 1.5)
   ```
   - **Position:** A1 home, inside the guard box: x/z = box centre; feet at
     **y = 0.16** (interior floor-slab top), not on the yard dirt.
   - **Facing:** the ROT180 basis is the exact precedent of the `Player` instance,
     which the build report verifies "facing the gate" — so Corwin faces the gate
     and the lane beyond (−Z), i.e. out through the open shutter, as S2 requires
     ("scans lane"). Verify empirically with the Step 7 screenshot (empirical-
     behaviour doctrine of the build report).
   - **Fit check (precomputed):** 1.8 m height + 0.16 floor → head top ≈ 1.96 <
     window header 2.01 → fully framed in the window; shoulder width (~0.5 m) <
     1.08 m clear interior; window x ±0.36 gives the visible aperture.
3. Update the file-header docstring block (it enumerates scene contents).

### Step 5 — VO firing: minimal `TR_A_LANE` (S5) — decision required

The full trigger layer is deferred, but `VO_GRD_001`'s owner (Corwin) is exactly
what this task adds, and its trigger is self-contained. **Recommendation: implement
`TR_A_LANE` and nothing else:**

- Generator adds a sphere `Area3D` (r = 3, `SphereShape3D` sub-resource) at Godot
  (0, 1, −4) — spec (0,−4) ground-plane centre, lifted to y ≈ 1 to intersect the
  player capsule (documented assumption).
- `scripts/world/test_yard.gd` (or the NPC script via a signal) connects
  `body_entered` filtered to the Player, **first entry only** (S10: fires exactly
  once) → `Corwin.say("VO_GRD_001")`.
- The journal margin note `STR_J_LANE` (S5) is **deferred** — no journal system or
  `STR_J_LANE` string exists anywhere yet (it is referenced but never defined in
  GDD-03).
- `VO_GRD_002` stays unwired: it belongs to the city-gate pair at (±1.2, −58) on the
  deferred dock lane (S7, R1 scope). `VO_GRD_003` stays unwired: it needs contract-
  signing state + `TR_A_DEPART` + beacons (S6), all deferred. Both remain importable
  assets reachable through the same `say()` API.

**Alternative (smaller scope):** skip Step 5 entirely; Corwin is present and voiced
only via API, and all three lines wait for the trigger layer. This is spec-permitted
only in the weak sense — it leaves S5's one self-contained beat unplayed; flag as
fallback if the reviewer prefers zero trigger code.

### Step 6 — QA extension: `tools/qa_yard.gd`

New checks appended (numbering continues; keep the `QA_YARD_PASS` contract):

1. `NPCs/Corwin` exists; world origin ≈ (2.5, 0.16, 1.5) ± 0.01; inside guard-box
   interior AABB (x 1.96..3.04, z 0.96..2.04).
2. Corwin visual AABB height ≈ 1.8 m ± 0.06 (S3 "1.8 h"), feet at 0.16.
3. **No** `StaticBody3D`/`CharacterBody3D`/`RigidBody3D`/**no `CollisionShape3D`**
   anywhere in Corwin's subtree (S2 "blocks nothing").
4. `AnimationPlayer` present under `Visuals/Hero` with an `Idle` animation; skeleton
   exposes `Head` and `neck_01` bones.
5. `vo_grd_001..003.ogg` each `load()` as `AudioStreamOggVorbis` with lengths
   ≈ 6.96 / 4.36 / 5.52 s ± 0.25 (proves Step 1's import ran).
6. *(if Step 5)* `TR_A_LANE` Area3D exists at (0, −4) with sphere radius 3.
7. Existing counts stay valid: 61 collision shapes (NPC adds zero; an Area3D shape
   is not counted because the counter iterates only the enumerated `Level/*` tags —
   verify this still holds), 47 walls, 2 lantern lights.

### Step 7 — Visual verification

Extend `tests/yard_shot.gd` with one extra capture: camera placed in the forecourt
looking at the guard box (≈ from (0.5, 1.6, −1) toward (2.5, 1.3, 1.5)), saved as
`shots/r3-corwin-guardbox.png`; assert-by-eye that a blue-tinted guard reads inside
the box behind the open shutter, facing the gate. Also re-capture the existing
yard shots to confirm nothing regressed.

### Step 8 — Documentation updates

- `docs/10_YARD_BUILD_REPORT.md`: move "Corwin NPC" from *Deferred* to the
  *Delivered* table (model/placement/behaviour/VO row); add deviations **D6** (CC0
  placeholder body vs `M_NPC_GUARD` HERO_NPC final art), **D7** (flat guard-blue
  tint vs `T_YRD_CLOTH_TABARD` authored set), **D8** (posed-lean approximation —
  no lean clip in UAL), **D9** (only `TR_A_LANE` of the deferred trigger set
  implemented, as VO_GRD_001's owner; `STR_J_LANE` journal note deferred); list
  VO_GRD_002/003 as imported-but-unwired pending their specced triggers.
- `ARCHITECTURE.md` layout table: add `scenes/actors/npc_corwin.tscn` and
  `scripts/world/npc_corwin.gd` rows.
- `THIRD_PARTY.md`: **no new third-party content** (re-uses already-credited UBC +
  UAL) — state that explicitly in the report instead.
- Commit the Godot-generated `.uid` sidecars for the two new files (repo convention:
  every `.gd` has a committed `.gd.uid`).

### Step 9 — Build, import, verify (exact command sequence)

```sh
cd /home/user/DELVE/.godot
python3 tools/meshes/build_all.py          # sanity only — GLBs must be byte-identical
python3 tools/scene/build_test_yard.py     # regenerates test_yard.tscn (now with Corwin)
# Godot binary (only if /home/user/.cache/godot-src/bin is missing):
#   bash tools/rebuild_godot_headless.sh
GD=/home/user/.cache/godot-src/bin/godot.linuxbsd.editor.dev.x86_64
$GD --headless --path . --import           # creates vo_grd_*.ogg.import (+ .uid files)
$GD --headless --path . --script res://tools/qa_yard.gd      # expect QA_YARD_PASS
$GD --headless --path . res://tests/smoke_test.tscn -- --test-mode   # 11 shell checks
$GD --headless --path . res://tests/yard_shot.tscn -- --shots=/tmp/shots
```

Acceptance: `QA_YARD_PASS` with the new checks, smoke 11/11, screenshots show the
guard in the box, and `git status` shows only the files listed in §4.

---

## 4. Files touched (summary)

| File | Action |
|---|---|
| `scenes/actors/npc_corwin.tscn` | **new** — NPC scene (body, guard-blue override, voice) |
| `scripts/world/npc_corwin.gd` (+ `.uid`) | **new** — idle/lean/scan behaviour + `say()` |
| `tools/scene/build_test_yard.py` | **modify** — +1 ext resource, `NPCs/Corwin` instance, `load_steps`, docstring; *(Step 5)* + `TR_A_LANE` Area3D |
| `tools/qa_yard.gd` | **modify** — Corwin checks (Step 6) |
| `tests/yard_shot.gd` | **modify** — one guard-box capture |
| `assets/audio/vo_grd_00{1,2,3}.ogg.import` | **new (generated)** — committed sidecars |
| `docs/10_YARD_BUILD_REPORT.md`, `ARCHITECTURE.md` | **modify** — Step 8 |
| `tools/meshes/*`, all GLBs, all existing textures | **unchanged** |

---

## 5. Deviation register (to fold into the build report)

| ID | Deviation | Why |
|---|---|---|
| D0 | Canonical spelling **Corwin** (spec mixes Corwin/Corvin) | §2 + §4.A-A1 + build report already use Corwin; VO ids unaffected |
| D6 | CC0 Quaternius body stands in for final `M_NPC_GUARD` HERO_NPC art (30–45 k tris) | Adopted R13 character pipeline; same stage-convention as the Player; final mesh = art pass |
| D7 | Flat guard-blue material override stands in for authored `T_YRD_CLOTH_TABARD` (Guard blue) | Greybox stage; keeps the "no procedural texture generation" rule (plain color material, no textures generated) |
| D8 | "Leans" approximated by a constant spine pose offset over UAL `Idle` | UAL contains no lean clip (43-clip list verified); swappable later |
| D9 | Only `TR_A_LANE` implemented of the deferred Area A trigger set; `STR_J_LANE` journal note deferred | VO_GRD_001's owner now exists; journal/beacon/signing systems do not |

## 6. Open questions (recommended answers in bold)

1. **Step 5 scope:** include the minimal `TR_A_LANE` so VO_GRD_001 actually fires,
   or ship Corwin silent until the trigger layer? → **Include it** (self-contained,
   spec-determined, one-shot).
2. **Node placement:** new `NPCs` parent vs under `Level`? → **`NPCs` parent** —
   the city-pair re-use (S7) will want it.
3. **Lean strength / scan period:** no spec values → tune by eye in Step 7; keep as
   named constants.

## 7. Explicitly NOT in this task (still deferred per the build report)

- Dock lane R1 (A5–A10), city gate, and the two **city-pair guards** that re-use
  `M_NPC_GUARD` (S7) — they stand at (±1.2, −58), outside current scope.
- T11 departure: **Corwin lifting the portcullis** (S8), wagon/oxen, `TR_A_DEPART`,
  `VO_GRD_003` firing, beacons, journal (`STR_J_LANE`), UI cards.
- VO bed-ducking (S10), ambience beds, voice/sfx buses.
- Final NPC art, tabard meshes/textures, animation pass (baked lean).

*End of plan — implementation starts only on approval.*

---

## 8. Implementation status (2026-09-22 — IMPLEMENTED)

Shipped as planned (trigger included on user decision), with these recorded
adjustments — all traceable in `docs/10_YARD_BUILD_REPORT.md` D6–D10:

| Plan item | As built |
|---|---|
| Step 1 VO import | `assets/audio/vo_grd_00{1,2,3}.ogg.import` generated by the editor import pass and committed. The supplied OGGs are used as-is (no re-record). |
| Step 2 scene | `scenes/actors/npc_corwin.tscn` — Corwin (Node3D) + Visuals/Hero (Superhero_Male_FullBody.gltf) + Voice (AudioStreamPlayer3D @ y 1.65, unit_size 5, max_distance 25) + `GuardBlueMat` on the body mesh. No physics of any kind (S2). |
| Step 3 behaviour | `scripts/world/npc_corwin.gd` — UAL library copy (player.gd pattern); manual `AnimationMixer` advance + pose offsets (lean 4° forward + 5° settle split 40/60 over spine_01/02; scan ±30° split 50/50 over neck_01/Head, smoothstep turns, seeded 1.8–3.4 s dwells); `say()` with overlap refusal + `Idle_Talking` swap; `_on_lane_body_entered` one-shot for VO_GRD_001. |
| Step 4 integration | generator adds ext `41_corwin` and `NPCs/Corwin` at ROT180 (2.5, 0.16, 1.5); `load_steps` 70 (recounted true: 41 ext + 28 sub + 1 — the old header was off by one). |
| Step 5 trigger | **included** — `TR_A_LANE` Area3D + `SphereShape3D` r3 at (0, 1, −4), scene `[connection]` → `Corwin._on_lane_body_entered`. VO_GRD_002/003 unwired (D9). |
| Step 6 QA | `tools/qa_yard.gd` grows 16 → 41 checks: the planned static checks plus runtime behaviour probes (lean/scan pose diffs on real bones, scan-machine sweep, posed-hand fit inside the box, trigger one-shot + overlap refusal + VO playback, bed duck). |
| Step 7 visuals | `tests/yard_shot.gd` gained r3-01/02/03 (guard-box approach + scan extremes via `debug_set_pose`). This sandbox has no Mesa/Xvfb and its package mirrors are blocked, so windowed captures run on a display machine; `tests/corwin_fit_diagram.py` → `tests/qa_corwin_fit.png` supplies the fit plate here (QA-verified AABBs + mesh accessor bounds). |
| Step 8 docs | this status block; build-report delivered rows + D6–D10; `THIRD_PARTY.md` unchanged (no new third-party content — UBC + UAL re-used). |
| Step 9 build | `tools/rebuild_godot_headless.sh` (Godot 4.7.2-stable source, x11=no as scripted) → `--import` → QA → smoke → shots. |

**Adjustments vs the plan text:**

* **D10 added** — the §7/§12 bed duck (under §7 non-goals above) *is*
  implemented as `Sound.duck_bed()` (−6 dB gain duck on the music player):
  the menu theme is the only bed and plays during gameplay, so un-ducked
  lines would mix wrong. Trivially removable if strict plan scope wins.
* Scan centre = dock-lane target `(0, 0, −6)` rather than the gate mouth
  (plan Q3 tuning; the gate-centre bearing swung the head too far).
* `tests/smoke_test.gd` needed two stale-baseline repairs (pre-existing
  drift after the textured-ground build): the old "flat white Ground"
  checks now read `Terrain3D/DirtGround` authored maps, and the root-node
  budget lines admit the two new root children (`NPCs`, `TR_A_LANE`).
* Behaviour probes step the paused tree explicitly (`bc._process()` and
  physics-frame moves) so the suite is deterministic headless; the duck
  check spins wall-clock (uncapped headless frames have micro-deltas).
* The 4.7.2 mixer constant is `ANIMATION_CALLBACK_MODE_PROCESS_MANUAL`
  (enum `AnimationCallbackModeProcess`) — found by probe after the older
  `CALLBACK_MODE_PROCESS_MANUAL` spelling failed to parse.

**Results:** `tests/TEST_REPORT.md` Round 14 — `QA_YARD_PASS` (41 checks,
0 failures) + `SMOKE_ALL_GREEN` (80 checks, 0 failures).
