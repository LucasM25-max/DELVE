extends ShellScreen
## The placeholder page behind a menu item.
##
## **This screen is scaffolding, not spec.** GDD-07 §5.5 defines the real pages
## (First Run contract, ledger, options, codex, credits and the loading screen);
## this build ships the menu and the boot sequence only, so activating a menu
## item opens a small parchment card instead of a half-built page.
##
## Replacing it is deliberately a one-liner per item in `screen_menu.gd`, and
## each stub's title/body already lives in `data/strings.json` under `build`
## (`STR_STUB_<ID>_TITLE` / `STR_STUB_<ID>_BODY`), so the wires are already in
## place for the real screens.

const CARD_STYLE := "panel_parchment"

var _card: NinePatchRect
var _title: Label
var _body: Label
var _hint: Label
var _back: Button
var _dim: ColorRect

var _stub_id := "play"


func _build() -> void:
	_dim = UiPixel.backdrop(self, Color(Palette.ink, 0.5))
	_dim.mouse_filter = Control.MOUSE_FILTER_STOP

	var rect := _card_rect()
	_card = UiPixel.panel(self, CARD_STYLE)
	UiPixel.place(_card, rect)

	_title = UiPixel.label(self, "", UiPixel.DISPLAY, Palette.ink, HORIZONTAL_ALIGNMENT_CENTER)
	UiPixel.place(_title, Rect2(rect.position + Vector2(12, 10), Vector2(rect.size.x - 24, 18)))

	_body = UiPixel.label(self, "", UiPixel.BODY, Palette.ink)
	UiPixel.place(_body, Rect2(rect.position + Vector2(20, 38), Vector2(rect.size.x - 40, 46)))

	_hint = UiPixel.label(
		self,
		UiPixel.wrap(ShellData.t("STR_STUB_CARD_HINT"), rect.size.x - 40, UiPixel.UI),
		UiPixel.UI,
		Palette.ink
	)
	UiPixel.place(_hint, Rect2(rect.position + Vector2(20, 82), Vector2(rect.size.x - 40, 16)))
	_hint.modulate.a = 0.7

	_back = UiPixel.button(self, ShellData.t("STR_BACK"), _on_back)
	UiPixel.place(_back, Rect2(
		rect.position + Vector2((rect.size.x - 88) / 2.0, rect.size.y - 30), Vector2(88, 18)
	))


func on_enter(payload: Dictionary = {}) -> void:
	input_locked = false
	_stub_id = String(payload.get("stub", "play"))
	var key := _stub_id.to_upper()
	_title.text = ShellData.t("STR_STUB_%s_TITLE" % key)
	_body.text = UiPixel.wrap(ShellData.t("STR_STUB_%s_BODY" % key), _body.size.x, UiPixel.BODY)
	_back.grab_focus()
	print("[shell] '%s' selected — placeholder page (menu buttons are inert in this build)" % _stub_id)


func _on_back() -> void:
	Sound.play("SFX_UI_BACK")
	go_to(GameState.State.MENU)


func _unhandled_input(event: InputEvent) -> void:
	if not visible or input_locked:
		return
	if event.is_action_pressed("ui_cancel") or event.is_action_pressed("menu_back"):
		accept_event()
		_on_back()


func _card_rect() -> Rect2:
	var raw: Array = ShellData.screen_timing().get("stub_card_rect", [100, 66, 280, 130])
	if raw.size() == 4:
		return Rect2(float(raw[0]), float(raw[1]), float(raw[2]), float(raw[3]))
	return Rect2(100, 66, 280, 130)
