extends ShellScreen
## Screen 1 of boot: the legal / attribution page (GDD-07 §5.2 step 1).
##
## Full-screen ink, parchment text, laid out against the spec's anchors:
##
##   y 20   the 24 px emblem, centred
##   y 56   fan-work disclaimer (384 px wide, centred, 8 px)
##   y 116  SRD 5.2.1 CC-BY-4.0 attribution block
##   y 168  engine line
##   y 180  font credits
##   y 250  "Press any button to continue." pulsing every 0.8 s
##
## The disclaimer and the SRD block are prose: how many lines they take depends
## on the face and the wrapping. Each block therefore sits at its spec anchor
## when it fits there and flows down only when the block above it would collide
## — the spec's layout is what ships, and a longer string can never overprint
## the line below it. `tests/test_runner.gd` asserts the page still fits above
## the pulse.
##
## Any input continues to the logo sting *and* is the audio gesture gate: the
## browser only allows audio to start from a user gesture, so `Sound.unlock()`
## is called here before the sting queues its first cue.

const CONTENT_WIDTH := 384
const CONTENT_X := (480 - CONTENT_WIDTH) / 2  # 48: the spec's centred block
const BLOCK_GAP := 8

# Spec anchors (GDD-07 §5.2 step 1).
const DISCLAIMER_Y := 56
const SRD_Y := 116
const ENGINE_Y := 168
const FONT_Y := 180
const PULSE_Y := 250

const BODY_SPACING := -2  ## tightens the 8 px face so 3-4 line blocks fit

var _press: Label
var _blink_timer: Timer
var _content_bottom := 0.0


func _build() -> void:
	add_backdrop(Palette.ink)

	var emblem := UiPixel.image(self, UiPixel.UI_DIR + "logo_emblem.png")
	UiPixel.place(emblem, Rect2(228, 20, 24, 24))

	var cursor := float(DISCLAIMER_Y)
	cursor = _flow_block(
		ShellData.t("STR_DISCLAIMER_FULL"), DISCLAIMER_Y, cursor,
		Palette.parchment, HORIZONTAL_ALIGNMENT_CENTER
	)
	cursor = _flow_block(
		ShellData.t("STR_SRD_ATTRIBUTION"), SRD_Y, cursor,
		Palette.parchment_1, HORIZONTAL_ALIGNMENT_CENTER
	)
	cursor = _flow_block(
		ShellData.t("STR_ENGINE_LINE"), ENGINE_Y, cursor,
		Palette.parchment_1, HORIZONTAL_ALIGNMENT_CENTER
	)
	cursor = _flow_block(
		ShellData.t("STR_FONT_LINE"), FONT_Y, cursor,
		Palette.parchment_1, HORIZONTAL_ALIGNMENT_CENTER
	)
	_content_bottom = cursor

	_press = UiPixel.label(self, ShellData.t("STR_BOOT_ANY"), UiPixel.UI, Palette.bronze_3)
	UiPixel.place(_press, Rect2(0, PULSE_Y, 480, 8))
	_press.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

	# 0.8 s blink (§5.2): a hard on/off, never a fade — pixels do not fade.
	_blink_timer = Timer.new()
	_blink_timer.wait_time = float(ShellData.boot_timing().get("legal_blink_ms", 800)) / 1000.0
	_blink_timer.autostart = true
	_blink_timer.timeout.connect(_toggle_press)
	add_child(_blink_timer)

	# Pre-warm the font atlases at build time (§5.2: shaders pre-warm here; the
	# fonts are this page's equivalent surprise).
	UiPixel.font(UiPixel.BODY)
	UiPixel.font(UiPixel.UI)


func on_enter(_payload: Dictionary = {}) -> void:
	input_locked = false
	Sound.queue_after_unlock("MUS_MENU_THEME")


func on_exit() -> void:
	_blink_timer.stop()


## Bottom edge of the last text block, in canvas pixels. Used by the tests.
func content_bottom() -> float:
	return _content_bottom


## Place a prose block at `anchor_y`, or below `cursor` if the anchor is taken.
## Returns the new cursor (block bottom + gap).
func _flow_block(
	text: String,
	anchor_y: int,
	cursor: float,
	colour: Color,
	align: int
) -> float:
	var wrapped := UiPixel.wrap(text, CONTENT_WIDTH, UiPixel.BODY)
	var measured := UiPixel.measure_block(text, CONTENT_WIDTH, UiPixel.BODY, BODY_SPACING)
	var y := maxf(float(anchor_y), cursor)
	var node := UiPixel.block(self, wrapped, UiPixel.BODY, colour, BODY_SPACING)
	node.horizontal_alignment = align
	UiPixel.place(node, Rect2(CONTENT_X, y, CONTENT_WIDTH, measured.y))
	return y + measured.y + BLOCK_GAP


func _toggle_press() -> void:
	_press.visible = not _press.visible


func _unhandled_input(event: InputEvent) -> void:
	if not visible or input_locked:
		return
	if _is_any_button(event):
		accept_event()
		Sound.unlock()
		Sound.play("SFX_UI_CONFIRM")
		go_to(GameState.State.STING)


## "Any input continues": keyboard, mouse, touch or pad.
func _is_any_button(event: InputEvent) -> bool:
	if event is InputEventKey:
		return (event as InputEventKey).pressed and not (event as InputEventKey).echo
	if event is InputEventMouseButton:
		return (event as InputEventMouseButton).pressed
	if event is InputEventScreenTouch:
		return (event as InputEventScreenTouch).pressed
	if event is InputEventJoypadButton:
		return (event as InputEventJoypadButton).pressed
	return false
