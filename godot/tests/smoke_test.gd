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
	GameState.set_setting("play.diff", "Tactical")
	GameState.set_setting("cam.reduced", "On")
	shell.sign_contract()
	check(GameState.contracts.size() == 1, "Signing creates a contract")
	check(shell.screen == "loading", "Signing starts real resource loading")
	for frame in 240:
		await get_tree().process_frame
		if shell.screen == "threshold":
			break
	check(shell.screen == "threshold", "Threaded loading reaches threshold")
	check(shell.ready_world is PackedScene, "Optional yard is a loaded PackedScene")
	shell.show_screen("menu")
	check(not shell.menu_buttons[1].disabled, "Continue enabled after signing")
	shell.menu_activate(0)
	check(shell.screen == "new", "New contract warns that an existing ledger exists")
	for screen in ["contract", "ledger", "options", "codex", "credits", "threshold"]:
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
	check(yard.get_node("Blockout").get_child_count() > 30, "Editable blockout geometry exists")
	get_tree().paused = false
	yard.pause_overlay.hide()
	yard.set_process(false) # Headless has no pointer capture; exercise physics independently.
	var player = yard.get_node("Player")
	for frame in 45:
		await get_tree().physics_frame
	check(player.is_on_floor(), "Player settles onto collidable floor")
	var before: Vector3 = player.position
	Input.action_press("move_forward")
	for frame in 30:
		await get_tree().physics_frame
	Input.action_release("move_forward")
	check(player.position.z < before.z - 0.5, "WASD movement advances in 3D")
	player.first_person = true
	player.apply_camera()
	check(player.arm.spring_length == 0 and not player.visuals.visible, "First-person camera hides placeholder")
	player.first_person = false
	player.apply_camera()
	check(player.arm.spring_length > 0 and player.visuals.visible, "Third-person camera restores placeholder")
	yard.queue_free()
	shell.queue_free()
	Sound.music.stop()
	Sound.music.stream = null
	GameState.write_timer.stop()
	DirAccess.remove_absolute(GameState.save_path)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(0.3).timeout
	print("\nDELVE SMOKE TEST: %d checks, %d failures" % [checks, failures])
	get_tree().quit(0 if failures == 0 else 1)
