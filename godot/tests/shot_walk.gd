extends Node
## Visual evidence walk: godot --path . res://tests/shot_walk.tscn -- --test-mode --shots=/tmp/shots
## Captures PNGs of each upgraded surface under a real (xvfb) GL context.
var out_dir := "/tmp/shots"

func shot(shell: Control, name: String) -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	var image := shell.get_viewport().get_texture().get_image()
	image.save_png("%s/%s.png" % [out_dir, name])
	print("SHOT ", name)

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="):
			out_dir = a.split("=", 2)[1]
	DirAccess.make_dir_recursive_absolute(out_dir)
	process_mode = Node.PROCESS_MODE_ALWAYS
	call_deferred("run")

func run() -> void:
	GameState.contracts.clear()
	GameState.persist()
	GameState.set_setting("cam.reduced", "On")
	var shell = load("res://scenes/ui/shell.tscn").instantiate()
	add_child(shell)
	await get_tree().process_frame
	shell.show_screen("menu")
	await shot(shell, "r2-01-menu")
	shell.show_screen("contract")
	await shot(shell, "r2-02-contract")
	GameState.set_setting("cam.reduced", "Off")
	shell.sign_contract()
	await get_tree().process_frame
	await get_tree().create_timer(0.7).timeout
	await shot(shell, "r2-03-loading")
	for i in 600:
		await get_tree().process_frame
		if shell.screen == "threshold":
			break
	await shot(shell, "r2-04-threshold")
	shell.show_screen("codex")
	await shot(shell, "r2-05-codex")
	shell.show_screen("options")
	await shot(shell, "r2-06-options")
	shell.show_screen("credits")
	await get_tree().create_timer(1.2).timeout
	await shot(shell, "r2-07-credits")
	print("SHOTS_DONE")
	get_tree().quit(0)
