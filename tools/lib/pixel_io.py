"""Minimal, dependency-free PNG + pixel-canvas helpers for the DELVE pixel build tools.

Everything the asset builders need lives here so that `tools/*.py` stay short and
readable: an RGBA8 canvas with integer-only drawing primitives and a PNG writer
built on `zlib` + `struct` (no Pillow required).

The canvas stores premultiplied-free RGBA bytes; palette-locked art is written by
passing colours straight out of `Palette` hex constants.
"""

from __future__ import annotations

import struct
import zlib
from typing import Iterable, List, Sequence, Tuple

RGBA = Tuple[int, int, int, int]


def hex_to_rgba(value: str) -> RGBA:
    """`#RRGGBB` or `#RRGGBBAA` -> (r, g, b, a)."""
    value = value.lstrip("#")
    if len(value) == 6:
        value += "FF"
    if len(value) != 8:
        raise ValueError("colour must be #RRGGBB or #RRGGBBAA: %r" % value)
    return (
        int(value[0:2], 16),
        int(value[2:4], 16),
        int(value[4:6], 16),
        int(value[6:8], 16),
    )


def rgba_to_hex(colour: RGBA) -> str:
    return "#%02X%02X%02X%02X" % tuple(colour)


class Canvas:
    """A 2-D RGBA8 pixel buffer with integer drawing primitives."""

    def __init__(self, width: int, height: int, fill: RGBA | None = None) -> None:
        if fill is not None and len(fill) != 4:
            raise ValueError("fill must be (r, g, b, a), got %r" % (fill,))
        self.width = width
        self.height = height
        self.pixels: bytearray = bytearray(width * height * 4)
        if fill is not None:
            for i in range(width * height):
                self.pixels[i * 4 : i * 4 + 4] = bytes(fill)

    # -- raw access -----------------------------------------------------
    def _offset(self, x: int, y: int) -> int:
        return (y * self.width + x) * 4

    def in_bounds(self, x: int, y: int) -> bool:
        return 0 <= x < self.width and 0 <= y < self.height

    def get(self, x: int, y: int) -> RGBA:
        o = self._offset(x, y)
        return (
            self.pixels[o],
            self.pixels[o + 1],
            self.pixels[o + 2],
            self.pixels[o + 3],
        )

    def set(self, x: int, y: int, colour: RGBA) -> None:
        """Set one pixel. Out-of-bounds writes are ignored (clipping)."""
        if not self.in_bounds(x, y):
            return
        if len(colour) != 4:
            raise ValueError("colour must be (r, g, b, a), got %r" % (colour,))
        o = self._offset(x, y)
        self.pixels[o : o + 4] = bytes(colour)

    # -- primitives -----------------------------------------------------
    def rect(self, x: int, y: int, w: int, h: int, colour: RGBA) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, colour)

    def hline(self, x: int, y: int, w: int, colour: RGBA) -> None:
        self.rect(x, y, w, 1, colour)

    def vline(self, x: int, y: int, h: int, colour: RGBA) -> None:
        self.rect(x, y, 1, h, colour)

    def frame(self, x: int, y: int, w: int, h: int, colour: RGBA) -> None:
        """1-px rectangle outline inside the given bounds."""
        self.hline(x, y, w, colour)
        self.hline(x, y + h - 1, w, colour)
        self.vline(x, y, h, colour)
        self.vline(x + w - 1, y, h, colour)

    def line(self, x0: int, y0: int, x1: int, y1: int, colour: RGBA) -> None:
        """Bresenham line, inclusive of both endpoints."""
        dx = abs(x1 - x0)
        dy = -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.set(x0, y0, colour)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def thick_line(
        self, x0: int, y0: int, x1: int, y1: int, colour: RGBA, thickness: int = 2
    ) -> None:
        """Axis-ish thick line: stamps a `thickness` square along a Bresenham path."""
        dx = abs(x1 - x0)
        dy = -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            if thickness <= 1:
                self.set(x0, y0, colour)
            else:
                half = thickness // 2
                self.rect(x0 - half, y0 - half, thickness, thickness, colour)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def blit_mask(
        self,
        x: int,
        y: int,
        rows: Sequence[str],
        colour: RGBA,
        ink: str = "#",
    ) -> None:
        """Stamp an ASCII mask (`rows` of `ink`/anything-else) at (x, y)."""
        for ry, row in enumerate(rows):
            for rx, cell in enumerate(row):
                if cell == ink:
                    self.set(x + rx, y + ry, colour)

    def blit_glyph_columns(
        self, x: int, y: int, columns: Sequence[int], colour: RGBA, height: int = 7
    ) -> None:
        """Stamp a column-packed 1-bpp glyph (bit 0 = top row)."""
        for cx, col in enumerate(columns):
            for row in range(height):
                if col >> row & 1:
                    self.set(x + cx, y + row, colour)

    def crop(self, x: int, y: int, w: int, h: int) -> "Canvas":
        out = Canvas(w, h)
        for yy in range(h):
            src = self._offset(x, y + yy)
            out.pixels[yy * w * 4 : (yy + 1) * w * 4] = self.pixels[
                src : src + w * 4
            ]
        return out

    # -- output ---------------------------------------------------------
    def to_png_bytes(self) -> bytes:
        raw = bytearray()
        stride = self.width * 4
        for y in range(self.height):
            raw.append(0)  # filter type 0 (None)
            raw += self.pixels[y * stride : (y + 1) * stride]

        def chunk(tag: bytes, data: bytes) -> bytes:
            return (
                struct.pack(">I", len(data))
                + tag
                + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
            )

        header = struct.pack(">IIBBBBB", self.width, self.height, 8, 6, 0, 0, 0)
        return (
            b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", header)
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
            + chunk(b"IEND", b"")
        )

    def save(self, path: str) -> None:
        with open(path, "wb") as handle:
            handle.write(self.to_png_bytes())

    # -- debugging ------------------------------------------------------
    def to_ascii(self, zero: str = "..", one: str = "##", alpha_min: int = 1) -> str:
        """Render as a compact ASCII preview (used by tool `--preview` flags)."""
        lines: List[str] = []
        for y in range(self.height):
            row = []
            for x in range(self.width):
                _, _, _, a = self.get(x, y)
                row.append(one if a >= alpha_min else zero)
            lines.append("".join(row))
        return "\n".join(lines)


def preview_grid(canvases: Iterable[Canvas], gap: str = "  ") -> str:
    """Join several canvases side by side as ASCII (all must share a height)."""
    canvases = list(canvases)
    if not canvases:
        return ""
    height = max(c.height for c in canvases)
    blocks = [c.to_ascii().split("\n") for c in canvases]
    out = []
    for y in range(height):
        out.append(
            gap.join(
                block[y] if y < len(block) else "  " * c.width
                for block, c in zip(blocks, canvases)
            )
        )
    return "\n".join(out)
