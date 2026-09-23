#!/usr/bin/env python3
"""Read PNG files back in, so the asset lints can inspect what actually shipped.

`pixel_io.Canvas` writes RGBA8 PNGs; `read_png()` reads any non-interlaced 8-bit
truecolour (with or without alpha) PNG, which is all the pipeline produces.
"""

from __future__ import annotations

import struct
import zlib

from .pixel_io import Canvas


def read_png(path: str) -> Canvas:
    with open(path, "rb") as handle:
        data = handle.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("%s is not a PNG" % path)

    pos = 8
    width = height = 0
    bit_depth = colour_type = 0
    idat = bytearray()
    palette: list[tuple[int, int, int]] = []
    transparency = b""

    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        tag = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if tag == b"IHDR":
            width, height, bit_depth, colour_type = struct.unpack(">IIBB", chunk[:10])
        elif tag == b"PLTE":
            palette = [
                (chunk[i], chunk[i + 1], chunk[i + 2]) for i in range(0, len(chunk), 3)
            ]
        elif tag == b"tRNS":
            transparency = chunk
        elif tag == b"IDAT":
            idat += chunk
        elif tag == b"IEND":
            break

    if bit_depth != 8:
        raise ValueError("%s: only 8-bit PNGs are supported (got %d)" % (path, bit_depth))
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}.get(colour_type)
    if channels is None:
        raise ValueError("%s: unsupported colour type %d" % (path, colour_type))

    raw = zlib.decompress(bytes(idat))
    stride = width * channels
    previous = bytearray(stride)
    rows: list[bytes] = []
    offset = 0
    for _y in range(height):
        filter_type = raw[offset]
        offset += 1
        line = bytearray(raw[offset : offset + stride])
        offset += stride
        _unfilter(line, previous, filter_type, channels)
        rows.append(bytes(line))
        previous = line

    canvas = Canvas(width, height)
    for y, line in enumerate(rows):
        for x in range(width):
            if colour_type == 6:
                r, g, b, a = line[x * 4 : x * 4 + 4]
            elif colour_type == 2:
                r, g, b = line[x * 3 : x * 3 + 3]
                a = 255
            elif colour_type == 0:
                r = g = b = line[x]
                a = 255
            elif colour_type == 4:
                r = g = b = line[x * 2]
                a = line[x * 2 + 1]
            else:  # colour_type == 3, paletted
                index = line[x]
                r, g, b = palette[index]
                a = transparency[index] if index < len(transparency) else 255
            canvas.set(x, y, (r, g, b, a))
    return canvas


def _unfilter(line: bytearray, previous: bytearray, filter_type: int, channels: int) -> None:
    """Reverse the PNG row filter in place (filters 0-4, spec §9)."""
    if filter_type == 0:
        return
    for i in range(len(line)):
        left = line[i - channels] if i >= channels else 0
        up = previous[i]
        up_left = previous[i - channels] if i >= channels else 0
        if filter_type == 1:
            line[i] = (line[i] + left) & 0xFF
        elif filter_type == 2:
            line[i] = (line[i] + up) & 0xFF
        elif filter_type == 3:
            line[i] = (line[i] + ((left + up) >> 1)) & 0xFF
        elif filter_type == 4:
            line[i] = (line[i] + _paeth(left, up, up_left)) & 0xFF
        else:
            raise ValueError("unknown PNG filter type %d" % filter_type)


def _paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c
