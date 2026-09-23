extends Node
## The supplied OGG, not runtime synthesis. Audio begins on a user gesture.
var music: AudioStreamPlayer
var unlocked := false
var focused := true
var duck_db := 0.0:
	set(value):
		duck_db = value
		apply()

func _ready() -> void:
	music = AudioStreamPlayer.new()
	var stream: AudioStreamOggVorbis = load("res://assets/audio/mus_menu_theme.ogg")
	stream.loop = true
	music.stream = stream
	add_child(music)
	GameState.setting_changed.connect(func(_key: String, _value: Variant) -> void: apply())
	apply()

func unlock() -> void:
	if not unlocked:
		unlocked = true
		music.play()
	apply()

func duck_bed(duration: float) -> void:
	# GDD-03 §7/§12: a VO line ducks the music bed -6 dB while it plays.
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: duck_db = v, duck_db, -6.0, 0.08)
	tw.tween_interval(maxf(duration - 0.2, 0.05))
	tw.tween_method(func(v: float) -> void: duck_db = v, -6.0, 0.0, 0.12)

func apply() -> void:
	if music == null:
		return
	var volume: float = float(GameState.get_setting("aud.master")) * float(GameState.get_setting("aud.music")) / 10000.0
	if not focused and GameState.get_setting("aud.mute") == "On":
		volume = 0.0
	music.volume_db = linear_to_db(maxf(volume, 0.00001)) + duck_db

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		focused = false
	elif what == NOTIFICATION_APPLICATION_FOCUS_IN:
		focused = true
	else:
		return
	apply()

func _exit_tree() -> void:
	if is_instance_valid(music):
		music.stop()
