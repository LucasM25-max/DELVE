#!/usr/bin/env python3
"""GDD-06 T-04 export-filter test — prove the retired 3D assets cannot reach a PCK.

Static proof (no Godot required, per §11.1):

1. every retired path is absent from the git tree (except the 2D prop manifest);
2. the Web preset's exclude_filter carries a covering glob for each retired path;
3. export_filter is ``all_resources`` (so only the exclusions stand between the
   tree and the PCK — i.e. the test is meaningful);
4. include_filter still ships ``data/*.json`` (nothing over-excluded).

Run:  python3 godot/tools/verify_export_filters.py
Exit: 0 + ``EXPORT_FILTER_TEST_PASS`` on success, 1 with FAIL lines otherwise.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

GODOT_DIR = Path(__file__).resolve().parents[1]   # godot/
REPO = GODOT_DIR.parent

RETIRED_DIRS = ["godot/assets/characters", "godot/assets/textures", "godot/addons"]
RETIRED_GLOBS = [                                       # §9.1 / §10.2 exclusion set
    "assets/characters/**",
    "assets/textures/**",
    "assets/models/**",
    "addons/**",
]
MODELS_ALLOWED = {"godot/assets/models/manifest.json"}   # 2D prop manifest survives (§10.2.3)


def git(*args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(REPO), *args], check=True, capture_output=True, text=True
    ).stdout


def main() -> int:
    fails: list[str] = []

    # --- 1. retired paths out of the git tree ---------------------------------
    tracked = [l for l in git("ls-files").splitlines() if l]
    for d in RETIRED_DIRS:
        hits = [t for t in tracked if t.startswith(d + "/")]
        if hits:
            fails.append(f"tracked files remain under {d}/: {hits[:5]} (+{len(hits)-5})")
        print(f"[{'ok' if not hits else 'FAIL'}] {d}/ absent from git tree")

    model_hits = [t for t in tracked if t.startswith("godot/assets/models/")]
    unexpected = sorted(set(model_hits) - MODELS_ALLOWED)
    if unexpected:
        fails.append(f"unexpected tracked files under assets/models/: {unexpected}")
    if model_hits != sorted(MODELS_ALLOWED) and not unexpected:
        missing = sorted(MODELS_ALLOWED - set(model_hits))
        if missing:
            fails.append(f"2D prop manifest missing: {missing}")
    print(f"[{'ok' if not unexpected else 'FAIL'}] assets/models/ holds only the 2D manifest: {model_hits}")

    # --- 2/3. export preset ----------------------------------------------------
    preset = (GODOT_DIR / "export_presets.cfg").read_text(encoding="utf-8")
    m = re.search(r'^exclude_filter="([^"]*)"', preset, re.M)
    if not m:
        fails.append("exclude_filter not found in export_presets.cfg")
        exclude: set[str] = set()
    else:
        exclude = {p.strip() for p in m.group(1).split(",") if p.strip()}
    for glob in RETIRED_GLOBS:
        ok = glob in exclude
        print(f"[{'ok' if ok else 'FAIL'}] exclude_filter covers {glob}")
        if not ok:
            fails.append(f"exclude_filter missing {glob}")

    if 'export_filter="all_resources"' not in preset:
        fails.append("export_filter is not all_resources — exclusion proof no longer valid")
        print("[FAIL] export_filter=all_resources")
    else:
        print("[ok] export_filter=all_resources (exclusions are load-bearing)")

    # --- 4. include filter untouched ------------------------------------------
    im = re.search(r'^include_filter="([^"]*)"', preset, re.M)
    inc = im.group(1) if im else ""
    ok = "data/*.json" in inc
    print(f"[{'ok' if ok else 'FAIL'}] include_filter still ships data/*.json")
    if not ok:
        fails.append("include_filter lost data/*.json")

    if fails:
        for f in fails:
            print(f"FAIL: {f}")
        print("EXPORT_FILTER_TEST_FAIL")
        return 1
    print("EXPORT_FILTER_TEST_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
