# tools/meshes — scripted GLB authoring (GDD-03 yard)

No Blender in the production sandbox, so the GDD-04 plan's scripted,
deterministic, version-controlled asset pipeline is executed directly
in Python (stdlib only — no dependencies).

## Files

* `gltf_lib.py` — minimal glTF-Binary writer (positions/normals/UVs,
  uint16/uint32 indices, bounding-box accessors) plus the mesh
  builders:
  * walls: `wall_full`, `wall_full_start`, `wall_half`, `wall_end`
  * gate: `gatehouse` (12-segment segmental vault), `portcullis`,
    `gate_door_leaf(flip)`
  * props A1–A4: `guard_box`, `notice_board`, `barrel`, `lantern_post`
  * helpers: `Mesh.box/face/band/prism_down/cyl/profile` (flat
    per-face normals, auto-corrected CCW winding, UVs in metres per
    texture tile)
* `build_all.py` — builds all 12 GLBs into `assets/models/`, asserts
  positive signed volume per model (inside-out detection) and writes
  `assets/models/manifest.json` (vertex/triangle counts, per-primitive
  bounds).

## Conventions

* glTF-Binary, glTF 2.0, +Y up, metres, ground pivot.
* **No embedded textures** — GLBs carry no materials; the Godot scene
  assigns `StandardMaterial3D` per primitive via
  `surface_material_override/0` (multi-primitive models import with
  child nodes named `<MODEL>_p0/p1/…`).
* Deterministic: fixed float literals, no RNG — same run, byte-identical
  GLBs.

## Build

```
python3 tools/meshes/build_all.py
```

Then let Godot re-import (`godot --headless --path . --import` or open
the project once) and run the geometry QA:

```
godot --headless --path . --script res://tools/qa_yard.gd
```

`docs/10_YARD_BUILD_REPORT.md` records the full build state, the
empirical glTF-import axis behaviour, and the documented deviations.
