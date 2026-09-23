extends Control
## Full visual replica of web shell Options page (§2.5)
## Rail with icons + segmented pill controls + sliders + keycaps
signal back_requested
var category := "graphics"
var content_host: Control
var rail_host: Control
var sections: Dictionary = {}
var listening_key := ""
var listening_button: Button

func _ready() -> void:
	# Layout: left rail 200px + right content — NO ICONS per user request
	rail_host = VBoxContainer.new()
	rail_host.name = "Rail"
	rail_host.custom_minimum_size = Vector2(200, 0)
	rail_host.size_flags_vertical = Control.SIZE_EXPAND_FILL
	rail_host.add_theme_constant_override("separation", 6)
	ShellUI.at(rail_host, self, Rect2(0, 0, 200, size.y))

	content_host = Control.new()
	content_host.name = "Content"
	ShellUI.at(content_host, self, Rect2(230, 0, size.x - 230, size.y))

	# Build rail buttons — text only, no icons, no SVGs
	for section in GameState.schema:
		var id: String = str(section.get("id", ""))
		var title: String = str(section.get("title", ""))
		var btn := Button.new()
		btn.text = title
		btn.name = "RBtn_%s" % id
		btn.custom_minimum_size.y = 42
		btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
		btn.toggle_mode = true
		btn.add_theme_font_override("font", ShellUI.display(600))
		btn.add_theme_font_size_override("font_size", 13)
		btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		# Style: normal parchment, on = dark ink + bronze border
		var normal := StyleBoxFlat.new()
		normal.bg_color = Color.TRANSPARENT
		normal.content_margin_left = 12
		normal.content_margin_right = 12
		normal.content_margin_top = 9
		normal.content_margin_bottom = 9
		normal.corner_radius_top_left = 3
		normal.corner_radius_top_right = 3
		normal.corner_radius_bottom_left = 3
		normal.corner_radius_bottom_right = 3
		var hover := normal.duplicate() as StyleBoxFlat
		hover.bg_color = Color(0.37, 0.24, 0.1, 0.09)
		var active := StyleBoxFlat.new()
		active.bg_color = Color("1a2126")
		active.border_color = Color("b0793a")
		active.set_border_width_all(1)
		active.corner_radius_top_left = 3
		active.corner_radius_top_right = 3
		active.corner_radius_bottom_left = 3
		active.corner_radius_bottom_right = 3
		active.content_margin_left = 12
		active.content_margin_right = 12
		active.content_margin_top = 9
		active.content_margin_bottom = 9
		btn.add_theme_stylebox_override("normal", normal)
		btn.add_theme_stylebox_override("hover", hover)
		btn.add_theme_stylebox_override("pressed", active)
		btn.add_theme_stylebox_override("focus", active)
		btn.add_theme_color_override("font_color", Color("4a3620"))
		btn.add_theme_color_override("font_hover_color", Color("33261a"))
		btn.add_theme_color_override("font_pressed_color", Color("E9DFC8"))
		btn.add_theme_color_override("font_focus_color", Color("E9DFC8"))
		btn.pressed.connect(show_category.bind(id))
		rail_host.add_child(btn)

	show_category(category)

