# UNTITLED D&D ACTION-ADVENTURE RPG
## Part 1 — Art & Presentation Direction · Part 2 — Core Mechanics Adaptation Plan

**Document status:** v0.9 — Foundation doc. Everything downstream (systems design docs, content plans, tech architecture) hangs off Part 2's architecture.
**SUPERSEDED SECTIONS (2026-09-19):** §1.5 (camera) and §2.3 (timing model) are replaced by `01_CHAPTER1_TUTORIAL_AND_TACTICAL_COMBAT.md` §3 (BG3-style third-person default + first-person toggle) and §4 (turn-based default, real-time opt-in). §2.6 terrain/grid replaced by GDD-01 §2 (natural terrain + invisible 5-ft rules grid). All other sections remain in force.
**SUPERSEDED (2026-09-23): Part 1 (§1.1–1.6) in full by `06_BROWSER_PIXEL_CONVERSION_PLAN.md` (GDD-06)** — see the banner at the head of Part 1. The five pillars stay.
**Tutorial campaign:** *Phandelver and Below: The Shattered Obelisk* (Ch. 1–4 = levels 1–5, Ch. 5–8 = levels 5–12)
**Date:** 2026-09-19

---

# PART 0 — THE THING WE HAVE TO SETTLE FIRST (Licensing)

Before art or code, there is a hard legal constraint that changes the shape of the whole project. Get this wrong and the game does not ship.

### What is free

The **System Reference Document 5.2.1** (the 2024 ruleset) is published by Wizards of the Coast under **Creative Commons Attribution 4.0 International (CC-BY-4.0)** — irrevocable, commercial use permitted, the only obligation being an attribution statement. The older **SRD 5.1** (2014 ruleset) is likewise CC-BY-4.0. That gives us, legally and forever:

- The d20 core: ability scores, checks, saves, advantage/disadvantage, proficiency, DCs
- Action economy: Action / Bonus Action / Reaction / Movement
- Classes, subclasses, species, backgrounds, feats, spells, equipment, magic items (the SRD subset)
- Conditions, damage types, resting, death saves, combat rules, rules glossary
- A large chunk of the monster list (goblins, bugbears, hobgoblins, ogres, owlbears, dragons, **beholders**, even Strahd-adjacent material that landed in the SRD)

Required attribution block (must appear in our credits and legal page):

> This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode

### What is NOT free

