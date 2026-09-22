# DELVE Godot delivery — validation report

**Date:** 2026-09-20  
**Engine:** Godot 4.7.2 stable, build `ed1daf0bf` (Linux x86_64, built from source)  
**Mode:** headless, native Godot runtime  
**Result:** **70 checks passed, 0 failures**

## Verified

- Source project import and main-scene startup.
- Attribution → logo sting → menu; reduced motion skips the sting.
- Audio player initialization/user-gesture flag (not audible playback quality).
- All five menu actions and Continue's disabled/enabled state.
- Play, first-run contract, new-contract notice, ledger, options, codex and credits creation.
- First-run sheet layout audit: group labels stay on a single line between the rules and
  the plain wax seal sits clear of the SIGN & DESCEND button.
- Real threaded loading of the yard PackedScene, then the loading screen drops the player
  straight into the test yard with no menu in between.
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

## Round 12 — web-standard visual pass on Godot 4.7.2 (2026-09-20)

Command: `godot --headless --path . res://tests/smoke_test.tscn -- --test-mode`
Result: **DELVE SMOKE TEST: 65 checks, 0 failures / SMOKE_ALL_GREEN** (exit 0).

New checks added this round: loading ink-route painter present during load; threshold
sheet carries the wax seal; codex bodies render as bbcode RichTextLabel (parsed text
contains the D20 rule bullets); options choices are segmented pill toggles (>=6); menu
shows "GODOT EDITION 0.2"; test yard is bean + white ground only (<=7 nodes, `Art/`
integration slot present, blockout scenery fully removed, ground albedo > 0.9 white).

Visual evidence (1600x900, Godot 4.7.2, tests/shot_walk.tscn + tests/yard_shot.tscn):
r2-01-menu, r2-02-contract, r2-03-loading, r2-04-threshold, r2-05-codex, r2-06-options,
r2-07-credits, r2-08-yard-paused, r2-09-yard-walk.

Changes validated: baked Cinzel/Alegreya/IM Fell static weights; wax seal asset and stamp
animations; loading screen rebuilt to web standard (Sword Coast map, ink route with
waypoints and progress nib, rotating seal, percent, pips, cycling FIELD ADVICE slip,
weighted real progress 70/20/10, 1.2 s minimum); parchment alpha cut-out (white studio
background removed); codex bbcode bodies; options pill toggles; test yard reduced to
bean player on flat white ground with dark-ink HUD.

## Round 13 — humanoid player, plugin adoption, docs (2026-09-20)

Command: `godot --headless --path . res://tests/smoke_test.tscn -- --test-mode`
Result: **DELVE SMOKE TEST: 69 checks, 0 failures / SMOKE_ALL_GREEN** (exit 0).

New checks: bean placeholder retired; hero Skeleton3D carries the 65-bone universal rig;
UAL library bound to the hero (`Walk`, `Sprint` present); locomotion animation tracks
movement after WASD input.

Asset provenance verified programmatically: UAL and Base-Character skeletons are
set-identical (65/65 joint names), so animations bind with zero retargeting. Terrain3D
v1.0.2 load/render probe on Godot 4.7.2 + gl_compatibility: classes register, node
instantiates, terrain mesh renders (scratch project, `/tmp`, not committed).

Visual evidence: `shots/r2-09-yard-walk.png` (humanoid mid-stride, white yard),
`shots/r2-08-yard-paused.png`, plus round-12 set r2-01…r2-07 unchanged.

Docs: new `GITHUB_SYNC.md` (GitHub ⇄ Godot routine); README/GETTING_STARTED/ARCHITECTURE/
THIRD_PARTY updated for the Godot+Blender stack, Terrain3D/Sky3D adoption and the CC0
character/animation kits.
