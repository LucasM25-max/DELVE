# DELVE — GDD-03 NEVERWINTER TRAINING YARD: COMPLETE BUILD SPECIFICATION
## Zone `YRD` — "The Rockseeker Contract" prologue level, buildable from this document alone

**Version:** 1.0 (2026-09-19)
**Standalone guarantee:** every rule, number, string, model, texture, audio cue and VO line needed to build and test this zone is contained here. Rules texts are repeated inline at each teaching station (verbatim 2024 PHB wording where quoted) so no rulebook or prior document is required.
**Conventions:** coordinates in metres, origin (0,0,0) = centre of the gate's inner threshold at floor level; **+X = east, +Y = north, +Z = up**; rotations in degrees about Z (0 = facing +Y/north). IDs: `M_` models, `T_` textures/materials, `A_` audio, `VO_` voice, `VFX_` effects, `L_` lights, `TR_` triggers/volumes, `UI_` interface elements. Area keys A–M per §3.

---

## 1. ZONE SUMMARY

- **Identity:** walled muster-yard of the Neverwinter City Guard's contract company, behind the harbour district; dawn of the contract day; the whole prologue (tutorial + in-world character creation) happens here, then the party departs through the gate (GDD-01 §6).
- **Play time:** 18–22 min full, 10–12 min veteran skip; re-visitable practice sandbox after departure is NOT supported in Ch1 (yard unloads; practice bell persists as journal "training recap" cards instead).
- **Size:** interior 44 m (E-W) × 44 m (N-S); R1 threshold lane 60 m south of gate; R2 vista beyond.
- **Time of day:** 06:40 at T0 → 08:20 at departure (sun animates 8° → 21° elevation, azimuth 102° → 118°; colour 2400 K → 4200 K).
- **Weather:** clear, light harbour mist (height fog 0–2 m, density 0.08, burns off by 07:30).
- **Performance budget:** ≤ 200 draw calls (instancing on), ≤ 1.4 M visible triangles at yard centre, ≤ 600 MB streamed texture resident, 60 fps target mid-spec PC / current-gen console; no streaming inside zone (single level instance); navmesh single tile set; RulesGrid lattice 5 ft = 1.524 m aligned to axes, origin (0,0).
- **Rules sandbox overrides active in YRD:** no character death (sparring yields at 1 HP; falls/traits clamped to leave 1 HP); dummies reset after 6 s idle; infinite training arrows; rests free and instant-result; no alert states; no weather gameplay.

---

## 2. SCOPE RINGS & BOUNDARIES (what Neverwinter IS in this game)

| Ring | Content | Playable? | Build cost class |
|---|---|---|---|
| **R0** | Yard interior (areas A–M below) | Fully playable | Full-fidelity gameplay space |
| **R1** | Gatehouse passage + forecourt + 60 m dock lane south (crates, rope coils, gull perches, closed **city gate** at lane end with two guard NPCs) | Playable threshold: player may walk, look, hear city life; tutorial beacons never point here; leaving R0 pre-signing is allowed and Gundren barks `VO_GUN_014` | Prop-light street, no interiors |
| **R2** | The city of Neverwinter: skyline silhouettes, harbour cranes, mountain backdrop, sky | **Never entered.** Layered vista: 4 km matte-painted backdrop card + 300–800 m silhouette shell meshes with emissive window cards + volumetric sky. Seen over yard walls, from archery loft, and in menu drift | Matte + shells only |

**Boundary logic (diegetic, no invisible walls inside R0/R1):** yard walls (4.2 m, walkway above, no player access — "Guard orders: the wall walk's closed for muster."); gate portcullis half-lowered until T11 (Corwin lifts it at departure); dock lane ends at closed city gate (`M_DOCK_GATE_CITY`) with guard pair and rope cordon — string on approach: `The city gate is barred for the morning muster. The yard's contract is yours, not the city's.`; postern doors in yard walls = locked doors with strings (`Locked. The sergeant keeps the keys — and the sergeant keeps the keys.`).

---

## 3. AREA MAP & WALKTHROUGH INDEX

Plan (metres, origin at gate threshold). Walls at x = ±22, y = 0 (south, gate centred) and y = 44 (north); east/west walls full length.

```
            N (y=44)
   +------------------------------------+
   | H archery lane      |   D tack rm  |
   |  targets y42        |   (12..18,   |
   |  loft (-20,26)      |    30..38)   |
   | G dummies (-12,20/24)   K rest (10,32)
   | B desk (-10,8)   M bell (0,22)  E contract (8,24)
   |        C pedestals (-5..5,15)  L crates (6,22)
   |        F lane (0,2..12)        I brush (12..20,8..24)
   |            A gate (0,0)        J sparring (12,10)
   +------------------------------------+
            S → R1 dock lane → R2 vista
```

| Area | Name | Centres | Teaches / hosts | Spec § |
|---|---|---|---|---|
| A | Gate & forecourt (+R1 lane) | (0,2) | T0 arrival, T11 departure, R1 threshold | 4.A |
| B | Muster desk & contract board | (−10,9) | C1 species, C3 background, C4 abilities | 4.B |
| C | Class pedestals & arms rack | (0,16) | C2 class choice | 4.C |
| D | Tack room & shield mirror | (15,34) | C5 appearance, T2 first-person | 4.D |
| E | Contract table & canopy (Gundren) | (8,24) | T5 signing, C6 name, save creation | 4.E |
| F | Movement lane | (0,7) | T1 movement/camera prompts | 4.F |
| G | Dummy line | (−12,22) | T3 basic attack, T4 bonus/masteries | 4.G |
| H | Archery lane & loft | (−18,34) | T6 ranged, cover, height | 4.H |
| I | Brush lane | (16,16) | T7 hide/surprise | 4.I |
| J | Sparring circle | (12,10) | T8 full turn-based loop | 4.J |
| K | Rest nook | (10,32) | T9 short rest/Hit Dice | 4.K |
| L | Pack, folio & codex lectern | (6,22) | T10 inventory/codex/options | 4.L |
| M | Practice bell | (0,22) | sandbox reset, replay beats | 4.M |

**Guided route order:** A(T0) → F(T1) → D(T2) → G(T3,T4) → E(T5) → H(T6) → I(T7) → J(T8) → K(T9) → L(T10) → A(T11 departure). Beacons (wisp `VFX_BEACON`, toggleable) mark the next station only after the current beat completes or is skipped.

---

## 4. RULES PRIMER (self-contained; repeated per station where taught)

