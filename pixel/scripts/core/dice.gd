extends Node
## Dice — the single authority for every roll in the game (GDD-06 §6.4).
##
## Nothing else in the codebase may call `randi()` for a rules outcome. Every
## player-facing d20 goes through `d20_check()`, which returns the full result
## (both dice for advantage, the kept die, the maths line) so the Roll Moment
## UI can show the truth rather than a re-rolled animation.
##
## Rule references: R1 (the d20), R2 (advantage/disadvantage), R3 (AC & cover),
## R4 (checks vs DC).

signal rolled(result: Dictionary)

enum Mode { STRAIGHT = 0, ADVANTAGE = 1, DISADVANTAGE = -1 }

## Grammar: `NdM+K`, `NdM-K`, `NdM` — e.g. `1d8+3`, `2d6`, `1d4-1`.
const DICE_PATTERN := "^(\\d*)d(\\d+)([+-]\\d+)?$"

const HISTORY_LIMIT := 64

var history: Array[Dictionary] = []


## A single die of `sides`, drawn from a named RNG stream.
func die(sides: int = 20, stream_name: StringName = &"combat") -> int:
	if sides < 2:
		push_error("Dice.die: sides must be >= 2 (got %d)" % sides)
		return 1
	return _generator(stream_name).randi_range(1, sides)


## A d20, the workhorse of the ruleset.
func d20(stream_name: StringName = &"combat") -> int:
	return die(20, stream_name)


## Parse and roll a dice expression (`NdM+K`). Returns
## `{ expr, rolls, modifier, total, natural }`; `natural` is the first d20 face
## when the expression is a single d20, else 0.
func roll(expression: String, stream_name: StringName = &"combat") -> Dictionary:
	var regex := RegEx.new()
	regex.compile(DICE_PATTERN)
	var match_result := regex.search(expression.strip_edges().to_lower())
	if match_result == null:
		push_error("Dice.roll: cannot parse '%s'" % expression)
		return {"expr": expression, "rolls": [], "modifier": 0, "total": 0, "natural": 0}

	var count := int(match_result.get_string(1)) if not match_result.get_string(1).is_empty() else 1
	var sides := int(match_result.get_string(2))
	var modifier := int(match_result.get_string(3)) if not match_result.get_string(3).is_empty() else 0

	var rolls: Array[int] = []
	var total := 0
	for _i in count:
		var value := die(sides, stream_name)
		rolls.append(value)
		total += value
	total += modifier

	var result := {
		"expr": expression,
		"rolls": rolls,
		"modifier": modifier,
		"total": total,
		"natural": rolls[0] if count == 1 and sides == 20 else 0,
	}
	_record(result)
	return result


## A rules check or attack roll: d20 + modifier against a target number.
## `mode` applies R2 (roll two dice, keep the higher/lower; both cancel).
func d20_check(
	modifier: int,
	target: int,
	mode: int = Mode.STRAIGHT,
	stream_name: StringName = &"combat",
	label: String = ""
) -> Dictionary:
	var first := d20(stream_name)
	var second := d20(stream_name) if mode != Mode.STRAIGHT else 0
	var kept := first
	if mode == Mode.ADVANTAGE:
		kept = maxi(first, second)
	elif mode == Mode.DISADVANTAGE:
		kept = mini(first, second)

	var total := kept + modifier
	var result := {
		"kind": "check",
		"label": label,
		"dice": [first, second] if mode != Mode.STRAIGHT else [first],
		"kept": kept,
		"modifier": modifier,
		"total": total,
		"target": target,
		"success": total >= target,
		"natural": kept,
		"critical": kept == 20,
		"fumble": kept == 1,
		"advantage": mode,
		# Verbatim maths line for the Roll Moment (R14): `14 + 5 = 19 vs 15`.
		"maths": "%d + %d = %d vs %d" % [kept, modifier, total, target],
		"verdict": _verdict(total, target, kept),
	}
	_record(result)
	return result


## Passive score (R4): 10 + modifiers, used when the world observes without a roll.
func passive(modifier: int) -> int:
	return 10 + modifier


## Ability modifier from a score (R4): floor((score - 10) / 2).
func ability_modifier(score: int) -> int:
	return int(floor((score - 10) / 2.0))


func _verdict(total: int, target: int, kept: int) -> String:
	if kept == 20:
		return "CRIT"
	if kept == 1:
		return "FUMBLE"
	return "HIT" if total >= target else "MISS"


func _generator(stream_name: StringName) -> RandomNumberGenerator:
	if has_node("/root/Streams"):
		return Streams.stream(stream_name)
	var fallback := RandomNumberGenerator.new()
	fallback.randomize()
	return fallback


func _record(result: Dictionary) -> void:
	history.append(result)
	if history.size() > HISTORY_LIMIT:
		history.pop_front()
	rolled.emit(result)
