extends ShellScreen
## The First Run contract page (GDD-07 §5.5) — reached from PLAY.
##
##   single parchment panel (40, 16, 400, 238), ink text
##   three pill groups (nine-patch pills, h 16, gap 4; selected = bronze + ink):
##     y  56  Difficulty           Story / Balanced / Tactical          default Balanced
##     y 104  Combat pacing        Table Mode / Skirmish Mode            default Table Mode
##     y 152  Subtitles  +  Camera comfort preset
##   footer: (56, 224, 148, 18) BACK · (276, 224, 148, 18) SIGN & DESCEND
##
## Group help text is shown verbatim from `data/options_schema.json` under each
## group (8 px), and the Skirmish pill carries the SECONDARY tag with its P1
## tooltip.
##
## **This build deviates in one place, and only one.** `SIGN & DESCEND` is
## specified as "save slot created here -> Loading -> YARD"; the loading screen
## and the yard are not built yet, and menu buttons that would leave the menu
## return to it instead. So the button keeps its spec text and its spec effect on
## the *ledger* (the contract really is written into the next free slot), then
## returns to the menu — where CONTINUE lights up and the ledger shows the new
## contract. One call site to change when the yard lands: `_sign_and_descend()`.

const GROUP_DEFS := [
	{"id": "difficulty", "label_key": "STR_FR_DIFF", "row": "difficulty"},
	{"id": "combat_pacing", "label_key": "STR_FR_PACE", "row": "combat_pacing"},
]

var _settings: Dictionary = {}
var _groups: Dictionary = {}
var _tooltip: Control
var _layout: Dictionary = {}
var _tag_chip: ColorRect


func _build() -> void:
	_layout = ShellData.screen_timing().get("first_run", {})
	var panel_rect := _rect("panel", Rect2(40, 16, 400, 238))
	UiPixel.backdrop(self, Color(Palette.ink, 0.6))
	var panel := UiPixel.panel(self, "panel_parchment")
	UiPixel.place(panel, panel_rect)

	var title := UiPixel.label(
		self, ShellData.t("STR_FR_TITLE"), UiPixel.DISPLAY, Palette.ink, HORIZONTAL_ALIGNMENT_CENTER
	)
	UiPixel.place(title, Rect2(panel_rect.position + Vector2(0, 8), Vector2(panel_rect.size.x, 18)))

	# GameState.settings already merges the schema defaults with the save, so the
	# page opens on whatever the player chose last time and on the spec defaults
	# otherwise.
	_settings = GameState.settings.duplicate()
	for row_id in ShellData.option_defaults():
		if not _settings.has(row_id):
			_settings[row_id] = ShellData.option_defaults()[row_id]

	var group_ys: Array = _layout.get("group_ys", [56, 104, 152])
	for index in GROUP_DEFS.size():
		_build_group(GROUP_DEFS[index], float(group_ys[index]))
	_build_comfort_group(float(group_ys[2]))
	_build_tooltip()

	var back := UiPixel.button(self, ShellData.t("STR_BACK"), _on_back)
	UiPixel.place(back, _rect("back_rect", Rect2(56, 224, 148, 18)))
	var go := UiPixel.button(self, ShellData.t("STR_FR_GO"), _sign_and_descend)
	UiPixel.place(go, _rect("go_rect", Rect2(276, 224, 148, 18)))


func on_enter(_payload: Dictionary = {}) -> void:
	input_locked = false
	Sound.play_loop("MUS_MENU_THEME")


func on_exit() -> void:
	_hide_tooltip()


# --- groups ------------------------------------------------------------

