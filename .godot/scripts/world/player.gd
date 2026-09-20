extends CharacterBody3D
## Humanoid v0.3: Visuals/Hero is the CC0 Quaternius Superhero Male base character,
## driven by the CC0 Universal Animation Library (identical 65-bone universal rig,
## zero retargeting). Keep the collision, controller, pivot and SpringArm owned here.
const WALK_SPEED := 4.5
const RUN_SPEED := 7.5
const JUMP_SPEED := 5.5
var gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")
var first_person := false
@onready var pivot: Node3D = $CameraPivot
@onready var arm: SpringArm3D = $CameraPivot/SpringArm3D
@onready var camera: Camera3D = $CameraPivot/SpringArm3D/Camera3D
@onready var visuals: Node3D = $Visuals
@onready var hero: Node3D = $Visuals/Hero
var anim: AnimationPlayer
var _was_airborne := false
const UAL_PATH := "res://assets/characters/universal/UAL1_Standard.glb"
# glTF import trims "_Loop" suffixes; these are the keys as Godot stores them.
const ANIM_IDLE := "Idle"
const ANIM_WALK := "Walk"
const ANIM_JOG := "Jog_Fwd"
const ANIM_SPRINT := "Sprint"
const ANIM_JUMP := "Jump"
const ANIM_JUMP_LAND := "Jump_Land"

func _ready() -> void:
	arm.add_excluded_object(get_rid())
	# FIX: Camera was in front of the player (SpringArm at -Z), so W moved towards camera.
	# Rotate the arm 180° so the camera sits behind the player (+Z when yaw=0).
	# Now W (-Z) moves away from the camera, S (+Z) moves towards it, as expected.
	arm.rotation.y = PI
	first_person = GameState.get_setting("cam.view") == "First person"
	_build_animations()
	apply_camera()

func _build_animations() -> void:
	var ual: Node = load(UAL_PATH).instantiate()
	var src: AnimationPlayer = null
	for child in ual.get_children():
		if child is AnimationPlayer:
			src = child
	anim = AnimationPlayer.new()
	anim.name = "UAL"
	hero.add_child(anim)   # sibling of Armature: track paths resolve onto the hero skeleton
	var lib := src.get_animation_library("")
	var out := AnimationLibrary.new()
	for aname in lib.get_animation_list():
		out.add_animation(aname, lib.get_animation(aname))
	anim.add_animation_library("", out)
	ual.free()
	anim.play(ANIM_IDLE)

func _animation_state() -> String:
	if not is_on_floor():
		return ANIM_JUMP
	var hspeed := Vector2(velocity.x, velocity.z).length()
	if hspeed < 0.2:
		return ANIM_IDLE
	if hspeed < WALK_SPEED + 0.4:
		return ANIM_WALK
	if hspeed < RUN_SPEED - 0.4:
		return ANIM_JOG
	return ANIM_SPRINT

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
	if anim:
		var target := _animation_state()
		if _was_airborne and is_on_floor() and anim.current_animation != "Jump_Land":
			anim.play(ANIM_JUMP_LAND, 0.1)
		elif anim.current_animation != target and not (_was_airborne and not is_on_floor() and target == ANIM_JUMP and anim.current_animation == ANIM_JUMP_LAND):
			anim.play(target, 0.25)
		_was_airborne = not is_on_floor()
	if direction.length_squared() > 0.01:
		visuals.rotation.y = lerp_angle(visuals.rotation.y, atan2(-direction.x, -direction.z), delta * 12)
	if global_position.y < -12:
		global_position = Vector3(0, 1, 7)
		velocity = Vector3.ZERO
