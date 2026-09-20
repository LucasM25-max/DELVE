extends Control
## Main flow: attribution → sting → menu → contract → loading → threshold.
## The optional 3D yard is a NEW blockout, not a claim of adventure gameplay.
const UI = preload("res://scripts/ui/shell_ui.gd")
const OptionsPage = preload("res://scripts/ui/options_page.gd")
const Backdrop = preload("res://scripts/ui/backdrop.gd")
const WORLD := "res://scenes/world/test_yard.tscn"
const LEGAL := "An unofficial, non-commercial fan project. Dungeons & Dragons, Phandelver and Below: The Shattered Obelisk and all Wizards of the Coast characters and locations are trademarks of Wizards of the Coast LLC. Used here without permission; no challenge to any trademark or copyright. This game will never be sold."
var screen := ""
var background: Control
var page: Control
var paper: Control
var content: Control
var clock := 0.0
var state_time := 0.0
var menu_buttons: Array[Button] = []
var progress_bar: ProgressBar
var load_label: Label
var route_ctl: Control
var tip_label: Label
var tip_clock := 0.0
var tip_index := 0
var load_seal: TextureRect
var load_pct: Label
var load_pips: Array[ColorRect] = []
var load_shown := 0.0
var ready_world: PackedScene
var load_mode := "signed"
var loading_error := false
var credits_scroll: ScrollContainer
var credits_position := 0.0
var selected_codex := "rules"
var status_label: Label
var sting_tween: Tween

func _ready() -> void:
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	theme = UI.theme_for(true)
	background = Control.new()
	background.set_script(Backdrop)
	add_child(background)
	UI.fill(background)
	page = Control.new()
	add_child(page)
	UI.fill(page)
	GameState.setting_changed.connect(_setting_changed)
	GameState.save_failed.connect(_save_failed)
	resized.connect(_layout)
	show_screen("menu" if GameState.return_to_menu else "legal")
	GameState.return_to_menu = false

func _layout() -> void:
	# Stable 1600×900 composition centered in wider/taller windows.
	if is_instance_valid(content):
		content.position = (size - Vector2(1600, 900)) / 2.0

func show_screen(next: String) -> void:
	if sting_tween:
		sting_tween.kill()
	for child in page.get_children():
		page.remove_child(child)
		child.queue_free()
	screen = next
	state_time = 0.0
	menu_buttons.clear()
	paper = null
	status_label = null
	content = Control.new()
	content.size = Vector2(1600, 900)
	page.add_child(content)
	_layout()
	background.visible = next not in ["legal", "sting", "loading"]
	match next:
		"legal": build_legal()
		"sting": build_sting()
		"menu": build_menu()
		"new": build_new()
		"contract": build_contract()
		"ledger": build_ledger()
		"options": build_options()
		"codex": build_codex()
		"credits": build_credits()
		"loading": build_loading()
		"threshold": build_threshold()
	_setting_changed("acc.hc", GameState.get_setting("acc.hc"))
	call_deferred("_focus_first")

func _focus_first() -> void:
	if not is_instance_valid(content):
		return
	var controls := content.find_children("*", "Button", true, false)
	for control in controls:
		if not control.disabled and control.is_visible_in_tree():
			control.grab_focus()
			break

func build_legal() -> void:
	UI.at(UI.image("res://assets/images/logo_emblem.png"), content, Rect2(728, 135, 144, 190))
	UI.centered_text(content, LEGAL, Rect2(420, 355, 760, 150), 25)
	UI.centered_text(content, "NATIVE GODOT EDITION", Rect2(450, 550, 700, 36), 22, true)
	UI.centered_text(content, "Menu shell + optional 3D test yard. Built for the browser.\nCinzel and Alegreya are bundled under the SIL Open Font License.", Rect2(400, 602, 800, 65), 21)
	UI.at(UI.button("CONTINUE", begin_boot), content, Rect2(650, 745, 300, 54))

func begin_boot() -> void:
	Sound.unlock()
	show_screen("menu" if GameState.get_setting("cam.reduced") == "On" else "sting")

