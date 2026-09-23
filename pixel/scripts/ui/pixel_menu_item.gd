class_name PixelMenuItem
extends Control
## One row of the main menu (GDD-07 §5.4).
##
## The row is 10 px display text with a bronze underline that draws left to
## right on hover (0.18 s) and stays full when selected. A disabled row is
## dimmed to 40 % and reports `denied` when the player presses it — that is how
## CONTINUE behaves with no signed contract.
##
## The row owns only its own visuals; the screen owns the sounds and decides
## what an activation means.

signal hovered(index: int)
signal activated(index: int)
signal denied(index: int)

const UNDERLINE_HEIGHT := 2

var index: int = 0
var id: String = ""
var enabled: bool = true

var _face: Label
var _underline: ColorRect
var _underline_tween: Tween
var _draw_seconds: float = 0.18


## Build the row inside `rect`, drawing `text` in the display face.
func setup(
	row_index: int,
	row_id: String,
	text: String,
	rect: Rect2,
	face_colour: Color,
	underline_colour: Color,
	underline_offset_y: int = 14,
	draw_seconds: float = 0.18
) -> void:
	index = row_index
	id = row_id
	_draw_seconds = draw_seconds

	mouse_filter = Control.MOUSE_FILTER_STOP
	UiPixel.place(self, rect)

	_face = UiPixel.label(self, text, UiPixel.DISPLAY, face_colour)
	UiPixel.place(_face, Rect2(0, 0, rect.size.x, rect.size.y))
	_face.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	_face.clip_text = true  # a longer label can never overrun the column
	_face.text = text

	_underline = UiPixel.rect(self, underline_colour)
	_underline.position = Vector2(0, underline_offset_y)
	_underline.size = Vector2(0, UNDERLINE_HEIGHT)
	_underline.visible = false

	mouse_entered.connect(_on_mouse_entered)
	gui_input.connect(_on_gui_input)
	# Text width measured in the real font: the underline is exactly as wide as
	# the word, per §5.4's `w_draw`.
	set_meta("text_width", UiPixel.text_width(text, UiPixel.DISPLAY))


func text_width() -> float:
	return float(get_meta("text_width", 0.0))


## Dim to 40 % when the row cannot be used yet (CONTINUE with no saves).
func set_enabled(on: bool) -> void:
	enabled = on
	modulate = Color(1, 1, 1, 1.0) if on else Color(1, 1, 1, 0.4)


## Hover / keyboard selection state: draws or clears the underline.
func set_highlight(on: bool) -> void:
	if _underline == null:
		return
	if _underline_tween != null and _underline_tween.is_running():
		_underline_tween.kill()
	if on:
		_underline.visible = true
		_underline.size.x = 0.0
		_underline_tween = create_tween()
		_underline_tween.tween_property(_underline, "size:x", text_width(), _draw_seconds)
	else:
		_underline.size.x = 0.0
		_underline.visible = false


## Selection confirmation: the underline snaps full and stays there.
func confirm_underline() -> void:
	set_highlight(true)
	_underline.size.x = text_width()


func _on_mouse_entered() -> void:
	if enabled:
		hovered.emit(index)


func _on_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var button := event as InputEventMouseButton
		if button.button_index == MOUSE_BUTTON_LEFT and button.pressed:
			if enabled:
				activated.emit(index)
			else:
				denied.emit(index)
