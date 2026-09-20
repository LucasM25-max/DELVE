extends Node3D
## Test yard with Sky3D 2.1 integration — Phases 1 & 2 implemented.
## Phase 1: Neverwinter dawn staging — latitude, longitude, time, lighting tuned for Compatibility.
## Phase 2: Clouds as weather proxy — coverage driven by gfx.clouds, wind from settings.
const UI = preload("res://scripts/ui/shell_ui.gd")
var pause_overlay: Control
var resume_button: Button
var hint: Label
var hud: Control
var sky_info: Label
var weather_info: Label

# Neverwinter (Forgotten Realms) approx — using 50°N for dramatic dawn, west coast
const NW_LAT_DEG := 50.0
const NW_LON_DEG := -10.0
const NW_UTC := 0.0
const DAWN_TIME := 6.5 # 06:30

# Weather presets for Phase 2 — maps to cloud coverage
enum WeatherState { CLEAR, OVERCAST, STORM }
var current_weather := WeatherState.CLEAR

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	call_deferred("_configure_sky3d_phase1_2")

	var layer := CanvasLayer.new()
	add_child(layer)
	hud = Control.new()
	hud.theme = UI.theme_for(true)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(hud)
	UI.fill(hud)

	var ink := Color("101418")
	var heading := UI.label("TEST YARD  ·  SKY3D 2.1 DAWN + HUMANOID 0.3", 25, true)
	heading.add_theme_color_override("font_color", ink)
	UI.at(heading, hud, Rect2(36, 24, 780, 40))

	var sub := UI.label("Sky3D day/night (Phases 1-2) + CC0 Quaternius + UAL — Neverwinter muster-yard at dawn")
	sub.add_theme_color_override("font_color", Color("3c4046"))
	UI.at(sub, hud, Rect2(36, 64, 980, 35))

	# Sky info
	sky_info = UI.label("", 18)
	sky_info.add_theme_color_override("font_color", Color("3c4046"))
	UI.at(sky_info, hud, Rect2(36, 104, 600, 30))

	weather_info = UI.label("", 18)
	weather_info.add_theme_color_override("font_color", Color("3c4046"))
	UI.at(weather_info, hud, Rect2(36, 132, 600, 30))

	hint = UI.label("Click to look around · WASD move (W away from camera) · Shift sprint · Space jump\nV changes view · Esc pauses / releases mouse · Sky time: Slow (15m/day) at dawn", 20)
	hint.add_theme_color_override("font_color", Color("3c4046"))
	hud.add_child(hint)
	hint.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	hint.offset_left = 36
	hint.offset_top = -110
	hint.offset_right = -36
	hint.offset_bottom = -24

	var pause_button := UI.button("PAUSE / MENU", func() -> void: set_paused(true))
	hud.add_child(pause_button)
	pause_button.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	pause_button.offset_left = -285
	pause_button.offset_right = -30
	pause_button.offset_top = 28
	pause_button.offset_bottom = 80

	build_pause()
	set_paused(true)

	# React to settings changes for clouds/time
	GameState.setting_changed.connect(_on_setting_changed)

func build_pause() -> void:
	pause_overlay = Control.new()
	hud.add_child(pause_overlay)
	UI.fill(pause_overlay)
	var shade := ColorRect.new()
	shade.color = Color(0.02, 0.035, 0.04, 0.86)
	pause_overlay.add_child(shade)
	UI.fill(shade)
	var center := CenterContainer.new()
	pause_overlay.add_child(center)
	UI.fill(center)
	var column := VBoxContainer.new()
	column.custom_minimum_size = Vector2(700, 0)
	center.add_child(column)
	var heading := UI.label("THE MUSTER-YARD AT DAWN", 40, true)
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(heading)
	var desc := UI.label("Sky3D 2.1 — Phases 1 & 2: dawn lighting + clouds as weather.\nWind drives clouds, no rain yet (custom weather needed).", 22)
	desc.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(desc)
	column.add_child(UI.rule())
	resume_button = UI.button("EXPLORE / RESUME", func() -> void: set_paused(false))
	column.add_child(resume_button)
	column.add_child(UI.button("RETURN TO MENU", return_to_menu))
	column.add_child(UI.label("Sky: 50°N, 06:30 dawn, 15m/day Slow. Clouds: Med (0.3 cirrus / 0.25 cumulus), Wind 2m/s N.\nCompatibility: sky_contribution 0.75, fog_density 0.01.\nOptions → Graphics → Cloud quality & Sky time control this.", 20))