func build_sting() -> void:
	var word := UI.image("res://assets/images/logo_wordmark.png")
	var atlas := AtlasTexture.new()
	atlas.atlas = load("res://assets/images/logo_wordmark.png")
	var full: Vector2 = atlas.atlas.get_size()
	atlas.region = Rect2(0, 0, 0, full.y)
	word.texture = atlas
	UI.at(word, content, Rect2(365, 230, 870, 240))
	var emblem := UI.image("res://assets/images/logo_emblem.png")
	UI.at(emblem, content, Rect2(725, 490, 150, 190))
	var glow := ColorRect.new()
	glow.color = UI.MINT
	UI.at(glow, content, Rect2(800, 470, 0, 2))
	var bar_t := ColorRect.new()
	bar_t.color = Color.BLACK
	UI.at(bar_t, content, Rect2(0, 0, 1600, 0))
	var bar_b := ColorRect.new()
	bar_b.color = Color.BLACK
	UI.at(bar_b, content, Rect2(0, 900, 1600, 0))
	UI.centered_text(content, "A DUNGEONS & DRAGONS ADVENTURE", Rect2(300, 700, 1000, 36), 24, true)
	UI.centered_text(content, "PHANDELVER AND BELOW · THE SHATTERED OBELISK", Rect2(300, 745, 1000, 30), 19, true)
	word.modulate.a = 0.0
	emblem.modulate.a = 0.0
	sting_tween = create_tween()
	sting_tween.tween_interval(0.5)
	sting_tween.tween_property(emblem, "modulate:a", 1.0, 0.5)
	sting_tween.parallel().tween_property(glow, "size:x", 520.0, 0.6).from(0.0)
	sting_tween.parallel().tween_property(glow, "position:x", 540.0, 0.6).from(800.0)
	sting_tween.tween_interval(0.7)
	sting_tween.tween_property(word, "modulate:a", 1.0, 0.2)
	for i in 5:
		sting_tween.tween_callback(func() -> void:
			atlas.region = Rect2(0, 0, full.x * (i + 1) / 5.0, full.y))
		sting_tween.tween_interval(0.09)
	sting_tween.tween_interval(0.5)
	sting_tween.tween_property(bar_t, "size:y", 90.0, 0.45)
	sting_tween.parallel().tween_property(bar_b, "size:y", 90.0, 0.45)
	sting_tween.parallel().tween_property(bar_b, "position:y", 810.0, 0.45)

func build_menu() -> void:
	UI.at(UI.image("res://assets/images/logo_emblem.png"), content, Rect2(133, 104, 84, 130))
	var wordmark := UI.image("res://assets/images/logo_wordmark.png")
	UI.at(wordmark, content, Rect2(243, 108, 425, 130))
	if GameState.get_setting("cam.reduced") != "On":
		var flick := create_tween().set_loops()
		flick.tween_property(wordmark, "modulate", Color(1, 1, 1, 1), 2.2)
		flick.tween_property(wordmark, "modulate", Color(0.82, 0.95, 1, 0.88), 0.12)
		flick.tween_property(wordmark, "modulate", Color(1, 1, 1, 1), 0.1)
		flick.tween_interval(1.4)
	var kicker := UI.label("THE ROCKSEEKER CONTRACT", 18, true)
	kicker.add_theme_color_override("font_color", UI.GOLD)
	UI.at(kicker, content, Rect2(136, 262, 560, 40))
	var items := ["PLAY", "CONTINUE", "OPTIONS", "CODEX", "CREDITS"]
	for i in items.size():
		var button := UI.button(items[i], menu_activate.bind(i))
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.add_theme_font_size_override("font_size", 34)
		button.add_theme_stylebox_override("normal", UI.style(Color.TRANSPARENT))
		button.add_theme_stylebox_override("disabled", UI.style(Color.TRANSPARENT))
		button.disabled = i == 1 and GameState.contracts.is_empty()
		UI.at(button, content, Rect2(122, 348 + i * 70, 420, 58))
		button.mouse_entered.connect(func() -> void:
			if not button.disabled:
				button.grab_focus())
		menu_buttons.append(button)
	var hint := "No contracts signed yet." if GameState.contracts.is_empty() else "%d / 8 contracts in the ledger." % GameState.contracts.size()
	UI.at(UI.label(hint, 22), content, Rect2(138, 716, 650, 40))
	var legal := UI.label(LEGAL, 16)
	legal.modulate.a = 0.65
	UI.at(legal, content, Rect2(50, 806, 895, 80))
	UI.at(UI.label("DELVE · GODOT EDITION 0.2\nNATIVE UI / WEB-READY", 16, true), content, Rect2(1210, 823, 350, 50))
	if GameState.storage_error != "":
		UI.at(UI.label(GameState.storage_error, 20), content, Rect2(860, 680, 620, 105))

