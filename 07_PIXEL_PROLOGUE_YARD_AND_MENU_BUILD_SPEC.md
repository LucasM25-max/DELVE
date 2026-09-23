# DELVE — GDD-07 · PIXEL PROLOGUE BUILD SPEC: GAME MENU + TRAINING YARD
## Shell (boot → menu → contract → loading) + Zone `YRD` top-down pixel yard — buildable from this document alone

| Field | Value |
|---|---|
| Document | `07_PIXEL_PROLOGUE_YARD_AND_MENU_BUILD_SPEC.md` (GDD-07) |
| Version | 1.1 (2026-09-23) — web build: static site, GitHub → Vercel |
| Status | **ACTIVE** — binding content spec for the pixel shell and the entire prologue training yard |
| Author | Arena.ai agent session (`arena/01a0cdae-delve`) |
| Pixelates | GDD-02 (shell spec), GDD-03 (3D yard spec) — wherever this doc and those differ, **this doc wins for the pixel build** |
| Reconciles with | GDD-06 (tech/pipeline/milestones; §3.1 first-playable slice → ship ring P1 below), GDD-01 (beat sheet, Table Mode), GDD-00 (pillars, palette thesis) |
| Target | Browser · 480×270 canvas · integer CSS scale · 16 px tiles · HTML + ES modules + JSON + PNG/OGG · static site published by Vercel (`outputDirectory: "web"`) |
| **Standalone guarantee** | Every screen rect, string, rule text, tile coordinate, prop, trigger, statblock, audio cue and VO line needed to build **the complete menu and the complete training yard (areas A–M)** is contained here. Rules texts are inline at each teaching station (SRD 5.2.1 wording, CC-BY attribution §16) so no other document and no rulebook is required. |

---

## 0. HOW TO READ THIS DOCUMENT

**Conventions**

