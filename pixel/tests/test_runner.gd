extends Node
## Test runner for the pixel build.
##
##     godot --headless --path pixel res://tests/test_runner.tscn
##
## Exits 0 when every check passes, 1 otherwise. No test framework: the suite is
## a list of small functions, each asserting through `check()` / `eq()`, so it
## runs in a plain headless Godot with nothing installed.
##
## Coverage (GDD-07 §13 QA list, the parts that exist in this build):
##   palette mirror · string master · save ledger · dice & RNG streams ·
##   shell state machine · text wrapping · menu layout rects · screen build-out ·
##   brand geometry · art brief compliance · the §5.5 Play/Continue pages ·
##   the §5.6 options rows, sliders and rebinds.
##
## The suite backs up and restores `user://delve_v2.json`, so it can be run on a
## machine that already has a real contract ledger.

const MENU_SCENE := "res://scenes/ui/screens/menu.tscn"
const SAVE_PATH := "user://delve_v2.json"
const SAVE_BACKUP := "user://delve_v2.test-backup.json"

var _failures: Array[String] = []
var _checks := 0
var _current := ""

func _ready() -> void:
	_backup_save()
	_run("palette", test_palette)
	_run("shell data", test_shell_data)
	_run("save ledger", test_save_ledger)
	_run("dice", test_dice)
	_run("rng streams", test_streams)
	_run("shell state", test_state_machine)
	_run("text wrapping", test_text_wrapping)
	_run("menu layout", test_menu_layout)
	_run("menu screen", test_menu_screen)
	_run("boot screens", test_boot_screens)
	_run("legal page fits", test_legal_page_fits)
	_run("brand geometry", test_brand)
	_run("pill group", test_pill_group)
	_run("slider", test_slider)
	_run("first run page", test_first_run_page)
	_run("contract card", test_contract_card)
	_run("ledger screen", test_ledger_screen)
	_run("options screen", test_options_screen)
	_restore_save()
	_report()


# --- harness -----------------------------------------------------------

func _run(label: String, test: Callable) -> void:
	_current = label
	var before := _failures.size()
	test.call()
	var status := "ok  " if _failures.size() == before else "FAIL"
	print("  %s %s" % [status, label])


func check(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append("[%s] %s" % [_current, message])


func eq(actual: Variant, expected: Variant, message: String) -> void:
	check(actual == expected, "%s (expected %s, got %s)" % [message, expected, actual])


func _report() -> void:
	print("")
	if _failures.is_empty():
		print("%d checks passed" % _checks)
		get_tree().quit(0)
		return
	print("%d of %d checks FAILED:" % [_failures.size(), _checks])
	for failure in _failures:
		print("  - " + failure)
	get_tree().quit(1)


func _backup_save() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.copy_absolute(SAVE_PATH, SAVE_BACKUP)
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE_PATH))


func _restore_save() -> void:
	var dir := DirAccess.open("user://")
	if dir == null:
		return
	if dir.file_exists("delve_v2.test-backup.json"):
		dir.remove("delve_v2.json")
		dir.rename("delve_v2.test-backup.json", "delve_v2.json")


# --- tests -------------------------------------------------------------

func test_palette() -> void:
	eq(Palette.SURFACE_HEX.size(), 32, "surface ramp holds 32 colours")
	eq(Palette.BELOW_HEX.size(), 8, "below ramp holds 8 colours")
	eq(Palette.REMAP.size(), 32, "every surface colour has a below remap")
	eq(Palette.surface(1), Color("#101418"), "ink-1 is #101418 (GDD-06 §5.3)")
	eq(Palette.bronze, Color("#B0793A"), "bronze-2 matches the wordmark colour")
	eq(Palette.infected(4), Color("#16343A"), "stone-0 remaps to teal_0")
	# The runtime mirror must equal the generated JSON deliverable.
	var file := FileAccess.open("res://assets/pixel/palette/palette_lut.json", FileAccess.READ)
	var lut: Dictionary = JSON.parse_string(file.get_as_text())
	var remap: Array = lut.get("remap", [])
	eq(remap.size(), 32, "palette_lut.json carries a 32-entry remap")
	for i in mini(remap.size(), 32):
		eq(int(remap[i]), Palette.REMAP[i], "LUT remap entry %d matches the script" % i)


