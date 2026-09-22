#!/usr/bin/env python3
"""Build the GDD-03 yard wall & gate GLBs (deterministic; run from anywhere).

Outputs into assets/models/ (the Godot project's model directory) and
prints a QA manifest: vertex/triangle counts, bounds (glTF metres, +Y up,
x = east, z = south) and signed-volume winding sanity (positive = outward
front faces).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gltf_lib as G  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]  # .godot/
OUT = ROOT / "assets" / "models"
OUT.mkdir(parents=True, exist_ok=True)


def signed_volume(m: G.Mesh) -> float:
    total = 0.0
    for prim in m.prims:
        for i in range(0, len(prim.indices), 3):
            a = prim.positions[prim.indices[i]]
            b = prim.positions[prim.indices[i + 1]]
            c = prim.positions[prim.indices[i + 2]]
            total += (a[0] * (b[1] * c[2] - b[2] * c[1])
                      - a[1] * (b[0] * c[2] - b[2] * c[0])
                      + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6.0
    return total


def build() -> dict:
    assets = [
        ("M_YRD_WALL_STONE", G.wall_full),
        ("M_YRD_WALL_STONE_START", G.wall_full_start),
        ("M_YRD_WALL_STONE_HALF", G.wall_half),
        ("M_YRD_WALL_STONE_END", G.wall_end),
        ("M_YRD_GATEHOUSE", G.gatehouse),
        ("M_YRD_PORTCULLIS", G.portcullis),
        ("M_YRD_GATE_DOOR", G.gate_door_leaf),
        ("M_YRD_GATE_DOOR_R", lambda: G.gate_door_leaf(flip=True)),
        ("M_YRD_GUARD_BOX", G.guard_box),
        ("M_YRD_NOTICE_BOARD", G.notice_board),
        ("M_YRD_BARREL", G.barrel),
        ("M_YRD_LANTERN_POST", G.lantern_post),
    ]
    manifest = {}
    for name, fn in assets:
        mesh = fn()
        vol = signed_volume(mesh)
        if vol <= 0:
            raise AssertionError(f"{name}: signed volume {vol:.2f} <= 0 — "
                                 f"mesh is inside-out")
        tris = sum(len(p.indices) // 3 for p in mesh.prims)
        verts = sum(len(p.positions) for p in mesh.prims)
        print(f"{name}: {verts} verts, {tris} tris, signed volume {vol:.3f} m^3")
        manifest[name] = G.write_glb(str(OUT / f"{name}.glb"), mesh, name)
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    return manifest


if __name__ == "__main__":
    build()
    print("GLB_BUILD_DONE")
