extends ShellScreen
## Screen 2 of boot: the logo sting (GDD-07 §5.2 step 2).
##
## A single 4.0 s timeline, driven by one clock in `_process` and quantised to
## whole-pixel steps so every element snaps rather than slides:
##
##   0.0-0.8  emblem outline draws, row by row       SFX_BOOT_STONE
##   0.8-2.0  the three steps light top -> bottom    SFX_BOOT_EMBERS  x3
##   2.0-3.0  the wordmark chisels, letter by letter SFX_BOOT_CHISEL  x5
##   3.0-3.6  sublock fades in + bronze sweep        MUS_BOOT_STING
##   3.6-4.0  hold, then a 0.6 s cross-fade to menu
##
## Skippable by any input after 1.5 s. Reduced motion cuts to the end frame and
## still holds for a minimum of 1.0 s (§5.2).
##
## All numbers come from `data/shell_timings.json` -> `boot.sting`, so the
## timeline can be retimed without touching this file.

const EMBLEM_POS := Vector2(228, 40)
const WORDMARK_POS := Vector2(205, 84)
const SUBLOCK_Y := 120
const REVEAL_STEPS := 8  ## outline-draw quantisation: 24 px of emblem in 8 steps

var _emblem: TextureRect
var _step_marks: Array[ColorRect] = []
var _letters: Array[TextureRect] = []
var _sublock: VBoxContainer
var _sweep: ColorRect

var _elapsed := 0.0
var _finished := false
var _started := false
var _timing: Dictionary = {}
var _reduced_motion := false
var _done_at := 0.0


func _build() -> void:
	add_backdrop(Palette.ink)
	_timing = ShellData.sting_timing()
	_reduced_motion = _read_reduced_motion()

	var emblem_size := Brand.emblem_size()

	# --- emblem: revealed by a growing region rect (8 discrete steps) -----
	_emblem = UiPixel.image(self, UiPixel.UI_DIR + "logo_emblem.png")
	_emblem.region_enabled = true
	_emblem.region_rect = Rect2(0, 0, emblem_size.x, 0)
	UiPixel.place(_emblem, Rect2(EMBLEM_POS, emblem_size))

	# --- the three steps, lit in mint as the sting counts them ------------
	for step in Brand.emblem_step_rects():
		var mark := UiPixel.rect(self, Palette.mint)
		UiPixel.place(mark, Rect2(EMBLEM_POS + step.position, step.size))
		mark.visible = false
		_step_marks.append(mark)

	# --- wordmark: one TextureRect per letter cell (chisel order) ---------
	var strip := UiPixel.image(self, UiPixel.UI_DIR + "logo_wordmark_strip.png")
	strip.visible = false  # the strip is sliced; only the letters are drawn
	var cell := Brand.wordmark_cell_width()
	var mark_size := Brand.wordmark_size()
	for i in range(5):
		var letter := TextureRect.new()
		var atlas := AtlasTexture.new()
		atlas.atlas = strip.texture
		atlas.region = Rect2(i * cell, 0, cell, mark_size.y)
		letter.texture = atlas
		letter.stretch_mode = TextureRect.STRETCH_KEEP
		letter.mouse_filter = Control.MOUSE_FILTER_IGNORE
		letter.visible = false
		add_child(letter)
		UiPixel.place(letter, Rect2(WORDMARK_POS + Vector2(i * cell, 0), Vector2(cell, mark_size.y)))
		_letters.append(letter)

	# --- sublock + bronze sweep ------------------------------------------
	_sublock = VBoxContainer.new()
	_sublock.add_theme_constant_override("separation", 4)
	_sublock.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_sublock)
	UiPixel.place(_sublock, Rect2(0, SUBLOCK_Y, 480, 24))
	var line_one := UiPixel.label(_sublock, ShellData.t("STR_SUBLOCK_1"), UiPixel.UI, Palette.bronze_3)
	line_one.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var line_two := UiPixel.label(_sublock, ShellData.t("STR_SUBLOCK_2"), UiPixel.UI, Palette.bronze_3)
	line_two.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_sublock.size = Vector2(480, 24)
	_sublock.modulate.a = 0.0

	_sweep = UiPixel.rect(self, Palette.bronze)
	UiPixel.place(_sweep, Rect2(120, SUBLOCK_Y + 26, 0, 1))
	_sweep.visible = false

	_done_at = float(_timing.get("total_ms", 4000)) / 1000.0
	Sound.play("SFX_BOOT_STONE")