func test_shell_data() -> void:
	eq(ShellData.strings.get("spec", {}).size(), 34, "34 strings in the §5.11 master")
	eq(ShellData.t("STR_MENU_PLAY"), "PLAY", "PLAY string")
	eq(ShellData.t("STR_BOOT_ANY"), "Press any button to continue.", "boot prompt string")
	eq(ShellData.t("STR_MENU_NOSAVE"), "No contracts signed yet.", "no-save tooltip")
	var formatted := ShellData.t("STR_LOAD_ERR", ["yard.tscn"])
	check(formatted.begins_with("The road is washed out."), "load error string formats {0}")
	check(formatted.contains("yard.tscn"), "load error string carries its argument")
	check(ShellData.t("STR_NOT_A_REAL_ID").begins_with("<"), "unknown ids fail loudly")
	eq(ShellData.content.get("loading_tips", []).size(), 16, "16 loading tips (§5.9)")
	eq(ShellData.menu_layout().get("item_pitch"), 21, "menu item pitch is 21 px (§5.4)")
	eq(ShellData.sting_timing().get("total_ms"), 4000, "sting is 4.0 s (§5.2)")
	eq(ShellData.options_schema().get("tabs", []).size(), 5, "5 options tabs (§5.6)")


func test_save_ledger() -> void:
	eq(SaveStore.slots().size(), 8, "the ledger holds 8 slots (§5.5)")
	check(not SaveStore.has_any_contract(), "a fresh ledger has no contract")
	var contract := {"name": "Testwrit", "class": "Fighter"}
	check(SaveStore.create_contract(0, contract), "slot 0 accepts a contract")
	check(SaveStore.has_any_contract(), "CONTINUE lights up once a contract exists")
	eq(SaveStore.latest_contract().get("name"), "Testwrit",
		"latest contract is the one just signed")
	eq(SaveStore.first_empty_slot(), 1, "first empty slot moves to 1")
	check(not SaveStore.create_contract(0, {"name": "Overwrite"}),
		"an occupied slot refuses a second contract")
	check(SaveStore.delete_contract(0), "a contract can be broken")
	check(not SaveStore.has_any_contract(), "the ledger is empty again")
	SaveStore.flush()
	eq(SaveStore.slot(0), {}, "an empty slot reads back as {}")


func test_dice() -> void:
	Streams.reseed_all(1234)
	for _i in 200:
		var roll := Dice.d20(&"combat")
		check(roll >= 1 and roll <= 20, "d20 stays in 1..20")
	var advantage := Dice.d20_check(5, 15, Dice.Mode.ADVANTAGE, &"combat", "advantage test")
	eq(advantage["dice"].size(), 2, "advantage rolls two dice (R2)")
	eq(advantage["kept"], maxi(advantage["dice"][0], advantage["dice"][1]), "advantage keeps the higher")
	var disadvantage := Dice.d20_check(5, 15, Dice.Mode.DISADVANTAGE, &"combat")
	eq(disadvantage["kept"], mini(disadvantage["dice"][0], disadvantage["dice"][1]),
		"disadvantage keeps the lower")
	var straight := Dice.d20_check(3, 12, Dice.Mode.STRAIGHT, &"combat")
	eq(straight["dice"].size(), 1, "a straight roll uses one die")
	check(String(straight["maths"]).contains(" + "), "the maths line reads like `14 + 5 = 19 vs 15` (R14)")
	eq(Dice.ability_modifier(10), 0, "score 10 gives modifier 0 (R4)")
	eq(Dice.ability_modifier(17), 3, "score 17 gives modifier +3 (R4)")
	eq(Dice.ability_modifier(8), -1, "score 8 gives modifier -1 (R4)")
	eq(Dice.passive(3), 13, "passive score is 10 + modifiers (R4)")
	var damage := Dice.roll("2d6+3", &"combat")
	eq(damage["rolls"].size(), 2, "2d6 rolls two dice")
	check(int(damage["total"]) >= 5 and int(damage["total"]) <= 15, "2d6+3 totals between 5 and 15")


func test_streams() -> void:
	Streams.reseed_all(99)
	var first := [_draw(&"combat"), _draw(&"combat")]
	Streams.reseed_all(99)
	var second := [_draw(&"combat"), _draw(&"combat")]
	eq(first, second, "the same root seed replays the same stream")
	Streams.reseed_all(99)
	var combat := Streams.stream(&"combat").randi_range(1, 100000)
	Streams.reseed_all(99)
	var fx := Streams.stream(&"fx").randi_range(1, 100000)
	check(combat != fx, "named streams are independent")
	Streams.reseed_all(20260923)


