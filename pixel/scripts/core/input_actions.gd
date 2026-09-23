class_name InputActions
extends RefCounted
## InputActions — the shell's input map, guaranteed at runtime.
##
## The bindings are declared in `project.godot` (so the Godot editor's input map
## shows them and they can be rebound in Options), and this helper adds any that
## are missing when the game boots. That belt-and-braces approach comes straight
## from GDD-06 §4.2/§4.9: "actions are registered at runtime" until the input map
## is finalised, and it means a hand-edited project file can never leave the
## menu unable to navigate.
##
## Bindings (GDD-07 §5.4 / §5.6):
##   menu_up / menu_down    W, S, arrows, d-pad, left stick
##   menu_accept            Enter, Space, F, pad A
##   menu_back              Esc, pad B          (the menu swallows Esc on purpose)
##   zoom_lean_in           V, pad Y            (2x zoom, R2/T2 in the yard)

static func ensure() -> void:
	_bind(&"menu_up", [
		_key(KEY_W), _key(KEY_UP),
		_joy_button(JOY_BUTTON_DPAD_UP), _joy_axis(JOY_AXIS_LEFT_Y, -1.0),
	])
	_bind(&"menu_down", [
		_key(KEY_S), _key(KEY_DOWN),
		_joy_button(JOY_BUTTON_DPAD_DOWN), _joy_axis(JOY_AXIS_LEFT_Y, 1.0),
	])
	_bind(&"menu_accept", [
		_key(KEY_ENTER), _key(KEY_SPACE), _key(KEY_F), _joy_button(JOY_BUTTON_A),
	])
	_bind(&"menu_back", [_key(KEY_ESCAPE), _joy_button(JOY_BUTTON_B)])
	_bind(&"zoom_lean_in", [_key(KEY_V), _joy_button(JOY_BUTTON_Y)])


static func _bind(action: StringName, events: Array) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action, 0.2)
	for event in events:
		if not InputMap.action_has_event(action, event):
			InputMap.action_add_event(action, event)


static func _key(code: int) -> InputEventKey:
	var event := InputEventKey.new()
	event.physical_keycode = code
	return event


static func _joy_button(index: int) -> InputEventJoypadButton:
	var event := InputEventJoypadButton.new()
	event.button_index = index
	return event


static func _joy_axis(axis: int, value: float) -> InputEventJoypadMotion:
	var event := InputEventJoypadMotion.new()
	event.axis = axis
	event.axis_value = value
	return event
