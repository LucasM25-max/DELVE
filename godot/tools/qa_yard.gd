extends SceneTree
## Headless QA for the GDD-03 yard build (walls, gate, props A1-A4) and the
## Corwin guard NPC + TR_A_LANE (docs/11 plan Step 6, incl. behaviour probes).
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

	# 17) 3D ground: displaced heightfield GLBs + runtime trimesh collision
	var dirt_mi := yard.get_node("Terrain3D/DirtGround/Ground/M_YRD_GROUND_YARD") as MeshInstance3D
	var cob_mi := yard.get_node("Terrain3D/ForecourtCobble/Ground/M_YRD_GROUND_FORECOURT") as MeshInstance3D
	ck(dirt_mi != null and dirt_mi.mesh != null and cob_mi != null and cob_mi.mesh != null,
		"ground heightfield meshes present under Terrain3D")
	if dirt_mi and dirt_mi.mesh:
		var da := dirt_mi.mesh.get_aabb()
		ck(absf(da.position.x - (-22.0)) < 0.02 and absf(da.end.x - 22.0) < 0.02
			and absf(da.position.z - 0.0) < 0.02 and absf(da.end.z - 44.0) < 0.02,
			"dirt spans x -22..22, z 0..44 (got " + aabb_s(da) + ")")
		ck(da.end.y - da.position.y > 0.12,
			"dirt is displaced in 3D, not a flat plane (y span %.3f)" % (da.end.y - da.position.y))
		ck(da.position.y >= -0.2 and da.end.y <= 0.2,
			"dirt relief stays within +/-0.2 m (got %.3f..%.3f)" % [da.position.y, da.end.y])
	if cob_mi and cob_mi.mesh:
		var ca := cob_mi.mesh.get_aabb()
		ck(absf(ca.position.x - (-7.0)) < 0.02 and absf(ca.end.x - 7.0) < 0.02
			and absf(ca.position.z - 0.0) < 0.02 and absf(ca.end.z - 6.0) < 0.02,
			"forecourt spans x -7..7, z 0..6 (got " + aabb_s(ca) + ")")
		ck(ca.end.y < 0.1 and ca.position.y > -0.15,
			"forecourt camber + kerb skirts within bounds (got %.3f..%.3f)" % [ca.position.y, ca.end.y])
	for tag: String in ["DirtGround", "ForecourtCobble"]:
		var body := yard.get_node("Terrain3D/" + tag) as StaticBody3D
		var col := body.get_node_or_null("Collision") as CollisionShape3D
		ck(col != null and col.shape is ConcavePolygonShape3D,
			tag + " has baked trimesh collision")
	var dirt_mat := (dirt_mi.get_active_material(0) as StandardMaterial3D) if dirt_mi else null
	var cob_mat := (cob_mi.get_active_material(0) as StandardMaterial3D) if cob_mi else null
	ck(dirt_mat != null and dirt_mat.vertex_color_use_as_albedo
		and dirt_mat.albedo_texture != null and dirt_mat.normal_enabled
		and dirt_mat.texture_filter == BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC,
		"dirt material: tiled maps + vertex tints + aniso mipmaps")
	ck(cob_mat != null and cob_mat.vertex_color_use_as_albedo
		and cob_mat.albedo_texture != null and cob_mat.normal_enabled,
		"cobble material: tiled maps + vertex tints + normals")

	# Corwin guard NPC + TR_A_LANE (GDD-03 §4.A; docs/11 plan Step 6)
	var corwin: Node3D = yard.get_node_or_null("NPCs/Corwin") as Node3D
	ck(corwin != null, "NPCs/Corwin instanced")
	if corwin != null:
		ck(absf(corwin.position.x - 2.5) < 0.01 and absf(corwin.position.y - 0.16) < 0.01
			and absf(corwin.position.z - 1.5) < 0.01,
			"Corwin at A1 home (2.5, 0.16, 1.5), feet on the box floor")
		var ca := _subtree_aabb(corwin)
		# Bind-mesh bounds in Corwin-local space: 1.82 m figure (accessor y
		# -0.01..1.81; T-pose x +-0.93). The horizontal fit is asserted on
		# posed hand bones below (bind width != posed width).
		ck(absf(ca.position.y + 0.01) < 0.06 and absf(ca.end.y - 1.81) < 0.06
			and ca.end.y - ca.position.y > 1.7
			and absf((ca.position.x + ca.end.x) * 0.5) < 0.05
			and absf((ca.position.z + ca.end.z) * 0.5) < 0.08,
			"Corwin ~1.8 m figure (bind mesh bounds) centred at home (got " + aabb_s(ca) + ")")
		ck(corwin.find_children("*", "PhysicsBody3D", true, false).is_empty()
			and corwin.find_children("*", "CollisionShape3D", true, false).is_empty()
			and corwin.find_children("*", "Area3D", true, false).is_empty(),
			"Corwin blocks nothing (no physics, collision or areas)")
		var hero: Node = corwin.get_node_or_null("Visuals/Hero")
		var ual: AnimationPlayer = hero.get_node_or_null("UAL") if hero != null else null
		ck(ual != null and ual.has_animation("Idle") and ual.has_animation("Idle_Talking"),
			"Corwin UAL library bound (Idle + Idle_Talking)")
		var cskel: Skeleton3D = corwin.get_node_or_null("Visuals/Hero/Armature/Skeleton3D") as Skeleton3D
		ck(cskel != null and cskel.get_bone_count() == 65
			and cskel.find_bone("Head") >= 0 and cskel.find_bone("neck_01") >= 0
			and cskel.find_bone("spine_01") >= 0 and cskel.find_bone("spine_02") >= 0,
			"Corwin rig: 65-bone skeleton with Head/neck_01/spine pose bones")
		var voice: AudioStreamPlayer3D = corwin.get_node_or_null("Voice") as AudioStreamPlayer3D
		ck(voice != null and absf(voice.position.y - 1.65) < 0.01 and voice is AudioStreamPlayer3D,
			"Corwin Voice player at mouth height (spatialised)")
		var tinted := false
		for d: Node in _descendant_meshes(corwin):
			var mi := d as MeshInstance3D
			if mi == null:
				continue
			var sm := mi.get_active_material(0) as StandardMaterial3D
			if sm != null and sm.albedo_color.is_equal_approx(Color(0.16, 0.24, 0.44, 1)):
				tinted = true
		ck(tinted, "guard-blue tabard tint on the body mesh (D7)")
	var vo_expect := {"vo_grd_001": 6.96, "vo_grd_002": 4.36, "vo_grd_003": 5.52}
	var vo_ok := true
	for vname: String in vo_expect:
		var vstream = load("res://assets/audio/%s.ogg" % vname)
		if not (vstream is AudioStreamOggVorbis):
			vo_ok = false
			print("  VO not imported: ", vname)
		elif absf(vstream.get_length() - vo_expect[vname]) > 0.25:
			vo_ok = false
			print("  VO wrong length: ", vname, " got ", vstream.get_length())
	ck(vo_ok, "vo_grd_001..003 import as OGG with spec lengths (Step 1)")
	var lane: Area3D = yard.get_node_or_null("TR_A_LANE") as Area3D
	ck(lane != null and lane.monitoring, "TR_A_LANE Area3D present and monitoring")
	if lane != null:
		ck(absf(lane.position.x) < 0.01 and absf(lane.position.y - 1.0) < 0.01
			and absf(lane.position.z + 4.0) < 0.01, "TR_A_LANE at spec (0, 1, -4)")
		var lshape: CollisionShape3D = lane.get_node_or_null("Shape") as CollisionShape3D
		var sphere: SphereShape3D = lshape.shape as SphereShape3D if lshape != null else null
		ck(sphere != null and absf(sphere.radius - 3.0) < 0.01, "TR_A_LANE sphere radius 3 (S5)")
		var wired := false
		for c: Dictionary in lane.get_signal_connection_list("body_entered"):
			var obj: Object = c.callable.get_object()
			if obj == corwin and String(c.callable.get_method()) == "_on_lane_body_entered":
				wired = true
		ck(wired, "TR_A_LANE body_entered -> Corwin._on_lane_body_entered (one-shot)")

	# Runtime behaviour (docs/11 Step 6): pose offsets, scan sweep,
	# one-shot trigger firing, overlap refusal, bed duck (S10 mix).
	if corwin != null and lane != null:
		var bc = corwin  # dynamic: script API on the NPC instance
		var bskel: Skeleton3D = corwin.get_node_or_null("Visuals/Hero/Armature/Skeleton3D") as Skeleton3D
		if bskel != null:
			var b_head := bskel.find_bone("Head")
			var b_spine := bskel.find_bone("spine_02")
			bc.debug_set_pose(0.0)
			var q0: Quaternion = bskel.get_bone_pose_rotation(b_head)
			var s0: Quaternion = bskel.get_bone_pose_rotation(b_spine)
			bc.debug_set_pose(30.0, 4.0)
			var q1: Quaternion = bskel.get_bone_pose_rotation(b_head)
			var s1: Quaternion = bskel.get_bone_pose_rotation(b_spine)
			ck(not q0.is_equal_approx(q1), "head scan pose drives the Head/neck bones")
			ck(not s0.is_equal_approx(s1), "lean pose drives the spine bones (D8)")
		var yaw0: float = bc._scan_yaw
		for i in 20:
			bc._update_scan(0.5)  # 10 s of virtual idle
		ck(absf(bc._scan_yaw - yaw0) > 1.0, "lane scan sweeps the head yaw over time")
		for i in 30:
			bc._process(0.016)  # settle into the UAL idle pose (tree is paused here)
		if bskel != null:
			var hands_ok := true
			for bname in ["hand_l", "hand_r"]:
				var hw: Vector3 = bskel.global_transform * bskel.get_bone_global_pose(bskel.find_bone(bname)).origin
				hands_ok = hands_ok and hw.x > 1.96 and hw.x < 3.04 \
					and hw.z > 0.96 and hw.z < 2.04 and hw.y > 0.16 and hw.y < 2.1
			ck(hands_ok, "posed hands stay inside the guard-box interior")
		paused = false
		yard.set_process(false)  # headless: no pointer capture; keep physics live
		var pbody: Node3D = yard.get_node_or_null("Player") as Node3D
		if pbody != null:
			pbody.global_position = Vector3(0, 0.5, 5)  # south of the lane sphere
			for frame in 5:
				await physics_frame
			pbody.global_position = Vector3(0, 1.0, -4)  # TR_A_LANE centre
			for frame in 10:
				await physics_frame
			ck(bc._lane_said and not bc.say("VO_GRD_002"),
				"TR_A_LANE fires VO_GRD_001 once; say() refuses overlap (S10)")
			var dvoice: AudioStreamPlayer3D = corwin.get_node_or_null("Voice") as AudioStreamPlayer3D
			ck(dvoice != null and dvoice.playing, "VO_GRD_001 is audibly playing on Voice")
			# Autoloads are not compile-time identifiers in a --script context;
			# reach Sound through the tree (duck_bed + duck_db, S10 mix). The
			# say() above already ducked; spin wall-clock (headless frames have
			# micro-deltas) until the tween reaches the -6 dB floor.
			var sound_node: Node = root.get_node_or_null("Sound")
			var t0 := Time.get_ticks_msec()
			while sound_node != null and Time.get_ticks_msec() - t0 < 400 \
				and float(sound_node.get("duck_db")) > -3.0:
				await process_frame
			ck(sound_node != null and float(sound_node.get("duck_db")) < -3.0,
				"VO ducks the music bed toward -6 dB (GDD-03 §7/§12)")

	yard.queue_free()
	print("checks run: %d, failures: %d" % [checks, failures])
	print("QA_YARD_" + ("PASS" if failures == 0 else "FAIL"))
	quit(0 if failures == 0 else 1)


func _subtree_aabb(n: Node3D) -> AABB:
	# Bounds of all descendant meshes in n's local space (any depth — unlike
	# _mesh_aabb this accumulates full global chains, for skinned characters).
	var out := AABB()
	var inv := n.global_transform.affine_inverse()
	for d in _descendant_meshes(n):
		var mi := d as MeshInstance3D
		if mi == null or mi.mesh == null:
			continue
		var local := (inv * mi.global_transform) * mi.mesh.get_aabb()
		out = local if out.get_volume() == 0.0 else out.merge(local)
	return out


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
