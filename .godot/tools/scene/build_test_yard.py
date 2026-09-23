#!/usr/bin/env python3
"""Build scenes/world/test_yard.tscn — the GDD-03 training yard.

Layout (Godot frame: +X east, +Y up, +Z north; spec Y = Godot Z):
  * Interior 44 x 44 m: x -22..22, z 0..44. Gate threshold at z=0.
  * South wall  centre z=-0.4   (inner face z=0)
  * North wall  centre z=+44.4  (inner face z=44)
  * West wall   centre x=-22.4  (inner face x=-22)
  * East wall   centre x=+22.4  (inner face x=+22)
  * Gatehouse   8 x 3 x 5 m, x -4..4. The GLB is authored with the inner
                (threshold) face at local z=0 and the outer face at
                z=+3 (south); Godot's glTF import is axis-identity, so
                the Mesh instance gets a ROT180 basis -> world z -3..0,
                straddling the south wall line exactly like the pier
                collisions (z -3..0, threshold at z=0, yard side).
  * Portcullis  raised: bottom y=1, top y=5, mid-passage z=-1.5,
                3.56 m wide (inset: the 2 m doors are pinned against
                both pier faces, leaving 3.56 m of clear envelope; see
                docs/10_YARD_BUILD_REPORT.md deviations).
  * Gate doors  oak leaves pinned open 90 deg into the passage
                (dock side, z 0..-2), hinges at x=+-1.99 with a 1 cm
                stand-off from the pier faces; iron bands toward the
                passage centre.
  * Props A1-A4 (GDD-03 §4.A): guard box, notice board, barrels x2,
    lantern posts x2 (each with a 2400 K practical light).
  * Corwin guard NPC (GDD-03 §4.A A1, docs/11): NPCs/Corwin in the guard
    box at (2.5, 0.16, 1.5) ROT180 — feet on the interior floor slab top,
    facing the gate and the lane (scans the lane, leans, blocks nothing).
  * TR_A_LANE Area3D (GDD-03 §4.A S5): sphere r3 at spec (0,-4) ground
    centre, lifted to y=1 to meet the player capsule (docs/11 D9). First
    Player entry -> Corwin.say("VO_GRD_001") once (S10).

Wall modules (GDD-03 §5 M_YRD_WALL_STONE family):
  * FULL  4 m span, merlon at each end        M_YRD_WALL_STONE
  * START 4 m span, span-end faces omitted    M_YRD_WALL_STONE_START
        (buts into the 0.8 m corner columns, whose inner face is
        coplanar with the module end face)
  * HALF  2 m trim, merlon at +x end          M_YRD_WALL_STONE_HALF
        (rotated 180 deg for the east gate abutment)
  * END   0.8 m corner column, full merlon    M_YRD_WALL_STONE_END

Basis rows (Transform3D writes row-major 9 floats: bx.x, by.x, bz.x,
bx.y, by.y, bz.y, bx.z, by.z, bz.z — i.e. axis columns X,Y,Z):
  IDENTITY; ROT180; WEST (local +x -> world +z, local +z -> world -x);
  EAST (local +x -> world -z, local +z -> world +x); YAW15 / YAW40 are
  +Y rotations of 15/40 deg (spec r15/r40).

Deterministic: same input -> byte-identical .tscn.
"""
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # .godot/
OUT = ROOT / "scenes" / "world" / "test_yard.tscn"

MODELS = "res://assets/models"
TEX = "res://assets/textures"

# basis (row-major 9) + origin helpers
IDENTITY = (1, 0, 0, 0, 1, 0, 0, 0, 1)
ROT180 = (-1, 0, 0, 0, 1, 0, 0, 0, -1)
WEST = (0, 0, -1, 0, 1, 0, 1, 0, 0)
EAST = (0, 0, 1, 0, 1, 0, -1, 0, 0)


def yaw(deg: float) -> tuple:
    t = math.radians(deg)
    return (round(math.cos(t), 6), 0.0, round(-math.sin(t), 6),
            0.0, 1.0, 0.0,
            round(math.sin(t), 6), 0.0, round(math.cos(t), 6))


def tf(basis, x, y, z) -> str:
    return "Transform3D(%s, %s)" % (
        ", ".join(repr(float(v)) for v in basis),
        ", ".join(repr(float(v)) for v in (x, y, z)))


class Doc:
    def __init__(self) -> None:
        self.lines: list[str] = []

    def w(self, s: str = "") -> None:
        self.lines.append(s)


