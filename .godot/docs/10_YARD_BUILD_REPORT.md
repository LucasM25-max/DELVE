# 10 — YARD BUILD REPORT (GDD-03, Area A + perimeter)

**Status: COMPLETE & QA-verified** (headless `QA_YARD_PASS`, 16 checks;
smoke test 11/11). Scope: yard walls, gatehouse, portcullis, gate
doors, and props A1–A4 of `03_NEVERWINTER_YARD_LEVEL_SPEC.md` §4.A.
Explicitly out of scope per user direction: NPCs (Corwin et al.), the
dock lane (R1: A5–A10, city gate, lane props), and anything outside the
walls.

## What was built

| Element | Spec | Delivered |
|---|---|---|
| Perimeter walls | 44 × 44 m interior, 4.2 m stone wall, crenel walk | 47 modules (10 S, 11 N, 13 W, 13 E) from 4 GLBs; 47 collision shapes |
| Gatehouse | 8 × 3 × 5 m arch block, 4 m × 4 m passage + segmental vault, straddling south wall at x −4..4 | 92-tri GLB, 12-segment vault soffit; instance rot 180° → world z −3..0, threshold at z=0 |
| Portcullis | raised (day state), iron | 11 bars / 4 rails, 3.56 m wide, y 1..5, z −1.6..−1.4 (D1) |
| Gate doors | oak leaves pinned open, 2 × 0.15 × 3.4 | both leaves into the passage, 1 cm stand-off (D2), bands toward centre; wood + iron bands |
| A1 guard box | 1.2 × 1.2 × 2.4, Corwin's post, shutter open | 176 tris; open shutter, dark interior (no NPC yet), step; front faces gate (D3) |
| A2 notice board | 1.4 × 0.1 × 1.8, readable | 58 tris; parchment face with legible-look muster writing + wax seal; faces gate (D3) |
| A3 barrels ×2 | 0.6⌀ × 0.9 @ (3.4,2.2)/(3.6,2.9) r15/40 | 240 tris each; bulged 16-stave body, 3 iron hoops (D5) |
| A4 lanterns ×2 | 0.2⌀ × 2.6 @ (±3.2,0.8), 2400 K practicals | 120 tris each; iron post, bronze fittings, emissive glass insert + `OmniLight3D` (1, 0.588, 0.314) E3 D7 |
| Textures | 1 K sets per GDD-03 §6 | 10 authored raster PBR PNGs (barrel oak, crate pine, bronze sets + parchment albedo); 4 authored ground PNGs (cobble and packed dirt); 9 wall-era PNGs unchanged |
| Player | spawn at forecourt after T0 fade | (0, 0.5, 5) facing the gate |

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
  `scenes/world/test_yard.tscn` byte-for-byte (load_steps 69: 40 ext +
  28 sub resources; 206 node blocks; 61 collision shapes; 2 lights).
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

## Deferred (explicit user scope, not defects)

* Corwin NPC (guard box interior is dark-set for it) and all R1 dock
  lane content (A5 crate stacks, A6 rope coils, A7 gull posts, A8
  barrel row, A9 city gate + guard pair, A10 rope cordon).
* Trigger/logic layer for Area A (`TR_A_ARRIVE`, `TR_A_LANE`,
  `TR_A_CITYGATE`, `TR_A_DEPART`), audio/VFX beds, the `UI_A_*` cards
  (the board parchment is the visual placeholder for `UI_A_BOARD`).
* Remaining area-specific texture variants from GDD-03 §6 (worn dock cobble,
  sand-circle and decal families) are still deferred; the training-yard floor
  itself is now split into a 14 × 6 m forecourt cobble and a 44 × 38 m packed-
  dirt interior. The scene includes a Terrain3D-by-Tokisan source-map adapter
  and portable raster-mesh fallback when the desktop GDExtension is unavailable.
