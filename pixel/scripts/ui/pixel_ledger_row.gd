class_name PixelLedgerRow
extends Control
## One of the Ledger's eight rows (GDD-07 §5.5).
##
##   emblem stamp (steps lit = beats completed) · slot name · `{class} · {chapter}` · date
##   Row actions: select (confirm) / `DELETE` (blood confirm card) — the card
##   itself lives on the screen, this row only asks for it.
##
## Used rows get a stamp, a name line, the class/chapter line, a right-aligned
## date and a `DELETE` button. Free slots get `— empty —` dimmed to 40 % and no
## actions at all, exactly as the spec writes them.

signal selected(row_index: int)
signal delete_requested(row_index: int)
signal focused(row_index: int)

const ROW_HEIGHT := 24
const STAMP_X := 8.0
const TEXT_X := 40.0
const SELECT_WIDTH := 288.0

var row_index: int = 0
var used: bool = false

var _select: Button
var _delete: Button
var _focus_bar: ColorRect
var _name_label: Label
var _detail_label: Label
var _date_label: Label
var _stamp: TextureRect
var _empty_label: Label


## Build the row from a save-slot dictionary (`{}` for a free slot).
func setup(index: int, entry: Dictionary, steps_lit: int, rect: Rect2) -> void:
	row_index = index
	used = not entry.is_empty()
	mouse_filter = Control.MOUSE_FILTER_PASS
	UiPixel.place(self, rect)

	_select = Button.new()
	_select.flat = true
	_select.focus_mode = Control.FOCUS_NONE
	_select.mouse_filter = Control.MOUSE_FILTER_PASS
	_select.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	add_child(_select)
	UiPixel.place(_select, Rect2(0, 0, SELECT_WIDTH, rect.size.y))
	_select.pressed.connect(func() -> void: selected.emit(row_index))

	_focus_bar = UiPixel.rect(self, Palette.bronze)
	UiPixel.place(_focus_bar, Rect2(0, 5, 2, 14))
	_focus_bar.visible = false

	if used:
		_build_used(entry, steps_lit, rect)
	else:
		_build_empty(rect)


## Focus ring for keyboard navigation (the shell's bronze mark, same as Options).
func set_row_focus(on: bool) -> void:
	if _focus_bar != null:
		_focus_bar.visible = on
	if used and _delete != null:
		_delete.modulate.a = 1.0 if on else 0.85


func delete_button() -> Button:
	return _delete


# --- build -------------------------------------------------------------

func _build_used(entry: Dictionary, steps_lit: int, rect: Rect2) -> void:
	_stamp = UiPixel.image(self, UiPixel.UI_DIR + Brand.stamp_file(steps_lit))
	UiPixel.place(_stamp, Rect2(STAMP_X, 0, 24, 24))

	_name_label = UiPixel.label(self, String(entry.get("name", "")), UiPixel.UI, Palette.ink)
	UiPixel.place(_name_label, Rect2(TEXT_X, 2, 200, 8))

	_detail_label = UiPixel.label(self, _detail_text(entry), UiPixel.UI, Palette.ink)
	_detail_label.modulate.a = 0.7
	UiPixel.place(_detail_label, Rect2(TEXT_X, 13, 200, 8))

	# §5.5 says "date": the save's ISO stamp, trimmed to its date half.
	var stamp: String = String(entry.get("signed_at", ""))
	_date_label = UiPixel.label(
		self, stamp.split("T")[0], UiPixel.UI, Palette.ink, HORIZONTAL_ALIGNMENT_RIGHT
	)
	_date_label.modulate.a = 0.6
	UiPixel.place(_date_label, Rect2(rect.size.x - 148, 2, 96, 8))

	_delete = UiPixel.button(self, ShellData.t("STR_LEDGER_DELETE"), _on_delete)
	UiPixel.place(_delete, Rect2(rect.size.x - 46, 3, 46, 18))
	_delete.modulate.a = 0.85


func _build_empty(rect: Rect2) -> void:
	_empty_label = UiPixel.label(self, ShellData.t("STR_LEDGER_EMPTY"), UiPixel.UI, Palette.ink)
	_empty_label.modulate.a = 0.4  # §5.5: "— empty —" dim 40 %
	UiPixel.place(_empty_label, Rect2(TEXT_X, 0, rect.size.x - TEXT_X, rect.size.y))
	_select.disabled = true
	_select.mouse_default_cursor_shape = Control.CURSOR_ARROW


## The spec's literal second line: `{class} · {chapter}` (§5.5).
func _detail_text(entry: Dictionary) -> String:
	var klass := String(entry.get("class", "—"))
	var chapter := String(entry.get("chapter", ""))
	return "%s · %s" % [klass, chapter] if not chapter.is_empty() else klass


func _on_delete() -> void:
	delete_requested.emit(row_index)
