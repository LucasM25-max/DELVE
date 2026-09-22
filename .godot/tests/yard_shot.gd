extends Node
## Captures the test yard: paused overlay, then running bean on textured 3D ground.
var out_dir := "/tmp/shots"

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="):
			out_dir = a.split("=", 2)[1]
	DirAccess.make_dir_recursive_absolute(out_dir)
	process_mode = Node.PROCESS_MODE_ALWAYS
	call_deferred("run")

func run() -> void:
	var yard = load("res://scenes/world/test_yard.tscn").instantiate()
	add_child(yard)
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	get_viewport().get_texture().get_image().save_png("%s/r2-08-yard-paused.png" % out_dir)
	print("SHOT r2-08-yard-paused")
	yard.set_paused(false)
	await get_tree().create_timer(0.4).timeout
	# walk forward a moment so the bean is mid-stride in frame
	Input.action_press("move_forward")
	await get_tree().create_timer(1.2).timeout
	Input.action_release("move_forward")
	get_viewport().get_texture().get_image().save_png("%s/r2-09-yard-walk.png" % out_dir)
	print("SHOT r2-09-yard-walk")
	print("YARD_SHOTS_DONE")
	get_tree().quit(0)
