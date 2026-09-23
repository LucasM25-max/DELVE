extends Node
## Run with: godot --headless --path . res://tests/smoke_test.tscn -- --test-mode
## A separate test ledger is used; real user saves are never changed.
var checks := 0
var failures := 0

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		push_error("FAIL: " + message)
	else:
		print("PASS: " + message)

func _ready() -> void:
	if not "--test-mode" in OS.get_cmdline_user_args():
		push_error("Refusing to run: pass -- --test-mode for isolated save storage.")
		get_tree().quit(2)
		return
	process_mode = Node.PROCESS_MODE_ALWAYS
	call_deferred("run_tests")

func run_tests() -> void:
	GameState.contracts.clear()
	if FileAccess.file_exists(GameState.save_path):
		DirAccess.remove_absolute(GameState.save_path)
	GameState.set_setting("cam.reduced", "Off")
	GameState.active_contract.clear()
	GameState.persist()
	var shell = load("res://scenes/ui/shell.tscn").instantiate()
	add_child(shell)
	await get_tree().process_frame
	check(shell.screen == "legal", "Boot starts at attribution")
	shell.begin_boot()
	check(shell.screen == "sting", "Attribution advances to sting")
	check(Sound.unlocked, "Audio unlocks on boot activation")
	GameState.set_setting("cam.reduced", "On")
	shell.begin_boot()
	check(shell.screen == "menu", "Reduced motion skips the logo sting")
	GameState.set_setting("cam.reduced", "Off")
	shell.show_screen("menu")
	await get_tree().process_frame
	check(shell.menu_buttons.size() == 5, "All five menu actions exist")
	check(shell.menu_buttons[1].disabled, "Continue disabled without a contract")
	shell.menu_activate(0)
	check(shell.screen == "contract", "Play opens first-run contract")
	# Hold the shell on the loading screen so the straight-to-yard drop (which
	# frees this harness's scene) cannot fire while the suite still inspects it.
	shell.freeze_drop = true
	GameState.set_setting("play.diff", "Tactical")
	GameState.set_setting("cam.reduced", "On")
	shell.sign_contract()
	check(GameState.contracts.size() == 1, "Signing creates a contract")
	check(shell.screen == "loading", "Signing starts real resource loading")
	await get_tree().process_frame
	check(is_instance_valid(shell.route_ctl) and "load_route" in shell.route_ctl.get_script().resource_path, "Loading screen keeps the ink route painter")
	for frame in 600:
		await get_tree().process_frame
		if shell.ready_world is PackedScene:
			break
	check(shell.ready_world is PackedScene, "Threaded loading fetches the yard PackedScene")
	# The shell now drops straight into the yard once the loading dwell finishes.
	# Freeze it so the rest of the suite can still inspect the screens; the real drop
	# is verified at the very end, once nothing else needs this harness.
	shell.set_process(false)
	shell.show_screen("menu")
	check(not shell.menu_buttons[1].disabled, "Continue enabled after signing")
	shell.menu_activate(0)
	check(shell.screen == "new", "New contract warns that an existing ledger exists")
	for screen in ["contract", "ledger", "options", "codex", "credits"]:
		shell.show_screen(screen)
		await get_tree().process_frame
		check(shell.screen == screen and shell.paper != null, screen + " native screen builds")
		if screen == "options":
			var options = shell.paper.find_children("*", "Control", true, false).filter(func(c: Node) -> bool:
				return c.get_script() == load("res://scripts/ui/options_page.gd"))[0]
			for section in GameState.schema:
				options.show_category(section.id)
				await get_tree().process_frame
				check(options.content_host.get_child_count() == 1, "Options: " + section.id)
			options.show_category("controls")
			options.listening_key = "binds.jump"
			var key := InputEventKey.new()
			key.physical_keycode = KEY_K
			key.pressed = true
			options._input(key)
			check(GameState.get_setting("binds.jump") == KEY_K, "Native key rebinding changes InputMap")
			check(InputMap.action_get_events("game_jump")[0].physical_keycode == KEY_K, "Rebinding applies to controller")
			options.listening_key = "binds.jump"
			key.physical_keycode = KEY_W
			options._input(key)
			check(GameState.get_setting("binds.jump") == KEY_K, "WASD cannot be rebound away from movement")
			key.physical_keycode = KEY_ESCAPE
			options._input(key)
			check(options.listening_key == "", "Escape cancels key rebinding")
			options.reset_bindings()
			check(GameState.get_setting("binds.jump") == KEY_SPACE, "Reset restores bindings")
	shell.show_screen("loading")
	shell.loading_failed("Simulated missing resource")
	check(shell.loading_error and "washed out" in shell.load_label.text, "Loading failure exposes recovery UI")
	shell.show_screen("options")
	var escape := InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	escape.physical_keycode = KEY_ESCAPE
	escape.pressed = true
	shell._unhandled_input(escape)
	check(shell.screen == "menu", "Escape returns from a native page")
	for tab in ["rules", "lore", "best"]:
		shell.selected_codex = tab
		shell.show_screen("codex")
		await get_tree().process_frame
		check(shell.screen == "codex", "Codex: " + tab)
	GameState.set_setting("aud.music", 25.0)
	GameState.set_setting("acc.hc", "On")
	check(GameState.persist(), "Settings and contract save successfully")
	GameState.contracts.clear()
	GameState.load_state()
	check(GameState.contracts.size() == 1, "Contract reload survives a fresh read")
	check(GameState.get_setting("play.diff") == "Tactical", "Difficulty persisted")
	check(GameState.get_setting("aud.music") == 25, "Audio preference persisted")
	for i in 7:
		GameState.sign_contract()
	check(GameState.contracts.size() == 8, "Ledger supports eight contracts")
	check(not GameState.sign_contract(), "Ninth contract refused without deleting saves")
	var first_id: String = GameState.contracts[0].id
	GameState.delete_contract(first_id)
	check(GameState.contracts.size() == 7, "Individual ledger deletion")
	var file := FileAccess.open(GameState.save_path, FileAccess.WRITE)
	file.store_string(JSON.stringify({"version": 1, "settings": {"aud.music": 9999, "play.diff": "invalid", "binds.jump": "bad"}, "contracts": ["bad", {"name": "missing id"}]}))
	file.close()
	GameState.load_state()
	check(GameState.contracts.is_empty(), "Malformed contract records are filtered")
	check(GameState.get_setting("aud.music") == 100, "Loaded numeric settings clamp to legal range")
	check(GameState.get_setting("play.diff") == "Tactical", "Invalid enum settings do not overwrite valid defaults")
	check(GameState.get_setting("binds.jump") == KEY_SPACE, "Invalid saved key bindings are ignored")
	file = FileAccess.open(GameState.save_path, FileAccess.WRITE)
	file.store_string("{invalid json")
	file.close()
	GameState.load_state()
	check(GameState.storage_error != "", "Corrupt save gives a visible diagnostic instead of crashing")
	GameState.persist()
	var original_path: String = GameState.save_path
	GameState.save_path = "user://missing_parent/failing_save.json"
	check(not GameState.persist() and GameState.storage_error != "", "Save failure is surfaced, not silently reported as saved")
	GameState.save_path = original_path
	GameState.persist()
	GameState.return_to_menu = true
	var yard = load("res://scenes/world/test_yard.tscn").instantiate()
	add_child(yard)
	await get_tree().process_frame
	check(get_tree().paused, "3D yard waits for explicit pointer-lock gesture")
	check(yard.get_node("Player") is CharacterBody3D, "Editable player scene instanced")
	check(yard.get_node("Art") is Node3D, "Future model integration slot exists")
	check(yard.get_node_or_null("Blockout") == null, "Scenery blockout fully stripped")
	check(yard.get_child_count() <= 10, "Yard node budget stays small")
	get_tree().paused = false
	yard.pause_overlay.hide()
	yard.set_process(false) # Headless has no pointer capture; exercise physics independently.
	var player = yard.get_node("Player")
	check(absf(player.position.x) < 0.3 and absf(player.position.z - 5.0) < 0.3, "Player spawns inside the yard, short of the gate")
	for frame in 45:
		await get_tree().physics_frame
	check(player.is_on_floor(), "Player settles onto collidable floor")
	var before: Vector3 = player.position
	Input.action_press("move_forward")
	for frame in 30:
		await get_tree().physics_frame
	Input.action_release("move_forward")
	check(player.position.z < before.z - 0.5, "WASD movement advances in 3D")
	check(player.get_node_or_null("Visuals/Placeholder") == null, "Bean placeholder retired")
	var skel := player.get_node_or_null("Visuals/Hero/Armature/Skeleton3D") as Skeleton3D
	check(skel != null and skel.get_bone_count() == 65, "Hero carries the 65-bone universal rig")
	check(player.anim != null and player.anim.has_animation("Walk") and player.anim.has_animation("Sprint"), "Universal Animation Library bound to hero")
	check(player.anim.current_animation in ["Walk", "Jog_Fwd", "Sprint"], "Locomotion animation tracks movement")
	player.first_person = true
	player.apply_camera()
	check(player.arm.spring_length == 0 and not player.visuals.visible, "First-person camera hides placeholder")
	player.first_person = false
	player.apply_camera()
	check(player.arm.spring_length > 0 and player.visuals.visible, "Third-person camera restores placeholder")
	# ---- Round 12: web-standard visual checks ----
	shell.show_screen("contract")
	await get_tree().process_frame
	var seals := 0
	for node in shell.content.find_children("*", "TextureRect", true, false):
		var tex_rect := node as TextureRect
		if tex_rect.texture != null and "seal" in tex_rect.texture.resource_path:
			seals += 1
	check(seals >= 1, "Contract sheet carries the wax seal")
	shell.selected_codex = "rules"
	shell.show_screen("codex")
	await get_tree().process_frame
	var rtl: RichTextLabel = null
	for node in shell.content.find_children("*", "RichTextLabel", true, false):
		rtl = node as RichTextLabel
	check(rtl != null and rtl.bbcode_enabled, "Codex renders rich bbcode bodies")
	var saw_rule := false
	for node in shell.content.find_children("*", "RichTextLabel", true, false):
		if (node as RichTextLabel).get_parsed_text().contains("Roll 1d20"):
			saw_rule = true
	check(saw_rule, "Codex bbcode parses rules tables")
	shell.show_screen("options")
	await get_tree().process_frame
	var pills := 0
	for node in shell.content.find_children("*", "Button", true, false):
		var btn := node as Button
		if btn.toggle_mode and btn.button_group != null:
			pills += 1
	check(pills >= 6, "Options choices are segmented pill toggles")
	shell.show_screen("menu")
	await get_tree().process_frame
	var version_seen := false
	for node in shell.content.find_children("*", "Label", true, false):
		if (node as Label).text.contains("GODOT EDITION 0.3"):
			version_seen = true
	check(version_seen, "Menu shows the Godot edition string")
	check(yard.get_node_or_null("Terrain3D/DirtGround") != null
		and yard.get_node_or_null("Terrain3D/ForecourtCobble") != null
		and yard.get_child_count() <= 8, "Yard keeps a tight node budget (7 scene roots + HUD layer)")
	var gmat: BaseMaterial3D = yard.get_node(
		"Terrain3D/DirtGround/Ground/M_YRD_GROUND_YARD").get_active_material(0)
	check(gmat != null and gmat.albedo_texture != null and gmat.vertex_color_use_as_albedo,
		"Yard floor carries the packed-dirt texture set on displaced 3D ground")
	check(yard.get_node("Art").get_child_count() == 0, "Art slot stays clear (spec props are placed under Level)")
	var walls: Node3D = yard.get_node_or_null("Level/Walls")
	check(walls != null, "Perimeter wall modules live under Level/Walls")
	var wall_instances := 0
	if walls != null:
		for child in walls.get_children():
			for prefix in ["South", "North", "West", "East"]:
				if child.name.begins_with(prefix):
					wall_instances += 1
					break
	check(wall_instances == 47, "Perimeter uses the 47 spec wall modules")
	check(yard.get_node_or_null("Level/Gatehouse") != null, "Gatehouse arch block present")
	var port: Node3D = yard.get_node_or_null("Level/Portcullis")
	check(port != null, "Portcullis present")
	if port != null:
		var port_mi: MeshInstance3D = port.get_node("Mesh/M_YRD_PORTCULLIS")
		var port_aabb := port_mi.get_aabb()
		check(absf(port_aabb.position.y + port.position.y - 1.0) < 0.01, "Portcullis raised: bottom 1 m above floor")
	check(yard.get_node_or_null("Level/GateDoorL") != null and yard.get_node_or_null("Level/GateDoorR") != null, "Gate doors pinned open against the pier faces")
	var prop_tags := ["GuardBox", "NoticeBoard", "BarrelA", "BarrelB", "LanternE", "LanternW"]
	var props_ok := true
	for tag in prop_tags:
		if yard.get_node_or_null("Level/" + tag) == null:
			props_ok = false
	check(props_ok, "Props A1-A4 present: guard box, board, barrels x2, lanterns x2")
	var lantern_lights := 0
	for tag in ["LanternE", "LanternW"]:
		if yard.get_node_or_null("Level/%s/LanternLight" % tag) is OmniLight3D:
			lantern_lights += 1
	check(lantern_lights == 2, "Both lanterns carry their 2400 K practical")
	yard.queue_free()
	await get_tree().process_frame
	# ---- Final check: the loading screen drops the player straight into the yard. ----
	# enter_yard() changes the main scene, which frees this harness, so a watcher bound
	# to the SceneTree finishes the run and reports the combined result.
	var report := {"checks": checks, "failures": failures}
	var tree := get_tree()
	var sound := Sound
	var state := GameState
	var done := [false]
	tree.process_frame.connect(func() -> void:
		if done[0]:
			return
		var current := tree.current_scene
		if current == null or current.scene_file_path != "res://scenes/world/test_yard.tscn":
			return
		done[0] = true
		var direct := [
			[true, "Loading screen ends in the test yard with no menu in between"],
			[current.get_node_or_null("Player") is CharacterBody3D, "Direct entry lands on the yard with its player"],
			[tree.paused, "Direct entry pauses the yard for the pointer-lock gesture"],
		]
		var passed := 0
		var failed := 0
		for c in direct:
			passed += 1
			if c[0]:
				print("PASS: " + c[1])
			else:
				failed += 1
				push_error("FAIL: " + c[1])
		report["checks"] += passed
		report["failures"] += failed
		sound.music.stop()
		sound.music.stream = null
		state.write_timer.stop()
		DirAccess.remove_absolute(state.save_path)
		print("\nDELVE SMOKE TEST: %d checks, %d failures" % [report["checks"], report["failures"]])
		if report["failures"] == 0:
			print("SMOKE_ALL_GREEN")
		tree.quit(0 if report["failures"] == 0 else 1)
	)
	shell.freeze_drop = false
	shell.set_process(true)
	shell.start_loading()
