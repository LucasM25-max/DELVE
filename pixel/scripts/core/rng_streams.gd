extends Node
## RngStreams — named, independently seeded random streams (GDD-06 §4.4).
##
## Combat determinism must never be polluted by cosmetic randomness, so every
## consumer draws from its own stream:
##
##   world  — yard layout variance, idle NPC choices
##   combat — attack rolls, damage dice, saves (the golden-test stream)
##   ai     — enemy target and path picks
##   fx     — motes, spark jitter, dice-theatre tumble
##
## Streams are seeded from one root seed (the contract seed), so replaying a
## contract replays its rolls.

const STREAM_NAMES: PackedStringArray = PackedStringArray(["world", "combat", "ai", "fx"])
const DEFAULT_ROOT_SEED := 20260923  ## 2026-09-23, the day the pixel build was specced

var root_seed: int = DEFAULT_ROOT_SEED

var _streams: Dictionary = {}


func _ready() -> void:
	reseed_all(DEFAULT_ROOT_SEED)


## Reseed every stream from a root seed (called when a contract is loaded).
func reseed_all(seed_value: int) -> void:
	root_seed = seed_value
	_streams.clear()
	for index in STREAM_NAMES.size():
		var generator := RandomNumberGenerator.new()
		# Derived seeds: stable for a given root and stream name.
		generator.seed = hash("%d:%s" % [seed_value, STREAM_NAMES[index]])
		_streams[STREAM_NAMES[index]] = generator


## The generator for `name`, created on demand if a caller invents a new stream.
func stream(name: StringName = &"combat") -> RandomNumberGenerator:
	var key := String(name)
	if not _streams.has(key):
		var generator := RandomNumberGenerator.new()
		generator.seed = hash("%d:%s" % [root_seed, key])
		_streams[key] = generator
	return _streams[key]


## Convenience wrapper: an inclusive integer roll on a named stream.
func randi_range_on(name: StringName, from: int, to: int) -> int:
	return stream(name).randi_range(from, to)
