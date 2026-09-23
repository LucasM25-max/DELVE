extends Node
## Shell — the root controller of the pixel game (GDD-07 §5, GDD-06 §4.5).
##
## Owns the state machine, the screen instances and the screen transition. The
## screen scripts know nothing about each other: they emit
## `finished(next_state, payload)` and this node swaps them, with a single
## cross-fade (600 ms, §5.2 step 3) between pages.
##
## Screen registry
## ---------------
## `SCREENS` maps a `GameState.State` value to a scene. Adding a page means:
##   1. a new value in `GameState.State`,
##   2. a scene under `scenes/ui/screens/`,
##   3. one line in `SCREENS` below.
## Unregistered states are inert (the current screen stays up and logs), which
## keeps the reserved LOADING and YARD values safe until they are built.
##
## Debug hooks
## -----------
##   godot --path pixel -- --screen=menu          jump straight to a page
##   godot --path pixel -- --screen=menu --reduced-motion
##   <site>/index.html?s=menu                     same, from the browser build
## Hooks are read once at boot and never change shipped behaviour.

const SCREENS := {
	GameState.State.LEGAL: preload("res://scenes/ui/screens/legal.tscn"),
	GameState.State.STING: preload("res://scenes/ui/screens/sting.tscn"),
	GameState.State.MENU: preload("res://scenes/ui/screens/menu.tscn"),
	GameState.State.STUB_CARD: preload("res://scenes/ui/screens/stub.tscn"),
	GameState.State.FIRST_RUN: preload("res://scenes/ui/screens/first_run.tscn"),
	GameState.State.LEDGER: preload("res://scenes/ui/screens/ledger.tscn"),
	GameState.State.OPTIONS: preload("res://scenes/ui/screens/options.tscn"),
}

const FADE_LAYER := 100

## `?s=` / `--screen=` values -> shell states. Add a row when a screen lands.
const DEBUG_SCREEN_IDS := {
	"legal": GameState.State.LEGAL,
	"sting": GameState.State.STING,
	"menu": GameState.State.MENU,
	"stub": GameState.State.STUB_CARD,
	"first_run": GameState.State.FIRST_RUN,
	"ledger": GameState.State.LEDGER,
	"options": GameState.State.OPTIONS,
	"loading": GameState.State.LOADING,
	"yard": GameState.State.YARD,
}

var _host: CanvasLayer
var _fade: ColorRect
var _screens: Dictionary = {}
var _current: ShellScreen = null
var _fade_tween: Tween


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	InputActions.ensure()
	# Autoloads are all ready by the time the main scene builds: fold the save's
	# choices into GameState, then apply them to the input map and the buses.
	GameState.sync_settings_from_save()
	InputActions.apply_overrides(GameState.settings)
	Sound.apply_settings(GameState.settings)
	_build_layers()
	GameState.state_changed.connect(_on_state_changed)
	_apply_debug_hooks()
	_enter_state(GameState.state)


func _build_layers() -> void:
	_host = CanvasLayer.new()
	_host.name = "ScreenHost"
	add_child(_host)

	# Fade layer on top of every screen: ink, full rect, alpha 0 when idle.
	var fade_layer := CanvasLayer.new()
	fade_layer.name = "FadeLayer"
	fade_layer.layer = FADE_LAYER
	add_child(fade_layer)
	_fade = ColorRect.new()
	_fade.name = "Fade"
	_fade.color = Color(Palette.ink, 0.0)
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	fade_layer.add_child(_fade)


func _on_state_changed(_from_state: int, to_state: int) -> void:
	_enter_state(to_state)


func _enter_state(state: int) -> void:
	if not SCREENS.has(state):
		push_warning("Shell: state %d has no registered screen yet" % state)
		return
	var screen := _screen_for(state)
	if screen == null:
		return
	if _current != null and _current != screen:
		_current.leave()
	_current = screen
	screen.enter(GameState.payload)
	# Pages that are screens in their own right fade in; the boot pages hand
	# over through their own cross-fade.
	if state == GameState.State.MENU:
		_cross_fade(float(ShellData.boot_timing().get("menu_fade_in_ms", 600)) / 1000.0)


## Instantiate (once) and return the screen for a state.
func _screen_for(state: int) -> ShellScreen:
	if _screens.has(state):
		return _screens[state]
	var packed: PackedScene = SCREENS[state]
	var instance := packed.instantiate()
	var screen := instance as ShellScreen
	if screen == null:
		push_error("Shell: %s does not extend ShellScreen" % packed.resource_path)
		instance.queue_free()
		return null
	screen.name = "Screen_%d" % state
	screen.finished.connect(_on_screen_finished)
	_host.add_child(screen)
	_screens[state] = screen
	return screen


func _on_screen_finished(next_state: int, payload: Dictionary) -> void:
	# Placeholder pages remember where they came from, so BACK returns there.
	if next_state == GameState.State.STUB_CARD:
		GameState.transition_to(next_state, payload, true)
		return
	if GameState.state == GameState.State.STUB_CARD and next_state == GameState.State.MENU:
		GameState.return_to_previous(payload)
		return
	GameState.transition_to(next_state, payload)


## 0.6 s fade used when the menu comes up (§5.2 step 3) and on any explicit
## `cross_fade()` call. Never used between boot pages, which cut.
func _cross_fade(seconds: float) -> void:
	if _fade_tween != null and _fade_tween.is_running():
		_fade_tween.kill()
	_fade.color.a = 1.0
	_fade_tween = create_tween()
	_fade_tween.tween_property(_fade, "color:a", 0.0, maxf(seconds, 0.001))


# --- debug hooks -------------------------------------------------------

func _apply_debug_hooks() -> void:
	var screen_id := _debug_screen_id()
	if _debug_has_flag("reduced-motion"):
		GameState.settings["reduced_motion"] = "On"
	if screen_id.is_empty():
		return
	var target := _state_for_id(screen_id)
	if target < 0:
		push_warning("Shell: unknown --screen value '%s'" % screen_id)
		return
	if target != GameState.state:
		GameState.transition_to(target)


func _debug_screen_id() -> String:
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--screen="):
			return argument.trim_prefix("--screen=")
	if OS.has_feature("web"):
		var query := _web_query()
		if not query.is_empty():
			return query
	return ""


func _web_query() -> String:
	var result: Variant = JavaScriptBridge.eval(
		"(new URLSearchParams(window.location.search)).get('s') || ''", true
	)
	return String(result) if result != null else ""


func _debug_has_flag(flag: String) -> bool:
	return OS.get_cmdline_user_args().has("--" + flag)


func _state_for_id(id: String) -> int:
	return DEBUG_SCREEN_IDS.get(id.strip_edges().to_lower(), -1)
