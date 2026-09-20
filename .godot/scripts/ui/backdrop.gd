extends Control
## Low-cost animated matte: intentionally 2D until a real 3D menu yard is authored.
var clock := 0.0
var image: TextureRect

func _ready() -> void:
	mouse_filter = MOUSE_FILTER_IGNORE
	clip_contents = true
	image = ShellUI.image("res://assets/images/yard_dawn_panorama.jpg")
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	add_child(image)
	var shade := TextureRect.new()
	var gradient := Gradient.new()
	gradient.set_color(0, Color(0.025, 0.04, 0.05, 0.94))
	gradient.set_color(1, Color(0.025, 0.04, 0.05, 0.08))
	gradient.add_point(0.50, Color(0.025, 0.04, 0.05, 0.15))
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.fill_to = Vector2(1, 0)
	shade.texture = texture
	shade.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(shade)
	ShellUI.fill(shade)

func _process(delta: float) -> void:
	if GameState.get_setting("cam.reduced") != "On":
		clock += delta
	image.size = size * 1.10
	image.position = -size * 0.05 + Vector2(sin(clock / 28.0) * size.x * 0.025, cos(clock / 34.0) * size.y * 0.015)
