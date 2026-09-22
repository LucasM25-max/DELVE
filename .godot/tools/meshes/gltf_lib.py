"""DELVE GDD-03 — minimal glTF-Binary (GLB) writer + mesh builders.

No Blender in this sandbox, so the production plan's (doc 04) scripted,
deterministic, version-controlled asset pipeline is executed directly:
one module per asset, exact spec dimensions in metres, ground pivot,
glTF-Binary output with no embedded textures (materials are assigned in
Godot, matching the "no embedded textures" export convention).

Coordinate convention (glTF, +Y up, metres):
    x = spec X (east), y = spec Y-up, z authored as -spec Y (south
    positive) for the gatehouse, whose instance is then rotated 180 deg
    about Y so the inner face lands at the world gate threshold.

IMPORTANT (verified empirically): Godot 4.x's glTF importer does NOT
flip axes — glTF (x, y, z) import to Godot (x, y, z) identity. World
placement/orientation is done with the instance's node transform
(GDD-03 frame: Godot +X east, +Y up, +Z north = spec Y).
"""
import json
import math
import struct
from array import array
from dataclasses import dataclass, field


@dataclass
class Primitive:
    positions: list = field(default_factory=list)  # (x, y, z)
    normals: list = field(default_factory=list)
    uvs: list = field(default_factory=list)
    indices: list = field(default_factory=list)

    def push(self, quad: list, normal: tuple, uv_quad: list) -> None:
        """Add a quad (4 corner positions) with a flat normal and UV rect.

        Winding is fixed automatically so the face is counter-clockwise
        when viewed from the normal side (glTF front face).
        """
        base = len(self.positions)
        for p in quad:
            self.positions.append(tuple(p))
            self.normals.append(normal)
        for u in uv_quad:
            self.uvs.append(tuple(u))
        a, b, c, d = base, base + 1, base + 2, base + 3
        i0, i1, i2 = quad[0], quad[1], quad[2]
        ux, uy = i1[0] - i0[0], i1[1] - i0[1]
        uz, uz2 = i1[2] - i0[2], i2[2] - i0[2]
        vx, vy, vz = i2[0] - i0[0], i2[1] - i0[1], i2[2] - i0[2]
        cx = uy * vz - uz * vy
        cy = uz * vx - ux * vz
        cz = ux * vy - uy * vx
        # quad order (a, b, c, d) is CCW for `normal` iff cross . normal > 0
        if cx * normal[0] + cy * normal[1] + cz * normal[2] > 0:
            self.indices.extend((a, b, c, a, c, d))
        else:
            self.indices.extend((a, c, b, a, d, c))

    def tri(self, a: tuple, b: tuple, c: tuple, normal: tuple,
            uva: tuple, uvb: tuple, uvc: tuple) -> None:
        """Single triangle with auto-corrected CCW winding."""
        base = len(self.positions)
        for q, uv in ((a, uva), (b, uvb), (c, uvc)):
            self.positions.append(q)
            self.normals.append(normal)
            self.uvs.append(uv)
        ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
        vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
        cx = uy * vz - uz * vy
        cy = uz * vx - ux * vz
        cz = ux * vy - uy * vx
        # (a, b, c) is CCW viewed from the normal side iff cross . normal > 0
        if cx * normal[0] + cy * normal[1] + cz * normal[2] > 0:
            self.indices.extend((base, base + 1, base + 2))
        else:
            self.indices.extend((base, base + 2, base + 1))


