class_name MenuBackground
extends Control
## The menu's backdrop layer — **plain white for this build**, by request.
##
## GDD-07 §5.3 specifies a painted three-layer parallax of the yard at 06:10
## (sky/vista card, far walls, near furniture + mist band) with eight drifting
## motes and a 90 s ±60 px drift loop. None of that is drawn yet: the menu is
## deliberately flat white while the layout and interaction are being built.
##
## The swap is a one-file change, which is why this is its own class:
##
##     _build():  add_child(MenuBackground.new())          # today
##     _build():  add_child(MenuBackdropPixel.new())       # §5.3, when art lands
##
## Whatever replaces it must keep the same contract: a full-rect Control that
## sits behind the menu text and never eats mouse input meant for the items.

const BACKDROP_COLOUR := Color("#FFFFFF")

## Text colours for the *current* backdrop. §5.4 specifies parchment (#E9DFC8)
## item faces and a parchment-tinted footer, which read beautifully over the
## painted dawn parallax and invisibly over plain white. While the white
## placeholder is up, the menu draws ink instead; when the §5.3 backdrop lands,
## flip these three constants back and nothing else changes.
const ITEM_TEXT_COLOUR := Color("#101418")    # spec: #E9DFC8
const FOOTER_TEXT_COLOUR := Color("#101418")  # spec: #E9DFC8 at 60 % alpha
const UNDERLINE_COLOUR := Color("#B0793A")    # bronze, unchanged either way

## Reserved for the §5.3 parallax layers; kept here so the replacement has a
## place to put them without touching the menu screen.
const LAYER_SPEEDS_PX_PER_S := [0.4, 0.8, 1.6]


func _init() -> void:
	name = "MenuBackground"
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)

	var fill := ColorRect.new()
	fill.name = "FlatFill"
	fill.color = BACKDROP_COLOUR
	fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fill.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(fill)