func show_category(id: String) -> void:
	category = id
	listening_key = ""
	# Update rail visual state
	for child in rail_host.get_children():
		if child is Button:
			var btn := child as Button
			var is_on: bool = btn.name == "RBtn_%s" % id
			btn.button_pressed = is_on
			# Add left bronze bar when on — via border
			if is_on:
				var active := StyleBoxFlat.new()
				active.bg_color = Color("1a2126")
				active.border_color = Color("d9a463")
				active.set_border_width_all(1)
				active.border_width_left = 3
				active.corner_radius_top_left = 3
				active.corner_radius_top_right = 3
				active.corner_radius_bottom_left = 3
				active.corner_radius_bottom_right = 3
				active.content_margin_left = 12
				active.content_margin_right = 12
				active.content_margin_top = 9
				active.content_margin_bottom = 9
				btn.add_theme_stylebox_override("normal", active)
				btn.add_theme_color_override("font_color", Color("E9DFC8"))
			else:
				var normal := StyleBoxFlat.new()
				normal.bg_color = Color.TRANSPARENT
				normal.content_margin_left = 12
				normal.content_margin_right = 12
				normal.content_margin_top = 9
				normal.content_margin_bottom = 9
				normal.corner_radius_top_left = 3
				normal.corner_radius_top_right = 3
				normal.corner_radius_bottom_left = 3
				normal.corner_radius_bottom_right = 3
				btn.add_theme_stylebox_override("normal", normal)
				btn.add_theme_color_override("font_color", Color("4a3620"))

	# Clear content
	for child in content_host.get_children():
		content_host.remove_child(child)
		child.queue_free()

	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.follow_focus = true
	content_host.add_child(scroll)
	ShellUI.fill(scroll)

	var column := VBoxContainer.new()
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_theme_constant_override("separation", 8)
	scroll.add_child(column)

	# Header help — matches web shell
	column.add_child(ShellUI.label("Preferences are saved automatically.", 22))
	column.add_child(ShellUI.label("† Future game setting: stored, but not implemented in this shell or test yard.", 19))
	column.add_child(ShellUI.rule())

	for section in GameState.schema:
		if str(section.get("id", "")) != id:
			continue
		for row in section.get("rows", []):
			build_row(column, row)

	# Section-specific footers — matches web shell ohelp
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
	var key: String = row.key
	# orow — grid: olabel + octl, with hairline and hover wash
	var orow := Panel.new()
	orow.custom_minimum_size.y = 56
	var orow_style := StyleBoxFlat.new()
	orow_style.bg_color = Color.TRANSPARENT
	orow_style.content_margin_left = 8
	orow_style.content_margin_right = 8
	orow_style.content_margin_top = 10
	orow_style.content_margin_bottom = 10
	orow_style.corner_radius_top_left = 2
	orow_style.corner_radius_top_right = 2
	orow_style.corner_radius_bottom_left = 2
	orow_style.corner_radius_bottom_right = 2
	orow.add_theme_stylebox_override("panel", orow_style)
	parent.add_child(orow)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 14)
	orow.add_child(hbox)
	ShellUI.fill(hbox)

	var olabel := Label.new()
	olabel.text = row.label + (" †" if not row.live else "")
	olabel.add_theme_font_override("font", ShellUI.display(600))
	olabel.add_theme_font_size_override("font_size", 13)
	olabel.add_theme_color_override("font_color", Color("4a3620"))
	olabel.custom_minimum_size.x = 180
	olabel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	olabel.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hbox.add_child(olabel)

	var octl := HBoxContainer.new()
	octl.alignment = BoxContainer.ALIGNMENT_END
	octl.add_theme_constant_override("separation", 8)
	octl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(octl)

	if row.type == "choice":
		var pills := FlowContainer.new()
		pills.alignment = FlowContainer.ALIGNMENT_END
		pills.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		octl.add_child(pills)
		var group := ButtonGroup.new()
		for value in row.get("values", []):
			var locked: bool = value in row.get("locked", []) or (key == "gfx.rt" and value == "On")
			var pill := ShellUI.pill_button(str(value), GameState.set_setting.bind(key, value), group, str(GameState.get_setting(key)) == str(value))
			pill.disabled = locked
			pills.add_child(pill)
	elif row.type == "range":
		var slider := HSlider.new()
		slider.min_value = float(row.get("min", 0.0))
		slider.max_value = float(row.get("max", 100.0))
		slider.step = float(row.get("step", 1.0))
		slider.value = float(GameState.get_setting(key))
		slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		slider.custom_minimum_size = Vector2(200, 26)
		slider.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		var readout := Label.new()
		readout.text = str(snappedf(slider.value, 0.1))
		readout.custom_minimum_size.x = 60
		readout.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		readout.add_theme_font_override("font", ShellUI.flavor(true))
		readout.add_theme_font_size_override("font_size", 14)
		readout.add_theme_color_override("font_color", Color("33261a"))
		octl.add_child(slider)
		octl.add_child(readout)
		slider.value_changed.connect(func(value: float) -> void:
			readout.text = str(snappedf(value, 0.1)) + (" m" if key == "cam.boom" else "%" if key == "cam.shake" else "")
			GameState.set_setting(key, value))
	else:
		# binding — keycap
		var button := Button.new()
		button.text = OS.get_keycode_string(int(GameState.get_setting(key)))
		button.custom_minimum_size.y = 36
		button.custom_minimum_size.x = 74
		button.add_theme_font_override("font", ShellUI.flavor(true))
		button.add_theme_font_size_override("font_size", 14)
		button.add_theme_color_override("font_color", Color("E9DFC8"))
		var kstyle := StyleBoxFlat.new()
		kstyle.bg_color = Color("1a2126")
		kstyle.border_color = Color("5e3d19")
		kstyle.set_border_width_all(1)
		kstyle.corner_radius_top_left = 5
		kstyle.corner_radius_top_right = 5
		kstyle.corner_radius_bottom_left = 5
		kstyle.corner_radius_bottom_right = 5
		kstyle.content_margin_left = 12
		kstyle.content_margin_right = 12
		kstyle.content_margin_top = 8
		kstyle.content_margin_bottom = 8
		kstyle.shadow_color = Color(0,0,0,0.45)
		kstyle.shadow_size = 4
		button.add_theme_stylebox_override("normal", kstyle)
		button.add_theme_stylebox_override("hover", kstyle)
		button.add_theme_stylebox_override("pressed", kstyle)
		button.pressed.connect(func() -> void:
			if is_instance_valid(listening_button):
				listening_button.text = OS.get_keycode_string(int(GameState.get_setting(listening_key))) if listening_key != "" else listening_button.text
			listening_key = key
			listening_button = button
			button.text = "PRESS A KEY")
		octl.add_child(button)

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
		for k in GameState.settings:
			if k.begins_with("binds.") and k != listening_key and int(GameState.get_setting(k)) == event.physical_keycode:
				GameState.set_setting(k, old)
		GameState.set_setting(listening_key, event.physical_keycode)
	get_viewport().set_input_as_handled()
	listening_key = ""
	show_category(category)

func reset_bindings() -> void:
	for action in GameState.ACTION_KEYS:
		GameState.set_setting("binds." + action, GameState.ACTION_KEYS[action])
	show_category("controls")
