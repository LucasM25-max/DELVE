# Sky3D Integration Plan for DELVE

**Status: Sky3D 2.1 (Tokisan Games, MIT) now vendored in `addons/sky_3d/` and enabled in `project.godot`. Test yard uses it.**

## What Sky3D actually is (from source)

- **Not a full weather system.** Source check:
  - `Sky3D.gd` `@export_group("Weather")` only has `wind_speed` (m/s) and `wind_direction` (deg, 0=north).
  - `SkyDome.gd` `@export_group("Clouds")` → `cirrus_*` (high-alt) and `cumulus_*` (low-alt) with coverage, thickness, intensity, absorption, size, UV, texture, plus wind-driven velocity.
  - No rain, snow, lightning, precipitation shaders.

- **Core features:**
  - `WorldEnvironment` subclass that auto-creates `SunLight` (DirectionalLight3D), `MoonLight`, `SkyDome`, `TimeOfDay`.
  - Sun/moon/stars with moon phases, Milky Way + StarField textures (`assets/thirdparty/textures/milkyway/`, `moon/`).
  - Dynamic atmosphere via `SkyMaterial.gdshader` + `AtmFog.gdshader` (scattering, Mie, Rayleigh).
  - Time management: `current_time` 0-23.99, `minutes_per_day` (Witcher 3 uses 96), `update_interval`, `game_time_enabled`, `editor_time_enabled`, date (year/month/day), leap year, UTC, latitude/longitude, `CelestialMode` SIMPLE vs REALISTIC orbital mechanics (`OrbitalElements.gd`, `TOD_Math.gd`, `ScatterLib.gd`).
  - Lighting consolidation: `camera_exposure`, `tonemap_exposure`, `skydome_energy`, `cloud_intensity`, `sun_energy`, `sun_shadow_opacity`, `sky_contribution`, `ambient_energy`, `night_sky_contribution`, etc.
  - Overlays: azimuthal/equatorial grids for debugging.
  - Compatibility renderer note: `Sky Contribution = 0.75`, `Fog Density = 0.01` (applied in `test_yard.gd`).

- **License:** MIT, plus third-party star/moon textures with separate LICENSE.md (must credit if used commercially — fine for non-commercial fan project).

## What we did now

1. Cloned `https://github.com/TokisanGames/Sky3D` @ main (2.1) and copied `addons/sky_3d/` into `.godot/addons/sky_3d/` (full addon: `src/`, `shaders/`, `assets/textures/`, `assets/resources/`, `assets/thirdparty/`).
2. Enabled in `.godot/project.godot`:
   ```
   [editor_plugins]
   enabled=PackedStringArray("res://addons/sky_3d/plugin.cfg")
   ```
3. Replaced `test_yard.tscn` `WorldEnvironment` + `Sun` with `Sky3D` node (script `res://addons/sky_3d/src/Sky3D.gd`), set `sky_contribution=0.75`, `current_time=8.0`, `minutes_per_day=15.0`.
4. Added `_configure_sky3d()` in `test_yard.gd` to set `skydome.fog_density=0.01` for Compatibility and dawn time 6.5 for Neverwinter muster-yard.

## Implementation plan for DELVE

### Phase 0 — Done: Vendor + enable + test yard
- [x] Addon present, enabled, yard runs with Sky3D.
- Smoke test still passes (ground white albedo check unchanged, child count 4).

### Phase 1 — Neverwinter dawn staging (menu + yard)
- Set realistic location: latitude ~ 43°N (Neverwinter approx), longitude ~ -something, UTC offset. Use `TimeOfDay` to compute sun altitude at 06:30 dawn.
- `current_time = 6.5`, `minutes_per_day = 15` (paused in menu, slow in yard). `game_time_enabled = false` in menu, true in yard.
- Tune `sun_energy`, `ambient_energy`, `sky_contribution` for Compatibility to match web panorama `yard_dawn_panorama.jpg` mood (warm horizon tint `atm_horizon_light_tint`).
- Keep backdrop 2D panorama for menu, but use Sky3D for 3D yard only — avoids performance cost in UI.

### Phase 2 — Clouds as weather proxy
- Map gameplay weather states to cloud coverage:
  - Clear: `cirrus_coverage 0.2`, `cumulus_coverage 0.15`
  - Overcast: `0.7` / `0.65`
  - Storm: `0.85` / `0.8` + higher `fog_density`
- Drive `wind_speed`/`wind_direction` from `GameState` or random events; clouds velocity `_cloud_velocity = dir * speed * 0.01` already in `SkyDome`.
- Expose in Options → Graphics: "Cloud quality" → toggles `clouds_enabled`.

### Phase 3 — Fog and atmosphere
- Use `fog_enabled` + `AtmFog` shader for depth in yard. For Compatibility, keep `fog_density 0.01-0.03`.
- Tie to gameplay: fog affects perception checks, ranged disadvantage.

### Phase 4 — Time progression and rest
- Pause `TimeOfDay` during pause menu (`sky3d.pause()`).
- Long rest advances `current_time` by 8h, short rest 1h, via `tod.current_time += hours`.
- Day/night detection: `sky3d.is_day()` / `is_night()` → affects stealth, darkvision, shop schedules.
- Persist time in `GameState` save (`delve_v1.json`) as `world.time`.

### Phase 5 — Weather extension (since Sky3D lacks precipitation)
- **Sky3D does NOT include rain/snow.** Build custom `Weather` node:
  - `GPUParticles3D` for rain/snow, material with wind influence.
  - Wetness shader on ground (increase roughness, darken albedo).
  - Audio: rain loop.
  - Drive via `wind_speed` from Sky3D + new `precipitation` enum.
- Integration: `WeatherManager` reads `sky3d.wind_speed/direction` and sets particle velocity.

### Phase 6 — Lighting and exposure
- Use `camera_exposure` + `tonemap_exposure` to handle interior/exterior transitions (cave mouth vs yard).
- Connect `Camera3D.attributes = sky3d.camera_attributes` for auto-exposure.
- High contrast option modulates `ambient_energy`.

### Phase 7 — Performance and Web
- Compatibility renderer is WebGL2-safe, but Sky3D shader is heavier than flat white. Keep `update_interval = 0.1` for Web (instead of 0.016) to reduce CPU.
- For Web export, optionally disable `cumulus_visible` on low quality preset.
- Terrain3D (future) + Sky3D: Sky3D works with Terrain3D demo; share same `WorldEnvironment`.

### Phase 8 — Future: Full campaign
- Each adventure map gets its own `Sky3D` config resource (e.g., `worlds/neverwinter/sky.tres`).
- Day/night + weather affect encounters (goblins at night, etc.).

## Summary answer

- **Sky3D is now in repo** at `.godot/addons/sky_3d/` (full, MIT, 2.1).
- **Includes:** sun, moon, stars, moon phases, atmosphere, fog, cirrus/cumulus clouds, wind (speed/dir) driving clouds, time/date, orbital mechanics, exposure controls.
- **Does NOT include:** rain, snow, storms, lightning — only wind as weather proxy. Precipitation must be built separately.
- **Plan above** shows how to use it for DELVE's dawn yard and future campaign without breaking Compatibility/Web.