- The words **"Dungeons & Dragons"** and **"D&D"** — registered trademarks, never released under CC. We cannot put them on the box, in the title, or in marketing without a licence from WotC.
- **"Phandelver and Below: The Shattered Obelisk"** and **"Lost Mine of Phandelver"** — proprietary adventure content. The text, the specific NPCs (Gundren Rockseeker, Sildar Hallwinter, Glasstaff/Iarno Albrek, Nezznar, Hamun Kost, Ruxithid, Qunbraxel), the places (Phandalin, Wave Echo Cave, Talhundereth, Illithinoch, Zorzula's Rest), and the godlet **Ilvaash** are all WotC product identity.
- **The Forgotten Realms**, Faerûn, the Sword Coast, Neverwinter, Harpers/Zhentarim/Emerald Enclave/Order of the Gauntlet as an interconnected setting.
- **Mind flayers / illithids** — present in SRD 5.1 statblock form, but their identity and depiction are heavily protected WotC brand assets. Treat as requiring a licence.

### Three viable routes

| Route | What it is | Cost | Risk | Recommendation |
|---|---|---|---|---|
| **A. Official licence** | Partner with WotC/Hasbro. Game is *Dungeons & Dragons: The Shattered Obelisk*. | Revenue share / advance; creative approval gates; long legal timeline | High dependency, slow, possible rejection | Pursue in parallel, **never** as a blocking dependency |
| **B. SRD-native, original setting** | Build 100% on SRD 5.2.1. Invent our own frontier town, our own lost mine, our own sharded obelisk, our own Far Realm analogue. Ship. Later, if a licence lands, release the Phandelver campaign as licensed DLC. | Attribution only | Low | ✅ **This is the plan** |
| **C. Grey area** | Use SRD rules but "lightly renamed" Phandelver content, hope it flies. | — | Certain C&D, community backlash | ❌ Never |

**Route B, executed well, is the same game.** *The Shattered Obelisk*'s structure — a frontier boomtown, a kidnapped patron, goblin bandits masking a psychic horror beneath the town, an ancient shattered artifact being reassembled by fanatics of an alien godlet, escalating body horror, a race for shards, a descent into an impossible plane — is a *story structure*, and structures aren't copyrightable. We will build a faithful, beat-for-beat **structural analogue** (working title: **THE SHARDBOUND CHRONICLES — Book One: The Broken Obelisk**) with original names, original NPCs, original town, and our own art direction. Every mechanic in Part 2 works identically either way, and if Route A succeeds we simply swap the content pack — which is exactly why Part 2 mandates a data-driven content layer.

**Decision required from you:** confirm Route B as the default (we proceed today on this basis) and whether we should also draft the pitch document for a WotC licence conversation.

**Ruleset decision:** build the engine on **SRD 5.2.1 (2024 rules)** with a compatibility shim for **SRD 5.1 (2014 rules)**. Reason: 5.2.1 has weapon masteries, the rules glossary, revised class chassis and expanded SRD spell/monster lists — it is both more modern and more *gameable*. But *Shattered Obelisk* is a 2014-rules adventure, so any licensed content will need conversion. Build the conversion tables once, early.

---

# PART 1 — VISUALS: 3D OR 2D, AND WHAT STYLE

> **SUPERSEDED BY `06_BROWSER_PIXEL_CONVERSION_PLAN.md` (GDD-06, 2026-09-23) — this entire Part 1 (§1.1–1.6).**
> The project pivots to a **2D pixel-art browser game** (480×270 canvas, static web build — see GDD-06).
> §1.1–1.3 ("3D beats 2D", the anti-isometric argument), §1.4's 3D character/environment craft,
> §1.5's two-camera rig and §1.6's technology table are historical. **The five pillars beneath this
> banner remain in force** — GDD-06 §2.5 explicitly retains them and re-expresses them in 2D, and the
> locked palette (GDD-06 §5.3) descends from this Part's warm-dawn direction. GDD-06 is the single
> owner of pixel-tech decisions (§10.4). Part 2 is unaffected except where GDD-01/GDD-06 supersede it.

## 1.1 The short answer

**Full 3D, rendered in Unreal Engine 5.7, in a painterly-real "Lit Miniature" style, viewed through a dual-camera system.**

Not 2D. Not isometric sprites. Not photorealism. Here is the reasoning and then the specification.

## 1.2 Why 3D beats 2D *for this game specifically*

The genre ask — action-adventure RPG — plus the ruleset ask — D&D — pull in opposite directions, and 2D resolves the tension badly:

1. **D&D combat is a geometry problem.** Cover (half/three-quarters/total), flanking, opportunity attacks, reach, line of sight, and spell areas (cone, line, sphere, cylinder, cube) are all *spatial* rules. In 2D they become abstraction and fudge. In 3D they are literally true, and "literally true" is the whole selling point: the player sees the fireball's sphere, sees the goblin behind the low wall getting half cover, sees the bugbear's 10-foot reach. Rules you can *see* are rules players trust.
2. **Action gameplay needs a body.** Dodging a telegraphed windup, parrying, rolling under a swing, closing distance — these read through animation and physical space. Top-down 2D makes melee feel like clicking; 3D third-person makes it feel like fighting.
3. **The second half of the campaign is impossible in 2D.** The Far Realm is non-Euclidean: subjective gravity, geometry that reassembles behind you, an interdimensional labyrinth. That is a *rendering* set-piece. It's the single biggest visual differentiator we have against every other RPG on the market, and it needs a 3D engine with real-time GI to land.
4. **Market reality.** In 2026 the premium action-RPG audience expects 3D. 2D would reposition us into a different (smaller, more crowded, lower-price-point) category — Hollow Knight-adjacent rather than BG3-adjacent.
5. **Cost curve has inverted.** Nanite removes manual LOD authoring; Lumen/MegaLights remove light-baking; the PCG framework + Nanite foliage lets a small environment team build a believable frontier region. In 2020 this art target needed 80 people. In 2026 it needs ~25 with strong direction.

**Where 2D *does* appear in the game (deliberately):** the journal, maps, the character sheet, quest-tracker illumination, tarot-style madness cards, chapter title cards, and loading-screen illustrations are **hand-drawn 2D ink-and-wash on parchment**, animated with subtle parallax and ink-bleed shaders. This gives us a beautiful, cheap, deeply D&D-feeling layer of the presentation and it doubles as the visual identity for marketing. 3D world / 2D codex. That contrast is our look.

## 1.3 Why not isometric CRPG (the BG3 default)

BG3 proved the audience is enormous. It also proved the ceiling: isometric turn-based limits the *action* half of action-RPG, and we would be shipping a direct comparison product three years late. Isometric is, however, the best camera for *tactics*. So we don't choose — we make it a **camera**, not a genre. See 1.5.

## 1.4 The art direction: "LIT MINIATURE"

> **One-line brief:** *A hand-painted tabletop diorama, lit by real light, at 4K, with a camera that can lean in until the brushstrokes are on the character's cheek.*

The fantasy we're selling is not "you are in a fantasy world." It's **"you are inside the miniature."** Every D&D player has looked down at a battle map and felt the pull of the diorama. We build that diorama with the fidelity of a film set and let the player walk into it.

### The five pillars

| Pillar | What it means | Concrete rules |
|---|---|---|
| **1. Readable first, pretty second** | Every frame must answer: where am I, what can I interact with, what is about to hurt me | Silhouette test at 32px; interactive objects always carry a material accent (brass, crystal, painted glyph); enemy telegraphs use dedicated colour channels never used by environment |
| **2. Painterly surfaces, physical light** | Hand-authored albedo/normal with visible brush direction, lit by fully dynamic GI | No flat PBR plastic. Textures painted in a limited hue family per biome. Lumen does the rest. Roughness variance is authored by hand, not procedurally noised |
| **3. Warmth above, wrongness below** | The surface world is *lovable*; the deep is *alien* | Two-tone campaign. Surface palette = oak, wheat, rust, candle-amber, moss, slate-blue sky. Below palette = obsidian, bone, cyan bioluminescence, violet psychic, sodium-sick yellow. As Resonance rises, the surface palette is progressively *infected* by the below palette in the very same town — the art direction itself is the horror story |
| **4. Character as class fantasy** | You should be able to name a character's class from a silhouette at 40m | Distinct proportion families per class; oversized signature weapon shapes; cloth and hair sim; MetaHuman-based facial rig for conversation close-ups |
| **5. The dice are diegetic** | Our most unique visual asset is the d20 | Physical, weighted, gorgeous dice that exist *in the world*: a d20 tumbling across a table in the tavern, carved into a dungeon door, hanging from a lich's chain. The UI dice are the same asset as the world dice. This is the brand |

### Reference cluster (mood, not copy)

- **Fidelity target:** *Baldur's Gate 3* (character craft, cinematic conversation), *Hellblade II* (face + audio intimacy for the horror half), *Alan Wake 2* (light-as-narrative, the Dark Place's reality-bending), *Kena: Bridge of Spirits* (painterly-real stylisation without going cartoon), *Ghost of Tsushima* (biome colour scripting), *Arcane* (brushstroke-in-3D philosophy).
- **Anti-references (do not drift here):** anime/cel-shaded (wrong for horror), grimdark-desaturated (wrong for Phandalin's optimism), photoreal (uncanny, expensive, and loses the diorama magic).

### Lighting doctrine

Lighting is the primary storytelling instrument, not decoration.

- **Surface:** golden-hour-dominant. Long shadows. God rays through canopy. Firelight in windows at dusk. Weather systems that change tactical visibility (fog = reduced sight lines = stealth favoured; rain = noise masking = stealth favoured, fire spells weakened visually).
- **Dungeons:** total darkness by default. The player's light sources (torch, *light* cantrip, darkvision cone) are *gameplay objects* with real radius and colour temperature. Darkvision is rendered as a desaturated monochrome ramp — this is both beautiful and mechanically honest.
- **Obelisk zones:** the light source is *wrong*. Violet key light from below. Shadows that don't match the key. Volumetric haze with drifting particulate that reacts to Resonance.
- **Far Realm:** no skybox. Localised light only. Geometry illuminated from inside. Colour grade inverts.

### Character & creature craft

- Player characters and named NPCs: MetaHuman-derived rigs, full facial performance capture for the conversation camera, cloth/hair simulation, hand-painted texture sets.
- Bestiary: ~60 creatures for Book One, built as modular kits (goblinoid family shares a rig and swaps parts — goblin / bugbear / hobgoblin / wolf / warg). This is both an art-economy decision and a lore-honest one: the Cragmaw band *is* a family.
- Signature set-pieces: the Obelisk itself (a 40m shattered Netherese monolith, animated fracture glow), the Mind Flayer Fanatics, the godlet **Ilvaash** (a multi-phase, room-scale psychic entity that is never fully visible), the Purple Worm.

### Environment scope for Book One

One contiguous **region** (~6 km² playable), not an open world: the frontier valley, its town, its roads, its ruins, and a layered underground (mine → duergar outpost → dwarven temple → Underdark crossroads → mind flayer shrine → the Far Realm). Vertical layering gives us the "and Below" promise literally. Region-based streaming, no loading screens except the plane shift (which we make a *spectacle*).

## 1.5 The camera: one game, two framings

This is the single most important design decision in Part 1, because it resolves the action-vs-tactics conflict.

| | **ACTION CAM** (default) | **TACTICAL CAM** (hold `L2`/`Tab`, or toggle) |
|---|---|---|
| Framing | Over-the-shoulder third person, 3.5m back, 55° FOV | Raised 45° diorama, free orbit/zoom, 8–40m |
| Used for | Exploration, traversal, conversation, melee feel | Spell placement, positioning, party command, ambush planning |
| Movement | WASD relative to camera | Click-to-move + drag-to-path; direct control also available |
| Grid | Hidden. Collision and rules run on a real 5-ft grid underneath | **Visible 5-ft grid overlay**, AoE previews, cover arcs, threat ranges, enemy sight cones, path lines |
| Time | Real time | Real time — or **Tactical Pause** (settings toggle: Pause / Slow-Mo 25% / Real Time) |

Both cameras read the *same* simulation. The grid is always authoritative; it's just only drawn in Tactical Cam. Players who love BG3 live in Tactical Cam with pause on. Players who love God of War never leave Action Cam and the game still works, because the AI and the rules run identically. **We are not making two games. We are making one simulation with two lenses.**

Cinematic layer: on a critical hit, a natural 20 on a story check, or a boss phase transition, the camera briefly hands off to a directed shot (0.8–1.5s), then returns control. Never more than that. Never during player input.

## 1.6 Technology

| Layer | Choice | Why |
|---|---|---|
| Engine | **Unreal Engine 5.7** | Nanite (virtualised geometry, foliage — no LOD authoring), Lumen + MegaLights (dynamic GI at scale, essential for the lighting doctrine), MetaHuman in-engine (character creator + conversation faces), PCG framework (region dressing at small-team scale), Gameplay Ability System + Gameplay Tags (a near-perfect structural match for D&D's action/condition/keyword rules), World Partition (streaming region), Chaos (destructible terrain, collapsing bridges, physics traps), Niagara (spell VFX) |
| Simulation core | **Custom C++ module, engine-independent, deterministic, 60 Hz fixed tick, seeded RNG** | The rules must be testable headless, replayable, networkable and portable. GAS provides tags/abilities; our own `d20core` provides dice, checks, initiative, resources, saves. **Never** let presentation touch simulation state |
| Content | **Data-driven**: JSON/Lua for rules; proprietary node-graph editor for campaigns, dialogue and encounters | Campaigns are DLC-shaped from day one. This is what makes Route A (licensed Phandelver pack) a content swap rather than a rebuild |
| Audio | Wwise, with binaural whisper layer for Resonance/madness | The horror half lives or dies in the mix |
| Alternatives considered | Unity 6.3 (better mobile/WebGL and 2D tooling, weaker high-end GI); Godot 4.x (fast iteration, no AAA GI/Nanite equivalent, smaller console-cert ecosystem); in-house (only viable at 100+ engineers) | Re-evaluate only if UE royalty economics or console-cert support changes |
| Platforms | PC first (Steam/Epic), then PS5 + Xbox Series; Switch 2 evaluated at beta | Nanite/Lumen cost makes this a current-gen product. UE royalty: 5% of gross above $1M, waived for Epic Games Store sales |

---

# PART 2 — ADAPTING D&D TO A VIDEO GAME

## 2.0 The philosophy: six pillars

These are the tie-breakers. When two designs conflict, the one that serves these wins.

**P1 — Everything is a d20 event.**
D&D is not a physics system; it is a *resolution system*. Every meaningful attempt in the game resolves through `d20 + modifier vs DC`. We never replace this with pure twitch skill, and we never hide it. The d20 is the product.

**P2 — Action is positioning.**
The action comes from *space*: cover, flanking, reach, sight lines, AoE geometry, engagement. The player's skill expresses as "I moved to the right place," not "I pressed the button on the right frame." This is what makes it an action game that is still D&D.

**P3 — Tension is resource attrition.**
The drama of a D&D adventuring day is *running out*. Spell slots, hit dice, Action Surge, rations, torches, sanity. Our pacing systems exist to make the player feel the day shorten.

**P4 — Failure is a branch, never a wall.**
A failed check opens a *different* door with a *cost*. This is the single biggest narrative upgrade a video game can make over a table (where a bad roll often stalls the session), and it is the reason our dialogue system will feel better than the module.

**P5 — Transparency is trust.**
Show the roll, show the math, show the DC, show the modifier. Players forgive swinginess when they can see why. Every hidden roll is a design failure except the DM-only ones (see 2.14).

**P6 — The DM is a system, not a person.**
Pacing, reveals, ambushes, NPC reactions, world-state clocks: authored as data and driven by a **Director** layer. This is how a sandbox module becomes a game that always feels like someone is running it for you.

## 2.1 Architecture: the three layers

This is the "build on later" part of your ask. Everything below is a consequence of this diagram.

```
┌──────────────────────────────────────────────────────────────┐
│ LAYER 3 — PRESENTATION                                        │
│ Animation · VFX · Audio · UI · Camera · Cinematics            │
│ * Reads sim state. Never writes it. Never rolls dice.         │
└───────────────────────────▲──────────────────────────────────┘
                            │ events (DamageDealt, RollMade, ConditionApplied…)
┌───────────────────────────┴──────────────────────────────────┐
│ LAYER 2 — CONTENT (data-driven)                               │
│ Spells · Abilities · Monsters · Items · Campaigns · Dialogue  │
│ Encounters · Clocks · Loot tables · Madness tables            │
│ * JSON/Lua + node-graph editor. Hot-reload. DLC-shaped.       │
└───────────────────────────▲──────────────────────────────────┘
                            │ queries / commands
┌───────────────────────────┴──────────────────────────────────┐
│ LAYER 1 — SIMULATION CORE  (`d20core`)                        │
│ Deterministic · 60 Hz fixed tick · seeded RNG · no rendering  │
│   • DiceService        d20/d4…d20, adv/dis, crit, RNG stream  │
│   • CheckResolver      checks, saves, contests, passive       │
│   • ActorModel         abilities, HP, AC, speed, conditions   │
│   • ActionEconomy      Action/BA/Reaction/Move pools, rounds  │
│   • InitiativeTracker  order, surprise, round boundaries      │
│   • SpatialGrid        5-ft cells, cover, LOS, reach, AoE     │
│   • ResourceManager    slots, hit dice, charges, rests        │
│   • ConditionSystem    duration, stacking, removal, immunities│
│   • CombatResolver     attacks, damage, resist/vuln, death    │
│   • Director           clocks, pacing, encounters, world state│
└──────────────────────────────────────────────────────────────┘
```

**Why this matters:** the sim runs headless. Which means (a) we can unit-test every rule in the SRD glossary against the book's own examples, (b) we can simulate 10,000 combats overnight to balance encounters, (c) saves are versioned serialisations plus an RNG seed, (d) multiplayer is lockstep or server-authoritative with no re-architecture, (e) replays and speedruns come free, (f) if we get a WotC licence and swap content, nothing in Layer 1 changes.

## 2.2 The universal resolution formula

One function resolves 90% of the game:

```
Resolve(actor, kind, target, context) -> Outcome
  kind ∈ { Check(skill|ability|tool), Save(ability), Attack(weapon|spell), Contest(both) }

  roll   = d20()                                  // seeded, stream-tagged
  mod    = abilityMod + proficiency? + expertise? + itemBonus + conditionMod
  total  = applyEdge(roll, advantageSources, disadvantageSources) + mod
  dc     = targetDC ?? target.AC ?? opposedTotal
  margin = total - dc

  crit   = (roll == 20) / (roll == 1)             // attacks & death saves only
  result = { success: total >= dc, degree: tier(margin), roll, total, dc, breakdown[] }
```

Design rules on top of the formula:

- **Advantage/disadvantage never stack.** Multiple sources = still one reroll. This is a 5e rule and we keep it; it prevents the modifier explosion that killed 3.5e.
- **Bounded accuracy is sacred.** Do not add +1 treadmill items. Bonuses come from *situations* (cover, height, flanking, preparation, help) — which are things the player can *create*. That is what makes exploration and tactics rewarding rather than grinding.
- **Degrees of success** are our one deliberate departure: pass/fail stays canonical, but we *add* a margin tier for narration and small mechanical hooks — beat DC by 5+ = "with style" (bonus clue, no resource cost, a flourish); fail by 5+ = "hard fail" (extra consequence). This makes every roll feel like it has three outcomes, not two, without breaking the rules.
- **Passive checks** (`10 + mod`) run continuously in the background: passive Perception feeds the ambient-discovery system; passive Insight feeds the NPC truth-meter. The player never rolls for noticing something the character would always notice — that's just good DMing, automated.

### 2.2.1 The Roll Moment (signature presentation)

Our single most marketable interaction. When a *significant* roll resolves:

1. Time drops to 25% speed (or full pause in Tactical mode) for ~0.6s.
2. The camera pushes toward the acting character.
3. A physical d20 tumbles in a volumetric light shaft, faces settling.
4. The math assembles beside it as engraved tokens: `14 + 5 (Prof STR) + 2 (High Ground) = 21 vs AC 17`.
5. Verdict stamp: **HIT** / **MISS** / **CRITICAL** / **FUMBLE** / **SUCCESS BY 4**.
6. Time restores. Total real-world cost: under a second.

Not every roll gets theater. **Theater triggers:** player attacks, player saves, any skill check, death saves, natural 1/20, boss actions, contest-of-wills dialogue. **Feed-only rolls:** enemy routine attacks, ally routine actions, ambient passive checks. Settings expose three levels: *Full Theater* / *Compact Popups* / *Log Only*. This is the accessibility valve for players who find dice interruption heavy, and it is non-negotiable that all three feel like the same game.

## 2.3 Time, initiative, and rounds — the hard problem

This is where every "real-time D&D" adaptation either dies or sings. Our answer:

> **Time is continuous. Rounds are a *resource window*, not a lock.**

### The model

- The world ticks continuously at 60 Hz. No turn lockstep.
- **Initiative is rolled** at the start of combat (`d20 + DEX`, full dice theater, visible order in a top-of-screen **Timeline**).
- Initiative does **not** gate when you may act. It sets:
  - the **beat** at which your per-round resources refresh (your Action/Bonus Action/Reaction/Move pools reset on your initiative count),
  - the resolution order for simultaneous effects,
  - the AI's decision cadence.
- Each creature has a **pool**: 1 Action, 1 Bonus Action, 1 Reaction, Movement = speed per round. Abilities declare their cost.
- Each ability additionally has a **Recovery** timer (e.g. 1.5 rounds for a heavy attack, 0.5 for a Bonus Action, instant for a cantrip combo). Recovery is what stops spam; the pool is what keeps it D&D.

**Why this works:** you get real-time responsiveness (never waiting for a turn), you get authentic D&D action economy (you cannot Action Surge into six attacks without spending the resource), and initiative still *matters* — rolling high means your pool refreshes early and you get to act before the enemy's refresh, which is exactly what high initiative means at a table.

### Tactical Pause

`Space` (or always-on in settings). Time freezes; the Tactical Cam grid appears; you can:
- queue an ability + target for your hero,
- issue commands to each companion (move-to, focus target, hold, use specific ability, ready/reaction assignment),
- inspect every actor's full sheet, conditions, and pending saves,
- preview AoE geometry, cover arcs, threat ranges.

Unpause and the queued orders execute simultaneously. This is the bridge for the CRPG half of the audience and it is the accessibility route for players with slower reaction times. It is a **first-class mode, not a crutch** — balanced around, meaning encounters assume its availability (we do not allow pause in a "Hardcore / Living Table" difficulty tier, which is where the twitch-action crowd plays).

### Reaction economy (make it legible)

Reactions are the most fun and least visible rule in 5e. We make them a **UI object**: each actor has a Reaction slot shown as a charged rune. When an enemy provokes (moves out of your reach, casts within your threat range, is marked by a readied action), the game shows a 0.35s **"!" prompt** with the reaction options; in Tactical Pause it's pre-assigned. Opportunity attacks, *shield*, *counterspell*, *hellish rebuke*, Protection fighting style, Sentinel — all read the same system.

## 2.4 Combat mapping, rule by rule

| D&D rule | Our adaptation | Action-game payoff |
|---|---|---|
| Attack roll vs AC | Identical. `d20 + ability + prof (+ magic) vs AC` | Every swing is a real roll; AC is a visible number on the Tactical Cam target ring |
| Critical hits (nat 20, double dice) | Identical, plus a **Crit Moment** cinematic and a class-specific crit effect (Fighter's Improved Critical widens the range; Assassin auto-crits on surprised targets) | The high point of the loop. Sell it hard |
| Damage types & resist/vuln/immune | Identical. Shown as icons; incoming damage is colour-telegraphed by type | Learn that the ogre resists bludgeoning by *seeing* it shrug off your mace |
| Cover (½ +2, ¾ +5, total) | Identical, computed from the SpatialGrid raycast against collision | Positioning becomes the skill ceiling. Crouching behind a low wall is a real +2 |
| Height advantage | **House rule:** attacking from ≥5 ft above grants advantage. Realistic, legible, hugely tactical | Reward climbing, rooftops, ledges, giants |
| Flanking | **House rule (optional per difficulty):** two allied melee attackers on opposite sides grant advantage | Makes party positioning a co-op puzzle |
| Opportunity attacks | Identical, via Reaction system with the "!" prompt | Dash/Disengage become real defensive tools |
| Reach | Identical (5 ft vs 10 ft for pikes, glaives, bugbears, dragons) | Polearms control corridors. Bugbears are terrifying in hallways |
| Prone | Identical (melee adv vs you, ranged disadv, half move to stand) | Shoves and knockdowns set up combos |
| Grapple / Shove | Contest of Athletics/Acrobatics; grappled = speed 0, escape via contest or a **struggle QTE** (a d20 roll with timing bonus, not pure twitch) | A real melee verb beyond "hit" |
| Two-weapon fighting | Bonus Action off-hand attack; Dual Wielder feat adds ability mod | Rogues and rangers feel fast |
| Extra Attack | Identical (2 at lvl 5, 3 at 11). Rendered as an attack **combo chain** with the same number of swings | Level 5 is a genuine power spike you can feel |
| Action Surge | Identical — one extra Action, refreshed on short rest | The "oh shit" button. Big VFX |
| Second Wind | Bonus Action, `1d10 + level` self-heal, once per short rest | Fighter sustain, teaches Bonus Actions early |
| Death saves | Identical: 3 successes / 3 failures, nat 20 = 1 HP, nat 1 = 2 fails. Cinematic slow-mo, heartbeat audio, the rest of the battlefield muffles | The most tense 30 seconds in the game |
| Downed state | At 0 HP you're prone and dying. In single-player, a companion may reach you and stabilise (Medicine check) | Creates rescue moments and party-dependency |
| Monsters' multiattack / legendary actions | Identical, but legendary actions are shown as **charges on the boss bar** so the player can predict them | Boss fights become readable rather than chaotic |
| Lair actions / regional effects | Tied to the round counter (initiative 20) with an on-screen warning beat | Environmental spectacle, telegraphed |

### Telegraphs: how enemies become readable

Every enemy attack has a **windup** with a ground-projected shape (arc for swing, circle for AoE, line for charge), coloured by damage type, duration scaled to the attack's power. This is the action-game contract: the player is never hit by something they could not have avoided. The d20 decides *whether* it lands; the telegraph decides whether you were *in it*.

## 2.5 Character creation & progression

- **Level range for Book One: 1–12** (matches the module exactly). Milestone levelling with a visible XP track as an optional toggle.
- **Creation flow:** Species → Background (grants skills, a feat, and a *narrative hook* that seeds side content) → Class → Ability scores (Standard Array / Point Buy / Roll-with-theater) → Appearance (MetaHuman-driven, deep but fast: presets first, sliders second) → Subclass at level 3 → Name/pronouns/voice.
- **Subclasses:** all SRD subclasses at launch; each one must have a distinct *verb*, not just numbers (Champion = wider crits; Battle Master = manoeuvre dice and reactive counters; Eldritch Knight = spell-weaving into combos).
- **ASI/Feats at 4, 8, 12** — presented as a full-screen "Chapter of Your Life" moment with dice theater and a preview of how it changes your kit.
- **Multiclassing:** supported, gated behind an in-world trainer and a narrative justification. Requires prerequisites checked by the sim.
- **Respec — the "Long Rest Reflection" system.** At any long rest, a character may retrain *one* decision (skill, tool, prepared spells always; subclass and feats at a gold + quest cost). Rationale: video-game players explore builds and a permanent bad choice is worse UX than a table, where the DM would just allow it. This is one of the few places we knowingly diverge from tabletop friction.
- **Companions** are full characters with their own sheets, levels, gear, subclass choices (player-directed or auto), approval tracks and personal quests. Party size: **4** (you + 3), matching the module's "four to six characters" tuning band at the low end for readability.

## 2.6 Rests & the adventuring day (P3 in practice)

The single most under-adapted D&D system in every video game, and our biggest pacing lever.

| Rest | Where | Recovers | Cost / Risk |
|---|---|---|---|
| **Long Rest** | Camp (safe zones), inns (paid, tiered quality), player home later | All HP, all slots, all hit dice to max, all long-rest charges | 8 hours of world time — clocks advance, the enemy plan progresses. Consumes rations. Interruptible by a night attack if you camped badly |
| **Short Rest** | Anywhere out of combat, 1 hour | Spend Hit Dice (`1d10 + CON` each, theatre), some class features, Action Surge, Warlock slots | **Wandering-monster check.** The world does not stop for you. This is the tension |
| **No Rest** | The Obelisk's influence | Nothing | In high-Resonance zones, resting is *denied or corrupted*: a long rest may grant a madness, or restore slots but cost HP. This is the horror pressure valve |

Design targets for the adventuring day: **6–8 encounters per long rest**, of which ~2 are hard/deadly, with the boss of a dungeon landing when the party is at ~30% resources if they played well and ~10% if they didn't. The Director tracks this and adjusts encounter composition — never the player's numbers.

## 2.7 Spellcasting

| Rule | Adaptation |
|---|---|
| Cantrips | Free, unlimited, and they are your **combo filler** — the light attacks between resource spends. *Fire bolt*, *ray of frost*, *shocking grasp* (advantage vs metal armour — a legible, fun interaction), *sacred flame* (DEX save, ignores cover), *mage hand* (a **puzzle and theft verb**, not just a spell) |
| Spell slots | Identical, tracked per level, consumed on cast. UI: a row of physical gem pips on the hotbar that shatter on use |
| Upcasting | Explicit toggle in Tactical Cam; shows the improved numbers before you commit |
| Casting time | 1 Action = full cast with a windup animation; Bonus Action = fast cast; 1 minute+ = a **Ritual Activity** with a progress ring, interruptible, usable out of combat only |
| **Concentration** | The most important combat system we ship. A concentrating caster shows a visible **tether** to the effect. On taking damage: CON save, DC = 10 or half the damage, whichever is higher. Failure = the spell collapses with a shattering VFX and the caster is briefly *shaken*. This creates: protection assignments, focus-fire tactics, interrupt plays, and real risk in maintaining *haste* or *spirit guardians* |
| Reactions in spellcasting | *Counterspell* and *absorb elements* are the "!" prompt system's heroes — a counterspell duel is a camera-event |
| Components | Verbal/Somatic abstracted into the animation. Material components with a **gold cost** consume inventory (component pouch tracked). *Silence* genuinely stops verbal casting — a tactical spell, not flavour |
| Prepared vs known | Prepared casters (cleric, druid, wizard) swap preparation at long rest via a **spellbook UI**. Spontaneous casters (sorcerer, bard) keep known-spells with metamagic |
| Wild Magic / metamagic | Wild Magic Surge is a full Roll Moment with reality-bending VFX. Sorcery points are a visible second resource |
| Scroll/wand use | One-shot consumables with a Use Magic Device check where the rules require it |

## 2.8 Conditions, damage, status

One unified `ConditionSystem` in the sim, one icon language in the UI, one duration model (rounds / minutes / until-saved / permanent). Every condition has:
- a **mechanical effect** (straight from SRD),
- a **presentation signature** (post-process, animation modifier, audio filter),
- a **removal list** (which spells/actions end it).

The horror-relevant ones get extra craft:

- **Frightened** — vignette closes, audio ducks, the source of fear is highlighted, and your character's AI resists moving toward it. Mechanically: disadvantage on checks/attacks while the source is in sight, can't willingly move closer.
- **Charmed / Dominated** — for companions, control *inverts*: the possessed ally becomes an enemy actor with their real statblock. This is the Obelisk campaign's signature moment and it must be survivable and reversible.
- **Blinded / Invisible** — implemented as real LOS rules in the SpatialGrid, not a debuff icon. Invisible enemies are still audible (spatial audio footstep layer) and can be revealed by flour, water, *faerie fire*, or a successful Perception contest.
- **Madness** (short/long-term/indefinite) — see 2.16. It is a Condition like any other, which means it is testable, saveable, and removable by *lesser restoration* / *greater restoration* — exactly as the module intends.

## 2.9 Exploration pillar

- **Perception Lens** (`R`): a diegetic "look closer" mode. Time slows, the audio focus narrows, and interactables/tracks/disturbances glow with an ink-outline in our 2D-codex style. Using it is a **Wisdom (Perception) check** with degree-of-success reveals — but *passive* Perception reveals the always-noticed layer without any input, so the player never feels punished for not spamming a button.
- **Traps:** three-stage. *Notice* (passive or active Perception, DC set) → *Understand* (Investigation/Arcana reveals the mechanism and the DC to beat) → *Choose*: avoid (path around), disarm (Thieves' Tools check with a timing-assist minigame that grants advantage on a good beat, never replaces the roll), or **trigger it deliberately** (a real tactic: lure enemies onto it).
- **Traversal:** Climbing/Athletics and Acrobatics checks with partial-progress modelling — failing a climb doesn't mean you fall from the top, it means you slip to the last hold and take a small amount of exhaustion. Jumping uses real 5e jump distances (STR score for long jump, athletics for high jump) which our grid can display as a ghost arc.
- **Hiding & stealth:** light level, noise, and cover determine whether a Stealth check is even possible; contested against enemy Perception (passive or active). Brush, shadow and verticality are stealth geometry. See 2.13.
- **Overland travel:** pace rules (fast/normal/slow) trade stealth and perception against speed; navigation is a Survival check; random encounters fire from a **Director-controlled table** keyed to time of day, region, noise, and story state. Fast travel exists but always costs a rest or a check — never free.
- **Environmental interaction:** burnable oil, collapsible supports, chandeliers, flooded rooms, gas pockets (fire + gas = a bad day), rope bridges, falling portcullises. The grid knows what's flammable, what's conductive (*shocking grasp* + water), and what supports weight.
- **Camp:** a physical, placeable object in the world. Long rest, companion conversations, cooking (buffs from rations + Survival), crafting, respec, journal review. Camping *location* matters: a defensible spot reduces night-attack chance; a scenic spot grants inspiration.

## 2.10 Social pillar — the part most adaptations get wrong

**Architecture:** dialogue is a node graph where every option carries `{approach, skill, DC, tone, consequences[], availability}`. Nodes resolve through the same `Resolve()` as combat.

Rules of the system:

1. **Checks are visible before you commit** (DC and your modifier shown), except where the DM would hide them (Insight vs Deception contests, some deception attempts). Settings toggle: *Show DCs* / *Show only your odds* / *Hidden*.
2. **Fail forward, always.** A failed Persuasion does not end the conversation — it changes it. The guard believes you're lying and now you're being escorted, or the merchant doubles the price, or the NPC will help but reports you. Every failure node must be authored to be *as interesting* as the success. This is a hard content requirement, enforced by a linter on the dialogue graph.
3. **Degrees of success** drive the quality of the outcome: pass by 5+ and you get the information *plus* a bonus (a key, an ally, a discount).
4. **Contests** are first-class: Deception vs Insight, Persuasion vs Persuasion, Intimidation vs a monster's Wisdom. Both rolls shown, opposed totals compared — full dice theater, because these are the game's best moments.
5. **Party interjection.** Companions in the scene can offer an alternative approach, take over the check with their better modifier, or contradict you (approval consequences). This is a *huge* source of emergent roleplay.
6. **NPC state machines.** Every named NPC has: disposition, knowledge set, schedule, fear level, secrets, and a **truth meter**. Repeated interaction, quest outcomes and world events move these. The town reacts to you as a whole, not per-quest.
7. **Deception has a cost curve.** Lies that succeed create liabilities tracked by the Director; the world can call them in later. This makes lying a real strategic choice rather than a free pass.
8. **Inspiration.** Earned by playing your Bonds/Flaws/Ideals (the game detects it via dialogue tags and action choices, and *tells you why*). Spendable to add a `d4→d12` (Bardic-flavoured, escalating) to any roll, or to reroll. Capped, visible, and given generously enough that players experiment with it.

## 2.11 Party & companion control

- **Direct control** of one hero, **hot-swap** at any moment outside of a cast/attack animation (0.2s swap, with a visual "focus" transition). This is the key action-game feel decision: you are not micromanaging, you are *conducting*.
- **Command radial** (hold a shoulder button, time slows to 25%): Follow / Hold Position / Move To / Focus Target / Use Ability / Ready Reaction / Disengage / Revive.
- **AI Profiles** per companion: Aggressive, Guarded, Support, Opportunist, Coward (yes — for a specific frightened NPC). Player-editable.
- Companions have **full character sheets** and gain XP; the player can equip them or let them auto-manage ("Adventurer's Instinct" — a simple, transparent gear-scoring AI).
- **Party of 4 max in the field**, with a camp roster for swapping. The module is tuned for 4–6; we tune encounters for 4 and expose a "Big Party" accessibility option that adds two hirelings.

## 2.12 Death, failure, and stakes

| Mode | Behaviour |
|---|---|
| **Standard** | Individual down → death saves → rescue or die permanently (with a memorial and a replacement recruit). Full party wipe → wake at last camp, world clocks advance by a day, some resources lost, story consequences fire (the enemy plan progressed). |
| **Story** | Downed allies auto-stabilise at 1 HP after 30s. Party wipe → respawn at last checkpoint with no clock advance. |
| **Living Table** (hardcore) | Permadeath for companions; ironman save; no Tactical Pause; no respec; death saves at disadvantage when below half HP. For the crowd that wants the real fear. |

**Critical design rule:** losing must always *advance the story*. The Obelisk campaign is built for this — failure states are transformation states (see 2.16). We never simply reload-the-checkpoint the player out of a bad hour.

## 2.13 Stealth, surprise, and alternate solutions

- **Surprise** is a real state: if the enemy doesn't perceive you at combat start, they can't act on their first initiative beat. Achieved by winning the Stealth vs Perception contest — the same rule, no homebrew.
- **Detection model:** sight cones (blocked by geometry and darkness), hearing radius (modified by surface, weather, your armour's noise value — heavy armour is loud, a real tradeoff), and suspicion meter with investigation behaviour (an alerted goblin *goes and looks*, then calls friends).
- **Non-lethal** takedowns (a called shot that leaves a target at 0 HP but stable) — because the module has interrogation content and because players want it.
- **Every combat encounter ships with at least two non-combat solutions** (stealth route, social route, environmental route). Enforced in the encounter-editor schema as a required field. This is P4 made structural.

## 2.14 The Director layer ("the DM is a system")

A simulation-side system that owns **pacing and world state**. It does not cheat; it *runs the module*.

- **Clocks.** Every faction goal is a countdown in world-time: the fanatics reassemble shards, the Redbrands consolidate, the town's Resonance rises, the kidnapped are transformed. Clocks are visible to the player in the journal as *rumour*, not as numbers. The player can accelerate or slow them.
- **Revelation lists.** Each mystery (who's behind the goblins, what the obelisk is, where the ritual happens) has an ordered, redundant set of clue nodes across multiple locations — the Alexandrian three-clue rule, implemented as data. It is impossible to soft-lock a mystery.
- **Encounter budget.** Director spends an abstract budget per session-day, choosing encounter difficulty from the XP-threshold tables, and adapts composition (not player power) to keep the day's shape right.
- **Pacing guards.** If the player has had three fights without a social or exploration beat, the Director biases the next node toward dialogue or discovery. If the party is under-resourced, it biases toward a shorter fight or a rest opportunity. Guardrailed by explicit caps so it never feels like rubber-banding.
- **Hidden rolls.** The only rolls the player doesn't see: DM-side Perception for ambushes, NPC Deception, some Insight. Shown in the log *after* the reveal, so transparency is preserved retrospectively (P5).
- **Honesty rule (non-negotiable):** the Director may never alter a die result, an AC, a DC, or damage. It may only choose *what happens next* from authored options. We will say this publicly; players will test us on it.

## 2.15 Difficulty & accessibility

**Difficulty tiers** change *rules*, not numbers, wherever possible:

| Tier | Changes |
|---|---|
| **Story** | Enemy damage −30%, Tactical Pause always available, no clock pressure, death is soft |
| **Standard** | Rules-as-written SRD. Our reference balance |
| **Tactical** | Enemies use optimal cover, focus fire, and reactions; clocks run fast; resources are scarce |
| **Living Table** | Permadeath, no pause, no respec, ironman, hidden DCs |

**Ruleset toggles** (independent of difficulty, because players want *authenticity* choices separate from *challenge* choices): house rules for height advantage, flanking, bloodied mechanics, gritty realism resting, and a "2014 rules" mode for the licensed content later.

**Accessibility:** full remapping, hold-vs-tap for every timed input, colourblind-safe telegraph patterns (shape as well as colour), dice-theater levels, screen-reader support for the codex/journal, adjustable QTE windows up to fully automatic, subtitles with speaker names and audio-cue captions, one-handed mode, aim/lock-on assist, motion-sickness camera options (no FOV kick on crits), photosensitivity-safe flash settings, and a **content-consent menu** for body horror, needles/transformation, spiders, drowning, and child endangerment (see 2.16 — this is essential for this campaign).

## 2.16 Book Two systems: the Obelisk layer

This is what makes it *The Shattered Obelisk* and not a generic dungeon crawl. Four interlocking systems.

### A. Resonance (the pressure meter)

Proximity to obelisk shards, psychic damage, reading Far Realm texts, and specific story beats add **Resonance** (0–100). It is visible as a violet filigree creeping across the UI frame and as an audio layer that thickens.

- **0–24 Untroubled** — nothing.
- **25–49 Attuned** — whispers give *clues* (a real mechanical benefit — the horror pays you).
- **50–74 Fraying** — hallucination encounters spawn, some NPCs react to you differently, minor madness risk on a failed WIS save.
- **75–100 Breaking** — long-term madness risk, transformation progress begins, powerful psychic abilities unlock.

Resonance *decays* away from shards and can be purged by *lesser restoration*, specific rituals, or story choices. It is a **resource the player can choose to spend** — high Resonance is dangerous *and* powerful. That choice is the theme of the campaign.

### B. Madness (SRD-faithful, gamified)

Uses the SRD madness tables directly — short-term (minutes), long-term (until cured), indefinite (permanent until *greater restoration*). Each entry is authored as a Condition with:
- a mechanical effect,
- a presentation signature,
- and a **narrative hook** (e.g. "You hear the obelisk's hum as a voice you recognise" → grants advantage on Investigation near shards).

Madness is never a pure punishment. Every madness has a use. That's how you make sanity systems fun rather than hateful.

### C. Transformation (the consent-gated horror track)

The module's ceremorphosis body-horror is its most powerful and most sensitive material. Our implementation:

- Gated behind an explicit **content-consent choice at the start of Book Two**, revisitable at any long rest, with three settings: *Full* (transformation happens, is visible, is a mechanic), *Suggested* (it happens to NPCs, never to you), *None* (replaced with a different consequence — psychic scarring).
- Where enabled: a **Transformation track** grants escalating powers (psychic resistance, a bonus action psychic attack, telepathy) at escalating costs (CHA-based social DCs worsen, NPCs fear you, a companion may leave, resting is corrupted). At the end state the player is offered a genuine choice — and it is a *playable* state with its own kit, not a game over.
- This is a **feature no tabletop adaptation has ever shipped properly**, because a table can't show it and a linear game can't allow it. We can do both.

### D. The Shard Race (the systemic spine)

The campaign's real structure is a **race**: three shards in the region, an enemy team pursuing them, and a ritual whose power scales with how many the fanatics hold.

- Each shard site is an open, order-free **node** (dwarven temple / haunted crypt / Underdark crossroads).
- The fanatics have their own clock and their own capabilities; they can win shards, and can steal ones you've secured (McGuffin keep-away).
- **Final encounter composition is a function of shard score.** 0 enemy shards = a weakened ritual and a fightable godlet-fragment. 3 enemy shards = Ilvaash manifests at full power, the town is half-transformed, and the ending reflects it.
- This gives us real replayability and makes the sandbox meaningful: player *choices about time* become the difficulty setting.

### E. The Far Realm (the technical set-piece)

Levels 7–8's plane shift is our rendering showcase: non-Euclidean geometry (portal-based rendering with recursive views), subjective gravity (per-volume gravity vectors), impossible architecture generated by PCG with hand-authored landmarks, an audio space with no reverb consistency, and a **Briny Maze** navigation system where the map is unreliable and the player must use psychic landmarks. Mechanics: subjective-gravity movement checks, a psychic library puzzle that reads the player's own journal, and a final multi-phase encounter where **damaging the obelisk backlashes onto the fanatics** — a real tactical puzzle the module hands us.

## 2.17 Book One content map (structural analogue)

| Module beat | Our analogue | Systems exercised |
|---|---|---|
| Escort job, goblin ambush, kidnapped patron | Opening tutorial: caravan escort, ambush, a captured employer | Combat tutorial, dice theater, cover, reactions |
| Cragmaw Hideout | **Grimhollow Warren** — first real dungeon | Stealth, traps, exploration, first boss (bugbear) |
| Arrival at the town | **Kesseling's Ford** — frontier boomtown hub | Social, NPC state machines, faction reputation, shops |
| Redbrand thugs / Glassstaff | **The Ashen Coin** gang and its disguised wizard leader | Combat + social + investigation, first moral choice |
| Tresendar Manor, the banshee | Manor dungeon + a bound spirit who trades a favour | Undead rules, fear, negotiation with a monster |
| Old Owl Well, the necromancer | A hobgoblin-led site + a necromancer who wants an errand done | Faction play, moral ambiguity, undead minions |
| Thundertree, the druid, the dragon | A blighted village, a druid ally, a young dragon in a ruined tower | Poison/blight, a landmark boss, agatha-style ghost |
| Wave Echo Cave & the Forge of Spells | **The Sunken Delve** and its dwarf-ghost forge | Long dungeon, crafting unlock, tier-1 capstone boss |
| Obelisk revelation | Shards discovered beneath the town; Resonance introduced | All Book Two systems boot here |

Levels 1–5 across Book One; the Obelisk layer unlocks at 5 and runs to 12.

## 2.18 Verification & balance tooling

- **Rules conformance suite:** every SRD glossary entry becomes a test with the book's own worked examples as golden outputs. Target: 100% of glossary terms covered.
- **Property tests:** damage ≥ 0, HP clamps, AC bounds, no infinite reaction loops, round counters monotonic, no ability usable without resource.
- **Headless balance harness:** simulate N=10,000 combats per encounter across party compositions and difficulty tiers; report TTK, win rate, resource depletion curve, and "deadly" threshold compliance. Every encounter in the game has a generated balance report attached to it in the editor.
- **Dialogue graph linter:** every failure node must have an authored consequence; no dead ends; no orphan nodes; every check must have a DC and a skill.
- **Golden-master save tests:** saves from build N must load and simulate identically in build N+1.
- **Telemetry:** roll distributions, ability usage, death locations, dialogue branch popularity, clock completion rates.

## 2.19 Production plan

| Phase | Duration | Deliverable | Exit criteria |
|---|---|---|---|
| **0 — Core loop prototype** | 8 wks | `d20core` library + greybox combat room | The loop is *fun* with cubes. Dice theater lands. 4 enemies, 3 allies, cover/flanking/reactions all readable |
| **1 — Vertical slice** | 16 wks | **Grimhollow Warren**: full art, full systems, one companion, one class, character creation, dialogue, first boss | A 45-minute slice that a stranger plays and asks for more. Art direction locked |
| **2 — Hub & sandbox** | 24 wks | Kesseling's Ford + region, 4 core classes, camp/rest, NPC state machines, faction system, day/night | The town feels lived-in and reactive; 6+ hours of content |
| **3 — The Obelisk layer** | 20 wks | Resonance, madness, transformation, shard race, clocks | The horror half plays as well as the heroic half; consent systems tested |
| **4 — Endgame & the Far Realm** | 16 wks | Sunken Delve, Illithinoch analogue, plane shift, final boss, endings | Full 1–12 arc completable, multiple endings by shard score |
| **5 — Polish, cert, launch** | 14 wks | Balance passes, accessibility audit, localisation (10+ languages), performance, platform cert | 60fps on base current-gen, 1% crash-free target |

**Total: ~118 weeks** (~2¼ years) to full production ship, assuming a team of **28–38** at peak: 4 design, 10 engineering (4 sim/systems, 4 tools, 2 rendering), 9 art (3 env, 3 char, 2 VFX, 1 tech art), 2 animation, 2 audio, 3 narrative, 4 QA, 2 production.

**Phase 0 and 1 are the ones to fund first**, and Phase 0 is nearly free — it's what the prototype in this workspace demonstrates.

## 2.20 Top risks

| Risk | Severity | Mitigation |
|---|---|---|
| No WotC licence → can't use Phandelver/D&D branding | **Critical** | Route B by default: SRD-native, original names, structural analogue. Pitch deck for Route A prepared in parallel. Content layer makes a licensed swap cheap |
| Real-time dilutes D&D's tactical soul | High | Dual camera + Tactical Pause + initiative-as-resource-window. Playtest both audiences from Phase 0 |
| Dice theater interrupts flow | High | Three-tier settings, compact popups, feed-only for routine rolls. Measured in playtests as "time-to-resume" |
| Scope: full 1–12 + character creator + Far Realm tech | High | Cut multiclassing and epic-tier content to post-launch; ship Book One at 1–12 with 4 core classes and 4 more as a free update |
| Nanite/Lumen performance on base consoles | Medium | Art direction is painterly, not photoreal — that is *also* the performance strategy. Scalability tiers authored from Phase 1 |
| Body-horror content backlash | Medium | Consent menu, three levels, defaulting to Suggested for the transformation track, clear content warnings before Book Two |
| Complexity onboarding for non-D&D players | Medium | A "Rules Explainer" layer: every term in the UI is hoverable and links to a beautifully illustrated 2D codex entry. Tutorials teach one rule per encounter, in fiction |

## 2.21 What we validate next (the prototype's questions)

The playable prototype delivered alongside this document tests exactly five hypotheses:

1. Does **initiative-as-resource-window** feel responsive *and* D&D?
2. Does **dice theater** add excitement rather than interruption?
3. Does **positioning** (cover, flanking, height, engagement) create the tactical depth we claim?
4. Do **reactions and telegraphs** make enemies readable?
5. Does a **skill check in dialogue with fail-forward** land emotionally?

If those five hold, we fund Phase 1. If any fails, we redesign it in greybox where it costs nothing.

---

*End of foundation document. Next documents in the stack: `01_SIMULATION_CORE_SPEC.md` (d20core API), `02_COMBAT_DESIGN.md`, `03_CONTENT_PIPELINE.md`, `04_BOOK_ONE_NARRATIVE.md`.*
