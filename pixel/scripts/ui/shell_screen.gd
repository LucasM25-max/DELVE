class_name ShellScreen
extends Control
## ShellScreen — base class for every full-screen shell page.
##
## A screen owns one page of the shell state machine. It builds itself once from
## code (`_build()`), is shown and hidden by the shell, and reports where to go
## next through `finished`. Screens never reach into each other.
##
## To add a page (Options, Codex, Ledger, Loading, …):
##   1. extend ShellScreen, override `_build()`, and emit `finished` when done;
##   2. add a `.tscn` under `scenes/ui/screens/` with the script attached;
##   3. register it in `scripts/ui/shell.gd` (SCREENS) and in GameState.State.

## Emitted when this screen wants the shell to move on.
## `next_state` is a `GameState.State` value; `payload` is handed to the next
## screen (`{"stub": "play"}` for the placeholder pages, for example).
signal finished(next_state: int, payload: Dictionary)

## Set true when a screen should swallow all input while it is active.
var input_locked := false

var _built := false


## Shell entry point: builds on first use, then tells the screen it is on stage.
func enter(payload: Dictionary = {}) -> void:
	if not _built:
		_built = true
		set_anchors_preset(Control.PRESET_FULL_RECT)
		_build()
	visible = true
	on_enter(payload)


## Shell exit point.
func leave() -> void:
	on_exit()
	visible = false


## Override: build the page's nodes. Called once.
func _build() -> void:
	pass


## Override: react to being shown (start timers, reset selection, play cues).
func on_enter(_payload: Dictionary = {}) -> void:
	pass


## Override: react to being hidden (stop timers, stop loops).
func on_exit() -> void:
	pass


## Convenience for subclasses: report the next state to the shell.
func go_to(next_state: int, payload: Dictionary = {}) -> void:
	finished.emit(next_state, payload)


## Convenience: full-screen flat fill (ink for boot pages, white for the menu).
func add_backdrop(colour: Color) -> ColorRect:
	return UiPixel.backdrop(self, colour)
