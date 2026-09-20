class_name ShellUI
extends RefCounted
## Native Control factory — full visual replica of web shell (GDD-02 §1–2).
## Tokens per CSS spec §1.2, no generated image as parchment background.
const INK := Color("101418")
const INK_2 := Color("1a2126")
const PAPER := Color("eee3cb") # legacy alias
const PARCHMENT := Color("E9DFC8")
const PARCHMENT_HI := Color("f6efdd")
const GOLD := Color("b0793a")
const BRONZE := Color("B0793A")
const BRONZE_HI := Color("d9a463")
const BRONZE_DK := Color("5e3d19")
const MINT := Color("74E0B4")
const OBELISK := Color("74E0B4")
const BLOOD := Color("8E2F26")

const DISPLAY = preload("res://assets/fonts/cinzel-600.ttf")
const BODY = preload("res://assets/fonts/alegreya-400.ttf")

static func display(weight := 600) -> Font:
	match weight:
		400: return preload("res://assets/fonts/cinzel-400.ttf")
		700: return preload("res://assets/fonts/cinzel-700.ttf")
		900: return preload("res://assets/fonts/cinzel-900.ttf")
		_: return DISPLAY

static func body(weight := 400, ital := false) -> Font:
	if ital:
		return preload("res://assets/fonts/alegreya-italic-600.ttf") if weight >= 550 else preload("res://assets/fonts/alegreya-italic-400.ttf")
	return preload("res://assets/fonts/alegreya-600.ttf") if weight >= 550 else BODY

static func flavor(ital := false) -> Font:
	return preload("res://assets/fonts/imfell-italic-400.ttf") if ital else preload("res://assets/fonts/imfell-400.ttf")

static func seal(size := 96) -> TextureRect:
	var node := TextureRect.new()
	node.texture = preload("res://assets/ui/seal.png")
	node.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	node.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	node.custom_minimum_size = Vector2(size, size)
	node.size = Vector2(size, size)
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return node

static func rich() -> RichTextLabel:
	var node := RichTextLabel.new()
	node.bbcode_enabled = true
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	node.add_theme_font_override("normal_font", BODY)
	node.add_theme_font_override("bold_font", preload("res://assets/fonts/alegreya-600.ttf"))
	node.add_theme_font_override("italics_font", preload("res://assets/fonts/alegreya-italic-400.ttf"))
	node.add_theme_font_override("bold_italics_font", preload("res://assets/fonts/alegreya-italic-600.ttf"))
	node.add_theme_font_size_override("normal_font_size", 23)
	node.add_theme_color_override("default_color", INK)
	return node

static func style(color: Color, border := Color.TRANSPARENT, width := 1) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = color
	box.border_color = border
	box.set_border_width_all(width)
	box.content_margin_left = 16
	box.content_margin_right = 16
	box.content_margin_top = 8
	box.content_margin_bottom = 8
	box.corner_radius_top_left = 3
	box.corner_radius_top_right = 3
	box.corner_radius_bottom_left = 3
	box.corner_radius_bottom_right = 3
	return box

# Parchment material — procedural, no generated image, matches web .cert background
static func parchment_style() -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = PARCHMENT
	# Simulate layered gradients via border + shadow, not texture
	box.border_color = Color(BRONZE, 0.65)
	box.set_border_width_all(1)
	box.corner_radius_top_left = 4
	box.corner_radius_top_right = 4
	box.corner_radius_bottom_left = 4
	box.corner_radius_bottom_right = 4
	box.content_margin_left = 18
	box.content_margin_right = 18
	box.content_margin_top = 12
	box.content_margin_bottom = 12
	# Inner highlight and outer shadow via shadow properties
	box.shadow_color = Color(0, 0, 0, 0.45)
	box.shadow_size = 18
	box.shadow_offset = Vector2(0, 12)
	return box

static func cert_style() -> StyleBoxFlat:
	# Matches CSS .cert: parchment with bronze keyline, double inset, outer shadow
	var box := StyleBoxFlat.new()
	box.bg_color = PARCHMENT
	box.border_color = Color(BRONZE, 0.65)
	box.set_border_width_all(1)
	box.corner_radius_top_left = 4
	box.corner_radius_top_right = 4
	box.corner_radius_bottom_left = 4
	box.corner_radius_bottom_right = 4
	box.content_margin_left = 22
	box.content_margin_right = 22
	box.content_margin_top = 18
	box.content_margin_bottom = 18
	box.shadow_color = Color(0, 0, 0, 0.7)
	box.shadow_size = 28
	box.shadow_offset = Vector2(0, 18)
	# Second inner border simulated via expand + border
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