func menu_activate(index: int) -> void:
	Sound.unlock()
	match index:
		0: show_screen("new" if not GameState.contracts.is_empty() else "contract")
		1: show_screen("ledger")
		2: show_screen("options")
		3: show_screen("codex")
		4: show_screen("credits")

func make_paper(title: String, subtitle := "", wide := false) -> Control:
	var shade := ColorRect.new()
	shade.color = Color(0.015, 0.02, 0.025, 0.62)
	UI.at(shade, content, Rect2(-1000, -1000, 3600, 2900))
	var width := 1300.0 if wide else 1060.0
	paper = Panel.new()
	paper.theme = UI.theme_for()
	var skin := StyleBoxTexture.new()
	skin.texture = preload("res://assets/images/parchment.png")
	paper.add_theme_stylebox_override("panel", skin)
	UI.at(paper, content, Rect2((1600 - width) / 2, 46, width, 808))
	var border := Panel.new()
	border.mouse_filter = MOUSE_FILTER_IGNORE
	border.add_theme_stylebox_override("panel", UI.style(Color.TRANSPARENT, UI.GOLD, 2))
	UI.at(border, paper, Rect2(14, 14, width - 28, 780))
	UI.at(UI.image("res://assets/images/logo_emblem.png"), paper, Rect2(38, 32, 56, 80))
	UI.centered_text(paper, title, Rect2(110, 36, width - 220, 60), 37, true)
	UI.centered_text(paper, subtitle, Rect2(110, 105, width - 220, 40), 22)
	UI.at(UI.rule(), paper, Rect2(45, 157, width - 90, 2))
	var body := Control.new()
	UI.at(body, paper, Rect2(52, 180, width - 104, 512))
	UI.at(UI.button("BACK", func() -> void: show_screen("menu")), paper, Rect2(45, 727, 210, 48))
	_setting_changed("acc.hc", GameState.get_setting("acc.hc"))
	return body

func build_new() -> void:
	var body := make_paper("Begin a new contract?", "The ledger keeps up to eight contracts.")
	var column := UI.scroll_column(body)
	column.add_child(UI.label("Your existing contracts will not be erased. Continue resumes a contract from the ledger.", 28))
	if GameState.contracts.size() >= GameState.MAX_CONTRACTS:
		column.add_child(UI.label("The ledger is full. Open CONTINUE to remove a contract before signing another.", 26))
		column.add_child(UI.button("OPEN THE LEDGER", func() -> void: show_screen("ledger")))
	else:
		column.add_child(UI.button("BEGIN NEW", func() -> void: show_screen("contract")))

func build_contract() -> void:
	var body := make_paper("Sign the Contract", "The Rockseeker Contract · Neverwinter muster-yard · dawn")
	var seal := UI.seal(110)
	seal.name = "ContractSeal"
	seal.rotation_degrees = 8
	UI.at(seal, paper, Rect2(900, 36, 110, 110))
	var column := UI.scroll_column(body)
	choice(column, "Difficulty", "play.diff", ["Story", "Balanced", "Tactical"])
	column.add_child(UI.label("Story: forgiving foes. Balanced: the intended table. Tactical: sharper foes. These rules are planned, not yet playable.", 20))
	choice(column, "Combat pacing", "play.combat", ["Table Mode (turn-based)", "Skirmish Mode (real-time, pausable)"])
	choice(column, "Subtitles", "acc.subs", ["On", "Off"])
	choice(column, "Camera comfort · reduced motion", "cam.reduced", ["Off", "On"])
	column.add_child(UI.label("By signing you accept the road as it comes. Choices can be changed in Options. The adventure itself is not implemented yet.", 20))
	UI.at(UI.button("SIGN & DESCEND", sign_contract), paper, Rect2(635, 727, 375, 48))