func on_enter(_payload: Dictionary = {}) -> void:
	_elapsed = 0.0
	_finished = false
	_started = true
	set_process(true)
	if _reduced_motion:
		# Cut straight to the end frame, then hold for the reduced minimum.
		_apply_end_frame()
		_done_at = float(_timing.get("reduced_motion_hold_ms", 1200)) / 1000.0


func on_exit() -> void:
	_started = false
	set_process(false)


func _process(delta: float) -> void:
	if _finished or not _started:
		return
	_elapsed += delta
	if not _reduced_motion:
		_update_timeline(_elapsed)
	if _elapsed >= _done_at:
		_finish()


func _update_timeline(t: float) -> void:
	var draw_s := float(_timing.get("emblem_draw_ms", 800)) / 1000.0
	var total_ms := float(_timing.get("total_ms", 4000))

	# 0.0-0.8 — the emblem draws in, quantised to eight pixel steps.
	var full_rows := _emblem.texture.get_height() if _emblem.texture != null else 24.0
	if t < draw_s:
		var progress := clampf(t / maxf(draw_s, 0.001), 0.0, 1.0)
		_emblem.region_rect.size.y = floor(progress * REVEAL_STEPS) / REVEAL_STEPS * full_rows
	else:
		_emblem.region_rect.size.y = full_rows

	# 0.8-2.0 — the three steps light, top to bottom.
	var lit := 0
	for mark_ms in _timing.get("steps_light_ms", []):
		if t * 1000.0 >= float(mark_ms):
			lit += 1
	for i in _step_marks.size():
		var should_show := i < lit
		if should_show and not _step_marks[i].visible:
			Sound.play("SFX_BOOT_EMBERS")
		_step_marks[i].visible = should_show

	# 2.0-3.0 — the wordmark chisels in, letter by letter.
	var chiselled := 0
	for chisel_ms in _timing.get("wordmark_chisel_ms", []):
		if t * 1000.0 >= float(chisel_ms):
			chiselled += 1
	for i in _letters.size():
		var should_show := i < chiselled
		if should_show and not _letters[i].visible:
			Sound.play("SFX_BOOT_CHISEL")
		_letters[i].visible = should_show

	# 3.0-3.6 — the sublock fades up and the bronze line sweeps across it.
	var sublock_ms := float(_timing.get("sublock_fade_ms", 3000))
	if t * 1000.0 >= sublock_ms:
		if _sublock.modulate.a == 0.0:
			Sound.play("MUS_BOOT_STING")
		var fade_s := maxf(0.001, (float(total_ms) - sublock_ms) / 1000.0)
		_sublock.modulate.a = clampf((t - sublock_ms / 1000.0) / fade_s, 0.0, 1.0)
		_sweep.visible = true
		var sweep := clampf((t * 1000.0 - sublock_ms) / maxf(1.0, float(total_ms) - sublock_ms), 0.0, 1.0)
		_sweep.size.x = 240.0 * (1.0 - sweep)
		_sweep.position.x = 120.0 + 120.0 * sweep


func _finish() -> void:
	if _finished:
		return
	_finished = true
	set_process(false)
	go_to(GameState.State.MENU)


## Skip after the skippable window (§5.2): any input jumps to the menu.
func _unhandled_input(event: InputEvent) -> void:
	if not visible or _finished or input_locked:
		return
	if not _is_any_button(event):
		return
	var skip_after := float(_timing.get("skippable_after_ms", 1500)) / 1000.0
	if _elapsed >= skip_after:
		accept_event()
		_finish()


func _is_any_button(event: InputEvent) -> bool:
	if event is InputEventKey:
		return (event as InputEventKey).pressed and not (event as InputEventKey).echo
	if event is InputEventMouseButton:
		return (event as InputEventMouseButton).pressed
	if event is InputEventScreenTouch:
		return (event as InputEventScreenTouch).pressed
	if event is InputEventJoypadButton:
		return (event as InputEventJoypadButton).pressed
	if event is InputEventJoypadMotion:
		return absf((event as InputEventJoypadMotion).axis_value) > 0.5
	return false


func _apply_end_frame() -> void:
	_emblem.region_rect.size.y = _emblem.texture.get_height() if _emblem.texture != null else 24.0
	for mark in _step_marks:
		mark.visible = true
	for letter in _letters:
		letter.visible = true
	_sublock.modulate.a = 1.0
	_sweep.visible = false


func _read_reduced_motion() -> bool:
	if has_node("/root/GameState"):
		return bool(GameState.settings.get("reduced_motion", "Off") in [true, "On"])
	return false


