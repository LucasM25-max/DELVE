# DELVE — provenance and notices

## Original DELVE material

The panorama, map, parchment, logo emblem and wordmark were already supplied in this
repository. The source README identifies the images as generated artwork. This port uses
optimized copies; full originals remain in the original web project.

`assets/audio/mus_menu_theme.ogg` is copied from the repository's supplied root OGG. Its
underlying generation/source/license is not independently verified by this conversion.
The codex excerpts, lore, menu copy and default settings were carried over from the
existing `index.html` and `js/shell.js`. Their inclusion does not establish redistribution rights.

Round 13 added third-party open content (all free licences, files committed with their
licence texts):

- **Universal Animation Library** by Quaternius — CC0 1.0. Standard free tier, Godot
  export (`UAL1_Standard.glb`, 43 clips). Licence: `assets/characters/universal/UAL_License.txt`.
- **Universal Base Characters** by Quaternius — CC0 1.0. Standard free tier, Godot/UE
  exports (`Superhero_Male/Female_FullBody`) with PBR textures. Licence:
  `assets/characters/hero/UBC_License.txt`.
- **Terrain3D** by Tokisan Games — MIT. GDExtension plugin, installed locally from the
  Asset Library / GitHub release; **not redistributed in delivery zips**.
- **Sky3D** by Tokisan Games — MIT. GDScript plugin, same distribution note.

> **T-04 retirement note (2026-09-23):** the Quaternius character/UAL files, the 3D ground
> textures, the `M_YRD_*` model kit and the Sky3D addon have been retired from the working
> tree (GDD-06 §10.2). Byte-preserving copies — **including every licence text cited above** —
> ship in Release [`DELVE_3D_ASSETS_v0.3.0.zip`](https://github.com/LucasM25-max/DELVE/releases/tag/archive/3d-v0.3.0)
> at tag `archive/3d-v0.3.0`. The CC0/MIT credits above remain in force (GDD-06 §15.6).

CC0 content carries no attribution obligation; attribution is kept voluntarily. The
earlier statement that no external models were downloaded applied to rounds ≤ 12 only.

## Fan-project attribution

An unofficial, non-commercial fan project. Dungeons & Dragons, Phandelver and Below:
The Shattered Obelisk and all Wizards of the Coast characters and locations are trademarks
of Wizards of the Coast LLC. Used here without permission; no challenge to any trademark
or copyright. This game will never be sold.

**Before publishing:** independently confirm applicable content permissions, policies and
licenses. Non-commercial use alone is not permission. This notice is not legal clearance.

## Fonts

- Cinzel — supplied from the Google Fonts `ofl/cinzel` family; SIL Open Font License 1.1.
- Alegreya — supplied from the Google Fonts `ofl/alegreya` family; SIL Open Font License 1.1.

The actual notices are in `assets/fonts/cinzel-OFL.txt` and `assets/fonts/alegreya-OFL.txt`.
Fonts are local files; runtime access to Google Fonts is not required.

## Engine

Godot Engine is MIT licensed. Official engine notices for the pinned 4.7.2 release are in
`licenses/GODOT-LICENSE.txt` and `licenses/GODOT-COPYRIGHT.txt`.
See https://godotengine.org/license/ for engine and third-party acknowledgments.

This delivery does not change the licensing of the original DELVE project, its names,
rule excerpts or assets. Preserve notices when redistributing allowed material.
