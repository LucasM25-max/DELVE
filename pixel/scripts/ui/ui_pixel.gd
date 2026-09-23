class_name UiPixel
extends RefCounted
## UiPixel — the pixel UI kit (GDD-06 §7.3, GDD-07 §7.4).
##
## Every shell screen builds itself from these factories, so the look lives in
## one place: three bitmap fonts, three nine-patch panels, one button style and
## the palette. Screens never load a texture or set a font by hand.
##
##     var title := UiPixel.label(self, "DELVE", UiPixel.DISPLAY, Palette.parchment)
##     UiPixel.place(title, Rect2(29, 22, 96, 24))
##
## Sizes are the fonts' baked pixel sizes (5 / 8 / 10) — text is never scaled,
## so no glyph ever sits on a half pixel.

const UI := &"ui"            ## pixel_ui_5    — chrome, labels, stamps
const BODY := &"body"        ## pixel_body_8  — prose: legal, tips, cards
const DISPLAY := &"display"  ## pixel_display_10 — the 5x7 face at 2x, menu items

const FONT_PATHS := {
	UI: "res://assets/fonts/pixel_ui_5.fnt",
	BODY: "res://assets/fonts/pixel_body_8.fnt",
	DISPLAY: "res://assets/fonts/pixel_display_10.fnt",
}
const FONT_SIZES := {UI: 5, BODY: 8, DISPLAY: 10}

const UI_DIR := "res://assets/pixel/ui/"
const KIT_PATH := UI_DIR + "ui_kit.json"

static var _fonts: Dictionary = {}
static var _kit: Dictionary = {}


# --- fonts -------------------------------------------------------------

## The FontFile for a font kind (`UI`, `BODY`, `DISPLAY`), loaded once.
static func font(kind: StringName = UI) -> Font:
	if not _fonts.has(kind):
		var path: String = FONT_PATHS.get(kind, FONT_PATHS[UI])
		var loaded := load(path)
		if loaded == null:
			push_error("UiPixel: cannot load font %s" % path)
		_fonts[kind] = loaded
	return _fonts[kind]


## Baked pixel size for a font kind.
static func font_size(kind: StringName = UI) -> int:
	return int(FONT_SIZES.get(kind, 5))


## Width of `text` in pixels when drawn in `kind`.
static func text_width(text: String, kind: StringName = UI) -> float:
	var face := font(kind)
	if face == null:
		return 0.0
	return face.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, font_size(kind)).x


# --- primitives --------------------------------------------------------

## Position and size a Control on the 480x270 canvas (integer pixels only).
static func place(control: Control, rect: Rect2) -> void:
	control.position = Vector2(roundf(rect.position.x), roundf(rect.position.y))
	control.size = Vector2(roundf(rect.size.x), roundf(rect.size.y))


## Create a Label with the kit's font, size and colour already applied.
static func label(
	parent: Node,
	text: String,
	kind: StringName = UI,
	colour: Color = Color("#E9DFC8"),
	align: int = HORIZONTAL_ALIGNMENT_LEFT
) -> Label:
	var node := Label.new()
	node.text = text
	node.horizontal_alignment = align
	node.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	node.add_theme_font_override("font", font(kind))
	node.add_theme_font_size_override("font_size", font_size(kind))
	node.add_theme_color_override("font_color", colour)
	parent.add_child(node)
	return node


## A nine-patch panel: `style` is a key of `ui_kit.json` (`panel_parchment`,
## `panel_oak`, `panel_ink`).
static func panel(parent: Node, style: String = "panel_parchment") -> NinePatchRect:
	var entry := _style(style)
	var node := NinePatchRect.new()
	if not entry.is_empty():
		node.texture = _texture(String(entry.get("file", "")))
		var margin := int(entry.get("margin", 8))
		node.patch_margin_left = margin
		node.patch_margin_top = margin
		node.patch_margin_right = margin
		node.patch_margin_bottom = margin
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(node)
	return node


## A solid colour rectangle (dim overlays, underline bars, fills).
static func rect(parent: Node, colour: Color) -> ColorRect:
	var node := ColorRect.new()
	node.color = colour
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(node)
	return node


## A TextureRect at native size, nearest-filtered (project default).
static func image(parent: Node, path: String) -> TextureRect:
	var node := TextureRect.new()
	node.texture = _texture(path)
	node.stretch_mode = TextureRect.STRETCH_KEEP
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(node)
	return node