func _draw(stream_name: StringName) -> int:
	return Streams.stream(stream_name).randi_range(1, 1000)


func test_state_machine() -> void:
	# The test scene replaces the main scene, so boot the shell by hand: adding
	# it to the tree runs its _ready, which builds and shows the first screen.
	var packed: PackedScene = load("res://scenes/ui/shell.tscn")
	var shell: Node = packed.instantiate()
	add_child(shell)
	check(shell.get_node_or_null("ScreenHost") != null, "the shell builds its screen host")
	check(shell.get_node_or_null("FadeLayer") != null, "the shell builds its fade layer")
	eq(GameState.state, GameState.State.LEGAL, "the shell starts on the legal screen")
	GameState.transition_to(GameState.State.MENU)
	eq(GameState.state, GameState.State.MENU, "the machine moves to the menu")
	GameState.transition_to(GameState.State.STUB_CARD, {"stub": "play"}, true)
	eq(GameState.state, GameState.State.STUB_CARD, "a stub card opens")
	GameState.return_to_previous()
	eq(GameState.state, GameState.State.MENU, "and returns to the menu")
	check(GameState.is_boot_state() == false, "the menu is not a boot state")
	GameState.transition_to(GameState.State.MENU)
	check(GameState.is_boot_state() == false, "boot states are fixed to legal + sting")
	shell.queue_free()


func test_text_wrapping() -> void:
	var long := ShellData.t("STR_DISCLAIMER_FULL")
	var wrapped := UiPixel.wrap(long, 384.0, UiPixel.BODY)
	check(wrapped.contains("\n"), "the disclaimer wraps at 384 px")
	for line in wrapped.split("\n"):
		var width := UiPixel.text_width(line, UiPixel.BODY)
		check(width <= 384.0, "no wrapped line exceeds 384 px (line: '%s')" % line)
	var unwrapped := UiPixel.wrap("DELVE", 384.0, UiPixel.UI)
	check(not unwrapped.contains("\n"), "a short string stays on one line")
	eq(UiPixel.font_size(UiPixel.UI), 5, "the chrome face is 5 px (§5.4)")
	eq(UiPixel.font_size(UiPixel.BODY), 8, "the body face is 8 px (GDD-06 §4.8)")
	eq(UiPixel.font_size(UiPixel.DISPLAY), 10, "menu items draw at 10 px (5x7 at 2x, §5.4)")


func test_menu_layout() -> void:
	var layout := ShellData.menu_layout()
	eq(layout.get("column_x"), 29, "the menu column sits at x = 29 (6 % of 480)")
	eq(layout.get("lockup_rect"), [29, 22, 96, 24], "lockup rect matches §5.4")
	eq(layout.get("item_rect"), [29, 92, 140, 18], "PLAY rect matches §5.4")
	eq(layout.get("underline_offset_y"), 14, "hover underline sits at item_y + 14")
	eq(layout.get("underline_height"), 2, "underline is 2 px")
	eq(int(layout.get("item_pitch")) * 4 + 92, 176, "five rows end on CREDITS at y = 176")
	# Footer: §5.4 stacks nothing, but its single row cannot hold both strings at
	# the shipped 5 px face, so they are stacked - both verbatim, both in bounds.
	var stamp: Array = layout.get("version_stamp_rect", [])
	check(stamp.size() == 4, "the version stamp has its own rect")
	if stamp.size() == 4:
		check(float(stamp[0]) + float(stamp[2]) == 470.0, "the stamp stays right-aligned to 470")
		check(float(stamp[1]) + float(stamp[3]) <= 270.0, "the stamp stays inside the canvas")
	var disclaimer: Array = layout.get("disclaimer_rect", [])
	if disclaimer.size() == 4:
		check(float(disclaimer[1]) + float(disclaimer[3]) <= 270.0,
			"the disclaimer stays inside the canvas")
		check(float(disclaimer[1]) + float(disclaimer[3]) <= float(stamp[1]),
			"the stacked footer rows do not overlap")
	var disclaimer_width := UiPixel.text_width(
		ShellData.t("STR_DISCLAIMER_ABRIDGED"), UiPixel.UI)
	check(disclaimer_width <= float(disclaimer[2]),
		"the abridged disclaimer fits its rect (%.0f px of %s px)" % [disclaimer_width, disclaimer[2]])


