# DELVE — Godot edition

**Open `project.godot` in Godot 4.7.2 Standard, then press F5.**

Version **0.3.0-godot** — round 13:

- **Engine stack:** Godot 4.7.2 (game) + Blender (future model/Outfit pipeline).
- **Humanoid player:** the bean capsule is retired. The yard now runs a CC0 Quaternius
  *Universal Base Characters* humanoid (65-bone universal rig) driven by the CC0
  *Universal Animation Library* (43 free clips: idle/walk/jog/sprint, jumps, combat,
  deaths) — identical skeletons, zero retargeting.
- **Plugins adopted (installed from the Asset Library, enabled in Project Settings):**
  *Terrain3D* (Tokisan Games, MIT) for future editable terrain and *Sky3D* (Tokisan Games,
  MIT) for the day/night sky. Both are documented, not yet wired into scenes; Terrain3D
  has no stable Web export upstream, so it is desktop-first.
- Round 12's web-standard shell (parchment, wax seals, baked fonts, ink-route loading
  road) is unchanged.

**New here:** [GITHUB_SYNC.md](GITHUB_SYNC.md) — the easy step-by-step for keeping GitHub
and your Godot editor in sync.

Start with **[GETTING_STARTED.md](GETTING_STARTED.md)** for step-by-step import, controls,
Web export/hosting instructions and the Blender/model pipeline.

This is a native port of the existing DELVE game-menu preview, plus an optional 3D movement
blockout. It is not a completed adventure. GDScript, Compatibility rendering and a
single-threaded Web export preset keep the project aligned with the eventual browser game.

- [Architecture and future integration](ARCHITECTURE.md)
- [Provenance and rights notices](THIRD_PARTY.md)
- [GitHub ⇄ Godot sync routine](GITHUB_SYNC.md)
- [Validation report](tests/TEST_REPORT.md)

All art, fonts, music and source needed to run in the editor are included. Godot itself
and its export templates are not bundled. No plugins or purchased assets are required.
