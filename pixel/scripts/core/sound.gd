extends Node
## Sound — the four-bus audio layer (Master / Music / SFX / Voice).
##
## Cues are declared in `data/audio_cues.json` (the GDD-07 §5.10 + §8 cue list)
## and are played by id, never by file path, from anywhere in the codebase:
##
##     Sound.play("SFX_UI_MOVE")
##
## A cue whose audio file is not in the project yet is silently skipped (and
## reported once), so the shell runs before the sound design lands. Drop the
## file in, and it plays — see `tools/fetch_audio.py`.
##
## Voice buses duck the music bed by -6 dB while a line is playing (§8 mix).

signal cue_played(id: String)

const CUES_PATH := "res://data/audio_cues.json"
const SFX_PLAYERS := 6
const VOICE_DUCK_DB := -6.0

var cues: Dictionary = {}
var buses: Dictionary = {}

var _music: AudioStreamPlayer
var _ambience: AudioStreamPlayer
var _voice: AudioStreamPlayer
var _sfx_pool: Array[AudioStreamPlayer] = []
var _sfx_cursor := 0
var _reported_missing: Dictionary = {}
var _queued_cues: Array[String] = []
var _unlocked := false
var _settings: Dictionary = {}


func _ready() -> void:
	cues = _load_cues()
	_setup_buses()
	_setup_players()
	_apply_settings()


## Play a one-shot cue (SFX or a stinger). Unknown or unloaded cues are no-ops.
func play(id: String, volume_db: float = 0.0) -> void:
	var cue: Dictionary = cues.get(id, {})
	if cue.is_empty():
		_report_missing(id, "undeclared cue")
		return
	var stream := _stream_for(id, cue)
	if stream == null:
		return
	match String(cue.get("type", "sfx")):
		"music":
			_music.stream = stream
			_music.play()
		"ambience":
			_ambience.stream = stream
			_ambience.play()
		"voice":
			_voice.stream = stream
			_duck_music(true)
			_voice.play()
		_:
			var player := _next_sfx_player()
			player.stream = stream
			player.volume_db = volume_db + float(cue.get("gain_db", 0.0))
			player.play()
	cue_played.emit(id)


## Play a loop that keeps running (music beds, ambience).
func play_loop(id: String) -> void:
	var cue: Dictionary = cues.get(id, {})
	if cue.is_empty():
		_report_missing(id, "undeclared loop")
		return
	var stream := _stream_for(id, cue)
	if stream == null:
		return
	if String(cue.get("type", "")) == "ambience":
		_ambience.stream = stream
		_ambience.play()
	else:
		_music.stream = stream
		_music.play()


func stop_music(fade_s: float = 0.0) -> void:
	if fade_s <= 0.0:
		_music.stop()
		return
	var tween := create_tween()
	tween.tween_property(_music, "volume_db", -60.0, fade_s)
	tween.tween_callback(_music.stop)
	tween.tween_callback(func() -> void:
		_music.volume_db = 0.0)


func stop_all() -> void:
	_music.stop()
	_ambience.stop()
	_voice.stop()
	for player in _sfx_pool:
		player.stop()


## Web builds start with a suspended audio context that only a user gesture may
## resume. Godot resumes its own driver on the first input event, so the real job
## here is to flush cues that were queued before the gesture (the boot sting).
func unlock() -> void:
	if _unlocked:
		return
	_unlocked = true
	for id in _queued_cues:
		play(id)
	_queued_cues.clear()


## Queue a cue to play the moment audio is unlocked (call before `unlock()`).
func queue_after_unlock(id: String) -> void:
	if _unlocked:
		play(id)
	else:
		_queued_cues.append(id)


func is_unlocked() -> bool:
	return _unlocked


## Bus volumes come straight from the options rows (§5.6 Audio tab).
func apply_settings(settings: Dictionary) -> void:
	_settings = settings.duplicate()
	_apply_settings()


