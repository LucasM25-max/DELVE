class_name PixelOptionsRow
extends Control
## One schema-driven row of the Options screen (GDD-07 §5.6).
##
## Row anatomy, from the spec: `row h 20`, label on the left, "controls
## right-aligned: segmented pills / toggle / slider-as-10-pips / rebind button".
## The row builds the right control for its `control` type out of the schema and
## owns nothing else — committing, saving and help display belong to the screen.
##
## Control types (from `data/options_schema.json`):
##   list     segmented pills (also used for multi-value rows like Colourblind)
##   toggle   two pills, On / Off
##   slider   10 pips + numeric readout
##   locked   a dimmed read-only value with an explanatory help line
##   rebind   a pill that shows the current binding and captures the next key

signal value_changed(row_id: String, value: Variant)
signal rebind_requested(row_id: String, action: String)
signal focused(row_index: int)

const ROW_HEIGHT := 20
const LABEL_X := 8.0
const CONTROL_RIGHT := 372.0  ## panel-relative: 4 px clear of the scrollbar
const SLIDER_WIDTH := 95.0

var row_id: String = ""
var row_index: int = 0
var action: String = ""
var help: String = ""
var control_type: String = ""
var values: Array = []
var locked: bool = false
var tag: String = ""

var pill_group: PixelPillGroup
var slider: PixelSlider
var rebind_button: Button

var _label: Label
var _focus_bar: ColorRect
var _value_label: Label
var _current: Variant


## Build the row from a schema entry. `rect` is panel-relative to the screen.
func setup(schema: Dictionary, current: Variant, index: int, rect: Rect2) -> void:
	row_id = String(schema.get("id", ""))
	row_index = index
	control_type = String(schema.get("control", "list"))
	help = String(schema.get("help", ""))
	tag = String(schema.get("tag", ""))
	locked = control_type == "locked" or bool(schema.get("locked", false))
	action = String(schema.get("action", ""))
	values = schema.get("values", [])
	_current = current

	mouse_filter = Control.MOUSE_FILTER_PASS
	UiPixel.place(self, rect)
	# An invisible full-row click target so hovering/clicking the row focuses it.
	var hit := UiPixel.rect(self, Color(0, 0, 0, 0))
	UiPixel.place(hit, Rect2(0, 0, rect.size.x, rect.size.y))
	hit.mouse_filter = Control.MOUSE_FILTER_PASS
	hit.gui_input.connect(_on_row_input)

	_focus_bar = UiPixel.rect(self, Palette.bronze)
	UiPixel.place(_focus_bar, Rect2(0, 2, 2, rect.size.y - 4))
	_focus_bar.visible = false

	# Panels are parchment, so rows read in ink (contrast >= 4.5:1, §5).
	_label = UiPixel.label(self, String(schema.get("label", row_id)), UiPixel.UI, Palette.ink)
	UiPixel.place(_label, Rect2(LABEL_X, 0, CONTROL_RIGHT - LABEL_X, rect.size.y))

	match control_type:
		"toggle", "list":
			_build_pills()
		"slider":
			_build_slider(rect)
		"rebind":
			_build_rebind()
		_:
			_build_locked(rect)


## The value the player has chosen (String for pills/rebind, int for sliders).
func value() -> Variant:
	match control_type:
		"slider":
			return slider.value if slider != null else int(_current)
		"rebind":
			return rebind_button.text if rebind_button != null else String(_current)
		"locked":
			return String(_current)
		_:
			return pill_group.value if pill_group != null else String(_current)


## Reflect an external change (schema default, save reload) without emitting.
func set_value(next: Variant) -> void:
	_current = next
	match control_type:
		"slider":
			if slider != null:
				slider.set_value(int(next), false)
		"rebind":
			if rebind_button != null:
				rebind_button.text = String(next)
				action = action if not action.is_empty() else row_id
		_:
			if pill_group != null:
				pill_group.set_value(String(next))


## Focus ring for keyboard navigation.
func set_row_focus(on: bool) -> void:
	if _focus_bar == null:
		return
	_focus_bar.visible = on
	var colour := Palette.bronze_0 if on else Palette.ink
	if locked:
		colour = Palette.stone_1
	_label.add_theme_color_override("font_color", colour)


func help_text() -> String:
	if control_type == "rebind":
		# The schema's help is empty for rebinds; the flow explains itself.
		return ""
	return help


## True when the row is showing "Press a key…" (rebind capture in progress).
func is_listening() -> bool:
	return rebind_button != null and bool(rebind_button.get_meta("listening", false))


func set_listening(on: bool, prompt: String, restore: String) -> void:
	if rebind_button == null:
		return
	rebind_button.set_meta("listening", on)
	rebind_button.text = prompt if on else restore
	rebind_button.button_pressed = on


# --- builders ----------------------------------------------------------

func _build_pills() -> void:
	var width := PixelPillGroup.measure(values)
	pill_group = PixelPillGroup.new()
	add_child(pill_group)
	var rect := Rect2(CONTROL_RIGHT - width, 2, width, PixelPillGroup.PILL_HEIGHT)
	pill_group.setup(values, String(_current), rect)
	pill_group.value_changed.connect(_on_pill_changed)


func _build_slider(rect: Rect2) -> void:
	slider = PixelSlider.new()
	add_child(slider)
	slider.setup(int(_current), Rect2(CONTROL_RIGHT - SLIDER_WIDTH, 0, SLIDER_WIDTH, rect.size.y))
	slider.value_changed.connect(_on_slider_changed)
	slider.focus_entered.connect(func() -> void: focused.emit(row_index))


func _build_rebind() -> void:
	rebind_button = UiPixel.pill(
		self, String(_current), func() -> void: rebind_requested.emit(row_id, action)
	)
	# Long bindings ("WASD / arrows") get the room the spec's table implies.
	var width := maxf(60.0, UiPixel.text_width(String(_current), UiPixel.UI) + 12.0)
	UiPixel.place(rebind_button, Rect2(CONTROL_RIGHT - width, 2, width, PixelPillGroup.PILL_HEIGHT))
	rebind_button.focus_entered.connect(func() -> void: focused.emit(row_index))


func _build_locked(rect: Rect2) -> void:
	var text := String(_current)
	if values.size() > 0 and text.is_empty():
		text = values[0]
	_value_label = UiPixel.label(
		self, text, UiPixel.UI, Palette.ink, HORIZONTAL_ALIGNMENT_RIGHT
	)
	UiPixel.place(_value_label, Rect2(CONTROL_RIGHT - 120, 0, 120, rect.size.y))
	_label.modulate.a = 0.5
	_value_label.modulate.a = 0.5


# --- handlers ----------------------------------------------------------

func _on_row_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		focused.emit(row_index)


func _on_pill_changed(next: String) -> void:
	_current = next
	value_changed.emit(row_id, next)


func _on_slider_changed(next: int) -> void:
	_current = next
	value_changed.emit(row_id, next)