## A pixel button built from the kit's nine-patch button states. `on_pressed`
## is called with no arguments when the player activates it (mouse, or Space /
## Enter while it holds focus).
static func button(
	parent: Node,
	text: String,
	on_pressed: Callable = Callable(),
	kind: StringName = UI,
	family: String = "button"
) -> Button:
	var node := Button.new()
	node.text = text
	node.focus_mode = Control.FOCUS_ALL
	node.add_theme_font_override("font", font(kind))
	node.add_theme_font_size_override("font_size", font_size(kind))
	node.add_theme_color_override("font_color", Palette.ink)
	node.add_theme_color_override("font_hover_color", Palette.ink)
	node.add_theme_color_override("font_pressed_color", Palette.ink)
	node.add_theme_color_override("font_focus_color", Palette.ink)
	node.add_theme_color_override("font_disabled_color", Palette.stone_1)
	# `button` is the parchment face; `button_blood` is the destructive confirm
	# face §5.5 asks for (DELETE / BREAK), same frame, different fill.
	for state in ["normal", "hover", "pressed", "disabled"]:
		node.add_theme_stylebox_override(state, state_style(family, state))
	node.add_theme_stylebox_override("focus", state_style(family, "hover"))
	parent.add_child(node)
	if on_pressed.is_valid():
		node.pressed.connect(on_pressed)
	return node


## A full-screen flat fill, used for the boot-screen ink background and (for
## now) the plain white menu background.
static func backdrop(parent: Node, colour: Color) -> ColorRect:
	var node := rect(parent, colour)
	node.mouse_filter = Control.MOUSE_FILTER_STOP
	node.set_anchors_preset(Control.PRESET_FULL_RECT)
	return node


## A nine-patch sprite by name from the kit (`wax_seal`, `item_cursor`,
## `portrait_frame`, `tooltip_box`).
static func sprite(parent: Node, name: String) -> TextureRect:
	var entry: Dictionary = _kit_data().get("sprites", {}).get(name, {})
	return image(parent, String(entry.get("file", name + ".png")))


## StyleBoxTexture for any {state} kit family (`pill`, `tab`, `button`).
static func state_style(family: String, state: String) -> StyleBoxTexture:
	var entry := _style(family)
	var box := StyleBoxTexture.new()
	var pattern: String = String(entry.get("file", family + "_{state}.png"))
	box.texture = _texture(pattern.replace("{state}", state))
	var margin := int(entry.get("margin", 4))
	box.texture_margin_left = margin
	box.texture_margin_top = margin
	box.texture_margin_right = margin
	box.texture_margin_bottom = margin
	# Breathing room so a label never touches the frame.
	box.content_margin_left = 6.0
	box.content_margin_right = 6.0
	box.content_margin_top = 3.0
	box.content_margin_bottom = 3.0
	return box


## A segmented pill button (`pill_normal` / `pill_selected` / `pill_hover`).
static func pill(
	parent: Node,
	text: String,
	on_pressed: Callable,
	kind: StringName = UI
) -> Button:
	var node := Button.new()
	node.text = text
	node.toggle_mode = true
	node.focus_mode = Control.FOCUS_ALL
	node.add_theme_font_override("font", font(kind))
	node.add_theme_font_size_override("font_size", font_size(kind))
	for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		node.add_theme_color_override(state, Palette.ink)
	node.add_theme_stylebox_override("normal", state_style("pill", "normal"))
	node.add_theme_stylebox_override("hover", state_style("pill", "hover"))
	node.add_theme_stylebox_override("focus", state_style("pill", "hover"))
	node.add_theme_stylebox_override("pressed", state_style("pill", "selected"))
	node.add_theme_stylebox_override("disabled", state_style("pill", "normal"))
	var selected := state_style("pill", "selected")
	for state in ["hover_pressed", "disabled_pressed"]:
		node.add_theme_stylebox_override(state, selected)
	node.add_theme_color_override("font_disabled_color", Palette.stone_1)
	parent.add_child(node)
	if on_pressed.is_valid():
		node.pressed.connect(on_pressed)
	return node


## A tab button for the options rail (`tab_normal` / `tab_selected`).
static func tab(
	parent: Node,
	text: String,
	on_pressed: Callable,
	kind: StringName = UI
) -> Button:
	var node := Button.new()
	node.text = text
	node.toggle_mode = true
	node.focus_mode = Control.FOCUS_ALL
	node.clip_text = false  # labels may overhang the rail into its 8 px gap
	node.add_theme_font_override("font", font(kind))
	node.add_theme_font_size_override("font_size", font_size(kind))
	node.add_theme_color_override("font_color", Palette.parchment)
	node.add_theme_color_override("font_hover_color", Palette.parchment_3)
	node.add_theme_color_override("font_pressed_color", Palette.ink)
	node.add_theme_color_override("font_focus_color", Palette.parchment_3)
	node.add_theme_stylebox_override("normal", state_style("tab", "normal"))
	node.add_theme_stylebox_override("hover", state_style("tab", "hover"))
	node.add_theme_stylebox_override("focus", state_style("tab", "hover"))
	node.add_theme_stylebox_override("pressed", state_style("tab", "selected"))
	node.add_theme_stylebox_override("hover_pressed", state_style("tab", "selected"))
	parent.add_child(node)
	if on_pressed.is_valid():
		node.pressed.connect(on_pressed)
	return node


