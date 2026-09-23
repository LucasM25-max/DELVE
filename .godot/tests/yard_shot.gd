extends Node
## Captures the test yard: paused overlay, then running bean on textured
## 3D ground; plus the r3 Corwin captures (guard-box approach + head-scan
## extremes, docs/11 Step 7).
var out_dir := "/tmp/shots"

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="):
			out_dir = a.split("=", 2)[1]
	DirAccess.make_dir_recursive_absolute(out_dir)
	process_mode = Node.PROCESS_MODE_ALWAYS
	call_deferred("run")

func shot(img_name: String) -> void:
	var img := get_viewport().get_texture().get_image()
	if img == null or img.is_empty():
		# Display-less builds (dummy renderer) have no backbuffer to read;
		# captures run for real on a display machine (see tests/TEST_REPORT.md).
		print("SHOT_SKIP (no renderer): " + img_name)
		return
	img.save_png("%s/%s.png" % [out_dir, img_name])
	print("SHOT " + img_name)

func run() -> void:
	var yard = load("res://scenes/world/test_yard.tscn").instantiate()
	add_child(yard)
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	shot("r2-08-yard-paused")

	yard.set_paused(false)
	await get_tree().create_timer(0.4).timeout
	# walk forward a moment so the bean is mid-stride in frame
	Input.action_press("move_forward")
	await get_tree().create_timer(1.2).timeout
	Input.action_release("move_forward")
	shot("r2-09-yard-walk")

	await capture_corwin(yard)

	print("YARD_SHOTS_DONE")
	get_tree().quit(0)

func capture_corwin(yard: Node) -> void:
	var corwin = yard.get_node_or_null("NPCs/Corwin")
	if corwin == null:
		return
	var player_cam: Camera3D = yard.get_node_or_null("Player/CameraPivot/SpringArm3D/Camera3D")
	var cam := Camera3D.new()
	cam.fov = 55.0
	add_child(cam)
	cam.current = true
	# r3-01: approach from the gate mouth — the window frames the guard.
	cam.look_at_from_position(Vector3(0.4, 1.65, -1.6), Vector3(2.5, 1.25, 1.3))
	await get_tree().process_frame
	await get_tree().process_frame
	shot("r3-01-corwin-guardbox")
	# r3-02/03: deterministic scan extremes through the window (debug pose).
	cam.look_at_from_position(Vector3(1.5, 1.55, 0.1), Vector3(2.5, 1.5, 1.3))
	corwin.call("debug_set_pose", -30.0, 4.0)
	await get_tree().process_frame
	await get_tree().process_frame
	shot("r3-02-corwin-scan-left")
	corwin.call("debug_set_pose", 44.0, 4.0)
	await get_tree().process_frame
	await get_tree().process_frame
	shot("r3-03-corwin-scan-right")
	cam.queue_free()
	if player_cam != null:
		player_cam.current = true