class Mesh:
    def __init__(self) -> None:
        self.prims: list[Primitive] = []

    @property
    def prim(self) -> Primitive:
        if not self.prims:
            self.prims.append(Primitive())
        return self.prims[-1]

    def add_prim(self) -> Primitive:
        p = Primitive()
        self.prims.append(p)
        return p

    def face(self, quad: list, normal: tuple, u, v) -> None:
        self.prim.push(quad, normal, [(0, 0), (u, 0), (u, v), (0, v)])

    def push(self, quad: list, normal: tuple, uv_quad: list) -> None:
        self.prim.push(quad, normal, uv_quad)

    def tri(self, a: tuple, b: tuple, c: tuple, normal: tuple,
            uva: tuple, uvb: tuple, uvc: tuple) -> None:
        self.prim.tri(a, b, c, normal, uva, uvb, uvc)

    def box(self, x0, x1, y0, y1, z0, z1, uv_tile,
            faces=("n", "s", "e", "w", "u", "d")) -> None:
        """Axis-aligned box with per-face UVs scaled to metres/tile."""
        p = self.prim
        tx, ty = uv_tile
        c = (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), \
            (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)
        faces_def = {
            "n": ((c[0], c[3], c[2], c[1]), (0, 0, -1), ((x1 - x0) / tx, (y1 - y0) / ty)),
            "s": ((c[4], c[5], c[6], c[7]), (0, 0, 1), ((x1 - x0) / tx, (y1 - y0) / ty)),
            "e": ((c[1], c[5], c[6], c[2]), (1, 0, 0), ((z1 - z0) / tx, (y1 - y0) / ty)),
            "w": ((c[4], c[0], c[3], c[7]), (-1, 0, 0), ((z1 - z0) / tx, (y1 - y0) / ty)),
            "u": ((c[3], c[2], c[6], c[7]), (0, 1, 0), ((x1 - x0) / tx, (z1 - z0) / ty)),
            "d": ((c[0], c[1], c[5], c[4]), (0, -1, 0), ((x1 - x0) / tx, (z1 - z0) / ty)),
        }
        for name in faces:
            quad, normal, (u, v) = faces_def[name]
            p.push(quad, normal, [(0, 0), (u, 0), (u, v), (0, v)])

    def prism_down(self, x, half_w, y_top, y_tip, z0, z1, uv_tile) -> None:
        """Downward spike: triangle (x-hw, y_top)-(x+hw, y_top)-(x, y_tip),
        extruded along z. y_top should be embedded in the bar above so the
        (omitted) top strip never z-fights. Used for portcullis pick tips."""
        p = self.prim
        tx, ty = uv_tile
        a = (x - half_w, y_top, z0)
        b = (x + half_w, y_top, z0)
        t = (x, y_tip, z0)
        a1 = (x - half_w, y_top, z1)
        b1 = (x + half_w, y_top, z1)
        t1 = (x, y_tip, z1)
        h = y_top - y_tip
        sl = (h * h + half_w * half_w) ** 0.5
        # triangular ends
        p.tri(a, b, t, (0, 0, -1), (a[0] / tx, a[1] / ty),
              (b[0] / tx, b[1] / ty), (t[0] / tx, t[1] / ty))
        p.tri(a1, t1, b1, (0, 0, 1), (a1[0] / tx, a1[1] / ty),
              (t1[0] / tx, t1[1] / ty), (b1[0] / tx, b1[1] / ty))
        # slanted side faces
        p.push((a, t, t1, a1), (-h / sl, -half_w / sl, 0.0),
               ((0, 0), (0, (z1 - z0) / tx), ((z1 - z0) / tx, (z1 - z0) / tx),
                ((z1 - z0) / tx, 0)))
        p.push((b1, t1, t, b), (h / sl, -half_w / sl, 0.0),
               ((0, 0), ((z1 - z0) / tx, (z1 - z0) / tx),
                ((z1 - z0) / tx, 0), (0, (z1 - z0) / tx)))

    def band(self, row_a: list, row_b: list, normal: tuple,
             uv_of=None) -> None:
        """Band between two equal-length, same-direction rows of points.

        Quads (a_i, a_{i+1}, b_{i+1}, b_i) with a single flat normal
        (winding auto-corrected by push()). `uv_of(point)` maps a point to
        UV; defaults to (x, y).
        """
        if uv_of is None:
            uv_of = lambda q: (q[0], q[1])
        p = self.prim
        n = min(len(row_a), len(row_b))
        for i in range(n - 1):
            a, b = row_a[i], row_a[i + 1]
            c, d = row_b[i + 1], row_b[i]
            p.push((a, b, c, d), normal,
                   (uv_of(a), uv_of(b), uv_of(c), uv_of(d)))

    def cyl(self, cx: float, cz: float, y0: float, y1: float, r: float,
            seg: int = 12, cap_top: bool = False, cap_bot: bool = False,
            uv_tile=(1.0, 1.0)) -> None:
        """N-gon column around (cx, cz), flat per-segment normals.

        u wraps once around the circumference per tile, v = height/tile.
        """
        tx, ty = uv_tile
        p = self.prim
        circ = 2.0 * math.pi * r
        for i in range(seg):
            a1 = 2.0 * math.pi * i / seg
            a2 = 2.0 * math.pi * (i + 1) / seg
            am = math.pi * (2.0 * i + 1) / seg
            nrm = (math.cos(am), 0.0, math.sin(am))
            b = (cx + r * math.cos(a1), y0, cz + r * math.sin(a1))
            c = (cx + r * math.cos(a2), y0, cz + r * math.sin(a2))
            d = (cx + r * math.cos(a2), y1, cz + r * math.sin(a2))
            e = (cx + r * math.cos(a1), y1, cz + r * math.sin(a1))
            u1, u2 = circ * i / seg / tx, circ * (i + 1) / seg / tx
            p.push((b, c, d, e), nrm,
                   [(u1, y0 / ty), (u2, y0 / ty), (u2, y1 / ty), (u1, y1 / ty)])
        if cap_top:
            self._cap(cx, cz, y1, r, seg, (0, 1, 0), uv_tile)
        if cap_bot:
            self._cap(cx, cz, y0, r, seg, (0, -1, 0), uv_tile)

    def _cap(self, cx: float, cz: float, y: float, r: float, seg: int,
             nrm: tuple, uv_tile) -> None:
        tx, ty = uv_tile
        p = self.prim
        c = (cx, y, cz)
        for i in range(seg):
            a1 = 2.0 * math.pi * i / seg
            a2 = 2.0 * math.pi * (i + 1) / seg
            b = (cx + r * math.cos(a1), y, cz + r * math.sin(a1))
            d = (cx + r * math.cos(a2), y, cz + r * math.sin(a2))
            p.tri(c, b, d, nrm,
                  (0.5 / tx, 0.5 / ty),
                  (0.5 + 0.5 * math.cos(a1) / tx, 0.5 + 0.5 * math.sin(a1) / ty),
                  (0.5 + 0.5 * math.cos(a2) / tx, 0.5 + 0.5 * math.sin(a2) / ty))

    def profile(self, cx: float, cz: float, rows: list, seg: int = 16,
                uv_tile=(1.0, 1.0)) -> None:
        """Lathe-like body: rows = [(y, r), ...] bottom to top, banded.

        u = arc length (m/tile) around the profile, v = y/tile.
        """
        tx, ty = uv_tile
        p = self.prim
        for (y0, r0), (y1, r1) in zip(rows, rows[1:]):
            for i in range(seg):
                a1 = 2.0 * math.pi * i / seg
                a2 = 2.0 * math.pi * (i + 1) / seg
                am = math.pi * (2.0 * i + 1) / seg
                nrm = (math.cos(am), 0.0, math.sin(am))
                b = (cx + r0 * math.cos(a1), y0, cz + r0 * math.sin(a1))
                e = (cx + r0 * math.cos(a2), y0, cz + r0 * math.sin(a2))
                c = (cx + r1 * math.cos(a2), y1, cz + r1 * math.sin(a2))
                d = (cx + r1 * math.cos(a1), y1, cz + r1 * math.sin(a1))
                u1 = 2.0 * math.pi * i / seg * r0 / tx
                u2 = 2.0 * math.pi * (i + 1) / seg * r1 / tx
                p.push((b, e, c, d), nrm,
                       [(u1, y0 / ty), (u2, y0 / ty), (u2, y1 / ty),
                        (u1, y1 / ty)])