func test_menu_screen() -> void:
	var packed: PackedScene = load(MENU_SCENE)
	var menu: ShellScreen = packed.instantiate()
	add_child(menu)
	menu.enter({})
	var items: Array = menu.get("_items")
	eq(items.size(), 5, "the menu builds five items")
	var origin := Rect2(29, 92, 140, 18)
	for i in items.size():
		var item: PixelMenuItem = items[i]
		eq(item.index, i, "item %d reports its index" % i)
		eq(item.position, origin.position + Vector2(0, 21 * i), "item %d sits on the §5.4 grid" % i)
		eq(item.size, origin.size, "item %d is 140x18" % i)
		check(item.text_width() > 0.0, "item %d measured its underline width" % i)
	check(items[1].enabled == false or SaveStore.has_any_contract(),
		"CONTINUE is dimmed until a contract exists")
	# The navigation ring wraps both ways.
	menu.call("_select", 0, false)
	menu.call("_select", 4, false)
	eq(menu.get("_selected"), 4, "selection reaches the last item")
	check(menu.get("_lockup") != null, "the lockup is built")
	eq(menu.get("_lockup").texture.get_size(), Brand.lockup_size(), "lockup texture matches brand.json")
	menu.leave()
	menu.queue_free()


func test_boot_screens() -> void:
	for path in ["res://scenes/ui/screens/legal.tscn", "res://scenes/ui/screens/sting.tscn",
			"res://scenes/ui/screens/stub.tscn"]:
		var packed: PackedScene = load(path)
		check(packed != null, "scene loads: " + path)
		var screen: ShellScreen = packed.instantiate()
		add_child(screen)
		screen.enter({"stub": "credits"})
		check(screen.get_child_count() > 0, "screen built out: " + path)
		screen.leave()
		screen.queue_free()
	# The sting's timeline numbers come from the timing file, not the script.
	var sting := ShellData.sting_timing()
	eq(float(sting.get("skippable_after_ms")), 1500.0, "the sting is skippable after 1.5 s")
	eq(sting.get("steps_light_ms").size(), 3, "three steps light during the sting")
	eq(sting.get("wordmark_chisel_ms").size(), 5, "five chisel strikes (one per letter)")


func test_legal_page_fits() -> void:
	var packed: PackedScene = load("res://scenes/ui/screens/legal.tscn")
	var legal: ShellScreen = packed.instantiate()
	add_child(legal)
	legal.enter({})
	var bottom: float = legal.call("content_bottom")
	check(bottom > 0.0, "the legal page measures its content height")
	check(bottom < 250.0, "legal content clears the pulse at y = 250 (bottom is %.1f px)" % bottom)
	legal.leave()
	legal.queue_free()




# --- §5.5 / §5.6 pages -------------------------------------------------

func test_pill_group() -> void:
	var group := PixelPillGroup.new()
	add_child(group)
	var seen: Array = []
	group.value_changed.connect(func(value: String) -> void: seen.append(value))
	group.setup(["Off", "On"], "On", Rect2(0, 0, 40, 16))
	eq(group.value, "On", "the group opens on the requested value")
	eq(group.index(), 1, "index() reports the selected pill")
	eq(PixelPillGroup.measure(["Off", "On"]),
		UiPixel.text_width("Off", UiPixel.UI) + 6 + 4 + UiPixel.text_width("On", UiPixel.UI) + 6,
		"measure() is the width PixelOptionsRow right-aligns against")
	group.select_index(0)
	eq(group.value, "Off", "select_index moves the selection")
	eq(seen, ["Off"], "and emits exactly one change")
	check(group.pill_for("On") != null, "pill_for returns the pill node")
	group.select_index(1)
	eq(seen.size(), 2, "a second change emits again")
	group.queue_free()


func test_slider() -> void:
	var slider := PixelSlider.new()
	add_child(slider)
	var seen: Array = []
	slider.value_changed.connect(func(value: int) -> void: seen.append(value))
	slider.setup(90, Rect2(0, 0, 95, 20))
	eq(slider.value, 90, "the slider opens on the saved volume")
	eq(slider.pips_filled(), 9, "90 shows nine of the ten pips")
	slider.set_value(100, true)
	eq(slider.pips_filled(), 10, "100 fills every pip")
	slider.set_value(105, true)
	eq(slider.value, 100, "values clamp to 100")
	slider.set_value(0, true)
	eq(slider.value, 0, "and to 0")
	slider.set_value(45)
	eq(seen.size(), 3, "set_value only emits when asked to")
	slider.queue_free()


