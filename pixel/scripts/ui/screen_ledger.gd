extends ShellScreen
## The contract ledger (GDD-07 §5.5) — reached from CONTINUE.
##
##   panel (60, 24, 360, 222), title `The contract ledger`
##   8 rows, 24 px each, at y 48 + 24i:
##     emblem stamp (steps lit = beats completed) · slot name · `{class} · {chapter}` · date
##   row actions: select (confirm) / `DELETE` (blood confirm card)
##   empty slot row: `— empty —` dim 40 %
##   corrupt save: ink card `The ledger is scorched. (save failed checksum)`
##                 + `RETRY` / `CONTINUE WITHOUT SAVING`
##
## **Two documented deviations.**
## 1. §5.5 gives the ledger no exit control and §5.4 only forbids ESC from
##    quitting the *menu*, so this page adds `BACK` at (60, 244, 80, 18) — the
##    same rect the Options page uses for its own BACK. Without it a mouse player
##    could not leave the page.
## 2. Selecting a row is specified as "→ Loading → YARD (resume)". The loading
##    screen and the yard are not built in this pass and menu-owned exits return
##    to the menu, so a selected row returns to the menu instead; the slot is
##    still recorded in `GameState.payload` so the yard can pick it up unchanged.
##    One call site to change: `_on_row_selected()`.

## Emitted whenever the keyboard cursor lands on a row (used by the tests).
signal row_focused(row_index: int, entry: Dictionary)

const ROW_COUNT := 8

var _layout: Dictionary = {}
var _rows: Array[PixelLedgerRow] = []
var _focus := 0
var _card: Control
var _pending_delete := -1
var _corrupt := false

var _row_rect := Rect2(68, 48, 344, 24)
var _pitch := 24


func _build() -> void:
	_layout = ShellData.screen_timing().get("ledger", {})
	_row_rect = _rect("row_rect", _row_rect)
	_pitch = int(_layout.get("row_pitch", 24))

	add_backdrop(Color.WHITE)

	var panel_rect := _rect("panel", Rect2(60, 24, 360, 222))
	var panel := UiPixel.panel(self, "panel_parchment")
	UiPixel.place(panel, panel_rect)

	var title := UiPixel.label(
		self, ShellData.t("STR_LEDGER_TITLE"), UiPixel.DISPLAY, Palette.ink, HORIZONTAL_ALIGNMENT_CENTER
	)
	UiPixel.place(title, Rect2(panel_rect.position.x, float(_layout.get("title_y", 32)), 360, 14))

	_corrupt = SaveStore.has_corrupt_save()
	_build_rows()

	# The hint sits beside BACK on the white field: inside the panel it would
	# land on the eighth row (rows end at y 240, panel bottom 246).
	var hint := UiPixel.label(self, ShellData.t("STR_LEDGER_HINT"), UiPixel.UI, Palette.ink)
	hint.modulate.a = 0.6
	UiPixel.place(hint, _rect("hint_rect", Rect2(148, 250, 344, 8)))

	var back := UiPixel.button(self, ShellData.t("STR_BACK"), _on_back)
	UiPixel.place(back, _rect("back_rect", Rect2(60, 244, 80, 18)))

	if _corrupt:
		_build_scorched_card()


func on_enter(_payload: Dictionary = {}) -> void:
	input_locked = false
	_focus_row(_first_used_row())
	Sound.play_loop("MUS_MENU_THEME")


func on_exit() -> void:
	_close_card()


# --- ledger state ------------------------------------------------------

func _build_rows() -> void:
	for index in ROW_COUNT:
		var row := PixelLedgerRow.new()
		add_child(row)
		row.setup(index, _slot_entry(index), _steps_lit(index), _row_rect_for(index))
		row.selected.connect(_on_row_selected)
		row.delete_requested.connect(_on_delete_requested)
		row.focused.connect(_focus_row)
		_rows.append(row)


func _slot_entry(index: int) -> Dictionary:
	return SaveStore.slot(index) if not _corrupt else {}


## `steps lit = beats completed` (§5.5). The pixel build stores the P1 beat list
## in `shell_content.json`; a save with no beats yet shows the plain emblem.
func _steps_lit(index: int) -> int:
	if _corrupt:
		return 0
	var entry := SaveStore.slot(index)
	if entry.is_empty():
		return 0
	var total: int = ShellData.content.get("tutorial_beats", {}).get("p1", []).size()
	var done: int = (entry.get("beats", []) as Array).size()
	if total <= 0:
		return 0
	return Brand.steps_lit_for(done, total)


func _row_rect_for(index: int) -> Rect2:
	return Rect2(_row_rect.position + Vector2(0, _pitch * index), _row_rect.size)


func _first_used_row() -> int:
	for index in ROW_COUNT:
		if not SaveStore.slot(index).is_empty():
			return index
	return 0


# --- cards -------------------------------------------------------------

## Blood confirm card: `Break this contract?` · `BREAK` · `KEEP`.
func _on_delete_requested(index: int) -> void:
	if _corrupt or _pending_delete >= 0:
		return
	_pending_delete = index
	Sound.play("SFX_UI_DENY")
	_card = _build_card(
		_rect("card_rect", Rect2(80, 76, 320, 118)),
		ShellData.t("STR_BREAK_TITLE"),
		ShellData.t("STR_BREAK_YES"),
		_on_break_confirmed,
		ShellData.t("STR_BREAK_NO"),
		_close_card
	)