# ---------------------------------------------------------------- glTF IO
def _f32(vals) -> bytes:
    return array("f", (float(v) for v in vals)).tobytes()


def _u16(vals) -> bytes:
    return array("H", vals).tobytes()


def _u32(vals) -> bytes:
    return array("I", vals).tobytes()


def write_glb(path: str, mesh: Mesh, name: str) -> dict:
    """Write a glTF 2.0 binary file; returns a QA manifest entry."""
    buf = bytearray()
    views = []
    accessors = []
    nodes = []
    meshes = []
    byte_offset = 0

    def add_view(data: bytes, target: int) -> int:
        nonlocal buf, byte_offset
        pad = (4 - byte_offset % 4) % 4
        if pad:
            buf += b"\0" * pad
            byte_offset += pad
        views.append({"buffer": 0, "byteOffset": byte_offset,
                      "byteLength": len(data), "target": target})
        buf += data
        byte_offset += len(data)
        return len(views) - 1

    def add_accessor(view: int, count: int, type_name: str,
                     component: int, has_min_max: bool) -> int:
        accessors.append({
            "bufferView": view, "componentType": component, "count": count,
            "type": type_name,
            **({"min": [0, 0, 0], "max": [0, 0, 0]} if has_min_max else {}),
        })
        return len(accessors) - 1

    manifest = {"file": path, "mesh": name, "primitives": []}
    multi = len(mesh.prims) > 1
    for pi, prim in enumerate(mesh.prims):
        pos_b = add_view(_f32(sum(prim.positions, ())), 34962)
        nrm_b = add_view(_f32(sum(prim.normals, ())), 34962)
        uv_b = add_view(_f32(sum(prim.uvs, ())), 34962)
        idx_b = add_view(_u16(prim.indices) if max(prim.indices) < 65536
                         else _u32(prim.indices), 34963)
        idx_type = 5123 if max(prim.indices) < 65536 else 5125
        a_pos = add_accessor(pos_b, len(prim.positions), "VEC3", 5126, True)
        a_nrm = add_accessor(nrm_b, len(prim.normals), "VEC3", 5126, False)
        a_uv = add_accessor(uv_b, len(prim.uvs), "VEC2", 5126, False)
        a_idx = add_accessor(idx_b, len(prim.indices), "SCALAR", idx_type, False)
        positions = [list(p) for p in prim.positions]
        acc = accessors[a_pos]
        acc["min"] = [min(c[i] for c in positions) for i in range(3)]
        acc["max"] = [max(c[i] for c in positions) for i in range(3)]
        meshes.append({"primitives": [{
            "attributes": {"POSITION": a_pos, "NORMAL": a_nrm,
                            "TEXCOORD_0": a_uv},
            "indices": a_idx, "mode": 4}]})
        node_name = f"{name}_p{pi}" if multi else name
        nodes.append({"mesh": len(meshes) - 1, "name": node_name})
        manifest["primitives"].append({
            "vertices": len(prim.positions), "triangles": len(prim.indices) // 3,
            "bounds": [[round(v, 3) for v in accessors[a_pos]["min"]],
                       [round(v, 3) for v in accessors[a_pos]["max"]]]})

    json_buf = json.dumps({
        "asset": {"version": "2.0", "generator": "delve-meshes"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes))), "name": name}],
        "nodes": nodes, "meshes": meshes,
        "accessors": accessors, "bufferViews": views,
        "buffers": [{"byteLength": 0}],
    }, separators=(",", ":")).encode()
    # fix buffers byteLength after bin chunk (bin padded to 4)
    bin_pad = (4 - byte_offset % 4) % 4
    total_bin = byte_offset + bin_pad
    obj = json.loads(json_buf)
    obj["buffers"][0]["byteLength"] = total_bin
    json_buf = json.dumps(obj, separators=(",", ":")).encode()
    json_pad = (4 - len(json_buf) % 4) % 4
    json_buf += b" " * json_pad

    total = 12 + 8 + len(json_buf) + 8 + total_bin
    out = struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(json_buf), 0x4E4F534A) + json_buf
    out += struct.pack("<II", total_bin, 0x004E4942) + bytes(buf) + b"\0" * bin_pad
    with open(path, "wb") as fh:
        fh.write(out)
    return manifest