def wall_modules() -> list:
    """(tag, model, basis, x, z, collision_size) — 47 modules."""
    out = []
    F, S, H, E = "full", "start", "half", "end"
    # South wall (z = -0.4); 8 m gate gap x -4..4 (South05/06 are the
    # 2 m trim modules abutting the gatehouse at x = +-4)
    south = [(S, -20), (F, -16), (F, -12), (F, -8), (H, -5),
             (H, 5), (F, 8), (F, 12), (F, 16), (S, 20)]
    for i, (kind, x) in enumerate(south, 1):
        basis = ROT180 if (kind == H and x > 0) else IDENTITY
        out.append((f"South{i:02d}", kind, basis, x, -0.4))
    # North wall (z = +44.4), all rotated 180 (outer face north)
    north = [(S, -20)] + [(F, x) for x in range(-16, 17, 4)] + [(S, 20)]
    for i, (kind, x) in enumerate(north, 1):
        out.append((f"North{i:02d}", kind, ROT180, x, 44.4))
    # West wall (x = -22.4), runs z -0.4 .. 44.4
    west = [(E, -0.4)] + [(F, z) for z in range(2, 43, 4)] + [(E, 44.4)]
    for i, (kind, z) in enumerate(west, 1):
        out.append((f"West{i:02d}", kind, WEST, -22.4, z))
    # East wall (x = +22.4)
    east = [(E, -0.4)] + [(F, z) for z in range(2, 43, 4)] + [(E, 44.4)]
    for i, (kind, z) in enumerate(east, 1):
        out.append((f"East{i:02d}", kind, EAST, 22.4, z))
    return out


