extends Node3D
## Corwin — the muster-yard lane guard (GDD-03 §4.A A1, "Corvin" in the spec;
## canonical spelling per docs/11 D0). Home: guard box at (2.5, 1.5) r0.
## Idle: leans on the sill, scans the lane. Blocks nothing (the cordon does).
##
## Behaviour per docs/11_CORWIN_GUARD_NPC_IMPLEMENTATION_PLAN.md:
##   * body/animations = the CC0 R13 pipeline (Quaternius body + UAL clips),
##     library copied at runtime exactly like player.gd (zero retargeting);
##   * "leans"  = constant spine pose offset over UAL Idle (D8 — UAL has no
##     lean clip; a baked lean can replace this without interface change);
##   * "scans lane" = eased head-yaw sweep about the dock-lane bearing,
##     split across neck_01 + Head, randomised dwells (deterministic seed);
##   * say() plays the three §9 VO_GRD lines spatialised, never overlapping
##     (S10: each line fires exactly once — callers own the one-shot guard);
##   * VO_GRD_001 is fired by TR_A_LANE first-entry via _on_lane_body_entered.
##
## Pose offsets are applied right after each manual animation advance, so the
## UAL Idle keeps driving the base pose and the offsets read as settle + gaze.

const UAL_PATH := "res://assets/characters/universal/UAL1_Standard.glb"
const ANIM_IDLE := "Idle"
const ANIM_TALK := "Idle_Talking"

## Tuning constants — the spec gives no numbers (plan §6 Q3); tuned by eye.
const LEAN_DEG := 4.0           # forward settle on the spine (D8)
const LEAN_SIDE_DEG := 5.0      # lateral settle, positive = toward his right
const SCAN_SWING_DEG := 30.0    # sweep amplitude about the lane bearing
const SCAN_TURN_TIME := 1.4     # eased turn between dwell extremes
const SCAN_DWELL_MIN := 1.8
const SCAN_DWELL_MAX := 3.4
const LANE_TARGET := Vector3(0, 0, -6)  # mid dock lane (spec (0,-6))

const VO_LINES := {
	"VO_GRD_001": "res://assets/audio/vo_grd_001.ogg",
	"VO_GRD_002": "res://assets/audio/vo_grd_002.ogg",
	"VO_GRD_003": "res://assets/audio/vo_grd_003.ogg",
}

enum Scan { DWELL, TURN }

var anim: AnimationPlayer
var voice: AudioStreamPlayer3D
var _skel: Skeleton3D
var _b_spine1 := -1
var _b_spine2 := -1
var _b_neck := -1
var _b_head := -1
var _streams := {}
var _busy := false
var _lane_said := false

var _scan_centre := 0.0          # local yaw (deg) toward the lane
var _scan_yaw := 0.0             # current local yaw (deg)
var _scan_from := 0.0
var _scan_to := 0.0
var _scan_t := 0.0
var _scan_dwell := 0.0
var _scan_state := Scan.DWELL
var _scan_targets: PackedFloat32Array = PackedFloat32Array()
var _scan_i := 0
var _rng := RandomNumberGenerator.new()

var _debug_freeze := false
var _debug_scan := 0.0
var _debug_lean := NAN


func _ready() -> void:
	_rng.seed = 0xD3119  # deterministic idle variation (QA/shot friendly)
	voice = $Voice
	for key: String in VO_LINES:
		_streams[key] = load(VO_LINES[key])
	_build_animations()
	_skel = _find_skeleton($Visuals/Hero)
	if _skel != null:
		_b_spine1 = _skel.find_bone("spine_01")
		_b_spine2 = _skel.find_bone("spine_02")
		_b_neck = _skel.find_bone("neck_01")
		_b_head = _skel.find_bone("Head")
	var local_lane := to_local(LANE_TARGET)
	_scan_centre = rad_to_deg(atan2(local_lane.x, local_lane.z))
	_scan_targets = PackedFloat32Array([
		_scan_centre + SCAN_SWING_DEG * 0.2,
		_scan_centre + SCAN_SWING_DEG,
		_scan_centre - SCAN_SWING_DEG * 0.4,
		_scan_centre - SCAN_SWING_DEG,
		_scan_centre + SCAN_SWING_DEG * 0.55,
	])
	_scan_yaw = _scan_centre
	_scan_to = _scan_centre
	_scan_dwell = _rng.randf_range(SCAN_DWELL_MIN, SCAN_DWELL_MAX)
	_apply_pose()  # settle immediately — no pop at spawn


func _process(delta: float) -> void:
	if anim != null:
		anim.advance(delta)  # manual callback mode: we own the step order
	if not _debug_freeze and not _busy:
		_update_scan(delta)
	_apply_pose()