# ------------------------------------------------------------- wall assets
STONE_TILE = (4.0, 2.0)  # GDD-03 §6: T_YRD_STONE_WALL tiles 4 x 2 m
METAL_TILE = (1.0, 1.0)
WOOD_TILE = (1.0, 1.0)
WALL_THICK = 0.8
WALL_H = 4.2
WALL_SOLID = 3.0  # solid below the crenel walk; merlons rise to 4.2


def _wall_box(m: Mesh, x0, x1, y0, y1, omit: tuple = ()) -> None:
    faces = tuple(f for f in ("n", "s", "e", "w", "u") if f not in omit)
    m.box(x0, x1, y0, y1, -WALL_THICK / 2, WALL_THICK / 2,
          STONE_TILE, faces=faces)


def wall_full() -> Mesh:
    """M_YRD_WALL_STONE: 4 m span x 0.8 m x 4.2 m, crenel cap.

    Crenel pattern is 180-degree symmetric (merlon at each end, 1 m wide,
    1.2 m tall above the 3 m walk) so butt joints align and trimmed
    modules keep a clean cut face.
    """
    m = Mesh()
    _wall_box(m, -2, 2, 0, WALL_SOLID)
    _wall_box(m, -2, -1, WALL_SOLID, WALL_H)
    _wall_box(m, 1, 2, WALL_SOLID, WALL_H)
    return m


def wall_full_start() -> Mesh:
    """Full module with both span-end faces omitted.

    Used where a module butts into a corner column: the column's inner
    face is coplanar with the module's end face, so the module's end
    faces are dropped (the column fully occludes the joint). Usable at
    any corner with the wall's normal rotation.
    """
    m = Mesh()
    _wall_box(m, -2, 2, 0, WALL_SOLID, omit=("w", "e"))
    _wall_box(m, -2, -1, WALL_SOLID, WALL_H, omit=("w",))
    _wall_box(m, 1, 2, WALL_SOLID, WALL_H, omit=("e",))
    return m


def wall_half() -> Mesh:
    """2 m trim module (half of the full module): gap + merlon at +x end."""
    m = Mesh()
    _wall_box(m, -1, 1, 0, WALL_SOLID)
    _wall_box(m, 0, 1, WALL_SOLID, WALL_H)
    return m


def wall_end() -> Mesh:
    """0.8 m end module (corner wrap): full-width merlon."""
    m = Mesh()
    _wall_box(m, -0.4, 0.4, 0, WALL_SOLID)
    _wall_box(m, -0.4, 0.4, WALL_SOLID, WALL_H)
    return m


# ------------------------------------------------------------- gatehouse
def _vault_y(x: float) -> float:
    """Segmental vault: springs at (x=+-2, y=4.0), apex (0, 5.0)."""
    return 2.5 + (6.25 - x * x) ** 0.5