- Coordinates: **tiles** on a 16 px grid (§3.1); UI coordinates: **pixels on the 480×270 canvas**, origin top-left. Both are integers — no fractional positions exist anywhere in this build.
- Surfaces: every rect, string and timing named in this document exists as data under `web/data/` (§12) and is read at runtime; nothing here is re-typed in code.
- IDs: `T_` tiles · `PROP_`/`M_YRD_` props (manifest-compatible names, never renamed) · `A_` audio · `VO_` voice · `VFX_` effects · `TR_` triggers · `UI_`/`STR_` strings · `C1–C6` creation stations · `T0–T11` tutorial beats · `R1–R15` rules primer (§4) · `P0/P1/P2` ship rings.
- Tags: **[P0]** ships with the menu · **[P1]** first-playable yard (GDD-06 §3.1 slice) · **P2** complete prologue (this document's full target) · **[CONVERT]** behaviour that already exists in the shell · **[BUILD]** new to the yard.

**Ship rings (how "the whole yard" lands)**

| Ring | Delivers | Contains |
|---|---|---|
| **P0** | The game menu | §5 complete: legal → sting → menu → PLAY/first-run contract → ledger → options → codex → credits → loading |
| **P1** | First-playable yard | Areas **A, F, G, J, M** interactive (+ B/C/D/E/H/I/K/L **dressed** with prop geometry and readable placards); beats **T0, T1, T3, T4, T8**; encounters `dummy_line` + `sparring`; creation = menu contract page only (GDD-06 D2/§3.1) |
| **P2** | Entire prologue | **All 13 areas A–M interactive**, beats **T0–T11**, in-world creation **C1–C6**, encounters + spar-lite, departure montage handoff. Chapters beyond the yard remain out of scope (GDD-06 D2). |

P1 ⊂ P2: every P1 trigger is written as it works at P2 first, with an explicit P1 behaviour note where they differ. Nothing in this document is "someday flavour" — P2 is part of *this* build's specification; only its **scheduling** is deferred.

**The three numbers this build obeys** (GDD-06 §1.3): **480×270** viewport · **16 px = 1 tile = 5 ft = 1.524 m** · **32+8 locked palette** (surface ramp §5.3 of GDD-06; below ramp only via LUT).

---

## 1. ZONE SUMMARY

- **Identity:** walled muster-yard of the Neverwinter City Guard's contract company behind the harbour district; dawn of the contract day; the whole prologue (tutorial + in-world character creation) happens here, then the party departs through the gate (GDD-01 §6).
- **Play time:** 18–22 min full (P2), 10–12 min veteran skip; P1 interactive content ≈ 8–12 min. Practice sandbox persists post-signing until departure; after yard unload (Ch1) the practice bell survives only as journal "training recap" cards (GDD-03 §1).
- **Size:** interior **29 × 29 tiles = 464 × 464 px** walk-about footprint (44 m × 44 m in rules space). South of the gate: painted R1 lane card + R2 city vista card (never entered).
- **Time of day:** 06:40 at T0 → 08:20 at departure (game clock ≈ 18 min real time); menu backdrop is the same yard frozen at **06:10** (§5.3).
- **Weather:** clear, light harbour mist band until 07:30 (2-frame overlay), then clear. No gameplay effect (sandbox rule R15).
- **Performance budget (web):** ≤ **32 batched blits** worst combat · **60 fps** at 1080p integer scale · whole transfer ≤ 15 MB · menu path ≤ 1 MB · yard load < 100 ms (the loading screen is kept for pacing, §5.9). The 3D budgets of GDD-03 §1 (draw calls ≤ 200, triangles, streamed textures) are **retired**.
- **Rules sandbox overrides active in YRD (R15):** no death (yield at 1 HP); dummies reset after 6 s idle; infinite training arrows; rests free/instant-result; no alert states; no weather gameplay.

---

## 2. WHAT CHANGED FROM THE 3D SPECS (delta table)

| Layer | GDD-02/03 (3D) | GDD-07 (pixel) |
|---|---|---|
| Camera | 3rd person default + first-person `V` toggle (T2), 60 px/s credits | Top-down follow, integer zoom **1× world / 2× dialogue** only; **no first person anywhere** — T2 becomes a 2× mirror zoom cue (§4.D); no pointer lock |
| World | 44×44 m heightfield + 3D props | 29×29 tile layer drawn from one map JSON (the GDD-03 §3 plan); props = manifest-named 2D sprites, 16-px footprints |
| Rules grid | Invisible lattice under natural terrain (GDD-01 D3) | **Tiles are the grid** — 1 tile = 5 ft, literally countable; combat overlay tints cells (GDD-06 §4.6/§6.11); exploration still free-moves on pixels, not tile snaps |
| Lighting | sun elevation/azimuth, real-time GI | 5-stop dawn ramp composited over the canvas from the locked palette (§10); lanterns = additive glow sprites |
| Menu backdrop | live 3D yard, camera drift waypoints, f/2.8 DOF | 3-layer painted parallax + 8 motes (§5.3); low-spec fallback is the default (no pre-render loop needed) |
| Dice theatre | in-world 3D die tumble | Roll Moment: 6-frame 2D tumble in UI layer, 0.4 s hold, ≤ 1.5 s total (R14) |
| HUD | diegetic holdouts | nine-patch pixel HUD (§11); folio `Tab`, codex `C`, journal `J` unchanged |
| Departure T11 | wagon/ox 3D spawn + RIDE montage | P2: wagon rolls in as y-sorted sprites → CARD/RIDE montage (GDD-01 §14.3) → zone unload. P1: departure not reachable (bell sandbox is the loop) |

---

## 3. COORDINATE SYSTEM, RINGS & AREA MAP

### 3.1 Tile grid (the only coordinate system)

- Footprint **29×29 cells**: `tx ∈ [−14, +14]`, `ty ∈ [0, +28]`. Pixel world rect = (−224, 0) to (+240, 464) with the origin-tile centre at pixel (0,0) — the camera works in this rect, and the tile layer is drawn with that offset applied.
- **Origin (0,0)** = centre of the gate's inner threshold at floor line. **+X = east, +Y = north.** Metre→tile: `t = round(m / 1.524)`.
- **Walls:** `tx = ±14` (east/west, all rows), `ty = 28` (north), `ty = 0` (south) **except gate gap `tx ∈ [−2, 2]`**. Wall cells: `solid`, `los_block`, cost n/a (impassable). Interior walkable: `tx ∈ [−13,13]`, `ty ∈ [1,27]`.
- **Per-tile fields** in the zone's map JSON (GDD-06 §4.6, single source of truth): `solid:bool`, `cost:float`, `cover:int 0|2|5`, `elev:int` (5-ft steps), `los_block:bool`, `encounter:string`, `interact:string`. The renderer, the walkability check and the combat overlay all read this one file.
- **R1 forecourt strip** (walkable, part of A): `ty ∈ [1,4]`, `tx ∈ [−5,5]`, cobble. Beyond the south gate gap: **painted lane card** (P1+P2 both: lane is never walked in the pixel build — GDD-06 §3.1; the city-gate string still fires from a `TR_A_LANE` sight-line trigger at the gap, §4.A).

### 3.2 Scope rings (diegetic boundaries; no invisible walls inside R0)

| Ring | Content | Pixel treatment |
|---|---|---|
| **R0** | Yard interior A–M | Fully playable |
| **R1** | Gatehouse gap + forecourt + 60 m dock lane | Gap + forecourt walkable; **lane = painted backdrop card** behind the gate (facades, city gate, gull posts silhouette). Beacons never point here. |
| **R2** | City of Neverwinter | **Never entered** — vista card over the walls (north/east parallax layer) + menu drift |

Boundary strings (verbatim, fire on approach/look): wall walk — `Guard orders: the wall walk's closed for muster.` · postern doors — `Locked. The sergeant keeps the keys — and the sergeant keeps the keys.` · lane sight-line (`TR_A_LANE`, r3 at gap) — guards cross-arms + `The city gate is barred for the morning muster. The yard's contract is yours, not the city's.` · pre-signing loiter > 45 s — `VO_GUN_014`. Portcullis half-lowered until T11 (Corwin lifts it at departure).

### 3.3 Area index (tile centres; spec section in §4.A–4.M)

```
                N  ty=28 (north wall)
   +------------------------------------------+ tx=-14
   | H archery loft+butts        D tack room  |
   |   butts (-12,27) loft(-13,18)  (10,22)   |
   | G dummies      K rest(7,21)  E contract   |
   |  (-8,13..17)     M bell(0,14) (5,16)      |
   | B desk(-7,6)   L(4,14)  C pedestals y=10  |
   |        F lane (0,5)    I brush (10,10)    |
   |            A gate (0,0..1)  J spar (8,7)  |
   +------------------------------------------+ tx=+14
     S → painted R1 lane card → R2 vista card
```

| Area | Name | Tile centre(s) | Teaches / hosts | Spec | P1 state |
|---|---|---|---|---|---|
| A | Gate & forecourt (+R1 card) | (0,1); box (2,1), board (−2,1) | T0 arrival, T11 departure, lane trigger | §4.A | interactive (arrival, departure stub) |
| B | Muster desk & contract board | (−7,6) | C1 species, C3 background, C4 abilities | §4.B | dressed; placard readable |
| C | Class pedestals & arms rack | (−3,10)(−1,10)(1,10)(3,10); rack (0,12) | C2 class | §4.C | dressed |
| D | Tack room & shield mirror | room (10,22), door (8,20) | C5 appearance, T2-zoom | §4.D | dressed |
| E | Contract table & canopy (Gundren) | (5,16); Gundren (5,17) | T5 signing, C6 name, save creation | §4.E | dressed + Gundren bark; **save created at menu contract page** (P1) |
| F | Movement lane | (0,5); briar (0,7) | T1 movement prompts, DT primer | §4.F | interactive |
| G | Dummy line | dummies (−8,13)/(−8,16); shelf (−9,14); bales (−8,17) | T3 attack, T4 bonus/mastery | §4.G | interactive |
| H | Archery lane & loft | line (−12,17); butts (−12,27); loft (−13,18) | T6 ranged, cover, height | §4.H | dressed (P2 interactive) |
| I | Brush lane | (10,10); pockets (9,8)(12,10)(9,13)(12,14) | T7 hide/surprise | §4.I | dressed (P2 interactive) |
| J | Sparring circle | (8,7); rack (10,5) | T8 full turn loop | §4.J | interactive |
| K | Rest nook | (7,21) | T9 rest/Hit Dice | §4.K | dressed (P2 interactive) |
| L | Pack, folio & codex lectern | (4,14)/(4,15) | T10 kit/codex/options | §4.L | dressed; lectern opens shell codex (P1 convenience) |
| M | Practice bell | (0,14) | sandbox reset, replay beats | §4.M | interactive |

**Guided route (beacons):** A(T0) → F(T1) → D(T2) → G(T3,T4) → E(T5) → H(T6) → I(T7) → J(T8) → K(T9) → L(T10) → A(T11). **P1 active subsequence:** A(T0) → F(T1) → G(T3,T4) → J(T8) → M; beacons skip undressed stations silently (GDD-06 §6.9); beacons never point south of the gate.

---

## 4. RULES PRIMER (self-contained; repeated inline at each station)

> **Provenance:** R1–R13 wordings follow **SRD 5.2.1 (CC-BY-4.0)** — ship the attribution block (§16) on the legal screen and credits. Station *teaching lines* (VO, UI cards) are original writing. Where GDD-03 quoted PHB-only wording, the SRD-equivalent text is used; meaning is identical. **R11** is a documented house rule (shown with a `HOUSE RULE` tag in the codex).

**R1 The d20.** Whenever an outcome is uncertain: roll 1d20 + ability modifier + proficiency bonus (if proficient) vs a Difficulty Class (check/save) or vs Armour Class (attack). Meet or beat = success. Natural 20 on an attack = critical (double the damage dice); natural 1 on an attack = miss.
*Pixel truth:* to-hit preview on hover `1d20+5 vs AC 13`; every player d20 plays R14.

**R2 Advantage/Disadvantage.** Roll two d20, take the higher (Advantage) or the lower (Disadvantage). If both apply, they cancel — roll one die straight.
*Pixel truth:* two-die Roll Moment variant; mint ↑ pips on the target cell.

**R3 Armour Class & attacks; cover.** Attack roll = d20 + mod + PB vs AC. Cover modifies the target's AC: **half cover +2, three-quarters cover +5, total cover = cannot be targeted** (also +2/+5 to Dexterity saves).
*Pixel truth:* 1 pip = +2, 2 pips = +5 on the reticle; tooltip `AC 15 + 2 cover = 17`.

**R4 Ability checks & passives.** Check = d20 + mod (+ PB if proficient) vs DC. Passive score = 10 + modifiers, used when the world observes without rolling (Perception most often).
*Pixel truth:* belt-tag modifiers (diegetic sheet) show live `mod = floor((score−10)/2)`.

**R5 Surprise & hiding.** A creature that fails to notice a threat is **surprised**: it cannot act or take reactions on its first turn. Hiding = DEX (Stealth) check vs the observer's passive Wisdom (Perception) (or active Search); you must break line of sight first; attacking from hiding grants Advantage and ends the hide.
*Pixel truth:* `los_block`/brush cells gate the Hide button; success = `VFX_HIDE_SHROUD` + mint icon.

**R6 The turn.** On your turn: move up to your Speed (split freely), **one Action**, **one Bonus Action** (only if a feature grants one), **one free object interaction**. **One Reaction** per round, refreshed at the start of your turn. End Turn passes the queue.
*Pixel truth:* budget pips on the tactical bar: feet (6 cells at Speed 30) · A · BA · R.

**R7 Movement & terrain.** Difficult terrain (`cost = 2`) costs double movement. Standing from Prone costs half your Speed. Prone: attacks from it have Disadvantage; attacks against it have Advantage within 5 ft, Disadvantage beyond.
*Pixel truth:* hatched cells = `cost 2`; chevrons on prone actors.

**R8 Opportunity attacks & reactions.** When a creature you can see **leaves your reach** without Disengaging, you may use your Reaction for one melee attack. Disengage prevents them for the turn. Dash = +Speed movement.
*Pixel truth:* leaving-reach path segment turns blood-red before commit; reaction card 6 s (off in Story).

**R9 Non-lethal knock-out.** When a **melee** hit from a bludgeoning source (incl. unarmed) would reduce a creature to 0 HP, the attacker may leave it **unconscious and stable** instead. The yard enforces this automatically (R15).

**R10 Resting.** **Short rest** = 1 hour: spend Hit Dice (class die + CON mod each) to regain HP. **Long rest** = 8 hours in safety: all HP, all slots/features, half Hit Dice back.

**R11 Height (house rule — codex-tagged `HOUSE RULE`).** Ranged attacker **≥ 10 ft (elev Δ ≥ 2)** above the target = Advantage; **≥ 10 ft below** = Disadvantage. *(Refines GDD-06 §6.5's Δ≥1 sketch to the GDD-01 §2.5 / GDD-03 R11 threshold the loft is built to: deck = 3 m = 10 ft.)*
*Pixel truth:* ↑/↓ chevrons on the reticle; loft deck cells carry `elev = 2`.

**R12 Weapon Masteries** (verbatim SRD 5.2.1 "Mastery Properties"; usable only by characters with a feature granting them — Fighter & Rogue have it at level 1; yard demo shelf lets any class test all eight):

- **Cleave** — If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon's damage, but don't add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn.
- **Graze** — If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.
- **Nick** — When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.
- **Push** — If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.
- **Sap** — If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.
- **Slow** — If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn't exceed 10 feet.
- **Topple** — If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used for the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.
- **Vex** — If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.

*Pixel truth:* mastery chips on the attack button; each demo fires `VFX_MASTERY_GLYPH_{property}` + verbatim card (§4.G). P1 ships **Push** and **Topple** as live combat masteries (GDD-06 §6.6); all eight are live at the G gallery (P1) and fully live at P2.

**R13 Conditions used in the yard:** Prone (R7) · **Restrained** (Speed 0, attacks vs it Advantage, its attacks Disadvantage — demo card only at P2 snare-side content) · **Unconscious** (spar yield: prone, unaware; wakes at 1 HP after the spar, 3 s).

**R14 Dice theatre / Roll Moment.** Every player-facing d20 renders as a physical die tumbling, landing with the natural face visible; modifiers tick on beside it; result banner in plain language (`HIT — 17 vs AC 15`).
*Pixel truth:* 6-frame tumble + 4 result states (fail/success/crit/fumble), 0.4 s hold on result, ≤ 1.5 s total; bronze/mint variants; skippable under Brisk/Instant pace; feed-only rolls (routine enemy attacks) get compact popups only.

**R15 Yard sandbox overrides.** No death — any combatant reduced to 0 HP **yields at 1 HP** (`YIELDED` card instead of death); dummies reset 6 s after last hit; infinite training arrows; rests free with instant results; no alert states; weather is cosmetic. Active for every encounter whose `encounter` id lives in this document.

---

## 5. PART A — GAME MENU (SHELL) BUILD SPEC  [P0]

> Pixelates GDD-02 completely. Screen state machine (`web/js/core/state.js`): `legal → sting → menu → {new_contract, ledger, options, codex, credits, contract_confirm} → loading → yard`, plus the pause overlay inside the yard. All UI text ≥ 5 px, contrast ≥ 4.5:1 (palette lint). Faces: `pixel_ui_5` (chrome, 5 px), `pixel_body_8` (prose, 8 px) and `pixel_display_10` (headings) per GDD-06 §4.5; bitmap atlases only — no webfont, no TTF and no `fillText` in the build.

### 5.1 Brand & lockups (pixel construction)

- **Wordmark `logo_wordmark.png`:** `DELVE` in 5×7-pixel display face, cap height 18 px, letter-spacing 2 px, bronze `#B0793A` face with 1-px ink `#101418` keyline and 1-px mint `#74E0B4` rim-light on the lower-left of each glyph (fore-shadow). Chisel-flat right arms on E; V apex drops 2 px below baseline.
- **Emblem `logo_emblem.png` 24×24:** downward equilateral triangle (d20 face), three descending 2-px steps cut from the top edge toward centre, 2 px bronze stroke, 2 px mint pip at centroid. Min size 24 px (below: wordmark alone). Steps light top→bottom in mint on load-complete / chapter stamp (loading seal §5.9 uses the same asset).
- **Lockups:** boot/splash = wordmark + emblem + two-line sublock + disclaimer · menu = wordmark + emblem side by side, top-left · save-stamp = emblem only with wax treatment · window icon = emblem.
- **Sublock (splash, 5 px, letterspaced, two lines):**
  `A DUNGEONS & DRAGONS ADVENTURE`
  `PHANDELVER AND BELOW · THE SHATTERED OBELISK`
- **Fan-work disclaimer (verbatim, ships on legal screen, menu bottom-left, credits bottom):**
  `An unofficial, non-commercial fan project. Dungeons & Dragons, Phandelver and Below: The Shattered Obelisk and all Wizards of the Coast characters and locations are trademarks of Wizards of the Coast LLC. Used here without permission; no challenge to any trademark or copyright. This game will never be sold.`
  At 5 px on 480-wide this wraps to 3 lines in the legal/credits contexts; the menu bottom-left line may abridge to `An unofficial, non-commercial fan project. · Never for sale.` (tooltip holds the full text).

### 5.2 Boot sequence (exact order, strings, timings)

1. **Legal/attribution screen** — full-screen ink `#101418`, parchment text 8 px: emblem 24 px top-centre (y 20); disclaimer (§5.1) block at y 56, width 384 centred; **SRD CC-BY attribution block** (§16) y 116; shipping line (`STR_ENGINE_LINE` = `Made with HTML, CSS & JavaScript`) y 168; font credits `UI type: 5×7 system font (MIT) & Silkscreen (OFL)` y 180; bottom centre pulse 5 px `Press any button to continue.` (0.8 s blink). **Any input continues AND unlocks audio** (the browser's gesture gate: nothing may play before a real input, so this page is where the audio graph starts and everything asked for earlier is queued). Font atlases are warmed here so the sting's first frame never waits on a fetch.
2. **Logo sting** — 4.0 s, skippable after 1.5 s by any input; ink background; t 0.0–0.8 emblem outline draws + `SFX_BOOT_STONE`; 0.8–2.0 three steps light top→bottom (`SFX_BOOT_EMBERS` ×3); 2.0–3.0 wordmark chisels letter-by-letter (`SFX_BOOT_CHISEL` ×5); 3.0–3.6 sublock fades + bronze sweep (`MUS_BOOT_STING`); 3.6–4.0 hold → 0.6 s cross-fade to menu. Reduced-motion: cut straight to end frame, still ≥ 1.0 s.
3. **Menu** — fade in 0.6 s (§5.4).

### 5.3 Menu backdrop — yard at dawn (painted, 3 layers)

- **Scene reference (art direction, painted into 3 PNGs wider than 480):** the yard at **06:10**, mist band, gulls; **no tutorial triggers, NPCs idle-only**: clerk shuffles papers at B, sergeant oils a blade at J, two trainees spar at 30% intensity, **Gundren absent from E — empty chair, lantern still lit** (narrative tease). These reads are painted into the parallax art (P1); P2 polish may swap in live idle rigs behind the menu (optional, GDD-06 §7.2 keeps painted as default).
- **Layers (`js/screens/menu.js` drawing from `js/ui/`):** L0 sky/vista card (drift 0.4 px/s), L1 far walls + loft silhouette (0.8 px/s), L2 near yard furniture + mist band (1.6 px/s); mist = 2-frame swap at 1.5 Hz; **8 motes** 1-px bronze/mint rising at 6 px/s (frozen under reduced-motion / camera comfort `Reduced motion`). Each layer is a PNG wider than 480 blitted at an integer offset — no image is ever scaled.
- **Look-at drift loop (replaces GDD-02 waypoint camera):** horizontal pan of the layer group, 90 s ping-pong across ±60 px, easing sine; no DOF (pixel-pure).
- **Audio bed:** `AMB_YRD_DAWN_MENU` + `MUS_MENU_THEME` (90 s loop: hummed dwarf march, bouzouki + frame drum + low cello). **50% intensity variant** `MUS_MENU_THEME_VAR` when CONTINUE is hovered and saves exist.

### 5.4 Menu layout — exact 480×270 rects

| Element | Rect (x, y, w, h) | Style |
|---|---|---|
| Menu lockup (wordmark+emblem) | (29, 22, 96, 24) | `logo_menu.png`; anchor = GDD-02 6%/8% |
| Column x | **29** | 6% of 480 |
| Item 1 `PLAY` | (29, 92, 140, 18) | 34 px→**10 px display** (5×7 ×2) parchment `#E9DFC8` |
| Item 2 `CONTINUE` | (29, 113, 140, 18) | gap 3 px (1.2%); item pitch 21 px |
| Item 3 `OPTIONS` | (29, 134, 140, 18) | |
| Item 4 `CODEX` | (29, 155, 140, 18) | |
| Item 5 `CREDITS` | (29, 176, 140, 18) | |
| Hover underline | (29, item_y+14, w_draw, 2) | bronze; draws L→R 0.18 s + `SFX_UI_MOVE` pip |
| Selected | underline full + emblem steps flicker 0.2 s | `SFX_UI_CONFIRM` |
| Disclaimer line | (10, 259, 300, 8), left | 5 px, 60% alpha (abridged string §5.1) |
| Version stamp | right-aligned to (470, 259), 5 px | `DELVE v{build} · fan work · {date}` in `pixel_ui_5` |
| Top-right | *clean — nothing* | GDD-02 §2.3 |

- Navigation: ↑↓ / stick / mouse hover. **`ESC` does nothing on the menu** (no back-exit; Alt-F4/browser close only).
- `CONTINUE` with no saves: **dimmed 40%** + tooltip on hover: `No contracts signed yet.` + `SFX_UI_DENY` if pressed.

### 5.5 PLAY / CONTINUE / first-run / ledger flows (exact strings)

**PLAY, no save** → **First Run page** (`Sign the contract`) → **Loading** (§5.9) → YARD.
**PLAY, save exists** → overlay card (parchment nine-patch 8 px corners, wax emblem 24 px): title `Begin a new contract?` · body verbatim `A signed contract already exists: "{slot name} — {class}, {level}, {chapter}". Starting anew will not erase it; up to 8 contracts may rest in the ledger.` · buttons `BEGIN NEW` · `BACK`. `BEGIN NEW` → First Run with first empty slot.
**CONTINUE** → **Ledger** → selected slot → Loading → YARD (resume).

**First Run page** — single parchment panel **(40, 16, 400, 238)**, ink text, three pill groups (nine-patch parchment pills, h 16, gap 4; selected pill = bronze fill + ink text):

| Group | y | Options (pills) | Default | Help (8 px, under group) |
|---|---|---|---|---|
| `Difficulty` | 56 | `Story` / `Balanced` / `Tactical` | **Balanced** | `Story: forgiving foes, longer reaction timers. Balanced: the intended table. Tactical: sharper foes, alert states bite.` |
| `Combat pacing` | 104 | `Table Mode (turn-based)` / `Skirmish Mode (real-time, pausable)` | **Table Mode** | `Table Mode is the intended experience: full turns, full information. Skirmish Mode runs the same rules in flowing real time with pause.` — Skirmish pill carries tag `SECONDARY` (stored; scheduler is P2+/greenlit per GDD-06 — P1 tooltip: `Coming after the Table Mode yard ships.`) |
| `Subtitles` + `Camera comfort preset` | 152 | `On`/`Off` (default **On**) · `Standard`/`Reduced motion` (default **Standard**) | | subtitles drive `Sound` VO captions; comfort freezes motes/sting shortens |

Footer buttons **(56, 224, 148, 18)** `BACK` · **(276, 224, 148, 18)** `SIGN & DESCEND` → save slot created here (P1: slot label = `New contract` until yard naming at E, P2: relabels at E signing) → Loading. All values re-editable later in Options.

**Ledger** — panel (60, 24, 360, 222): title `The contract ledger`; **8 rows** (24 px each, y 48+24i): emblem stamp (steps lit = beats completed) · slot name · `{class} · {chapter}` · date. Row actions: select (confirm) / `DELETE` (blood `#8E2F26` confirm card: `Break this contract?` · `BREAK` · `KEEP`). Empty slot row: `— empty —` dim 40%. Boot edge cases: corrupt save → ink card `The ledger is scorched. (save failed checksum)` + `RETRY` / `CONTINUE WITHOUT SAVING`.

### 5.6 Options (pixel row set)

Schema-driven from `web/data/options_schema.json`: the page renders whatever the schema says, so a row is a data change (the 3D-only rows are **deleted**, GDD-06 §6.12). Layout: tab rail (8,16,72,238) tabs `Graphics` `Gameplay` `Accessibility` `Audio` `Controls`; rows panel (88,16,384,238); row h 20; controls right-aligned: segmented pills / toggle / slider-as-10-pips / rebind button. `BACK` (88,244,80,18) commits the settings and writes the save document.

| Tab | Rows (label · control · values · default · help verbatim) |
|---|---|
| Graphics | `Resolution` · list · `Native` (integer-scaled canvas offered as 960×540/1440×810/1920×1080) — help: `The game always renders in whole pixels.` · `Frame rate cap` · 30/60/90/120/Unlocked · **60** · `Quality preset` · Low/Medium/High · **High** (affects mist/motes only — no 3D knobs ship) |
| Gameplay | `Show hit chances` On/Off **On** · `Rules grid overlay` Off/On-hover targeting/Always **Off** · `Enemy turn pace` Cinematic/Brisk/Instant **Cinematic** · `Reaction prompts` Ask always/Auto-take/Auto-pass **Ask always** · `Reaction timer` Off/6 s/10 s **6 s** · `Auto-end turn` On/Off **Off** · `Difficulty` (as first run) · `Combat pacing` (as first run) · `Fast travel` locked Off — help: `The road is part of the story. The map opens in later chapters.` |
| Accessibility | `Subtitles` On/Off **On** · `Subtitle size` S/M/L **M** · `Speaker names in subtitles` On/Off **On** · `Colourblind filter` Off/Protanopia/Deuteranopia/Tritanopia **Off** (3 LUT variants of **overlay tints only**, never the art palette) · `High-contrast UI` On/Off **Off** · `Reading magnification (ui_scale)` 1×/2× **1×** · `Reduced motion` On/Off **Off** (freezes motes, skips dice tumble, shortens sting) · `Difficult-terrain outline` Off/Subtle/On **Subtle** · `Cover outlines` Off/On-hover/Always **On-hover** · `Touch controls` Auto/Off **Auto** |
| Audio | `Master`/`Music`/`SFX`/`Voice` sliders 0–100 (**90/80/90/100**) · `Mute when unfocused` On/Off **On** |
| Controls | rebind table: move (WASD/arrows) · sprint (Shift) · interact/confirm (F) · end turn/confirm (Space) · pause/back (Esc) · grid overlay (G) · folio (Tab) · journal (J) · codex (C) · hide (H) · view-zoom (V, §4.D) · pad layout A/B swap. Rebind flow: the pill becomes `Press a key…`, the next physical key is captured (Esc cancels), and both the display label and the key code are stored in the save so the binding survives a reload — 12 actions, all re-applied at boot. |

Deleted vs GDD-02 50-row set: all 3D camera rows (FOV, boom, snap turn, head bob, first-person default), ray-traced shadows, foliage density, quality beyond mist/motes — schema version bumps to record removal (GDD-06 §6.12).

### 5.7 Codex (from menu and from lectern L / key `C`)

Three-tab rail + scrolling folio page, page-turn 2-frame anim + `SFX_UI_PAGE`. Body 8 px, title 10 px, parchment panel.

- **Rules** — pre-loaded, every entry SRD-sourced (T-47 discipline), entry list exactly: the d20 rule · Advantage/Disadvantage · AC & attack rolls · cover table · ability checks & DCs · passive scores · surprise · hiding · turn anatomy · difficult terrain · reactions & opportunity attacks · resting · conditions glossary · weapon masteries (all eight verbatim, R12) · non-lethal knock-out · **house rule height advantage tagged `HOUSE RULE`** (R11) · yard sandbox note (R15).
- **Lore** — empty state verbatim `The ledger is blank. Lore earns itself.` Unlocks in play (out of yard scope).
- **Bestiary** — empty state `No creatures catalogued yet.` After first meetings: **training dummy** (AC 10, HP ∞ gauge, no turns) and **sparring partner Marra** (AC 12, HP 14) statblocks (GDD-06 §6.10 cheap-win unlock).

### 5.8 Credits

Full-screen ink; vertical scroll **15 px/s** (480-space equiv of GDD-02's 60 px/s @1600), hold-to-speed ×3; content blocks: Design & Direction / Engineering (`HTML, ES modules & canvas · no engine`) / Art & Lighting (incl. generated-art provenance note, `art_manifest.json`) / Audio & Voice / **Rules Texts** — SRD 5.2.1 attribution paragraph verbatim (§16) + fan disclaimer (§5.1) / Fonts (MIT/OFL names) / Hosting (`GitHub → Vercel · static deploy`) / Playtesters / end line `Made with love for the table. Never for sale.` End card: emblem 48 px, all three steps lit mint, hold 2 s → `BACK`.

### 5.9 Loading screen

- **When:** menu→yard (first load & resume), save resume. Not for in-yard streaming (none exists — the yard is a handful of tile atlases fetched once). **Minimum dwell 1.2 s** always; the load is well under 100 ms, so the route animation is a paced beat, not a lie (GDD-06 §7.4). Progress comes from real fetch weights (art & audio 70 % / yard map & tiles 20 % / data 10 %) and never regresses.
- **Layout:** zone title top-centre y 14, 10 px: `NEVERWINTER — THE ROCKSEEKER CONTRACT` · parchment map card **(24, 32, 432, 164)** with the journey route **inking itself** in dark mint = progress (menu→yard draws Neverwinter harbour → yard glyph) · tip slip bottom-left **(24, 204, 320, 46)** (8 px, cross-fade 0.4 s, cycle 5 s) · wax-seal emblem **(416, 204, 48, 48)** rotating 6°/s with 8 px percentage inside; steps light at 33/66/100%.
- **The 16 tips (verbatim, rotate in order):**
  1. `Goblins fight to the death until only one remains — and that one runs. Catch it, and the trail is yours.`
  2. `Half cover adds +2 to AC and Dexterity saves; three-quarters cover adds +5. Shoot through thickets at your peril.`
  3. `A surprised creature skips its first turn entirely. Stealth is a weapon — spend it well.`
  4. `Weapon masteries: Push shoves 10 feet. Topple knocks Prone. Vex grants Advantage on your next hit. Learn their manners.`
  5. `Falling Prone costs half your Speed to stand, and attacks from Prone have Disadvantage. Mind the fire pit.`
  6. `You can knock a creature unconscious instead of killing it with any bludgeoning hit that would drop it — prisoners talk.`
  7. `High ground grants Advantage on ranged attacks; low ground imposes Disadvantage. The archery loft exists for a reason.`
  8. `Reactions refresh at the start of YOUR turn, not the round's. Budget them like coins.`
  9. `Difficult terrain costs double movement. Briars, rubble and knee-deep streams all bite.`
  10. `A short rest lets you spend Hit Dice to heal. A long rest returns everything — if the place is safe. The cave mouth is not.`
  11. `Darkvision is not daylight: beyond 60 feet even dwarves guess. Carry a lantern, or carry a wizard.`
  12. `Hiding beats passive Perception, not eyes: break line of sight first, then roll.`
  13. `Concentration breaks on damage unless you pass a Constitution save. Protect your casters' focus.`
  14. `The die is the truth: every roll in DELVE is a real d20 simulation. Watch the dice theatre — it never lies.`
  15. `Press V to see the world through your hero's own eyes. Press it again to shoulder the camera back.` → **pixel replacement tip:** `Press V to lean in close — 2× zoom for mirrors and conversations. Press it again to step back.`
  16. `Turn-based is the intended rhythm. Skirmish Mode waits in Options for the impatient.`
- **Complete →** seal stamps (`SFX_LOAD_STAMP`), 0.5 s hold, 0.6 s fade to yard T0 (§4.A).
- **Error state:** card replaces tips: `The road is washed out. (Asset load failed: {id}). Retry?` buttons `RETRY` · `QUIT TO MENU`.
- **Timeout > 45 s:** tips swap to `Still packing the wagon… large loads take a moment on first visit.`

### 5.10 Menu audio (every cue)

| ID | Type | Trigger |
|---|---|---|
| `MUS_MENU_THEME` | loop 90 s | menu enter |
| `MUS_MENU_THEME_VAR` | loop 90 s | CONTINUE hovered with saves |
| `AMB_YRD_DAWN_MENU` | loop | menu bed (§5.3) |
| `SFX_UI_MOVE` | one-shot | item hover change |
| `SFX_UI_CONFIRM` | one-shot | selection (warm wood knock) |
| `SFX_UI_BACK` | one-shot | back (soft page flip) |
| `SFX_UI_DENY` | one-shot | dimmed item pressed |
| `SFX_UI_PAGE` | one-shot | codex/options page turn |
| `SFX_BOOT_STONE` `SFX_BOOT_EMBERS` `SFX_BOOT_CHISEL` ×5 `MUS_BOOT_STING` | one-shots | sting §5.2 |
| `SFX_LOAD_STAMP` | one-shot | loading complete |

One-shots ≤ 150 KB each; a music bed is exempt (it cannot honestly fit, see GDD-06 §8.1). Existing keepers already in `web/assets/audio/`: `mus_menu_theme.ogg` + `vo_grd_001..003.ogg`; the rest of the table lands cue by cue — `tools/check_project.py` reports how many files are present, and a cue with no file is silent rather than fatal.

### 5.11 Shell string master table (every string the menu ships)

| ID | String |
|---|---|
| STR_MENU_PLAY | `PLAY` |
| STR_MENU_CONTINUE | `CONTINUE` |
| STR_MENU_OPTIONS | `OPTIONS` |
| STR_MENU_CODEX | `CODEX` |
| STR_MENU_CREDITS | `CREDITS` |
| STR_MENU_NOSAVE | `No contracts signed yet.` |
| STR_NEW_TITLE | `Begin a new contract?` |
| STR_NEW_BODY | `A signed contract already exists: "{0} — {1}, {2}, {3}". Starting anew will not erase it; up to 8 contracts may rest in the ledger.` |
| STR_NEW_BEGIN | `BEGIN NEW` |
| STR_BACK | `BACK` |
| STR_FR_TITLE | `Sign the contract` |
| STR_FR_DIFF | `Difficulty` |
| STR_FR_PACE | `Combat pacing` |
| STR_FR_SUBS | `Subtitles` |
| STR_FR_COMFORT | `Camera comfort preset` |
| STR_FR_GO | `SIGN & DESCEND` |
| STR_LOAD_TITLE_YRD | `NEVERWINTER — THE ROCKSEEKER CONTRACT` |
| STR_LOAD_TITLE_CH1 | `CHAPTER 1 — A DANGEROUS JOURNEY` |
| STR_LOAD_ERR | `The road is washed out. (Asset load failed: {0}). Retry?` |
| STR_LOAD_SLOW | `Still packing the wagon… large loads take a moment on first visit.` |
| STR_RETRY | `RETRY` |
| STR_QUIT_MENU | `QUIT TO MENU` |
| STR_CODEX_LORE_EMPTY | `The ledger is blank. Lore earns itself.` |
| STR_CODEX_BEST_EMPTY | `No creatures catalogued yet.` |
| STR_BOOT_ANY | `Press any button to continue.` |
| STR_CREDITS_END | `Made with love for the table. Never for sale.` |
| STR_PAUSE_TITLE | `PAUSED` |
| STR_PAUSE_RESUME | `RESUME` |
| STR_PAUSE_MENU | `RETURN TO MENU` |
| STR_LEDGER_TITLE | `The contract ledger` |
| STR_LEDGER_EMPTY | `— empty —` |
| STR_BREAK_TITLE | `Break this contract?` |
| STR_BREAK_YES | `BREAK` |
| STR_BREAK_NO | `KEEP` |

### 5.12 Player journey (menu → yard → combat → reset)

```
[COLD LOAD] browser boot → canvas focus → audio unlocks on first gesture
   ↓
LEGAL (§5.2.1) → STING (4.0 s / skip 1.5 s) → MENU (§5.4)
   ├ PLAY (no save) → FIRST RUN → SIGN & DESCEND → LOADING (min 1.2 s) → YARD T0
   ├ PLAY (save) → "Begin a new contract?" → FIRST RUN → …
   ├ CONTINUE → LEDGER → LOADING → YARD resume
   └ OPTIONS / CODEX / CREDITS
   ↓
YARD EXPLORE: 8-way walk · beacons (P1: T1→T3→T4→T8) · interact chip "F — …" · Esc pause
   ↓ step on encounter cell + F (or proximity for sparring when T8 armed)
ENCOUNTER (0.6 s): actors pixel-snap to cells · grid fades in · initiative rolls · music crossfades
   ↓
TABLE MODE: queue strip · budget pips · click-to-move ≤ 6 cells · ATTACK/BONUS bar · AI telegraphs ·
            Roll Moment on every player d20 · yard rules R15 (yield at 1 HP)
   ↓ win / yield
RESULT card ("Training complete." / "Good spar.") → EXPLORE
   ↓ ring practice bell (M)
resets dummies · respawns trainees · re-arms beats for replay · (P2) relabels save at E
```

---

## 6. PART B — YARD AREA-BY-AREA BUILD SPECIFICATION (A–M)

> Template per area: purpose → tile geometry & surfaces → prop placement (tile coords) → triggers & logic → rules payload (inline) → interaction strings → NPC → camera → audio → VFX → fail-forward/skip. P1 behaviour noted where it differs from the full (P2) spec. Ground painting: forecourt cobble from `ty 1..4`, packed dirt elsewhere, verge grass borders on 1-px wall shadow line, plank sliver at the gate gap (families from GDD-06 §5.4).

### 4.A — AREA A: GATE, FORECOURT & LANE CARD (R0 entry + R1 threshold)

**Purpose:** T0 fade-in arrival; first vista read; lane sight-line trigger; T11 departure (P2).
**Geometry:** gatehouse arch straddling south wall, gap `tx −2..2` at `ty 0`; portcullis half-lowered sprite until T11; gate door leaves pinned open against wall; forecourt cobble `ty 1..4`, `tx −5..5`; beyond gap: painted lane card (facades, rope coils, gull posts, closed city gate) + R2 vista above walls.
**Props:** A1 `M_YRD_GUARD_BOX` (2,1) — Corwin's post, shutter open · A2 `M_YRD_NOTICE_BOARD` (−2,1) — readable `UI_A_BOARD` placard · A3 `M_YRD_BARREL` ×2 (3,2)/(4,3) · A4 `M_YRD_LANTERN_POST` ×2 (±3,1) · A5 lane-card silhouettes (painted) · A6 `M_YRD_ROPE_CORDON` painted at gap edge.
**Triggers:**
- `TR_A_ARRIVE` r2 @(0,2): load-complete → input on, `AMB_YRD_DAWN` start, `VO_GUN_001` spatialised from E (Gundren visible waving — P1: bark without requiring his rig at E during T0), beacon wisp to F.
- `TR_A_LANE` r3 @(0,0) first entry → `VO_GRD_001` + journal margin note `STR_J_LANE`: `The city gate is barred for the morning muster. The yard's contract is yours, not the city's.`
- `TR_A_VISTA`: look-input held 2 s facing a wall → card `UI_A_VISTA`: `Neverwinter — the City of Skilled Hands. Somewhere south of here, a dwarf and a map are already in trouble.`
- `TR_A_DEPART` box `tx −2..2`, `ty 0..1` (P2): if !signed → `VO_GRD_003` + beacon to E; if signed & T10 done → T11: wagon + oxen sprites roll into forecourt (2 s), Gundren & Sildar mount, RIDE montage (GDD-01 §14.3), zone unload at montage cut. **P1: trigger shows `The muster isn't done — ring the practice bell instead.` (no departure; yard is the loop).**
- Pre-signing loiter at gap > 45 s → `VO_GUN_014` once.
**Rules payload:** none new (movement taught at F).
**NPC:** **Corwin** (guard; GDD-03 spells "Corvin" — same character, codebase `npc_corwin`): home A1; idle lean/scan; blocks nothing. Two lane guards painted on the card. P1: Corwin's interact bark = `Mornin'. Contract folk through the gate, city folk wait — them's the orders, not mine.` (reuses `VO_GRD_001`).
**Camera:** T0 opens at (0,3) zoom 1× facing north; no first person.
**Audio:** `AMB_YRD_DAWN` bed (gulls 20–40 s `A_ONE_GULL_CRY`, harbour bell ~90 s `A_ONE_CITY_BELL`, rope creaks, distant blade-clacks); `A_ONE_GATE_CREAK` on first gap crossing; `A_LOOP_FLAG_SNAP` at gatehouse; gap adds `AMB_DOCK_LANE` fades (city murmur behind the card).
**VFX:** `VFX_MIST_GROUND` until 07:30; `VFX_GULL_FLOCK` 2-frame cards on vista layer; `VFX_BEACON` → F after T0.
**Fail-forward:** departure gated only by signature+T10 (P2); lane optional; nothing fails.

### 4.B — AREA B: MUSTER DESK & CONTRACT BOARD (C1 species · C3 background · C4 abilities)

**Purpose:** in-world creation stations. **P1: dressed — desk geometry + placards `The muster ledger…`, `Letters of introduction…`, `The clerk's dice cup…` readable but inert; creation happens at the menu contract page. P2: full interactive.**
**Geometry:** raised dais `tx −8..−6`, `ty 5..7` (0.2 m ≈ flat tile trim); desk faces south at (−7,6).
**Props:** B1 `M_YRD_DESK_MUSTER` (−7,6) · B2 `M_YRD_LEDGER_BOOK` on desk · B3 `M_YRD_STOOL` (−7,7) · B4 `M_YRD_BOARD_CONTRACT` (−7,8) · B5 `M_YRD_PAPER_SHEET` ×12 pinned (backgrounds) · B6 `M_YRD_ABACUS` · B7 `M_YRD_DICE_CUP` + dice · B8 `M_YRD_INK_WELL` · B9 `M_YRD_LANTERN_POST` (−8,5).
**Triggers (P2):**
- `TR_B_SPECIES` box @(−7,5): `F` → ledger UI: **Human, Elf, Dwarf, Halfling, Dragonborn, Gnome, Half-Orc, Tiefling** (2024 chassis / SRD list). On choose: 0.8 s body-morph blend on player rig (palette+tint swap at P1-fidelity), trait card (Size, Speed 30 ft, darkvision 60 ft where applicable, key trait line); clerk bark `VO_CLK_002a..h`.
- `TR_B_BG` box @(−7,8): `F` → board UI: 12 letters = backgrounds, **hook texts verbatim (project adventure text, fan-work posture):**
  - **Acolyte:** `The frontier town of Phandalin is resilient, but organized religious resources are scarce. Your temple in Neverwinter sent you to Phandalin to pray and offer communion with like-minded faithful.`
  - **Charlatan:** `You've planned your latest get-rich-quick scheme. The townspeople of Phandalin have never heard of what you're selling, and you hope to establish a customer base.`
  - **Criminal:** `You're wanted for crimes in Neverwinter, and perhaps you're exiled from the city. Phandalin is a small bastion of civilization where you can lie low and no one will be the wiser.`
  - **Entertainer:** `You've spent time in Neverwinter and love performing for audiences, but you need new experiences from which to draw inspiration for your art. Traveling to Phandalin will provide new material for your work, and its watering holes promise eager crowds.`
  - **Folk Hero:** `You may have humble origins, but you made your name as a hero in the wilds outside Neverwinter. You need new adventures, so you've set off for the frontier of Phandalin.`
  - **Guild Artisan:** `You learned a useful trade in Neverwinter, but the city is home to too many artisans with that skill. Now, you're heading to Phandalin, where you hope to start a lucrative business.`
  - **Hermit:** `You've spent a lot of time in the wilds outside Neverwinter, but you've always kept a home in the city. You've decided to move somewhere rural, and Phandalin seems like the perfect place.`
  - **Noble:** `Your family is based in Neverwinter but owns property throughout the Sword Coast region. You recently inherited a cottage in Phandalin and must inspect the place before you decide to keep or sell it.`
  - **Outlander:** `You spent your youth with a guardian who lived a simple life in the wilds outside Phandalin, but later you moved to the city. Now an adult, you've decided to return to the area where you feel most at home.`
  - **Sage:** `In the academic halls of Neverwinter, you studied the region's historical alliance between Phandalin and its neighbors. The fate of the lost mine of Phandelver has always fascinated you, so you're traveling to Phandalin to discover whether any locals know rumors of its fate.`
  - **Sailor:** `You've sailed ships along the Sword Coast, but a brush with death made you rethink your profession. You're headed to Phandalin to decide what's next.`
  - **Soldier:** `You are a member of the Neverwinter Guard, and you suffered a terrible injury in the line of duty. You healed, but you're not ready to return to work yet. Until you are, you're taking easy jobs protecting merchant wagons headed to Phandalin.`
  On choose: paper unpins, flies to folio (`VFX_PAPER_FLY`); proficiency card (skill proficiencies + tool/language per background).
- `TR_B_ABIL` box @(−7,6): `F` → methods UI: **Point buy** (27 points; cost 8=0,9=1,10=2,11=3,12=4,13=5,14=7,15=9), **Standard array** (15,14,13,12,10,8), **Roll** (4d6 drop lowest ×6, dice theatre per R14). Live belt-tag modifiers update (`mod = floor((score−10)/2)` — R4).
**Rules payload inline:** R1, R4; species trait summaries; background proficiencies.
**Strings:** `UI_B_LEDGER` `The muster ledger — blood and breed: choose your species.` · `UI_B_BOARD` `Letters of introduction — choose the background that sent you south.` · `UI_B_CUP` `The clerk's dice cup — fate, if you trust it; beads, if you don't.`
**NPC:** Clerk Odile Vess, home desk edge; idle shuffle/stamp; `VO_CLK_001` on approach; species `VO_CLK_002a..h`; abilities `VO_CLK_003`; background `VO_CLK_004`.
**Camera:** station open → 2× zoom to over-desk framing; release on close.
**Audio:** `A_ONE_PAGE_TURN`, `A_ONE_QUILL`, `A_ONE_STAMP_THUNK`, `A_ONE_DICE_CUP_SHAKE`, `A_ONE_DICE_ROLL_TABLE`, `A_ONE_PAPER_UNPIN`.
**VFX:** `VFX_PAPER_FLY`; beacon → C after all three chosen (or skip-marked).
**Fail-forward:** all choices revisitable until signing; clerk never blocks.

### 4.C — AREA C: CLASS PEDESTALS & ARMS RACK (C2 class)

**Purpose:** class choice with demo holograms. **P1: dressed (four pedestal sprites + rack readable); class fixed by contract-page loadout note — P1 ships a **pre-picked Fighter loadout** unless contract page's future class step is added; P2 full interactive.**
**Props:** C1 pedestals ×4 at (−3,10)/(−1,10)/(1,10)/(3,10), totems: sword+shield slab / prayer stone `M_YRD_PRAYER_STONE` / spell lectern `M_YRD_LECTERN_SPELL` / shadow post `M_YRD_SHADOW_POST` · C5 `M_YRD_ARMS_RACK` (0,12) · C6 `M_YRD_WHETSTONE_POST` (−4,11).
**Triggers (P2):** `TR_C_FIGHTER/CLERIC/WIZARD/ROGUE` r1 on each pedestal: `F` → 6 s demo (`VFX_HOLO_*` palette-keyed shimmer cutout): Fighter phantom cleaves two straw bales; Cleric phantom rings a trainee in radiant ward then mends; Wizard phantom cones burning hands into a straw pile; Rogue phantom vanishes in smoke behind a dummy. End → starting kit equips (swap anim) + class card:
- **Fighter** — Hit Die d10; Primary Str or Dex; all armor, shields, martial weapons; Str/Dex/Con saves; level 1: Fighting Style, Second Wind (2 uses), **Weapon Mastery (2 weapons)**; no spells.
- **Cleric** — d8; Wisdom; light armor, shields, simple weapons; Wis/Cha saves; level 1: Spellcasting (2 cantrips, 2 slots), Divine Order; no Weapon Mastery.
- **Wizard** — d6; Intelligence; no armor, simple weapons; Int/Wis saves; level 1: Spellcasting (3 cantrips, 2 slots, spellbook), Arcane Recovery; no Weapon Mastery.
- **Rogue** — d8; Dexterity; light armor, simple weapons + longswords/rapiers/shortswords/hand crossbows; Dex/Int saves; level 1: Expertise (2), Sneak Attack 1d6, Thieves' Cant, **Weapon Mastery (2 weapons)**; no spells.
Starting equipment lists shown on card, granted at signing. **HP at level 1 = max(Hit Die) + CON mod** (R1).
**Rules payload inline:** R1, R12 (who holds masteries at level 1).
**NPC barks:** Sergeant `VO_SGT_002a..d` per class: Fighter `Sword and shield! Good. The yard'll teach you the rest.` · Cleric `A praying soldier still loads a punch. Fine.` · Wizard `Books burn, wizard. Stand behind the shield-wall, eh?` · Rogue `Keep them hands visible in MY circle, knife.`
**Camera:** demo = 3 s 2× zoom orbit substitute — pan around pedestal (skippable by movement input).
**Audio:** `A_ONE_PEDESTAL_TURN`, `A_ONE_HOLO_SHIMME`, `A_ONE_RACK_RATTLE`; demo reuses `A_ONE_SWING_WHOOSH`, `A_ONE_FIRE_WHOOSH`, `A_ONE_RADIANT_CHIME`, `A_ONE_SMOKE_POOF`.
**Fail-forward:** re-choose free until signing; reaching T3 unclassed → Gundren bark `VO_GUN_005b` `The pedestals aren't going to choose for ye, hero.`

### 4.D — AREA D: TACK ROOM & SHIELD MIRROR (C5 appearance · T2)

**Purpose:** appearance editor; **T2 in pixel = zoom-in cue (no first person anywhere).** **P1: dressed exterior + door; mirror inert.**
**Geometry:** tack-room shell `tx 8..12`, `ty 20..24` (walls solid/los_block), door gap south at (8,20); rug + peg sprites inside.
**Props:** D1 `M_YRD_TACK_ROOM` shell · D2 `M_YRD_MIRROR_SHIELD` (10,22) polished shield on stand · D3 `M_YRD_RUG` (10,21) · D4 `M_YRD_LANTERN_HOOK` ×2 inside.
**Triggers (P2):** `TR_D_DOOR` → `A_ONE_DOOR_CREAK_TACK` · `TR_D_MIRROR` r1 @(10,21): `F` → appearance UI (face/hair/skin/voice presets 8 px chips; **world camera holds at 2× zoom on the mirror** = the "see yourself" beat; voice preset drives player-bark pitch only). First `V` anywhere after first mirror open → prompt `UI_D_VIEW`: `Press V to lean in close — 2× zoom. Press it again to step back.` + `VO_GUN_002`: `Ha! Look at yerself. Eyes front, chin up — that's an adventurer's face, or close enough.`
**Rules payload:** none (cosmetic). **Parity note:** GDD-01's first-person T2 is fully retired; the zoom cue is its only replacement (GDD-06 §3.1).
**Audio:** `A_LOOP_TACK_LEATHER_CREAK`, `A_ONE_MIRROR_SHINE`, `A_ONE_DOOR_CREAK_TACK`.
**Fail-forward:** appearance re-openable until departure.

### 4.E — AREA E: CONTRACT TABLE & CANOPY (Gundren · C6 name · T5 signing · save creation)

**Purpose:** contract signing, name entry, save (re)labelling, journal open, sandbox unlock.
**P1:** dressed canopy+table; **save already exists from menu**; Gundren present as bark source (`VO_GUN_003` hint if creation incomplete is N/A — P1 bark: `VO_GUN_005` welcome after T4); journal auto-opened at first yard entry instead of at signing.
**P2 full flow below.**
**Geometry:** canopy 4×3 m ≈ 3×2 tiles at (5,16); table (5,16); stools (4,15)/(6,15); chalk trim.
**Props:** E1 `M_YRD_CANOPY` · E2 `M_YRD_TABLE_CONTRACT` · E3 `M_YRD_STOOL` ×2 · E4 `M_YRD_CONTRACT_SCROLL` · E5 `M_YRD_QUILL_INK` · E6 `M_YRD_LANTERN_TABLE`.
**NPC Gundren:** home (5,17) facing south; idle taps scroll / checks purse; post-signing wanders E→G→H (stops 20 s, context barks). Voice: warm, brisk, slightly conspiratorial dwarf merchant; proud of his brothers; hides excitement badly.
**Triggers (P2):** `TR_E_TABLE` r2 @(5,15): `F`:
- creation incomplete → `VO_GUN_003`: `The ledger wants your blood, the pedestals your trade, the board your story. Then my quill gets its turn.` + beacons to missing stations.
- complete → C6 name entry (quill writes letters as typed; random-name die button = dice-theatre roller) → hold `F` 1.5 s signing (quill scratch loop) → wax stamp `A_ONE_WAX_STAMP` + `MUS_STING_SIGN` → **save slot relabelled to name** → journal opens with quest `The Rockseeker Contract`, hook verbatim:
  `You're in the city of Neverwinter when your dwarf patron and friend, Gundren Rockseeker, hires you to escort a wagon to Phandalin. Gundren has gone ahead with a warrior, Sildar Hallwinter, to attend to business in the town while you follow with the supplies. You will be paid 10 gp each by the owner of Barthen's Provisions in Phandalin when you deliver the wagon safely to that trading post.`
  then `VO_GUN_004`: `Ten gold each when the wagon lands at Barthen's in Phandalin. My brothers' find is worth a hundred wagons, but coin first, glory after — sign here.` then `VO_GUN_005`: `Right! The yard's yours till the oxen are hitched. Swing at anything straw — it deserves it.` Sandbox unlocks (bell M active; beats G–L open).
**Camera:** signing = 2× push to two-shot over table, 3 s hold through stamp.
**Audio:** `A_ONE_QUILL_SCRATCH_LONG`, `A_ONE_WAX_STAMP`, `MUS_STING_SIGN`, `A_LOOP_CANOPY_FLAP`.
**VFX:** `VFX_WAX_GLOW` brief.
**Fail-forward:** signing repeatable pre-departure for name edits (slot relabelled).

### 4.F — AREA F: MOVEMENT LANE (T1) [P1 interactive]

**Purpose:** T1 movement prompts + difficult-terrain primer.
**Geometry:** packed dirt `tx −2..2`, `ty 2..8`, chalk edge decals; briar planter 2×1 m at (0,7) = `cost 2` cells (thicket sprite, `M_YRD_THICKET_POCKET` small variant).
**Triggers:** `TR_F_ENTER` box `tx −2..2`, `ty 2..4` → prompt chain (each completes on input performed): 1 move (WASD/arrows) · 2 sprint 3 tiles (Shift) · 3 pan camera 90° edge-drift or hold-to-center · 4 `V` zoom in/out · 5 grid overlay toggle `G`. Each: `UI_F_P1..P5` + soft blip. Chain complete → `VO_GUN_006`: `Walk it like ye mean it. The camera's yer second pair o' eyes — swing it, lift it, look high.` Planter cross (optional) → `UI_F_BRIARS`: `Briars: difficult terrain — double movement to cross. Note it now, thank yourself in the caves.` (R7 verbatim values).
**Audio:** footfalls `A_ONE_FOOT_LIGHT/MEDIUM/HEAVY` by armor class; `A_ONE_BRIAR_SNAG`.
**Fail-forward:** chain skippable — `F` at beacon jumps to next active station.
**P1:** identical (this is one of the three interactive beats).

### 4.G — AREA G: DUMMY LINE (T3 basic attack · T4 bonus action & masteries) [P1 interactive]

**Purpose:** attack loop, action economy, crits, bonus action, all eight masteries on safe targets.
**Props:** G1 `M_YRD_DUMMY_SWORD` (−8,13) — straw torso on post, **3-tile slide rail** south for Push demos, AC plate `10` · G2 `M_YRD_DUMMY_MASTERY` (−8,16) — weighted sack on gimbal (tips Prone) · G3 `M_YRD_CART_TIPS` (−7,14) tip-cart · G4 `M_YRD_WEAPON_SHELF` (−9,14): greatclub (Push), train sword (Sap/Slow cards), dagger pair (Nick), train scimitar (Nick), graze club · G5 `M_YRD_HAY_BALE` ×2 (−8,17) side-by-side (Cleave pair).
**Triggers & logic:**
- `TR_G_A` r2 @(−8,12): first interact **[P2: equip class melee kit · P1: equip default Fighter kit]**; combat UI unlocks (action bar, reticle). Dummy A: **AC 10, HP ∞ (yield gauge 6 hits)**, no turns, no AI. Attack = Action (R6): dice theatre d20+mod+PB vs 10 (R1,R3,R14); damage die per weapon; crit = double dice + `A_ONE_CRIT_BELL` + `VO_GUN_015`. After 6 hits dummy "yields" (wink anim, gauge resets in 6 s — R15). T3 line `VO_GUN_007`: `Give it a whack! Full swing, don't tickle it… THERE! See the die? That's the truth of every blow ye'll ever land.`
- `TR_G_B` r2 @(−8,15): mastery gallery: pick shelf weapon → scripted hit on Dummy B → property demo + **verbatim R12 card**: Push → dummy slides 3 tiles down rail (`A_ONE_DUMMY_RAIL_SLIDE`) · Topple → gimbal tips Prone (`A_ONE_DUMMY_TIP_CLATTER`) + Prone card (R7) · Sap → debuff icon + card · Vex → next roll shows Advantage pips + card · Slow → card + slowed swing anim · Nick → off-hand dagger extra cut inside same Action + card · Graze → deliberate-miss demo deals mod damage + card · Cleave → single swing hits both bales + card. Bonus-action teach: off-hand dagger attack labelled **Bonus Action** (R6). T4 line `VO_GUN_008`: `Again — and follow through! A second cut for the bold. Now watch: a shield-bearer's push, a leg-sweep… weapons have manners, learn theirs.`
**Rules payload inline:** R1, R2, R3, R6, R7, R12 (all eight), R14, R15.
**Strings:** `UI_G_YIELD` `The dummy leans your way. Even straw respects persistence.` · `UI_G_PICK` `Take up the {0} — feel its manners.`
**Camera:** first attack = 2× punch-in 1.5 s; dice close-ups per R14.
**Audio:** `A_ONE_SWING_WHOOSH_1/2/3`, `A_ONE_DUMMY_THOCK_L`, `A_ONE_DUMMY_THOCK_H`, `A_ONE_DUMMY_RAIL_SLIDE`, `A_ONE_DUMMY_TIP_CLATTER`, `A_ONE_CRIT_BELL`, `A_ONE_MISS_WHIFF`.
**VFX:** `VFX_STRAW_PUFF` impacts; `VFX_MASTERY_GLYPH_{property}` procs.
**Fail-forward:** after 2 consecutive misses dummy AC drops to 8 once (`UI_G_YIELD`); 3 misses → `VO_GUN_016` `Swing's honest, aim's optimistic. Breathe, then swing.`
**P1:** identical — this is the combat-teaching core of the first playable.

### 4.H — AREA H: ARCHERY LANE & LOFT (T6 ranged · cover · height)

**Purpose:** ranged attacks, range bands, cover values, R11 height, Vex. **P1: fully dressed (butts, bale stacks, loft silhouette with `elev 2` cells walkable-but-no-bow); P2 interactive.**
**Geometry:** lane along west wall: firing line `ty 17` → butts `ty 27` (10 tiles ≈ 15 m — within normal range for every yard weapon); loft deck `tx −13`, `ty 18..20`, **`elev = 2`** (10 ft rule threshold), stairs from east side (`cost 2` climb cells).
**Props:** H1 `M_YRD_TARGET_BUTT` ×3 at (−12,27)/(−11,27)/(−13,27) · H2 `M_YRD_HAY_BALE` half-cover stack (−12,22) 1 tile high (`cover 2`) · H3 three-quarters stack (−10,25) (`cover 5`) · H4 `M_YRD_LOFT_PLATFORM` (−13,19) · H5 `M_YRD_LOFT_STAIRS` (−12,18) · H6 `M_YRD_QUIVER_STAND` (−12,17) infinite arrows · H7 bales ×2 seating (−13,22)/(−13,24).
**Triggers (P2):** `TR_H_LINE` r2 @(−12,17): equips shortbow (range 80/320 card; lane uses 10 tiles — normal range). Sequence: (1) open shot at centre butt — Roll Moment, Vex proc card on hit · (2) centre butt behind H2: reticle 1 cover pip, tooltip `AC +2 (half cover)` + R3 card · (3) left butt behind H3: 2 pips `AC +5 (three-quarters cover)` · (4) climb loft (`TR_H_LOFT` at deck): shoot down → Advantage pips + R11 card + `VO_GUN_009`: `Bales stop arrows, walls stop fools. Shoot over, shoot around — or climb the loft and shoot down. High ground's a gift, take it.`
**Rules payload inline:** R2, R3 (half +2 / three-quarters +5 / total untargetable), R11, range rule (long range = Disadvantage), R12 Vex verbatim.
**Strings:** `UI_H_COVER2` `Half cover: +2 AC and +2 to Dexterity saves.` · `UI_H_COVER5` `Three-quarters cover: +5 AC and +5 to Dexterity saves.` · `UI_H_HIGH` `10 ft above your target: Advantage on the shot.`
**Audio:** `A_ONE_BOW_DRAW`, `A_ONE_BOW_RELEASE`, `A_ONE_ARROW_THUD`, `A_ONE_ARROW_BALE_THUD`, `A_ONE_ARROW_RICOCHET`, `A_ONE_LOFT_STAIR_CREAK`.
**VFX:** `VFX_ARROW_TRACE` (1-px line, 3 frames); straw-burst impacts.
**Fail-forward:** infinite arrows; no timers; bales indestructible.

### 4.I — AREA I: BRUSH LANE (T7 hide · surprise · Advantage)

**Purpose:** hiding vs passive Perception, surprise round, Advantage from hidden. **P1: dressed thickets (walkable, `cost 2`, `cover 5`, `los_block` false — brush gives cover not sight-block per GDD-01 §2.7; hide pockets = cells tagged `interact=hide`); Pip patrol not spawned. P2 interactive.**
**Geometry:** east strip `tx 9..12`, `ty 8..14`; four thicket pockets 2×2 at (9,8)/(12,10)/(9,13)/(12,14) — difficult terrain + cover volumes + hide cells; log seat (9,11); leaf decals.
**NPC (P2):** Trainee Pip patrol loop (10,8)→(10,10)→(10,12)→(10,14)→reverse, 1.2 m/s ≈ 0.8 tiles/s, **passive Perception 12** (shown on his card once observed).
**Triggers (P2):** `TR_I_LANE` box on entry → R5 teach card + prompt: break LOS into a pocket → `H` Hide → Stealth Roll Moment vs 12. Success → `VFX_HIDE_SHROUD` + hidden icon; Pip passes within 2 tiles (`A_ONE_HEARTBEAT_HIDE`). While hidden near Pip → `UI_I_AMBUSH`: `Strike from hiding: Advantage + surprised foe.` Choose ambush → **SPAR-LITE** (one-round micro-fight, R9/R15 yield): Pip surprised (skips turn 1, R5), player attacks with Advantage (R2). Stay hidden → `VO_TRN_003` `Huh. Swore somethin' moved…` + `VO_GUN_017`. Fail Stealth → Pip spots, no surprise, SPAR-LITE starts even. T7 line `VO_GUN_010`: `Quiet now. If the lad never sees ye, yer first blow lands twice as true. That's not cheating, that's craft.`
**Pip spar stats:** AC 13 · HP 6 (yield) · Speed 30 ft (6 cells) · blunt sword +3 · 1d4+1 bludgeoning · passive Per 10 post-surprise.
**Rules payload inline:** R5 full, R2, R6, R9, R13.
**Audio:** `A_ONE_BRUSH_RUSTLE_1/2`, `A_LOOP_BRUSH_BIRDS_NEAR`, `A_ONE_HEARTBEAT_HIDE`; spar reuses J clash set.
**VFX:** `VFX_HIDE_SHROUD`, `VFX_SURPRISE_MARK` (`!` over Pip).
**Fail-forward:** unlimited retries (Pip resets loop after 10 s); first success → `VO_GUN_017` `Never saw ye. Neither will they, if ye keep that up.` After 3 fails Pip's passive drops to 10 (GDD-01 beat-sheet mercy).

### 4.J — AREA J: SPARRING CIRCLE (T8 full Table-Mode loop) [P1 interactive]

**Purpose:** the complete loop in miniature: initiative, turns, split movement, End Turn, reactions/OA, non-lethal yield.
**Geometry:** sand circle 5-tile radius decal centred (8,7) (`T_YRD_SAND_CIRCLE` pixel family — sand patch autotile); surrounding dirt; benches ×3 at (6,5)/(10,6)/(8,9).
**Props:** J1 `M_YRD_WEAPON_RACK_SMALL` (10,5) blunts · J2 `M_YRD_BENCH` ×3 · J3 `M_YRD_WATER_KEG` (11,7).
**NPCs:** Sergeant Brant home (8,4); Trainee **Marra** home (10,8); Pip joins from I when T8 fires (P1: Pip absent — **Marra alone** per GDD-06 §6.8 one-partner design); Corwin referees from the circle edge (walks over from A post).
**Reconciled combatants (this doc is content owner):**

| Combatant | AC | HP | Speed | Attacks | Masteries | Notes |
|---|---|---|---|---|---|---|
| Player | class | class | 30 ft (6 cells) | class kit | Push+Topple live (P1) | cannot die (R15) |
| **Marra** (sparring partner) | **12** | **14** | 30 ft | longsword +3 (1d8+1), shield | **Push** | yields at 1 HP; GDD-06 §6.8 numbers |
| Pip (P2 when present) | 13 | 6 | 30 ft | blunt +3 (1d4+1) | — | spar-lite stats §4.I |

**Trigger sequence (steps taught in order, each = card + prompt; P1 starts at step 1 with Marra only):**
1. `TR_J_CIRCLE` r3 after T7 armed (P1: armed after T4) → Brant `VO_SGT_003`: `Circle's hot. Blunts, full turns, mind the queue — fight.` + Gundren `VO_GUN_011`: `Blades down, fists up! First to yield wins my respect — and I yield to nobody. Mind yer turn, mind theirs, mind the moment between!` Combat starts: all combatants roll initiative in dice theatre (d20+DEX; tie → higher DEX, then player-side — R6/initiative card). Queue strip appears.
2. **Your turn:** move split around attack (budget pips show feet remaining); End Turn `Space` prompt `UI_J_ENDTURN` `Nothing left? Press Space to end your turn.`
3. **Round 2 (P2: scripted Marra move):** Marra moves away **without Disengaging** → reaction card `UI_J_REACT` `OPPORTUNITY ATTACK — {0} leaves your reach. React?` (R8 verbatim card); take-or-pass both taught. *(P1 with single partner: script fires on her round-2 reposition; if player used Reaction already, card auto-passes with toast.)*
4. **Round 3:** Marra Dashes across reach → second OA prompt (reinforce). *(GDD-03 used Pip Dash — folded onto Marra for the one-partner design.)*
5. **Non-lethal enforced:** all yard damage = bludgeoning-yield; card R9: `Sparring blunts: knock-outs only — this is how you'll take prisoners on the road.`
6. Yield at 1 HP → Unconscious 3 s (R13) → wake wave → victory → `VO_SGT_004`: `Clean turns. Ugly feet. The road'll fix the feet.` + `MUS_STING_SPAR_WIN` + result card `Good spar.` (both win and loss end on the same friendly card — GDD-06 §6.8).
**Rules payload inline:** R6 full, R8 verbatim (`When a creature you can see leaves your reach without Disengaging, you may use your Reaction to make one melee attack against it.`), R9, R13, initiative tie rule, R14, R15.
**Camera:** auto two-shot framing (active actor + target centred, 1×); enemy turns obey `enemy_turn_pace`.
**Audio:** `A_ONE_SPAR_CLASH_1..6`, `A_ONE_SPAR_YIELD_WHISTLE`, `A_LOOP_CROWD_YARD_SMALL`, `A_ONE_SAND_SCUFF`, `MUS_STING_SPAR_WIN`.
**VFX:** dust rings on impacts; `VFX_TURN_BANNER` sweep; queue-strip portraits 24 px.
**Fail-forward:** trainees yield at 1 HP; player clamped at 1 HP; loss impossible, only slow.
**Acceptance:** this encounter is the acceptance test of the whole combat system (GDD-06 §6.8): initiative + ≥3 rounds + OA + Push + Topple + yield must all fire in one playthrough.

### 4.K — AREA K: REST NOOK (T9 short rest · Hit Dice)

**P1: dressed (bench/brazier sprites, placard). P2 interactive.**
**Props:** K1 `M_YRD_BENCH` (7,21) · K2 `M_YRD_BRAZIER` lit (8,21) · K3 `M_YRD_TABLE_SMALL` bread+water (7,22) · K4 `M_YRD_LOG_PILE` (8,22).
**Triggers (P2):** `TR_K_BENCH` r2: `F` → sit anim 1.2 s → rest UI: **Short rest** button — spend Hit Dice (class die + CON mod per die, dice theatre heals, R10 verbatim card); **Long rest** explain-only card: `A long rest needs safety and eight hours. The yard qualifies. The goblin trail will not.`; bread eat once = +1 HP flavour (`A_ONE_BREAD_TEAR`). T9 line `VO_GUN_012`: `Even heroes sit down. A breath, a bandage, a bit o' luck rolled back into yer veins — then up again.`
**Rules payload inline:** R10 full (short 1 h / Hit Dice; long 8 h safe place, full restore, half Hit Dice back).
**Audio:** `A_LOOP_BRAZIER_CRACKLE`, `A_ONE_BENCH_SIT`, `A_ONE_BREAD_TEAR`, `A_LOOP_NOOK_BIRDS`.
**VFX:** `VFX_EMBER_BRAZIER` 3-frame flicker.
**Fail-forward:** rest repeatable; HP clamped ≤ max (R15 free instant rests).

### 4.L — AREA L: PACK, FOLIO & CODEX LECTERN (T10 kit · codex · options)

**P1: crates/lectern dressed; lectern `F` opens the shell **Codex** screen directly (menu-grade shortcut). P2 full inventory panel.**
**Props:** L1 `M_YRD_CRATE_PACK` ×2 (4,14)/(5,15) · L2 `M_YRD_FOLIO_STAND` (4,15) · L3 `M_YRD_LECTERN_CODEX` (5,15) open tome.
**Triggers:** `TR_L_CRATE` r2: inventory UI — starting kit per class (verbatim-short list from class card); equip/swap; encumbrance not tracked in Ch1 (stated on card). `TR_L_LECTERN` r1: codex UI (§5.7 — Rules preloaded, R11 tagged `HOUSE RULE`) + options shortcut panel with live toggles: rules-grid overlay demo, hit-chance display, enemy-turn pace. T10 line `VO_GUN_013`: `Yer kit, yer contract, yer head. Keep all three in order and ye'll keep yer life.`
**Audio:** `A_ONE_CRATE_LID`, `A_ONE_PACK_STRAP`, `A_ONE_TOME_PAGE`, `SFX_UI_PAGE`.
**Fail-forward:** all panels re-openable anytime via `Tab`/`C`/`Esc`.

### 4.M — AREA M: PRACTICE BELL (sandbox reset) [P1 interactive]

**Purpose:** replay/reset any practice beat — the first playable's loop closer.
**Props:** M1 `M_YRD_BELL_POST` (0,14) bronze bell sprite (16×32).
**Trigger:** `TR_M_BELL` r1: `F`/`M` → `A_ONE_BELL_PRACTICE` + `VFX_DUST_SHAKE` + string `UI_M_BELL`: `The practice bell: ring it and the yard forgets your mistakes.` → resets dummies/targets/thicket states, respawns trainees to homes, re-arms last completed/failed beat per `tutorial.json`, plays any completed beat again on demand (P1: T1/T3/T4/T8 replay menu card lists completed beats).
**Fail-forward:** bell never blocks; P2 departure still independent.

---

## 7. MANIFESTS (counts + naming — machine copies live in data files)

### 7.1 Tileset families (5) & decals

| Family ID | Source tiles authored | Used for |
|---|---|---|
| `T_YRD_COBBLE` | centre + edges + corners → 47-blob | forecourt, gate apron |
| `T_YRD_DIRT` | 47-blob | yard floor, lanes |
| `T_YRD_VERGE` | 47-blob | grass borders, brush underfoot |
| `T_YRD_PLANK` | strip tiles | dock sliver at gate, loft deck face |
| `T_YRD_WALL` | 16×32 face + cap (+START/END/inner-corner per manifest wall names) | perimeter, gatehouse, tack room |
| Decals (overlay layer) | `T_YRD_SAND_CIRCLE` · `T_YRD_DECAL_CHALK` · `T_YRD_DECAL_MUD` ×4 · leaf patches | J ring, F edges, puddles, I pockets |

Wall module names stay manifest-compatible: `M_YRD_WALL_STONE`, `_START`, `_HALF`, `_END`, `_CORNER` (footprints 4/2/1 tile equivalents at 16-px scale → 64/32/16 px wide).

### 7.2 Prop sprite kit (names never change vs manifest v2 / GDD-03 §5)

Yard props, each generated isolated → cleaned → foot-anchored, footprint = ceil-to-tiles of legacy 3D bounds @1.524 m/tile, §5.6 explicit values win (barrel 16×16, gatehouse 64×48):

`M_YRD_WALL_STONE{,_START,_HALF,_END}` · `M_YRD_GATEHOUSE` · `M_YRD_PORTCULLIS` · `M_YRD_GATE_DOOR{,_R}` · `M_YRD_GUARD_BOX` · `M_YRD_NOTICE_BOARD` · `M_YRD_BARREL` · `M_YRD_LANTERN_POST` · `M_YRD_CRATE_STACK` · `M_YRD_ROPE_CORDON` · `M_YRD_DESK_MUSTER` · `M_YRD_LEDGER_BOOK` · `M_YRD_STOOL` · `M_YRD_BOARD_CONTRACT` · `M_YRD_PAPER_SHEET` · `M_YRD_ABACUS` · `M_YRD_DICE_CUP` · `M_YRD_INK_WELL` · `M_YRD_PEDESTAL_CLASS` · `M_YRD_PRAYER_STONE` · `M_YRD_LECTERN_SPELL` · `M_YRD_SHADOW_POST` · `M_YRD_ARMS_RACK` · `M_YRD_WHETSTONE_POST` · `M_YRD_TACK_ROOM{shell tiles}` · `M_YRD_MIRROR_SHIELD` · `M_YRD_RUG` · `M_YRD_LANTERN_HOOK` · `M_YRD_CANOPY` · `M_YRD_TABLE_CONTRACT` · `M_YRD_CONTRACT_SCROLL` · `M_YRD_QUILL_INK` · `M_YRD_LANTERN_TABLE` · `M_YRD_DUMMY_SWORD` · `M_YRD_DUMMY_MASTERY` · `M_YRD_CART_TIPS` · `M_YRD_WEAPON_SHELF` · `M_YRD_HAY_BALE` · `M_YRD_TARGET_BUTT` · `M_YRD_QUIVER_STAND` · `M_YRD_LOFT_PLATFORM` · `M_YRD_LOFT_STAIRS` · `M_YRD_THICKET_POCKET` · `M_YRD_LOG_SEAT` · `M_YRD_WEAPON_RACK_SMALL` · `M_YRD_BENCH` · `M_YRD_WATER_KEG` · `M_YRD_BRAZIER` · `M_YRD_TABLE_SMALL` · `M_YRD_LOG_PILE` · `M_YRD_CRATE_PACK` · `M_YRD_FOLIO_STAND` · `M_YRD_LECTERN_CODEX` · `M_YRD_BELL_POST` · `M_YRD_WAGON` (P2) · `M_YRD_OX` (P2) · `PROP_*` manifest additions (fence segments, target-butt trim, chalk arrows) per manifest v2.

Counts in the §3.3 manifest of GDD-06 remain authoritative for budgeting (**22 props, 30 placements**); this list is the build checklist for the *entire* yard (P2 adds the creation/dressing stations to the P1 set: P1 core = gate kit, dummy line, sparring, bell, lane furniture ≈ 22; P2 = full table above).

### 7.3 Character rigs (6) & animation states

| Rig | P1 | States | Notes |
|---|---|---|---|
| Player | yes | idle(2) · walk N/S/E/W(4 each; N/S mirrored from one drawing, E/W from one) · attack(3+FX) · hurt(1) · down(1) · interact(2) | 16×32 frame, 16×24 body, feet-origin; 8 species = palette/tint variants at P2 (P1: single default body) |
| Corwin (guard) | yes | idle(2, lean/scan) · walk(4) · interact(2) | "Corvin" in GDD-03 = same NPC |
| Gate guard ×2 | painted on lane card (P1); P2: guard rig reuse of Corwin | — | |
| Gundren (dwarf) | P1: no rig required (bark source off-screen at T0; dressed empty-chair tease at E). **P2: full rig** | idle · walk · interact | 1.32 m ≈ 14 px tall |
| Clerk Odile Vess | P1 painted/dressed only · P2 rig | idle shuffle/stamp | |
| Sergeant Brant | P1 dressed at J edge · P2 rig | idle oil-blade | |
| Trainees (Marra, Pip) | **Marra P1** (combatant) · Pip P2 | idle · walk · attack · hurt · down · yield | |
| Dummies ×2 + target butts | yes | idle(2) · yield(2) · rail-slide (A) · tip (B) | static frames + 2-frame resets |
| Sparring partner = Marra | yes | as trainee | stats §4.J |

Cutout rigs (not sprite sheets) per GDD-06 §5.5: 6–9 flat parts per human, animated by integer-rounded transform tracks driven in JavaScript — frames consistent by construction. Speeds: walk 3 tiles/s, sprint 5 tiles/s, accel 12 tiles/s². A baked atlas is available where the parts never change (dummy line).

### 7.4 UI nine-patches, FX, backdrops

- **Panels (3 styles, 48×48 sources, margins in `ui_kit.json`):** parchment (8 px corners — contract, ledger, tips, rule cards) · oak/bronze (6 — options, class cards) · ink (4 — legal, pause, error). Buttons ×4 states (normal/hover/pressed/disabled), tabs ×2, wax seal, delve emblem, scrollbar thumb/track, pills, portrait frame 24 px, tooltip box.
- **FX sprites (8+):** hit spark(3) · crit flash(2) · dust puff · beacon wisp(4) · mist band(2) · rain(2, reserved) · torch flicker(3) · dice tumble(6)+4 results · straw puff · mastery glyphs ×8 · hide shroud(2) · surprise mark · turn banner sweep · arrow trace(3) · paper fly · wax glow · ember brazier · beacon chevron · grid overlay cell tints (mint/blood/bronze/violet — GDD-06 §6.11).
- **Backdrops (2):** menu yard-dawn 3-layer set · R2 city vista card (over-wall + lane end).

**Palette lint:** every PNG under `assets/pixel/` within the 40-colour lock; total `assets/pixel/` ≤ 1.5 MB; no file > 256 KB (GDD-06 §5.7).

---

## 8. AUDIO PLAN (zone + shell)

**Beds/loops:** `AMB_YRD_DAWN` (whole-zone: sparse gulls, harbour bell ~90 s, rope creak, distant blades) · `AMB_DOCK_LANE` (behind gate card) · `AMB_YRD_DAWN_MENU` (menu variant) · `A_LOOP_FLAG_SNAP` · `A_LOOP_BRAZIER_CRACKLE` · `A_LOOP_CANOPY_FLAP` · `A_LOOP_TACK_LEATHER_CREAK` · `A_LOOP_BRUSH_BIRDS_NEAR` · `A_LOOP_NOOK_BIRDS` · `A_LOOP_CROWD_YARD_SMALL` · `MUS_MENU_THEME` (+`_VAR`) · `MUS_YARD_DAWN` (90 s explore loop, new) · `MUS_COMBAT_TRAINING` (60 s loop, new) · `MUS_STING_SIGN` · `MUS_STING_SPAR_WIN` · `MUS_BOOT_STING`.
**One-shots:** `A_ONE_GULL_CRY` · `A_ONE_CITY_BELL` · `A_ONE_GATE_CREAK` · `A_ONE_PAGE_TURN` · `A_ONE_QUILL` · `A_ONE_QUILL_SCRATCH_LONG` · `A_ONE_STAMP_THUNK` · `A_ONE_WAX_STAMP` · `A_ONE_DICE_CUP_SHAKE` · `A_ONE_DICE_ROLL_TABLE` · `A_ONE_PAPER_UNPIN` · `A_ONE_PEDESTAL_TURN` · `A_ONE_HOLO_SHIMME` · `A_ONE_RACK_RATTLE` · `A_ONE_SWING_WHOOSH_1/2/3` · `A_ONE_MISS_WHIFF` · `A_ONE_DUMMY_THOCK_L` · `A_ONE_DUMMY_THOCK_H` · `A_ONE_DUMMY_RAIL_SLIDE` · `A_ONE_DUMMY_TIP_CLATTER` · `A_ONE_CRIT_BELL` · `A_ONE_BOW_DRAW` · `A_ONE_BOW_RELEASE` · `A_ONE_ARROW_THUD` · `A_ONE_ARROW_BALE_THUD` · `A_ONE_ARROW_RICOCHET` · `A_ONE_LOFT_STAIR_CREAK` · `A_ONE_BRUSH_RUSTLE_1/2` · `A_ONE_HEARTBEAT_HIDE` · `A_ONE_SPAR_CLASH_1..6` · `A_ONE_SPAR_YIELD_WHISTLE` · `A_ONE_SAND_SCUFF` · `A_ONE_BENCH_SIT` · `A_ONE_BREAD_TEAR` · `A_ONE_CRATE_LID` · `A_ONE_PACK_STRAP` · `A_ONE_TOME_PAGE` · `A_ONE_BELL_PRACTICE` · `A_ONE_DOOR_CREAK_TACK` · `A_ONE_MIRROR_SHINE` · `A_ONE_FOOT_LIGHT/MEDIUM/HEAVY` · `A_ONE_BRIAR_SNAG` · `A_ONE_FIRE_WHOOSH` · `A_ONE_RADIANT_CHIME` · `A_ONE_SMOKE_POOF` · `A_ONE_WAGON_WHEEL_CREAK` (P2 T11) · `A_ONE_OX_SNORT` (P2) · UI set `SFX_UI_MOVE/CONFIRM/BACK/DENY/PAGE` · `SFX_BOOT_*` · `SFX_LOAD_STAMP` · `SFX_HIT/MISS/CRIT` (combat layer, new) · `SFX_DICE_ROLL` (new) · `AMB_YRD_DAWN` gull/harbour stems as above.
**Mix notes:** VO ducks bed −6 dB · dice-theatre SFX +3 dB over bed · heartbeat only while hidden & observer < 3 tiles · four WebAudio buses (Master/Music/SFX/Voice) with gain-node ducking in `web/js/core/sound.js`.
**Budget:** all yard+shell audio ≤ **1.2 MB** (the four keepers are ~1.2 MB today, one of them the 90 s music bed; new one-shots target ≤ 150 KB each and the one-shot family is synthesised first, replaced by generated files when approved). Ship an MP3 twin for any track that needs one for iOS playback (GDD-06 §8.1).

---

## 9. VO SCRIPT (zone YRD — every line, with trigger)

**Gundren Rockseeker** (dwarf · warm/brisk/conspiratorial · proud of his brothers):
- `VO_GUN_001` `There ye are! Mind the mud — the yard's seen worse boots than yours.` (T0/A)
- `VO_GUN_002` `Ha! Look at yerself. Eyes front, chin up — that's an adventurer's face, or close enough.` (T2/D zoom cue)
- `VO_GUN_003` `The ledger wants your blood, the pedestals your trade, the board your story. Then my quill gets its turn.` (E, creation incomplete)
- `VO_GUN_004` `Ten gold each when the wagon lands at Barthen's in Phandalin. My brothers' find is worth a hundred wagons, but coin first, glory after — sign here.` (T5/E)
- `VO_GUN_005` `Right! The yard's yours till the oxen are hitched. Swing at anything straw — it deserves it.` (post-sign)
- `VO_GUN_005b` `The pedestals aren't going to choose for ye, hero.` (C nudge, unclassed at T3)
- `VO_GUN_006` `Walk it like ye mean it. The camera's yer second pair o' eyes — swing it, lift it, look high.` (T1/F)
- `VO_GUN_007` `Give it a whack! Full swing, don't tickle it… THERE! See the die? That's the truth of every blow ye'll ever land.` (T3/G)
- `VO_GUN_008` `Again — and follow through! A second cut for the bold. Now watch: a shield-bearer's push, a leg-sweep… weapons have manners, learn theirs.` (T4/G)
- `VO_GUN_009` `Bales stop arrows, walls stop fools. Shoot over, shoot around — or climb the loft and shoot down. High ground's a gift, take it.` (T6/H)
- `VO_GUN_010` `Quiet now. If the lad never sees ye, yer first blow lands twice as true. That's not cheating, that's craft.` (T7/I)
- `VO_GUN_011` `Blades down, fists up! First to yield wins my respect — and I yield to nobody. Mind yer turn, mind theirs, mind the moment between!` (T8/J)
- `VO_GUN_012` `Even heroes sit down. A breath, a bandage, a bit o' luck rolled back into yer veins — then up again.` (T9/K)
- `VO_GUN_013` `Yer kit, yer contract, yer head. Keep all three in order and ye'll keep yer life.` (T10/L)
- `VO_GUN_014` `The city'll keep! Contract first — desk, blades, then my table. In that order, hero.` (lane loiter > 45 s)
- `VO_GUN_015` `A CRIT! The straw'll talk about that one for weeks.` (first crit)
- `VO_GUN_016` `Swing's honest, aim's optimistic. Breathe, then swing.` (3 misses at G)
- `VO_GUN_017` `Never saw ye. Neither will they, if ye keep that up.` (first hide success)
- `VO_GUN_018` `Oxen are hitched! Contract's live — to the gate, hero.` (T11 ready)

**Clerk Odile Vess** (dry, fast): `VO_CLK_001` `Name later, blood first. The ledger doesn't care what you call yourself — only what you are.` · `VO_CLK_002a..h` species comments (8 lines; example dwarf: `Solid choice. Stubborn stock, good with stone and grudges.`) · `VO_CLK_003` `Beads for the careful, cup for the brave. Either way the road collects its interest.` · `VO_CLK_004` `Filed. The South will read you exactly as that paper says.`

**Sergeant Brant** (gravel, fond): `VO_SGT_001` `Circle's for fighters, lane's for fools, desk is for both.` · `VO_SGT_002a..d` class barks (§4.C) · `VO_SGT_003` `Circle's hot. Blunts, full turns, mind the queue — fight.` · `VO_SGT_004` `Clean turns. Ugly feet. The road'll fix the feet.`

**Trainees:** `VO_TRN_001` (Pip, pre-spar) `Blunts only, yeah? BLUNTS.` · `VO_TRN_002` (Marra, post-yield) `I meant to do that.` · `VO_TRN_003` (Pip, missed hide) `Huh. Swore somethin' moved…` · `VO_TRN_004` (Pip, surprised) `Wha— hey! Not fair! …Teach me that.`

**Guard Corwin** (flat): `VO_GRD_001` `Mornin'. Contract folk through the gate, city folk wait — them's the orders, not mine.` · `VO_GRD_002` `Barred till the muster's done. Ye've a yard to be in, friend.` · `VO_GRD_003` `Orders: none leaves muster-less. Sign the dwarf's paper first.`

**Existing VO keepers in repo:** `vo_grd_001..003` (Corwin) already shipped — reuse verbatim; remaining lines are new recordings or synth scratch (placeholder = subtitled text until recorded; subtitles default On).

---

## 10. LIGHTING & DAY CLOCK (pixel translation)

- **Day clock** (`js/world/day_clock.js`): game time **06:40 → 08:20 across ~18 min real** (menu backdrop = frozen 06:10). Drives a **5-stop dawn ramp** composited full-screen over the canvas (all stops derived from the locked 32-colour surface ramp):

| Game time | Stop | Modulate (approx tint) | Notes |
|---|---|---|---|
| 06:40 | S0 deep dawn | `#B0A8C0` cool violet-grey, ×0.92 | T0 arrival; mist band full |
| 07:00 | S1 rose | `#D8B8A8` warm rose, ×0.97 | |
| 07:30 | S2 clear gold | `#FFFFFF` neutral, ×1.0 | mist off (weather rule) |
| 08:00 | S3 morning | `#FFF4E0` warm, ×1.04 | |
| 08:20 | S4 departure | `#FFE8C8` bright warm, ×1.08 | T11 departure |

- Interpolate linearly between stops; integer-friendly (modulate only — no new colours enter sprites, palette lint unaffected).
- **Practicals:** lantern/brazier sprites carry additive glow quads (bronze `#D9A463` 40% falloff, 1.5-tile radius); brazier flickers 3-frame at 8 Hz subtle; glow sprites are FX-layer, not light nodes.
- **Below-LUT** (infection) is **not used in the yard** (surface-only zone); the remap ships tested for later zones (GDD-06 §5.3/T-20): a per-pixel remap on an offscreen surface, driven by one 0–1 scalar.

---

## 11. UI ELEMENTS PRESENT IN YARD

| ID | Element | Spec |
|---|---|---|
| `UI_YRD_PROMPT` | interact chip | bottom-left parchment chip, 8 px: `F — {label}`; hold-ring for 1.5 s holds (signing) |
| `UI_YRD_BEACON_WISP` | beacon | wisp 4-f + floating chevron above next station; toggle in Options; never south of gate |
| `UI_YRD_TOAST` | tutorial toast | centre-top parchment nine-patch, 8 px, 4 s or on-advance |
| `UI_YRD_ACTIONBAR` | combat bar (post-T3) | bottom-centre (120, 244, 240, 22): `ATTACK` `BONUS` `END TURN` + budget pips (feet/A/BA/R) |
| `UI_YRD_QUEUE` | initiative strip | top (8, 4, 464, 26): 24 px portraits, HP pips, turn arrow, round counter |
| `UI_YRD_RETICLE` | targeting | cell outline + cover pips + tooltip `1d20+5 vs AC 13 (+2 cover)` + condition chevrons |
| `UI_YRD_GRIDS` | overlay tints | move mint `#74E0B4` 30% · attack blood `#8E2F26` 30% · AoE bronze `#B0793A` 30% · threat violet `#8A4FD0` 25% · hatched cost-2 cells |
| `UI_YRD_DICE` | Roll Moment | 64×64 tumble frame + math line `14 + 5 = 19 vs 15` + verdict stamp (HIT/MISS/CRIT/FUMBLE) |
| `UI_YRD_REACT` | reaction card | centre (100, 180, 280, 44): title, body, `[React] [Pass]`, 6 s bar |
| `UI_YRD_CARDS` | rule cards | parchment panel (60, 60, 360, 150): title 10 px, body 8 px, `R#` chip top-right, `GOT IT` confirm |
| `UI_YRD_RESULT` | encounter result | centre card `Training complete.` / `Good spar.` / `YIELDED` |
| `UI_YRD_PAUSE` | pause overlay | ink 80% dim (0,0,480,270): `PAUSED` · `RESUME` `OPTIONS` `RETURN TO MENU` — Esc opens; **no pointer lock exists to lose** |
| `UI_YRD_JOURNAL` / `FOLIO` / `CODEX` | J / Tab / C | reuse the shell screen classes in `web/js/screens/` |
| `UI_YRD_CLOCK` | top-left HUD | time glyph + weather word (`mist`/`clear`), 5 px |
| `UI_YRD_HP` | player chip | bottom-left above prompt: 8 px portrait + HP pips + AC number |

All text ≥ 5 px; contrast pairs lint-checked ≥ 4.5:1 (GDD-06 §6.11/T-22).

---

## 12. DATA FILES & SCHEMAS (the three new JSONs + contracts)

`web/data/` files are served as-is (they sit beside the page). All authored by hand or by `build_tile_yard.py`; loaders validate keys and fail loud in the gates (`tools/check_project.py`, `node web/tests/run.mjs`).

**`data/yard_map.json`** — geometry truth for the tile builder:
```json
{
  "id": "YRD", "tile_size_px": 16, "size": [29, 29], "origin_tile": [14, 0],
  "layers": {
    "ground":  { "tileset": "T_YRD_DIRT", "paint": [[tx, ty, tile_name], ...] },
    "objects": { "paint": [[tx, ty, tile_name], ...] }
  },
  "cells": {
    "solid":    [[tx, ty], ...],
    "cost2":    [[tx, ty], ...],
    "cover":    [[tx, ty, 2|5], ...],
    "elev":     [[tx, ty, n], ...],
    "los_block":[[tx, ty], ...],
    "encounter":[[tx, ty, "dummy_line|sparring"], ...],
    "interact": [[tx, ty, "bell|mirror|desk|..."], ...]
  },
  "props":  [{ "name": "M_YRD_BARREL", "tile": [2, 1], "flip": false }, ...],
  "actors": [{ "id": "corwin", "home": [2, 1], "facing": "S" }, ...]
}
```

**`data/encounters.json`** — combat loader (GDD-06 §6.2):
```json
{
  "dummy_line": {
    "area": "G", "teaches": ["T3", "T4"], "rules_override": "R15",
    "participants": [
      { "side": "neutral", "kind": "dummy", "name": "Training Dummy A",
        "ac": 10, "hp": -1, "yield_hits": 6, "cell": [-8, 13], "rig": "dummy_sword" },
      { "side": "neutral", "kind": "dummy", "name": "Training Dummy B",
        "ac": 10, "hp": -1, "yield_hits": 3, "cell": [-8, 16], "rig": "dummy_mastery" }
    ],
    "script": ["equip_kit", "bark:VO_GUN_007", "wait_hit", "gallery:G4",
               "bark:VO_GUN_008", "complete:T3,T4"],
    "win": "all_dummies_yielded_once", "reset_after_s": 6
  },
  "sparring": {
    "area": "J", "teaches": ["T8"], "rules_override": "R15",
    "participants": [
      { "side": "enemy", "kind": "trainee", "name": "Marra",
        "ac": 12, "hp": 14, "speed": 6, "cell": [10, 8], "rig": "trainee_f",
        "attacks": [{"name": "Longsword", "bonus": 3, "dice": "1d8+1", "reach": 1}],
        "masteries": ["Push"], "yield_at": 1, "script": ["round2:move_no_disengage", "round3:dash"] },
      { "side": "ally", "kind": "npc", "name": "Sgt. Brant", "cell": [8, 4], "noncombat": true },
      { "side": "ally", "kind": "npc", "name": "Corwin", "cell": [6, 7], "noncombat": true }
    ],
    "script": ["initiative_all", "bark:VO_SGT_003", "bark:VO_GUN_011",
               "teach:R6", "teach:R8", "teach:R9", "resolve",
               "bark:VO_SGT_004", "sting:MUS_STING_SPAR_WIN"],
    "win": "marra_yielded", "lose": "player_yielded", "result_card": "Good spar."
  }
}
```
*(P2 adds `spar_lite_pip` mirroring §4.I stats.)*

**`data/bestiary.json`** — statblocks + mastery rows: entries `training_dummy`, `marra`, (P2 `pip`) with fields above + `masteries: {push: {text: "...verbatim R12...", glyph: ...}, topple: {...}}`; codex unlocks on first meeting (GDD-06 §6.10).

**`data/tutorial.json`** — beacon/beat truth:
```json
{
  "beats": [
    { "id": "T0", "station": [0, 2],  "toast": null,            "on": "load", "skippable": false,
      "done_when": "input_on" },
    { "id": "T1", "station": [0, 5],  "toast": "UI_F_P1",       "on": "chain_F",
      "done_when": "prompts_1_5_performed", "skippable": true, "bark": "VO_GUN_006" },
    { "id": "T3", "station": [-8, 12], "toast": "UI_G_PICK",    "on": "interact:G_A",
      "done_when": "land_one_hit",  "skippable": true, "bark": "VO_GUN_007" },
    { "id": "T4", "station": [-8, 15], "toast": "UI_G_PICK",    "on": "interact:G_B",
      "done_when": "use_bonus_action", "skippable": true, "bark": "VO_GUN_008" },
    { "id": "T8", "station": [8, 7],   "toast": "UI_J_ENDTURN", "on": "proximity:J",
      "done_when": "finish_spar",   "skippable": false, "bark": "VO_GUN_011" },
    { "id": "M",  "station": [0, 14],  "toast": "UI_M_BELL",    "on": "interact:bell",
      "done_when": "reset_pressed", "skippable": false }
  ],
  "p2_active": ["T2", "T5", "T6", "T7", "T9", "T10", "T11"],
  "beacon_rule": "next_unfinished_active_beat; never ty<=0 target",
  "bell_replays": "all_done_ids"
}
```
Completion ids persist in the save document v2 `tutorial.completed_beats` (GDD-06 §4.7); seen toasts in `seen_toasts`.

**Existing files (KEEP, now under `web/data/`):** `shell_content.json` (codex tips/rules text — Rules entries re-sourced per §5.7/T-47) · `options_schema.json` (§5.6 rows) · the save document `localStorage['delve_v2']` (8-slot ledger + tutorial/codex/combat_stats + `schema: 2`; written through `web/js/core/save.js`, which reports a refused write instead of losing the session).

---

## 13. BUILD ORDER, GREYBOX & QA

**Build order (content track; tech milestones stay in GDD-06 §12):**
1. P0 screens greyboxed at 480×270 with string parity vs §5.11 — no art, bitmap font only.
2. Menu art: palette + nine-patch kit + backdrop layers + emblem/wordmark (unblocks M2/M3).
3. Yard greybox: `build_tile_yard.py` paints `yard_map.json` layers; every `TR_` volume present & named; placeholder props at manifest footprints; per-tile fields populated (encounter/interact/cost/cover/elev).
4. Trigger skeleton A–M with stub cards; R15 sandbox verified on dummy math (a Python simulation of the §4.G numbers in `tools/`, mirrored by `node web/tests/run.mjs`).
5. P1 beats: F chain → G gallery → J sparring → M bell loop; beacons wired to `tutorial.json`.
6. Combat wiring: queue UI, budgets, Roll Moment, pathing/line-of-sight on the map JSON, golden event stream.
7. P2 stations: B/C/D/E (creation + signing) → H/I/K (ranged/hide/rest) → T11 departure stub.
8. VO record & mix; audio pass (encode, wire the buses); day-clock ramp; mist/weather pass.
9. Screenshot walk + device pass; art lint green; size budgets.

**Build, gates & deploy:** the site is published from `web/` — `vercel.json` sets `outputDirectory`, so a push to `main` is production and every other branch gets a preview URL. Nothing is served that has not passed: `python3 tools/check_project.py` (paths, module graph, data, fonts, palette mirror, nine-patch kit, layout fits, art lint) · `python3 tools/check_strings.py` (this document's strings, byte for byte) · `node web/tests/run.mjs` (unit) · `node web/tests/smoke.mjs` (boots every page headless). All four run on every push in `.github/workflows/gates.yml`.

**Greybox checklist:** every TR present & named · every prop placeholder at manifest footprint · rules layers aligned origin (0,0) = gate threshold · cover volumes authored (bales H2/H3, thickets) · hide volumes = thicket pockets · loft deck exactly `elev 2` (R11 threshold) · sand circle cells `cost 1` · wall ring solid+los_block with gate gap open.

**QA suite (menu + yard):**

1. **String parity:** every `STR_*`/`UI_*` in §5.11 + area strings matches shipped text byte-for-byte — enforced, not eyeballed: `python3 tools/check_strings.py` parses this document and compares it with `web/data/strings.json`.
2. Dummy attack math vs R1/R3 across mods 1–5 & Advantage; crit doubles dice; yield gauge resets 6 s.
3. Cover pips +2/+5 at H match reticle truth; loft Advantage identical at 1× and 2× zoom (screenshot diff).
4. Hide vs passive 12 both outcomes; surprise skips turn 1 in spar-lite; passive drops after 3 fails.
5. Opportunity-attack trigger on leave-reach; suppressed by Disengage; reaction refresh only at actor's own turn start (R6/R8).
6. Rest math vs R10; HP clamps ≤ max.
7. Each of the 8 mastery demos fires its glyph + verbatim card (R12).
8. Signing gates departure (P2 `TR_A_DEPART` unsigned → `VO_GRD_003`); P1 departure stub string only.
9. Veteran skip: PLAY → sign → T1 → T3 → T4 → T8 → bell completes < 12 min (P1); full guided P2 route 18–22 min.
10. Softlock sweep: pause/quit/resume at every area; `RETURN TO MENU` from every state; ledger delete-confirm; corrupt-save card.
11. Boundary sweep: no exit through walls; gate gap blocked per state; lane card never entered; beacons never target `ty ≤ 0`.
12. Palette/art lint: colours ⊆ 40; dimensions multiples of 16 (chars 16×32); `assets/pixel/` ≤ 1.5 MB.
13. Contrast lint: all overlay tint pairs ≥ 4.5:1.
14. Perf: ≤ 32 batched blits worst combat; 60 fps; menu path ≤ 1 MB; whole transfer ≤ 15 MB (GDD-06 §4.10).
15. VO matrix: every line in §9 fires exactly once per intended trigger; VO ducks bed −6 dB; subtitles default on.
16. Golden combat: fixed-seed `sparring` 4-round event stream diffs clean (GDD-06 §11.2).
17. Save v2: round-trip + a corrupt-document fixture; `tutorial.completed_beats` persists across a reload **and** across a redeploy (the storage key is versioned, not the URL).
18. Keyboard-only completion of every P0 screen at `ui_scale` 1 and 2; Esc never traps focus.

---

## 14. RIGHTS, LICENSING & ATTRIBUTION (what this build must carry)

1. **Fan-work disclaimer** (§5.1) verbatim on legal screen, menu corner, credits (D5, GDD-06 §15.1).
2. **SRD 5.2.1 attribution block** on legal screen + credits, regardless of fan-name choice:

> This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode

3. **All R1–R13/R15 rule text** shipped from SRD wording only (this document already compliant); background hook letters are project-written adventure text under the fan-work posture.
4. **Fonts:** the 5×7 system face (MIT) and Silkscreen (OFL-1.1), notice files committed beside the atlases in `web/assets/fonts/LICENCES`.
5. **Generated art:** provenance retained in `web/assets/pixel/art_manifest.json` (family, builder, source, hash); no third-party copyrighted reference is used as a prompt input.
6. **No third-party 3D assets ship.** Nothing in the site links to, loads or derives from one.

---

## 15. CHANGELOG

- **v1.1 (2026-09-23):** republished for the **static web build** (GitHub → Vercel). Every rect, string, timing, cue, rule text and QA item above is unchanged: only the realisation moved — ES modules instead of the earlier build's scripts, `web/data/*.json` instead of imported resources, `localStorage` for the save document, WebAudio for the buses, `data/`/`assets/` relative URLs for asset paths, and the gates (`tools/check_project.py`, `tools/check_strings.py`, `node web/tests/run.mjs`, `node web/tests/smoke.mjs`, `node web/tests/shoot.mjs`) in place of the old test runner. §5.6 options are schema-driven; §13 QA items 1, 13, 14 and 17 are now gate-enforced rather than manual, and QA item 1 is checked mechanically by re-parsing this document.
- **v1.0 (2026-09-23):** initial issue. Pixelates GDD-02 (§5, complete menu at 480×270 with exact rects + string master + 16 tips) and GDD-03 (§6, all areas A–M in tile coordinates with full triggers/rules/VO/audio/VFX/QA); adds ship rings P0/P1/P2 reconciling GDD-06 §3.1's first-playable slice with the complete-prologue target; rules primer R1–R15 SRD-sourced with pixel presentation notes; R11 locked at 10 ft / Δ≥2 (refines GDD-06 §6.5); sparring stats reconciled to one partner (Marra AC 12 / HP 14 / Push) while keeping GDD-03's six-step teaching sequence; data schemas for `yard_map.json`, `encounters.json`, `bestiary.json`, `tutorial.json`.

---

*End of GDD-07 v1.1 — menu + zone YRD fully specified for the static web build.*
