class_name PixelPillGroup
extends Control
## A segmented group of pills (GDD-07 §5.5 / §5.6).
##
## "nine-patch parchment pills, h 16, gap 4; selected pill = bronze fill + ink
## text" (§5.5). Used by the First Run contract page and by every options row
## whose control type is `list` or `toggle`.
##
## The group lays itself out, so callers only pass values and a rect. Keyboard
## focus moves between the pills with the arrow keys (Godot's own focus
## neighbour search does the horizontal step); the mouse picks one directly.

signal value_changed(value: String)

const PILL_HEIGHT := 16
const PILL_GAP := 4

var values: PackedStringArray = PackedStringArray()
var value: String = ""

var _pills: Array[Button] = []


## Width the group will occupy for `option_values`, in pixels. Rows use it to
## right-align their control before the group exists.
static func measure(option_values: Array) -> float:
	var width := 0.0
	for raw in option_values:
		width += text_width_of(String(raw)) + 6.0 + PILL_GAP
	return maxf(0.0, width - PILL_GAP)


## Width of one pill holding `text` (text plus the 3 px inner padding a side).
static func text_width_of(text: String) -> float:
	return UiPixel.text_width(text, UiPixel.UI)


## Build the group inside `rect`: one pill per entry of `option_values`.
func setup(option_values: Array, current: String, rect: Rect2) -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	UiPixel.place(self, rect)
	for raw in option_values:
		values.append(String(raw))
	if values.is_empty():
		push_error("PixelPillGroup.setup: no values given")
		return
	value = current if values.has(current) else values[0]
	_rebuild()


## Change the selection programmatically (no signal).
func set_value(next: String) -> void:
	if not values.has(next) or next == value:
		return
	value = next
	_refresh()


func index() -> int:
	return maxi(0, values.find(value))


## The pill node for a value, for tooltips and tests.
func pill_for(target_value: String) -> Button:
	var at := values.find(target_value)
	return _pills[at] if at >= 0 and at < _pills.size() else null


func select_index(at: int) -> void:
	if at < 0 or at >= values.size():
		return
	_choose(values[at])


func _rebuild() -> void:
	for pill in _pills:
		pill.queue_free()
	_pills.clear()
	var x := 0.0
	for index in values.size():
		var pill := UiPixel.pill(self, values[index], _choose.bind(values[index]))
		var width := UiPixel.text_width(values[index], UiPixel.UI) + 6.0  # 3 px padding
		UiPixel.place(pill, Rect2(x, 0, width, PILL_HEIGHT))
		_pills.append(pill)
		x += width + PILL_GAP
	_refresh()


func _refresh() -> void:
	for index in _pills.size():
		_pills[index].button_pressed = values[index] == value


func _choose(next: String) -> void:
	if next == value:
		_refresh()  # keep the visual state even when the value did not change
		return
	value = next
	_refresh()
	Sound.play("SFX_UI_CONFIRM")
	value_changed.emit(value)
