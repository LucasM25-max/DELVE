extends SceneTree
## Headless QA for the GDD-03 yard build (walls, gate, props A1-A4).
## Run: godot --headless --path . --script res://tools/qa_yard.gd
## Prints QA_YARD_PASS / QA_YARD_FAIL; exits 0/1.

var checks := 0
var failures := 0


func aabb_s(a: AABB) -> String:
	return "min=(%.3f,%.3f,%.3f) max=(%.3f,%.3f,%.3f)" % [
		a.position.x, a.position.y, a.position.z,
		a.end.x, a.end.y, a.end.z]


func ck(cond: bool, msg: String) -> void:
	checks += 1
	if not cond:
		failures += 1
		print("FAIL: " + msg)
	else:
		print("ok: " + msg)


func _initialize() -> void:
	main()


func main() -> void:
	# 1) Door GLB structure (multi-primitive naming)
	var door: PackedScene = load("res://assets/models/M_YRD_GATE_DOOR.glb")
	var dn: Node = door.instantiate()
	var p0 := dn.get_node_or_null("M_YRD_GATE_DOOR_p0")
	var p1 := dn.get_node_or_null("M_YRD_GATE_DOOR_p1")
	ck(p0 != null and p1 != null,
		"door GLB instantiates with p0/p1 mesh children")
	dn.free()

	# 2) Prop GLBs instantiate with expected children
	var prop_expect := {
		"M_YRD_GUARD_BOX": ["M_YRD_GUARD_BOX_p0", "M_YRD_GUARD_BOX_p1"],
		"M_YRD_NOTICE_BOARD": ["M_YRD_NOTICE_BOARD_p0", "M_YRD_NOTICE_BOARD_p1"],
		"M_YRD_BARREL": ["M_YRD_BARREL_p0", "M_YRD_BARREL_p1"],
		"M_YRD_LANTERN_POST": ["M_YRD_LANTERN_POST_p0", "M_YRD_LANTERN_POST_p1",
			"M_YRD_LANTERN_POST_p2"],
	}
	var props_ok := true
	for name: String in prop_expect:
		var ps: PackedScene = load("res://assets/models/%s.glb" % name)
		var n: Node = ps.instantiate()
		for child: String in prop_expect[name]:
			if n.get_node_or_null(child) == null:
				props_ok = false
				print("  missing child ", child, " in ", name)
		n.free()
	ck(props_ok, "4 prop GLBs instantiate with expected mesh children")

	# 3) Full yard scene
	var yard: Node = load("res://scenes/world/test_yard.tscn").instantiate()
	root.add_child(yard)
	await process_frame
	ck(true, "yard scene instantiates")

	var walls: Node = yard.get_node("Level/Walls")
	ck(walls.get_child_count() == 47, "47 wall modules present")

	# 5-7) Wall placement spot checks
	var west02: Node3D = walls.get_node("West02")
	var west01: Node3D = walls.get_node("West01")
	var north01: Node3D = walls.get_node("North01")
	var w2a := west02.global_transform * _mesh_aabb(west02)
	ck(is_equal_approx(w2a.position.x, -22.8) and is_equal_approx(w2a.position.z, 0.0)
		and is_equal_approx(w2a.end.z, 4.0) and is_equal_approx(w2a.end.x, -22.0),
		"West02 AABB x -22.8..-22, z 0..4 (got " + aabb_s(w2a) + ")")
	var w1a := west01.global_transform * _mesh_aabb(west01)
	ck(is_equal_approx(w1a.position.x, -22.8) and is_equal_approx(w1a.position.z, -0.8)
		and is_equal_approx(w1a.end.z, 0.0),
		"West01 corner column AABB (got " + aabb_s(w1a) + ")")
	var n1a := north01.global_transform * _mesh_aabb(north01)
	ck(is_equal_approx(n1a.position.z, 44.0) and is_equal_approx(n1a.end.z, 44.8)
		and is_equal_approx(n1a.position.x, -22.0) and is_equal_approx(n1a.end.x, -18.0),
		"North01 AABB x -22..-18, z 44..44.8 (got " + aabb_s(n1a) + ")")

	# 8) Gatehouse straddles the south wall: x -4..4, y 0..5, z -3..0
	var gh: Node3D = yard.get_node("Level/Gatehouse")
	var ghm: Node3D = gh.get_node("Mesh")
	var gha := ghm.global_transform * _mesh_aabb(ghm)
	ck(is_equal_approx(gha.position.x, -4.0) and is_equal_approx(gha.end.x, 4.0)
		and is_equal_approx(gha.position.y, 0.0) and is_equal_approx(gha.end.y, 5.0)
		and is_equal_approx(gha.position.z, -3.0) and is_equal_approx(gha.end.z, 0.0),
		"Gatehouse AABB x -4..4, y 0..5, z -3..0 (got " + aabb_s(gha) + ")")

	# 9) Portcullis raised, 3.56 m wide, mid-passage
	var port: Node3D = yard.get_node("Level/Portcullis")
	var pa := port.global_transform * _mesh_aabb(port.get_node("Mesh"))
	ck(is_equal_approx(pa.position.x, -1.78) and is_equal_approx(pa.end.x, 1.78)
		and is_equal_approx(pa.position.y, 1.0) and is_equal_approx(pa.end.y, 5.0)
		and is_equal_approx(pa.position.z, -1.6) and is_equal_approx(pa.end.z, -1.4),
		"Portcullis AABB x +-1.78, y 1..5, z -1.6..-1.4 (got " + aabb_s(pa) + ")")

	# 10-11) Doors pinned into the passage, 1 cm stand-off from pier faces
	var dl: Node3D = yard.get_node("Level/GateDoorL")
	var dr: Node3D = yard.get_node("Level/GateDoorR")
	var dla := dl.global_transform * _mesh_aabb(dl.get_node("Door"))
	ck(is_equal_approx(dla.position.x, -1.99) and is_equal_approx(dla.end.x, -1.80)
		and is_equal_approx(dla.position.y, 0.0) and is_equal_approx(dla.end.y, 3.4)
		and is_equal_approx(dla.position.z, -2.02) and is_equal_approx(dla.end.z, 0.02),
		"DoorL AABB x -1.99..-1.80, y 0..3.4, z -2.02..0.02 (got " + aabb_s(dla) + ")")
	var dra := dr.global_transform * _mesh_aabb(dr.get_node("Door"))
	ck(is_equal_approx(dra.position.x, 1.80) and is_equal_approx(dra.end.x, 1.99)
		and is_equal_approx(dra.position.z, -2.02) and is_equal_approx(dra.end.z, 0.02),
		"DoorR AABB x 1.80..1.99, z -2.02..0.02 (got " + aabb_s(dra) + ")")

	# 12) Guard box A1 (front faces the gate after the 180 placement).
	# Local extents: x/z +-0.70 (pyramidal cap), z +0.9897 (open shutter
	# tip = 0.60 + 0.45 * 0.866 + 0.02 * 0.5 outer face), y 0..2.4.
	var gb: Node3D = yard.get_node("Level/GuardBox")
	var gba := gb.global_transform * _mesh_aabb(gb)
	ck(is_equal_approx(gba.position.x, 1.8) and is_equal_approx(gba.end.x, 3.2)
		and is_equal_approx(gba.position.y, 0.0) and is_equal_approx(gba.end.y, 2.4)
		and is_equal_approx(gba.position.z, 1.5 - (0.60 + 0.45 * 0.866 + 0.01))
		and is_equal_approx(gba.end.z, 2.2),
		"GuardBox AABB x 1.8..3.2, y 0..2.4, z 0.50..2.2 (got " + aabb_s(gba) + ")")

	# 13) Notice board A2 (parchment faces the gate). Local extents:
	# x +-0.74 (roof overhang), z +-0.26 (roof), y 0..1.80.
	var nb: Node3D = yard.get_node("Level/NoticeBoard")
	var nba := nb.global_transform * _mesh_aabb(nb)
	ck(is_equal_approx(nba.position.x, -3.24) and is_equal_approx(nba.end.x, -1.76)
		and is_equal_approx(nba.position.y, 0.0) and is_equal_approx(nba.end.y, 1.8)
		and is_equal_approx(nba.position.z, 1.24) and is_equal_approx(nba.end.z, 1.76),
		"NoticeBoard AABB x -3.24..-1.76, y 0..1.8, z 1.24..1.76 (got " + aabb_s(nba) + ")")

	# 14) Barrels A3 (world extent = 0.312 * (cos + sin) of the yaw:
	# Godot rotates the tight local AABB conservatively)
	var e15 := 0.312 * (cos(deg_to_rad(15.0)) + sin(deg_to_rad(15.0)))
	var e40 := 0.312 * (cos(deg_to_rad(40.0)) + sin(deg_to_rad(40.0)))
	var ba: Node3D = yard.get_node("Level/BarrelA")
	var ba_aabb := ba.global_transform * _mesh_aabb(ba)
	ck(is_equal_approx(ba_aabb.position.x, 3.4 - e15)
		and is_equal_approx(ba_aabb.end.x, 3.4 + e15)
		and is_equal_approx(ba_aabb.position.y, 0.0)
		and is_equal_approx(ba_aabb.end.y, 0.9)
		and is_equal_approx(ba_aabb.position.z, 2.2 - e15)
		and is_equal_approx(ba_aabb.end.z, 2.2 + e15),
		"BarrelA AABB (got " + aabb_s(ba_aabb) + ")")
	var bb: Node3D = yard.get_node("Level/BarrelB")
	var bb_aabb := bb.global_transform * _mesh_aabb(bb)
	ck(is_equal_approx(bb_aabb.position.x, 3.6 - e40)
		and is_equal_approx(bb_aabb.position.z, 2.9 - e40)
		and is_equal_approx(bb_aabb.end.y, 0.9),
		"BarrelB AABB (got " + aabb_s(bb_aabb) + ")")

	# 15) Lantern posts A4 (cap base +-0.13, apex y 2.6)
	var le: Node3D = yard.get_node("Level/LanternE")
	var le_aabb := le.global_transform * _mesh_aabb(le)
	ck(is_equal_approx(le_aabb.position.x, 3.07) and is_equal_approx(le_aabb.end.x, 3.33)
		and is_equal_approx(le_aabb.position.y, 0.0)
		and is_equal_approx(le_aabb.end.y, 2.6)
		and is_equal_approx(le_aabb.position.z, 0.67)
		and is_equal_approx(le_aabb.end.z, 0.93),
		"LanternE AABB (got " + aabb_s(le_aabb) + ")")
	var lw: Node3D = yard.get_node("Level/LanternW")
	var lw_aabb := lw.global_transform * _mesh_aabb(lw)
	ck(is_equal_approx(lw_aabb.position.x, -3.33) and is_equal_approx(lw_aabb.end.x, -3.07)
		and is_equal_approx(lw_aabb.end.y, 2.6),
		"LanternW AABB (got " + aabb_s(lw_aabb) + ")")

	# 16) Materials, collisions, spawn
	var mat_checks := {
		"Level/Walls/West02/M_YRD_WALL_STONE": "wall stone",
		"Level/GateDoorL/Door/M_YRD_GATE_DOOR_p0": "door oak",
		"Level/GateDoorR/Door/M_YRD_GATE_DOOR_R_p1": "door R iron",
		"Level/GuardBox/Mesh/M_YRD_GUARD_BOX_p0": "guard box pine",
		"Level/NoticeBoard/Mesh/M_YRD_NOTICE_BOARD_p1": "board parchment",
		"Level/BarrelA/Mesh/M_YRD_BARREL_p0": "barrel oak",
		"Level/LanternE/Mesh/M_YRD_LANTERN_POST_p2": "lantern glow",
	}
	var mats_ok := true
	for path: String in mat_checks:
		var mi: MeshInstance3D = yard.get_node(path) as MeshInstance3D
		var m = mi.get_active_material(0) if mi != null else null
		if m == null:
			mats_ok = false
			print("  material MISSING: ", mat_checks[path], " (", path, ")")
	ck(mats_ok, "all 7 spot-checked materials applied")

	var ccount := 0
	for n in walls.get_children():
		if n.get_node_or_null("Collision") != null:
			ccount += 1
	for tag: String in ["Gatehouse", "Portcullis", "GateDoorL", "GateDoorR",
			"GuardBox", "NoticeBoard", "BarrelA", "BarrelB"]:
		for c in yard.get_node("Level/" + tag).get_children():
			if c is CollisionShape3D:
				ccount += 1
	for tag: String in ["LanternE", "LanternW"]:
		for c in yard.get_node("Level/" + tag).get_children():
			if c is CollisionShape3D:
				ccount += 1
	ck(ccount == 61, "61 collision shapes (47 walls + 6 gate + 8 props), got %d" % ccount)

	var lights := 0
	for tag: String in ["LanternE", "LanternW"]:
		var l: Node = yard.get_node("Level/%s/LanternLight" % tag)
		if l is OmniLight3D:
			lights += 1
	ck(lights == 2, "2 lantern practicals (L_A_LANTERN 2400 K)")

	var player: Node3D = yard.get_node("Player")
	ck(absf(player.position.z - 5.0) < 0.01 and absf(player.position.x) < 0.01,
		"player spawn at (0, 0.5, 5) in the forecourt")

	yard.queue_free()
	print("checks run: %d, failures: %d" % [checks, failures])
	print("QA_YARD_" + ("PASS" if failures == 0 else "FAIL"))
	quit(0 if failures == 0 else 1)


func _mesh_aabb(n: Node) -> AABB:
	var out := AABB()
	for d in _descendant_meshes(n):
		var mi := d as MeshInstance3D
		if mi == null or mi.mesh == null:
			continue
		var local := mi.transform * mi.mesh.get_aabb()
		if out.get_volume() == 0.0:
			out = local
		else:
			out = out.merge(local)
	return out


func _descendant_meshes(n: Node) -> Array:
	var res: Array = []
	for c in n.get_children():
		res.append(c)
		for sub in _descendant_meshes(c):
			res.append(sub)
	return res
