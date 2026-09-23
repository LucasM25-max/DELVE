# DELVE — native Godot architecture

## Intent

Keep the existing menu's identity while replacing the HTML/CSS/JavaScript implementation
with native Godot Controls, scenes and GDScript. The original website remains untouched
in the repository root; `godot/` is independently importable.

This port is not pixel-for-pixel CSS emulation. It retains the art, palette, typography,
menu structure and contract flow while adopting native Godot layout/focus controls.
The original preview's incomplete/contradictory eight-slot claim is implemented as an
actual eight-contract ledger here. The loading route now drops the player straight
into the test yard — no menu in between. The optional 3D blockout is new.

## Layout

```text
project.godot                    Entry point + Compatibility renderer + autoloads
export_presets.cfg               Single-threaded Web preset
scenes/ui/shell.tscn              Main scene
scenes/world/test_yard.tscn       Editable 3D blockout; Art is the model integration slot
scenes/actors/player.tscn         CharacterBody3D, capsule, Visuals, camera/SpringArm
scenes/actors/npc_corwin.tscn     Corwin guard NPC (A1): hero body, guard-blue tint, Voice
scripts/core/game_state.gd       Settings, validation, input bindings, eight-slot local save
scripts/core/sound.gd            Bundled OGG, user-gesture startup, volume/focus/VO-duck behavior
scripts/ui/shell.gd              Screen state machine, native Controls, threaded loader
scripts/ui/shell_ui.gd           Fonts, palette, reusable native UI factory
scripts/ui/backdrop.gd           Low-cost panorama drift, reduced-motion support
scripts/ui/options_page.gd       Schema-driven native settings and rebinding
scripts/world/player.gd          Camera-relative movement and camera modes
scripts/world/npc_corwin.gd      Guard idle (lean/scan pose offsets), VO say(), TR_A_LANE hook
scripts/world/test_yard.gd       Pause, pointer lock, menu return, HUD
assets/images/                  Existing web artwork, optimized for browser download
assets/audio/                   Supplied theme (no invented/generated extra tracks)
assets/fonts/                   Local Cinzel/Alegreya + SIL OFL notices
data/options_schema.json        Six options categories, labels, choices and live/future flags
data/shell_content.json         Original defaults, codex reference/lore and loading-tip text
tests/                          Isolated headless regression scene and report
tools/                          Export, local web server and clean ZIP packaging helpers
```

The UI is constructed from native nodes in code; opening `shell.tscn` shows its root,
not an entire prebuilt editor layout. F5 creates the full interface. This keeps a single
set of styles and makes later game-code changes straightforward. The 3D scene and player
are authored `.tscn` hierarchies and can be edited directly in the scene dock.

## Runtime flow

`legal → sting → menu → contract → loading → test_yard`

- Continue chooses an existing contract through the ledger and enters the test yard
  from the same loading screen.
- Options/codex/credits return to the menu; Escape leaves the menu itself unchanged.
- Threaded `ResourceLoader` progress refers to the actual test-yard PackedScene. Cached
  assets can load immediately; a short minimum dwell keeps the transition readable.
- Retry and return actions cover resource failure. No fake claim of a loaded campaign.
- HUD pause uses an explicit browser gesture for pointer capture, pauses 3D simulation,
  and detects pointer-lock/focus loss.

## Persistence

`GameState` owns flat settings and a versioned JSON ledger at `user://delve_v1.json`.
Save writes are debounced for sliders, then written to a temporary file and renamed.
Contracts save immediately. Invalid data is filtered; future schema migrations should
increment the version and provide an explicit migration function.

Native and web storage are separate. Original `delve.contract.v1`/`delve.options.v1`
JavaScript localStorage is not imported. Browser persistence is local and subject to browser
storage policy, not a backend or account system. Tests use `delve_test_v1.json` only.

## Functional settings