def build() -> str:
    modules = wall_modules()
    assert len(modules) == 47, f"expected 47 wall modules, got {len(modules)}"

    d = Doc()
    # 43 ext resources (40 base + 2 ground GLBs + Corwin) + 24 sub
    # resources (27 base - Plane/Box ground mesh+shape pairs + LaneShape)
    # + 1 — self-checked against the emitted lines at the end of build().
    d.w('[gd_scene load_steps="68" format=3 uid="uid://delve-testyard-02"]')
    d.w()
    d.w('[ext_resource type="Script" path="res://scripts/world/test_yard.gd" id="1_yard"]')
    d.w('[ext_resource type="PackedScene" path="res://scenes/actors/player.tscn" id="2_player"]')
    d.w('[ext_resource type="Script" path="res://addons/sky_3d/src/Sky3D.gd" id="3_sky3d"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_STONE_WALL_albedo.png" id="4_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_STONE_WALL_normal.png" id="5_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_STONE_WALL_roughness.png" id="6_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_WOOD_OAK_WORN_albedo.png" id="7_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_WOOD_OAK_WORN_normal.png" id="8_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_WOOD_OAK_WORN_roughness.png" id="9_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_METAL_IRON_albedo.png" id="10_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_METAL_IRON_normal.png" id="11_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_METAL_IRON_roughness.png" id="12_tex"]')
    # Authored raster ground maps (no shader/procedural texture generation).
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_COBBLE_albedo.png" id="35_cobble_albedo"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_COBBLE_normal.png" id="36_cobble_normal"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_DIRT_albedo.png" id="37_dirt_albedo"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_DIRT_normal.png" id="38_dirt_normal"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_COBBLE_roughness.png" id="39_cobble_roughness"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_DIRT_roughness.png" id="40_dirt_roughness"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_WALL_STONE.glb" id="13_wall_full"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_WALL_STONE_START.glb" id="14_wall_start"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_WALL_STONE_HALF.glb" id="15_wall_half"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_WALL_STONE_END.glb" id="16_wall_end"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_GATEHOUSE.glb" id="17_gatehouse"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_PORTCULLIS.glb" id="18_portcullis"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_GATE_DOOR.glb" id="19_door_l"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_GATE_DOOR_R.glb" id="20_door_r"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_BARREL_OAK_albedo.png" id="21_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_BARREL_OAK_normal.png" id="22_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_BARREL_OAK_roughness.png" id="23_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_CRATE_PINE_albedo.png" id="24_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_CRATE_PINE_normal.png" id="25_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_CRATE_PINE_roughness.png" id="26_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_METAL_BRONZE_albedo.png" id="27_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_METAL_BRONZE_normal.png" id="28_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_METAL_BRONZE_roughness.png" id="29_tex"]')
    d.w(f'[ext_resource type="Texture2D" path="{TEX}/T_YRD_PARCHMENT_albedo.png" id="30_tex"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_GUARD_BOX.glb" id="31_guard_box"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_NOTICE_BOARD.glb" id="32_notice_board"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_BARREL.glb" id="33_barrel"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_LANTERN_POST.glb" id="34_lantern_post"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_GROUND_YARD.glb" id="41_ground_yard"]')
    d.w(f'[ext_resource type="PackedScene" path="{MODELS}/M_YRD_GROUND_FORECOURT.glb" id="42_ground_forecourt"]')
    d.w('[ext_resource type="PackedScene" path="res://scenes/actors/npc_corwin.tscn" id="43_corwin"]')
    d.w()

    # Terrain3D-ready ground: two displaced heightfield GLBs (0.5 m dirt /
    # 0.25 m cobble grids, world-scale UVs already baked at the GDD-03 §6
    # tile sizes — dirt 4 m, cobble 3 m). Vertex colours carry the macro
    # albedo variation that breaks up the tile repeat; the materials below
    # light-map them with mipmapped anisotropic filtering so the floor
    # stays crisp at grazing dawn angles instead of shimmering or smearing.
    # Collision is baked from these same meshes at runtime (trimesh) in
    # scripts/world/test_yard.gd — see _setup_ground_collision().
    d.w('[sub_resource type="StandardMaterial3D" id="DirtMat"]')
    d.w('vertex_color_use_as_albedo = true')
    d.w('albedo_texture = ExtResource("37_dirt_albedo")')
    d.w('normal_enabled = true')
    d.w('normal_texture = ExtResource("38_dirt_normal")')
    d.w('normal_scale = 1.2')
    d.w('roughness_texture = ExtResource("40_dirt_roughness")')
    d.w('texture_filter = 5')
    d.w()
    d.w('[sub_resource type="StandardMaterial3D" id="CobbleMat"]')
    d.w('vertex_color_use_as_albedo = true')
    d.w('albedo_texture = ExtResource("35_cobble_albedo")')
    d.w('normal_enabled = true')
    d.w('normal_texture = ExtResource("36_cobble_normal")')
    d.w('normal_scale = 1.3')
    d.w('roughness_texture = ExtResource("39_cobble_roughness")')
    d.w('texture_filter = 5')
    d.w()
    # PBR materials — GLBs are material-less (GDD-04); textures 4x2 m stone
    # tile, 1 m wood/iron/prop tiles (UVs are already in tile units)
    d.w('[sub_resource type="StandardMaterial3D" id="StoneMat"]')
    d.w('albedo_texture = ExtResource("4_tex")')
    d.w('normal_enabled = true')
    d.w('normal_texture = ExtResource("5_tex")')
    d.w('roughness_texture = ExtResource("6_tex")')
    d.w()
    d.w('[sub_resource type="StandardMaterial3D" id="OakMat"]')
    d.w('albedo_texture = ExtResource("7_tex")')
    d.w('normal_enabled = true')
    d.w('normal_texture = ExtResource("8_tex")')
    d.w('roughness_texture = ExtResource("9_tex")')
    d.w()
    d.w('[sub_resource type="StandardMaterial3D" id="IronMat"]')
    d.w('albedo_texture = ExtResource("10_tex")')
    d.w('normal_enabled = true')
    d.w('normal_texture = ExtResource("11_tex")')
    d.w('roughness_texture = ExtResource("12_tex")')
    d.w()
    d.w('[sub_resource type="StandardMaterial3D" id="PineMat"]')
    d.w('albedo_texture = ExtResource("24_tex")')
    d.w('normal_enabled = true')
    d.w('normal_texture = ExtResource("25_tex")')
    d.w('roughness_texture = ExtResource("26_tex")')
    d.w()
    d.w('[sub_resource type="StandardMaterial3D" id="BarrelOakMat"]')
    d.w('albedo_texture = ExtResource("21_tex")')
    d.w('normal_enabled = true')
    d.w('normal_texture = ExtResource("22_tex")')
    d.w('roughness_texture = ExtResource("23_tex")')
    d.w()
    d.w('[sub_resource type="StandardMaterial3D" id="ParchmentMat"]')
    d.w('albedo_texture = ExtResource("30_tex")')
    d.w('roughness = 0.95')
    d.w()
    d.w('[sub_resource type="StandardMaterial3D" id="BronzeMat"]')
    d.w('albedo_texture = ExtResource("27_tex")')
    d.w('normal_enabled = true')
    d.w('normal_texture = ExtResource("28_tex")')
    d.w('roughness_texture = ExtResource("29_tex")')
    d.w()
    # Dawn-lit glass insert (A4 "practicals"); untextured emissive
    d.w('[sub_resource type="StandardMaterial3D" id="GlowMat"]')
    d.w('albedo_texture = ExtResource("27_tex")')
    d.w("roughness = 0.4")
    d.w("emission_enabled = true")
    d.w("emission = Color(1, 0.62, 0.35, 1)")
    d.w("emission_energy_multiplier = 4.0")
    d.w()
    # Dark interior of the guard box (no NPC yet)
    d.w('[sub_resource type="StandardMaterial3D" id="DarkMat"]')
    d.w('albedo_texture = ExtResource("10_tex")')
    d.w("roughness = 0.95")
    d.w()
    d.w('[sub_resource type="BoxShape3D" id="WallShapeFull"]')
    d.w("size = Vector3(4, 3, 0.8)")
    d.w()
    d.w('[sub_resource type="BoxShape3D" id="WallShapeHalf"]')
    d.w("size = Vector3(2, 3, 0.8)")
    d.w()
    d.w('[sub_resource type="BoxShape3D" id="WallShapeEnd"]')
    d.w("size = Vector3(0.8, 3, 0.8)")
    d.w()
    d.w('[sub_resource type="BoxShape3D" id="PierShape"]')
    d.w("size = Vector3(2, 5, 3)")
    d.w()
    d.w('[sub_resource type="BoxShape3D" id="SlabShape"]')
    d.w("size = Vector3(4, 1, 3)")
    d.w()
    d.w('[sub_resource type="BoxShape3D" id="PortShape"]')
    d.w("size = Vector3(3.56, 4, 0.2)")
    d.w()
    d.w('[sub_resource type="BoxShape3D" id="DoorShape"]')
    d.w("size = Vector3(2, 3.4, 0.19)")
    d.w()
    d.w('[sub_resource type="BoxShape3D" id="GuardShape"]')
    d.w("size = Vector3(1.2, 2.4, 1.2)")
    d.w()
    d.w('[sub_resource type="BoxShape3D" id="BoardShape"]')
    d.w("size = Vector3(1.4, 1.8, 0.25)")
    d.w()
    d.w('[sub_resource type="CylinderShape3D" id="BarrelShape"]')
    d.w("height = 0.9")
    d.w("radius = 0.318")
    d.w()
    d.w('[sub_resource type="CylinderShape3D" id="PostShape"]')
    d.w("height = 2.1")
    d.w("radius = 0.08")
    d.w()
    d.w('[sub_resource type="BoxShape3D" id="LanternShape"]')
    d.w("size = Vector3(0.26, 0.58, 0.26)")
    d.w()
    d.w('[sub_resource type="SphereShape3D" id="LaneShape"]')
    d.w("radius = 3.0")
    d.w()

    d.w('[node name="TestYard" type="Node3D"]')
    d.w('script = ExtResource("1_yard")')
    d.w()
    d.w('[node name="Sky3D" type="WorldEnvironment" parent="."]')
    d.w('script = ExtResource("3_sky3d")')
    d.w("sky_contribution = 0.75")
    d.w("current_time = 6.5")
    d.w("minutes_per_day = 30.0")
    d.w("clouds_enabled = true")
    d.w("fog_enabled = true")
    d.w("lights_enabled = true")
    d.w("sky_enabled = true")
    d.w("editor_time_enabled = false")
    d.w("game_time_enabled = true")
    d.w()
    # Terrain3D by Tokisan Games is the intended desktop terrain authoring
    # layer. This named adapter keeps the scene portable without the binary
    # addon: Terrain3D can consume these same maps and replace the two
    # heightfield meshes. Both GLBs are authored in world space (identity
    # instance transform) so their rims land exactly on the wall inner
    # faces and the forecourt kerb; CollisionShape3D nodes are filled from
    # the meshes as a trimesh at runtime (_setup_ground_collision).
    d.w('[node name="Terrain3D" type="Node3D" parent="."]')
    d.w('metadata/_terrain3d_provider = "Tokisan Games Terrain3D"')
    d.w('metadata/_terrain3d_albedo_maps = "res://assets/textures/T_YRD_DIRT_albedo.png,res://assets/textures/T_YRD_COBBLE_albedo.png"')
    d.w('metadata/_terrain3d_usage = "natural ground; clipmap source maps"')
    d.w()
    d.w('[node name="DirtGround" type="StaticBody3D" parent="Terrain3D"]')
    d.w()
    d.w('[node name="Ground" parent="Terrain3D/DirtGround" instance=ExtResource("41_ground_yard")]')
    d.w('[node name="M_YRD_GROUND_YARD" parent="Terrain3D/DirtGround/Ground"]')
    d.w('surface_material_override/0 = SubResource("DirtMat")')
    d.w()
    d.w('[node name="Collision" type="CollisionShape3D" parent="Terrain3D/DirtGround"]')
    d.w()
    d.w('[node name="ForecourtCobble" type="StaticBody3D" parent="Terrain3D"]')
    d.w()
    d.w('[node name="Ground" parent="Terrain3D/ForecourtCobble" instance=ExtResource("42_ground_forecourt")]')
    d.w('[node name="M_YRD_GROUND_FORECOURT" parent="Terrain3D/ForecourtCobble/Ground"]')
    d.w('surface_material_override/0 = SubResource("CobbleMat")')
    d.w()
    d.w('[node name="Collision" type="CollisionShape3D" parent="Terrain3D/ForecourtCobble"]')
    d.w()
    d.w('[node name="Art" type="Node3D" parent="."]')
    d.w()
    d.w('[node name="Level" type="Node3D" parent="."]')
    d.w()
    d.w('[node name="Walls" type="StaticBody3D" parent="Level"]')
    d.w()

    shape_for = {"full": "WallShapeFull", "start": "WallShapeFull",
                 "half": "WallShapeHalf", "end": "WallShapeEnd"}
    ext_for = {"full": "13_wall_full", "start": "14_wall_start",
               "half": "15_wall_half", "end": "16_wall_end"}
    # The GLB import yields a Node3D root with the mesh as a child node
    # named after the model (single-primitive scenes only).
    mesh_child = {"full": "M_YRD_WALL_STONE", "start": "M_YRD_WALL_STONE_START",
                  "half": "M_YRD_WALL_STONE_HALF", "end": "M_YRD_WALL_STONE_END"}
    for tag, kind, basis, x, z in modules:
        d.w(f'[node name="{tag}" parent="Level/Walls" instance=ExtResource("{ext_for[kind]}")]')
        d.w(f"transform = {tf(basis, x, 0, z)}")
        d.w()
        d.w(f'[node name="{mesh_child[kind]}" parent="Level/Walls/{tag}"]')
        d.w('surface_material_override/0 = SubResource("StoneMat")')
        d.w()
        d.w(f'[node name="Collision" type="CollisionShape3D" parent="Level/Walls/{tag}"]')
        d.w('transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.5, 0)')
        d.w(f'shape = SubResource("{shape_for[kind]}")')
        d.w()

    # Gatehouse: ROT180 on the Mesh instance flips the authored z 0..3
    # (threshold..dock face) to world z 0..-3, matching the pier/slab
    # collisions (z -3..0).
    d.w('[node name="Gatehouse" type="StaticBody3D" parent="Level"]')
    d.w()
    d.w('[node name="Mesh" parent="Level/Gatehouse" instance=ExtResource("17_gatehouse")]')
    d.w(f"transform = {tf(ROT180, 0, 0, 0)}")
    d.w()
    d.w('[node name="M_YRD_GATEHOUSE" parent="Level/Gatehouse/Mesh"]')
    d.w('surface_material_override/0 = SubResource("StoneMat")')
    d.w()
    for px in (-3, 3):
        d.w(f'[node name="CollisionPier{px}" type="CollisionShape3D" parent="Level/Gatehouse"]')
        d.w(f"transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {px}, 2.5, -1.5)")
        d.w('shape = SubResource("PierShape")')
        d.w()
    d.w('[node name="CollisionSlab" type="CollisionShape3D" parent="Level/Gatehouse"]')
    d.w('transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 4.5, -1.5)')
    d.w('shape = SubResource("SlabShape")')
    d.w()
    d.w('[node name="Portcullis" type="StaticBody3D" parent="Level"]')
    d.w('transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, -1.5)')
    d.w()
    d.w('[node name="Mesh" parent="Level/Portcullis" instance=ExtResource("18_portcullis")]')
    d.w()
    d.w('[node name="M_YRD_PORTCULLIS" parent="Level/Portcullis/Mesh"]')
    d.w('surface_material_override/0 = SubResource("IronMat")')
    d.w()
    d.w('[node name="Collision" type="CollisionShape3D" parent="Level/Portcullis"]')
    d.w('transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0)')
    d.w('shape = SubResource("PortShape")')
    d.w()

    # Gate doors: pinned open 90 deg into the passage (dock side), 1 cm
    # stand-off from the pier faces (no coplanar face, no z-fight); the
    # iron bands face the passage centre. EAST maps the L leaf's local
    # +x to world -z (into the passage) and local +z (bands) to world +x;
    # WEST mirrors it for the R leaf.
    for tag, ext, prefix, basis, ox, cx in ((
            "GateDoorL", "19_door_l", "M_YRD_GATE_DOOR", EAST, -1.99, 1),
            ("GateDoorR", "20_door_r", "M_YRD_GATE_DOOR_R", WEST, 1.99, -1)):
        d.w(f'[node name="{tag}" type="StaticBody3D" parent="Level"]')
        d.w(f"transform = {tf(basis, ox, 0, 0)}")
        d.w()
        d.w(f'[node name="Door" parent="Level/{tag}" instance=ExtResource("{ext}")]')
        d.w()
        d.w(f'[node name="{prefix}_p0" parent="Level/{tag}/Door"]')
        d.w('surface_material_override/0 = SubResource("OakMat")')
        d.w()
        d.w(f'[node name="{prefix}_p1" parent="Level/{tag}/Door"]')
        d.w('surface_material_override/0 = SubResource("IronMat")')
        d.w()
        d.w(f'[node name="Collision" type="CollisionShape3D" parent="Level/{tag}"]')
        d.w(f"transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {cx}, 1.7, 0.095)")
        d.w('shape = SubResource("DoorShape")')
        d.w()

    # ------------------------------------------------------- props A1-A4
    # A1 guard box: Corwin's post, shutter open. Spec r0 would put the
    # opening away from the gate; rotated 180 so the open shutter faces
    # the arriving player (documented deviation).
    d.w('[node name="GuardBox" type="StaticBody3D" parent="Level"]')
    d.w(f"transform = {tf(ROT180, 2.5, 0, 1.5)}")
    d.w()
    d.w('[node name="Mesh" parent="Level/GuardBox" instance=ExtResource("31_guard_box")]')
    d.w()
    d.w('[node name="M_YRD_GUARD_BOX_p0" parent="Level/GuardBox/Mesh"]')
    d.w('surface_material_override/0 = SubResource("PineMat")')
    d.w()
    d.w('[node name="M_YRD_GUARD_BOX_p1" parent="Level/GuardBox/Mesh"]')
    d.w('surface_material_override/0 = SubResource("DarkMat")')
    d.w()
    d.w('[node name="Collision" type="CollisionShape3D" parent="Level/GuardBox"]')
    d.w('transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.2, 0)')
    d.w('shape = SubResource("GuardShape")')
    d.w()
    # A2 notice board: readable muster notices (parchment faces the gate)
    d.w('[node name="NoticeBoard" type="StaticBody3D" parent="Level"]')
    d.w(f"transform = {tf(ROT180, -2.5, 0, 1.5)}")
    d.w()
    d.w('[node name="Mesh" parent="Level/NoticeBoard" instance=ExtResource("32_notice_board")]')
    d.w()
    d.w('[node name="M_YRD_NOTICE_BOARD_p0" parent="Level/NoticeBoard/Mesh"]')
    d.w('surface_material_override/0 = SubResource("PineMat")')
    d.w()
    d.w('[node name="M_YRD_NOTICE_BOARD_p1" parent="Level/NoticeBoard/Mesh"]')
    d.w('surface_material_override/0 = SubResource("ParchmentMat")')
    d.w()
    d.w('[node name="Collision" type="CollisionShape3D" parent="Level/NoticeBoard"]')
    d.w('transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.9, 0)')
    d.w('shape = SubResource("BoardShape")')
    d.w()
    # A3 barrels x2 (set dressing; the 15/40 deg rotations read as
    # casually dropped — the body is radially symmetric)
    for tag, x, z, deg in (("BarrelA", 3.4, 2.2, 15),
                           ("BarrelB", 3.6, 2.9, 40)):
        d.w(f'[node name="{tag}" type="StaticBody3D" parent="Level"]')
        d.w(f"transform = {tf(yaw(deg), x, 0, z)}")
        d.w()
        d.w('[node name="Mesh" parent="Level/%s" instance=ExtResource("33_barrel")]' % tag)
        d.w()
        d.w('[node name="M_YRD_BARREL_p0" parent="Level/%s/Mesh"]' % tag)
        d.w('surface_material_override/0 = SubResource("BarrelOakMat")')
        d.w()
        d.w('[node name="M_YRD_BARREL_p1" parent="Level/%s/Mesh"]' % tag)
        d.w('surface_material_override/0 = SubResource("IronMat")')
        d.w()
        d.w(f'[node name="Collision" type="CollisionShape3D" parent="Level/{tag}"]')
        d.w('transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.45, 0)')
        d.w('shape = SubResource("BarrelShape")')
        d.w()
    # A4 lantern posts x2 with dawn-lit practicals (L_A_LANTERN, 2400 K)
    for tag, x in (("LanternE", 3.2), ("LanternW", -3.2)):
        d.w(f'[node name="{tag}" type="StaticBody3D" parent="Level"]')
        d.w(f"transform = {tf(IDENTITY, x, 0, 0.8)}")
        d.w()
        d.w('[node name="Mesh" parent="Level/%s" instance=ExtResource("34_lantern_post")]' % tag)
        d.w()
        d.w('[node name="M_YRD_LANTERN_POST_p0" parent="Level/%s/Mesh"]' % tag)
        d.w('surface_material_override/0 = SubResource("IronMat")')
        d.w()
        d.w('[node name="M_YRD_LANTERN_POST_p1" parent="Level/%s/Mesh"]' % tag)
        d.w('surface_material_override/0 = SubResource("BronzeMat")')
        d.w()
        d.w('[node name="M_YRD_LANTERN_POST_p2" parent="Level/%s/Mesh"]' % tag)
        d.w('surface_material_override/0 = SubResource("GlowMat")')
        d.w()
        d.w(f'[node name="CollisionPost" type="CollisionShape3D" parent="Level/{tag}"]')
        d.w('transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.05, 0)')
        d.w('shape = SubResource("PostShape")')
        d.w()
        d.w(f'[node name="CollisionLantern" type="CollisionShape3D" parent="Level/{tag}"]')
        d.w('transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2.36, 0)')
        d.w('shape = SubResource("LanternShape")')
        d.w()
        d.w(f'[node name="LanternLight" type="OmniLight3D" parent="Level/{tag}"]')
        d.w('transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2.30, 0)')
        d.w("light_color = Color(1, 0.588, 0.314, 1)")
        d.w("light_energy = 3.0")
        d.w("light_distance = 7.0")
        d.w()

    # Corwin (GDD-03 §4.A A1): home post inside the guard box — feet on the
    # interior floor slab top (y 0.16), ROT180 like the Player (facing the
    # gate/lane), verified visually (docs/11 Steps 4 + 7).
    d.w('[node name="NPCs" type="Node3D" parent="."]')
    d.w()
    d.w('[node name="Corwin" parent="NPCs" instance=ExtResource("43_corwin")]')
    d.w(f"transform = {tf(ROT180, 2.5, 0.16, 1.5)}")
    d.w()
    # TR_A_LANE (GDD-03 §4.A S5): sphere r3 at spec (0,-4), lifted to y=1.
    d.w('[node name="TR_A_LANE" type="Area3D" parent="."]')
    d.w('transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, -4)')
    d.w()
    d.w('[node name="Shape" type="CollisionShape3D" parent="TR_A_LANE"]')
    d.w('shape = SubResource("LaneShape")')
    d.w()
    d.w('[node name="Player" parent="." instance=ExtResource("2_player")]')
    d.w('transform = Transform3D(-1, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0.5, 5)')
    d.w()
    d.w('[connection signal="body_entered" from="TR_A_LANE" to="NPCs/Corwin" method="_on_lane_body_entered"]')

    text = "\n".join(d.lines) + "\n"
    steps = text.count("[ext_resource ") + text.count("[sub_resource ") + 1
    assert f'load_steps="{steps}"' in text, (
        f"gd_scene header load_steps must equal ext+sub+1 = {steps}"
    )
    return text


if __name__ == "__main__":
    OUT.write_text(build())
    print(f"SCENE_BUILD_DONE -> {OUT}")