## A 4 px scrollbar pair (track + thumb) sized by `ratio` (0-1) and `offset`.
static func scrollbar(
	parent: Node,
	rect: Rect2,
	ratio: float,
	offset: float
) -> Array:
	var track := image(parent, UI_DIR + "scrollbar_track.png")
	UiPixel.place(track, rect)
	var thumb := image(parent, UI_DIR + "scrollbar_thumb.png")
	var span := rect.size.y - 8.0
	var height := maxf(8.0, span * clampf(ratio, 0.1, 1.0))
	UiPixel.place(thumb, Rect2(
		rect.position + Vector2(0, 4.0 + span * clampf(offset, 0.0, 1.0)),
		Vector2(rect.size.x, height)
	))
	return [track, thumb]


# --- text helpers ------------------------------------------------------

## Greedy word wrap measured with the real font, so a line can never overflow
## its panel. (GDD-06 §4.8 validates the 8 px face at ~58 characters per line
## across 480 px; this is what enforces it at runtime.)
static func wrap(text: String, width_px: float, kind: StringName = BODY) -> String:
	var face := font(kind)
	var size := font_size(kind)
	if face == null:
		return text
	var lines: PackedStringArray = PackedStringArray()
	var current := ""
	for word in text.split(" ", false):
		var candidate := word if current.is_empty() else current + " " + word
		var measured := face.get_string_size(candidate, HORIZONTAL_ALIGNMENT_LEFT, -1.0, size).x
		if measured > width_px and not current.is_empty():
			lines.append(current)
			current = word
		else:
			current = candidate
	if not current.is_empty():
		lines.append(current)
	return "\n".join(lines)


## Height of one text line in `kind`, including `line_spacing` (which may be
## negative, as the legal screen uses to tighten the 8 px face).
static func line_height(kind: StringName = UI, line_spacing: int = 0) -> float:
	var face := font(kind)
	if face == null:
		return float(font_size(kind))
	return face.get_height(font_size(kind)) + float(line_spacing)


## Wrapped size of `text` inside `width_px`: use it to flow blocks on screen
## instead of assuming how many lines a string takes.
static func measure_block(
	text: String,
	width_px: float,
	kind: StringName = BODY,
	line_spacing: int = 0
) -> Vector2:
	var wrapped := wrap(text, width_px, kind)
	var lines := wrapped.split("\n").size()
	var widest := 0.0
	for line in wrapped.split("\n"):
		widest = maxf(widest, text_width(line, kind))
	return Vector2(widest, float(lines) * line_height(kind, line_spacing))


## Multi-line block label (already wrapped) with an explicit line height.
static func block(
	parent: Node,
	text: String,
	kind: StringName,
	colour: Color,
	line_spacing: int = 0
) -> Label:
	var node := label(parent, text, kind, colour)
	node.autowrap_mode = TextServer.AUTOWRAP_OFF
	if line_spacing != 0:
		node.add_theme_constant_override("line_spacing", line_spacing)
	return node


# --- effects -----------------------------------------------------------

## Fade a node's alpha with a tween; returns the tween so callers can chain.
static func fade(node: CanvasItem, to_alpha: float, seconds: float) -> Tween:
	var tween := node.create_tween()
	tween.tween_property(node, "modulate:a", to_alpha, seconds)
	return tween


# --- internals ---------------------------------------------------------

static func _kit_data() -> Dictionary:
	if _kit.is_empty():
		if FileAccess.file_exists(KIT_PATH):
			var file := FileAccess.open(KIT_PATH, FileAccess.READ)
			var parsed: Variant = JSON.parse_string(file.get_as_text())
			_kit = parsed if typeof(parsed) == TYPE_DICTIONARY else {}
		else:
			push_error("UiPixel: %s is missing" % KIT_PATH)
	return _kit


static func _style(style: String) -> Dictionary:
	return _kit_data().get("styles", {}).get(style, {})


static func _texture(path: String) -> Texture2D:
	if path.is_empty():
		return null
	var full := path if path.begins_with("res://") else UI_DIR + path
	if not ResourceLoader.exists(full):
		push_error("UiPixel: missing texture %s" % full)
		return null
	return load(full) as Texture2D
