extends Node
## GameState — the shell state machine (GDD-07 §5, pixelating GDD-02).
##
##   LEGAL -> STING -> MENU -> {stub cards} -> LOADING -> YARD
##
## The shell owns exactly one screen at a time; screens never talk to each
## other, they emit `finished(next_state, payload)` and the shell swaps them.
## Adding a screen means: a new enum value, an entry in `SCREENS`, and a scene.
##
## Menu pages that are not built yet (First Run, Ledger, Options, Codex,
## Credits, Loading) keep their enum values reserved here so the wiring can land
## without renaming anything.

signal state_changed(from_state: int, to_state: int)

enum State {
	LEGAL,      ## attribution screen, any input continues and unlocks audio
	STING,      ## 4.0 s logo sting, skippable after 1.5 s
	MENU,       ## the main menu (§5.4)
	STUB_CARD,  ## placeholder page behind a menu item in this build
	FIRST_RUN,  ## the First Run contract page (§5.5)
	LEDGER,     ## the contract ledger (§5.5)
	OPTIONS,    ## schema-driven options page (§5.6)
	LOADING,    ## loading screen (§5.9) — reserved, not built yet
	YARD,       ## zone YRD (§6) — reserved, not built yet
}

## Shell build version, mirrored into the menu version stamp.
const VERSION := "0.4.0-pixel"

var state: int = State.LEGAL
var previous_state: int = State.LEGAL

## Payload handed to the screen on entry (stub card id, save slot, …).
var payload: Dictionary = {}

## Active menu row, mirrored here so gameplay code can read it later.
var active_menu_index: int = 0

## Options values, seeded from the schema defaults, overwritten by the save.
var settings: Dictionary = {}

var _history: Array[int] = []


func _ready() -> void:
	if has_node("/root/ShellData"):
		settings = ShellData.option_defaults()


## Layer the saved choices over the schema defaults. Autoload order means
## `GameState._ready()` runs before `SaveStore` has read the file, so the shell
## calls this once at boot (and the Options page writes through both).
func sync_settings_from_save() -> void:
	if not has_node("/root/SaveStore"):
		return
	var saved := SaveStore.settings()
	for row_id in saved:
		settings[row_id] = saved[row_id]


## Write one options value in memory (the pages persist it through SaveStore).
func set_setting(row_id: String, value: Variant) -> void:
	settings[row_id] = value


## Move to a new state. Screens are swapped by the shell in response to the
## `state_changed` signal; `keep_history` lets a stub card return to its caller.
func transition_to(next_state: int, next_payload: Dictionary = {}, keep_history: bool = false) -> void:
	if next_state == state:
		return
	if keep_history:
		_history.append(state)
	previous_state = state
	state = next_state
	payload = next_payload
	state_changed.emit(previous_state, state)


## Pop back to the state that pushed the current one (stub card -> menu).
func return_to_previous(next_payload: Dictionary = {}) -> void:
	var back := int(_history.pop_back()) if not _history.is_empty() else State.MENU
	previous_state = state
	state = back
	payload = next_payload
	state_changed.emit(previous_state, state)


## True while a state that should receive "press any button" input is active.
func is_boot_state() -> bool:
	return state == State.LEGAL or state == State.STING