func set_paused(value: bool) -> void:
	get_tree().paused = value
	pause_overlay.visible = value
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if value else Input.MOUSE_MODE_CAPTURED
	# Pause/resume Sky3D time
	var sky3d := get_node_or_null("Sky3D")
	if sky3d:
		if value:
			sky3d.pause()
		else:
			sky3d.resume()
	if value:
		resume_button.grab_focus()
	else:
		var focused := get_viewport().gui_get_focus_owner()
		if focused:
			focused.release_focus()

func return_to_menu() -> void:
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	GameState.return_to_menu = true
	GameState.persist()
	get_tree().change_scene_to_file("res://scenes/ui/shell.tscn")

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel") or event.is_action_pressed("game_pause"):
		set_paused(not get_tree().paused)
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.pressed and not get_tree().paused:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _process(_delta: float) -> void:
	if not get_tree().paused and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		set_paused(true)
	# Update HUD sky info
	var sky3d := get_node_or_null("Sky3D")
	if sky3d and is_instance_valid(sky_info):
		var t: float = sky3d.current_time if "current_time" in sky3d else DAWN_TIME
		var h := int(t)
		var m := int(fmod(t, 1.0) * 60.0)
		sky_info.text = "Time: %02d:%02d (%.2f) · Lat %.1f°N Lon %.1f° · %s" % [h, m, t, NW_LAT_DEG, NW_LON_DEG, "Day" if sky3d.is_day() else "Night" if sky3d.has_method("is_day") else "Dawn"]
	if is_instance_valid(weather_info):
		var wname := ["Clear", "Overcast", "Storm"][current_weather]
		weather_info.text = "Weather: %s · Wind %.1f m/s · Clouds Med" % [wname, 2.0]

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and is_instance_valid(pause_overlay):
		set_paused(true)

