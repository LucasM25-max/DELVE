extends ShellScreen
## Screen 3 of boot: the main menu (GDD-07 §5.4).
##
## Exact 480x270 layout, straight from the spec table and `shell_timings.json`:
##
##   (29, 22, 96, 24)  lockup: emblem + wordmark
##   (29, 92, 140, 18) PLAY        + 21 px pitch per row
##   (29, 113 …)       CONTINUE
##   (29, 134 …)       OPTIONS
##   (29, 155 …)       CODEX
##   (29, 176 …)       CREDITS
##   (29, y+14, w, 2)  hover underline, bronze, drawn left to right in 0.18 s
##   (10, 254, 348, 8) abridged fan-work disclaimer, 5 px, 60 % alpha
##   right-aligned to (470, 262)  version stamp
##
## Footer note: §5.4 puts both footer lines on one row at y 259, but at the
## shipped 5 px face the disclaimer measures 360 px and the stamp 252 px — 612
## of 480 — so one row would overprint. They are stacked instead (both verbatim,
## both anchored, both inside the canvas); the reasoning and the spec's original
## numbers live in `data/shell_timings.json` -> `menu._footer_note`/`spec_rects`.
##
## Navigation is arrows / W-S / stick / mouse hover; ESC does nothing on the
## menu (there is no back-exit — only the browser or window close).
##
## CONTINUE is dimmed to 40 % with no signed contract, shows the
## `No contracts signed yet.` tooltip on hover, and plays SFX_UI_DENY if
## pressed (§5.4) — the one "action" the menu owns in this build.
##
## Button activation hands `{"stub": id}` to the placeholder page. When the real
## pages land, replace that one line with the real state transitions.
##
## Background: plain white for now — see `menu_background.gd`.

const ITEM_IDS := ["play", "continue", "options", "codex", "credits"]
const ITEM_STRING_IDS := [
	"STR_MENU_PLAY", "STR_MENU_CONTINUE", "STR_MENU_OPTIONS", "STR_MENU_CODEX", "STR_MENU_CREDITS"
]

var _items: Array[PixelMenuItem] = []
var _selected := 0
var _lockup: TextureRect
var _emblem_lit: TextureRect
var _tooltip: Control
var _tooltip_label: Label
var _flicker_timer: Timer
var _layout: Dictionary = {}


func _build() -> void:
	_layout = ShellData.menu_layout()

	# §5.3 backdrop — flat white in this build (menu_background.gd).
	add_child(MenuBackground.new())

	_build_lockup()
	_build_items()
	_build_tooltip()
	_build_footer()

	_flicker_timer = Timer.new()
	_flicker_timer.one_shot = true
	add_child(_flicker_timer)
	_flicker_timer.timeout.connect(_end_emblem_flicker)


func on_enter(_payload: Dictionary = {}) -> void:
	input_locked = false
	_refresh_continue()
	_select(_selected, false)
	Sound.play_loop("MUS_MENU_THEME")
	Sound.play_loop("AMB_YRD_DAWN_MENU")


func on_exit() -> void:
	_hide_tooltip()


# --- build -------------------------------------------------------------

func _build_lockup() -> void:
	var rect := _rect("lockup_rect", Rect2(29, 22, 96, 24))
	_lockup = UiPixel.image(self, UiPixel.UI_DIR + "logo_menu.png")
	UiPixel.place(_lockup, rect)

	# The lit-steps overlay sits exactly on the emblem inside the lockup, so
	# the selection flicker only ever changes the steps and the pip stays put.
	_emblem_lit = UiPixel.image(self, UiPixel.UI_DIR + "logo_emblem_steps.png")
	UiPixel.place(_emblem_lit, Rect2(rect.position, Brand.emblem_size()))
	_emblem_lit.modulate.a = 0.0


func _build_items() -> void:
	var origin := _rect("item_rect", Rect2(29, 92, 140, 18))
	var pitch := int(_layout.get("item_pitch", 21))
	var underline_y := int(_layout.get("underline_offset_y", 14))
	var draw_s := float(_layout.get("underline_draw_ms", 180)) / 1000.0

	for i in ITEM_IDS.size():
		var row := PixelMenuItem.new()
		row.name = "Item_" + ITEM_IDS[i]
		add_child(row)
		row.setup(
			i,
			ITEM_IDS[i],
			ShellData.t(ITEM_STRING_IDS[i]),
			Rect2(origin.position + Vector2(0, pitch * i), origin.size),
			MenuBackground.ITEM_TEXT_COLOUR,
			MenuBackground.UNDERLINE_COLOUR,
			underline_y,
			draw_s
		)
		row.hovered.connect(_on_item_hovered)
		row.activated.connect(_on_item_activated)
		row.denied.connect(_on_item_denied)
		_items.append(row)