## Difficulty and Combat pacing: label, pills, verbatim help beneath.
func _build_group(definition: Dictionary, y: float) -> void:
	var row_id := String(definition["row"])
	var schema_row := _schema_row(row_id)
	var content_x := float(_layout.get("content_x", 60))
	var content_w := float(_layout.get("content_w", 360))
	var label_y := y
	var pills_y := y + float(_layout.get("label_to_pills", 10))

	var label := UiPixel.label(self, ShellData.t(String(definition["label_key"])), UiPixel.UI, Palette.ink)
	UiPixel.place(label, Rect2(content_x, label_y, content_w, 8))

	var values: Array = schema_row.get("values", [])
	var group := PixelPillGroup.new()
	add_child(group)
	var default_value := String(schema_row.get("default", ""))
	var current := String(_settings.get(row_id, default_value))
	group.setup(values, current, Rect2(content_x, pills_y, PixelPillGroup.measure(values), 16))
	group.value_changed.connect(_on_group_changed.bind(row_id))
	_groups[row_id] = group

	# The SECONDARY tag rides the group's label line, right-aligned: the Skirmish
	# pill alone is 236 px, so there is no room for an inline chip on the pill row.
	if String(schema_row.get("tag", "")) == "SECONDARY":
		_add_secondary_tag_and_tooltip(group, content_x + content_w, label_y, schema_row)

	var help := String(schema_row.get("help", ""))
	if not help.is_empty():
		_draw_help(help, Rect2(
			content_x,
			y + float(_layout.get("help_offset_y", 24)),
			content_w,
			float(_layout.get("help_height", 24))
		))


## Subtitles (left) + Camera comfort preset (right), per the §5.5 table.
func _build_comfort_group(y: float) -> void:
	var content_x := float(_layout.get("content_x", 60))
	var right_x := float(_layout.get("right_column_x", 250))
	var pills_y := y + float(_layout.get("label_to_pills", 10))

	var subs_row := _schema_row("subtitles")
	var subs_label := UiPixel.label(self, ShellData.t("STR_FR_SUBS"), UiPixel.UI, Palette.ink)
	UiPixel.place(subs_label, Rect2(content_x, y, 120, 8))
	_groups["subtitles"] = _make_group("subtitles", subs_row, content_x, pills_y)

	var comfort_label := UiPixel.label(self, ShellData.t("STR_FR_COMFORT"), UiPixel.UI, Palette.ink)
	UiPixel.place(comfort_label, Rect2(right_x, y, 190, 8))
	var comfort_row := _schema_row("reduced_motion")
	_groups["reduced_motion"] = _make_group("reduced_motion", comfort_row, right_x, pills_y)

	# The §5.5 table spells both of these out as prose notes; they fit under
	# their own columns (two 8 px lines each) without touching the footer.
	_draw_help(
		String(subs_row.get("help", "")),
		_rect("comfort_help_rect", Rect2(content_x, 178, 182, 24))
	)
	_draw_help(
		String(comfort_row.get("help", "")),
		_rect("comfort_right_help_rect", Rect2(right_x, 178, 182, 24))
	)


## One help block: wrapped to its rect with the shared 8 px stack (§5.5 "8 px,
## under group"), dimmed so the labels stay the loudest thing on the page.
func _draw_help(text: String, rect: Rect2) -> void:
	if text.is_empty():
		return
	var label := UiPixel.block(
		self,
		UiPixel.wrap(text, rect.size.x, UiPixel.BODY),
		UiPixel.BODY,
		Palette.ink,
		int(_layout.get("help_line_spacing", -3))
	)
	label.modulate.a = 0.78
	UiPixel.place(label, rect)


func _make_group(
	row_id: String,
	schema_row: Dictionary,
	x: float,
	y: float
) -> PixelPillGroup:
	var values: Array = schema_row.get("values", [])
	var group := PixelPillGroup.new()
	add_child(group)
	var current := String(_settings.get(row_id, schema_row.get("default", "")))
	group.setup(values, current, Rect2(x, y, PixelPillGroup.measure(values), 16))
	group.value_changed.connect(_on_group_changed.bind(row_id))
	return group


func _on_group_changed(value: String, row_id: String) -> void:
	_settings[row_id] = value
	SaveStore.set_setting(row_id, value)
	if row_id == "reduced_motion":
		GameState.settings[row_id] = value


# --- tooltip -----------------------------------------------------------