def gatehouse() -> Mesh:
    """M_YRD_GATEHOUSE: 8 x 3 x 5 m arch block.

    Local frame: x = spec X (-4..4), y = up (0..5), z = -spec Y: the inner
    face (gate threshold, spec y=0) is at local z=0 and the outer face
    (spec y=-3) at local z=3. Passage: 4 m wide x 4 m tall with a segmental
    vault filling 4..5 m. Bottom faces omitted (ground contact).
    """
    m = Mesh()
    SEG = 12
    xs = [-2 + 4 * i / SEG for i in range(SEG + 1)]
    arc = [(x, _vault_y(x)) for x in xs]

    # top of the piers (split at |x|=2 so it is not coplanar with the cap
    # top edge at y=5)
    m.face([(-4, 5, 0), (-2, 5, 0), (-2, 5, 3), (-4, 5, 3)],
           (0, 1, 0), 2 / 4, 3 / 2)
    m.face([(2, 5, 0), (4, 5, 0), (4, 5, 3), (2, 5, 3)],
           (0, 1, 0), 2 / 4, 3 / 2)
    # U-shaped end faces (inner at z=0 facing -z, outer at z=3 facing +z)
    for z, nz in ((0.0, -1), (3.0, 1)):
        nrm = (0, 0, nz)
        m.face([(-4, 0, z), (-2, 0, z), (-2, 5, z), (-4, 5, z)],
               nrm, 2 / 4, 5 / 2)          # left pier face
        m.face([(2, 0, z), (4, 0, z), (4, 5, z), (2, 5, z)],
               nrm, 2 / 4, 5 / 2)          # right pier face
        # vault cap: band between the arc and the flat top edge at y=5
        # (same x resolution as the soffit; exact tessellation of the
        # curved-boundary region, no coplanar overlap with the pier tops)
        m.band([(x, _vault_y(x), z) for x, _ in arc],
               [(x, 5.0, z) for x, _ in arc], nrm)
    # piers: outer + passage faces (bottom omitted; inner/outer U faces and
    # the top plane are separate surfaces above)
    m.face([(-4, 0, 0), (-4, 0, 3), (-4, 5, 3), (-4, 5, 0)],
           (-1, 0, 0), 3 / 4, 5 / 2)       # left pier outer face
    m.face([(-2, 0, 0), (-2, 0, 3), (-2, 4, 3), (-2, 4, 0)],
           (1, 0, 0), 3 / 4, 4 / 2)        # left passage wall
    m.face([(4, 0, 0), (4, 0, 3), (4, 5, 3), (4, 5, 0)],
           (1, 0, 0), 3 / 4, 5 / 2)        # right pier outer face
    m.face([(2, 0, 0), (2, 0, 3), (2, 4, 3), (2, 4, 0)],
           (-1, 0, 0), 3 / 4, 4 / 2)       # right passage wall
    # vault soffit (faces into the passage): band between the arc at z=3 and
    # the arc at z=0, same direction; normal = radial from the vault centre
    # (0, 2.5), pointing down into the passage.
    row_a = [(x, _vault_y(x), 3) for x, _ in arc]
    row_b = [(x, _vault_y(x), 0) for x, _ in arc]
    r = 2.5
    for i in range(len(row_a) - 1):
        xm = (row_a[i][0] + row_a[i + 1][0]) / 2
        ym = _vault_y(xm)
        nrm = (-xm / r, -(ym - 2.5) / r, 0.0)
        m.band([row_a[i], row_a[i + 1]], [row_b[i], row_b[i + 1]], nrm,
               uv_of=lambda q: (q[0] / 4, q[2] / 2))
    return m


def _inside_cap(x: float, y: float) -> bool:
    """Point-in-polygon for the vault cap (arc bottom, flat top at y=5)."""
    pts = [(xx, _vault_y(xx)) for xx in
           (-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2)] + [(2, 5), (-2, 5)]
    inside = False
    n = len(pts)
    j = n - 1
    for i in range(n):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y):
            t = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < t:
                inside = not inside
        j = i
    return inside


# ------------------------------------------------------------- portcullis
def portcullis() -> Mesh:
    """M_YRD_PORTCULLIS: 3.56 m wide x 0.2 m deep x 4 m tall, iron.

    Spec size is 4 m, but the passage is only 4 m wide and both 2 m gate
    doors are pinned open against the pier faces (1 cm stand-off),
    leaving a clear portcullis envelope of 3.56 m (x -1.78..1.78); a full
    4 m grid would interpenetrate the pinned leaves. 11 bars on 0.32 m
    centres (x -1.60..1.60), four rails, pointed pick tips. Local origin
    at the bottom-centre; raised state is a +1 m scene lift (y 1..5).
    """
    m = Mesh()
    bars = [-1.60 + 0.32 * k for k in range(11)]
    for x in bars:
        m.box(x - 0.06, x + 0.06, 0, 4, -0.1, 0.1, METAL_TILE,
              faces=("n", "s", "e", "w"))
    for y0, y1 in ((3.85, 4.0), (1.30, 1.42), (2.68, 2.80), (0.05, 0.20)):
        m.box(-1.78, 1.78, y0, y1, -0.1, 0.1, METAL_TILE,
              faces=("n", "s", "e", "w"))
    for x in bars:
        m.prism_down(x, 0.06, 0.10, 0.0, -0.1, 0.1, METAL_TILE)
    return m