- **Live shell:** frame cap (subject to VSync/browser scheduling), reduced motion,
  high-contrast UI, master/music volume, mute on focus loss.
- **Test yard:** default first/third-person view, FOV, third-person boom length,
  sprint/jump/view key bindings. WASD and Escape remain reserved.
- **Stored future settings:** full combat/difficulty behavior, subtitles, most accessibility
  outlines/filters/screen-reader controls, quality/foliage/resolution presets, SFX/voice,
  interactions/journal/folio and other gameplay bindings. Marked † in the UI.
- Ray tracing is disabled because this project targets Compatibility/WebGL 2.

## Next development steps

1. Approve the visual direction and browser/device target.
2. Replace the menu matte with a 3D background only if the performance budget allows it.
3. Author the actual Neverwinter yard in Blender or integrate licensed .glb assets under Art.
4. Replace the capsule visual; build character animation state machines.
5. Implement interactions, a real gameplay scene, progression and explicit save migrations.
6. Implement campaign/combat systems and connect currently future-only settings as each lands.
7. Add browser integration tests, profiling and accessibility/mobile work before a public launch.

Do not put core gameplay logic on imported model roots. Use wrapper scenes, separate
collisions and data resources. Prefer GDScript over .NET for this browser-first project.
Blender source files can be stored separately while exported GLB files are the runtime inputs.

## Rebuild and export

```sh
godot --headless --path . --editor --import
godot --headless --path . res://tests/smoke_test.tscn -- --test-mode
python tools/export_web.py --godot /path/to/godot
python tools/serve_web.py
python tools/package_project.py
```

`.godot/`, `exports/`, real user saves and large generated builds are excluded from the
source deliverable. No automatic network services, telemetry, plugin downloads or third-party
runtime dependencies are present.

## Character and animation architecture (v0.3)

```text
assets/characters/universal/UAL1_Standard.glb   43 CC0 clips, no-root-motion variant
assets/characters/hero/Superhero_*_FullBody.*   CC0 base bodies + PBR textures
scripts/world/player.gd                         controller + AnimationPlayer wiring
```

- Both kits share Quaternius' **universal humanoid rig** (65 joints, `pelvis/spine_01/…`
  naming). Verified set-identical at import; **no retargeting layer exists or is needed**.
- The UAL glTF imports as `root → Armature → Skeleton3D` plus a sibling `AnimationPlayer`
  whose tracks address `Armature/Skeleton3D:<bone>`. The player therefore adds its own
  `AnimationPlayer` as a sibling of the hero's `Armature`, copies the library, and the
  tracks resolve onto the hero skeleton unchanged.
- Locomotion states (`_animation_state()`): Idle / Walk / Jog_Fwd / Sprint by horizontal
  speed, `Jump` airborne, `Jump_Land` on touchdown, 0.25 s cross-fades. Root-motion variants
  (`UAL1_Standard_RM.glb`) are deliberately not committed: the controller owns movement.
- First person hides `Visuals` (the whole hero subtree); the capsule collision and the
  SpringArm camera stay owned by `player.tscn` as before.
- Swap-in path for final characters: replace the `Visuals/Hero` instance with any mesh on
  the same universal rig (Modular Outfits, Blender re-tops) — nothing else changes.

## Terrain and sky plugin slots (adopted, unwired)

- **Terrain3D** (GDExtension, MIT): future replacement for yard/adventure ground. Verified
  on Godot 4.7.2 + Compatibility renderer: classes register, node instantiates, mesh
  renders headless. Data directories will live per-map (e.g. `res://worlds/yard/`);
  heightmaps can be generated procedurally and imported via its API.
- **Sky3D** (GDScript, MIT): future replacement for the yard's flat `WorldEnvironment`;
  exposes game-time control for dawn/dusk staging. Compatibility- and web-safe.
- Neither plugin is referenced by committed scenes yet, so clones without the addons still
  run the shell and yard; enabling them adds capability without breaking the baseline.
