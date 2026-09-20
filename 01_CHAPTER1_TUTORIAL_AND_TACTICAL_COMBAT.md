# PHANDELVER AND BELOW: THE SHATTERED OBELISK — GAME DESIGN DOCUMENT 01
## Prologue Tutorial (Neverwinter Training Yard) · Chapter 1 "A Dangerous Journey" · Turn-Based Tactical Combat · Natural Terrain + Invisible Rules Grid · Camera Specification

**Version:** 2.2 (Chapter-1 Vertical Slice Spec)
**Game title:** **DELVE** (product name locked 2026-09-19). Shell spec (logo / main menu / loading): `02_DELVE_SHELL_SPEC.md`. Neverwinter yard complete build spec: `03_NEVERWINTER_YARD_LEVEL_SPEC.md`.
**Status:** ACTIVE — this document is the binding specification for the first playable campaign slice.
**Supersedes:** `00_ART_DIRECTION_AND_MECHANICS_PLAN.md` §1.5 (camera) and §2.3 (timing model) are **REPLACED** by §3 and §4 below. All other sections of v0.9 (art direction "Lit Miniature", three-layer architecture d20core/data/presentation, Roll Moment dice theater, Director layer, Resonance/madness systems, fail-forward dialogue) remain in force and are referenced here without repetition.
**Source of truth for content:** `/home/user/uploads/Phandelver and Below_ The Shattered Obelisk.md` (Chapter 1 = lines 235–551), `/home/user/uploads/Player's Handbook (2024) (1).md`, `/home/user/uploads/Dungeon Master's Guide (2024).md`, `/home/user/uploads/image-1.png` (Goblin Warrior statblock). Per project direction this is a **non-commercial fan work**; adventure text, read-aloud boxes, statblocks and treasure are used **verbatim**.
**Prototype history:** the Phase-0 web prototype was **retired and deleted on 2026-09-19** by product decision. Its real-time timing model survives **only as specification** for the optional Skirmish Mode (§4.13), to be implemented fresh if and when that mode is greenlit.

---

## 0. LOCKED DECISIONS (product direction, not open for debate)

| # | Decision | Specification section |
|---|----------|----------------------|
| D1 | Full 3D game, "Lit Miniature" painterly-real art direction, Unreal Engine 5.7 | v0.9 §1 |
| D2 | **Default camera = BG3-style over-the-shoulder / over-the-head third person.** Switchable to **first person** and back at any time outside cinematics. | §3 |
| D3 | **Ground is natural terrain.** No visible grid, no grid-snapped scenery. The 5-ft grid exists **only as an invisible rules layer** used for movement budgets, reach, range, cover, AoE and targeting previews. | §2 |
| D4 | **Tactical combat is turn-based by default** (BG3-style initiative queue, per-actor turns). Real-time combat exists only as a **secondary, opt-in mode**. | §4 |
| D5 | Tactical depth is the focus: positioning, cover, elevation, stealth, alert states, hazards, reactions. Every Chapter-1 location is designed as a tactics puzzle first. | §4, §7 |
| D6 | Scope of this document: **Prologue tutorial + Chapter 1 only** ("A Dangerous Journey", including the Cragmaw Hideout dungeon H1–H8). Chapters 2–8 are out of scope except where flagged as forward hooks. | §6, §7 |
| D7 | The game opens on a **main menu with a Play button**. Play launches the **Neverwinter training-yard tutorial**: in-world character creation (player physically present in the world), practice yard with training dummies, **Gundren Rockseeker as the voiced guide**, then departure down the trail into the adventure's opening scene. | §6 |
| D8 | D&D 2024 ruleset kept and gamified: ability checks/saves/attacks resolve on a real d20 simulation core; dice are visible (Roll Moment); rules text is surfaced in an in-game Codex verbatim. | §4, §8, v0.9 §2 |

---

## 1. HOW TO READ THIS DOCUMENT

- **Verbatim adventure content** appears in blockquotes (`>`) exactly as printed in the book, including read-aloud boxes. These are the strings the game ships (voiced or displayed).
- **[SIM]** tags mark rules handled by the d20core simulation layer (deterministic, headless-testable).
- **[PRES]** tags mark presentation-layer behaviour (camera, VFX, audio, animation).
- **[DATA]** tags mark content authored in data files (encounters, dialogue trees, loot tables, trap definitions).
- **[HOUSE]** tags mark deliberate adaptations/house rules required by the video-game format. Each carries a *tuning knob* name so balance can be changed without code edits.

---

## 2. WORLD RULES LAYER — NATURAL TERRAIN, INVISIBLE GRID

### 2.1 Principle

The world is authored as continuous, natural geometry: rolling trail ruts, cave floors with real slopes, streams, rubble piles, tree roots. **Nothing in the scenery snaps to a grid.** The grid is a pure data structure — a uniform 5-ft lattice projected onto the navmesh — queried by the rules engine. Players see terrain; the engine sees cells.

### 2.2 The RulesGrid component [SIM]