func _build_tooltip() -> void:
	_tooltip = Control.new()
	_tooltip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_tooltip.visible = false
	add_child(_tooltip)
	var box := UiPixel.panel(_tooltip, "panel_parchment")
	UiPixel.place(box, Rect2(0, 0, 164, 12))
	_tooltip_label = UiPixel.label(_tooltip, ShellData.t("STR_MENU_NOSAVE"), UiPixel.UI, Palette.ink)
	_tooltip_label.clip_text = true
	UiPixel.place(_tooltip_label, Rect2(4, 2, 156, 8))


func _build_footer() -> void:
	var alpha := float(_layout.get("disclaimer_alpha", 0.6))
	var disclaimer := UiPixel.label(
		self, ShellData.t("STR_DISCLAIMER_ABRIDGED"), UiPixel.UI, MenuBackground.FOOTER_TEXT_COLOUR
	)
	disclaimer.clip_text = true  # never spill past its rect, whatever the face
	disclaimer.modulate.a = alpha
	UiPixel.place(disclaimer, _rect("disclaimer_rect", Rect2(10, 254, 348, 8)))

	# Footer colours come from MenuBackground: ink on white today, the spec's
	# parchment-tinted treatment once the painted dawn backdrop lands (§5.3).
	var stamp_text := ShellData.t("STR_VERSION_STAMP", [
		GameState.VERSION, Time.get_date_string_from_system()
	])
	var stamp := UiPixel.label(self, stamp_text, UiPixel.UI, MenuBackground.FOOTER_TEXT_COLOUR)
	stamp.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	stamp.clip_text = true
	stamp.modulate.a = alpha
	var stamp_rect := _rect("version_stamp_rect", Rect2(140, 262, 330, 8))
	UiPixel.place(stamp, stamp_rect)


# --- state -------------------------------------------------------------

## CONTINUE is dimmed 40 % until a contract exists (§5.4).
func _refresh_continue() -> void:
	var has_contract := SaveStore.has_any_contract() if has_node("/root/SaveStore") else false
	for item in _items:
		if item.id == "continue":
			item.set_enabled(has_contract)


func _select(index: int, play_sound: bool = true) -> void:
	var changed := index != _selected
	_selected = clampi(index, 0, _items.size() - 1)
	GameState.active_menu_index = _selected
	for item in _items:
		item.set_highlight(item.index == _selected)
	if changed and play_sound:
		Sound.play("SFX_UI_MOVE")
	_hide_tooltip()
	if _items[_selected].id == "continue" and not _items[_selected].enabled:
		_show_tooltip(_items[_selected])


func _on_item_hovered(index: int) -> void:
	if index != _selected:
		_select(index, true)


func _on_item_activated(index: int) -> void:
	_select(index, false)
	var item := _items[index]
	if not item.enabled:
		# A dimmed row (CONTINUE with no contract) only refuses, per §5.4.
		_on_item_denied(index)
		return
	item.confirm_underline()
	Sound.play("SFX_UI_CONFIRM")
	_flicker_emblem()
	# Placeholder routing: every page is a stub card for now (§5.5 wiring comes
	# later). Swap this single call for the real transitions.
	go_to(GameState.State.STUB_CARD, {"stub": item.id})


func _on_item_denied(index: int) -> void:
	var item := _items[index]
	_select(index, false)
	Sound.play("SFX_UI_DENY")
	_show_tooltip(item)


func _flicker_emblem() -> void:
	_emblem_lit.modulate.a = 1.0
	_flicker_timer.start(float(_layout.get("emblem_flicker_ms", 200)) / 1000.0)


func _end_emblem_flicker() -> void:
	_emblem_lit.modulate.a = 0.0


func _show_tooltip(item: PixelMenuItem) -> void:
	var size := _tooltip_size()
	_tooltip.position = item.position + Vector2(item.size.x + 8, (item.size.y - size.y) / 2.0)
	_tooltip.visible = true


func _hide_tooltip() -> void:
	_tooltip.visible = false


func _tooltip_size() -> Vector2:
	return Vector2(164, 12)


# --- input -------------------------------------------------------------

## ESC deliberately does nothing here (§5.4: no back-exit from the menu).
func _unhandled_input(event: InputEvent) -> void:
	if not visible or input_locked:
		return
	if event.is_action_pressed("menu_up"):
		accept_event()
		_select((_selected - 1 + _items.size()) % _items.size())
	elif event.is_action_pressed("menu_down"):
		accept_event()
		_select((_selected + 1) % _items.size())
	elif event.is_action_pressed("menu_accept"):
		accept_event()
		_on_item_activated(_selected)
	elif event.is_action_pressed("ui_cancel"):
		accept_event()  # swallowed on purpose: the menu is the root of the shell


func _rect(key: String, fallback: Rect2) -> Rect2:
	var raw: Array = _layout.get(key, [])
	if raw.size() == 4:
		return Rect2(float(raw[0]), float(raw[1]), float(raw[2]), float(raw[3]))
	return fallback