func _add_secondary_tag_and_tooltip(
	group: PixelPillGroup,
	right_x: float,
	y: float,
	schema_row: Dictionary
) -> void:
	# A bronze chip on the group's label line: "SECONDARY" with a 1 px rule
	# beneath it, right-aligned so it never touches the pill row.
	var tag_text := String(schema_row.get("tag", ""))
	var tag_width := UiPixel.text_width(tag_text, UiPixel.UI) + 4.0
	var tag := UiPixel.label(
		self, tag_text, UiPixel.UI, Palette.bronze_0, HORIZONTAL_ALIGNMENT_CENTER
	)
	UiPixel.place(tag, Rect2(right_x - tag_width, y, tag_width, 8))
	_tag_chip = UiPixel.rect(self, Palette.bronze_3)
	UiPixel.place(_tag_chip, Rect2(right_x - tag_width, y + 7, tag_width, 1))

	# The tooltip follows the Skirmish pill itself (the SECONDARY option).
	var skirmish := group.pill_for(String(schema_row.get("values", []).back()))
	if skirmish == null:
		return
	skirmish.mouse_entered.connect(_show_skirmish_tooltip.bind(skirmish))
	skirmish.mouse_exited.connect(_hide_tooltip)
	skirmish.focus_entered.connect(_show_skirmish_tooltip.bind(skirmish))
	skirmish.focus_exited.connect(_hide_tooltip)


func _build_tooltip() -> void:
	_tooltip = Control.new()
	_tooltip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_tooltip.visible = false
	add_child(_tooltip)
	var text := ShellData.t("STR_SKIRMISH_TOOLTIP")
	var width := UiPixel.text_width(text, UiPixel.UI) + 8.0
	var box := UiPixel.panel(_tooltip, "tooltip")
	UiPixel.place(box, Rect2(0, 0, width, 12))
	var label := UiPixel.label(_tooltip, text, UiPixel.UI, Palette.ink)
	UiPixel.place(label, Rect2(4, 2, width - 8, 8))
	_tooltip.size = Vector2(width, 12)


## Park the tooltip under the pill, nudged left so it never leaves the canvas
## (the Skirmish pill ends at x 372 and the string is 210 px wide).
func _show_skirmish_tooltip(pill: Button) -> void:
	var width := _tooltip.size.x if _tooltip.size.x > 0.0 else 218.0
	var x := minf(pill.global_position.x, 478.0 - width)
	_tooltip.position = Vector2(maxf(2.0, x), pill.global_position.y + pill.size.y + 2)
	_tooltip.visible = true


func _hide_tooltip() -> void:
	if _tooltip != null:
		_tooltip.visible = false


# --- actions -----------------------------------------------------------

func _on_back() -> void:
	Sound.play("SFX_UI_BACK")
	go_to(GameState.State.MENU)


## SIGN & DESCEND — the one deviating call site in this screen.
##
## §5.5: "→ save slot created here (P1: slot label = `New contract` until yard
## naming at E) → Loading". The slot is created exactly as specified; the target
## is the menu instead of Loading, because the loading screen and the yard are not
## built. Everything else about the flow (the next free slot, the P1 label, the
## stored difficulty/pacing/subtitle/comfort values) is as written.
func _sign_and_descend() -> void:
	var slot := SaveStore.first_empty_slot()
	if slot < 0:
		# Unreachable from PLAY (the "Begin a new contract?" card only opens this
		# page when a slot is free), but a full ledger must never be overwritten,
		# so the press is denied instead.
		Sound.play("SFX_UI_DENY")
		return
	SaveStore.create_contract(slot, {
		"name": ShellData.t("STR_CONTRACT_NEW_NAME"),
		"class": ShellData.t("STR_CONTRACT_UNASSIGNED"),
		"level": 1,
		"chapter": ShellData.t("STR_CONTRACT_CHAPTER"),
	})
	for row_id in _settings:
		SaveStore.set_setting(row_id, _settings[row_id])
	SaveStore.flush()
	Sound.play("SFX_UI_CONFIRM")
	go_to(GameState.State.MENU)


# --- helpers -----------------------------------------------------------

func _schema_row(row_id: String) -> Dictionary:
	for tab in ShellData.options_schema.get("tabs", []):
		for row in tab.get("rows", []):
			if String(row.get("id", "")) == row_id:
				return row
	return {}


func _rect(key: String, fallback: Rect2) -> Rect2:
	var raw: Array = _layout.get(key, [])
	if raw.size() == 4:
		return Rect2(float(raw[0]), float(raw[1]), float(raw[2]), float(raw[3]))
	return fallback


## Pill groups, keyed by the options row id they drive (used by the tests).
func groups() -> Dictionary:
	return _groups


## Current selection of every group on the page, for tests.
func selections() -> Dictionary:
	var out: Dictionary = {}
	for row_id in _groups:
		out[row_id] = _groups[row_id].value
	return out
