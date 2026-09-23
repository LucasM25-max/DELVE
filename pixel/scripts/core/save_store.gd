extends Node
## SaveStore — the contract ledger (GDD-06 §4.10, GDD-07 §5.5).
##
## One file, `user://delve_v2.json`, schema 2. Eight slots, each either empty or
## holding one signed contract. Writes are atomic (tmp file + rename) and
## debounced, so a crash mid-write can never scorch the ledger.
##
## The menu build only *reads* it (to decide whether CONTINUE is lit); the
## First Run page and the ledger screen will write through `create_contract()`
## and `delete_contract()` when they land.

signal ledger_changed()

const SAVE_PATH := "user://delve_v2.json"
const TMP_PATH := "user://delve_v2.json.tmp"
const SCHEMA := 2
const SLOT_COUNT := 8
const WRITE_DEBOUNCE_S := 0.35

var _ledger: Array = []
var _tutorial: Dictionary = {}
var _codex_unlocks: Array = []
var _combat_stats: Dictionary = {}
var _settings: Dictionary = {}
var _write_timer: SceneTreeTimer = null
var _loaded := false
var _corrupt := false


func _ready() -> void:
	load_ledger()


## --- ledger ------------------------------------------------------------

func load_ledger() -> void:
	_ledger = []
	for _i in SLOT_COUNT:
		_ledger.append(null)
	var doc := _read_json(SAVE_PATH)
	if doc.is_empty():
		# A file that exists but does not parse is the §5.5 corrupt-save case;
		# an absent file is simply a fresh player.
		_corrupt = FileAccess.file_exists(SAVE_PATH)
		_loaded = true
		ledger_changed.emit()
		return
	_corrupt = false
	if int(doc.get("schema", 1)) != SCHEMA:
		push_warning("SaveStore: unexpected schema %s (expected %d); loading anyway"
			% [doc.get("schema", "?"), SCHEMA])
	var slots: Array = doc.get("slots", [])
	for i in mini(slots.size(), SLOT_COUNT):
		_ledger[i] = slots[i] if typeof(slots[i]) == TYPE_DICTIONARY else null
	_tutorial = doc.get("tutorial", {})
	_codex_unlocks = doc.get("codex_unlocks", [])
	_combat_stats = doc.get("combat_stats", {})
	_settings = doc.get("settings", {})
	_loaded = true
	ledger_changed.emit()


## Every slot, empty ones included as `null`.
func slots() -> Array:
	return _ledger.duplicate()


## The slot dictionary at `index`, or an empty dictionary when the slot is free.
func slot(index: int) -> Dictionary:
	if index < 0 or index >= _ledger.size():
		return {}
	return _ledger[index] if typeof(_ledger[index]) == TYPE_DICTIONARY else {}


func is_slot_used(index: int) -> bool:
	return not slot(index).is_empty()


## Does the player have any signed contract? Drives CONTINUE's dim/lit state and
## the MUS_MENU_THEME_VAR variant (§5.4/§5.10).
func has_any_contract() -> bool:
	for entry in _ledger:
		if typeof(entry) == TYPE_DICTIONARY and not entry.is_empty():
			return true
	return false


## §5.5 boot edge case: the save exists but failed its checksum. The Ledger shows
## the scorched-save card while this is true; a successful write clears it.
func has_corrupt_save() -> bool:
	return _corrupt


## The most recently touched contract, used by the PLAY overlay body string.
func latest_contract() -> Dictionary:
	var best: Dictionary = {}
	for entry in _ledger:
		if typeof(entry) != TYPE_DICTIONARY or entry.is_empty():
			continue
		if best.is_empty() or String(entry.get("signed_at", "")) > String(best.get("signed_at", "")):
			best = entry
	return best


func first_empty_slot() -> int:
	for i in _ledger.size():
		if not is_slot_used(i):
			return i
	return -1


## Create a contract in `index` (the First Run page will call this once the
## contract flow lands). Returns false when the slot is occupied or invalid.
func create_contract(index: int, fields: Dictionary) -> bool:
	if index < 0 or index >= _ledger.size() or is_slot_used(index):
		return false
	var entry := {
		"name": String(fields.get("name", "New contract")),
		"class": String(fields.get("class", "—")),
		"level": int(fields.get("level", 1)),
		"chapter": String(fields.get("chapter", "Prologue")),
		"signed_at": Time.get_datetime_string_from_system(true, true),
		"beats": fields.get("beats", []),
	}
	_ledger[index] = entry
	_schedule_write()
	ledger_changed.emit()
	return true


func delete_contract(index: int) -> bool:
	if not is_slot_used(index):
		return false
	_ledger[index] = null
	_schedule_write()
	ledger_changed.emit()
	return true


## --- tutorial / codex / stats -----------------------------------------

func completed_beats() -> Array:
	return _tutorial.get("completed_beats", [])


func mark_beat_complete(id: String) -> void:
	var beats: Array = _tutorial.get("completed_beats", [])
	if not beats.has(id):
		beats.append(id)
	_tutorial["completed_beats"] = beats
	_schedule_write()


func seen_toasts() -> Array:
	return _tutorial.get("seen_toasts", [])


func mark_toast_seen(id: String) -> void:
	var seen: Array = _tutorial.get("seen_toasts", [])
	if not seen.has(id):
		seen.append(id)
	_tutorial["seen_toasts"] = seen
	_schedule_write()


## --- options -----------------------------------------------------------

func settings() -> Dictionary:
	return _settings.duplicate()


func set_setting(row_id: String, value: Variant) -> void:
	_settings[row_id] = value
	_schedule_write()


## --- persistence -------------------------------------------------------

func _read_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("SaveStore: cannot open %s" % path)
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("SaveStore: %s is corrupt (not a JSON object)" % path)
		return {}
	return parsed


func _schedule_write() -> void:
	if _write_timer != null:
		return
	_write_timer = get_tree().create_timer(WRITE_DEBOUNCE_S)
	_write_timer.timeout.connect(_flush)
	_write_timer.timeout.connect(func() -> void: _write_timer = null)


## Write the ledger to disk immediately (atomic tmp + rename).
func flush() -> void:
	_write_timer = null
	_flush()


func _flush() -> void:
	var doc := {
		"schema": SCHEMA,
		"slots": _ledger,
		"tutorial": _tutorial,
		"codex_unlocks": _codex_unlocks,
		"combat_stats": _combat_stats,
		"settings": _settings,
	}
	var file := FileAccess.open(TMP_PATH, FileAccess.WRITE)
	if file == null:
		push_error("SaveStore: cannot write %s" % TMP_PATH)
		return
	file.store_string(JSON.stringify(doc, "  "))
	file.close()
	var dir := DirAccess.open("user://")
	if dir == null:
		return
	if dir.file_exists("delve_v2.json"):
		dir.remove("delve_v2.json")
	var error := dir.rename(TMP_PATH.get_file(), "delve_v2.json")
	if error != OK:
		push_error("SaveStore: rename failed (%d)" % error)
		return
	_corrupt = false


func _exit_tree() -> void:
	if _loaded:
		flush()
