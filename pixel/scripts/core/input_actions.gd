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
##
## The twelve Controls-tab rows (§5.6) also get their actions registered here,
## with the defaults the spec's table lists, so a rebind has something to
## overwrite before the yard exists. `apply_overrides()` re-applies the player's
## saved choices at boot.

## Action -> default keys for the Controls tab rows (GDD-07 §5.6).
const YARD_BINDINGS := {
	&"game_move": [KEY_W, KEY_A, KEY_S, KEY_D, KEY_UP, KEY_LEFT, KEY_DOWN, KEY_RIGHT],
	&"game_sprint": [KEY_SHIFT],
	&"game_interact": [KEY_F],
	&"game_end_turn": [KEY_SPACE],
	&"game_pause": [KEY_ESCAPE],
	&"grid_overlay": [KEY_G],
	&"folio": [KEY_TAB],
	&"journal": [KEY_J],
	&"codex": [KEY_C],
	&"hide": [KEY_H],
	&"zoom_view": [KEY_V],
	&"pad_layout": [KEY_B],
}


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
	for action: StringName in YARD_BINDINGS:
		var events: Array = []
		for code in YARD_BINDINGS[action]:
			events.append(_key(code))
		_bind(action, events)


## Apply the player's saved rebinds (`<row id>_keycode`) over the defaults. Called
## once at boot by the shell; safe to call again after a rebind.
static func apply_overrides(settings: Dictionary) -> void:
	for action: StringName in YARD_BINDINGS:
		var row := String(action)
		if not settings.has(row + "_keycode"):
			continue
		var code := int(settings[row + "_keycode"])
		if code == 0:
			continue
		if not InputMap.has_action(action):
			InputMap.add_action(action, 0.2)
		InputMap.action_erase_events(action)
		InputMap.action_add_event(action, _key(code))


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
