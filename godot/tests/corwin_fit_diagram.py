#!/usr/bin/env python3
"""Corwin fit diagram (docs/11 Step 7 evidence, sandbox-safe).

The sandbox GPU story is in tests/TEST_REPORT.md: no Mesa/Xvfb is
installable here, so windowed captures (tests/yard_shot.gd) run on a
display machine instead. This draws the Step 7 "assert-by-eye" fit checks
as an engineering plate from the QA-verified numbers: guard-box world AABB
and aperture (docs/10, tools/qa_yard.gd check 12), the hero mesh accessor
bounds (1.82 m T-pose figure, face toward +Z), and the placement/facing
fixed in tools/scene/build_test_yard.py.

Output: tests/qa_corwin_fit.png  (regenerate: python3 tests/corwin_fit_diagram.py)
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / "qa_corwin_fit.png"

# --- QA-verified geometry (world metres; +X east, +Y up, +Z north) ---
BOX_X0, BOX_X1 = 1.8, 3.2            # guard box AABB (qa check 12)
BOX_Z0, BOX_Z1 = 0.51, 2.2           # z0 includes the open shutter tip
BOX_Y1 = 2.4
INT_Z0, INT_Z1 = 0.96, 2.04          # clear interior (elevation)
INT_X0, INT_X1 = 1.96, 3.04          # clear interior (plan)
SLAB_Y = 0.16                        # interior floor slab top (Corwin's feet)
WIN_Y0, WIN_Y1 = 0.91, 2.01          # window aperture (local 0.75..1.85 + slab)
WIN_X0, WIN_X1 = 2.14, 2.86          # aperture width (box-local x +-0.36)
FACE_Z = 0.9                         # window/south face (local +0.6)
FIG_H = 1.81                         # hero mesh accessor height
EYE_Y = 1.86                         # Eyes centroid 1.698 + 0.16 slab
LEAN_DEG = 4.0                       # npc_corwin.gd LEAN_DEG (D8)
CX, CZ = 2.5, 1.5                    # Corwin home (spec A1 (2.5,1.5) r0)
LANE = (0.0, -4.0)                   # TR_A_LANE centre (spec (0,-4))
LANE_T = (0.0, -6.0)                 # scan target (npc_corwin.gd LANE_TARGET)
GATE_X = 4.0                         # gate mouth half-width
CAM = (0.4, 1.65, -1.6)              # yard_shot.gd r3-01 camera
SPAWN = (0.0, 5.0)

GUARD_BLUE = (41, 61, 112)
STONE = (120, 116, 108)
WOOD = (139, 105, 60)
INK = (24, 26, 30)
GREY = (90, 86, 80)
PAPER = (233, 224, 207)


def font(size):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def R(p0, p1):
    """Normalized box corners (PIL wants x0<=x1, y0<=y1)."""
    (x0, y0), (x1, y1) = p0, p1
    return [min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)]


def elevation(d, ox, oy, s):
    """Side elevation looking east (+X): horizontal = world z (south left),
    vertical = +Y up. Region: z -2.3..3.2, y -0.2..2.7."""
    def P(z, y):
        return (ox + (z + 2.3) * s, oy + (2.7 - y) * s)

    f11, f13, f15 = font(11), font(13), font(15)
    d.text((ox, oy - 34), "SIDE ELEVATION - looking east (south left, +Y up)", fill=INK, font=f15)
    d.text((ox, oy - 16), "head top 1.97 vs header 2.01 (+0.04 clear)  ·  eye line 1.86  ·  "
                          "feet on slab 0.16  ·  lean 4 deg (D8)", fill=GREY, font=f11)

    # ground line + yard dirt
    d.line([P(-2.3, 0), P(3.2, 0)], fill=INK, width=2)
    # box shell
    d.rectangle(R(P(BOX_Z0, 0), P(BOX_Z1, BOX_Y1)), fill=(222, 212, 192), outline=STONE, width=3)
    # interior void + slab
    d.rectangle(R(P(INT_Z0, SLAB_Y), P(INT_Z1, 2.28)), fill=(250, 247, 240), outline=STONE, width=2)
    d.rectangle(R(P(INT_Z0, 0.10), P(INT_Z1, SLAB_Y)), fill=(160, 155, 148))
    # south wall band with the window aperture punched through
    d.rectangle(R(P(FACE_Z, 0), P(INT_Z0, BOX_Y1 - 0.12)), fill=(222, 212, 192), outline=STONE, width=2)
    d.rectangle(R(P(FACE_Z, WIN_Y0), P(INT_Z0, WIN_Y1)), fill=PAPER, outline=INK, width=2)
    # open shutter (120 deg from closed): hinge at aperture top, tip at z 0.51
    d.line([P(FACE_Z, WIN_Y1), P(0.51, WIN_Y1 - 0.22)], fill=WOOD, width=6)
    d.text((ox + 2, oy + 40), "shutter", fill=WOOD, font=f11)

    # Corwin: feet at (CZ, 0.16) leaning LEAN_DEG toward the window (-Z)
    lean = math.radians(LEAN_DEG)

    def F(u):
        """u = metres up the body -> leaning (z, y) centreline."""
        return (CZ - math.sin(lean) * u, SLAB_Y + math.cos(lean) * u)

    hip, neck, top = F(0.85), F(1.55), F(FIG_H)
    d.line([P(*F(0.06)), P(*hip)], fill=GUARD_BLUE, width=16)      # legs
    d.line([P(*hip), P(*neck)], fill=GUARD_BLUE, width=20)          # torso
    hx, hy = P(*F(FIG_H - 0.14))
    r = 0.115 * s
    d.ellipse([hx - r, hy - r, hx + r, hy + r], fill=GUARD_BLUE)    # head
    # gaze line from the eyes out over the lane
    ez, ey = F(1.70)
    d.line([P(ez, ey), P(ez - 1.15, ey - 0.08)], fill=(180, 40, 40), width=2)
    d.text(P(ez - 1.2, ey - 0.34), "scan + lean", fill=(180, 40, 40), font=f11)

    # eye line + header guides
    for yy, label in ((WIN_Y1, "header 2.01"), (EYE_Y, "eye 1.86"), (SLAB_Y, "slab 0.16")):
        d.line([P(BOX_Z0 - 0.35, yy), P(BOX_Z1 + 0.35, yy)], fill=(170, 165, 158), width=1)
        d.text((P(BOX_Z1 + 0.38, yy)[0], P(0, yy)[1] - 6), label, fill=GREY, font=f11)

    # r3-01 camera + view cone to the aperture
    cxp, cyp = P(CAM[2], CAM[1])
    for tgt in [(FACE_Z, WIN_Y0 + 0.1), (FACE_Z, WIN_Y1 - 0.1)]:
        d.line([P(CAM[2], CAM[1]), P(*tgt)], fill=(60, 110, 200), width=1)
    d.polygon([(cxp, cyp - 6), (cxp + 9, cyp + 5), (cxp - 9, cyp + 5)], fill=(60, 110, 200))
    d.text((cxp - 58, cyp - 22), "cam r3-01", fill=(60, 110, 200), font=f11)
    d.text(P(FACE_Z - 0.05, WIN_Y0 - 0.22), "window y 0.91..2.01", fill=INK, font=f11)
    d.text(P(CZ + 0.18, 0.02), "Corwin feet 0.16", fill=INK, font=f11)


def plan(d, ox, oy, s):
    """Plan view: +X right, +Z north up. Region: x -5.5..6.5, z -8.5..5.5."""
    def P(x, z):
        return (ox + (x + 5.5) * s, oy + (5.5 - z) * s)

    f11, f15 = font(11), font(15)
    d.text((ox, oy - 34), "PLAN - north up (spec XY -> Godot XZ)", fill=INK, font=f15)
    d.text((ox, oy - 16), "VO_GRD_001 fires once on first entry into the red sphere (S5/S10)",
           fill=GREY, font=f11)

    # dock lane centre + gatehouse + threshold
    d.line([P(0, -8.5), P(0, 0)], fill=(170, 165, 158), width=2)
    d.text((P(0.15, -7.8)[0], P(0, -7.8)[1]), "dock lane (R1, x=0)", fill=GREY, font=f11)
    d.rectangle(R(P(-GATE_X, -3), P(GATE_X, 0)), fill=(222, 212, 192), outline=STONE, width=3)
    d.text(P(-1.6, -1.6), "GATEHOUSE", fill=STONE, font=f11)
    d.line([P(-5.5, 0), P(5.5, 0)], fill=INK, width=2)
    d.text(P(-5.4, 0.25), "threshold z=0", fill=INK, font=f11)

    # TR_A_LANE r3 sphere
    tx, ty = P(*LANE)
    rr = 3 * s
    d.ellipse([tx - rr, ty - rr, tx + rr, ty + rr], outline=(180, 40, 40), width=2)
    d.text((tx + rr + 4, ty - 8), "TR_A_LANE r3 (0,-4)", fill=(180, 40, 40), font=f11)

    # guard box + window slit + Corwin
    d.rectangle(R(P(BOX_X0, BOX_Z0), P(BOX_X1, BOX_Z1)), fill=(214, 200, 178), outline=WOOD, width=3)
    d.line([P(WIN_X0, BOX_Z0), P(WIN_X1, BOX_Z0)], fill=PAPER, width=5)
    d.text(P(BOX_X0 - 0.1, BOX_Z1 + 0.35), "A1 guard box", fill=WOOD, font=f11)
    cxp, cyp = P(CX, CZ)
    d.ellipse([cxp - 6, cyp - 6, cxp + 6, cyp + 6], fill=GUARD_BLUE)
    d.line([P(CX, CZ), P(CX, CZ - 1.0)], fill=INK, width=2)   # facing (ROT180 -> -Z)
    d.text(P(CX + 0.25, CZ + 0.3), "Corwin (faces gate/lane)", fill=INK, font=f11)
    # scan cone +/-30 deg about the lane bearing
    bearing = math.atan2(LANE_T[0] - CX, LANE_T[1] - CZ)  # 0 = -Z
    for off in (-30, 30):
        a = bearing + math.radians(off)
        d.line([P(CX, CZ), P(CX + 3.1 * math.sin(a), CZ - 3.1 * math.cos(a))],
               fill=(80, 130, 210), width=1)
    d.text(P(CX - 1.6, CZ - 2.6), "scan +/-30 deg", fill=(80, 130, 210), font=f11)

    # player spawn + r3-01 camera
    sx, sy = P(*SPAWN)
    d.ellipse([sx - 5, sy - 5, sx + 5, sy + 5], outline=INK, width=2)
    d.text(P(SPAWN[0] + 0.25, SPAWN[1]), "Player spawn (0,5)", fill=INK, font=f11)
    camx, camy = P(CAM[0], CAM[2])
    d.polygon([(camx, camy - 6), (camx + 7, camy + 5), (camx - 7, camy + 5)], fill=(60, 110, 200))
    d.line([P(CAM[0], CAM[2]), P(CX - 0.2, CZ - 0.35)], fill=(60, 110, 200), width=1)
    d.text((camx - 58, camy + 8), "cam r3-01", fill=(60, 110, 200), font=f11)


def main() -> None:
    img = Image.new("RGB", (1500, 820), PAPER)
    d = ImageDraw.Draw(img)
    f22, f11 = font(22), font(11)
    d.text((24, 14), "DELVE - Corwin guard fit plate - GDD-03 sec. 4.A A1 (docs/11 Step 7)",
           fill=INK, font=f22)
    d.text((24, 44), "Generated from QA-verified AABBs + hero mesh accessor bounds; stands in for "
                     "windowed captures in the display-less sandbox (see tests/TEST_REPORT.md).",
           fill=GREY, font=f11)
    elevation(d, 30, 130, 118)
    plan(d, 790, 130, 52)
    d.text((24, 792), "Blue: M_NPC_GUARD stand-in (CC0 body, D6) tinted T_YRD_CLOTH_TABARD guard-blue (D7). "
                      "Metres, world frame. Regenerate: python3 tests/corwin_fit_diagram.py", fill=GREY, font=f11)
    img.save(OUT)
    print("FIT_DIAGRAM_DONE ->", OUT)


if __name__ == "__main__":
    main()
