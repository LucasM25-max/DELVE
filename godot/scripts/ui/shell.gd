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
	UI.at(word, content, Rect2(365, 230, 870, 240))
	var emblem := UI.image("res://assets/images/logo_emblem.png")
	UI.at(emblem, content, Rect2(725, 490, 150, 190))
	UI.centered_text(content, "A DUNGEONS & DRAGONS ADVENTURE", Rect2(300, 700, 1000, 36), 24, true)
	UI.centered_text(content, "PHANDELVER AND BELOW · THE SHATTERED OBELISK", Rect2(300, 745, 1000, 30), 19, true)
	word.modulate.a = 0.0
	emblem.modulate.a = 0.0
	sting_tween = create_tween()
	sting_tween.tween_property(word, "modulate:a", 1.0, 1.3)
	sting_tween.tween_property(emblem, "modulate:a", 1.0, 0.9)

func build_menu() -> void:
	UI.at(UI.image("res://assets/images/logo_emblem.png"), content, Rect2(133, 104, 84, 130))
	UI.at(UI.image("res://assets/images/logo_wordmark.png"), content, Rect2(243, 108, 425, 130))
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
	UI.at(UI.label("DELVE · GODOT EDITION 0.1\nNATIVE UI / WEB-READY", 16, true), content, Rect2(1210, 823, 350, 50))
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
	skin.texture = preload("res://assets/images/parchment.jpg")
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
	column.add_child(UI.label("Reference text carried over from the web preview. Combat is not implemented in this port.", 19))
	for entry in GameState.content[selected_codex]:
		column.add_child(UI.label(entry.k, 18))
		column.add_child(UI.label(entry.t, 30, true))
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
	shade.color = Color(0.025, 0.035, 0.04, 0.64)
	UI.at(shade, content, Rect2(0, 0, 1600, 900))
	UI.centered_text(content, "NEVERWINTER — THE ROCKSEEKER CONTRACT", Rect2(150, 88, 1300, 100), 32, true)
	UI.centered_text(content, "Preparing the threshold and optional 3D test yard", Rect2(250, 180, 1100, 50), 25)
	progress_bar = ProgressBar.new()
	progress_bar.show_percentage = true
	progress_bar.custom_minimum_size.y = 34
	UI.at(progress_bar, content, Rect2(290, 630, 1020, 34))
	load_label = UI.centered_text(content, "Packing the wagon…", Rect2(250, 680, 1100, 95), 25)
	UI.at(UI.button("RETURN TO MENU", func() -> void: show_screen("menu")), content, Rect2(630, 810, 340, 48))

func loading_failed(message: String) -> void:
	loading_error = true
	load_label.text = "The road is washed out. " + message
	UI.at(UI.button("RETRY", start_loading), content, Rect2(650, 545, 300, 48))

func build_threshold() -> void:
	var body := make_paper("Contract " + load_mode, "The wax is set, Recruit.")
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
			skin.texture = preload("res://assets/images/parchment.jpg")
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
	if not progress.is_empty():
		progress_bar.value = float(progress[0]) * 100
	if status == ResourceLoader.THREAD_LOAD_FAILED or status == ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
		loading_failed("The test-yard scene could not be loaded.")
	elif status == ResourceLoader.THREAD_LOAD_LOADED:
		if not ready_world:
			ready_world = ResourceLoader.load_threaded_get(WORLD)
		progress_bar.value = 100
		load_label.text = "The road is ready."
		if state_time > 1.2:
			show_screen("threshold")
	elif state_time > 45:
		load_label.text = "Still packing the wagon… large loads take a moment on first visit."

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
