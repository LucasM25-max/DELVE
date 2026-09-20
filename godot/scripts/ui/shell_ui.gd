class_name ShellUI
extends RefCounted
## Native Control factory; shared visual tokens, no HTML/WebView dependency.
const INK := Color("172126")
const PAPER := Color("eee3cb")
const GOLD := Color("b88b50")
const MINT := Color("74e0b4")
const DISPLAY = preload("res://assets/fonts/cinzel.ttf")
const BODY = preload("res://assets/fonts/alegreya.ttf")

static func style(color: Color, border := Color.TRANSPARENT, width := 1) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = color
	box.border_color = border
	box.set_border_width_all(width)
	box.content_margin_left = 16
	box.content_margin_right = 16
	box.content_margin_top = 8
	box.content_margin_bottom = 8
	return box

static func theme_for(dark := false) -> Theme:
	var theme := Theme.new()
	theme.default_font = BODY
	theme.default_font_size = 24
	var text := PAPER if dark else INK
	var fill := Color(0.045, 0.06, 0.065, 0.75) if dark else Color("e3d2ae")
	for type in ["Label", "RichTextLabel", "CheckButton", "TabBar", "LineEdit", "PopupMenu", "OptionButton", "Button"]:
		theme.set_color("font_color", type, text)
	for type in ["Button", "OptionButton"]:
		theme.set_font("font", type, DISPLAY)
		theme.set_font_size("font_size", type, 19)
		theme.set_color("font_hover_color", type, text)
		theme.set_color("font_pressed_color", type, text)
		theme.set_color("font_focus_color", type, text)
		theme.set_color("font_disabled_color", type, Color(0.45, 0.43, 0.39, 0.8))
		theme.set_stylebox("normal", type, style(fill, Color(0.6, 0.43, 0.23, 0.6)))
		theme.set_stylebox("hover", type, style(fill.lightened(0.12), GOLD, 2))
		theme.set_stylebox("pressed", type, style(fill.darkened(0.12), GOLD, 2))
		theme.set_stylebox("disabled", type, style(Color(fill, 0.3), Color(GOLD, 0.2)))
		theme.set_stylebox("focus", type, style(Color.TRANSPARENT, MINT if dark else Color("725323"), 2))
	theme.set_stylebox("panel", "PopupMenu", style(fill, GOLD))
	theme.set_stylebox("hover", "PopupMenu", style(fill.lightened(0.18)))
	theme.set_color("font_hover_color", "PopupMenu", text)
	theme.set_stylebox("normal", "LineEdit", style(fill, GOLD))
	theme.set_stylebox("focus", "LineEdit", style(fill, MINT, 2))
	theme.set_stylebox("background", "ProgressBar", style(Color("303b3a")))
	theme.set_stylebox("fill", "ProgressBar", style(GOLD))
	theme.set_constant("separation", "VBoxContainer", 14)
	theme.set_constant("separation", "HBoxContainer", 14)
	return theme

static func fill(control: Control) -> void:
	control.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

static func at(control: Control, parent: Node, rect: Rect2) -> void:
	parent.add_child(control)
	control.position = rect.position
	control.size = rect.size

static func label(text: String, font_size := 24, display := false) -> Label:
	var node := Label.new()
	node.text = text
	node.add_theme_font_size_override("font_size", font_size)
	if display:
		node.add_theme_font_override("font", DISPLAY)
	node.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return node

static func button(text: String, callback: Callable) -> Button:
	var node := Button.new()
	node.text = text
	node.custom_minimum_size.y = 48
	node.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	node.pressed.connect(callback)
	return node

static func image(path: String) -> TextureRect:
	var node := TextureRect.new()
	node.texture = load(path)
	node.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	node.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return node

static func centered_text(parent: Node, text: String, rect: Rect2, font_size := 24, display := false) -> Label:
	var node := label(text, font_size, display)
	node.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	node.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	at(node, parent, rect)
	return node

static func rule() -> HSeparator:
	var line := HSeparator.new()
	line.add_theme_stylebox_override("separator", style(Color(GOLD, 0.5)))
	line.custom_minimum_size.y = 2
	return line

static func scroll_column(parent: Control) -> VBoxContainer:
	var scroll := ScrollContainer.new()
	parent.add_child(scroll)
	fill(scroll)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.follow_focus = true
	var column := VBoxContainer.new()
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(column)
	return column