# Phase 1 & 2 full implementation
func _configure_sky3d_phase1_2() -> void:
	var sky3d := get_node_or_null("Sky3D")
	if not sky3d:
		return
	await get_tree().process_frame # wait for Sky3D to build its children
	await get_tree().process_frame

	# --- Phase 1: Neverwinter dawn staging ---
	# Compatibility renderer tweaks
	sky3d.sky_contribution = 0.75 # README Compatibility note
	sky3d.ambient_energy = 1.0
	sky3d.skydome_energy = 1.0
	sky3d.sun_energy = 1.2 # slightly brighter dawn sun
	sky3d.cloud_intensity = 0.6

	# Time — from GameState gfx.sky setting
	var sky_mode: String = str(GameState.get_setting("gfx.sky")) if GameState.settings.has("gfx.sky") else "Slow"
	match sky_mode:
		"Paused":
			sky3d.minutes_per_day = 0.0
			sky3d.game_time_enabled = false
		"Real-time":
			sky3d.minutes_per_day = 1440.0 # 24h real = 24h game
			sky3d.game_time_enabled = true
		_:
			sky3d.minutes_per_day = 30.0 # Slow — Witcher 3 uses 96, we use 30 for visible dawn
			sky3d.game_time_enabled = true
	sky3d.current_time = DAWN_TIME
	sky3d.update_interval = 0.1 # 10fps enough for 30m day, saves CPU for Web

	# TimeOfDay node holds lat/lon/utc
	var tod := sky3d.tod
	if not tod:
		tod = sky3d.get_node_or_null("TimeOfDay")
	if tod:
		tod.latitude = deg_to_rad(NW_LAT_DEG)
		tod.longitude = deg_to_rad(NW_LON_DEG)
		tod.utc = NW_UTC
		tod.year = 1491 # Forgotten Realms DR year — arbitrary, for flavor
		tod.month = 6
		tod.day = 15
		tod.celestials_calculations = tod.CelestialMode.REALISTIC

	# SkyDome tuning for dawn — warm horizon
	var skydome := sky3d.sky
	if not skydome:
		skydome = sky3d.get_node_or_null("SkyDome")
	if skydome:
		# Ground below horizon — dark stone, not white
		if "ground_color" in skydome:
			skydome.ground_color = Color(0.22, 0.22, 0.24, 1.0)
		# Atmosphere — keep defaults but ensure warm dawn
		if "atm_day_tint" in skydome:
			skydome.atm_day_tint = Color(0.85, 0.92, 1.0, 1.0)
		if "atm_horizon_light_tint" in skydome:
			skydome.atm_horizon_light_tint = Color(0.98, 0.70, 0.48, 1.0) # warm orange dawn
		if "atm_night_tint" in skydome:
			skydome.atm_night_tint = Color(0.08, 0.09, 0.15, 0.4)
		# Fog — Compatibility tweak
		if "fog_density" in skydome:
			skydome.fog_density = 0.01
		if "fog_enabled" in skydome:
			skydome.fog_enabled = true
		if "fog_color" in skydome:
			skydome.fog_color = Color(0.75, 0.68, 0.55, 1.0)

		# --- Phase 2: Clouds as weather proxy ---
		_apply_cloud_quality()

		# Wind — drives cloud movement
		if "wind_speed" in skydome:
			skydome.wind_speed = 2.0 # m/s gentle north wind
		if "wind_direction" in skydome:
			skydome.wind_direction = deg_to_rad(0.0) # 0 = from north

		# Ensure clouds visible
		if "cirrus_visible" in skydome:
			skydome.cirrus_visible = true
		if "cumulus_visible" in skydome:
			skydome.cumulus_visible = true

	# Start paused (menu will resume on Explore)
	sky3d.pause()

func _apply_cloud_quality() -> void:
	var sky3d := get_node_or_null("Sky3D")
	if not sky3d:
		return
	var skydome := sky3d.sky
	if not skydome:
		skydome = sky3d.get_node_or_null("SkyDome")
	if not skydome:
		return

	var quality: String = str(GameState.get_setting("gfx.clouds")) if GameState.settings.has("gfx.clouds") else "Med"
	# Map quality to weather preset + coverage
	match quality:
		"Off":
			skydome.cirrus_visible = false
			skydome.cumulus_visible = false
			sky3d.clouds_enabled = false
			current_weather = WeatherState.CLEAR
		"Low":
			sky3d.clouds_enabled = true
			skydome.cirrus_visible = true
			skydome.cumulus_visible = false
			skydome.cirrus_coverage = 0.25
			skydome.cirrus_thickness = 1.2
			skydome.cumulus_coverage = 0.0
			current_weather = WeatherState.CLEAR
		"Med":
			sky3d.clouds_enabled = true
			skydome.cirrus_visible = true
			skydome.cumulus_visible = true
			# Phase 2 clear dawn — light clouds
			skydome.cirrus_coverage = 0.30
			skydome.cirrus_thickness = 1.7
			skydome.cumulus_coverage = 0.25
			skydome.cumulus_thickness = 0.0243
			skydome.cumulus_absorption = 2.0
			current_weather = WeatherState.CLEAR
		"High":
			sky3d.clouds_enabled = true
			skydome.cirrus_visible = true
			skydome.cumulus_visible = true
			# Overcast / dramatic — higher coverage
			skydome.cirrus_coverage = 0.65
			skydome.cirrus_thickness = 2.2
			skydome.cumulus_coverage = 0.55
			skydome.cumulus_thickness = 0.035
			skydome.cumulus_absorption = 2.8
			current_weather = WeatherState.OVERCAST

func _on_setting_changed(key: String, _value: Variant) -> void:
	if key in ["gfx.clouds", "gfx.sky", "gfx.quality"]:
		_configure_sky3d_phase1_2()