func choice(parent: VBoxContainer, title: String, key: String, values: Array) -> void:
	parent.add_child(UI.label(title, 24))
	var row := HBoxContainer.new()
	parent.add_child(row)
	var group := ButtonGroup.new()
	for value in values:
		var button := UI.button(value, func() -> void: GameState.set_setting(key, value))
		button.toggle_mode = true
		button.button_group = group
		button.button_pressed = GameState.get_setting(key) == value
		button.size_flags_horizontal = SIZE_EXPAND_FILL
		button.add_theme_font_size_override("font_size", 16 if str(value).length() > 25 else 19)
		row.add_child(button)

func sign_contract() -> void:
	if GameState.contracts.size() >= GameState.MAX_CONTRACTS:
		show_screen("new")
		return
	GameState.sign_contract()
	load_mode = "signed"
	start_loading()

func build_ledger() -> void:
	var body := make_paper("The Contract Ledger", "Choose a contract to continue. Saves stay on this device / browser.")
	var column := UI.scroll_column(body)
	if GameState.contracts.is_empty():
		column.add_child(UI.label("No contracts signed yet.", 28))
	for index in range(GameState.contracts.size() - 1, -1, -1):
		var contract: Dictionary = GameState.contracts[index]
		column.add_child(UI.label("Contract %d · %s · %s" % [index + 1, contract.name, contract.created.replace("T", " ")], 24))
		var row := HBoxContainer.new()
		column.add_child(row)
		var resume := UI.button("CONTINUE", func() -> void:
			GameState.active_contract = contract
			load_mode = "restored"
			start_loading())
		resume.size_flags_horizontal = SIZE_EXPAND_FILL
		row.add_child(resume)
		row.add_child(UI.button("REMOVE…", confirm_delete.bind(str(contract.id))))
		column.add_child(UI.rule())

func confirm_delete(id: String) -> void:
	var dialog := ConfirmationDialog.new()
	dialog.title = "Remove contract?"
	dialog.dialog_text = "This deletes this contract from this device. It cannot be undone."
	dialog.ok_button_text = "REMOVE"
	add_child(dialog)
	dialog.confirmed.connect(func() -> void:
		GameState.delete_contract(id)
		dialog.queue_free()
		show_screen("ledger"))
	dialog.canceled.connect(dialog.queue_free)
	dialog.popup_centered(Vector2i(560, 180))

func build_options() -> void:
	var body := make_paper("Options", "The choices you carry into the dark", true)
	var options := Control.new()
	options.set_script(OptionsPage)
	options.size = body.size
	body.add_child(options)
	UI.fill(options)

func build_codex() -> void:
	var body := make_paper("Codex", "Excerpts, ledgers & catalogues of the road", true)
	var tabs := VBoxContainer.new()
	UI.at(tabs, body, Rect2(0, 0, 235, body.size.y))
	for tab in [["rules", "RULES"], ["lore", "LORE"], ["best", "BESTIARY"]]:
		tabs.add_child(UI.button(tab[1], func() -> void:
			selected_codex = tab[0]
			show_screen("codex")))
	var holder := Control.new()
	UI.at(holder, body, Rect2(270, 0, body.size.x - 270, body.size.y))
	var column := UI.scroll_column(holder)
	if selected_codex == "best":
		column.add_child(UI.label("No creatures catalogued yet.", 28))
		return
	if selected_codex == "lore" and GameState.contracts.is_empty():
		column.add_child(UI.label("The ledger is blank. Lore earns itself.", 28))
		return
	for entry in GameState.content[selected_codex]:
		column.add_child(UI.label(entry.k, 17))
		column.add_child(UI.label(entry.t, 30, true))
		if entry.has("bb"):
			var rtl := UI.rich()
			rtl.text = entry.bb
			rtl.fit_content = true
			rtl.custom_minimum_size.x = 880
			column.add_child(rtl)
		else:
			column.add_child(UI.label(entry.body, 24))
		column.add_child(UI.rule())

