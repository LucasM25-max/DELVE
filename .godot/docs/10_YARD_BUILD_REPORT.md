# 10 — YARD BUILD REPORT (GDD-03, Area A + perimeter)

**Status: COMPLETE & QA-verified** (headless `QA_YARD_PASS`, 16 checks;
smoke test 11/11) — extended 2026-09-22 with the Corwin guard NPC and a
minimal `TR_A_LANE` per `docs/11_CORWIN_GUARD_NPC_IMPLEMENTATION_PLAN.md`
(headless `QA_YARD_PASS`, 41 checks; smoke 80/80 all-green). Scope: yard walls,
gatehouse, portcullis, gate doors, props A1–A4, and Corwin at A1 of
`03_NEVERWINTER_YARD_LEVEL_SPEC.md` §4.A. Explicitly out of scope per
user direction: the dock lane (R1: A5–A10, city gate, lane props) and
anything outside the walls.

## What was built

| Element | Spec | Delivered |
|---|---|---|
| Perimeter walls | 44 × 44 m interior, 4.2 m stone wall, crenel walk | 47 modules (10 S, 11 N, 13 W, 13 E) from 4 GLBs; 47 collision shapes |
| Gatehouse | 8 × 3 × 5 m arch block, 4 m × 4 m passage + segmental vault, straddling south wall at x −4..4 | 92-tri GLB, 12-segment vault soffit; instance rot 180° → world z −3..0, threshold at z=0 |
| Portcullis | raised (day state), iron | 11 bars / 4 rails, 3.56 m wide, y 1..5, z −1.6..−1.4 (D1) |
| Gate doors | oak leaves pinned open, 2 × 0.15 × 3.4 | both leaves into the passage, 1 cm stand-off (D2), bands toward centre; wood + iron bands |
| A1 guard box | 1.2 × 1.2 × 2.4, Corwin's post, shutter open | 176 tris; open shutter, dark interior, step; front faces gate (D3); Corwin posted inside (docs/11) |
| A2 notice board | 1.4 × 0.1 × 1.8, readable | 58 tris; parchment face with legible-look muster writing + wax seal; faces gate (D3) |
| A3 barrels ×2 | 0.6⌀ × 0.9 @ (3.4,2.2)/(3.6,2.9) r15/40 | 240 tris each; bulged 16-stave body, 3 iron hoops (D5) |
| A4 lanterns ×2 | 0.2⌀ × 2.6 @ (±3.2,0.8), 2400 K practicals | 120 tris each; iron post, bronze fittings, emissive glass insert + `OmniLight3D` (1, 0.588, 0.314) E3 D7 |
| Textures | 1 K sets per GDD-03 §6 | 10 authored raster PBR PNGs (barrel oak, crate pine, bronze sets + parchment albedo); 4 authored ground PNGs (cobble and packed dirt); 9 wall-era PNGs unchanged |
| Player | spawn at forecourt after T0 fade | (0, 0.5, 5) facing the gate |
| A1 Corwin NPC | guard: home A1; idle: leans, scans lane; blocks nothing | CC0 Quaternius body + UAL Idle (R13 pipeline), 1.82 m, guard-blue tint (D7), at (2.5, 0.16, 1.5) ROT180; procedural lean (D8) + lane scan; spatialised Voice with VO_GRD_001..003 (001 wired, see D9) |
| TR_A_LANE | sphere r3 @(0,−4): first entry → VO_GRD_001 + `STR_J_LANE` | Area3D at Godot (0, 1, −4), one-shot `Corwin.say("VO_GRD_001")`; journal note deferred (D9) |

All 12 GLBs: `assets/models/` (manifest.json authoritative).
All 25 textures: `assets/textures/` (T_YRD_*).

## Pipeline

* **Meshes** — `tools/meshes/gltf_lib.py` (builders + minimal GLB
  writer, stdlib only) → `tools/meshes/build_all.py` → 12 deterministic
  GLBs + manifest; signed-volume winding assertion per model.
* **Textures** — all materials use committed raster image maps. Prop sets: barrel oak
  (4 staves/tile), crate pine (weathered planks, plain per spec), bronze
  (patina + wear), parchment (aged paper, faint writing, seal). Ground maps
  include authored cobble and packed dirt albedo, normal, and roughness images.
  No runtime or build-time procedural texture generator remains in the project.
* **Scene** — `tools/scene/build_test_yard.py` regenerates
  `scenes/world/test_yard.tscn` byte-for-byte (load_steps 70: 41 ext +
  28 sub resources; 214 node blocks; 61 prop/wall collision shapes;
  2 lights).
* **QA** — `tools/qa_yard.gd` (headless, 16 checks): import structure,
  47 walls, gate AABBs (gatehouse/portcullis/doors), all prop AABBs,
  7 material overrides, collision count, lantern lights, spawn.
  `tests/smoke_test.gd` — shell/boot flow 11 checks.

## Empirical Godot behaviours relied on

