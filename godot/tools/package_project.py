#!/usr/bin/env python3
"""Rebuild a clean, importable project ZIP; never includes saves, caches or exports."""
import argparse
import hashlib
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, default=ROOT.parent / "deliverables" / "DELVE_Godot_4.7.2.zip")
args = parser.parse_args()
output = args.output.resolve()
output.parent.mkdir(parents=True, exist_ok=True)
excluded = {".godot", "exports", "__pycache__", ".git", ".DS_Store"}
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(ROOT.rglob("*")):
        relative = path.relative_to(ROOT)
        if not path.is_file() or any(part in excluded for part in relative.parts):
            continue
        if path == output or path.suffix in {".zip", ".tmp", ".pyc"}:
            continue
        # Root-level project.godot permits direct ZIP import from Godot Project Manager.
        archive.write(path, relative)
    if archive.testzip():
        raise SystemExit("ZIP integrity check failed")
print(f"Created {output} ({output.stat().st_size / 1024 / 1024:.2f} MiB)")
print("SHA-256:", hashlib.sha256(output.read_bytes()).hexdigest())