func build_credits() -> void:
	var body := make_paper("Credits", "Hold Space or Shift to hasten · scroll to read", true)
	var column := UI.scroll_column(body)
	credits_scroll = column.get_parent()
	credits_position = 0.0
	var entries := [
		["DESIGN & DIRECTION", "The DELVE design table"],
		["ORIGINAL WEB SHELL", "Hand-written HTML, CSS and JavaScript"],
		["GODOT CONVERSION", "Native scenes, GDScript, a local contract ledger and a web-compatible 3D foundation"],
		["ART & LIGHTING", "Original DELVE generated panorama, map and logo artwork\nThe optional 3D yard uses placeholder primitives."],
		["AUDIO", "The supplied DELVE menu theme\nNo additional SFX or voice recordings are included."],
		["TYPEFACES", "Cinzel · Alegreya\nSIL Open Font License — license files included"],
		["ENGINE", "Godot Engine · MIT license\ngodotengine.org/license"],
		["ATTRIBUTION", LEGAL],
		["THE TABLE", "Made with love for the table. Never for sale."]]
	for entry in entries:
		var heading := UI.label(entry[0], 25, true)
		heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		column.add_child(heading)
		var text := UI.label(entry[1] + "\n\n", 26)
		text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		column.add_child(text)
	var end_seal := UI.seal(130)
	end_seal.rotation_degrees = -5
	end_seal.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	column.add_child(end_seal)
	var fin := UI.label("Made with love for the table. Never for sale.", 26)
	fin.add_theme_font_override("font", UI.body(400, true))
	fin.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	column.add_child(fin)

func start_loading() -> void:
	loading_error = false
	show_screen("loading")
	if ready_world:
		return
	var error := ResourceLoader.load_threaded_request(WORLD)
	if error != OK:
		loading_failed("Could not request test-yard scene (error %d)." % error)

func build_loading() -> void:
	var map := UI.image("res://assets/images/sword_coast_map.jpg")
	map.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	UI.at(map, content, Rect2(0, 0, 1600, 900))
	var shade := ColorRect.new()
	shade.color = Color(0.025, 0.035, 0.04, 0.6)
	UI.at(shade, content, Rect2(0, 0, 1600, 900))
	route_ctl = Control.new()
	route_ctl.set_script(preload("res://scripts/ui/load_route.gd"))
	UI.at(route_ctl, content, Rect2(0, 0, 1600, 900))
	var plate := Panel.new()
	plate.add_theme_stylebox_override("panel", UI.style(Color("f3ebd8"), Color(0.37, 0.24, 0.1, 0.6)))
	UI.at(plate, content, Rect2(430, 60, 740, 92))
	var lt := UI.centered_text(content, "NEVERWINTER — THE ROCKSEEKER CONTRACT", Rect2(440, 72, 720, 36), 26, true)
	lt.add_theme_color_override("font_color", UI.INK)
	var ls := UI.centered_text(content, "Preparing the threshold and the test yard", Rect2(440, 110, 720, 30), 18)
	ls.add_theme_color_override("font_color", Color("5b4630"))
	ls.add_theme_font_override("font", UI.body(400, true))
	var slip := Panel.new()
	slip.add_theme_stylebox_override("panel", UI.style(Color("f3ebd8"), Color(0.37, 0.24, 0.1, 0.6)))
	UI.at(slip, content, Rect2(64, 700, 600, 120))
	var kick := UI.label("FIELD ADVICE", 15, true)
	kick.add_theme_color_override("font_color", Color("6e4a1e"))
	UI.at(kick, content, Rect2(82, 710, 300, 24))
	var tips: Array = GameState.content.get("tips", [])
	tip_label = UI.label(tips[0] if tips else "", 19, false)
	tip_label.add_theme_font_override("font", UI.flavor(true))
	tip_label.add_theme_color_override("font_color", UI.INK)
	UI.at(tip_label, content, Rect2(82, 738, 566, 74))
	load_label = UI.centered_text(content, "", Rect2(250, 640, 1100, 40), 20)
	load_label.add_theme_font_override("font", UI.flavor(true))
	load_label.add_theme_color_override("font_color", Color("241a12"))
	load_seal = UI.seal(110)
	load_seal.pivot_offset = Vector2(55, 55)
	UI.at(load_seal, content, Rect2(745, 330, 110, 110))
	load_pct = UI.centered_text(content, "0%", Rect2(720, 450, 160, 30), 22)
	load_pct.add_theme_font_override("font", UI.flavor())
	load_pct.add_theme_color_override("font_color", UI.PAPER)
	var pip_row := HBoxContainer.new()
	pip_row.add_theme_constant_override("separation", 12)
	UI.at(pip_row, content, Rect2(754, 486, 92, 6))
	load_pips.clear()
	for i in 3:
		var pip := ColorRect.new()
		pip.color = Color(UI.PAPER, 0.25)
		pip.custom_minimum_size = Vector2(22, 4)
		pip_row.add_child(pip)
		load_pips.append(pip)
	load_shown = 0.0
	tip_clock = 0.0
	UI.at(UI.button("RETURN TO MENU", func() -> void: show_screen("menu")), content, Rect2(630, 830, 340, 48))

