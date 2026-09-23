#!/usr/bin/env python3
"""Bring the audio the project needs into `web/assets/audio/`.

Two sources:

  --from-repo   copy the tracks that already live in this repository (the menu
                theme and Corwin's three voice lines are "existing keepers" in
                GDD-07 §5.10 / §9), renaming them to the cue table's names;
  --generate    synthesise the placeholder cue family with numpy-free pure
                Python (a small additive/subtractive synth) so the shell is not
                silent before the real sound design lands.

Cues without files are skipped by `Sound` at runtime, so this script is
optional — it just closes the gap. Files are MP3/Ogg and are **not** committed
(see `.gitignore`); regenerate them on any machine with:

    python3 tools/fetch_audio.py --from-repo --generate

Run:  python3 tools/fetch_audio.py [--from-repo] [--generate] [--list]
"""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import struct
import sys
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
REPO = ROOT
OUT_DIR = os.path.join(WEB, "assets", "audio")

# Cue id -> file already committed elsewhere in this repository.
REPO_KEEPERS = {
    "MUS_MENU_THEME": "mus_menu_theme.ogg",
    "VO_GRD_001": os.path.join("web", "assets", "audio", "vo_grd_001.ogg"),
    "VO_GRD_002": os.path.join("web", "assets", "audio", "vo_grd_002.ogg"),
    "VO_GRD_003": os.path.join("web", "assets", "audio", "vo_grd_003.ogg"),
}

# Cue id -> synthesis recipe: (seconds, waveform, base_hz, decay)
SYNTH = {
    "SFX_UI_MOVE": (0.05, "noise", 1800.0, 40.0),
    "SFX_UI_CONFIRM": (0.12, "wood", 320.0, 26.0),
    "SFX_UI_BACK": (0.14, "noise", 900.0, 18.0),
    "SFX_UI_DENY": (0.18, "square", 180.0, 14.0),
    "SFX_UI_PAGE": (0.16, "noise", 1200.0, 16.0),
    "SFX_BOOT_STONE": (0.80, "stone", 90.0, 3.5),
    "SFX_BOOT_EMBERS": (0.35, "noise", 700.0, 9.0),
    "SFX_BOOT_CHISEL": (0.12, "wood", 520.0, 24.0),
    "MUS_BOOT_STING": (0.60, "chord", 146.83, 2.0),
    "SFX_LOAD_STAMP": (0.30, "stone", 120.0, 9.0),
    "SFX_DICE_ROLL": (0.55, "noise", 1500.0, 5.0),
    "SFX_HIT": (0.14, "wood", 420.0, 18.0),
    "SFX_MISS": (0.12, "noise", 2400.0, 22.0),
    "SFX_CRIT": (0.45, "chord", 880.0, 4.5),
}

SAMPLE_RATE = 22050


def cue_files() -> dict[str, str]:
    doc = json.load(open(os.path.join(WEB, "data", "audio_cues.json"), encoding="utf-8"))
    return {cue_id: entry.get("file", "") for cue_id, entry in doc["cues"].items()}


def copy_keepers() -> int:
    copied = 0
    for cue_id, source in REPO_KEEPERS.items():
        source_path = os.path.join(REPO, source)
        if not os.path.exists(source_path):
            print("  missing keeper source: %s" % source_path)
            continue
        target = os.path.join(OUT_DIR, os.path.basename(cue_files().get(cue_id, "")) or
                              "cue.ogg")
        shutil.copyfile(source_path, target)
        print("  copied %-18s <- %s" % (cue_id, source))
        copied += 1
    return copied


def synth_cue(cue_id: str) -> str:
    seconds, kind, frequency, decay = SYNTH[cue_id]
    frames = int(SAMPLE_RATE * seconds)
    samples = []
    noise_state = 12345
    for i in range(frames):
        t = i / SAMPLE_RATE
        envelope = math.exp(-decay * t)
        if kind == "noise":
            noise_state = (1103515245 * noise_state + 12345) & 0x7FFFFFFF
            value = (noise_state / 0x3FFFFFFF) - 1.0
            value *= 0.35
        elif kind == "square":
            value = 1.0 if math.sin(2 * math.pi * frequency * t) >= 0 else -1.0
            value *= 0.30
        elif kind == "stone":
            value = math.sin(2 * math.pi * frequency * t) * 0.5
            value += math.sin(2 * math.pi * frequency * 1.5 * t) * 0.25
        elif kind == "wood":
            value = math.sin(2 * math.pi * frequency * t) * 0.6
            value += math.sin(2 * math.pi * frequency * 2.02 * t) * 0.2
        else:  # chord
            value = (
                math.sin(2 * math.pi * frequency * t)
                + math.sin(2 * math.pi * frequency * 1.25 * t)
                + math.sin(2 * math.pi * frequency * 1.5 * t)
            ) / 3.0 * 0.5
        samples.append(value * envelope)

    # Plain WAV keeps this tool dependency free (no encoder in the sandbox) and
    # every browser plays it; transcode to Ogg/MP3 when the real sound design
    # lands. Cues without a file are simply silent at runtime.
    target = os.path.join(OUT_DIR, "%s.wav" % cue_id.lower())
    with wave.open(target, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, sample)) * 24000)) for sample in samples
        ))
    return target


def generate_cues() -> int:
    made = 0
    for cue_id in SYNTH:
        path = synth_cue(cue_id)
        print("  synthesised %-18s -> %s" % (cue_id, os.path.basename(path)))
        made += 1
    return made


def list_state() -> None:
    files = cue_files()
    present = 0
    for cue_id, path in sorted(files.items()):
        full = os.path.join(WEB, path.replace("assets/", "assets/"))
        exists = os.path.exists(full)
        present += 1 if exists else 0
    print("%d of %d cue files present under assets/audio/" % (present, len(files)))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-repo", action="store_true", help="copy existing tracks")
    parser.add_argument("--generate", action="store_true", help="synthesise placeholder cues")
    parser.add_argument("--list", action="store_true", help="report which cue files exist")
    args = parser.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    if args.list or not (args.from_repo or args.generate):
        list_state()
        return 0
    if args.from_repo:
        copy_keepers()
    if args.generate:
        generate_cues()
    list_state()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