# ------------------------------------------------------------- gate doors
def gate_door_leaf(flip: bool = False) -> Mesh:
    """M_YRD_GATE_DOOR: one oak leaf, 2 x 0.15 x 3.4 m.

    Local (glTF, imported to Godot with identity axes): hinge edge at
    x=0, leaf spans x 0..2 (or -2..0 when flip=True), y 0..3.4,
    z 0..0.15 wood + 0.15..0.19 iron bands — the decorated face is the
    z=+0.19 side. Scene placement pins the leaf open 90 deg into the
    gatehouse passage (EAST/WEST bases at x=+-1.99, 1 cm stand-off from
    the pier faces, bands toward the passage centre). Two primitives:
    wood, then iron bands.
    """
    m = Mesh()

    def xr(a: float, b: float) -> tuple:
        a, b = (-b, -a) if flip else (a, b)
        return (a, b) if a < b else (b, a)

    # frame
    m.box(*xr(0, 2), 0, 0.2, 0, 0.15, WOOD_TILE, faces=("n", "s", "e", "w"))
    m.box(*xr(0, 2), 3.2, 3.4, 0, 0.15, WOOD_TILE,
          faces=("n", "s", "e", "w", "u"))
    m.box(*xr(0, 0.15), 0, 3.4, 0, 0.15, WOOD_TILE,
          faces=("n", "s", "w" if flip else "e"))
    m.box(*xr(1.85, 2), 0, 3.4, 0, 0.15, WOOD_TILE,
          faces=("n", "s", "e", "w"))
    # recessed planks (visible yard face is the z=0.13 "s" side; the "d"
    # side is coplanar with the frame, so it is omitted)
    for x0, x1 in ((0.15, 0.7167), (0.7167, 1.2833), (1.2833, 1.85)):
        m.box(*xr(x0, x1), 0.2, 3.2, 0.05, 0.13, WOOD_TILE,
              faces=("s", "e", "w", "u"))
    # iron bands (protrude 4 cm proud of the yard face; the "n" side at
    # z=0.15 is coplanar with the door front, so it is omitted)
    m.add_prim()
    for y0, y1 in ((0.70, 0.85), (1.60, 1.75), (2.50, 2.65)):
        m.box(*xr(-0.02, 2.02), y0, y1, 0.15, 0.19, METAL_TILE,
              faces=("s", "e", "w", "u", "d"))
    return m


# ------------------------------------------------------------- yard props
# GDD-03 §4.A props A1-A4. Local frame: +Y up, ground pivot, front face on
# local +Z (the guard box shutter and notice board parchment); placed in
# the scene rotated 180 deg about Y so their fronts face the gate.
PROPS_TILE = (1.0, 1.0)  # 1 m texture tiles (all prop textures are 1 K sets)


def barrel() -> Mesh:
    """M_YRD_BARREL: 0.6 dia x 0.9 m oak stave barrel with iron hoops.

    Stave body bulges r 0.27 (chimes) -> 0.30 (mid), 16-sided; three iron
    hoops 1.2 cm proud of the staves. Two primitives: oak (body + top),
    iron (hoops).
    """
    m = Mesh()
    rows = [(0.0, 0.27), (0.08, 0.27), (0.45, 0.30), (0.82, 0.27),
            (0.90, 0.27)]
    m.profile(0.0, 0.0, rows, seg=16, uv_tile=PROPS_TILE)
    m._cap(0.0, 0.0, 0.90, 0.27, 16, (0, 1, 0), PROPS_TILE)
    m.add_prim()
    for y0, y1, r in ((0.14, 0.20, 0.284), (0.43, 0.49, 0.312),
                      (0.72, 0.78, 0.284)):
        m.cyl(0.0, 0.0, y0, y1, r, seg=16, uv_tile=PROPS_TILE)
    return m


