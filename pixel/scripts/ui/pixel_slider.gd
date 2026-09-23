class_name PixelSlider
extends Control
## A 0-100 slider drawn as ten pips (GDD-07 §5.6: "slider-as-10-pips").
##
## One pip per ten points: the pip count shown filled is `round(value / 10)`.
## Click a pip to jump to that step; the arrow keys step by ten (so 0 is
## reachable even though the mouse only addresses the ten buckets). The numeric
## readout sits to the right of the pips, as the spec's right-aligned control.

signal value_changed(value: int)

const PIP_COUNT := 10
const PIP_WIDTH := 6
const PIP_HEIGHT := 10
const PIP_GAP := 1
const READOUT_WIDTH := 22

var value: int = 50

var _pips: Array[ColorRect] = []
var _readout: Label


func setup(initial: int, rect: Rect2) -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	focus_mode = Control.FOCUS_ALL
	UiPixel.place(self, rect)
	value = clampi(initial, 0, 100)

	var x := 0.0
	for _i in PIP_COUNT:
		var pip := UiPixel.rect(self, Palette.bronze)
		UiPixel.place(pip, Rect2(x, (rect.size.y - PIP_HEIGHT) / 2.0, PIP_WIDTH, PIP_HEIGHT))
		_pips.append(pip)
		x += PIP_WIDTH + PIP_GAP

	# The options panels are parchment, so the readout is ink, not parchment.
	_readout = UiPixel.label(
		self, str(value), UiPixel.UI, Palette.ink, HORIZONTAL_ALIGNMENT_RIGHT
	)
	UiPixel.place(_readout, Rect2(x + 4, 0, READOUT_WIDTH, rect.size.y))
	_refresh()


func set_value(next: int, emit: bool = false) -> void:
	var clamped := clampi(next, 0, 100)
	if clamped == value:
		return
	value = clamped
	_refresh()
	if emit:
		value_changed.emit(value)


func pips_filled() -> int:
	return int(round(value / 10.0))


func _refresh() -> void:
	var filled := pips_filled()
	for index in _pips.size():
		_pips[index].color = Palette.bronze if index < filled else Palette.bronze_0
	if _readout != null:
		_readout.text = str(value)


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var button := event as InputEventMouseButton
		if button.button_index == MOUSE_BUTTON_LEFT and button.pressed:
			accept_event()
			# Which pip did we hit? (Clamped, so a click past the end sets 100.)
			var at := clampi(int(button.position.x / (PIP_WIDTH + PIP_GAP)), 0, PIP_COUNT - 1)
			set_value((at + 1) * 10, true)
	elif event.is_action_pressed("menu_left") or event.is_action_pressed("ui_left"):
		accept_event()
		set_value(value - 10, true)
	elif event.is_action_pressed("menu_right") or event.is_action_pressed("ui_right"):
		accept_event()
		set_value(value + 10, true)


## Keyboard focus ring: the readout brightens while the slider holds focus.
func _notification(what: int) -> void:
	if _readout == null:
		return
	if what == NOTIFICATION_FOCUS_ENTER:
		_readout.add_theme_color_override("font_color", Palette.bronze_0)
	elif what == NOTIFICATION_FOCUS_EXIT:
		_readout.add_theme_color_override("font_color", Palette.ink)
