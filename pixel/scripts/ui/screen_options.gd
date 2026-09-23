extends ShellScreen
## The Options page (GDD-07 §5.6) — schema-driven from `data/options_schema.json`.
##
##   tab rail  (8, 16, 72, 238)   Graphics · Gameplay · Accessibility · Audio · Controls
##   rows panel (88, 16, 384, 238) row h 20, controls right-aligned:
##                                 segmented pills / toggle / slider-as-10-pips / rebind
##   BACK      (88, 244, 80, 18)   commits + writes save v2 (atomic tmp + rename)
##
## Rows are generated from the schema, so adding a row to `options_schema.json`
## adds it to this page with no code change: the schema's `control` field picks
## the widget (`list`/`toggle` → pills, `slider` → 10 pips, `rebind` → key
## capture, `locked` → dimmed read-only value).
##
## **Documented deviations.**
## 1. The spec fixes no help line for this page (the 3D page had one at the
##    bottom of its own panel). The schema's `help` text is drawn at
##    (176, 244, 288, 8) — beside BACK, the row the spec already reserves for it —
##    wrapped to that width in the 5 px chrome face. The two longest strings
##    (§5.6 difficulty and combat pacing) take three 8 px chrome lines and end at
##    y 268, inside the canvas. Ink reads on both the parchment panel and the
##    white field, so no colour swap is needed.
## 2. The Controls tab has 12 rows against 10 visible slots, so the page scrolls
##    (wheel, PageUp/PageDown, or holding ↑/↓ at the ends) and shows the 4 px
##    scrollbar the UI kit already builds. The spec's row height and panel rect
##    are unchanged.
## 3. `Accessibility` is 78 px at the shipped 5 px face, 3 px wider each side
##    than the 64 px tab the spec's rail allows; the label is centred and the
##    overhang falls in the rail's unused 8 px gap, clear of the rows panel.

const TABS := [
	{"id": "graphics", "string": "STR_OPTIONS_TAB_GRAPHICS"},
	{"id": "gameplay", "string": "STR_OPTIONS_TAB_GAMEPLAY"},
	{"id": "accessibility", "string": "STR_OPTIONS_TAB_ACCESSIBILITY"},
	{"id": "audio", "string": "STR_OPTIONS_TAB_AUDIO"},
	{"id": "controls", "string": "STR_OPTIONS_TAB_CONTROLS"},
]

var _layout: Dictionary = {}
var _tabs: Array[Button] = []
var _rows: Array[PixelOptionsRow] = []
var _tab_index := 0
var _scroll := 0
var _visible_rows := 10
var _focus := 0
var _help: Label
var _help_rect := Rect2(176, 244, 288, 8)
var _scrollbar: Array = []
var _listening: PixelOptionsRow
var _listening_value := ""
var _row_rect := Rect2(96, 40, 372, 20)
var _pitch := 20.0


func _build() -> void:
	_layout = ShellData.screen_timing().get("options", {})
	_row_rect = _rect("row_rect", _row_rect)
	_pitch = float(_layout.get("row_pitch", 20))
	_visible_rows = int(_layout.get("visible_rows", 10))

	add_backdrop(Color.WHITE)

	var rail := UiPixel.panel(self, "panel_ink")
	UiPixel.place(rail, _rect("tab_rail", Rect2(8, 16, 72, 238)))

	var tab_rect := _rect("tab_rect", Rect2(12, 20, 64, 24))
	var tab_pitch := float(_layout.get("tab_pitch", 28))
	for index in TABS.size():
		var tab := UiPixel.tab(
			self, ShellData.t(TABS[index]["string"]), _on_tab_pressed.bind(index)
		)
		UiPixel.place(tab, Rect2(
			tab_rect.position + Vector2(0, tab_pitch * index), tab_rect.size
		))
		_tabs.append(tab)

	var panel := UiPixel.panel(self, "panel_parchment")
	UiPixel.place(panel, _rect("rows_panel", Rect2(88, 16, 384, 238)))

	_help_rect = _rect("help_rect", Rect2(176, 244, 288, 8))
	_help = UiPixel.block(self, "", UiPixel.UI, Palette.ink)
	_help.modulate.a = 0.8
	UiPixel.place(_help, _help_rect)

	# Built once: `_update_scrollbar()` only re-sizes and moves the thumb.
	_scrollbar = UiPixel.scrollbar(self, _rect("scrollbar_rect", Rect2(468, 24, 4, 216)), 1.0, 0.0)
	_update_scrollbar()

	var back := UiPixel.button(self, ShellData.t("STR_BACK"), _on_back)
	UiPixel.place(back, _rect("back_rect", Rect2(88, 244, 80, 18)))

	_show_tab(0)


func on_enter(_payload: Dictionary = {}) -> void:
	input_locked = false
	Sound.play_loop("MUS_MENU_THEME")


func on_exit() -> void:
	_cancel_listening(true)


# --- tabs --------------------------------------------------------------

func _on_tab_pressed(index: int) -> void:
	if index == _tab_index:
		return
	_cancel_listening()
	Sound.play("SFX_UI_MOVE")
	_show_tab(index)