- Lattice: uniform squares, side = 5 ft = 1.524 m, aligned to each scene's authored axes (one lattice per combat/exploration scene, origin at the scene anchor point).
- API (headless, unit-tested in `d20core`):
  - `cellAt(worldPos) -> Cell` (feet-center of actor's capsule projected down)
  - `worldCenter(cell) -> worldPos` (used only for path smoothing and VFX, never for scenery)
  - `stepsBetween(a, b) -> int` (grid step count = rules distance in 5-ft units; diagonal = 5 ft per 2024 PHB grid convention)
  - `cellsInVolume(shape) -> Set<Cell>` for AoE
  - `coverCorners(from, to) -> CoverLevel` (four-corner raycast, §2.6)
- Actors store a **continuous transform** (what renders) and a **rules cell** (what adjudicates). The two are reconciled every frame; a rules cell change is what triggers opportunity-attack windows, aura membership, and trap trigger volumes.

### 2.3 Movement: continuous walk, rules-priced paths [SIM][PRES]

- **Exploration (out of combat):** free analog movement on the navmesh at walk/run speeds. No budget. Jumping/climbing use authored traversal volumes with Athletics/Acrobatics checks where the book calls for them (e.g., H3 chimney, H5 cavern walls).
- **Combat (turn-based):** the player paints a destination marker anywhere on natural ground. The engine computes a **cell path** (A* over the lattice with per-cell movement costs), prices it in feet, and checks it against the actor's remaining Speed. The actor then walks a **smooth spline through the cell centers** — the walk looks natural, the price is exact. [PRES] Foot-placement IK handles slopes/rocks so the walk never looks grid-locked.
- Path preview: a soft dust/light ribbon on the ground (diegetic: kicked dust, frost breath, disturbed leaves), **not** painted squares. Cost shown in feet in the movement HUD. If the marker exceeds budget, the ribbon fades at the budget limit with a subtle "not enough movement" pulse. [HOUSE knob `movement_preview_style`: dust | faint-lattice | off]
- Splitting movement, moving between attacks, and moving after attacks are all allowed (2024 rules). The ribbon recomputes live.
- **Dash** adds Speed to the budget; **Disengage** suppresses opportunity attacks for the turn; **Difficult terrain** doubles cell cost (see §2.4).

### 2.4 Difficult terrain [SIM][DATA]

Authored as **volume tags on natural geometry**, never as tinted tiles:
- Book-mandated volumes in Chapter 1: briar thickets (H1/H2, "difficult terrain… three-quarters cover"), H4 western passage rubble slopes ("5 feet of extra movement" = +5 ft per cell entered [SIM: cost 10 ft/cell]), stream wade (H1, 2 ft deep — priced as difficult terrain while wading [HOUSE]), pit interior, rubble fields.
- Generic authored volumes: knee-deep water, scree, dense undergrowth, corpse-cluttered ground (post-battle), snow drifts (later chapters).
- Presentation: geometry and VFX sell it (brush snagging ankles, sliding scree audio), plus an optional accessibility outline. [HOUSE knob `difficult_terrain_outline`: off | subtle | on]

### 2.5 Elevation [SIM][HOUSE]

- Real height in feet from the rules lattice datum (terrain is genuinely 3D: H4's climbing passage, H5's 20-ft overpass, H6's 10-ft escarpment, H3/H8's 30-ft chimney).
- Ranged height rule (BG3-flavoured house rule, kept from v0.9 §2.6): attacker ≥10 ft **above** target → Advantage on ranged attack rolls; attacker ≥10 ft **below** → Disadvantage. Melee reach across height differences uses total path (climb) distance, not horizontal steps. [HOUSE knob `height_advantage`: bg3 | off | strict-los-only]
- Falling: 1d6 bludgeoning per 10 ft fallen, Prone on landing [SIM], per PHB; book-specific falls (bridge collapse 2d6, chimney 1d6, snare 1d6) override locally [DATA].

### 2.6 Cover — physical, authored, raycast [SIM][DATA]

- Cover is computed from **real geometry**: four-corner raycast between attacker and target cells against the collision mesh, classified by how many corners are obstructed (½ cover = 1–2 corners, ¾ cover = 3 corners, full = 4).
- Authored **cover volumes** guarantee book-mandated values regardless of mesh detail:
  - Briar thickets (H1/H2) = **three-quarters cover** through them (verbatim book value).
  - Klarg's supply piles (H8) = **half cover** (verbatim).
  - Stalagmites (hideout general features) = half cover behind, authored per-prop volumes.
  - Wagon, crates, horse bodies, dams, escarpment lip = authored volumes.
- Cover indicators are diegetic: a shield-icon pip on the target reticle (1 pip = half, 2 pips = three-quarters), plus the AC breakdown in the targeting tooltip ("AC 15 + 2 cover = 17"). No painted outlines by default. [HOUSE knob `cover_outline`: off | on-hover | always]

### 2.7 Line of sight & light [SIM]

- LOS = raycast against **sight-blocking volumes** (cave walls, closed doors, giant stalagmite columns). Foliage and thickets block neither sight nor light but grant cover (as above) — matching the book (goblins shoot *through* thickets).
- Darkness/darkvision/light sources per 2024 rules: H4 onward requires light or darkvision (verbatim: "From this point on, characters without darkvision will need a light source"). Light is a physical thing in presentation (lantern cone, torch flicker, darkvision desaturation filter) and a rules thing in simulation (Heavily Obscured → Blinded mechanics).
- The H4/H5 "spot the bridge guard" checks are passive-Perception gates in the Director layer (§7.5), presented as a perception "glint" VFX on the guard when passed.

### 2.8 Areas of effect in continuous space [SIM][HOUSE]

- Spell/effect volumes (sphere, cube, cone, line, cylinder) are true 3D volumes rendered as translucent energy in presentation.
- Affected set = every rules cell whose **center** lies inside the volume (deterministic, testable), unioned with any actor whose physical capsule overlaps the volume by ≥50% (prevents "standing on a cell corner" cheese). Targeting preview shows affected ground as a soft glowing footprint with particle edges — never a grid stencil. [HOUSE knob `aoe_cell_rule`: center | capsule-overlap]
- Total cover blocks AoE only where the book/PHB says (e.g., *spread* effects ignore it; direct lines don't). Cone/line origins are the caster's continuous position, direction = aim vector snapped to the nearest lattice bearing for determinism.

### 2.9 Optional grid display [HOUSE]

Because some players want the table feel: `Options → Display → Rules Grid` = **off (default) | on-hover while targeting | always**. When on, a faint holographic lattice appears *only on the ground plane under the current targeting/movement preview*, dissolving when idle. The world itself never contains grid geometry.

### 2.10 Traps and interactables as physical objects [DATA][SIM]

Every trap/snare/hazard is a real object in the world (ropes, camouflaged pit lid, dam supports, fire pit coals) with:
- a **trigger volume** (rules-cell based),
- a **detection gate** (passive Perception threshold or active Search check),
- a **resolution payload** (saves, damage, conditions — verbatim book numbers),
- an **interaction set** (disarm, bypass, trigger-on-purpose, use-as-weapon).
Presentation sells detection diegetically: a faint shimmer/glint on noticed traps, a Codex card with the verbatim rule text, and the Roll Moment dice theater for the save.

---

## 3. CAMERA SPECIFICATION

### 3.1 Default: over-the-shoulder third person ("Table View")

- BG3-style follow camera: pivot behind and above the controlled character's right shoulder, boom length 3.2–4.5 m (context-driven), height offset +1.9–2.6 m, slight downward pitch (≈18–25°) so the battlefield reads as a diorama — the "Lit Miniature" framing from v0.9.
- Collision: spring-arm with terrain/wall avoidance; when occluded, the camera rises toward over-the-head ("god-shoulder") rather than cutting to top-down. Max pitch clamp 55° down / 5° up.
- Player controls: free orbit around the character (right-stick / mouse-edge), zoom wheel, double-tap zoom = tactical wide shot (boom 6 m, pitch 40°) for reading encounters.
- In combat turns the camera keeps the same grammar but biases to frame **both** the active actor and the current target/destination marker (soft two-shot framing), so tactical context is always visible without manual orbiting. [PRES knob `combat_framing`: auto-two-shot | follow-actor | manual]

### 3.2 First-person toggle ("Eyes View") — full parity

- Toggle key `V` (and stick combo on pad) swaps instantly between Views in exploration, dialogue and combat; no loading, no mode change, no rule change.
- First person = eye-height capsule camera on the same actor; all targeting, cover pips, movement ribbons, AoE footprints and dice theater render identically (reticle-anchored instead of cursor-anchored).
- Aim assist: ranged/spell aiming in first person shows the same predicted cover/LOS outcome as third person (the simulation is camera-independent by construction — §2 guarantees this).
- Restrictions: none in gameplay; only locked during authored cinematics and the dice-theater close-ups (which return to the prior view afterwards).
- [HOUSE knob `first_person_enabled`: full (default) | exploration-only | off] — see Open Question Q2.
- Comfort: vignette off by default, FOV 90–110 slider, head-bob off by default, camera shake slider, snap-turn option for pad.

### 3.3 Per-context camera table

| Context | Default View | Behaviour |
|---|---|---|
| Exploration | 3rd-person shoulder | as §3.1 |
| First-person toggle | 1st-person | as §3.2, instant swap both ways |
| Dialogue | 3rd-person | BG3-style conversation framing: slow orbit around speaker cluster, speaker portrait + voiced line; player may break to free camera after 2 s |
| Enemy turn (turn-based) | 3rd-person | cinematic follow of acting enemy at `enemy_turn_pace` speed; never first-person during enemy turns unless player opted into "watch from my eyes" [HOUSE] |
| Reaction interrupt | slow-mo 3rd-person | 0.35× time, camera swings to frame trigger (e.g., enemy leaving reach), reaction card overlays |
| Roll Moment (dice theater) | dice close-up | v0.9 §2.2: physical die tumble in foreground of the action; returns to prior view |
| Trap trigger | 3rd-person punch-in | quick push-in on the trap object (snare line, pit lid, dam) then outcome |
| Rest / camp | 3rd-person wide | slow drift, warm light |
| Tutorial beats | 3rd-person guided | camera gently leads the eye to the station/dummy; Gundren bark subtitles bottom-center |

### 3.4 Why this serves tactics

Third-person-shoulder keeps the actor's body and the ground around it in frame — cover lines, elevation and enemy facing are readable at a glance, which is what turn-based positioning play needs. First-person is preserved for immersion and aimed shots (archery lane in the tutorial teaches both). Because all rules queries go through the RulesGrid/geometry (§2), **both cameras always show identical truth** — no camera has privileged or degraded information.

---

## 4. COMBAT: TURN-BASED DEFAULT ("TABLE MODE"), REAL-TIME OPTIONAL ("SKIRMISH MODE")

### 4.0 Design statement

The user direction is explicit: real-time-as-default was "too quick and confusing". Therefore the **default combat mode is fully turn-based**, in the lineage of Baldur's Gate 3: an initiative queue, one actor acting at a time, complete information, deliberate decisions, cinematic presentation of every roll. Real-time returns only as an opt-in secondary mode for players who want speed (§4.13), implemented from the prototype's already-tested model.

### 4.1 Entering combat & surprise [SIM]

- Combat starts when **hostile intent is revealed**: an attack roll, a detected ambush springing, a declared hostile action in dialogue, or a trap that rolls initiative (book traps like the snare resolve immediately, then combat may begin).
- Surprise per 2024 rules: surprised actors roll initiative but **skip their first turn** (no action, bonus action, reaction until that turn ends). Stealth-vs-passive-Perception contests at encounter start decide it (e.g., H2 goblins shooting through thickets "probably catching the characters by surprise"; H6 approach DC 14 Stealth).
- [PRES] Transition: a 0.8 s "battle sting" — audio swell, colour grade shift, initiative ribbon slides in. No screen wipe; the world stays continuous (you can see exactly where everyone was).
- [HOUSE] "Soft engagement": if an enemy spots the party but the party hasn't acted, the Director may offer a **pre-emptive round** (position + first strikes) instead of instant combat — this is how the book's stealth approaches (H2, H5, H6) become tactical openings rather than binary rolls.

### 4.2 Initiative & the turn queue [SIM][PRES]

- Initiative = d20 + DEX mod, rolled in the Roll Moment dice theater for player characters and companions; enemies roll visibly too when `enemy_turn_pace ≠ instant`.
- Ties: player-controlled actors win ties vs enemies; among players, higher DEX, then player order. [SIM]
- **Initiative ribbon** (top-left, BG3-style): portrait tokens in order, current actor highlighted, hazard/event tokens inserted where scheduled (e.g., "FLOOD — goblin initiative count" §7.5 H7), round counter at the head. Hover a token → tooltip with remaining HP/conditions/concentration.
- Controlled-actor turn banner: name + class icon + remaining Action/Bonus/Reaction/Speed pips.

### 4.3 Anatomy of a turn [SIM]

Each actor's turn grants, per 2024 PHB:
1. **Speed** (movement budget, splittable, priced per §2.3–2.4)
2. **One Action** (Attack, Magic/Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Utilize, Opportunity attacks are reactions not actions…)
3. **One Bonus Action** (only if a feature/spell grants one — e.g., goblin Nimble Escape, two-weapon Light/Nick, Healing Word, Misty Step)
4. **One Reaction** (refreshes at the **start of the actor's own turn**, 2024 rules)
5. **One free object interaction** (draw weapon, open door, pick up light object) — second interaction costs the Utilize action.
- UI: action bar bottom-center with radial expanders; each ability card shows verbatim rule text on hover (Codex link), cost icons (A/BA/R/Free), range, and predicted outcome ("+4 to hit vs AC 15 · 62% · 1d6+2 slashing, +1d4 if Advantage").
- **Percentages shown by default** (tactical clarity), toggleable. [HOUSE knob `show_hit_chance`: on | off]
- End Turn button + `auto_end_turn` option (ends when no usable resources remain and no movement pending).

### 4.4 Movement inside turns, opportunity attacks, facing [SIM]

- Leaving an enemy's **reach** without Disengage triggers an opportunity attack (reaction). In Table Mode this is surfaced **before** it happens: the movement ribbon turns amber along the segment that leaves reach, with a sword icon at the exit cell.
- No facing cones (2024 rules have none); stealth-facing for Hide is handled by LOS/obscurement only. [HOUSE: none — keep rules-pure]
- Forced movement (Push mastery, flood surge, Thunderwave) moves actors along cell paths with continuous presentation (stumble animation), provoking nothing.
- Prone/Restrained/Grappled interact with the movement budget per rules (half speed, 0 speed, stand = ½ Speed).

### 4.5 Reactions & interrupts [SIM][PRES]

- When a trigger occurs during any turn, every actor with an available Reaction and a matching trigger is queried:
  - **Player-controlled actor:** time dilates to 0.35×, camera frames the trigger, a reaction card slides up ("OPPORTUNITY ATTACK — Scimitar +4 vs goblin fleeing · [React] [Pass]"), 6 s default decision timer (off in Story difficulty). Passing is remembered per-trigger-type via `reaction_policy` (always ask / auto-take / auto-pass per reaction type).
  - **Companion/enemy AI:** resolves instantly per profile, with a toast + dice theater at chosen pace.
- Ready action: player sets trigger phrase from presets ("when an enemy enters the doorway", "when the goblin shoots") — stored as an event predicate in SIM.
- Shield spell, Counterspell, Hellish Rebuke, Opportunity Attack, Nimble Escape-as-reaction homebrew are **not** added; only rules-legal reactions ship.

### 4.6 Weapon masteries inside the turn flow [SIM][DATA]

2024 masteries (verbatim, PHB "Mastery Properties") are first-class tactical verbs, each with its own targeting step where needed:
- **Cleave** — after a hit, free second melee roll vs adjacent creature (once/turn).
- **Graze** — on a miss, deal ability-mod damage of the weapon type (turns misses into pressure; UI shows "Graze: 3 damage even on a miss").
- **Nick** — Light-weapon extra attack folded into the Attack action.
- **Push** — hit → push 10 ft straight away (Large or smaller). *Tactical gold near pits, bridges, fire pits, floods.*
- **Sap** — hit → target has Disadvantage on its next attack roll before your next turn.
- **Slow** — hit + damage → target Speed −10 ft until your next turn.
- **Topple** — hit → CON save (DC 8 + mod + PB) or Prone. *Pairs with the book's prone-heavy hazards.*
- **Vex** — hit + damage → Advantage on your next attack vs that target.
- Mastery selection UI: per-weapon mastery is fixed by the weapon table (§8.2); characters with the Weapon Mastery feature have all their weapons' properties live; the tutorial teaches each on the dummies (§6.2 T7).
- Enemies use masteries too (goblin scimitars = Nick; their advantage-bonus-damage is a statblock trait, §8.1) — AI weights them situationally (Push near ledges, etc.).

### 4.7 Conditions, durations, concentration [SIM]

- Conditions per 2024 glossary (Prone, Restrained, Poisoned, Frightened, Grappled, Incapacitated, Blinded, etc.) with iconography on portraits and world-space pips over heads.
- Duration bookkeeping at turn boundaries: "until the start of your next turn", "end of your next turn", save-ends (save rolled in dice theater at the actor's turn end, visibly).
- Concentration: concentration ring on the portrait; damage → CON save (DC 10 or half damage) in dice theater; breaking is narrated (spell fizzles VFX).
- The snare's "Restrained until 1 point of slashing damage deals to the cord" is modelled as a **condition source object** (the cord has HP 1, immune to non-slashing) — attack the cord, not the check. [SIM][DATA]

### 4.8 Enemy turn presentation & pacing [PRES][HOUSE]

`enemy_turn_pace` options:
- **cinematic (default):** camera follows each enemy action; attacks play full animations with dice theater; ~2.5–4 s per enemy action; player can fast-forward (hold button) or click the ribbon token to jump to own turn.
- **brisk:** animations truncated at impact frame; ~1.2 s per action.
- **instant:** results compile into a compact combat-log popover ("Goblin ×2 attacked Sildar: hit 7, miss; wolf moved 15 ft"), 0.6 s.
- Enemy intent is **not** pre-revealed (no Into the Breach telegraphs) except where the book telegraphs (flood knocking, Yeemik's threat) — tension comes from reading positions, cover and alert state, which the camera and grid-preview make legible.

### 4.9 Stealth, hiding and surprise in Table Mode [SIM]

- Hide action: DEX (Stealth) vs observers' passive Perception (or active Search). Success = Invisible-for-rules-to-those-observers; attacking breaks it (first attack with Advantage).
- Group stealth (book's "lowest check is the DC" for trail/approach) implemented as a **group check min-value** with per-character roll theater.
- Hide spots are authored volumes (thickets, behind supply piles, shadow pools from light sources); the world shows them subtly (drift of leaves, shadow gradient) and the Codex lists them once discovered.
- The tutorial's stealth lane (§6.2 T10) and H2/H5/H6 approaches are the showcase: surprise round = free tactical opening (Advantage on all opening attacks, surprised enemies skip turn 1).

### 4.10 Hazards & environment as combat participants [DATA][SIM]

Chapter 1 ships the full hazard kit, each with initiative-ribbon tokens when scheduled:
- **Flood (H7→H1):** two-stage, telegraphed (goblins knock supports: audio + debris VFX for 1 round), then resolves on goblin initiative count as a ribbon hazard token. Saves verbatim (§7.5 H7).
- **Rope bridge (H5):** destructible object AC 5 / HP 10, vulnerability fire & slashing; collapse = DC 10 DEX save or 2d6 + Prone. Players can shoot it out *under* enemies — a authored tactical win-con.
- **Fire pit (H8):** zone damage 1 fire on enter / 3 (1d6) if knocked Prone into it, once per round — Push/Topple masteries combo with it (AI understands this too).
- **Unstable ledge (H4):** DC 10 Acrobatics on move/melee in the space or collapse: DC 10 DEX save 2d6 + Prone to all in east half.
- **Snare / pit (trail):** as §2.10 objects.
- **Wolf frenzy (H3):** chained wolves make the book's escalating DC 15→10 Strength checks per round while provoked — represented as a countdown token on the ribbon ("WOLVES STRAIN 1/2").
- Every hazard is usable by both sides; the AI has utility weights for them (bugbear Klarg will Push into the fire pit if it benefits).

### 4.11 Damage, unconsciousness, non-lethal, death [SIM]

- 0 HP → unconscious + dying per 2024 rules; death saves rolled in dice theater (party-visible tension moment, camera on fallen body).
- **Non-lethal toggle:** per melee attack with a bludgeoning source (including unarmed), a "Knock Out" toggle on the attack card implements the book's capture rule verbatim ("succeeding if the attack deals enough damage to drop the goblin to 0 hit points"). Captured enemies become interrogatable dialogue NPCs (§7.2).
- Enemies at 0 HP from non-bludgeoning damage die (gib-free, tasteful fall animations; project is T-rated).
- The book's "goblins fight to the death until one remains, then it flees" is a **morale script** per encounter [DATA], with the fleeing goblin's escape route as a tactical objective (catch it → guaranteed trail discovery; miss it → trail still findable via DC 10 Survival per book, but the hideout is warned: alert state +1, §7.4).

### 4.12 Resting [SIM] (kept from v0.9 §2.5)

Short/long rest rules per 2024 PHB; rests are diegetic (camp bench in tutorial; cave-mouth campfire spots in Chapter 1 with risk: resting near the hideout raises alert). Hit Dice spent via dice theater; long rest only at safe authored sites.

### 4.13 Optional real-time mode — "Skirmish Mode" (secondary) [SIM][HOUSE]

- Offered at campaign creation and in Options: **Combat pacing: Table Mode (turn-based, default) | Skirmish Mode (real-time with pause)**. Switching mid-campaign allowed only between chapters (state parity guaranteed because both modes run the same d20core; only the scheduler differs).
- Skirmish Mode = an initiative-as-resource-window real-time scheduler (pausable, beat-based AI), implemented fresh from this specification when greenlit (the Phase-0 prototype that originally proved this model out was retired 2026-09-19). It reuses identical statblocks, masteries, reactions (as timed interrupts), and hazards (as telegraphed timers).
- Balance parity: encounter tuning targets Table Mode; Skirmish Mode gets a global AI reaction-time handicap slider instead of number changes.
- All tutorial teaching moments have Skirmish variants (same beats, timed prompts) so mode-switchers aren't lost.

---

## 5. PARTY, COMPANIONS & CONTROL MODEL

### 5.1 Party composition [DATA][HOUSE]

- **The player creates one protagonist** in-world (§6.1) and adventures **solo by default** — the lone-hero action-adventure feel is the campaign's baseline tuning (confirmed product decision, 2026-09-19).
- **Recruitable companions appear throughout the campaign** as world NPCs with their own quests and recruitment conditions: Chapter 1 offers **Sildar Hallwinter** after his rescue (§7.6); later chapters add further original and book NPCs, several tied to the verbatim *Character Hooks Tied to Backgrounds* table. Recruited companions join and part at camps; **active party cap = 4** (protagonist + up to 3).
- With companions present, their turns use the confirmed hot-swap control model (§5.2). Solo play is Director-tuned to solo scale: action-economy compensation via elite adjustments and mook counts — **never raw HP inflation**. [HOUSE knob `party_size`: solo-default | cap-4]
- Companion statblocks are level-appropriate PHB builds (sidekick-simple at Ch1: fixed builds, no multiclass), each with 2 masteries showcased and one signature reaction.

### 5.2 Turn control in Table Mode [HOUSE] (default = BG3 model)

- On each party member's initiative turn, **control hot-swaps** to that character automatically (camera glides), with the option to manually hold control order (`turn_handoff`: auto-follow-initiative | manual-queue).
- Player may issue **orders** to companions whose turn it isn't (move marker, "hold", "attack target X") that execute on their turn unless overridden.
- Companions not currently controlled and not ordered run their AI profile (aggression, positioning preferences, spell priorities, reaction policy).
- Open Question Q1 confirms this vs. pure-order model.

### 5.3 Orders & AI profiles [SIM][DATA]

Per companion: stance (Aggressive / Steady / Guarded / Custom), positioning hint (melee line / ranged high ground / backline healer), auto-reactions policy, spell auto-use list (e.g., healer auto-H ealing Word below 40% HP), and a "call out" bark set. All surfaced in a Companion panel (diegetic: contract ledger).

### 5.4 Temporary companions [DATA]

- **Sildar Hallwinter** joins post-rescue per book (1 HP start, gearless; can take a goblin shortsword; escort offer 50 gp verbatim). Implemented as the campaign's **first recruitable companion**: player chooses at camp whether he stays on as a party member or departs for Phandalin (both paths keep his escort-fee flag); controllable via hot-swap while in party, with the "anxious to reach Phandalin" urgency flavour (comments on dallying; never blocks progress).
- Captured-goblin **guide mode** (book: persuaded goblin leads party past traps): a leash-follow NPC that auto-disarms trail traps while alive and loyal; loyalty is a hidden meter broken by party cruelty or failed checks.

---

## 6. PROLOGUE — "THE ROCKSEEKER CONTRACT" (NEVERWINTER TRAINING YARD)

### 6.0 Boot flow & main menu [PRES]

- Cold boot → title screen: the **DELVE** logo over a live slow camera drift through the Neverwinter muster yard at dawn (full shell specification — logo, menu, options tree, loading screen: `02_DELVE_SHELL_SPEC.md`), menu options:
  **PLAY · CONTINUE · OPTIONS · CODEX · CREDITS**
- **PLAY** (new game) → no character-creation wizard screen. Fade from black directly into the world: the player character already exists in it as a **contract recruit standing at the gate of the Neverwinter muster-yard**, hooded and unfinished — creation happens **diegetically, in-world, with the body present** (§6.1).
- CONTINUE → chapter select of save slots (saves are serialized d20core state + Director flags).
- First-run options prompt (accessibility, colourblind, subtitles ON by default, camera comfort, **combat pacing default = Table Mode**, difficulty = Balanced).

### 6.1 In-world character creation (stations, not screens) [PRES][DATA][SIM]

The muster-yard is a small walled training ground behind the Neverwinter docks: gatehouse, muster desk, arms rack, spell lectern, mirror/tack room, dummy line, archery lane, brush stealth lane, sparring circle, rest bench, and the contract table where Gundren waits. **Scope rings:** R0 = yard interior (fully playable); R1 = gatehouse forecourt + short dock lane (playable threshold); R2 = the city of Neverwinter itself = layered vista only, never entered in this campaign. The yard's **complete, build-from-nothing spec** — coordinates, props, model/texture/audio/VO lists, triggers and inline rules payloads — is `03_NEVERWINTER_YARD_LEVEL_SPEC.md`; this section remains design intent only. Creation = walking the yard and touching its stations in any order (guided order suggested; all skippable/revisitable until signing).

| Step | Station (in-world object) | What happens | Rules payload |
|---|---|---|---|
| C1 Species/lineage | **Muster desk ledger** — the clerk's open book; choosing flips its pages, and the player's body visibly changes in the world (clerk squints, comments) | Human, Elf, Dwarf, Halfling, Dragonborn, Gnome, Half-Orc, Tiefling (2024 PHB) | species traits applied to SIM actor |
| C2 Class | **Arms rack + spell lectern + prayer stone + shadow post** — four pedestals; touching one plays a 6-second hologram demo (fighter's cleave on a dummy, wizard's burning hands cone, cleric's ward, rogue's vanish) and equips the starting kit on the body | 4 launch classes at Ch1 slice: Fighter, Cleric, Wizard, Rogue (others unlocked later campaigns) | class features, Weapon Mastery grants, spell list |
| C3 Background | **Contract annex papers** pinned to the desk — the book's *Character Hooks Tied to Backgrounds* table **verbatim** as selectable letters of introduction | Acolyte…Soldier (12 rows verbatim) | background feat/skill proficiencies + hook flag wired into Ch1 dialogue |
| C4 Ability scores | **Clerk's abacus & dice cup** — point-buy beads, standard-array tokens on the ledger, or "roll like a adventurer" 4d6-drop-lowest in the dice theater | 2024 PHB methods | scores → modifiers live-update on a hanging tag on the character's belt (diegetic sheet) |
| C5 Appearance | **Polished shield mirror** in the tack room | face/body/voice presets; reflection updates live; first-person view available here to see yourself | cosmetic only |
| C6 Name & signature | **Contract table with Gundren** — he asks for the name; player types/speaks it; quill signs | name strings into all barks/subtitles | save-slot label |

- The **character sheet** itself is diegetic throughout: a leather folio on the belt (opens with `Tab`) showing verbatim rule text for every entry.
- Nothing is locked until the contract is signed at T5; players can re-walk stations after the dummy practice if they regret a build (generous, tutorial-friendly).

### 6.2 Tutorial beat sheet (Gundren-voiced) [DATA][PRES]

Voice direction for Gundren: warm, brisk, slightly conspiratorial dwarf merchant; proud of his brothers; hides his excitement badly. All lines voiced; subtitles default on. Lines below are the shipped bark script (original writing in the voice of the book's NPC).

| Beat | Station / trigger | Teaches | Gundren line (voiced) | Fail-forward / skip |
|---|---|---|---|---|
| T0 | Fade-in at yard gate; contract in hand | existence of menu→world flow | (none; ambient yard audio: gulls, hammering, a sergeant's count) | — |
| T1 | Walk prompt; camera orbit prompt | movement, orbit, zoom, tactical-wide double-tap | "There ye are! Mind the mud — the yard's seen worse boots than yours." | beacon wisps to next station (toggleable) |
| T2 | `V` prompt at the mirror lane | first-person toggle & back | "Ha! Look at yerself. Eyes front, chin up — that's an adventurer's face, or close enough." | remap prompt |
| T3 | **Dummy A** (straw sword-dummy on a post) | Attack action, to-hit vs AC, Roll Moment, crit, Action pip | "Give it a whack! Full swing, don't tickle it… THERE! See the die? That's the truth of every blow ye'll ever land." | auto-success after 2 misses (dummy "yields") |
| T4 | Dummy A, second phase | Bonus action, Light/Nick two-weapon flow, mastery callouts: Push (dummy slides on rails), Topple (dummy tips Prone), Sap/Vex icons | "Again — and follow through! A second cut for the bold. Now watch: a shield-bearer's push, a leg-sweep… weapons have *manners*, learn theirs." | mastery gallery repeatable at will |
| T5 | **Contract table** | signing, quest journal opens, payment promise (hook verbatim: ten gold pieces each at Barthen's Provisions) | "Ten gold each when the wagon lands at Barthen's in Phandalin. My brothers' find is worth a hundred wagons, but coin first, glory after — sign here." | journal auto-opens |
| T6 | **Archery lane** (hay-bale cover walls) | ranged targeting, cover pips (+2/+5), height platform (Advantage from loft), Vex on hit | "Bales stop arrows, walls stop fools. Shoot *over*, shoot *around* — or climb the loft and shoot *down*. High ground's a gift; take it." | infinite arrows in yard |
| T7 | **Brush lane** (thicket pockets + patrolling trainee) | Hide action, passive Perception, surprise round, Advantage from hiding | "Quiet now. If the lad never sees ye, yer first blow lands twice as true. That's not cheating, that's *craft*." | trainee's passive lowered after 3 fails |
| T8 | **Sparring circle** vs 2 trainees | FULL turn-based loop: initiative ribbon, turn order, move+action split, End Turn, reaction prompt (opportunity attack when trainee disengages wrongly), non-lethal toggle (spar = knock-out only) | "Blades down, fists up! First to yield wins my respect — and I yield to nobody. Mind yer turn, mind theirs, mind the moment between!" | trainees yield at 1 HP; no death possible |
| T9 | **Rest bench** (bread, water, dice cup) | short rest, Hit Dice recovery in dice theater, long-rest explanation | "Even heroes sit down. A breath, a bandage, a bit o' luck rolled back into yer veins — then up again." | — |
| T10 | **Pack & folio** | inventory, folio sheet, Codex (verbatim rules text), options (grid overlay, pacing) | "Yer kit, yer contract, yer head. Keep all three in order and ye'll keep yer life." | — |
| T11 | **Gate departure** | travel montage: High Road south (director-controlled coach ride with Gundren&Sildar banter establishing lore verbatim-flavoured), veer east onto Triboar Trail | "Sildar and I ride ahead — papers to file, friends to greet. Bring the wagon slow and steady. The Trail's been quiet lately. *Too* quiet, the superstitious say." | montage skippable (lore recap in journal) |
| T12 | Trail bend, half-day march | handoff to Chapter 1: player takes the reins or walks; ambush-site sightline appears | (Sildar waves from ahead in the distance; Gundren already gone) | — |

- **Veteran skip:** at PLAY, a "I know the rules — skip yard practice" option jumps from C6 signing straight to T11 montage (creation still in-world; only beats T1–T10 skipped).
- Every beat is replayable from the yard's **practice bell** (free-training sandbox retained as a hub feature: dummies, lanes, sparring respawn — the user's "practice yard" persists post-tutorial for build testing).
- Gundren never blocks a doorway, never fails a beat forward, and leaves a journal note if the player wanders off-yard ("Off exploring? The gate's that way, hero.").

### 6.3 Handoff into Chapter 1

T12 ends exactly at the book's opening: the company (protagonist + wagon + oxen, plus any recruited companions — none by default) rounds the bend onto **map 1.1**. The Chapter-1 opening read-aloud (verbatim, §7.1) plays as an in-world moment, not a cutscene: the camera is already in the player's chosen view.

---

## 7. CHAPTER 1 — "A DANGEROUS JOURNEY", FULL GAMIFIED ADAPTATION

### 7.0 Chapter state machine [SIM][DATA]

Flags (Director layer): `ch1.ambush_done`, `ch1.goblins_killed`, `ch1.goblin_captured`, `ch1.goblin_fled`, `ch1.trail_found`, `ch1.guide_goblin`, `ch1.snare_*`, `ch1.pit_*`, `ch1.alert` (0–3), `ch1.flood_used` (0/1/2), `ch1.sildar_state` (captive|rescued|dead|left), `ch1.yeemik_deal` (offered|accepted|betrayed|refused), `ch1.klarg_dead`, `ch1.hideout_cleared`, `ch1.supplies_flag` (Lionshield), `ch1.chest_looted`, `ch1.level2_granted`.

Chapter flow: **Ambush Site → (interrogate?) → Goblin Trail (traps) → Hideout H1 → H2/H3 branch → H4 → H5 (bridge/flood) → H6 (Sildar set-piece) → H7 → H8 (Klarg boss) → clear → level 2 → hooks to Ch2.** All branches from the book preserved, including skipping the trail entirely (go to Phandalin → Barthen sends you back, verbatim Development text).

Verbatim chapter framing shipped in the Codex prologue page:

> More than five hundred years ago, clans of dwarves and gnomes made an agreement known as the Phandelver Pact, by which they would share a rich mine in a wondrous cavern known as Wave Echo Cave. […] A mysterious villain known as the Spider controls a network of bandit gangs and goblin bands in the area, and his agents followed the Rockseekers to their prize.

(Character-advancement rule verbatim: "The characters should be 1st level when the chapter begins. The characters gain a level when they finish exploring the Cragmaw hideout." → implemented as milestone level-up cinematic on `ch1.hideout_cleared`.)

### 7.1 Scene 1 — The Road to Phandalin & the Goblin Ambush [DATA][SIM][PRES]

**Opening read-aloud (verbatim, displayed + voiced as ambient narration over the in-world moment):**

> You began your adventuring career in the city of Neverwinter. A dwarf named **Gundren Rockseeker** hired you to bring a wagonload of provisions to the rough-and-tumble settlement of Phandalin, a couple of days' travel south of the city. Gundren was clearly excited and more than a little secretive about his reasons for the trip, saying only that he and his brothers had found "something big," and that he'd pay you ten gold pieces each for escorting his supplies safely to Barthen's Provisions, a trading post in Phandalin. He then set out ahead of you on horse, along with a warrior escort named **Sildar Hallwinter**, claiming he needed to arrive early to "take care of business."
>
> You've spent the last few days following the High Road south from Neverwinter, and you've just recently veered east along the Triboar Trail. You've had no trouble so far, but you know this territory can be dangerous. Bandits and outlaws have been known to lurk along this road.

(Only the first paragraph is recap in the tutorial handoff — the player lived it; it replays in the journal as contract text.)

**Wagon system [SIM][DATA]:** the wagon + two oxen are a physics/light-vehicle object. "Any character can drive, no skill necessary"; reins dropped → oxen stop (verbatim). Cargo manifest verbatim as inspectable inventory (dozen sacks of flour; casks of salted pork; two kegs of strong ale; shovels/picks/crowbars ~dozen each; five lanterns + barrel of oil ~50 flasks; total value 100 gp) — each crate is lootable/usable (crowbar = Utilize on doors/chests; lantern = light source; ale keg = camp morale). Wagon can be parked off-road with oxen tied (verbatim) before pursuing the trail.

**Ambush-site staging (map 1.1 in world space):** bend in the trail; steep embankment + dense thickets both sides (difficult terrain, ¾ cover volumes); two riderless horses wandering (interactive: lead/release; identified as Gundren's&Sildar's on approach if `hook.meet_me_in_phandalin`); scattered arrows, torn fabric, looted saddlebags, empty leather map case (inspection beats).

**Ambush read-aloud (verbatim):**

> You've been on the Triboar Trail for about half a day and are nearing a side road leading south toward Phandalin. As you come around a bend, you stumble upon the scene of a recent battle. The woods press close to the trail here, with a steep embankment and dense thickets on either side. Two horses wander the road, sniffing at ransacked personal effects.

Then, on closer inspection (verbatim):

> The horses' saddlebags have been looted. An empty leather map case lies nearby.

**Encounter spec [DATA]:** 4 × Goblin Warrior (§8.1), two hidden per side in thickets (¾ cover), Stealth +6 vs party passive Perception as they approach the horses; **trigger: any character within 10 ft of the horses** (book: "They wait until someone approaches the horses and then attack"). Surprise round if party passive loses the contest. Positions authored for crossfire: opening volleys of shortbows (Vex) from cover, then scimitar rush on the wagon drivers; one goblin holds high embankment for height Advantage.
**Morale script (verbatim behaviour):** fight to the death until exactly one remains; that goblin Disengages (Nimble Escape) and flees northwest toward the trail. Catch-or-miss objective: intercept (grapple/shoot/down) → `ch1.trail_found` guaranteed + no warning; escape → hideout alert +1 and trail still discoverable via the Survival check below.
**Non-lethal capture (verbatim rule gamified):** any bludgeoning source (incl. unarmed) at 0 HP = unconscious captive with the Knock-Out toggle; captive wakes in minutes → interrogation (§7.2) and/or guide mode (§5.4).
**Development — party defeat (verbatim, kept):** goblins loot and leave party unconscious; party can regroup in Phandalin (Barthen's gear shop = Ch2 content gated as "trading post UI"), return to site, find trail. Implemented as a fail-forward respawn at last camp with cargo partially scattered (recovery side-quest flavour).
**Post-combat investigation beats [SIM]:** DC 10 Wisdom (Survival) (verbatim) → trail read: ~a dozen goblins came and went; two human-sized bodies hauled away. Journal updates with Sildar&Gundren missing. Horses decision (lead = slow march bonus flavour; release = ambient goodbye).

### 7.2 Interrogation — "What the Cragmaws Know" [DATA]

Dialogue tree with captive/ persuaded goblin; four knowledge nodes verbatim (paraphrased only in voicing, text verbatim in Codex card):
- **Bugbear Leader** (Klarg; reports to King Grol at Cragmaw Castle, ~20 miles NE in Neverwinter Wood — directions obtainable),
- **Capturing Gundren** (messenger from King Grol; "the Spider" paying for Gundren + his effects; map taken to King Grol),
- **Sildar's Location** ("eating cave", area H6; ~15 goblins in hideout),
- **Strange Goblins** (elongated skulls, glowing green weapons, cackle and leave; Cragmaws fear them — psi-goblin teaser for later chapters).
Persuasion gates: Intimidation (easy — goblin is cowardly), Persuasion (medium, needs food/kindness), Deception ("I'm with King Grol!") creative option; failures fail-forward (goblin clams up once, then cracks on second approach with a cost: it lies about one node — Director marks which; discovering the lie later is a Perception/Insight beat).

### 7.3 Scene 2 — The Goblin Trail (5 miles, two traps) [DATA][SIM]

- **No marching order — solo point character** (product decision 2026-09-19): the protagonist is always the point character; trap perception gates use the player's passive/active Perception (verbatim mechanic: "the character in the lead must succeed…"). Recruited companions walking behind never roll the gate; if a companion's passive Perception beats the player's, they emit a hesitation tell (a stopped step, a raised fist) that the player may act on by choosing to Search — flavour and choice, not a second roll. [HOUSE knob `companion_trap_tells`: on | off]
- Trail traversal uses the Journey Beats stride system (§14.4): an authored corridor ≈350 m of playable trail diegetically representing the book's five miles, with time-cards between beats.
- Trail is a playable wooded corridor (not a cutscene): ~10 min beats compressed by director pacing (travel stride + ambient dialogue barks from companions referencing captured-goblin warnings).
- **Snare (verbatim numbers):** hidden 10 min in; if searching, lead DC 15 Wis (Perception) to notice; fail → trigger: DC 10 DEX save or flipped upside-down suspended 10 ft, Restrained until cord takes 1 slashing damage; careless lowering = 3 (1d6) bludgeoning. Gamified: noticed snare = interactable (Disarm with thieves' tools/Utilize, bypass, or **re-rig as party trap** aimed back down the trail [HOUSE tactical option]); triggered snare = hanging party member mini-puzzle (cut cord = fall damage unless lowered carefully: Athletics/rope check).
- **Pit trap (verbatim):** 6 ft wide, 10 ft deep, camouflaged; lead DC 15 Perception if searching; fail → DC 10 DEX save or fall 3 (1d6); walls easy to climb out (no check). Gamified likewise: spotted pit = cross, cover, or re-camouflage for pursuers [HOUSE].
- **Guide mode:** persuaded/captured goblin leads party → traps auto-flagged and bypassed (verbatim: "guide the party around the traps along the way"); guide loyalty meter (§5.4).
- Ambience: psi-goblin whisper easter-egg (green glint between trees, no encounter — teaser consistent with book's later chapters).

### 7.4 Scene 3 — Cragmaw Hideout: overview & the Alert machine [SIM][DATA]

**Verbatim framing (Codex + area intro):**

> The Cragmaw goblins have established a hideout from which they can easily harass and plunder traffic moving along the Triboar Trail or the path to Phandalin. Their band is so named because members sharpen their teeth to jagged points to make them look fiercer.
> The leader of the Cragmaws is a bugbear named Klarg, who has orders from King Grol to plunder any poorly defended caravans or travelers that come this way. A few days ago, a messenger from Cragmaw Castle brought new instructions: waylay the dwarf **Gundren Rockseeker** and anyone traveling with him.

**General features (verbatim, implemented as global scene rules):** cave slopes steeply upward; ceilings 20–30 ft stalactite chambers; H1/H2 outdoors, rest dark unless stated (light/darkvision rules live, §2.7); stalagmites provide cover (authored half-cover volumes); **Sound:** water muffles noise — DC 15 Wis (Perception) to hear activity in nearby chambers (this is the hideout's stealth economy: most fights stay local unless loud); stream 2 ft deep, wadeable (difficult terrain); rubble = difficult terrain.

**The Alert machine [SIM]:** `ch1.alert` 0–3 with per-area response tables. Noise events (combat rounds, un-muffled; bridge collapse; flood; loud arguments at H1 per book) add alert; silent takedowns/stealth keep it. Water-muffled areas (per Sound rule) only propagate noise on failed DC 15 Perception by listeners.

| Alert | State | Hideout behaviour |
|---|---|---|
| 0 | Bored | Book default: H2 guards inattentive, H5 guard daydreams, H6 den lounging, H8 Klarg napping |
| 1 | Suspicious | Guards take posts (H2 bows nocked; H5 guard stops wandering); H6 sends 1 goblin to peek at H5 |
| 2 | Alerted | H7 warned → flood prep begins (ribbon hazard token armed); H8 Klarg sets ambush behind stalagmites/supplies (verbatim Development); H3 goblin hand on wolf chain |
| 3 | Siege | All remaining defenders consolidate H6/H8 with Sildar as shield; Yeemik parley forced early; fleeing runners to Cragmaw Castle (Ch3 forward-flag) |

Alert is shown diegetically: goblin horn calls, running feet audio, torch relights, and a subtle "ears" icon on the journal map — never a numeric meter by default. [HOUSE knob `alert_visibility`: diegetic | meter | off]

### 7.5 Areas H1–H8 — keyed specifications

Each area below lists: **verbatim read-aloud** (boxed in book), **world/geometry notes**, **cast**, **triggers & tactics**, **treasure/flags**. Statblocks §8.

#### H1: Cave Mouth
> The goblins' trail ends at a cave in a hillside five miles from the scene of the ambush. A shallow stream flows from the cave mouth, which is screened by dense briar thickets. A narrow, dry path leads into the cave on the right side of the stream.

- Geometry: hillside cave entrance, stream center-left, briar wall screen, dry path right; camp-able exterior (rest risk: +1 alert per long-rest hour unless sentries posted [HOUSE]).
- Cast: none (guards live in H2).
- Triggers (verbatim Development): loud noise here (arguing, camp, cutting brush) → H2 goblins notice and **attack through the thicket at three-quarters cover** — a authored opening-volley trap for careless players; conversely, quiet approach keeps H2 surprised-able.
- Tactics teaching: first "scan the treeline" moment — perception glints on bored guards if party scouts (Stealth group check opens pre-emptive round, §4.1).

#### H2: Goblin Guard Post
> On the east side of the stream that flows from the cave mouth, a small area in the briar thickets has been hollowed out to form a lookout post. Wooden planks flatten the briars and provide room for guards to lie hidden and watch the area—including several goblins lurking there right now!

- Cast: 2 × Goblin Warrior + 1 × Goblin Boss.
- Behaviour (verbatim): if they saw H1 intruders → bow volley through thickets (¾ cover), probable surprise; if not → they spot the stream crossing, **neither side surprised**; careful scouts can surprise them (group Stealth min = DC for their Perception).
- Thickets: difficult terrain + ¾ cover volumes (both sides can shoot through).
- Development (verbatim): boss defeated → surviving goblins flee to H3 and **release the wolves** (runner objective: intercept to keep H3 wolves chained; fail → H3 fight includes 3 loose wolves).
- Treasure (verbatim): boss belt pouch 16 sp.

#### H3: Kennel
> Just inside the cave mouth, a few uneven stone steps ascend to a small, dank chamber on the east side of the passage. The cave narrows to a steep fissure at the far end and is filled with the stench of animals. Three chained wolves snarl and rattle their chains as you approach the cave mouth. Each wolf's chain leads to an iron rod driven into the base of a stalagmite.

- Cast: 3 × Wolf (chained, reach-limited to room floor, not steps).
- Animal Handling beat (verbatim): DC 15 Wis (Animal Handling) to calm; **DC 10 if fed** (camp rations consumable!) — success = wolves neutral for the chapter (diegetic: they whine and lie down; later released wolves won't attack a party that fed them [HOUSE payoff]).
- Combat noise rule (verbatim): fighting wolves → 1d4 goblins investigate in 2 rounds (ribbon countdown token).
- **Fissure/chimney (verbatim):** 30 ft climb to H8; DC 10 Athletics; 6–9 = struggle, 10 minutes; ≤5 = fall 3 (1d6) + Prone. Gamified as the dungeon's **alternate route**: a stealth-party backdoor into Klarg's cave (book: surprising Klarg via chimney), with the climb check as a skill-challenge card.
- **Wolf frenzy (verbatim):** goaded wolves roll DC 15 Str each round any character is in sight; first success loosens rods (DC drops to 10); second success frees them → they attack. Ribbon token "WOLVES STRAIN 1/2" — a ticking clock that punishes standing in the room debating.
- Development (verbatim): a goblin here can spend an action to release one wolf.

#### H4: Steep Passage
> The main passage from the cave mouth climbs steeply upward, the stream plunging and splashing down its west side. In the shadows, a side passage leads west across the other side of the stream.

- Light gate (verbatim): "From this point on, characters without darkvision will need a light source" — lantern/torch/light-spell systems live here; light = visibility + being seen (H4/H5 guards auto-notice lit parties, verbatim).
- Bridge sightline (verbatim): light or darkvision → spot rope bridge at H5; passive Wis ≥12 & seeing bridge → spot the bridge goblin (perception glint).
- **Bridge goblin AI (verbatim):** notices lit/loud party; does NOT attack — sneaks east to warn H7 to flood. **Intercept objective:** readied action, ranged takedown, or silence/stealth to deny the flood. If it escapes → flood prep arms next round.
- **Western passage (verbatim):** rubble choke, +5 ft movement per cell; avoids H5 guard/flood but hosts a **giant poisonous snake** on a fragile ledge; passive Wis ≥13 avoids surprise; snake has Advantage vs characters on slope; **ledge collapse:** moving/melee-attacking in the ledge space → DC 10 Acrobatics or collapse: all in eastern half DC 10 DEX save, 7 (2d6) bludgeoning + Prone (half on save). Fighting here alerts bridge goblin (noise).
- Tactics: the "risk shortcut" lane — classic risk/reward routing made physical.

#### H5: Overpass
> The stream continues beyond another set of uneven steps ahead, bending eastward. A waterfall burbles in a larger cavern somewhere ahead of you.

- Cast: 1 × Goblin Warrior (bridge guard, well concealed: DC 15 Perception to spot; unlit party can creep past at DC 12 Stealth, verbatim; failed check → guard signals flood then shoots).
- **Rope bridge object (verbatim):** spans 20 ft above stream; climb walls DC 15 Athletics; bridge AC 5, HP 10, vulnerability fire & slashing; at 0 HP collapses: creatures on it DC 10 DEX save or fall 2d6 + Prone. Player win-con: shoot bridge under crossing enemies; enemy win-con: same vs party.
- **FLOOD set-piece (verbatim chain):** warned H7 goblins knock one pool's supports next round; following round on goblins' initiative: "The passage fills with a mighty roar as a huge surge of rushing water pours from above!" — all creatures within 10 ft of H4 disused passage or H3 steps: DC 10 DEX save or be swept; then DC 15 Str save or hold; fail → washed to H1, 7 (2d6) + Prone. Second pool exists but only released on bridge-goblin's call after assessing first flood (verbatim).
  - Presentation: telegraph round = supports cracking audio + spray VFX + ribbon hazard token counting to detonation; players get **one full round to react** (move, Dash, grab ledges = Athletics, shoot the guard, or shove an enemy into the wash with Push). This is the chapter's signature tactical set-piece.
  - Bridge goblin is safe from flood, as are wall-climbers (verbatim).

#### H6: Goblin Den — the Sildar set-piece
> This large cave is divided in half by a ten-foot-high escarpment. A steep, natural staircase leads from the lower portion to the upper ledge. The air is hazy with the smoke of a cooking fire, and pungent from the smell of poorly cured hides and unwashed goblins.

- Cast: 5 × Goblin Warrior + 2 × Goblin Boss (Yeemik = second-in-command, Errk = supporter) + **Sildar Hallwinter** bound on south ledge at **1 HP** (beaten, verbatim).
- Approach (verbatim): quiet approach DC 14 Stealth or spotted by lower-cave goblins → pre-emptive round available.
- **Yeemik hostage machine (verbatim logic, state diagram):**
  1. If Yeemik believes goblins are losing → drags Sildar to ledge edge: *"Truce, or this human dies!"* (Errk shouts support). Combat pauses into dialogue mode (turn-based hostage stance: Yeemik Readies shove).
  2. **Parley branch:** Yeemik offers deal — kill Klarg (H8), bring head, get Sildar. Sildar groggily warns not to trust (Insight auto-hint). Accept → `yeemik_deal=accepted`; after Klarg dead, Yeemik demands ransom (betrayal fight or pay [HOUSE: pay = 50 gp extortion, flagged for Ch2 reputation]).
  3. **Refuse branch:** Yeemik shoves Sildar off (3 (1d6), →0 HP unhealed); fight resumes; Sildar stabilizable DC 10 Medicine / healer's kit / magic (verbatim).
  4. **Speedrun branch:** one-shot Yeemik before the threat (Vex/Advantage opening from stealth) → Sildar safe, Errk morale-shaken (-1 to attacks for 1 round [HOUSE knob]).
- Escarpment = elevation play: high-ground ranged from ledge, staircase chokepoint, Topple/Push off the ledge as dark option (morale flags).
- Treasure (verbatim): Errk pouch 21 cp; Yeemik pouch 3 agates (10 gp ea) + *potion of healing*.
- Waterfall sound rule applies H6↔H8 (fights don't cross-hear, verbatim at H7) → H6 can be cleared loudly without arming H8 **unless** alert already ≥2.

#### H7: Twin Pools Cave
> This cavern is half-filled with two large pools of water. A narrow waterfall high in the eastern wall feeds the pool, which drains out the western end of the chamber to form the stream that flows from the cave mouth below. Low fieldstone walls serve as dams holding the water in. A wide exit stands to the south, while two smaller passages lead west. The sound of the waterfall echoes in the cavern, making it difficult to hear.

- Cast: 3 × Goblin Warrior + 2 × Wolf. Warned → on guard (positions behind dams = half cover).
- Dams = destructible objects (the flood valves); after a flood, pool visibly drained (world-state persistence, verbatim adjustment note).
- Development (verbatim): fight here → one goblin flees to H8 to warn Klarg (runner intercept objective #2; waterfall masks sound both ways otherwise).
- Tactics: dam destruction as area denial vs pursuers; wolves in shallow water (difficult terrain for them? no — water fine; but pool deep cells = swim costs [HOUSE]).

#### H8: Klarg's Cave — boss fight
> Sacks and crates of looted provisions are piled in the south end of this large cave. To the west, the floor slopes toward a narrow opening that descends into darkness. A larger opening leads north down a set of natural stone steps, and the roar of falling water echoes from beyond. In the middle of the cavern, the coals of a large fire smolder.

- Cast: **Klarg (Bugbear)** + 2 × Goblin Warrior ("honor guards") + wolf **Ripper**.
- Klarg voice (verbatim barks, third person): "Who dares defy Klarg?" · "Klarg will build a throne from your bones!" · delusions-of-grandeur taunt set; guards resent him (morale: guards rout at half HP if Klarg is Prone/losing [HOUSE]).
- **Fire pit hazard (verbatim):** 1 fire damage on entering area; 3 (1d6) if fallen in Prone; once per round per creature. Push/Topple synergy both directions.
- **Supplies piles (verbatim):** half cover; searching finds Klarg's unlocked chest; crates bear blue-lion Lionshield marks → `supplies_flag` side-quest (return for 50 gp + Linene friendship, Ch2).
- **Chimney niche (verbatim):** top of H3 shaft — stealth entry route to surprise Klarg (book: "characters can surprise them by climbing the chimney from area H3").
- **Warned ambush (verbatim):** Klarg&allies hide behind stalagmites/supplies; passive Wis ≥14 not surprised; else opening volley from cover.
- **Klarg escape (verbatim):** allies dead → bugbear attempts chimney: DC 10 DEX check to wriggle; fail = Restrained; action to retry. Catching him alive = interrogation gold (Cragmaw Castle directions, Ch3 flag) [DATA].
- Treasure (verbatim): chest = 1,700 cp, 150 sp, 2 × *potion of healing*, jade frog statuette (gold-orb eyes) 40 gp; bulky stores need wagon (logistics hook verbatim).
- Boss design notes: Klarg is the chapter's mastery-check exam — big HP pool, morningstar Sap, Surprise-attack damage spike if HE surprises YOU (reversing the tutorial lesson), Ripper as flanker, guards as Nick chaff. Fight space offers: fire pit, chimney escape route, supply cover lanes, stalagmite pillars for LOS breaks — a sandbox, not a duel.

### 7.6 Sildar rescued — info dump & departure [DATA]

Post-rescue dialogue tree, five nodes verbatim: **A Missing Wizard** (Iarno Albrek, Lords' Alliance contact); **Wave Echo Cave** (Rockseeker brothers' discovery; Codex unlocks the chapter-prologue history; player learns Tharden dead/Nundro captive only as dramatic-irony Codex footnote per book's instruction); **The Mysterious Spider**; **Finding Cragmaw Castle** (map went to King Grol; someone in Phandalin might know; captured goblins can divulge); **Strange Goblin** (whisper verbatim: "you're not what Ruxithid wants").
- Sildar roleplay card verbatim: kindhearted, ~50, Waterdeep griffon cavalry honour, Lords' Alliance agent, goals (find Iarno, help reopen mine, restore Phandalin).
- Offers 50 gp escort fee (no money on him; loan within a day, verbatim); joins as temp companion (§5.4); anxious-to-leave flavour barks; gearless until looting a goblin shortsword (verbatim).
- Roleplaying-Sildar text ships verbatim in Codex NPC entry.

### 7.7 Chapter end — "What's Next?" (verbatim hooks) [DATA]

> - **Deliver Supplies.** The characters began with the "Meet Me in Phandalin" adventure hook; they can be paid by Barthen's Provisions for delivering the wagonload of supplies.
> - **Escort Sildar.** If the characters rescued **Sildar Hallwinter**, the wounded warrior would appreciate an escort to Phandalin.
> - **Seek NPCs.** Other adventure hooks or background connections might prompt the characters to seek out specific NPCs in the town.
> It's also possible that players might decide to do something different, such as striking out in search of Cragmaw Castle. If that is the case, skip to chapter 3.

- On `hideout_cleared`: milestone level-up cinematic (level 2), loot tally card, chapter-complete journal stamp, and the Chapter-2 teaser (Phandalin skyline at dusk; Redbrand silhouette flash — 3 s, no spoilers).
- Wagon logistics: if supplies taken, chapter-end convoy mini-scene (wagon loaded, oxen plod) — the book's bulky-loot rule made charming.

---

## 8. STATBLOCK & RULES APPENDIX (verbatim)

### 8.1 Goblin Warrior — from attached statblock image (2024), VERBATIM

**Goblin Warrior** — Small Fey (Goblinoid), Chaotic Neutral — CR 1/4 (XP 50; PB +2)
- **AC** 15 · **Initiative** +2 (12) · **HP** 10 (3d6) · **Speed** 30 ft
- STR 8 (−1) · DEX 15 (+2) · CON 10 (+0) · INT 10 (+0) · WIS 8 (−1) · CHA 8 (−1)
- **Skills** Stealth +6 · **Gear** Leather Armor, Scimitar, Shield, Shortbow · **Senses** Darkvision 60 ft; Passive Perception 9 · **Languages** Common, Goblin
- **Actions:** *Scimitar.* Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6+2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage. *Shortbow.* Ranged Attack Roll: +4, range 80/320 ft. Hit: 5 (1d6+2) Piercing damage, plus 2 (1d4) Piercing damage if the attack roll had Advantage.
- **Bonus Actions:** *Nimble Escape.* The goblin takes the Disengage or Hide action.

[SIM notes] advantage-bonus-damage = trait trigger on advantage-flagged attack rolls (hide-opening shots, height shots, Vex chains — goblins synergize with the same mastery web the player uses); Nimble Escape makes the fleeing-goblin morale script (§7.1) brutally effective: intercept plans must account for a free Disengage.

### 8.2 Chapter-1 weapon mastery map (2024 PHB weapon table, verbatim masteries)

| Weapon (wielder) | Mastery | Tactical note in Ch1 |
|---|---|---|
| Scimitar (goblins) | Nick | goblin chaff double-cuts when packed |
| Shortbow (goblins) | Vex | opening volleys chain Advantage — cover matters immediately |
| Shortsword (Sildar/loot) | Vex | loot teaches Vex early |
| Dagger | Nick | off-hand classic |
| Handaxe | Vex | thrown vex opener |
| Spear | Sap | guard-style debuff |
| Morningstar (Klarg) | Sap | boss debuffs your retaliations |
| Greatclub / Club | Push | tutorial dummy rails demo |

(Full mastery texts verbatim in Codex from PHB "Mastery Properties": Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex — §4.6 summaries mirror them.)

### 8.3 Other cast (2024 Monster Manual-faithful; verify against MM at implementation)

- **Goblin Boss:** AC 17, HP 21 (6d6), scimitar +4 (1d6+2, +1d4 w/ adv), Redirect Attack (reaction: swap places with a goblin within 5 ft — SIM: reaction card!), Nimble Escape.
- **Wolf:** AC 13, HP 11 (2d8+2), speed 40, bite +4 2d4+2, knock Prone DC 11, Pack Tactics, Keen Hearing/Smell.
- **Bugbear (Klarg):** AC 16, HP 27 (5d8+5), speed 30, morningstar +4 1d8+2 (+ Sap), Surprise Attack extra 2d8 vs actors that haven't acted, Brute +1 die on melee hits, darkvision 60.
- **Giant Poisonous Snake:** AC 14, HP 11 (2d8+2), bite +4 1d6+2 + poison 3d6 (DC 11 CON half).
- **Sildar Hallwinter:** human warrior, AC 13 (no armour post-capture; 18 with recovered gear Ch2), HP 15 (book: 1 HP while captive), longsword/shortsword +3 1d6+1, shield-proficient.
- **Gundren Rockseeker:** dwarf commoner-merchant flavour NPC (tutorial only; not combat-critical), per book portrait/voice direction.

---

## 9. UI/UX MASTER LIST (Chapter-1 additions)

1. Initiative ribbon + hazard tokens (§4.2, §4.10). 2. Turn banner with A/BA/R/Speed pips. 3. Movement dust-ribbon + budget readout (§2.3). 4. Cover pips + AC breakdown tooltip (§2.6). 5. Reaction interrupt card + slow-mo (§4.5). 6. Non-lethal toggle per bludgeoning attack (§4.11). 7. Travel card & journey map (§14). 8. Alert diegetics + optional meter (§7.4). 9. Trap glints & Codex trap cards (§2.10). 10. Dialogue hostage stance overlay (§7.5 H6). 11. Dice theater (v0.9) with turn-paced variants. 12. Companion ledger panel (§5). 13. Diegetic folio sheet + Codex with verbatim rules. 14. Grid overlay options (§2.9). 15. Camera comfort suite (§3.2). 16. Journal with flags/quests/lore stamps. 17. Loot tally & chapter-complete cards (§7.7). 18. Difficulty presets: Story / Balanced / Tactical (enemy HP ±, reaction timers, alert aggression) — numbers never change between combat modes (§4.13).

## 10. AUDIO & VFX CUE SHEET (Chapter 1 highlights)

- Yard: gulls, harbour bells, wooden dummy thocks, sergeant counts; Gundren theme (hummed dwarf march, bouzouki+frame drum).
- Trail: wind in pines, oxen creak, snare rope twang, pit lid crack.
- Hideout: water-drown mix (stream/waterfall beds per area, masking as rules dictate), wolf chain rattle, goblin chatter loops (alert-layered: bored → suspicious → alarmed stems), flood roar one-shot + low-pass build, bridge rope snap, fire pit ember crackle, Klarg drum-sting on boss reveal.
- Dice theater: die material whoosh, table-thock, crit bell, crit-fail sour string.
- First-person swap: subtle ear-pressure whoosh (both directions) so toggling feels physical.

## 11. VERIFICATION & BALANCE PLAN

- Headless d20core sims (fresh test harness; the Phase-0 prototype is retired): every encounter in §7 run 1,000× at party levels 1 (ambush/trail/H1–H5) and 2 (post-milestone H6–H8) across difficulties **and party compositions (solo default, duo, full 4)**; assert: ambush TPK rate <2% Balanced at the current party scale; H6 hostage fail-state (Sildar death) reachable but <25% on Balanced; flood sweep never TPKs a party that spent its reaction round moving; Klarg fight winnable without rest at level 2 with ≥1 potion in loot path; solo tuning meets duo parity via elite adjustments, not HP inflation.
- Rules conformance suite: cover matrix vs four-corner raycast on authored test scenes; mastery triggers vs PHB text table; surprise/turn-skip; reaction refresh timing; non-lethal capture; flood save chain; chimney partial-success bands (6–9, ≤5).
- Camera QA: no clipping in H4 slope & H6 escarpment at min boom; first-person parity screenshot diff vs third-person targeting truth (must match 100%).
- Playtest script: 20-min tutorial target (12 min veteran skip), 90–120 min Chapter 1 target.

## 12. PRODUCTION ORDER (vertical slice)

1. RulesGrid + continuous-movement reconciliation in engine (spike). 2. Turn scheduler + initiative ribbon + reaction card (Table Mode core). 3. Yard greybox + creation stations + Gundren VO placeholder (text-to-speech scratch). 4. Ambush site whitebox → Lit-Miniature pass. 5. Hideout H1–H8 blockout + alert machine. 6. Flood/bridge/fire-pit hazard kit. 7. H6 hostage dialogue machine. 8. Klarg boss tuning. 9. Skirmish Mode scheduler (fresh build per §4.13 spec; original prototype retired). 10. Polish: dice theater V2, audio mix, comfort options.

## 13. OPEN QUESTIONS (answer to lock spec)

- **Q1 — Companion turn control:** BG3-style full hot-swap control of each party member's turn (default assumed §5.2) vs. order-only command model?
- **Q2 — First-person parity:** full parity incl. combat (default assumed §3.2) vs. exploration/dialogue-only?
- **Q3 — Prototype rebuild:** convert the existing web prototype to turn-based-default now as a playable proof of §4 (real-time becomes its toggle), or freeze it and build Table Mode only in-engine?
- **Q4 — Party size:** active party of 4 (player + 3 contract companions, default §5.1) vs. smaller/solo focus?

**RESOLVED (2026-09-19):** **Q1** = BG3-style hot-swap full control of companion turns (confirmed). **Q2** = full first-person parity including combat (confirmed). **Q3** = prototype retired entirely per product decision (folder deleted; Skirmish Mode is spec-only until greenlit). **Q4** = **solo protagonist by default + recruitable companions throughout the campaign** (active cap 4; §5.1 and §5.4 rewritten accordingly).

## 14. TRAVEL & ZONE ARCHITECTURE ("JOURNEY BEATS")

### 14.1 Zone philosophy

Chapter 1 is a chain of **authored zones**, not an open world: `YRD` (training yard + dock-lane threshold, GDD-03), `AMB` (ambush site, map 1.1), `GTR` (goblin trail corridor), `CRG` (Cragmaw Hideout H1–H8, streamed interior clusters), `CAMP` (authored rest sites), plus montage-only segments. Zone loads happen only at menu→YRD and chapter boundaries; CRG streams internally.

### 14.2 The Journey Beats system [PRES][SIM]

Travel between zones is a directed sequence in three modes, all skippable after 3 s (journal recap on skip):
- **STRIDE:** third-person auto-walk along an authored path with time-lapse lighting; player keeps camera control, can Look (perception vignettes: glints, herb spots, lore plaques) and open companion conversation prompts; no combat possible.
- **RIDE:** wagon/coach framing; light conversation wheel; look-out windows with the same vignette system.
- **CARD:** a hand-drawn map panel where the route inks itself, stamped with elapsed time and arrival state ("10 MINUTES LATER", "DAY 2 — HIGH ROAD"); used between beats and at chapter transitions.
**No random encounters in Chapter 1** — every travel event is authored (the book places none between its keyed beats).

### 14.3 Neverwinter → ambush site

One RIDE montage (tutorial beat T11) with two CARD cuts ("DAY 2 — HIGH ROAD", "HALF A DAY — TRIBOAR TRAIL"), Gundren&Sildar banter establishing lore; ends at the AMB bend where §7.1's read-aloud plays in-world. Skippable; journal recap preserves all lore strings.

### 14.4 Ambush site → Cragmaw Hideout (the book's five miles)

`GTR` = authored playable corridor ≈350 m representing five miles: beat 0 trailhead (DC 10 Survival read, §7.1) → STRIDE + CARD "10 MINUTES LATER" → **snare beat** → STRIDE + CARD "ANOTHER 10 MINUTES" → **pit beat** → STRIDE + CARD "THE HILL AHEAD" → CRG entrance (H1 read-aloud). The player is point (§7.3); guide-goblin mode walks ahead and flags traps (verbatim book behaviour).

### 14.5 Returns, rests, fast travel

Camp sites are authored (yard bench; cave-mouth exterior with alert risk per §7.5 H1). **No fast travel in Chapter 1** (tension design); [HOUSE knob `fast_travel`: off-in-ch1 (default) | map]. Chapter end convoy = RIDE outro into the Chapter-2 boundary load.

### 14.6 Loading technology

Full loads: menu→YRD, chapter boundaries, save resume. CRG streams by area cluster behind the H1/H4 doors. Loading screen specification (art, tips, progress, error states): `02_DELVE_SHELL_SPEC.md` §3.

---

**RESOLVED (2026-09-19, round 2):** marching order scrapped (solo point character, §7.3); Neverwinter scope = R0/R1 playable + R2 vista (§6.1, GDD-03 §2); long travel = Journey Beats (§14); game titled **DELVE** with full shell spec (GDD-02) and yard build spec (GDD-03).

*End of GDD-01 v2.2. Companion specs: GDD-02 `02_DELVE_SHELL_SPEC.md` (logo / menu / loading), GDD-03 `03_NEVERWINTER_YARD_LEVEL_SPEC.md` (yard build-from-nothing spec). Next: GDD-04 "Chapter 2 — Trouble in Phandalin" upon Chapter-1 slice greenlight.*
