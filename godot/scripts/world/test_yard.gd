extends Node3D
## A deliberately small browser-friendly blockout. Not the full campaign.
const UI = preload("res://scripts/ui/shell_ui.gd")
var pause_overlay: Control
var resume_button: Button
var hint: Label
var hud: Control

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var layer := CanvasLayer.new()
	add_child(layer)
	hud = Control.new()
	hud.theme = UI.theme_for(true)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(hud)
	UI.fill(hud)
	var ink := Color("101418")
	var heading := UI.label("TEST YARD  ·  BLOCKOUT 0.2", 25, true)
	heading.add_theme_color_override("font_color", ink)
	UI.at(heading, hud, Rect2(36, 24, 700, 40))
	var sub := UI.label("Bean player on flat white ground · movement & camera test only", 22)
	sub.add_theme_color_override("font_color", Color("3c4046"))
	UI.at(sub, hud, Rect2(36, 64, 900, 35))
	hint = UI.label("Click to look around · WASD move · Shift sprint · Space jump\nV changes view · Esc pauses / releases the mouse", 23)
	hint.add_theme_color_override("font_color", Color("3c4046"))
	hud.add_child(hint)
	hint.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	hint.offset_left = 36
	hint.offset_top = -100
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
	# Start with a button so browser pointer-lock begins on an explicit user gesture.
	set_paused(true)

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
	column.custom_minimum_size = Vector2(660, 0)
	center.add_child(column)
	var heading := UI.label("THE MUSTER-YARD", 40, true)
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(heading)
	var desc := UI.label("An optional movement and asset-integration test.\nThe adventure waits beyond this blockout.", 26)
	desc.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(desc)
	column.add_child(UI.rule())
	resume_button = UI.button("EXPLORE / RESUME", func() -> void: set_paused(false))
	column.add_child(resume_button)
	column.add_child(UI.button("RETURN TO MENU", return_to_menu))
	column.add_child(UI.label("Click Explore to capture the mouse. Esc releases it.\nUse Options in the menu for camera, audio and key bindings.", 22))

func set_paused(value: bool) -> void:
	get_tree().paused = value
	pause_overlay.visible = value
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if value else Input.MOUSE_MODE_CAPTURED
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

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and is_instance_valid(pause_overlay):
		set_paused(true)