func loading_failed(message: String) -> void:
	loading_error = true
	load_label.text = "The road is washed out. " + message
	UI.at(UI.button("RETRY", start_loading), content, Rect2(650, 545, 300, 48))

func build_threshold() -> void:
	var body := make_paper("Contract " + load_mode, "The wax is set, Recruit.")
	var seal := UI.seal(120)
	seal.rotation_degrees = -6
	UI.at(seal, paper, Rect2(880, 40, 120, 120))
	var stamp := create_tween()
	stamp.tween_property(seal, "scale", Vector2(1.3, 1.3), 0.1)
	stamp.tween_property(seal, "scale", Vector2(1, 1), 0.3)
	var column := UI.scroll_column(body)
	column.add_child(UI.label("Your contract rests in the ledger. The full adventure is not implemented yet; the original web preview ends at this threshold.", 29))
	column.add_child(UI.rule())
	column.add_child(UI.label("OPTIONAL · 3D TEST YARD", 27, true))
	column.add_child(UI.label("Try movement, collision and first/third-person cameras in a simple blockout. This is a development foundation, not a finished Neverwinter level. No combat, quests or final 3D assets yet.", 25))
	column.add_child(UI.label("WASD move · Shift sprint · Space jump · Mouse look\nV changes view · Esc pauses / releases the mouse", 23))
	column.add_child(UI.button("ENTER THE TEST YARD", enter_yard))
	status_label = UI.label(GameState.storage_error, 22)
	column.add_child(status_label)

func enter_yard() -> void:
	if ready_world:
		GameState.persist()
		get_tree().change_scene_to_packed(ready_world)

func _setting_changed(key: String, _value: Variant) -> void:
	if key == "acc.hc":
		background.modulate = Color(0.45, 0.45, 0.45) if GameState.get_setting("acc.hc") == "On" else Color.WHITE
	if key == "acc.hc" and is_instance_valid(paper):
		if GameState.get_setting("acc.hc") == "On":
			paper.add_theme_stylebox_override("panel", UI.style(Color("fff4d8"), Color.BLACK, 3))
		else:
			var skin := StyleBoxTexture.new()
			skin.texture = preload("res://assets/images/parchment.png")
			paper.add_theme_stylebox_override("panel", skin)

func _save_failed(message: String) -> void:
	if is_instance_valid(status_label):
		status_label.text = message