func set_bus_volume(bus_name: String, value_0_100: float) -> void:
	if not buses.has(bus_name):
		return
	var bus_index: int = buses[bus_name]
	var linear := clampf(value_0_100 / 100.0, 0.0, 1.0)
	AudioServer.set_bus_volume_db(bus_index, linear_to_db(maxf(linear, 0.0001)))
	AudioServer.set_bus_mute(bus_index, is_zero_approx(linear))


func set_voice_bus_volume(id: String, value_0_100: float) -> void:
	var row := "volume_%s" % id
	_settings[row] = value_0_100
	set_bus_volume(_bus_for_row(row), value_0_100)


# --- internals ---------------------------------------------------------

func _bus_for_row(row: String) -> String:
	match row:
		"volume_music": return "Music"
		"volume_sfx": return "SFX"
		"volume_voice": return "Voice"
		_: return "Master"


func _apply_settings() -> void:
	if _settings.is_empty() and has_node("/root/GameState"):
		_settings = GameState.settings.duplicate()
	for row in ["volume_master", "volume_music", "volume_sfx", "volume_voice"]:
		if _settings.has(row):
			set_bus_volume(_bus_for_row(row), float(_settings[row]))


func _setup_buses() -> void:
	for bus_name in ["Music", "SFX", "Voice"]:
		var index := AudioServer.get_bus_index(bus_name)
		if index == -1:
			AudioServer.add_bus()
			index = AudioServer.bus_count - 1
			AudioServer.set_bus_name(index, bus_name)
			AudioServer.set_bus_send(index, "Master")
		buses[bus_name] = index
	buses["Master"] = AudioServer.get_bus_index("Master")


func _setup_players() -> void:
	_music = _make_player("Music")
	_ambience = _make_player("Music")
	_ambience.volume_db = -6.0
	_voice = _make_player("Voice")
	for i in SFX_PLAYERS:
		_sfx_pool.append(_make_player("SFX"))
	_voice.finished.connect(func() -> void: _duck_music(false))


func _make_player(bus_name: String) -> AudioStreamPlayer:
	var player := AudioStreamPlayer.new()
	player.bus = bus_name
	player.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(player)
	return player


func _next_sfx_player() -> AudioStreamPlayer:
	_sfx_cursor = (_sfx_cursor + 1) % _sfx_pool.size()
	return _sfx_pool[_sfx_cursor]


func _duck_music(duck: bool) -> void:
	var index: int = buses.get("Music", 0)
	if index < 0:
		return
	var base := _music_bus_db()
	AudioServer.set_bus_volume_db(index, base + VOICE_DUCK_DB if duck else base)


func _music_bus_db() -> float:
	var row_value := float(_settings.get("volume_music", 80.0))
	return linear_to_db(maxf(row_value / 100.0, 0.0001))


func _stream_for(id: String, cue: Dictionary) -> AudioStream:
	var path := String(cue.get("file", ""))
	if path.is_empty() or not ResourceLoader.exists(path):
		_report_missing(id, path if not path.is_empty() else "no file declared")
		return null
	var stream := load(path) as AudioStream
	if stream == null:
		_report_missing(id, "unreadable stream")
		return null
	if String(cue.get("type", "")) in ["music", "ambience"]:
		var looped := stream.duplicate() as AudioStream
		for property in ["loop", "loop_mode"]:
			if looped != null and property in looped:
				looped.set(property, true)
		return looped if looped != null else stream
	return stream


func _report_missing(id: String, reason: String) -> void:
	if _reported_missing.has(id):
		return
	_reported_missing[id] = true
	print("[sound] cue '%s' not loaded yet (%s)" % [id, reason])


func _load_cues() -> Dictionary:
	var path := CUES_PATH
	if not FileAccess.file_exists(path):
		push_warning("Sound: %s is missing; every cue will be silent" % path)
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if typeof(parsed) == TYPE_DICTIONARY else {}