func test_first_run_page() -> void:
	var packed: PackedScene = load("res://scenes/ui/screens/first_run.tscn")
	check(packed != null, "the First Run scene loads")
	var page: ShellScreen = packed.instantiate()
	add_child(page)
	page.enter({})
	var groups: Dictionary = page.call("groups")
	eq(groups.size(), 4, "the page builds Difficulty, Combat pacing, Subtitles and comfort")
	var difficulty: PixelPillGroup = groups.get("difficulty")
	var pacing: PixelPillGroup = groups.get("combat_pacing")
	check(difficulty != null and pacing != null, "both schema groups exist")
	eq(difficulty.value, "Balanced", "Difficulty defaults to Balanced (§5.5)")
	eq(pacing.value, "Table Mode (turn-based)", "Combat pacing defaults to Table Mode (§5.5)")
	eq(pacing.values.size(), 2, "pacing offers Table Mode and Skirmish Mode")
	eq(groups.get("subtitles").value, "On", "subtitles default to On")
	eq(groups.get("reduced_motion").value, "Standard", "camera comfort defaults to Standard")
	# The one documented deviation: SIGN & DESCEND writes the slot, then comes
	# back to the menu instead of riding into Loading -> YARD.
	var next: Array = []
	page.finished.connect(func(state: int, _payload: Dictionary) -> void: next.append(state))
	_clear_ledger()
	page.call("_sign_and_descend")
	check(SaveStore.has_any_contract(), "SIGN & DESCEND writes the contract into the ledger")
	eq(SaveStore.first_empty_slot(), 1, "the contract went into the first free slot (index 0)")
	eq(SaveStore.slot(0).get("name"), ShellData.t("STR_CONTRACT_NEW_NAME"),
		"the slot is labelled 'New contract' until the yard names it (P1)")
	eq(SaveStore.slot(0).get("chapter"), ShellData.t("STR_CONTRACT_CHAPTER"), "it lands in the prologue")
	eq(next, [GameState.State.MENU], "and the page returns to the menu")
	page.call("_on_back")
	eq(next, [GameState.State.MENU, GameState.State.MENU], "BACK also returns to the menu")
	page.leave()
	page.queue_free()


func test_contract_card() -> void:
	var packed: PackedScene = load(MENU_SCENE)
	var menu: ShellScreen = packed.instantiate()
	add_child(menu)
	menu.enter({})
	var next: Array = []
	menu.finished.connect(func(state: int, _payload: Dictionary) -> void: next.append(state))
	_clear_ledger()
	menu.call("_on_play")
	eq(next, [GameState.State.FIRST_RUN], "PLAY with no save opens First Run (§5.5)")
	SaveStore.create_contract(0, {"name": "New contract", "class": "Unassigned",
		"level": 1, "chapter": "Prologue"})
	menu.call("_on_play")
	check(menu.get("_overlay") != null, "PLAY with a save raises the overlay card")
	var overlay: Control = menu.get("_overlay")
	var found_body := false
	for child in overlay.get_children():
		if child is Label and (child as Label).text.contains("already exists"):
			found_body = true
	check(found_body, "the card carries the verbatim body string")
	check(next.size() == 1, "the card does not leave the menu")
	menu.call("_close_overlay")
	check(menu.get("_overlay") == null, "BACK closes the card")
	menu.leave()
	menu.queue_free()