func _show_tab(index: int) -> void:
	_tab_index = clampi(index, 0, TABS.size() - 1)
	_scroll = 0
	_focus = 0
	for i in _tabs.size():
		_tabs[i].button_pressed = i == _tab_index
	_build_rows()


func _schema_rows() -> Array:
	var tab_id: String = TABS[_tab_index]["id"]
	for tab in ShellData.options_schema.get("tabs", []):
		if String(tab.get("id", "")) == tab_id:
			return tab.get("rows", [])
	return []


# --- rows --------------------------------------------------------------

func _build_rows() -> void:
	for row in _rows:
		row.queue_free()
	_rows.clear()
	var schema_rows := _schema_rows()
	for index in schema_rows.size():
		var schema: Dictionary = schema_rows[index]
		var row := PixelOptionsRow.new()
		add_child(row)
		row.setup(
			schema,
			_current_value(schema),
			index,
			Rect2(_row_rect.position, _row_rect.size)
		)
		row.value_changed.connect(_on_row_value_changed)
		row.rebind_requested.connect(_on_rebind_requested)
		row.focused.connect(_focus_row)
		_rows.append(row)
	_layout_rows()
	_focus_row(_focus)


func _current_value(schema: Dictionary) -> Variant:
	var row_id := String(schema.get("id", ""))
	if GameState.settings.has(row_id):
		return GameState.settings[row_id]
	if SaveStore.settings().has(row_id):
		return SaveStore.settings()[row_id]
	return schema.get("default")


## Place the rows for the current scroll offset; hide the ones off the band.
func _layout_rows() -> void:
	for index in _rows.size():
		var offset := index - _scroll
		var row := _rows[index]
		row.visible = offset >= 0 and offset < _visible_rows
		UiPixel.place(row, Rect2(
			_row_rect.position + Vector2(0, _pitch * offset), _row_rect.size
		))
	_update_scrollbar()


## Show the 4 px scrollbar only when the tab has more rows than fit, and move
## its thumb to the current offset. The pair is built once in `_build()`; only
## the thumb's geometry changes as the player scrolls.
func _update_scrollbar() -> void:
	var needed := _rows.size() > _visible_rows
	for part in _scrollbar:
		(part as CanvasItem).visible = needed
	if not needed or _scrollbar.size() < 2:
		return
	var track := _scrollbar[0] as TextureRect
	var thumb := _scrollbar[1] as TextureRect
	var span := track.size.y - 8.0
	var ratio := clampf(float(_visible_rows) / float(_rows.size()), 0.1, 1.0)
	var offset := 0.0
	if _rows.size() > _visible_rows:
		offset = float(_scroll) / float(_rows.size() - _visible_rows)
	thumb.size = Vector2(track.size.x, maxf(8.0, span * ratio))
	thumb.position = track.position + Vector2(0, 4.0 + span * offset)


func _scroll_by(delta: int) -> void:
	var limit := maxi(0, _rows.size() - _visible_rows)
	var next := clampi(_scroll + delta, 0, limit)
	if next == _scroll:
		return
	_scroll = next
	_layout_rows()
	Sound.play("SFX_UI_MOVE")


# --- focus & help ------------------------------------------------------

func _focus_row(index: int) -> void:
	if _rows.is_empty():
		return
	_focus = clampi(index, 0, _rows.size() - 1)
	for row in _rows:
		row.set_row_focus(row.row_index == _focus)
	var row := _rows[_focus]
	# Locked rows explain themselves rather than silently refusing (§5.6).
	var help := row.help if row.locked else row.help_text()
	_set_help(help)


# --- values ------------------------------------------------------------

## Help text is wrapped with the real font metrics, so the line count (and the
## label's height) follows the string rather than the other way round.
func _set_help(text: String) -> void:
	_help.text = UiPixel.wrap(text, _help_rect.size.x, UiPixel.UI)
	_help.size.y = maxf(_help_rect.size.y, UiPixel.measure_block(
		text, _help_rect.size.x, UiPixel.UI
	).y)


func _on_row_value_changed(row_id: String, value: Variant) -> void:
	_apply_setting(row_id, value)


## Store a value: GameState (live) -> SaveStore (persisted on BACK) -> buses.
func _apply_setting(row_id: String, value: Variant) -> void:
	GameState.settings[row_id] = value
	SaveStore.set_setting(row_id, value)
	if row_id.begins_with("volume_") and typeof(value) == TYPE_INT:
		Sound.set_voice_bus_volume(row_id.trim_prefix("volume_"), float(value))
	if row_id == "mute_when_unfocused":
		Sound.apply_settings(GameState.settings)


## ←/→ (and the accept key) change the focused row's value. Rebind rows only
## arm when the player accepts them — an arrow key is a navigation key, not a
## request to rebind.
func _step_focused_row(direction: int) -> void:
	if _rows.is_empty():
		return
	var row := _rows[_focus]
	if row.pill_group != null:
		row.pill_group.select_index(row.pill_group.index() + direction)
	elif row.slider != null:
		row.slider.set_value(row.slider.value + 10 * direction, true)