1. **glTF import is axis-identity** (no Z flip) — verified against the
   door leaves and gatehouse world AABBs. Consequence: the gatehouse
   instance carries a ROT180 basis; door instances EAST/WEST.
2. `.tscn` `Transform3D` rows are row-major 9 floats
   (bx.x, by.x, bz.x, bx.y, by.y, bz.y, bx.z, by.z, bz.z, ox, oy, oz);
   EAST = (0,0,1, 0,1,0, −1,0,0), WEST = (0,0,−1, 0,1,0, 1,0,0),
   ROT180 = (−1,0,0, 0,1,0, 0,0,−1) — all verified by basis math and
   world-AABB QA.
3. `surface_material_override/0` must be set on the imported child
   mesh nodes (e.g. `M_YRD_GATE_DOOR_p0`), not the instance root.
4. Every `[node …]` tag line must be fully terminated — an unterminated
   tag yields an opaque `Parse Error @ _parse_node_tag`.

## Verified geometry (world AABBs, from QA)

* Gatehouse: x −4..4, y 0..5, z −3..0
* Portcullis: x −1.78..1.78, y 1..5, z −1.6..−1.4
* DoorL: x −1.99..−1.80, y 0..3.4, z −2.02..0.02 · DoorR mirrored
* GuardBox: x 1.8..3.2, y 0..2.4, z 0.51..2.2 (shutter tip)
* NoticeBoard: x −3.24..−1.76, y 0..1.8, z 1.24..1.76
* BarrelA: (3.4, 2.2) ±0.312, y 0..0.9 · BarrelB: (3.6, 2.9) ±0.312
* LanternE: x 3.07..3.33, y 0..2.6, z 0.67..0.93 · LanternW mirrored

## Documented deviations

* **D1** Portcullis 3.56 m vs 4 m spec — clears the two pinned 2 m
  door leaves (a 4 m grid would interpenetrate them); reads as the
  gate-slot frame line.
* **D2** Door leaves 1 cm stand-off from pier faces (z-fight
  avoidance; visually flush).
* **D3** Guard box & notice board placed rot 180° vs spec r0 so the
  open shutter and the readable parchment face the gate/arriving
  player.
* **D4** Raised portcullis top (y 5.0) meets the vault soffit (4.26 m
  at x ±1.78) near the edges — consequence of the confirmed raised
  state in the 4 m vaulted passage.
* **D5** Barrel "0.6⌀" read as 0.6 m diameter.
* **D6** `M_NPC_GUARD` (HERO_NPC tier final art) stands as the CC0
  Quaternius Superhero Male body at this stage — same convention as the
  Player (Addendum R13 pipeline); measured 1.82 m via mesh accessor,
  matching "1.8 h". Final mesh = art pass. **No new third-party content**:
  the already-credited UBC body + UAL clips are re-used.
* **D7** Flat guard-blue `StandardMaterial3D` (Color(0.16, 0.24, 0.44),
  roughness 0.9) stands in for `T_YRD_CLOTH_TABARD` (Guard blue); plain
  color material — no procedural texture generation.
* **D8** "leans" = constant spine pose offset (4° forward, 5° settle) over
  the UAL Idle — UAL ships no lean clip; swappable for a baked action later.
* **D9** Only `TR_A_LANE` of the Area A trigger set ships with the Corwin
  milestone (its owner now exists). `STR_J_LANE` has no defined string in
  GDD-03 and stays out; `VO_GRD_002/003` are imported and playable via
  `Corwin.say()` but unwired (city-gate pair and TR_A_DEPART/signing state
  are deferred). Trigger sphere centre lifted to Godot y=1 to meet the
  player capsule.
* **D10** VO bed duck (−6 dB during lines, GDD-03 §7/§12) implemented as a
  gain duck on the menu-music player (`Sound.duck_bed`) — beyond the
  docs/11 deferral list so the lines mix over the only existing bed.

## Deferred (explicit user scope, not defects)

* All R1 dock lane content (A5 crate stacks, A6 rope coils, A7 gull
  posts, A8 barrel row, A9 city gate + guard pair, A10 rope cordon).
  *Corwin at A1 is delivered (docs/11); the R1 city-gate guard pair that
  re-uses `M_NPC_GUARD` is not.*
* Remaining trigger/logic layer for Area A (`TR_A_ARRIVE`,
  `TR_A_CITYGATE`, `TR_A_DEPART`), audio/VFX beds, the `UI_A_*` cards
  (the board parchment is the visual placeholder for `UI_A_BOARD`).
  *`TR_A_LANE` ships minimal (VO_GRD_001 one-shot) with the Corwin
  milestone — see D9.*
* Remaining area-specific texture variants from GDD-03 §6 (worn dock cobble,
  sand-circle and decal families) are still deferred; the training-yard floor
  itself is now split into a 14 × 6 m forecourt cobble and a 44 × 38 m packed-
  dirt interior. The scene includes a Terrain3D-by-Tokisan source-map adapter
  and portable raster-mesh fallback when the desktop GDExtension is unavailable.