def guard_box() -> Mesh:
    """M_YRD_GUARD_BOX: 1.2 x 1.2 x 2.4 m sentry box, front on local +Z.

    Corner posts + paneled walls to y 2.28, pyramidal cap to 2.4, front
    window x -0.36..0.36 / y 0.75..1.85 with the shutter open (rotated
    120 deg, board 0.74 x 0.45), entry step at the front. Two
    primitives: pine (timberwork), dark (interior seen through the
    window — no NPC yet).
    """
    m = Mesh()
    T = PROPS_TILE
    # corner posts (outer faces at +-0.6)
    for px in (-0.54, 0.54):
        for pz in (-0.54, 0.54):
            m.box(px, px + 0.12, 0, 2.28, pz, pz + 0.12, T,
                  faces=("n", "s", "e", "w", "u"))
    # floor slab
    m.box(-0.6, 0.6, 0.10, 0.16, -0.6, 0.6, T, faces=("n", "s", "e", "w", "u"))
    # walls between the posts (bottoms sit on the floor top)
    WD = ("n", "s", "e", "w", "u")  # no bottoms (coplanar with floor top)
    m.box(-0.54, 0.54, 0.16, 2.28, -0.6, -0.54, T, faces=WD)       # back
    m.box(-0.6, -0.54, 0.16, 2.28, -0.54, 0.54, T, faces=WD)       # left
    m.box(0.54, 0.6, 0.16, 2.28, -0.54, 0.54, T, faces=WD)         # right
    # front wall with the window opening (x -0.36..0.36, y 0.75..1.85)
    m.box(-0.54, -0.36, 0.16, 2.28, 0.54, 0.6, T, faces=WD)        # left of window
    m.box(0.36, 0.54, 0.16, 2.28, 0.54, 0.6, T, faces=WD)          # right of window
    m.box(-0.36, 0.36, 0.16, 0.75, 0.54, 0.6, T, faces=WD)         # sill
    m.box(-0.36, 0.36, 1.85, 2.28, 0.54, 0.6, T)                   # header
    # pyramidal cap: base +-0.70 at y 2.29, apex (0, 2.40, 0)
    bx, by = 0.70, 2.29
    apex = (0.0, 2.40, 0.0)
    m.tri((-bx, by, bx), (bx, by, bx), apex, (0, 1, 0),
          (-bx / T[0], 0 / T[1]), (bx / T[0], 0 / T[1]), (0 / T[0], 1 / T[1]))
    m.tri((bx, by, bx), (bx, by, -bx), apex, (0, 1, 0),
          (bx / T[0], 0 / T[1]), (bx / T[0], 0 / T[1]), (0 / T[0], 1 / T[1]))
    m.tri((bx, by, -bx), (-bx, by, -bx), apex, (0, 1, 0),
          (bx / T[0], 0 / T[1]), (-bx / T[0], 0 / T[1]), (0 / T[0], 1 / T[1]))
    m.tri((-bx, by, -bx), (-bx, by, bx), apex, (0, 1, 0),
          (-bx / T[0], 0 / T[1]), (-bx / T[0], 0 / T[1]), (0 / T[0], 1 / T[1]))
    # cap underside (visible as the overhang soffit)
    m.face([(-bx, by, bx), (bx, by, bx), (bx, by, -bx), (-bx, by, -bx)],
           (0, -1, 0), 2 * bx / T[0], 2 * bx / T[1])
    # open shutter: hinged at the window top edge (y 1.85, z 0.60), rotated
    # 120 deg out of the wall. Board 0.74 wide, 0.45 long, 0.04 thick.
    hx, hy, hz = 0.0, 1.85, 0.60
    dx, dy, dz = 0.0, 0.5, 0.866          # board axis (hinge -> tip)
    nx, ny, nz = 0.0, -0.866, 0.5         # board outer normal
    L, t = 0.45, 0.02
    p0 = (hx + t * nx, hy + t * ny, hz + t * nz)       # outer face, hinge
    p1 = (hx + L * dx + t * nx, hy + L * dy + t * ny,
          hz + L * dz + t * nz)                        # outer face, tip
    q0 = (hx - t * nx, hy - t * ny, hz - t * nz)       # inner face, hinge
    q1 = (hx - L * dx - t * nx, hy - L * dy - t * ny,
          hz - L * dz - t * nz)                        # inner face, tip
    for sx, sn in ((-0.37, -1.0), (0.37, 1.0)):        # board side faces
        a = (sx, p0[1], p0[2]); b = (sx, p1[1], p1[2])
        c = (sx, q1[1], q1[2]); d = (sx, q0[1], q0[2])
        m.push((a, b, c, d), (sn, 0, 0),
               [(0, 0), (0, L / T[1]), (L / T[0], L / T[1]), (L / T[0], 0)])
    m.face([(-0.37, p0[1], p0[2]), (0.37, p0[1], p0[2]),
            (0.37, p1[1], p1[2]), (-0.37, p1[1], p1[2])],
           (nx, ny, nz), 0.74 / T[0], L / T[1])        # outer face
    m.face([(-0.37, q0[1], q0[2]), (-0.37, q1[1], q1[2]),
            (0.37, q1[1], q1[2]), (0.37, q0[1], q0[2])],
           (-nx, -ny, -nz), 0.74 / T[0], L / T[1])     # inner face
    m.face([(-0.37, p1[1], p1[2]), (0.37, p1[1], p1[2]),
            (0.37, q1[1], q1[2]), (-0.37, q1[1], q1[2])],
           (dx, dy, dz), 0.74 / T[0], 2 * t / T[1])    # tip edge
    m.face([(-0.37, q0[1], q0[2]), (-0.37, p0[1], p0[2]),
            (0.37, p0[1], p0[2]), (0.37, q0[1], q0[2])],
           (-dx, -dy, -dz), 0.74 / T[0], 2 * t / T[1]) # hinge edge
    # entry step
    m.box(-0.4, 0.4, 0, 0.16, 0.6, 0.92, T, faces=("n", "s", "e", "w", "u"))
    # dark interior seen through the window
    m.add_prim()
    m.face([(-0.36, 0.75, -0.53), (0.36, 0.75, -0.53),
            (0.36, 1.85, -0.53), (-0.36, 1.85, -0.53)],
           (0, 0, 1), 0.72 / T[0], 1.10 / T[1])        # back panel
    m.face([(-0.36, 0.17, -0.53), (0.36, 0.17, -0.53),
            (0.36, 0.17, 0.53), (-0.36, 0.17, 0.53)],
           (0, 1, 0), 0.72 / T[0], 1.06 / T[1])        # floor strip
    return m


