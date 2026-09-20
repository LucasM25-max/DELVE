extends Control
## Full visual replica of web shell menu background (GDD-02 §2.2)
## - Panorama drift (90s), handheld noise (9s), mist layers, gulls, vignette
## Matches CSS: .bg-cam, .bg-pan img, .bg-mist, .gulls, .bg-vig
var clock := 0.0
var image: TextureRect
var mist1: ColorRect
var mist2: ColorRect
var gulls: Array[Control] = []
var vig: ColorRect

func _ready() -> void:
	mouse_filter = MOUSE_FILTER_IGNORE
	clip_contents = true
	# Panorama
	image = ShellUI.image("res://assets/images/yard_dawn_panorama.jpg")
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	image.name = "BgPan"
	add_child(image)
	ShellUI.fill(image)

	# Mist layers — procedural radial gradients simulated with ColorRects + modulate
	mist1 = ColorRect.new()
	mist1.color = Color(0.94, 0.90, 0.82, 0.12)
	mist1.mouse_filter = MOUSE_FILTER_IGNORE
	mist1.name = "Mist1"
	add_child(mist1)
	ShellUI.fill(mist1)

	mist2 = ColorRect.new()
	mist2.color = Color(0.88, 0.84, 0.74, 0.10)
	mist2.mouse_filter = MOUSE_FILTER_IGNORE
	mist2.name = "Mist2"
	add_child(mist2)
	ShellUI.fill(mist2)

	# Gulls — 3 small controls with simple triangle path animation
	for i in 3:
		var gull := Control.new()
		gull.name = "Gull%d" % (i+1)
		gull.mouse_filter = MOUSE_FILTER_IGNORE
		gull.custom_minimum_size = Vector2(26, 8) if i==0 else Vector2(20, 6) if i==1 else Vector2(16, 5)
		gull.size = gull.custom_minimum_size
		# Visual: use a Label with ~ shape or ColorRect
		var line := ColorRect.new()
		line.color = Color(0.16, 0.18, 0.21, 0.65 if i==0 else 0.45)
		line.custom_minimum_size = gull.custom_minimum_size
		line.size = gull.custom_minimum_size
		gull.add_child(line)
		add_child(gull)
		gulls.append(gull)

	# Vignette — matches CSS .bg-vig: radial + linear gradients
	vig = ColorRect.new()
	vig.color = Color(0.03, 0.04, 0.05, 0.42)
	vig.mouse_filter = MOUSE_FILTER_IGNORE
	vig.name = "Vignette"
	add_child(vig)
	ShellUI.fill(vig)

	# Initial layout
	_resized()

func _resized() -> void:
	if not is_instance_valid(image):
		return
	image.size = size * 1.30
	image.position = -size * 0.15

func _process(delta: float) -> void:
	if GameState.get_setting("cam.reduced") == "On":
		return
	clock += delta

	# Panorama drift — 90s cycle + handheld 9s
	var drift_t := clock / 90.0
	# Simulate CSS @keyframes drift with sin/cos
	var scale := 1.12 + 0.20 * (0.5 + 0.5 * sin(drift_t * TAU * 0.7))
	var tx := sin(drift_t * TAU) * 0.15 + sin(clock / 28.0) * 0.025
	var ty := cos(drift_t * TAU * 0.8) * 0.04 + cos(clock / 34.0) * 0.015
	image.size = size * scale
	image.position = Vector2(tx * size.x, ty * size.y) - size * 0.15

	# Handheld noise on whole backdrop
	var hand_x := sin(clock / 9.0) * 2.0
	var hand_y := cos(clock / 7.3) * 1.5
	var hand_rot := sin(clock / 5.1) * 0.0015
	position = Vector2(hand_x, hand_y)
	rotation = hand_rot

	# Mist drift
	if is_instance_valid(mist1):
		mist1.position = Vector2(sin(clock / 64.0) * size.x * 0.03, 0)
	if is_instance_valid(mist2):
		mist2.position = Vector2(sin(clock / 91.0 + 1.3) * size.x * 0.025, 0)

	# Gulls — fly across
	for i in gulls.size():
		var gull: Control = gulls[i]
		var speed := 0.02 + float(i) * 0.008
		var base_y := [0.16, 0.22, 0.12][i] * size.y
		var t := fmod(clock * speed + float(i) * 12.0, 1.2) - 0.1 # -0.1 to 1.1
		var x := lerp(-0.06 * size.x, 1.06 * size.x, t) if i != 1 else lerp(1.06 * size.x, -0.06 * size.x, t)
		var y := base_y + sin(clock * 0.8 + float(i) * 2.1) * 14.0
		gull.position = Vector2(x, y)

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		_resized()
