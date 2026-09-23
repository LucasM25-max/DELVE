"""Every string the shell can draw, and the character set the faces must carry.

`tools/build_text_faces.py` bakes the shipped fonts from this set and
`tools/check_project.py` gates them against it, so a string that reaches for a
character the face does not carry fails the gate instead of drawing a browser
fallback glyph.

Sources of copy, all under `web/data/`:

  * `strings.json` — the spec's §5.11 master table plus the strings this build
    introduced (kept under "build", so the parity checker can tell them apart);
  * `shell_content.json` — the §5.9 loading tips and the credits blocks;
  * `options_schema.json` — the §5.6 tab labels, row labels, value labels and
    help text, which the Options page draws verbatim.

The set the faces are cut to is printable ASCII plus the typographic marks the
spec uses. ASCII is included wholesale on purpose: it costs about a kilobyte a
face, and it means a copy tweak ("1920×1080" — the digit no shipped string had
carried) can never render as a hole in the page.
"""

from __future__ import annotations

import json
import os
from typing import List, Set

PRINTABLE_ASCII: Set[int] = set(range(0x20, 0x7F))

# Marks the copy uses or is one edit away from using: the typographic set the
# pixel build's charset carried.
SPARE_CODEPOINTS: Set[int] = {
    0x2013,  # – en dash
    0x2014,  # — em dash
    0x2018,  # ‘ left single quote
    0x2019,  # ’ right single quote
    0x201C,  # “ left double quote
    0x201D,  # ” right double quote
    0x2026,  # … ellipsis
    0x00A7,  # § section sign
    0x00B7,  # · middle dot
    0x00D7,  # × multiplication sign
    0x2191,  # ↑ arrow up
    0x2192,  # → arrow right
    0x2193,  # ↓ arrow down
    0x2212,  # − minus
    0x2264,  # ≤ less-or-equal
    0x2265,  # ≥ greater-or-equal
}


def _values(block) -> List[str]:
    if isinstance(block, str):
        return [block]
    if isinstance(block, list):
        return [item for value in block for item in _values(value)]
    if isinstance(block, dict):
        return [item for value in block.values() for item in _values(value)]
    return []


def shipped_strings(web_dir: str) -> List[str]:
    """Every string the shell can draw, from the shipped data files."""
    def load(rel: str) -> dict:
        return json.load(open(os.path.join(web_dir, "data", rel), encoding="utf-8"))

    strings = load("strings.json")
    content = load("shell_content.json")
    schema = load("options_schema.json")

    out: List[str] = []
    for block in ("spec", "build"):
        out.extend(value for value in strings.get(block, {}).values() if isinstance(value, str))
    out.extend(content.get("loading_tips", []))
    out.extend(_values(content.get("credits_blocks", [])))
    for tab in schema.get("tabs", []):
        out.append(tab.get("label", ""))
        for row in tab.get("rows", []):
            out.append(row.get("label", ""))
            out.append(row.get("help", ""))
            out.extend(_values(row.get("values", [])))
    return [text for text in out if text]


def used_codepoints(web_dir: str) -> Set[int]:
    """The characters those strings are made of (printable ones)."""
    codes: Set[int] = set()
    for text in shipped_strings(web_dir):
        codes.update(ord(character) for character in text if ord(character) >= 0x20)
    return codes


def charset(web_dir: str) -> List[int]:
    """Every codepoint the shipped faces must carry, sorted."""
    return sorted(PRINTABLE_ASCII | SPARE_CODEPOINTS | used_codepoints(web_dir))
