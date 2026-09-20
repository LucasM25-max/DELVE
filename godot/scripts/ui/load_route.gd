extends Control
## Ink route painter for the loading road (web-standard presentation).
var pts := PackedVector2Array()
var progress := 0.0
var ink := Color("74e0b4")

func _ready() -> void:
	mouse_filter = MOUSE_FILTER_IGNORE
	if pts.is_empty():
		for i in 64:
			var t := float(i) / 63.0
			pts.append(Vector2(240.0 + t * 1080.0 + sin(t * 9.0) * 46.0, 700.0 - t * 520.0 + cos(t * 7.0 + 1.3) * 30.0))

func _draw() -> void:
	var faint := Color(ink, 0.16)
	draw_polyline(pts, faint, 2.5, true)
	var n := clampi(int(progress * float(pts.size() - 1)) + 1, 2, pts.size())
	var sub := PackedVector2Array()
	for i in n:
		sub.append(pts[i])
	draw_polyline(sub, Color(ink, 0.9), 3.0, true)
	var nib: Vector2 = pts[n - 1]
	draw_circle(nib, 7.0, Color(ink, 0.28))
	draw_circle(nib, 4.0, Color(ink, 0.9))
	for g in [10, 25, 40, 55]:
		var p: Vector2 = pts[g]
		var c := Color(ink, 0.9) if progress >= float(g) / float(pts.size() - 1) else Color(0.93, 0.87, 0.72, 0.35)
		draw_arc(p, 8.0, 0, TAU, 24, c, 1.6, true)
		draw_line(p + Vector2(-12, 0), p + Vector2(-9, 0), c, 1.4)
		draw_line(p + Vector2(9, 0), p + Vector2(12, 0), c, 1.4)
