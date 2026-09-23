#!/usr/bin/env python3
"""Rebuild every generated asset in one go.

    python3 tools/build_all.py            # palette, text faces, brand, UI kit
    python3 tools/build_all.py --check    # rebuild, then run the two checkers

Each builder is deterministic: same inputs in, byte-identical PNGs/JSON out, so
a diff on `assets/` always means someone changed a builder or a source.

Run:  python3 tools/build_all.py [--check] [--preview]
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")

BUILDERS = [
    ("palette", "build_palette.py"),
    ("fonts", "build_text_faces.py"),
    ("brand", "build_brand.py"),
    ("ui kit", "build_ui_kit.py"),
]

CHECKERS = [
    ("project check", "check_project.py"),
    ("string parity", "check_strings.py"),
]


def run(script: str, extra: list[str]) -> int:
    return subprocess.call([sys.executable, os.path.join(TOOLS, script)] + extra)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="run the checkers afterwards")
    parser.add_argument("--preview", action="store_true", help="pass --preview to builders")
    args = parser.parse_args()

    failures = 0
    for label, script in BUILDERS:
        print("== %s (%s)" % (label, script))
        if run(script, ["--preview"] if args.preview else []) != 0:
            failures += 1
    if args.check:
        for label, script in CHECKERS:
            print("== %s (%s)" % (label, script))
            if run(script, []) != 0:
                failures += 1
    if failures:
        print("\n%d step(s) failed" % failures)
        return 1
    print("\nall builders finished")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
