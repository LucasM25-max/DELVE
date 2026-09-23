extends Node
## ShellData — read-only access to the shell's data files.
##
## Every string, timing and option row the shell draws comes from `data/`, never
## from a literal in a scene file, so text can be reviewed and audited outside
## the engine:
##
##   data/strings.json         shell string master (GDD-07 §5.11 + build extras)
##   data/shell_timings.json   boot/sting/menu timings and layout numbers
##   data/shell_content.json   loading tips, credits blocks, legal blocks
##   data/options_schema.json  options tabs and rows (GDD-07 §5.6)
##
## `tools/check_strings.py` asserts the `spec` block matches the GDD byte for
## byte, so a typo can never ship quietly.

const STRINGS_PATH := "res://data/strings.json"
const TIMINGS_PATH := "res://data/shell_timings.json"
const CONTENT_PATH := "res://data/shell_content.json"
const OPTIONS_PATH := "res://data/options_schema.json"

var strings: Dictionary = {}
var timings: Dictionary = {}
var content: Dictionary = {}
var options_schema: Dictionary = {}

var _missing: Dictionary = {}


func _ready() -> void:
	strings = _load_json(STRINGS_PATH)
	timings = _load_json(TIMINGS_PATH)
	content = _load_json(CONTENT_PATH)
	options_schema = _load_json(OPTIONS_PATH)


## Look up a string by id (searched in `spec` then `build`), with optional
## `{0}`-style substitutions. Unknown ids return the id itself, wrapped in
## angle brackets, and are logged once — a loud failure beats a silent blank.
func text(id: String, args: Array = []) -> String:
	var value := String(strings.get("spec", {}).get(id, ""))
	if value.is_empty():
		value = String(strings.get("build", {}).get(id, ""))
	if value.is_empty():
		if not _missing.has(id):
			_missing[id] = true
			push_warning("ShellData: unknown string id '%s'" % id)
		return "<%s>" % id
	if args.is_empty():
		return value
	return value.format(args)


## Shorthand for `text()`.
func t(id: String, args: Array = []) -> String:
	return text(id, args)


## Convenience accessors for the timing tables (GDD-07 §5.2 / §5.4).
func boot_timing() -> Dictionary:
	return timings.get("boot", {})


func sting_timing() -> Dictionary:
	return timings.get("boot", {}).get("sting", {})


func menu_layout() -> Dictionary:
	return timings.get("menu", {})


func screen_timing() -> Dictionary:
	return timings.get("screens", {})


func loading_timing() -> Dictionary:
	return timings.get("loading", {})


## Default value for every options row, keyed by row id (GDD-07 §5.6).
func option_defaults() -> Dictionary:
	var defaults: Dictionary = {}
	for tab in options_schema.get("tabs", []):
		for row in tab.get("rows", []):
			defaults[row.get("id", "")] = row.get("default")
	return defaults


func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		push_error("ShellData: missing data file %s" % path)
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("ShellData: cannot open %s" % path)
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("ShellData: %s is not a JSON object" % path)
		return {}
	return parsed