func _on_break_confirmed() -> void:
	var index := _pending_delete
	_pending_delete = -1
	_close_card()
	if index < 0:
		return
	SaveStore.delete_contract(index)
	SaveStore.flush()
	Sound.play("SFX_UI_CONFIRM")
	_rebuild_rows()


## Boot edge case card (§5.5): ink card, `RETRY` / `CONTINUE WITHOUT SAVING`.
func _build_scorched_card() -> void:
	_card = _build_card(
		_rect("scorched_card_rect", Rect2(80, 84, 320, 102)),
		ShellData.t("STR_LEDGER_SCORCHED"),
		ShellData.t("STR_RETRY"),
		_on_retry,
		ShellData.t("STR_LEDGER_SKIP"),
		_continue_without_saving,
		true
	)


## §5.5 edge case: a save that fails its checksum — `SaveStore.has_corrupt_save()`.
func _on_retry() -> void:
	SaveStore.load_ledger()
	if SaveStore.has_corrupt_save():
		Sound.play("SFX_UI_DENY")
		return
	_corrupt = false
	_close_card()
	_rebuild_rows()


func _continue_without_saving() -> void:
	_corrupt = true
	_close_card()
	_rebuild_rows()


func _build_card(
	rect: Rect2,
	title_text: String,
	yes_text: String,
	yes_action: Callable,
	no_text: String,
	no_action: Callable,
	ink := false
) -> Control:
	var card := Control.new()
	add_child(card)
	UiPixel.backdrop(card, Color(Palette.ink, 0.55))
	var face := UiPixel.panel(card, "panel_ink" if ink else "panel_parchment")
	UiPixel.place(face, rect)
	var title := UiPixel.label(
		card,
		title_text,
		UiPixel.UI,
		Palette.parchment if ink else Palette.ink,
		HORIZONTAL_ALIGNMENT_CENTER
	)
	title.autowrap_mode = TextServer.AUTOWRAP_OFF
	if ink:
		# The scorched-save line is long; wrap it with the real font metrics.
		var wrapped := UiPixel.wrap(title_text, rect.size.x - 24, UiPixel.UI)
		title.text = wrapped
		UiPixel.place(title, Rect2(rect.position + Vector2(12, 24), Vector2(rect.size.x - 24, 16)))
	else:
		UiPixel.place(title, Rect2(rect.position + Vector2(12, 28), Vector2(rect.size.x - 24, 10)))

	var layout_key := "retry_rect" if ink else "break_rect"
	var no_key := "skip_rect" if ink else "keep_rect"
	var yes := UiPixel.button(card, yes_text, yes_action)
	UiPixel.place(yes, _rect(layout_key, Rect2(96, 152, 140, 18)))
	var no := UiPixel.button(card, no_text, no_action)
	UiPixel.place(no, _rect(no_key, Rect2(244, 152, 140, 18)))
	no.grab_focus()
	return card


func _close_card() -> void:
	if _card != null:
		_card.queue_free()
		_card = null
	_pending_delete = -1


# --- rows --------------------------------------------------------------

## Re-read every slot after a break / retry and rebuild the rows in place.
func _rebuild_rows() -> void:
	for row in _rows:
		row.queue_free()
	_rows.clear()
	_build_rows()
	_focus_row(_first_used_row())


func _focus_row(index: int) -> void:
	_focus = clampi(index, 0, _rows.size() - 1)
	for row in _rows:
		row.set_row_focus(row.row_index == _focus)
	row_focused.emit(_focus, _slot_entry(_focus))


## Select a slot — see deviation 2 in the class header.
func _on_row_selected(index: int) -> void:
	var entry := _slot_entry(index)
	if entry.is_empty():
		Sound.play("SFX_UI_DENY")
		return
	Sound.play("SFX_UI_CONFIRM")
	go_to(GameState.State.MENU, {
		"resume_slot": index,
		"resume_name": String(entry.get("name", "")),
	})


func _on_back() -> void:
	Sound.play("SFX_UI_BACK")
	go_to(GameState.State.MENU)


# --- input -------------------------------------------------------------


func _unhandled_input(event: InputEvent) -> void:
	if not visible or input_locked or _card != null:
		return
	if event.is_action_pressed("menu_up"):
		accept_event()
		_focus_row((_focus - 1 + ROW_COUNT) % ROW_COUNT)
		Sound.play("SFX_UI_MOVE")
	elif event.is_action_pressed("menu_down"):
		accept_event()
		_focus_row((_focus + 1) % ROW_COUNT)
		Sound.play("SFX_UI_MOVE")
	elif event.is_action_pressed("menu_accept"):
		accept_event()
		_on_row_selected(_focus)
	elif event.is_action_pressed("ui_cancel"):
		accept_event()
		_on_back()
	elif event is InputEventKey and (event as InputEventKey).pressed and not event.is_echo():
		if (event as InputEventKey).keycode == KEY_DELETE:
			accept_event()
			_on_delete_requested(_focus)


func _rect(key: String, fallback: Rect2) -> Rect2:
	var raw: Array = _layout.get(key, [])
	if raw.size() == 4:
		return Rect2(float(raw[0]), float(raw[1]), float(raw[2]), float(raw[3]))
	return fallback


## Rows in slot order (used by the tests).
func rows() -> Array[PixelLedgerRow]:
	return _rows