def notice_board() -> Mesh:
    """M_YRD_NOTICE_BOARD: 1.4 wide x 0.1 deep x 1.8 high post board.

    Board face on local +Z: two posts, a 1.4 x 0.9 board (y 0.80..1.70)
    on its frame, shed roof sloping away from the reader to y 1.80. Two
    primitives: pine (timberwork), parchment (the readable face).
    """
    m = Mesh()
    T = PROPS_TILE
    for px in (-0.56, 0.56):
        m.box(px, px + 0.08, 0, 1.70, -0.04, 0.04, T,
              faces=("n", "s", "e", "w"))              # top in frame, bottom on ground
    m.box(-0.52, 0.52, 1.30, 1.36, -0.10, -0.04, T)    # cross rail
    m.box(-0.7, 0.7, 0.80, 1.70, 0.02, 0.10, T)        # board frame
    # shed roof slab (front eave lower; total height 1.80)
    ft, bt = (0.26, 1.72), (-0.26, 1.80)               # top edge (z, y)
    fb, bb = (0.26, 1.68), (-0.26, 1.76)               # bottom edge (z, y)
    m.face([(-0.74, ft[1], ft[0]), (0.74, ft[1], ft[0]),
            (0.74, bt[1], bt[0]), (-0.74, bt[1], bt[0])],
           (0, 0.9935, 0.1146), 1.48 / T[0], 0.52 / T[1])     # top
    m.face([(-0.74, fb[1], fb[0]), (-0.74, bb[1], bb[0]),
            (0.74, bb[1], bb[0]), (0.74, fb[1], fb[0])],
           (0, -0.9935, -0.1146), 1.48 / T[0], 0.52 / T[1])   # underside
    m.face([(-0.74, fb[1], fb[0]), (0.74, fb[1], fb[0]),
            (0.74, ft[1], ft[0]), (-0.74, ft[1], ft[0])],
           (0, 0, 1), 1.48 / T[0], 0.04 / T[1])        # front eave
    m.face([(0.74, bb[1], bb[0]), (-0.74, bb[1], bb[0]),
            (-0.74, bt[1], bt[0]), (0.74, bt[1], bt[0])],
           (0, 0, -1), 1.48 / T[0], 0.04 / T[1])       # back edge
    for sx, sn in ((-0.74, -1.0), (0.74, 1.0)):        # slab side ends
        m.face([(sx, fb[1], fb[0]), (sx, ft[1], ft[0]),
                (sx, bt[1], bt[0]), (sx, bb[1], bb[0])],
               (sn, 0, 0), 0.52 / T[0], 0.04 / T[1])
    # parchment face (full texture on the sheet)
    m.add_prim()
    m.face([(-0.66, 0.84, 0.105), (0.66, 0.84, 0.105),
            (0.66, 1.66, 0.105), (-0.66, 1.66, 0.105)],
           (0, 0, 1), 1.0, 1.0)
    return m


def lantern_post() -> Mesh:
    """M_YRD_LANTERN_POST: 0.2 dia x 2.6 m lit post lantern.

    Iron post (r 0.06) with base flange; bronze lantern: four corner
    posts, top/bottom plates, pyramidal cap to exactly 2.6; emissive
    glass insert (assigned in the scene). Three primitives: iron, bronze,
    glow.
    """
    m = Mesh()
    T = PROPS_TILE
    m.cyl(0.0, 0.0, 0.0, 2.12, 0.06, seg=8, uv_tile=T)      # post
    m.cyl(0.0, 0.0, 0.0, 0.10, 0.10, seg=8, cap_top=True, uv_tile=T)  # flange
    m.add_prim()
    for px in (-0.09, 0.09):
        for pz in (-0.09, 0.09):
            m.box(px, px + 0.03, 2.08, 2.47, pz, pz + 0.03, T,
                  faces=("n", "s", "e", "w", "d"))          # corner posts
    m.box(-0.115, 0.115, 2.05, 2.10, -0.115, 0.115, T)      # bottom plate
    m.box(-0.115, 0.115, 2.47, 2.52, -0.115, 0.115, T)      # top plate
    bx, by = 0.13, 2.52
    apex = (0.0, 2.60, 0.0)
    m.tri((-bx, by, bx), (bx, by, bx), apex, (0, 1, 0),
          (-bx / T[0], 0), (bx / T[0], 0), (0, 1 / T[1]))
    m.tri((bx, by, bx), (bx, by, -bx), apex, (0, 1, 0),
          (bx / T[0], 0), (bx / T[0], 0), (0, 1 / T[1]))
    m.tri((bx, by, -bx), (-bx, by, -bx), apex, (0, 1, 0),
          (bx / T[0], 0), (-bx / T[0], 0), (0, 1 / T[1]))
    m.tri((-bx, by, -bx), (-bx, by, bx), apex, (0, 1, 0),
          (-bx / T[0], 0), (-bx / T[0], 0), (0, 1 / T[1]))
    m.add_prim()
    m.box(-0.07, 0.07, 2.14, 2.42, -0.07, 0.07, T)          # glow insert
    return m