func _process(delta: float) -> void:
	clock += delta
	state_time += delta
	if screen == "sting" and state_time > 4.2:
		show_screen("menu")
	if screen == "credits" and is_instance_valid(credits_scroll):
		var speed := 3.0 if Input.is_physical_key_pressed(KEY_SPACE) or Input.is_physical_key_pressed(KEY_SHIFT) else 1.0
		if credits_scroll.scroll_vertical != int(credits_position):
			credits_position = float(credits_scroll.scroll_vertical)
		credits_position += delta * 24 * speed
		credits_scroll.scroll_vertical = int(credits_position)
	if screen != "loading" or loading_error:
		return
	var progress: Array = []
	var status := ResourceLoader.THREAD_LOAD_LOADED if ready_world else ResourceLoader.load_threaded_get_status(WORLD, progress)
	var real := 0.0
	if status == ResourceLoader.THREAD_LOAD_FAILED or status == ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
		loading_failed("The test-yard scene could not be loaded.")
		return
	elif status == ResourceLoader.THREAD_LOAD_LOADED:
		if not ready_world:
			ready_world = ResourceLoader.load_threaded_get(WORLD)
		real = 0.7
		UI.display(900)
		UI.body(600, true)
		UI.flavor()
		real = 0.9
		if not GameState.content.is_empty():
			real = 1.0
	else:
		real = 0.7 * clampf(progress[0] if not progress.is_empty() else 0.0, 0.0, 1.0)
	if state_time < 1.2:
		real = minf(real, state_time / 1.2 * 0.7)
	load_shown = lerpf(load_shown, real, minf(1.0, delta * 3.2)) if GameState.get_setting("cam.reduced") != "On" else real
	if real >= 1.0 and load_shown > 0.995:
		load_shown = 1.0
	if is_instance_valid(route_ctl):
		route_ctl.progress = load_shown
		route_ctl.queue_redraw()
	if is_instance_valid(load_pct):
		load_pct.text = "%d%%" % int(load_shown * 100.0)
	for i in load_pips.size():
		load_pips[i].color = UI.MINT if load_shown >= 0.33 * (i + 1) - 0.001 else Color(UI.PAPER, 0.25)
	if is_instance_valid(load_seal) and GameState.get_setting("cam.reduced") != "On":
		load_seal.rotation_degrees = fposmod(state_time * 24.0, 360.0)
	tip_clock += delta
	if tip_clock > 5.0 and is_instance_valid(tip_label):
		tip_clock = 0.0
		var tips: Array = GameState.content.get("tips", [])
		if tips.size():
			tip_index = (tip_index + 1) % tips.size()
			var next_text: String = tips[tip_index]
			var tw := create_tween()
			tw.tween_property(tip_label, "modulate:a", 0.0, 0.35)
			tw.tween_callback(func() -> void: tip_label.text = next_text)
			tw.tween_property(tip_label, "modulate:a", 1.0, 0.35)
	if state_time > 6.0 and real < 1.0 and is_instance_valid(load_label):
		load_label.text = "Still packing the wagon… large loads take a moment on first visit."
	if status == ResourceLoader.THREAD_LOAD_LOADED and state_time > 1.2:
		if load_shown >= 1.0:
			show_screen("threshold")
		elif state_time > 8.0:
			show_screen("threshold")


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.echo:
		return
	var activation := (event is InputEventKey or event is InputEventMouseButton or event is InputEventJoypadButton) and event.is_pressed()
	if screen == "legal" and activation:
		begin_boot()
	elif screen == "sting" and activation and state_time > 1.5:
		show_screen("menu")
	elif event.is_action_pressed("ui_cancel") and screen not in ["menu", "legal", "sting"]:
		show_screen("menu")
	elif screen == "menu" and event is InputEventKey and event.pressed and event.physical_keycode == KEY_C:
		show_screen("codex")
	elif screen == "menu" and event is InputEventKey and event.pressed and event.physical_keycode in [KEY_W, KEY_S]:
		var focused := get_viewport().gui_get_focus_owner()
		var index := menu_buttons.find(focused)
		var direction := 1 if event.physical_keycode == KEY_S else -1
		for step in menu_buttons.size():
			index = posmod(index + direction, menu_buttons.size())
			if not menu_buttons[index].disabled:
				menu_buttons[index].grab_focus()
				break
	else:
		return
	get_viewport().set_input_as_handled()

func _input(event: InputEvent) -> void:
	var pressed := (event is InputEventKey or event is InputEventMouseButton or event is InputEventJoypadButton) and event.is_pressed()
	if pressed and screen == "legal":
		begin_boot()
		get_viewport().set_input_as_handled()
	elif pressed and screen == "sting" and state_time > 1.5:
		show_screen("menu")
		get_viewport().set_input_as_handled()
	# Space hastens the credits instead of activating the focused Back button.
	if screen == "credits" and event is InputEventKey and event.physical_keycode in [KEY_SPACE, KEY_SHIFT]:
		get_viewport().set_input_as_handled()