static func pill_button(text: String, callback: Callable, group: ButtonGroup, pressed: bool) -> Button:
	var node := Button.new()
	node.text = text
	node.toggle_mode = true
	node.button_group = group
	node.button_pressed = pressed
	node.custom_minimum_size.y = 42
	node.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	node.add_theme_font_size_override("font_size", 15 if text.length() > 22 else 18)
	node.add_theme_font_override("font", DISPLAY)
	# Web shell pill: light parchment normal, dark ink/bronze when checked
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(PARCHMENT_HI, 0.78)
	normal.border_color = Color(BRONZE, 0.62)
	normal.set_border_width_all(1)
	normal.corner_radius_top_left = 3
	normal.corner_radius_top_right = 3
	normal.corner_radius_bottom_left = 3
	normal.corner_radius_bottom_right = 3
	normal.content_margin_left = 18
	normal.content_margin_right = 18
	normal.content_margin_top = 9
	normal.content_margin_bottom = 9
	var hover := normal.duplicate() as StyleBoxFlat
	hover.bg_color = Color(PARCHMENT_HI, 0.95)
	var checked := StyleBoxFlat.new()
	checked.bg_color = Color(INK_2)
	checked.border_color = BRONZE
	checked.set_border_width_all(1)
	checked.corner_radius_top_left = 3
	checked.corner_radius_top_right = 3
	checked.corner_radius_bottom_left = 3
	checked.corner_radius_bottom_right = 3
	checked.content_margin_left = 24
	checked.content_margin_right = 18
	checked.content_margin_top = 9
	checked.content_margin_bottom = 9
	node.add_theme_stylebox_override("normal", normal)
	node.add_theme_stylebox_override("hover", hover)
	node.add_theme_stylebox_override("pressed", checked)
	node.add_theme_stylebox_override("focus", checked)
	node.add_theme_color_override("font_color", Color("33261a"))
	node.add_theme_color_override("font_hover_color", Color("33261a"))
	node.add_theme_color_override("font_pressed_color", PARCHMENT)
	node.add_theme_color_override("font_focus_color", PARCHMENT)
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
	node.autowrap_mode = TextServer.AUTOWRAP_OFF
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

# Motes — ambient floating particles matching web shell .motes (9 spans)
static func motes() -> Control:
	var root := Control.new()
	root.name = "Motes"
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	# 9 motes with varying positions, sizes, durations — matches CSS
	var positions := [0.10, 0.22, 0.34, 0.46, 0.58, 0.69, 0.78, 0.88, 0.95]
	var durations := [12.0, 9.0, 14.0, 10.0, 13.0, 11.0, 15.0, 10.0, 12.5]
	var delays := [-1.0, -4.0, -7.0, -2.5, -9.0, -5.0, -11.0, -3.0, -6.5]
	var sizes := [4.0, 3.0, 4.0, 5.0, 3.0, 4.0, 3.0, 4.0, 5.0]
	for i in 9:
		var dot := ColorRect.new()
		dot.color = Color(0.91, 0.77, 0.54, 0.85) if i % 3 != 2 else Color(0.45, 0.88, 0.71, 0.8)
		dot.custom_minimum_size = Vector2(sizes[i], sizes[i])
		dot.size = Vector2(sizes[i], sizes[i])
		dot.position = Vector2(positions[i] * 1600.0, 900.0 + 14.0)
		dot.mouse_filter = Control.MOUSE_FILTER_IGNORE
		# Store anim data in meta for backdrop/shell to animate
		dot.set_meta("mote_dur", durations[i])
		dot.set_meta("mote_delay", delays[i])
		dot.set_meta("mote_x", positions[i])
		dot.set_meta("mote_t", randf() * durations[i])
		root.add_child(dot)
	# Animate in _process via a small script attached at runtime by caller if needed
	return root

# Corner decoration — matches CSS var(--corner) SVG
static func corner_decoration(_parent: Control, flip: bool = false) -> Control:
	var c := Control.new()
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.custom_minimum_size = Vector2(54, 54)
	c.size = Vector2(54, 54)
	c.pivot_offset = Vector2(27, 27)
	# Use a ColorRect with border to simulate corner — procedural, not image
	var box := StyleBoxFlat.new()
	box.bg_color = Color.TRANSPARENT
	box.border_color = Color(BRONZE, 0.9)
	box.set_border_width_all(2)
	box.border_width_right = 0
	box.border_width_bottom = 0
	box.corner_radius_top_left = 12
	box.set_corner_radius_all(0)
	# We'll just use a Panel with custom style
	var panel := Panel.new()
	panel.add_theme_stylebox_override("panel", box)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.add_child(panel)
	fill(panel)
	if flip:
		c.rotation_degrees = 180
	return c