func _build_animations() -> void:
	# Identical to player.gd::_build_animations — the UAL library lives on the
	# hero root so its "Armature/Skeleton3D:*" tracks resolve (R13 pipeline).
	var ual: Node = load(UAL_PATH).instantiate()
	var src: AnimationPlayer = null
	for child in ual.get_children():
		if child is AnimationPlayer:
			src = child
	if src == null:
		ual.free()
		return
	anim = AnimationPlayer.new()
	anim.name = "UAL"
	$Visuals/Hero.add_child(anim)
	var lib := src.get_animation_library("")
	var out := AnimationLibrary.new()
	for aname in lib.get_animation_list():
		out.add_animation(aname, lib.get_animation(aname))
	anim.add_animation_library("", out)
	ual.free()
	# Pose offsets run after the animation step, so drive it manually.
	anim.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	anim.play(ANIM_IDLE)


func _find_skeleton(n: Node) -> Skeleton3D:
	if n is Skeleton3D:
		return n
	for c in n.get_children():
		var r := _find_skeleton(c)
		if r != null:
			return r
	return null


func _update_scan(delta: float) -> void:
	match _scan_state:
		Scan.DWELL:
			_scan_t += delta
			if _scan_t >= _scan_dwell:
				_scan_state = Scan.TURN
				_scan_t = 0.0
				_scan_from = _scan_yaw
				_scan_i = (_scan_i + 1) % _scan_targets.size()
				_scan_to = _scan_targets[_scan_i]
		Scan.TURN:
			_scan_t += delta
			var u := clampf(_scan_t / SCAN_TURN_TIME, 0.0, 1.0)
			var e := u * u * (3.0 - 2.0 * u)  # smoothstep
			_scan_yaw = lerpf(_scan_from, _scan_to, e)
			if u >= 1.0:
				_scan_state = Scan.DWELL
				_scan_t = 0.0
				_scan_dwell = _rng.randf_range(SCAN_DWELL_MIN, SCAN_DWELL_MAX)


func _apply_pose() -> void:
	if _skel == null:
		return
	var lean_deg := LEAN_DEG
	var side_deg := LEAN_SIDE_DEG
	var yaw_deg := _scan_yaw
	if _debug_freeze:
		yaw_deg = _debug_scan
		if not is_nan(_debug_lean):
			lean_deg = _debug_lean
			side_deg = 0.0
	# Skeleton space: +Y up, +Z the model's forward (glTF convention).
	var lean_q := Quaternion(Vector3.RIGHT, deg_to_rad(lean_deg)) \
		* Quaternion(Vector3(0, 0, 1), deg_to_rad(-side_deg))
	var scan_q := Quaternion(Vector3.UP, deg_to_rad(yaw_deg))
	_apply_offset(_b_spine1, Quaternion.IDENTITY.slerp(lean_q, 0.4))
	_apply_offset(_b_spine2, Quaternion.IDENTITY.slerp(lean_q, 0.6))
	_apply_offset(_b_neck, Quaternion.IDENTITY.slerp(scan_q, 0.5))
	_apply_offset(_b_head, Quaternion.IDENTITY.slerp(scan_q, 0.5))


func _apply_offset(bone: int, offset: Quaternion) -> void:
	## Re-express `offset` (skeleton space) as a local pose delta on `bone`,
	## applied on top of whatever the animation step just wrote.
	if bone < 0:
		return
	var parent := _skel.get_bone_parent(bone)
	var local := _skel.get_bone_pose_rotation(bone)
	var parent_q := Quaternion.IDENTITY
	if parent >= 0:
		parent_q = _skel.get_bone_global_pose(parent).basis.get_rotation_quaternion()
	_skel.set_bone_pose_rotation(bone, parent_q.inverse() * offset * (parent_q * local))


## Play a §9 VO_GRD line (spatialised). Refuses to overlap an in-flight line.
## Returns true when playback starts. Callers own one-shot semantics (S10).
func say(line: String) -> bool:
	if _busy:
		return false
	var stream: AudioStream = _streams.get(line)
	if stream == null:
		return false
	_busy = true
	voice.stream = stream
	voice.play()
	if anim != null and anim.has_animation(ANIM_TALK):
		anim.play(ANIM_TALK, 0.2)
	Sound.duck_bed(stream.get_length())  # GDD-03 §7/§12 bed duck (-6 dB)
	get_tree().create_timer(stream.get_length()).timeout.connect(_end_line, CONNECT_ONE_SHOT)
	return true


func _end_line() -> void:
	_busy = false
	if anim != null and anim.has_animation(ANIM_IDLE):
		anim.play(ANIM_IDLE, 0.2)


## TR_A_LANE first entry (GDD-03 §4.A S5) -> VO_GRD_001, exactly once (S10).
func _on_lane_body_entered(body: Node3D) -> void:
	if _lane_said:
		return
	if body is CharacterBody3D and body.name == "Player":
		_lane_said = true
		say("VO_GRD_001")


## Deterministic pose for screenshot/QA captures (plan Step 7).
func debug_set_pose(scan_deg: float, lean_deg: float = NAN) -> void:
	_debug_freeze = true
	_debug_scan = scan_deg
	_debug_lean = lean_deg
	_apply_pose()
