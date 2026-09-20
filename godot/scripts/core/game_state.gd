extends Node
## Shared settings and versioned, local-only contract ledger. No account or backend.
signal setting_changed(key: String, value: Variant)
signal save_failed(message: String)

const SAVE_PATH := "user://delve_v1.json"
const MAX_CONTRACTS := 8
const ACTION_KEYS := {"sprint": KEY_SHIFT, "jump": KEY_SPACE, "interact": KEY_F,
	"view": KEY_V, "folio": KEY_TAB, "journal": KEY_J, "codex": KEY_C,
	"hide": KEY_H, "endturn": KEY_SPACE, "pause": KEY_ESCAPE}
var save_path := "user://delve_test_v1.json" if "--test-mode" in OS.get_cmdline_user_args() else SAVE_PATH
var content: Dictionary = {}
var schema: Array = []
var settings: Dictionary = {}
var contracts: Array = []
var active_contract: Dictionary = {}
var storage_error := ""
var return_to_menu := false
var write_timer: Timer

func _ready() -> void:
	content = JSON.parse_string(FileAccess.get_file_as_string("res://data/shell_content.json"))
	schema = JSON.parse_string(FileAccess.get_file_as_string("res://data/options_schema.json"))
	for group in content.defaults:
		if content.defaults[group] is Dictionary:
			for key in content.defaults[group]:
				settings[group + "." + key] = content.defaults[group][key]
		else:
			settings[group] = content.defaults[group]
	for action in ACTION_KEYS:
		settings["binds." + action] = ACTION_KEYS[action]
	# Ray tracing is deliberately not offered in the Compatibility renderer.
	settings["gfx.rt"] = "Off"
	write_timer = Timer.new()
	write_timer.one_shot = true
	write_timer.wait_time = 0.25
	write_timer.timeout.connect(persist)
	add_child(write_timer)
	load_state()
	install_inputs()
	apply_frame_cap()

func get_setting(key: String) -> Variant:
	return settings.get(key)

func set_setting(key: String, value: Variant) -> void:
	if not settings.has(key):
		return
	settings[key] = value
	if key.begins_with("binds."):
		install_inputs()
	if key == "gfx.fps":
		apply_frame_cap()
	setting_changed.emit(key, value)
	write_timer.start()

func apply_frame_cap() -> void:
	Engine.max_fps = 0 if settings["gfx.fps"] == "Unlocked" else int(settings["gfx.fps"])

func install_inputs() -> void:
	for action in ACTION_KEYS:
		var full: String = "game_" + action
		if not InputMap.has_action(full):
			InputMap.add_action(full)
		InputMap.action_erase_events(full)
		var event := InputEventKey.new()
		event.physical_keycode = int(settings["binds." + action])
		InputMap.action_add_event(full, event)
	for action in {"move_forward": KEY_W, "move_back": KEY_S, "move_left": KEY_A, "move_right": KEY_D}:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
			var event := InputEventKey.new()
			event.physical_keycode = {"move_forward": KEY_W, "move_back": KEY_S, "move_left": KEY_A, "move_right": KEY_D}[action]
			InputMap.action_add_event(action, event)

func sign_contract() -> bool:
	if contracts.size() >= MAX_CONTRACTS:
		return false
	var contract := {"id": str(Time.get_unix_time_from_system()) + "-" + str(randi()), "name": "Recruit",
		"chapter": "Prologue", "created": Time.get_datetime_string_from_system(),
		"difficulty": settings["play.diff"], "pacing": settings["play.combat"]}
	contracts.append(contract)
	active_contract = contract
	return persist()

func delete_contract(id: String) -> void:
	contracts = contracts.filter(func(c: Dictionary) -> bool: return c.id != id)
	if active_contract.get("id") == id:
		active_contract = contracts.back() if not contracts.is_empty() else {}
	persist()

func persist() -> bool:
	var file := FileAccess.open(save_path + ".tmp", FileAccess.WRITE)
	if file == null:
		return fail_save()
	file.store_string(JSON.stringify({"version": 1, "settings": settings, "contracts": contracts}, "\t"))
	file.flush()
	var error := file.get_error()
	file.close()
	if error != OK:
		return fail_save()
	if DirAccess.rename_absolute(save_path + ".tmp", save_path) != OK:
		return fail_save()
	storage_error = ""
	return true

func fail_save() -> bool:
	storage_error = "Your browser or device could not save the ledger. Progress lasts only this session. Check storage permissions."
	save_failed.emit(storage_error)
	return false

func load_state() -> void:
	if not FileAccess.file_exists(save_path):
		return
	var parser := JSON.new()
	var result := parser.parse(FileAccess.get_file_as_string(save_path))
	var saved = parser.data if result == OK else null
	if not saved is Dictionary or saved.get("version") != 1:
		contracts.clear()
		active_contract = {}
		storage_error = "The saved ledger could not be read. A fresh ledger has been opened."
		return
	var incoming = saved.get("settings", {})
	if incoming is Dictionary:
		for section in schema:
			for row in section.rows:
				var key: String = row.key
				var value = incoming.get(key)
				if row.type == "choice" and value in row.values and value not in row.get("locked", []):
					settings[key] = value
				elif row.type == "range" and (value is float or value is int):
					settings[key] = clampf(float(value), row.min, row.max)
		for key in settings:
			if key.begins_with("binds.") and (incoming.get(key) is float or incoming.get(key) is int):
				var code := int(incoming[key])
				if code > 0 and code != KEY_ESCAPE:
					settings[key] = code
	settings["gfx.rt"] = "Off"
	contracts.clear()
	active_contract = {}
	var saved_contracts = saved.get("contracts", [])
	if saved_contracts is Array:
		for c in saved_contracts:
			if c is Dictionary and c.get("id") is String and c.get("name") is String and c.get("created") is String:
				contracts.append(c)
				if contracts.size() >= MAX_CONTRACTS:
					break
	if not contracts.is_empty():
		active_contract = contracts.back()