func _activate_focused_row() -> void:
	if _rows.is_empty():
		return
	var row := _rows[_focus]
	if row.rebind_button != null:
		_on_rebind_requested(row.row_id, row.action)
		return
	_step_focused_row(1)


# --- rebind ------------------------------------------------------------

## "Rebind flow unchanged from today's options_page": the pill becomes a prompt,
## the next key press is captured, ESC cancels, and the choice is written to the
## save so it survives a restart (`InputActions.apply_overrides` re-applies it).
func _on_rebind_requested(row_id: String, _action: String) -> void:
	var row := _row_by_id(row_id)
	if row == null or row.rebind_button == null:
		return
	if _listening == row:
		_cancel_listening()
		return
	_cancel_listening(true)
	_listening = row
	_listening_value = String(row.value())
	row.set_listening(true, ShellData.t("STR_REBIND_LISTEN"), _listening_value)
	_set_help(ShellData.t("STR_REBIND_LISTEN"))
	row.rebind_button.grab_focus()


## Leave listening mode, restoring the pill's binding text. `silent` skips the
## "Rebind cancelled." line when another rebind is about to start or we are
## leaving the page.
func _cancel_listening(silent := false) -> void:
	if _listening == null:
		return
	_listening.set_listening(false, "", _listening_value)
	if not silent:
		_set_help(ShellData.t("STR_REBIND_CANCELLED"))
	_listening = null


func _bind_key(event: InputEventKey) -> void:
	var row := _listening
	if row == null:
		return
	var code := event.physical_keycode if event.physical_keycode != 0 else event.keycode
	var display := OS.get_keycode_string(code)
	var action: StringName = StringName(row.action if not row.action.is_empty() else row.row_id)
	if not InputMap.has_action(action):
		InputMap.add_action(action, 0.2)
	InputMap.action_erase_events(action)
	InputMap.action_add_event(action, event)
	row.set_listening(false, "", display)
	_apply_setting(row.row_id, display)
	_apply_setting(row.row_id + "_keycode", event.physical_keycode)
	_listening = null
	_set_help(row.help_text())
	Sound.play("SFX_UI_CONFIRM")


func _row_by_id(row_id: String) -> PixelOptionsRow:
	for row in _rows:
		if row.row_id == row_id:
			return row
	return null


# --- commit ------------------------------------------------------------

## BACK commits and writes save v2 (§5.6); the write is atomic tmp + rename.
func _on_back() -> void:
	_cancel_listening()
	Sound.play("SFX_UI_BACK")
	SaveStore.flush()
	Sound.apply_settings(GameState.settings)
	go_to(GameState.State.MENU)


# --- input -------------------------------------------------------------

func _unhandled_key_input(event: InputEvent) -> void:
	if _listening == null or not visible or input_locked:
		return
	if event.is_echo() or not event.pressed:
		return
	accept_event()
	if event.keycode == KEY_ESCAPE:
		_cancel_listening()
		Sound.play("SFX_UI_DENY")
		return
	_bind_key(event)


func _unhandled_input(event: InputEvent) -> void:
	if not visible or input_locked or _listening != null:
		return
	if event.is_action_pressed("menu_up"):
		accept_event()
		if _focus == 0 and _scroll > 0:
			_scroll_by(-1)
			return
		_focus_row(_focus - 1)
		Sound.play("SFX_UI_MOVE")
	elif event.is_action_pressed("menu_down"):
		accept_event()
		if _focus == _rows.size() - 1 and _scroll < _rows.size() - _visible_rows:
			_scroll_by(1)
			return
		_focus_row(_focus + 1)
		Sound.play("SFX_UI_MOVE")
	elif event.is_action_pressed("ui_left"):
		accept_event()
		_step_focused_row(-1)
	elif event.is_action_pressed("ui_right"):
		accept_event()
		_step_focused_row(1)
	elif event.is_action_pressed("folio") or event.is_action_pressed("ui_focus_next"):
		accept_event()
		_on_tab_pressed((_tab_index + 1) % TABS.size())
	elif event.is_action_pressed("menu_accept"):
		accept_event()
		_activate_focused_row()
	elif event.is_action_pressed("ui_cancel"):
		accept_event()
		_on_back()
	elif event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		var button := event as InputEventMouseButton
		if button.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			accept_event()
			_scroll_by(1)
		elif button.button_index == MOUSE_BUTTON_WHEEL_UP:
			accept_event()
			_scroll_by(-1)


# --- helpers -----------------------------------------------------------

func _rect(key: String, fallback: Rect2) -> Rect2:
	var raw: Array = _layout.get(key, [])
	if raw.size() == 4:
		return Rect2(float(raw[0]), float(raw[1]), float(raw[2]), float(raw[3]))
	return fallback


## Rows of the visible tab, in order (used by the tests).
func rows() -> Array[PixelOptionsRow]:
	return _rows


func current_tab_id() -> String:
	return String(TABS[_tab_index]["id"])
