# DELVE Godot delivery — validation report

**Date:** 2026-09-20  
**Engine:** Godot 4.7.2 stable, official build `ed1daf0bf` (Linux x86_64)  
**Mode:** headless, native Godot runtime  
**Result:** **56 checks passed, 0 failures**

## Verified

- Source project import and main-scene startup.
- Attribution → logo sting → menu; reduced motion skips the sting.
- Audio player initialization/user-gesture flag (not audible playback quality).
- All five menu actions and Continue's disabled/enabled state.
- Play, first-run contract, new-contract notice, ledger, threshold, options, codex and credits creation.
- Real threaded loading of the optional yard PackedScene.
- Six settings categories build successfully.
- Native binding changes reach InputMap; WASD stays reserved; Escape cancels; reset works.
- Loading-error recovery UI and Escape-to-menu route.
- Rules, lore and bestiary pages build successfully.
- Save/reload of contract, difficulty and audio preferences.
- Eight-contract limit, ninth-contract refusal, individual deletion.
- Invalid contract filtering, numeric range clamping, invalid enum/binding rejection.
- Corrupt JSON and unwritable-save-path handling without crashing.
- Yard's explicit capture/pause gate; editable player, Art slot and blockout geometry.
- Gravity/floor collision, camera-relative WASD movement and first/third-person camera modes.
- Web-target PCK export and subsequent headless main-pack startup.
- ZIP integrity and clean-extraction import / regression run.

## Reproduce

From the extracted project's root, with Godot 4.7.2 on PATH:

```sh
godot --headless --path . --editor --import
godot --headless --path . res://tests/smoke_test.tscn -- --test-mode
godot --headless --path . --quit-after 90
```

Tests refuse to run without `--test-mode`. They use `user://delve_test_v1.json` and leave the
real `user://delve_v1.json` untouched. Exit code is nonzero for a failed assertion. Godot can
report script errors separately, so also inspect stdout/stderr for `SCRIPT ERROR` / `ERROR`.

Optional Web PCK check (this alone does NOT create a playable website):

```sh
# Create exports/web first, if it does not exist.
godot --headless --path . --export-pack Web exports/web/DELVE.pck
godot --headless --main-pack exports/web/DELVE.pck --quit-after 90
```

## Not verified in this environment

- Hardware-rendered screenshots / desktop visual inspection.
- Audible music quality, actual hardware gamepads and every possible key combination.
- Full HTML/JavaScript/WASM export, real WebGL rendering, browser pointer-lock prompts,
  IndexedDB survival across browser restarts, mobile browsers and production hosting.

The sandbox did not provide Web export templates or a graphical display. A successfully
exported PCK verifies resource packaging, **not** a complete browser build. The included
Web preset is single-threaded and uses Compatibility. Install matching templates and use
`GETTING_STARTED.md` to export and test the website before publishing.

## Suggested manual acceptance pass

1. Import, F5, listen for music after Continue and inspect the original-art main menu.
2. Visit every menu page, adjust volume/reduced motion/high contrast, restart and confirm storage.
3. Sign a contract, open the ledger, cancel a deletion, then confirm deletion of a test contract.
4. Enter the yard, resume, move/jump/sprint, toggle view, test walls/camera collision and Escape.
5. Export Web, serve over HTTP locally, repeat the flow in current Chrome/Firefox/Safari as applicable.
6. Publish over HTTPS and repeat, including a full browser restart and iframe testing if embedded.