func test_ledger_screen() -> void:
	_clear_ledger()
	SaveStore.create_contract(0, {"name": "New contract", "class": "Unassigned",
		"level": 1, "chapter": "Prologue"})
	var packed: PackedScene = load("res://scenes/ui/screens/ledger.tscn")
	var page: ShellScreen = packed.instantiate()
	add_child(page)
	page.enter({})
	var rows: Array = page.call("rows")
	eq(rows.size(), 8, "the ledger shows eight slots (§5.5)")
	eq(rows[0].used, true, "row 1 holds the signed contract")
	eq(rows[1].used, false, "row 2 is free")
	eq(Brand.stamp_file(Brand.steps_lit_for(0, 5)), "logo_emblem.png",
		"an untouched contract gets the plain stamp")
	eq(Brand.stamp_file(Brand.steps_lit_for(1, 5)), "logo_emblem_step1.png",
		"one finished beat lights the first step")
	eq(Brand.stamp_file(Brand.steps_lit_for(5, 5)), "logo_emblem_steps.png",
		"a finished yard lights all three")
	# Selecting a slot is the other documented deviation: the yard is not built,
	# so the ledger hands the slot back to the menu.
	var next: Array = []
	page.finished.connect(func(state: int, _payload: Dictionary) -> void: next.append(state))
	page.call("_on_row_selected", 0)
	eq(next, [GameState.State.MENU], "choosing a contract returns to the menu")
	# DELETE raises the blood confirm card; BREAK empties the slot.
	page.call("_on_delete_requested", 0)
	check(page.get("_card") != null, "DELETE raises the confirm card")
	page.call("_on_break_confirmed")
	check(SaveStore.slot(0).is_empty(), "BREAK empties the slot")
	check(page.get("_card") == null, "and dismisses the card")
	page.leave()
	page.queue_free()


func test_options_screen() -> void:
	var packed: PackedScene = load("res://scenes/ui/screens/options.tscn")
	var page: ShellScreen = packed.instantiate()
	add_child(page)
	page.enter({})
	eq(page.call("current_tab_id"), "graphics", "the page opens on Graphics")
	eq(page.call("rows").size(), 3, "Graphics holds the three §5.6 rows")
	eq(GameState.settings.get("frame_rate_cap"), "60", "the FPS cap defaults to 60 (§5.6)")
	eq(GameState.settings.get("volume_master"), 90, "the master volume defaults to 90")
	page.call("_show_tab", 4)
	eq(page.call("current_tab_id"), "controls", "the rail reaches Controls")
	var rows: Array = page.call("rows")
	eq(rows.size(), 12, "Controls holds the twelve rebind rows")
	eq(rows[0].action, "game_move", "the first rebind drives game_move")
	page.call("_scroll_by", 2)
	eq(page.get("_scroll"), 2, "the twelve rows scroll by two")
	page.call("_show_tab", 1)
	var locked: PixelOptionsRow = null
	for row in page.call("rows"):
		if row.row_id == "fast_travel":
			locked = row
	check(locked != null and locked.locked, "Fast travel is a locked row (§5.6)")
	eq(locked.value(), "Off", "and reads Off")
	# Sliders write through to the save and the audio buses.
	page.call("_on_row_value_changed", "volume_music", 40)
	eq(GameState.settings.get("volume_music"), 40, "a slider change lands in GameState")
	eq(SaveStore.settings().get("volume_music"), 40, "and in the save")
	var next: Array = []
	page.finished.connect(func(state: int, _payload: Dictionary) -> void: next.append(state))
	page.call("_on_back")
	eq(next, [GameState.State.MENU], "BACK commits and returns to the menu")
	GameState.settings["volume_music"] = 80
	SaveStore.set_setting("volume_music", 80)
	page.leave()
	page.queue_free()


func _clear_ledger() -> void:
	for index in SaveStore.SLOT_COUNT:
		if SaveStore.is_slot_used(index):
			SaveStore.delete_contract(index)



func test_brand() -> void:
	eq(Brand.emblem_size(), Vector2(24, 24), "the emblem is 24x24 (§5.1)")
	eq(Brand.emblem_step_rects().size(), 3, "three descending steps")
	eq(Brand.wordmark_cell_width(), 14.0, "wordmark cells are 12 px glyph + 2 px spacing")
	eq(Brand.wordmark_letters().size(), 5, "the wordmark is DELVE")
	eq(Brand.lit_step_count(0.1), 1, "one step lit at 10 %")
	eq(Brand.lit_step_count(0.9), 3, "three steps lit at 90 %")
	var emblem := load("res://assets/pixel/ui/logo_emblem.png") as Texture2D
	check(emblem != null, "the emblem texture loads")
	eq(emblem.get_size(), Vector2(24, 24), "the emblem PNG is 24x24")
	var strip := load("res://assets/pixel/ui/logo_wordmark_strip.png") as Texture2D
	eq(strip.get_size(), Vector2(70, 22), "the chisel strip is five 14 px cells")
