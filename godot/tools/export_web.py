#!/usr/bin/env python3
"""Export DELVE using an installed Godot 4.7.2 standard editor + matching templates."""
import argparse
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--godot", default="godot", help="Godot executable name or full path")
args = parser.parse_args()
output = ROOT / "exports" / "web"
output.mkdir(parents=True, exist_ok=True)
try:
    version = subprocess.run([args.godot, "--version"], check=True, capture_output=True, text=True).stdout.strip()
    if not version.startswith("4.7.2.") or "mono" in version.lower():
        raise SystemExit(f"This delivery targets Godot 4.7.2 Standard; found {version!r}. Pass --godot with the matching executable.")
    subprocess.run([args.godot, "--headless", "--path", str(ROOT), "--editor", "--import"], check=True)
    subprocess.run([args.godot, "--headless", "--path", str(ROOT), "--export-release", "Web", str(output / "index.html")], check=True)
except FileNotFoundError:
    raise SystemExit("Godot not found. Pass --godot followed by the full path to your Godot executable.")
except subprocess.CalledProcessError:
    raise SystemExit("Export failed. Check the messages above. Install matching export templates through Editor > Manage Export Templates.")
shutil.copytree(ROOT / "licenses", output / "licenses", dirs_exist_ok=True)
for path in (ROOT / "assets" / "fonts").glob("*OFL.txt"):
    shutil.copy2(path, output / "licenses" / path.name)
shutil.copy2(ROOT / "THIRD_PARTY.md", output / "licenses" / "THIRD_PARTY.md")
print(f"\nWebsite exported to {output}\nTest it with: python tools/serve_web.py")