**R1 The d20.** Whenever an outcome is uncertain: roll 1d20 + ability modifier + proficiency bonus (if proficient) vs a Difficulty Class (check/save) or vs Armour Class (attack). Meet or beat = success. Natural 20 on an attack = critical (double the damage dice); natural 1 on an attack = miss.
**R2 Advantage/Disadvantage.** Roll two d20, take higher (Advantage) or lower (Disadvantage). They cancel each other out entirely.
**R3 Armour Class & attacks.** Attack roll = d20 + mod + PB vs AC. Cover modifies the target's AC: **half cover +2, three-quarters cover +5, total cover = cannot be targeted** (applies to AC and Dexterity saving throws).
**R4 Ability checks & passives.** Check = d20 + mod (+ PB if proficient) vs DC. Passive score = 10 + mods, used when the DM/world observes without rolling (Perception most often).
**R5 Surprise & hiding.** A creature that fails to notice a threat is **surprised**: it cannot act or take reactions on its first turn. Hiding = DEX (Stealth) check vs the observer's passive Wisdom (Perception) (or active Search); you must break line of sight/obscurement first; attacking from hiding grants Advantage and ends the hide.
**R6 The turn.** On your turn: move up to your Speed (split freely), **one Action**, **one Bonus Action** (only if a feature grants one), **one free object interaction**. **One Reaction** per round, refreshed at the start of your turn. End Turn passes the queue.
**R7 Movement & terrain.** Difficult terrain costs **double** movement (briars, rubble, knee-deep water). Standing from Prone costs half your Speed. Prone: attacks from it have Disadvantage; attacks against it have Advantage within 5 ft, Disadvantage beyond.
**R8 Opportunity attacks & reactions.** When a creature you can see **leaves your reach** without Disengaging, you may use your Reaction for one melee attack. Disengage prevents them for the turn. Dash = +Speed movement.
**R9 Non-lethal knock-out.** When a **melee** hit (bludgeoning source, incl. unarmed) would reduce a creature to 0 HP, the attacker may choose to leave it **unconscious and stable** instead (capture rule; the yard's sparring enforces this automatically).
**R10 Resting.** **Short rest** = 1 hour: spend Hit Dice (class die + CON mod each) to regain HP. **Long rest** = 8 hours (safe place required): all HP, all slots/features, half Hit Dice back.
**R11 Height (house rule, shown in Codex as such).** Ranged attacker ≥ 3 m (10 ft) above target = Advantage; ≥ 3 m below = Disadvantage.
**R12 Weapon Masteries (verbatim PHB 2024).** Usable only by characters with a feature granting them (Fighter/other Weapon Mastery; yard dummies demo all):
- **Cleave** — If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon's damage, but don't add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn.
- **Graze** — If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.
- **Nick** — When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.
- **Push** — If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.
- **Sap** — If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.
- **Slow** — If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn't exceed 10 feet.
- **Topple** — If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used for the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.
- **Vex** — If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.
**R13 Conditions used in yard:** Prone (R7), Restrained (Speed 0, attacks vs it Advantage, its attacks Disadvantage — demo only at snare later), Unconscious (sparring yield state: prone, unaware; wakes at 1 HP after spar).
**R14 Dice theatre.** Every roll renders as a physical die tumbling in-world beside the action, landing with the natural face visible; modifiers tick on beside it; result banner states plain language ("HIT — 17 vs AC 15").

---

## 4. AREA-BY-AREA BUILD SPECIFICATION

Template per area: purpose → geometry & surfaces → prop placement table → triggers & logic → rules payload taught (inline) → interaction strings → NPC behaviour → camera → lighting → audio → VFX → fail-forward/skip.

### 4.A — AREA A: GATE, FORECOURT & DOCK LANE (R0 entry + R1 threshold)

**Purpose:** T0 fade-in arrival; first vista read of Neverwinter (R2); R1 threshold walk; T11 departure sequence.
**Geometry & surfaces:** gatehouse = stone arch block 8 m wide × 5 m high vault straddling south wall at x −4..4; portcullis `M_YRD_PORTCULLIS` raised (day state); double doors `M_YRD_GATE_DOOR` open, pinned to wall; forecourt cobble `T_YRD_COBBLE` 14 × 6 m (y 0..6); yard floor beyond = packed dirt `T_YRD_DIRT`; south of gate: R1 dock lane 6 m wide × 60 m, cobble worn `T_YRD_COBBLE_WORN`, building shell facades both sides (sealed doors, `M_DOCK_FACADE_L/R` ×4 each side, window cards emissive off at dawn).
**Prop placement (id · model · pos · rot · note):**
- A1 `M_YRD_GUARD_BOX` (2.5,1.5,0) r0 — Corwin's post, shutter open.
- A2 `M_YRD_NOTICE_BOARD` (−2.5,1.5,0) r0 — muster notices (readable: `UI_A_BOARD` string).
- A3 `M_YRD_BARREL` ×2 (3.4,2.2)/(3.6,2.9) r15/40 — set dressing.
- A4 `M_YRD_LANTERN_POST` ×2 (±3.2,0.8) — dawn-lit practicals.
- Lane: A5 `M_YRD_CRATE_STACK` (±2.5,−8)/(−2.5,−16)/(2.5,−24) varied rot; A6 `M_DOCK_ROPE_COIL` (−2,−12),(1.8,−20); A7 `M_DOCK_GULL_POST` ×3 (2,−14/−26/−38) with gull cards; A8 `M_YRD_BARREL` row (2.5,−30..−34) ×3; A9 `M_DOCK_GATE_CITY` (0,−60) closed, 6 m wide × 7 m high, guard pair NPCs at (±1.2,−58); A10 `M_YRD_ROPE_CORDON` (0,−56) posts+rope.
**Triggers & logic:**
- `TR_A_ARRIVE` sphere r2 @(0,3): on load-complete → fade from loading seal (GDD-02 §3.3), input on, `AMB_YRD_DAWN` start, `VO_GUN_001` spatialised from E (Gundren visible waving across yard), beacon wisp to F.
- `TR_A_LANE` sphere r3 @(0,−4) first-entry → `VO_GRD_001`, journal margin note `STR_J_LANE`.
- `TR_A_CITYGATE` sphere r4 @(0,−54) → UI card `UI_A_CITYGATE` (barred string); guards cross arms anim.
- `TR_A_DEPART` box x±3,y −1..1: if !signed → `VO_GRD_003` + beacon snap to E; if signed & T10 done → T11: wagon `M_YRD_WAGON` + oxen ×2 spawn at forecourt (2 s roll-in), Gundren&Sildar mount, RIDE montage handoff (GDD-01 §14.3), zone unload at montage cut.
- Pre-signing loiter in lane > 45 s → `VO_GUN_014` once.
**Rules payload:** none new; movement basics deferred to F. Vista read card on first look up over wall (look input held 2 s at wall): `UI_A_VISTA`: `Neverwinter — the City of Skilled Hands. Somewhere south of here, a dwarf and a map are already in trouble.`
**NPC:** Corvin (guard): home A1; idle: leans, scans lane; blocks nothing (cordon does).
**Camera:** T0 opens in third-person default (GDD-01 §3.1); first-person allowed immediately (parity).
**Lighting:** `L_SUN_DAWN` global (§10); `L_A_LANTERN` ×2 warm 2400 K point @ A4; gatehouse interior bounce card.
**Audio:** `AMB_YRD_DAWN` (bed: gulls 20–40 s random `A_ONE_GULL_CRY`, harbour bell ~90 s `A_ONE_CITY_BELL`, rope creaks, distant blade-clacks); `A_ONE_GATE_CREAK` wind gusts; `A_LOOP_FLAG_SNAP` gatehouse flag; lane adds `AMB_DOCK_LANE` (city murmur, cart rumbles, gull colony).
**VFX:** `VFX_MIST_GROUND` height fog 0–2 m until 07:30; `VFX_GULL_FLOCK` distant circling cards; `VFX_BEACON` @ F after T0.
**Fail-forward/skip:** departure gated by signature only; lane is optional content (no beat fails).

### 4.B — AREA B: MUSTER DESK & CONTRACT BOARD (creation: species / background / abilities)

**Purpose:** C1 species, C3 background (book hooks verbatim), C4 ability scores.
**Geometry:** raised dais 3 × 2 m × 0.2 m at (−10,9.5); desk faces south.
**Props:** B1 `M_YRD_DESK_MUSTER` (−10,9) r180; B2 `M_YRD_LEDGER_BOOK` on desk (−10.3,8.8); B3 `M_YRD_STOOL` (−10,10.4); B4 `M_YRD_BOARD_CONTRACT` (−10,11.2) r0 on posts; B5 `M_YRD_PAPER_SHEET` ×12 pinned on B4 (the backgrounds); B6 `M_YRD_ABACUS` (−9.4,8.9); B7 `M_YRD_DICE_CUP` + dice (−9.1,8.7); B8 `M_YRD_INK_WELL` (−10.6,8.7); B9 `M_YRD_LANTERN_POST` (−11.5,7.5).
**Triggers & logic:**
- `TR_B_SPECIES` box 3×2 @(−10,7.6): interact `F` → ledger UI: species list (Human, Elf, Dwarf, Halfling, Dragonborn, Gnome, Half-Orc, Tiefling — 2024 PHB). On choose: 0.8 s body morph blend; trait card (verbatim summary: Size, Speed, darkvision 60 ft where applicable, key trait line); clerk comment `VO_CLK_002a..h` per species.
- `TR_B_BG` box 3×2 @(−10,11): interact → board UI: 12 letters = backgrounds with **verbatim hook texts**:
  - Acolyte: `The frontier town of Phandalin is resilient, but organized religious resources are scarce. Your temple in Neverwinter sent you to Phandalin to pray and offer communion with like-minded faithful.`
  - Charlatan: `You've planned your latest get-rich-quick scheme. The townspeople of Phandalin have never heard of what you're selling, and you hope to establish a customer base.`
  - Criminal: `You're wanted for crimes in Neverwinter, and perhaps you're exiled from the city. Phandalin is a small bastion of civilization where you can lie low and no one will be the wiser.`
  - Entertainer: `You've spent time in Neverwinter and love performing for audiences, but you need new experiences from which to draw inspiration for your art. Traveling to Phandalin will provide new material for your work, and its watering holes promise eager crowds.`
  - Folk Hero: `You may have humble origins, but you made your name as a hero in the wilds outside Neverwinter. You need new adventures, so you've set off for the frontier of Phandalin.`
  - Guild Artisan: `You learned a useful trade in Neverwinter, but the city is home to too many artisans with that skill. Now, you're heading to Phandalin, where you hope to start a lucrative business.`
  - Hermit: `You've spent a lot of time in the wilds outside Neverwinter, but you've always kept a home in the city. You've decided to move somewhere rural, and Phandalin seems like the perfect place.`
  - Noble: `Your family is based in Neverwinter but owns property throughout the Sword Coast region. You recently inherited a cottage in Phandalin and must inspect the place before you decide to keep or sell it.`
  - Outlander: `You spent your youth with a guardian who lived a simple life in the wilds outside Phandalin, but later you moved to the city. Now an adult, you've decided to return to the area where you feel most at home.`
  - Sage: `In the academic halls of Neverwinter, you studied the region's historical alliance between Phandalin and its neighbors. The fate of the lost mine of Phandelver has always fascinated you, so you're traveling to Phandalin to discover whether any locals know rumors of its fate.`
  - Sailor: `You've sailed ships along the Sword Coast, but a brush with death made you rethink your profession. You're headed to Phandalin to decide what's next.`
  - Soldier: `You are a member of the Neverwinter Guard, and you suffered a terrible injury in the line of duty. You healed, but you're not ready to return to work yet. Until you are, you're taking easy jobs protecting merchant wagons headed to Phandalin.`
  On choose: paper unpins, flies to folio (`VFX_PAPER_FLY`); proficiency card (skill proficiencies + tool/language per background, verbatim-short).
- `TR_B_ABIL` box 2×2 @(−9,8): interact → methods UI: **Point buy** (27 points; cost table 8=0,9=1,10=2,11=3,12=4,13=5,14=7,15=9), **Standard array** (15,14,13,12,10,8), **Roll** (4d6 drop lowest ×6, dice theatre per R14). Live belt-tag modifiers update (modifier = (score−10)/2 rounded down, verbatim rule card).
**Rules payload inline:** R1, R4; ability modifier table; species trait summaries; background proficiencies.
**Strings:** `UI_B_LEDGER` `The muster ledger — blood and breed: choose your species.` · `UI_B_BOARD` `Letters of introduction — choose the background that sent you south.` · `UI_B_CUP` `The clerk's dice cup — fate, if you trust it; beads, if you don't.`
**NPC:** Clerk Odile Vess home B3; idle shuffle/stamp; on approach `VO_CLK_001`; species `VO_CLK_002a..h`; abilities `VO_CLK_003`; background `VO_CLK_004`.
**Camera:** station open → 2 s push to over-desk framing; release on close.
**Lighting:** `L_B_LANTERN` warm point @ B9; dawn rake across papers.
**Audio:** `A_ONE_PAGE_TURN`, `A_ONE_QUILL`, `A_ONE_STAMP_THUNK`, `A_ONE_DICE_CUP_SHAKE`, `A_ONE_DICE_ROLL_TABLE`, `A_ONE_PAPER_UNPIN`.
**VFX:** `VFX_PAPER_FLY`; `VFX_BEACON` → C after all three chosen (or skip-marked).
**Fail-forward:** all choices revisitable until signing; clerk never blocks.

### 4.C — AREA C: CLASS PEDESTALS & ARMS RACK (creation: class)

**Purpose:** C2 class choice with hologram demos.
**Props:** C1 `M_YRD_PEDESTAL_CLASS` ×4 at (−5,15)/(−1.7,16)/(1.7,16)/(5,15) r0, each with class totem: sword+shield slab / prayer stone `M_YRD_PRAYER_STONE` / spell lectern `M_YRD_LECTERN_SPELL` / shadow post `M_YRD_SHADOW_POST`; C5 `M_YRD_ARMS_RACK` (0,18) full weapon set (visual catalogue); C6 `M_YRD_WHETSTONE_POST` (−6.5,16.5).
**Triggers:** `TR_C_FIGHTER/CLERIC/WIZARD/ROGUE` spheres r1.2 at pedestals: interact → 6 s hologram demo (`VFX_HOLO_*`): Fighter phantom cleaves two straw bales; Cleric phantom rings a trainee in radiant ward then mends wounds; Wizard phantom cones burning hands into a straw pile; Rogue phantom vanishes in smoke and reappears behind a dummy. Demo ends: starting kit equips on player body (swap anim), class card opens.
**Class cards (verbatim-short, 2024 PHB):**
- **Fighter** — Hit Die d10; Primary Strength or Dexterity; starting proficiencies: all armor, shields, martial weapons; Str/Dex/Con saves; level 1: Fighting Style, Second Wind (2 uses), **Weapon Mastery** (2 weapons); no spells.
- **Cleric** — Hit Die d8; Primary Wisdom; light armor, shields, simple weapons; Wis/Cha saves; level 1: Spellcasting (2 cantrips, 2 slots), Divine Order feature; no Weapon Mastery.
- **Wizard** — Hit Die d6; Primary Intelligence; no armor, simple weapons; Int/Wis saves; level 1: Spellcasting (3 cantrips, 2 slots, spellbook), Arcane Recovery; no Weapon Mastery.
- **Rogue** — Hit Die d8; Primary Dexterity; light armor, simple + martial? (simple weapons, longswords, rapiers, shortswords, hand crossbows); Dex/Int saves; level 1: Expertise (2), Sneak Attack 1d6, Thieves' Cant, **Weapon Mastery** (2 weapons); no spells.
Starting equipment lists verbatim-short per class shown on card and granted at signing.
**Rules payload inline:** R12 (which classes hold Weapon Mastery: Fighter & Rogue at level 1), R1 (Hit Die → HP at level 1 = max + CON mod).
**NPC reaction barks:** Sergeant `VO_SGT_002a..d` per class chosen (Fighter: `Sword and shield! Good. The yard'll teach you the rest.` Cleric: `A praying soldier still loads a punch. Fine.` Wizard: `Books burn, wizard. Stand behind the shield-wall, eh?` Rogue: `Keep them hands visible in MY circle, knife.`).
**Camera:** demo = 3 s orbit around pedestal, skippable by movement input.
**Audio:** `A_ONE_PEDESTAL_TURN` (stone grind), `A_ONE_HOLO_SHIMME`, `A_ONE_RACK_RATTLE`, demo-specific whoosh/impact reuses `A_ONE_SWING_WHOOSH`, `A_ONE_FIRE_WHOOSH`, `A_ONE_RADIANT_CHIME`, `A_ONE_SMOKE_POOF`.
**Fail-forward:** re-choose free until signing; if player reaches T3 beat time without class, Gundren walks to C: `VO_GUN_005b` `The pedestals aren't going to choose for ye, hero.`

### 4.D — AREA D: TACK ROOM & SHIELD MIRROR (creation: appearance; T2 view toggle)

**Purpose:** C5 appearance; first first-person toggle teaching.
**Geometry:** tack-room shell 6 × 8 m interior, door gap south at (12,30); roof on; interior pegs with saddles/bridles; rug.
**Props:** D1 `M_YRD_TACK_ROOM` shell (12..18,30..38); D2 `M_YRD_MIRROR_SHIELD` (15,34) r180 on stand, 1.2 m polished shield; D3 `M_YRD_RUG` (15,32.5); D4 `M_YRD_LANTERN_HOOK` ×2 (13,32)/(17,32).
**Triggers:** `TR_D_DOOR` plane @ door first pass → `A_ONE_DOOR_CREAK_TACK`; `TR_D_MIRROR` sphere r1.5 @(15,32.5): interact → appearance UI (face/hair/skin/voice presets; reflection live-updates; first-person preview button). First `V` toggle anywhere afterwards → prompt `UI_D_VIEW`: `Press V to see through your own eyes. Press V again for the shoulder view.` + `VO_GUN_002`: `Ha! Look at yerself. Eyes front, chin up — that's an adventurer's face, or close enough.`
**Rules payload:** none (cosmetic). Voice preset drives player-bark pitch only.
**Camera:** mirror UI forces first-person preview pane; world camera unchanged.
**Lighting:** `L_D_LANTERN` ×2 warm interior.
**Audio:** `A_LOOP_TACK_LEATHER_CREAK`, `A_ONE_MIRROR_SHINE`, `A_ONE_DOOR_CREAK_TACK`.
**Fail-forward:** appearance re-openable at mirror until departure.

### 4.E — AREA E: CONTRACT TABLE & CANOPY (Gundren; C6 name; T5 signing; save creation)

**Purpose:** contract signing, name entry, save-slot creation, quest journal open, tutorial sandbox unlock.
**Props:** E1 `M_YRD_CANOPY` 4 × 3 m @(8,24) h2.6 Rockseeker brown/gold; E2 `M_YRD_TABLE_CONTRACT` (8,24); E3 `M_YRD_STOOL` ×2 (7.2,23.2)/(8.8,23.2); E4 `M_YRD_CONTRACT_SCROLL` (8,23.7); E5 `M_YRD_QUILL_INK` (8.5,23.6); E6 `M_YRD_LANTERN_TABLE` (7.5,24.4).
**NPC Gundren:** home (8,25.2) r180; idle: taps scroll, checks purse; wanders E→G→H loop after signing (stops 20 s each, barks context lines).
**Triggers & logic:** `TR_E_TABLE` sphere r2 @(8,22.8): interact:
 - if creation incomplete → `VO_GUN_003`: `The ledger wants your blood, the pedestals your trade, the board your story. Then my quill gets its turn.` + beacons to missing stations.
 - if complete → C6: name entry (quill writes letters as typed; random-name die button rolls in dice theatre), then hold-`F` 1.5 s signing (quill scratch loop), wax stamp (`A_ONE_WAX_STAMP`), `MUS_STING_SIGN`, **save slot created** (name = slot label), journal opens: quest `The Rockseeker Contract` with hook text verbatim: `You're in the city of Neverwinter when your dwarf patron and friend, Gundren Rockseeker, hires you to escort a wagon to Phandalin. Gundren has gone ahead with a warrior, Sildar Hallwinter, to attend to business in the town while you follow with the supplies. You will be paid 10 gp each by the owner of Barthen's Provisions in Phandalin when you deliver the wagon safely to that trading post.` T5 line `VO_GUN_004`: `Ten gold each when the wagon lands at Barthen's in Phandalin. My brothers' find is worth a hundred wagons, but coin first, glory after — sign here.` then `VO_GUN_005`: `Right! The yard's yours till the oxen are hitched. Swing at anything straw — it deserves it.` Sandbox unlocks (bell M active; beats G–L open).
**Camera:** signing = slow push to two-shot over table (3 s), hold through stamp.
**Lighting:** `L_E_LANTERN` warm table pool.
**Audio:** `A_ONE_QUILL_SCRATCH_LONG`, `A_ONE_WAX_STAMP`, `MUS_STING_SIGN`, `A_LOOP_CANOPY_FLAP`.
**VFX:** `VFX_WAX_GLOW` brief.
**Fail-forward:** signing repeatable if name edit desired pre-departure (slot relabelled).

### 4.F — AREA F: MOVEMENT LANE (T1 movement & camera)

**Purpose:** T1 movement/camera prompts; difficult-terrain primer.
**Geometry:** packed-dirt strip x −2..2, y 2..12 with chalk edge decals `T_YRD_DECAL_CHALK`; briar planter 2 × 1 m @(0,10) `M_YRD_THICKET_POCKET` small variant (difficult terrain volume 2 × 1).
**Triggers:** `TR_F_ENTER` box x±2,y 2..4 → prompt chain (each completes on input perform): 1 move; 2 sprint 3 m; 3 orbit camera 90°; 4 zoom in/out; 5 tactical-wide double-tap. Each: `UI_F_P1..P5` strings + soft blip. On chain complete → `VO_GUN_006`: `Walk it like ye mean it. The camera's yer second pair o' eyes — swing it, lift it, look high.` Planter cross (optional) → card `UI_F_BRIARS`: `Briars: difficult terrain — double movement to cross. Note it now, thank yourself in the caves.` (R7 verbatim values).
**Audio:** footfall sets `A_ONE_FOOT_LIGHT/MEDIUM/HEAVY` by species/armor; `A_ONE_BRIAR_SNAG`.
**Fail-forward:** chain skippable (veteran): pressing `F` at beacon skips to next station.

### 4.G — AREA G: DUMMY LINE (T3 basic attack; T4 bonus action & masteries)

**Purpose:** teach the attack loop, action economy, crits, bonus action, and all eight masteries on safe targets.
**Props:** G1 `M_YRD_DUMMY_SWORD` (−12,20) r0 — straw torso on post, mounted on 3 m slide rail (y-axis) for Push demos; AC tag plate "10"; G2 `M_YRD_DUMMY_MASTERY` (−12,24) — weighted sack on gimbal (tips Prone), counterweight arm; G3 `M_YRD_CART_TIPS` (−10.5,22) tip-cart; G4 `M_YRD_WEAPON_SHELF` (−13.5,22): greatclub (Push), longsword-ish train sword (Sap/Slow cards), dagger pair (Nick), train scimitar (Nick), shortbow moved from H? (no — H owns bow); mastery demo weapons: greatclub, dagger, train sword, spare straw bales G5 `M_YRD_HAY_BALE` ×2 (−12,26) side-by-side (Cleave pair).
**Triggers & logic:**
- `TR_G_A` sphere r2.5 @(−12,18.5): first interact equips class melee kit; combat UI unlocks (action bar, reticle). Dummy A stats card: **AC 10, HP ∞ (yield gauge 6 hits)**, no traits. Attack = Action (R6). Each swing: dice theatre d20+mod+PB vs 10 (R1,R3,R14); damage die per weapon; crit = double dice + `A_ONE_CRIT_BELL` + `VO_GUN_015`. After 6 hits dummy "yields" (winks, gauge resets in 6 s). T3 line `VO_GUN_007`: `Give it a whack! Full swing, don't tickle it… THERE! See the die? That's the truth of every blow ye'll ever land.`
- `TR_G_B` sphere r2.5 @(−12,22.5): mastery gallery: pick each shelf weapon; scripted hit on Dummy B triggers the property demo + verbatim card (texts per §4 R12): Push → dummy slides 3 m down rail (`A_ONE_DUMMY_RAIL_SLIDE`); Topple → gimbal tips Prone (`A_ONE_DUMMY_TIP_CLATTER`) + Prone card (R7); Sap → debuff icon + card; Vex → next roll shows Advantage pips + card; Slow → card + slowed swing anim on dummy arm; Nick → off-hand dagger extra cut inside same Action + card; Graze → deliberate-miss demo deals mod damage + card; Cleave → single swing hits both bales G5 + card. Bonus-action teach: off-hand dagger attack labelled **Bonus Action** (R6). T4 line `VO_GUN_008`: `Again — and follow through! A second cut for the bold. Now watch: a shield-bearer's push, a leg-sweep… weapons have manners, learn theirs.`
**Rules payload inline:** R1, R2, R3, R6, R7, R12 (all eight verbatim), R14.
**Strings:** `UI_G_YIELD` `The dummy leans your way. Even straw respects persistence.` · `UI_G_PICK` `Take up the {0} — feel its manners.`
**Camera:** first attack = punch-in tight over-shoulder (1.5 s); dice close-ups per R14.
**Audio:** `A_ONE_SWING_WHOOSH_1/2/3`, `A_ONE_DUMMY_THOCK_L`, `A_ONE_DUMMY_THOCK_H`, `A_ONE_DUMMY_RAIL_SLIDE`, `A_ONE_DUMMY_TIP_CLATTER`, `A_ONE_CRIT_BELL`, `A_ONE_MISS_WHIFF`.
**VFX:** straw-puff impacts `VFX_STRAW_PUFF`; mastery proc glyphs `VFX_MASTERY_GLYPH_{property}`.
**Fail-forward:** after 2 consecutive misses dummy AC drops to 8 once (`UI_G_YIELD`); `VO_GUN_016` on 3 misses: `Swing's honest, aim's optimistic. Breathe, then swing.`

### 4.H — AREA H: ARCHERY LANE & LOFT (T6 ranged, cover, height)

**Purpose:** teach ranged attacks, range bands, cover values, height Advantage, Vex.
**Geometry:** lane along west wall: firing line y26 → butts y42 (16 m); loft deck 3 m high at (−20.5,26..30) with stairs from east side.
**Props:** H1 `M_YRD_TARGET_BUTT` ×3 (−18,42)/(−16.5,42)/(−19.5,42); H2 `M_YRD_HAY_BALE` half-cover stack (−18,34) 1 m high; H3 `M_YRD_HAY_BALE` three-quarters stack (−16,38) 1.8 m high; H4 `M_YRD_LOFT_PLATFORM` (−20.5,28) deck 3 m, rail; H5 `M_YRD_LOFT_STAIRS` (−19,26.5); H6 `M_YRD_QUIVER_STAND` (−19,26) infinite arrows; H7 `M_YRD_HAY_BALE` ×2 lane-edge seating (−20,34).
**Triggers & logic:** `TR_H_LINE` sphere r2 @(−18,26): equips shortbow (range 80/320 card; yard lane uses 16 m = well within normal range). Sequence: (1) open shot at centre butt — roll theatre, Vex proc card on hit (shortbow mastery = Vex, verbatim R12); (2) shoot centre butt **behind H2 stack**: reticle shows 1 cover pip, tooltip `AC +2 (half cover)`; card R3 cover table; (3) shoot left butt behind H3: 2 pips `AC +5 (three-quarters cover)`; (4) climb loft (`TR_H_LOFT` plane @ deck): shoot down: Advantage pips + card R11 + `VO_GUN_009`: `Bales stop arrows, walls stop fools. Shoot over, shoot around — or climb the loft and shoot down. High ground's a gift, take it.`
**Rules payload inline:** R2, R3 (cover values verbatim: half +2 / three-quarters +5 / total untargetable), R11, range rule (normal/long = Disadvantage), R12 Vex verbatim.
**Strings:** `UI_H_COVER2` `Half cover: +2 AC and +2 to Dexterity saves.` · `UI_H_COVER5` `Three-quarters cover: +5 AC and +5 to Dexterity saves.` · `UI_H_HIGH` `3 m above your target: Advantage on the shot.`
**Audio:** `A_ONE_BOW_DRAW`, `A_ONE_BOW_RELEASE`, `A_ONE_ARROW_THUD`, `A_ONE_ARROW_BALE_THUD`, `A_ONE_ARROW_RICOCHET`, `A_ONE_LOFT_STAIR_CREAK`.
**VFX:** `VFX_ARROW_TRACE` subtle; straw-burst impacts.
**Camera:** loft climb keeps third-person; first-person aim demo prompted once (`UI_D_VIEW` repeat).
**Fail-forward:** infinite arrows; no timers; bales indestructible in yard.

### 4.I — AREA I: BRUSH LANE (T7 hide, surprise, Advantage)

**Purpose:** teach hiding vs passive Perception, surprise round, Advantage from hidden.
**Geometry:** east strip x 12..20, y 8..24; four thicket pockets (2 × 2 m each): break LOS, hide volumes, difficult terrain (R7).
**Props:** I1 `M_YRD_THICKET_POCKET` ×4 (14,12)/(18,16)/(14,20)/(18,22); I2 `M_YRD_LOG_SEAT` (12.5,16); I3 `M_YRD_LEAF_DECAL` patches under pockets.
**NPC:** Trainee Pip: patrol loop (16,10)→(16,14)→(16,18)→(16,22)→reverse, 1.2 m/s, passive Perception **12** (shown on his card once observed).
**Triggers & logic:** `TR_I_LANE` box x12..20,y8..10 on entry → teach card R5 + prompt: break LOS into a pocket → `H` Hide → Stealth roll theatre vs 12. Success → hidden icon + `VFX_HIDE_SHROUD`; Pip passes within 2 m (heartbeat audio). While hidden near Pip → prompt `UI_I_AMBUSH`: `Strike from hiding: Advantage + surprised foe.` Choose ambush → SPAR-LITE (one-round turn-based micro-fight, yield rules R9): Pip surprised (skips turn 1, R5), player attacks with Advantage (R2). Choose stay hidden → Pip `VO_TRN_003`: `Huh. Swore somethin' moved…` + `VO_GUN_017`. Fail Stealth → Pip spots, no surprise, SPAR-LITE starts even (teaches losing the contest). T7 line `VO_GUN_010`: `Quiet now. If the lad never sees ye, yer first blow lands twice as true. That's not cheating, that's craft.`
**Rules payload inline:** R5 (full), R2, R6 (micro-fight turn), R9, R13.
**Pip spar stats:** AC 13, HP 6 (yield), Speed 9 m, blunt sword +3, 1d4+1 bludgeoning, passive Per 10 (post-surprise).
**Audio:** `A_ONE_BRUSH_RUSTLE_1/2`, `A_LOOP_BRUSH_BIRDS_NEAR`, `A_ONE_HEARTBEAT_HIDE`, spar reuses J clash set.
**VFX:** `VFX_HIDE_SHROUD`, `VFX_SURPRISE_MARK` (! pip over surprised head).
**Fail-forward:** retries unlimited (Pip resets loop after 10 s); `VO_GUN_017` on first success: `Never saw ye. Neither will they, if ye keep that up.`

### 4.J — AREA J: SPARRING CIRCLE (T8 full turn-based loop)

**Purpose:** the complete Table-Mode loop in miniature: initiative, turns, movement split, End Turn, reactions/opportunity attacks, non-lethal.
**Geometry:** sand circle r3 @(12,10) decal `T_YRD_SAND_CIRCLE` + chalk ring; surrounding packed dirt; benches ×3 at (9,7)/(15,7)/(12,13.5).
**Props:** J1 `M_YRD_WEAPON_RACK_SMALL` (15,8) blunts; J2 `M_YRD_BENCH` ×3 as above; J3 `M_YRD_WATER_KEG` (16,9).
**NPCs:** Sergeant Brant home (12,6.5); Trainee Marra home (14,11); Pip joins from I when T8 starts.
**Triggers & logic:** `TR_J_CIRCLE` sphere r3 @(12,10) after T7 → Brant `VO_SGT_003`: `Circle's hot. Blunts, full turns, mind the queue — fight.` Combat vs Pip + Marra (stats per 4.I; Marra identical + shield AC 14). Sequence teachings, each with card + prompt:
 1. Initiative: all four roll in dice theatre (d20+DEX; ribbon appears; R6/initiative card).
 2. Your turn: move split around attack (ribbon shows feet remaining); End Turn `Space` prompt.
 3. Round 2: Pip uses Disengage wrongly scripted? No — **Marra moves away without Disengaging** → reaction card `OPPORTUNITY ATTACK — blunt sword +3 vs Marra leaving reach` (R8 verbatim card); take or pass both taught.
 4. Round 3: Pip Dashes across reach → second prompt (reinforce).
 5. Non-lethal enforced: all yard damage is bludgeoning-yield; card R9: `Sparring blunts: knock-outs only — this is how you'll take prisoners on the road.`
 6. Yield at 1 HP → Unconscious 3 s (R13) → wake wave; victory → `VO_SGT_004`: `Clean turns. Ugly feet. The road'll fix the feet.` + `MUS_STING_SPAR_WIN`.
**Rules payload inline:** R6 full anatomy, R8 verbatim-ish (`When a creature you can see leaves your reach without Disengaging, you may use your Reaction to make one melee attack against it.`), R9, R13, initiative tie rule (higher DEX wins), R14.
**Strings:** `UI_J_REACT` `OPPORTUNITY ATTACK — {0} leaves your reach. React?` · `UI_J_ENDTURN` `Nothing left? Press Space to end your turn.`
**Camera:** combat framing auto two-shot (GDD-01 §3.1); enemy turns Cinematic pace.
**Audio:** `A_ONE_SPAR_CLASH_1..6`, `A_ONE_SPAR_YIELD_WHISTLE`, `A_LOOP_CROWD_YARD_SMALL`, `A_ONE_SAND_SCUFF`, `MUS_STING_SPAR_WIN`.
**VFX:** dust rings on impacts; `VFX_TURN_BANNER` sweep.
**Fail-forward:** trainees yield at 1 HP; player cannot die (clamp 1 HP); loss impossible, only slow.

### 4.K — AREA K: REST NOOK (T9 short rest & Hit Dice)

**Purpose:** teach resting economy.
**Props:** K1 `M_YRD_BENCH` (10,32) r90; K2 `M_YRD_BRAZIER` lit (11,32.5); K3 `M_YRD_TABLE_SMALL` (9.5,32.5) bread+water; K4 `M_YRD_LOG_PILE` (11.5,33.5).
**Triggers:** `TR_K_BENCH` sphere r2 @(10,31): interact → sit anim (1.2 s) → rest UI: **Short rest** button: spend Hit Dice (class die + CON mod per die, dice theatre heals, R10 verbatim card); **Long rest** card explain-only in yard: `A long rest needs safety and eight hours. The yard qualifies. The goblin trail will not.`; bread eat once = +1 HP flavour (`A_ONE_BREAD_TEAR`). T9 line `VO_GUN_012`: `Even heroes sit down. A breath, a bandage, a bit o' luck rolled back into yer veins — then up again.`
**Rules payload inline:** R10 full (short 1 h / Hit Dice; long 8 h safe place, full restore, half Hit Dice back).
**Audio:** `A_LOOP_BRAZIER_CRACKLE`, `A_ONE_BENCH_SIT`, `A_ONE_BREAD_TEAR`, `A_LOOP_NOOK_BIRDS`.
**Lighting:** `L_K_BRAZIER` warm flicker.
**Fail-forward:** rest repeatable; HP clamped ≤ max.

### 4.L — AREA L: PACK, FOLIO & CODEX LECTERN (T10 kit, codex, options)

**Purpose:** inventory/folio/codex/options literacy.
**Props:** L1 `M_YRD_CRATE_PACK` ×2 (6,22)/(6.6,22.4); L2 `M_YRD_FOLIO_STAND` (6.2,22.8); L3 `M_YRD_LECTERN_CODEX` (6.5,23) open tome.
**Triggers:** `TR_L_CRATE` sphere r2 @(6,21.5): inventory UI: starting kit per chosen class (verbatim-short list from class card); equip/swapping; encumbrance not tracked in Ch1 (stated on card). `TR_L_LECTERN` sphere r1.5 @(6.5,22.5): codex UI (GDD-02 §2.6 rules preloaded + house rule R11 tagged `HOUSE RULE`); options shortcut panel with live toggles: rules-grid overlay demo, hit-chance display, enemy-turn pace. T10 line `VO_GUN_013`: `Yer kit, yer contract, yer head. Keep all three in order and ye'll keep yer life.`
**Audio:** `A_ONE_CRATE_LID`, `A_ONE_PACK_STRAP`, `A_ONE_TOME_PAGE`, `SFX_UI_PAGE`.
**Fail-forward:** all panels re-openable anytime via `Tab`/`C`/`Esc`.

### 4.M — AREA M: PRACTICE BELL (sandbox reset)

**Purpose:** replay/reset any practice beat.
**Props:** M1 `M_YRD_BELL_POST` (0,22) bronze bell 0.4 m.
**Trigger:** `TR_M_BELL` sphere r1.5: ring → `A_ONE_BELL_PRACTICE` + `VFX_DUST_SHAKE`; resets dummies/targets/thickets states, respawns trainees to homes, re-arms last failed beat; string `UI_M_BELL`: `The practice bell: ring it and the yard forgets your mistakes.`
**Fail-forward:** bell never blocks departure.

---

## 5. COMPLETE MODEL LIST (zone YRD)

Poly tiers: HERO_NPC 30–45 k tris; PLAYER 45 k; PROP_MED 2–8 k; PROP_SM 0.3–1.5 k; SHELL/VISTA < 1 k cards.

| ID | Description | Size (m) | Tier | Areas |
|---|---|---|---|---|
| M_YRD_WALL_STONE | yard wall module 4 m span × 4.2 m h, crenel cap | 4×0.8×4.2 | PROP_MED | perimeter |
| M_YRD_GATEHOUSE | arch block + vault | 8×3×5 | PROP_MED | A |
| M_YRD_PORTCULLIS | iron portcullis (raised state) | 4×0.2×4 | PROP_SM | A |
| M_YRD_GATE_DOOR | oak gate door leaf (pinned open) | 2×0.15×3.4 | PROP_SM | A |
| M_YRD_GUARD_BOX | sentry box | 1.2×1.2×2.4 | PROP_SM | A |
| M_YRD_NOTICE_BOARD | post board | 1.4×0.1×1.8 | PROP_SM | A |
| M_YRD_BARREL | barrel | 0.6⌀×0.9 | PROP_SM | A,lane |
| M_YRD_LANTERN_POST | post lantern lit | 0.2⌀×2.6 | PROP_SM | A,B |
| M_YRD_CRATE_STACK | 3-crate stack | 1.4×1.2×1.5 | PROP_SM | lane |
| M_DOCK_ROPE_COIL | rope coil | 0.8⌀×0.3 | PROP_SM | lane |
| M_DOCK_GULL_POST | mooring post + gull card | 0.4⌀×1.2 | PROP_SM | lane |
| M_DOCK_GATE_CITY | city gate closed + crenels | 6×1×7 | PROP_MED | lane end |
| M_YRD_ROPE_CORDON | cordon posts+rope 4 m | 4×0.05×1.1 | PROP_SM | lane |
| M_DOCK_FACADE_L/R | sealed facade shell (4 variants each) | 8×6×9 | SHELL | lane |
| M_VISTA_CITY_CARDS | matte backdrop card cluster (4 km) | 900×—×120 | VISTA | R2 |
| M_VISTA_CITY_SHELLS | silhouette shells + window cards (300–800 m) | — | SHELL | R2 |
| M_YRD_DESK_MUSTER | heavy desk | 2×1×1.1 | PROP_MED | B |
| M_YRD_LEDGER_BOOK | open ledger | 0.5×0.35×0.1 | PROP_SM | B |
| M_YRD_STOOL | stool | 0.4⌀×0.5 | PROP_SM | B,E |
| M_YRD_BOARD_CONTRACT | contract board + posts | 2.4×0.12×1.6 | PROP_SM | B |
| M_YRD_PAPER_SHEET | pinned paper (12) | 0.21×0.005×0.3 | PROP_SM | B |
| M_YRD_ABACUS | abacus | 0.4×0.15×0.3 | PROP_SM | B |
| M_YRD_DICE_CUP | cup + dice set | 0.1⌀×0.15 | PROP_SM | B |
| M_YRD_INK_WELL | ink well | 0.08⌀×0.08 | PROP_SM | B,E |
| M_YRD_PEDESTAL_CLASS | class pedestal + totem slot | 0.6⌀×1.1 | PROP_MED | C |
| M_YRD_PRAYER_STONE | carved prayer stone | 0.5×0.3×0.9 | PROP_SM | C |
| M_YRD_LECTERN_SPELL | spell lectern + book | 0.5×0.4×1.2 | PROP_SM | C |
| M_YRD_SHADOW_POST | shadow post (rogue totem) | 0.3⌀×1.6 | PROP_SM | C |
| M_YRD_ARMS_RACK | weapon rack full | 2.4×0.5×1.8 | PROP_MED | C |
| M_YRD_WHETSTONE_POST | whetstone post | 0.4×0.3×1.0 | PROP_SM | C |
| M_YRD_TACK_ROOM | tack-room shell interior+exterior | 6×8×3.2 | PROP_MED | D |
| M_YRD_MIRROR_SHIELD | polished shield mirror + stand | 1.2⌀×1.6 | PROP_MED | D |
| M_YRD_RUG | rug | 2×0.02×3 | PROP_SM | D |
| M_YRD_LANTERN_HOOK | hook lantern | 0.15⌀×0.3 | PROP_SM | D |
| M_YRD_CANOPY | canopy frame+cloth 4×3 | 4×3×2.6 | PROP_MED | E |
| M_YRD_TABLE_CONTRACT | table | 1.8×0.9×0.75 | PROP_MED | E |
| M_YRD_CONTRACT_SCROLL | contract scroll | 0.6×0.02×0.4 | PROP_SM | E |
| M_YRD_QUILL_INK | quill + ink | 0.25×0.1×0.15 | PROP_SM | E |
| M_YRD_LANTERN_TABLE | table lantern | 0.15⌀×0.35 | PROP_SM | E |
| M_YRD_DUMMY_SWORD | straw sword-dummy on slide rail | 0.7×0.7×1.8 | PROP_MED | G |
| M_YRD_DUMMY_MASTERY | gimbal sack dummy + counterweight | 0.8×0.8×1.7 | PROP_MED | G |
| M_YRD_CART_TIPS | tip cart | 1.2×0.7×0.9 | PROP_SM | G |
| M_YRD_WEAPON_SHELF | mastery demo shelf | 1.6×0.4×1.4 | PROP_SM | G |
| M_YRD_HAY_BALE | hay bale (cover prop) | 1×0.5×0.6 | PROP_SM | G,H |
| M_YRD_TARGET_BUTT | straw archery butt + stand | 1.2×0.4×1.4 | PROP_SM | H |
| M_YRD_QUIVER_STAND | quiver stand (infinite) | 0.4⌀×1.1 | PROP_SM | H |
| M_YRD_LOFT_PLATFORM | loft deck + rail (3 m) | 3×4×3 | PROP_MED | H |
| M_YRD_LOFT_STAIRS | loft stairs | 1.2×3×3 | PROP_SM | H |
| M_YRD_THICKET_POCKET | briar thicket pocket 2×2 (hide+DT+cover) | 2×2×1.8 | PROP_MED | F,I |
| M_YRD_LOG_SEAT | log seat | 1.6×0.4×0.45 | PROP_SM | I |
| M_YRD_WEAPON_RACK_SMALL | blunt rack | 1.2×0.4×1.3 | PROP_SM | J |
| M_YRD_BENCH | bench | 1.8×0.5×0.45 | PROP_SM | J,K |
| M_YRD_WATER_KEG | water keg+ladle | 0.6⌀×0.8 | PROP_SM | J |
| M_YRD_BRAZIER | brazier lit | 0.7⌀×1.0 | PROP_SM | K |
| M_YRD_TABLE_SMALL | small table | 0.8×0.8×0.7 | PROP_SM | K |
| M_YRD_LOG_PILE | log pile | 1.2×0.8×0.6 | PROP_SM | K |
| M_YRD_CRATE_PACK | pack crate (openable) | 0.8×0.6×0.6 | PROP_SM | L |
| M_YRD_FOLIO_STAND | folio stand | 0.4×0.3×1.1 | PROP_SM | L |
| M_YRD_LECTERN_CODEX | codex lectern + tome | 0.6×0.5×1.2 | PROP_SM | L |
| M_YRD_BELL_POST | practice bell post | 0.25⌀×2.0 | PROP_SM | M |
| M_YRD_WAGON | provision wagon (T11) | 3.4×1.6×2.0 | PROP_MED | A(T11) |
| M_YRD_OX | ox (2) | 2.2×0.8×1.5 | HERO_NPC-lite | A(T11) |
| M_NPC_GUNDREN | Gundren Rockseeker (hero NPC, dwarf merchant coat) | 1.32 h | HERO_NPC | E,wander |
| M_NPC_CLERK | Clerk Odile Vess | 1.7 h | HERO_NPC | B |
| M_NPC_SERGEANT | Sergeant Brant | 1.85 h | HERO_NPC | J |
| M_NPC_TRAINEE_M/F | Trainees Pip/Marra (2 variants) | 1.7 h | HERO_NPC | I,J |
| M_NPC_GUARD | Guard Corvin (+ city pair re-use) | 1.8 h | HERO_NPC | A,lane |
| M_PLAYER_RIGS | player body rigs ×8 species (morph targets) | 1.6–1.9 h | PLAYER | all |

## 6. COMPLETE TEXTURE / MATERIAL LIST

| ID | Type | Res | Tiling / use |
|---|---|---|---|
| T_YRD_STONE_WALL | albedo/normal/rough set | 2 K | walls, gatehouse; tile 4×2 m |
| T_YRD_COBBLE | set | 2 K | forecourt; tile 3 m |
| T_YRD_COBBLE_WORN | set | 2 K | dock lane; tile 3 m |
| T_YRD_DIRT | set | 2 K | yard floor; tile 4 m |
| T_YRD_SAND_CIRCLE | albedo+rough | 1 K | J decal |
| T_YRD_DECAL_CHALK | alpha decal | 512 | F lane edges, J ring |
| T_YRD_DECAL_MUD | alpha decal set ×4 | 1 K | gate, lane puddles |
| T_YRD_WOOD_OAK_WORN | set | 2 K | desks, benches, racks, doors |
| T_YRD_WOOD_PLANK_NEW | set | 1 K | pedestals, loft |
| T_YRD_METAL_IRON | set | 1 K | portcullis, hinges, bellows? (bell uses bronze) |
| T_YRD_METAL_BRONZE | set | 1 K | bell, fittings, mirror rim |
| T_YRD_MIRROR_POLISH | rough/metal special | 512 | D mirror face (planar reflection target) |
| T_YRD_LEATHER_TOOL | set | 1 K | tack, folios, straps |
| T_YRD_PARCHMENT | albedo | 1 K | ledger, papers, contract |
| T_YRD_CLOTH_CANOPY | set double-sided | 1 K | E canopy (Rockseeker brown/gold device) |
| T_YRD_CLOTH_TABARD | set | 1 K | NPC tabards (Guard blue, trainee grey) |
| T_YRD_STRAW_DUMMY | set | 1 K | dummies, butts |
| T_YRD_HAY | set | 1 K | bales |
| T_YRD_BRUSH_LEAF | set + alpha cards | 2 K | thicket pockets |
| T_YRD_ROPE_HEMP | set | 512 | cordons, coils, rails |
| T_YRD_BARREL_OAK | set | 1 K | barrels/kegs |
| T_YRD_CRATE_PINE | set | 1 K | crates (Lionshield-free; plain) |
| T_YRD_FACADE_PLASTER | set ×4 variants | 2 K | dock facades |
| T_VISTA_CITY_PAINT | matte paint albedo | 4 K | R2 backdrop card |
| T_VISTA_WINDOW_CARDS | emissive alpha | 1 K | R2 shells |
| T_NPC_HEAD/BODY ×6 | PBR sets | 4 K/2 K | NPCs & player species |
| T_YRD_EMBER_ATLAS | VFX atlas | 1 K | brazier, embers |
| T_YRD_DUST_ATLAS | VFX atlas | 1 K | impacts, footfalls, bell shake |
| T_YRD_UI_SEAL | UI wax seal + emblem steps | 512 | loading/save (GDD-02) |

## 7. COMPLETE AUDIO LIST (zone YRD)

Beds/loops: `AMB_YRD_DAWN` (whole-zone bed: gull sparse, harbour bell ~90 s, rope creak, distant blades), `AMB_DOCK_LANE` (R1: city murmur, carts, gull colony), `AMB_YRD_DAWN_MENU` (menu variant, GDD-02), `A_LOOP_FLAG_SNAP`, `A_LOOP_BRAZIER_CRACKLE`, `A_LOOP_CANOPY_FLAP`, `A_LOOP_TACK_LEATHER_CREAK`, `A_LOOP_BRUSH_BIRDS_NEAR`, `A_LOOP_NOOK_BIRDS`, `A_LOOP_CROWD_YARD_SMALL`, `MUS_MENU_THEME` (menu only), `MUS_STING_SIGN`, `MUS_STING_SPAR_WIN`.
One-shots: `A_ONE_GULL_CRY`, `A_ONE_CITY_BELL`, `A_ONE_GATE_CREAK`, `A_ONE_PAGE_TURN`, `A_ONE_QUILL`, `A_ONE_QUILL_SCRATCH_LONG`, `A_ONE_STAMP_THUNK`, `A_ONE_WAX_STAMP`, `A_ONE_DICE_CUP_SHAKE`, `A_ONE_DICE_ROLL_TABLE`, `A_ONE_PAPER_UNPIN`, `A_ONE_PEDESTAL_TURN`, `A_ONE_HOLO_SHIMME`, `A_ONE_RACK_RATTLE`, `A_ONE_SWING_WHOOSH_1/2/3`, `A_ONE_MISS_WHIFF`, `A_ONE_DUMMY_THOCK_L`, `A_ONE_DUMMY_THOCK_H`, `A_ONE_DUMMY_RAIL_SLIDE`, `A_ONE_DUMMY_TIP_CLATTER`, `A_ONE_CRIT_BELL`, `A_ONE_BOW_DRAW`, `A_ONE_BOW_RELEASE`, `A_ONE_ARROW_THUD`, `A_ONE_ARROW_BALE_THUD`, `A_ONE_ARROW_RICOCHET`, `A_ONE_LOFT_STAIR_CREAK`, `A_ONE_BRUSH_RUSTLE_1/2`, `A_ONE_HEARTBEAT_HIDE`, `A_ONE_SPAR_CLASH_1..6`, `A_ONE_SPAR_YIELD_WHISTLE`, `A_ONE_SAND_SCUFF`, `A_ONE_BENCH_SIT`, `A_ONE_BREAD_TEAR`, `A_ONE_CRATE_LID`, `A_ONE_PACK_STRAP`, `A_ONE_TOME_PAGE`, `A_ONE_BELL_PRACTICE`, `A_ONE_DOOR_CREAK_TACK`, `A_ONE_MIRROR_SHINE`, `A_ONE_FOOT_LIGHT/MEDIUM/HEAVY`, `A_ONE_BRIAR_SNAG`, `A_ONE_FIRE_WHOOSH`, `A_ONE_RADIANT_CHIME`, `A_ONE_SMOKE_POOF`, `A_ONE_WAGON_WHEEL_CREAK` (T11), `A_ONE_OX_SNORT` (T11), UI set per GDD-02 §2.8, `SFX_LOAD_STAMP` (loading).
Mix notes: VO duck bed −6 dB during lines; dice theatre SFX always −3 dB above bed; heartbeat only while hidden & observer < 3 m.

## 8. COMPLETE VFX LIST

`VFX_MIST_GROUND`, `VFX_GULL_FLOCK`, `VFX_BEACON`, `VFX_PAPER_FLY`, `VFX_WAX_GLOW`, `VFX_HOLO_FIGHTER/CLERIC/WIZARD/ROGUE`, `VFX_STRAW_PUFF`, `VFX_MASTERY_GLYPH_PUSH/TOPPLE/SAP/VEX/SLOW/NICK/GRAZE/CLEAVE`, `VFX_HIDE_SHROUD`, `VFX_SURPRISE_MARK`, `VFX_TURN_BANNER`, `VFX_ARROW_TRACE`, `VFX_DUST_SHAKE`, `VFX_DICE_THEATER` (R14 core), `VFX_EMBER_BRAZIER`, `VFX_LANTERN_FLICKER`.

## 9. COMPLETE VO SCRIPT (zone YRD)

**Gundren (dwarf, warm/brisk/conspiratorial):**
- VO_GUN_001 `There ye are! Mind the mud — the yard's seen worse boots than yours.` (T0/A)
- VO_GUN_002 `Ha! Look at yerself. Eyes front, chin up — that's an adventurer's face, or close enough.` (T2/D)
- VO_GUN_003 `The ledger wants your blood, the pedestals your trade, the board your story. Then my quill gets its turn.` (E incomplete)
- VO_GUN_004 `Ten gold each when the wagon lands at Barthen's in Phandalin. My brothers' find is worth a hundred wagons, but coin first, glory after — sign here.` (T5/E)
- VO_GUN_005 `Right! The yard's yours till the oxen are hitched. Swing at anything straw — it deserves it.` (post-sign)
- VO_GUN_005b `The pedestals aren't going to choose for ye, hero.` (C nudge)
- VO_GUN_006 `Walk it like ye mean it. The camera's yer second pair o' eyes — swing it, lift it, look high.` (T1/F)
- VO_GUN_007 `Give it a whack! Full swing, don't tickle it… THERE! See the die? That's the truth of every blow ye'll ever land.` (T3/G)
- VO_GUN_008 `Again — and follow through! A second cut for the bold. Now watch: a shield-bearer's push, a leg-sweep… weapons have manners, learn theirs.` (T4/G)
- VO_GUN_009 `Bales stop arrows, walls stop fools. Shoot over, shoot around — or climb the loft and shoot down. High ground's a gift, take it.` (T6/H)
- VO_GUN_010 `Quiet now. If the lad never sees ye, yer first blow lands twice as true. That's not cheating, that's craft.` (T7/I)
- VO_GUN_011 `Blades down, fists up! First to yield wins my respect — and I yield to nobody. Mind yer turn, mind theirs, mind the moment between!` (T8/J)
- VO_GUN_012 `Even heroes sit down. A breath, a bandage, a bit o' luck rolled back into yer veins — then up again.` (T9/K)
- VO_GUN_013 `Yer kit, yer contract, yer head. Keep all three in order and ye'll keep yer life.` (T10/L)
- VO_GUN_014 `The city'll keep! Contract first — desk, blades, then my table. In that order, hero.` (lane loiter)
- VO_GUN_015 `A CRIT! The straw'll talk about that one for weeks.` (first crit)
- VO_GUN_016 `Swing's honest, aim's optimistic. Breathe, then swing.` (3 misses)
- VO_GUN_017 `Never saw ye. Neither will they, if ye keep that up.` (first hide success)
- VO_GUN_018 `Oxen are hitched! Contract's live — to the gate, hero.` (T11 ready)
**Clerk Odile Vess (dry, fast):** VO_CLK_001 `Name later, blood first. The ledger doesn't care what you call yourself — only what you are.` · VO_CLK_002a..h (species comments, 8 lines, e.g. dwarf: `Solid choice. Stubborn stock, good with stone and grudges.`) · VO_CLK_003 `Beads for the careful, cup for the brave. Either way the road collects its interest.` · VO_CLK_004 `Filed. The South will read you exactly as that paper says.`
**Sergeant Brant (gravel, fond):** VO_SGT_001 `Circle's for fighters, lane's for fools, desk is for both.` · VO_SGT_002a..d (class barks, §4.C) · VO_SGT_003 `Circle's hot. Blunts, full turns, mind the queue — fight.` · VO_SGT_004 `Clean turns. Ugly feet. The road'll fix the feet.`
**Trainees:** VO_TRN_001 (Pip, pre-spar) `Blunts only, yeah? BLUNTS.` · VO_TRN_002 (Marra, post-yield) `I meant to do that.` · VO_TRN_003 (Pip, missed hide) `Huh. Swore somethin' moved…` · VO_TRN_004 (Pip, surprised) `Wha— hey! Not fair! …Teach me that.`
**Guard Corvin (flat):** VO_GRD_001 `Mornin'. Contract folk through the gate, city folk wait — them's the orders, not mine.` · VO_GRD_002 `Barred till the muster's done. Ye've a yard to be in, friend.` · VO_GRD_003 `Orders: none leaves muster-less. Sign the dwarf's paper first.`

## 10. LIGHTING RIG

`L_SUN_DAWN` directional: 06:40 elev 8° azim 102° 2400 K intensity 2.2 → 08:20 elev 21° azim 118° 4200 K 3.4 (animated); sky: harbour-dawn HDRI-authored sky sphere + height fog `VFX_MIST_GROUND`; practicals: `L_A_LANTERN` ×2, `L_B_LANTERN`, `L_D_LANTERN` ×2, `L_E_LANTERN`, `L_K_BRAZIER` (flicker curve 8 Hz subtle); bounce cards: gatehouse vault, tack-room interior, canopy underside; shadow budget: sun cascades 3, practicals shadowless except `L_K_BRAZIER` (single cascade-free point shadow, low res).

## 11. UI ELEMENTS PRESENT IN YARD

`UI_YRD_PROMPT` interact pip (F) + hold-ring; `UI_YRD_BEACON_WISP` toggleable; `UI_YRD_ACTIONBAR` (post-T3); `UI_YRD_TURNRIBBON` (J only); `UI_YRD_DICE_THEATER` (R14); `UI_YRD_FOLIO` (Tab); `UI_YRD_JOURNAL` (J); `UI_YRD_CODEX` (C); `UI_YRD_RETICLE` cover pips + AC tooltip; `UI_YRD_MOVE_RIBBON` dust path (J only); `UI_YRD_CARDS` rule cards (all R-refs); `UI_YRD_NAME_ENTRY` (E); `UI_YRD_CREATION_PANELS` (B/C/D); `UI_YRD_REST_PANEL` (K); `UI_YRD_INV_PANEL` (L); strings master: all `UI_*` strings defined in-place per area above (single source of truth for localization export).

## 12. BUILD ORDER, GREYBOX & QA

**Build order:** 1 walls/floor/sun greybox → 2 trigger skeleton A–M with stub UI → 3 rules sandbox verification (dummy math) → 4 stations B/C/D/E creation flow → 5 G/H/I/J combat teaching → 6 K/L/M → 7 R1 lane + R2 vista → 8 art pass (Lit Miniature grade per GDD-0 v0.9) → 9 VO record & mix → 10 perf pass → 11 QA.
**Greybox checklist:** every TR_ volume present & named; every prop placeholder scaled to §5 dims; navmesh baked incl. thicket DT volumes; RulesGrid lattice aligned origin (0,0); cover volumes authored (bales H2/H3, thickets); hide volumes = thicket pockets; loft height exactly 3.0 m (R11 threshold).
**QA suite (yard):** (1) dummy attack math vs R1/R3 across mods 1–5 & advantage; (2) crit doubling; (3) cover pips +2/+5 at H vs reticle truth; (4) loft Advantage both cameras identical (screenshot diff); (5) hide vs passive 12 both outcomes; surprise skip-turn in SPAR-LITE; (6) opportunity-attack trigger on leave-reach, suppressed by Disengage; (7) rest math vs R10; (8) each mastery demo fires its glyph+card; (9) signing gates departure (TR_A_DEPART unsigned); (10) veteran skip path T0→E→A completes < 12 min; (11) softlock sweep: quit/resume at every area; (12) boundary sweep: no exit from R1, no wall climb; (13) perf: draw calls ≤ 200, 60 fps mid-spec; (14) VO matrix: every line fires exactly once per intended trigger, ducking correct; (15) first-person parity: all reticle truths match third-person (automated camera-pair diff).

*End of GDD-03 v1.0 — zone YRD fully specified.*
