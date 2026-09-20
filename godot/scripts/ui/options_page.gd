extends Control
## Data-driven native settings. Future-only controls are explicitly marked.
signal back_requested
var category := "graphics"
var content_host: Control
var listening_key := ""
var listening_button: Button

func _ready() -> void:
	var tabs := VBoxContainer.new()
	ShellUI.at(tabs, self, Rect2(0, 0, 230, size.y))
	for section in GameState.schema:
		var tab := ShellUI.button(section.title, show_category.bind(section.id))
		tabs.add_child(tab)
	content_host = Control.new()
	ShellUI.at(content_host, self, Rect2(260, 0, size.x - 260, size.y))
	show_category(category)

func show_category(id: String) -> void:
	category = id
	listening_key = ""
	for child in content_host.get_children():
		content_host.remove_child(child)
		child.queue_free()
	var column := ShellUI.scroll_column(content_host)
	column.add_child(ShellUI.label("Preferences are saved automatically.", 22))
	column.add_child(ShellUI.label("† Future game setting: stored, but not implemented in this shell or test yard.", 19))
	column.add_child(ShellUI.rule())
	for section in GameState.schema:
		if section.id != id:
			continue
		for row in section.rows:
			build_row(column, row)
	if id == "graphics":
		column.add_child(ShellUI.label("Web target: Compatibility / WebGL 2. Ray-traced shadows are unavailable. Resolution follows the browser window; its refresh rate may limit the frame cap.", 20))
	if id == "camera":
		column.add_child(ShellUI.label("View, FOV and boom length apply in the optional 3D yard. Reduced motion freezes the menu background and skips the logo animation.", 20))
	if id == "controls":
		column.add_child(ShellUI.label("Test yard: WASD move · mouse look · Esc releases mouse / pauses. Escape and WASD remain reserved. Rebinding a used key swaps the two actions. Menu: arrows or W/S, Enter, Tab; gamepad D-pad/A/B.", 21))
		column.add_child(ShellUI.button("RESET BINDINGS", reset_bindings))
	if id == "accessibility":
		column.add_child(ShellUI.label("High contrast affects the native UI; full screen-reader and colour-filter parity with browser HTML is not claimed. Subtitles and outline controls are reserved for later gameplay.", 20))
	if id == "audio":
		column.add_child(ShellUI.label("The supplied menu theme is included. SFX and voice channels are reserved until those assets are added.", 20))

func build_row(parent: VBoxContainer, row: Dictionary) -> void:
	var line := VBoxContainer.new()
	parent.add_child(line)
	line.add_child(ShellUI.label(row.label + (" †" if not row.live else ""), 23))
	var key: String = row.key
	if row.type == "choice":
		var option := OptionButton.new()
		option.custom_minimum_size.y = 46
		option.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		for value in row.values:
			option.add_item(value)
			var index := option.item_count - 1
			option.set_item_disabled(index, value in row.locked or (key == "gfx.rt" and value == "On"))
			if str(GameState.get_setting(key)) == value:
				option.select(index)
		option.item_selected.connect(func(index: int) -> void: GameState.set_setting(key, row.values[index]))
		line.add_child(option)
	elif row.type == "range":
		var bar := HBoxContainer.new()
		var slider := HSlider.new()
		slider.min_value = row.min
		slider.max_value = row.max
		slider.step = row.step
		slider.value = float(GameState.get_setting(key))
		slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		slider.custom_minimum_size = Vector2(200, 40)
		var readout := ShellUI.label(str(slider.value), 23)
		readout.custom_minimum_size.x = 70
		line.add_child(bar)
		bar.add_child(slider)
		bar.add_child(readout)
		slider.value_changed.connect(func(value: float) -> void:
			readout.text = str(snappedf(value, 0.1))
			GameState.set_setting(key, value))
	else:
		var button := Button.new()
		button.text = OS.get_keycode_string(int(GameState.get_setting(key)))
		button.custom_minimum_size.y = 44
		button.pressed.connect(func() -> void:
			if is_instance_valid(listening_button):
				listening_button.text = OS.get_keycode_string(int(GameState.get_setting(listening_key))) if listening_key != "" else listening_button.text
			listening_key = key
			listening_button = button
			button.text = "PRESS A KEY · ESC TO CANCEL")
		line.add_child(button)

func _input(event: InputEvent) -> void:
	if listening_key == "" or not event is InputEventKey or not event.pressed or event.echo:
		return
	if event.physical_keycode in [KEY_W, KEY_A, KEY_S, KEY_D]:
		get_viewport().set_input_as_handled()
		if is_instance_valid(listening_button):
			listening_button.text = "WASD RESERVED · CHOOSE ANOTHER KEY"
		return
	if event.physical_keycode != KEY_ESCAPE:
		var old: int = int(GameState.get_setting(listening_key))
		for key in GameState.settings:
			if key.begins_with("binds.") and key != listening_key and int(GameState.get_setting(key)) == event.physical_keycode:
				GameState.set_setting(key, old)
		GameState.set_setting(listening_key, event.physical_keycode)
	get_viewport().set_input_as_handled()
	listening_key = ""
	show_category(category)

func reset_bindings() -> void:
	for action in GameState.ACTION_KEYS:
		GameState.set_setting("binds." + action, GameState.ACTION_KEYS[action])
	show_category("controls")
