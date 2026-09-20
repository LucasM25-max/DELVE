extends CharacterBody3D
## Replace only Visuals/Placeholder when adding a .glb character.
## Keep the collision, controller, pivot and SpringArm owned by this scene.
const WALK_SPEED := 4.5
const RUN_SPEED := 7.5
const JUMP_SPEED := 5.5
var gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")
var first_person := false
@onready var pivot: Node3D = $CameraPivot
@onready var arm: SpringArm3D = $CameraPivot/SpringArm3D
@onready var camera: Camera3D = $CameraPivot/SpringArm3D/Camera3D
@onready var visuals: Node3D = $Visuals

func _ready() -> void:
	arm.add_excluded_object(get_rid())
	first_person = GameState.get_setting("cam.view") == "First person"
	apply_camera()

func apply_camera() -> void:
	camera.fov = float(GameState.get_setting("cam.fov")) if first_person else 72.0
	arm.spring_length = 0.0 if first_person else float(GameState.get_setting("cam.boom"))
	visuals.visible = not first_person

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		pivot.rotation.y -= event.relative.x * 0.0025
		pivot.rotation.x = clampf(pivot.rotation.x - event.relative.y * 0.0025, -1.0, 0.65)
	if event.is_action_pressed("game_view"):
		first_person = not first_person
		apply_camera()
		get_viewport().set_input_as_handled()

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= gravity * delta
	if Input.is_action_just_pressed("game_jump") and is_on_floor():
		velocity.y = JUMP_SPEED
	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var direction := Vector3(input.x, 0, input.y).rotated(Vector3.UP, pivot.rotation.y)
	var speed := RUN_SPEED if Input.is_action_pressed("game_sprint") else WALK_SPEED
	velocity.x = move_toward(velocity.x, direction.x * speed, delta * 24)
	velocity.z = move_toward(velocity.z, direction.z * speed, delta * 24)
	move_and_slide()
	if direction.length_squared() > 0.01:
		visuals.rotation.y = lerp_angle(visuals.rotation.y, atan2(-direction.x, -direction.z), delta * 12)
	if global_position.y < -12:
		global_position = Vector3(0, 1, 7)
		velocity = Vector3.ZERO
