# DELVE — GDD-02 SHELL SPECIFICATION
## Logo · Boot Sequence · Main Menu · Options · Codex · Credits · Loading Screen

**Version:** 1.0 (2026-09-19) · **Standalone:** this document fully specifies the game's shell. No other document is required to build it.
**Companion docs:** `01_CHAPTER1_TUTORIAL_AND_TACTICAL_COMBAT.md` (GDD-01, gameplay), `03_NEVERWINTER_YARD_LEVEL_SPEC.md` (GDD-03, the yard the menu looks at).
**Project status:** non-commercial fan work; WotC attribution string ships on every screen per §2.1.

---

## 1. BRAND & LOGO

### 1.1 Name & lockups

- **Game title: DELVE** — one word, all caps in the wordmark, title-case ("Delve") in prose/sentences.
- **Primary lockup (boot/splash):** DELVE wordmark centered; beneath it the emblem (§1.3); beneath that the sublock line, two lines, letterspaced small caps:
  `A DUNGEONS & DRAGONS ADVENTURE`
  `PHANDELVER AND BELOW · THE SHATTERED OBELISK`
- **Menu lockup:** wordmark + emblem only (no sublock), top-left anchored (§2.3).
- **Save-stamp lockup:** emblem only, wax-seal treatment (§3.2).
- **Fan-work disclaimer line** (small, under sublock on splash; bottom-left on menu; bottom of credits):
  `An unofficial, non-commercial fan project. Dungeons & Dragons, Phandelver and Below: The Shattered Obelisk and all Wizards of the Coast characters and locations are trademarks of Wizards of the Coast LLC. Used here without permission; no challenge to any trademark or copyright. This game will never be sold.`

### 1.2 Typography & palette

| Token | Spec | Use |
|---|---|---|
| `FONT_DISPLAY` | Chiselled high-contrast display serif, cut-stone bevels (style ref: Trajan Pro / Cinzel family); embedded OFL fallback **Cinzel** | wordmark, chapter cards, menu item headers |
| `FONT_UI` | Humanist serif for body, excellent at 14–18 px (embedded OFL **Alegreya**); sans fallback only for controller-button glyphs | menu help text, options, tips, codex body |
| `FONT_DICE` | Monospace-ish engraved numerals (embedded OFL **IM Fell English** small caps for dice-theater numerals in shell only) | loading percentage, version string |
| `INK` | #101418 | backgrounds, text on parchment |
| `PARCHMENT` | #E9DFC8 | text on dark, paper surfaces |
| `BRONZE` | #B0793A | wordmark metal, hover accents, rules lines |
| `OBELISK` | #74E0B4 | far-realm accent: emblem inner glow, progress ink, selection pips (used sparingly = dread colour) |
| `BLOOD` | #8E2F26 | destructive confirms (delete save), crit stings |

Wordmark construction: letters D-E-L-V-E set in `FONT_DISPLAY` at cap height 100 u; custom cuts: the **E** arms terminate in chisel flats at 15°; the **V** apex drops 6 u below baseline into a point (echo of the emblem stair); letter-spacing +4 u; face material = brushed bronze (`BRONZE`) with a 1-px `INK` keyline and a faint `OBELISK` inner rim-light from lower-left (foreshadowing the obelisk). No outline glow at menu size; glow reserved for boot sting finale.

### 1.3 The Delve Emblem

- Geometry: a downward-pointing equilateral triangle (the d20 face) containing **three descending steps** cut from its top edge to its centroid (the "delve" — stairs into dark); at the centroid a single small circular pip (the d20's opposite face / the obelisk shard spark) in `OBELISK`.
- Construction: triangle side = 100 u; step treads at y = 30/50/70 u from top vertex, tread depth 12 u, alternating left-right offset 4 u (hand-cut feel); stroke weight 6 u `BRONZE`; pip radius 5 u.
- Clear space: 0.5 × triangle height on all sides. Minimum size: 24 px (below that use wordmark alone).
- Motion identity: the emblem's steps "light up" top-to-bottom in `OBELISK` whenever a load completes or a chapter stamp is earned.

### 1.4 Boot logo sting (4.0 s, skippable after 1.5 s by any input)

| t | Beat | Audio |
|---|---|---|
| 0.0–0.8 | Black. Distant water drip + low stone rumble. | `SFX_BOOT_STONE` |
| 0.8–2.0 | Ember motes (`OBELISK`-tinted) drift up and coalesce into the emblem outline; steps light top→bottom. | `SFX_BOOT_EMBERS` (soft chime per step ×3) |
| 2.0–3.0 | Wordmark chisels in letter-by-letter (stone-dust puff per glyph). | `SFX_BOOT_CHISEL` ×5 |
| 3.0–3.6 | Sublock fades in; bronze rim-light sweep across wordmark. | `MUS_BOOT_STING` (2-note dwarf-hum cadence) |
| 3.6–4.0 | Hold, then cross-fade to main menu (§2.2). | fade |

### 1.5 Usage matrix

| Surface | Lockup | Notes |
|---|---|---|
| Cold boot splash | Primary + disclaimer | §2.1 |
| Main menu | Menu lockup top-left | §2.3 |
| Loading screen | Emblem wax-seal + percent | §3.2 |
| Save slot row | Emblem stamp, steps lit = chapter progress | 1 step per completed chapter |
| Chapter-complete card | Emblem + chapter numeral | GDD-01 §7.7 |
| Window icon / shortcut | Emblem only | 256 px master |

---

## 2. BOOT SEQUENCE & MAIN MENU

### 2.1 Boot states (exact strings)

1. **Legal/attribution screen** (static, `INK` bg, `PARCHMENT` text, §1.1 disclaimer verbatim + engine/EULA lines + open-source font credits). Bottom line: `Press any button to continue.` Shaders pre-warm during this screen.
2. **Logo sting** (§1.4).
3. **Main menu** fade-in (0.6 s).

### 2.2 Menu background — live yard at dawn

- **Scene:** `YRD` zone loaded in "menu state": time 06:10, dawn fog layer, gulls; **no tutorial triggers active**, NPCs on idle loops only (clerk shuffles papers at the muster desk B; sergeant oils a blade at the sparring circle J; two trainees spar lightly at 30% intensity; Gundren is **absent** from the contract table — his chair is empty, a lantern still lit: quiet narrative tease).
- **Camera:** authored slow drift, 90 s loop, waypoints (yard coords per GDD-03 §2, metres): (0,2,1.6) → (−6,10,2.2) → (−12,20,2.6) → (0,26,3.0) → (10,18,2.4) → (6,8,1.8) → loop; look-at glides desk → dummy line → archery loft → contract table → gate. Depth of field f/2.8 equivalent; subtle handheld noise 0.3°.
- **Low-spec fallback:** pre-rendered 30 s loop of the same path (ships in install), cross-faded identically.
- **Audio bed:** `AMB_YRD_DAWN_MENU` (gulls, distant harbour bell every ~22 s, rope creaks, light blade-clack from spar) + `MUS_MENU_THEME` (90 s loop: hummed dwarf march, bouzouki + frame drum + low cello; varies at 50% intensity when CONTINUE is hovered over an existing save).

### 2.3 Menu layout (1080p reference, safe-area %)

- Menu-lockup logo: anchor (6%, 8%), height 9% of screen height.
- Menu column: left-aligned block anchored (6%, 34%), item height 6.5%, gap 1.2%:
  1. `PLAY`
  2. `CONTINUE`
  3. `OPTIONS`
  4. `CODEX`
  5. `CREDITS`
- Item style: `FONT_DISPLAY` 34 px `PARCHMENT`; hover = `BRONZE` ink-underline draws left→right (0.18 s) + pip sound; selected/press = underline solid + emblem steps flicker; keyboard ↑↓ / stick / mouse; `ESC` does nothing on menu (no back-exit; Alt-F4 only).
- `CONTINUE` with no saves: dimmed 40% + tooltip on hover: `No contracts signed yet.`
- Bottom-left (2%, 96%): disclaimer line, 11 px, 60% alpha.
- Bottom-right (98%, 96%) right-aligned: `DELVE v{build} · fan work · {date}` in `FONT_DICE` 12 px.
- Top-right: none (clean frame).

### 2.4 PLAY flow (state diagram, exact strings)

- **No existing save:** PLAY → **First Run page** (§2.4.2) → **Loading** (§3) → yard.
- **Existing save:** PLAY → overlay card (parchment, wax emblem):
  `Begin a new contract?` / body: `A signed contract already exists: "{slot name} — {class}, {level}, {chapter}". Starting anew will not erase it; up to 8 contracts may rest in the ledger.` / buttons: `BEGIN NEW` · `BACK`
  → `BEGIN NEW` → First Run page (slot auto-picked = first empty).
- **2.4.2 First Run page** (single parchment sheet, three groups; all changeable later in Options):
  - `Difficulty` — `Story` / `Balanced` / `Tactical` — help: `Story: forgiving foes, longer reaction timers. Balanced: the intended table. Tactical: sharper foes, alert states bite.` default **Balanced**.
  - `Combat pacing` — `Table Mode (turn-based)` / `Skirmish Mode (real-time, pausable)` — help: `Table Mode is the intended experience: full turns, full information. Skirmish Mode runs the same rules in flowing real time with pause.` default **Table Mode**. Skirmish shows tag `SECONDARY`.
  - `Subtitles` — `On`/`Off` default **On**; `Camera comfort preset` — `Standard`/`Reduced motion` default **Standard**.
  - Footer buttons: `SIGN & DESCEND` (→ loading) · `BACK`.
- Save creation happens at contract signing in-yard (GDD-03 area E); slot name = character name.

### 2.5 OPTIONS tree (every row; label · type · values · default · help string verbatim)

**Graphics:** `Resolution` (list, native) `Native`; `Frame rate cap` (30/60/90/120/unlocked) `60`; `Quality preset` (Low/Medium/High/Epic) `High`; `Ray-traced shadows` (On/Off) `On` if supported; `Foliage density` (Low/Med/High) `High`.
**Camera:** `Default view` (Third person/First person) `Third person`; `Toggle-view key` (rebind) `V`; `Field of view (first person)` (80–110) `95`; `Boom length (third person)` (2.5–6.0 m) `3.8`; `Head bob` (Off/Low/High) `Off`; `Camera shake` (0–100%) `70%`; `Snap turn (pad, first person)` (Off/15°/30°) `Off`; `Combat framing` (Auto two-shot/Follow actor/Manual) `Auto two-shot`; `Reduced motion` (On/Off) `Off`.
**Gameplay:** `Show hit chances` (On/Off) `On`; `Rules grid overlay` (Off/On-hover targeting/Always) `Off`; `Enemy turn pace` (Cinematic/Brisk/Instant) `Cinematic`; `Reaction prompts` (Ask always/Auto-take/Auto-pass) `Ask always`; `Reaction timer` (Off/6 s/10 s) `6 s`; `Auto-end turn` (On/Off) `Off`; `Companion trap tells` (On/Off) `On`; `Difficulty` (Story/Balanced/Tactical) as set at first run; `Combat pacing` as set at first run; `Fast travel` (Off/Map) `Off` (locked Off in Chapter 1, help: `The road is part of the story. The map opens in later chapters.`).
**Accessibility:** `Subtitles` (On/Off) `On`; `Subtitle size` (S/M/L) `M`; `Speaker names in subtitles` (On/Off) `On`; `Colourblind filter` (Off/Protanopia/Deuteranopia/Tritanopia) `Off`; `High-contrast UI` (On/Off) `Off`; `Screen-reader UI labels` (On/Off) `Off`; `Difficult-terrain outline` (Off/Subtle/On) `Subtle`; `Cover outlines` (Off/On-hover/Always) `On-hover`.
**Audio:** `Master`/`Music`/`SFX`/`Voice` sliders 0–100 (90/80/90/100); `Mute when unfocused` (On/Off) `On`.
**Controls:** full rebind table (move, look, sprint, jump, interact `F`, view toggle `V`, folio `Tab`, journal `J`, codex `C`, hide action `H`, end turn `Space`, pause `Esc`); pad layout A/B swap.

### 2.6 CODEX from menu

Tabs: **Rules** (verbatim PHB 2024 excerpts, pre-loaded: the d20 rule; Advantage/Disadvantage; AC & attack rolls; ability checks & DCs; passive scores; surprise; hiding; cover table; difficult terrain; conditions glossary; turn anatomy; reactions & opportunity attacks; resting; weapon masteries — all eight verbatim; non-lethal knock-out rule); **Lore** (empty-state string: `The ledger is blank. Lore earns itself.`; entries unlock in play, GDD-01 §7); **Bestiary** (empty-state: `No creatures catalogued yet.`). Navigation: left tab rail, right scrolling folio page with page-turn animation + `SFX_UI_PAGE`.

### 2.7 CREDITS

Vertical scroll (speed 60 px/s, hold-to-speed ×3): role blocks in `FONT_DISPLAY`, names in `FONT_UI`; placeholder structure: Design & Direction / Engineering / Art & Lighting / Audio & Voice / Rules Texts (Wizards of the Coast attribution paragraph verbatim §1.1) / Fonts (OFL names) / Engine (Unreal Engine attribution line) / Playtesters / `Made with love for the table. Never for sale.` End card: emblem with all three steps lit.

### 2.8 Menu audio list

| ID | Type | Trigger |
|---|---|---|
| `MUS_MENU_THEME` | loop 90 s | menu enter |
| `MUS_MENU_THEME_VAR` | loop 90 s | CONTINUE hovered with saves |
| `SFX_UI_MOVE` | one-shot | item hover change |
| `SFX_UI_CONFIRM` | one-shot | selection (warm wood knock) |
| `SFX_UI_BACK` | one-shot | back (soft page flip) |
| `SFX_UI_DENY` | one-shot | dimmed item pressed |
| `SFX_UI_PAGE` | one-shot | codex/options page turn |
| `AMB_YRD_DAWN_MENU` | loop | menu bed (§2.2) |
| `SFX_BOOT_*`, `MUS_BOOT_STING` | one-shots | §1.4 |

---

## 3. LOADING SCREEN

### 3.1 When it appears

- Menu → yard (first load & resume), chapter-boundary loads, save resume. **Not** for CRG interior movement (streamed, GDD-01 §14.6). Minimum visible time 1.2 s (art beat), target complete < 8 s on SSD; if load finishes early, the map ink completes at accelerated rate rather than cutting.

### 3.2 Visual design

- Full-bleed **parchment map of the Sword Coast** (hand-painted, `PARCHMENT` + sepia inks, vignette edges). The current journey route **inks itself** across the map in `OBELISK`-dark teal = true load progress (0→100%): menu→yard draws Neverwinter harbour → the yard glyph; chapter loads draw the chapter's route.
- Bottom-left: rotating **tip card** (parchment slip, one tip at a time, cross-fade 0.4 s, cycle 5 s):
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
  15. `Press V to see the world through your hero's own eyes. Press it again to shoulder the camera back.`
  16. `Turn-based is the intended rhythm. Skirmish Mode waits in Options for the impatient.`
- Bottom-right: **wax-seal emblem** (§1.3) rotating slowly; percentage in `FONT_DICE` inside the seal; emblem steps light at 33/66/100%.
- Top-center small: zone/chapter title being loaded, e.g. `NEVERWINTER — THE ROCKSEEKER CONTRACT` / `CHAPTER 1 — A DANGEROUS JOURNEY`.

### 3.3 Technical & states

- Progress source: real asset/streaming completion (weighted: bundles 70%, shader PSO 20%, navmesh+rules-grid build 10%); never faked, never regresses.
- Complete → seal stamps (thunk SFX `SFX_LOAD_STAMP`), 0.5 s hold, 0.6 s fade to world at the yard gate (GDD-03 area A, beat T0).
- Error state (bundle fail): card replaces tips: `The road is washed out. (Asset load failed: {id}). Retry?` buttons `RETRY` / `QUIT TO MENU`.
- Timeout > 45 s: tips card swaps to `Still packing the wagon… large loads take a moment on first visit.`

---

## 4. SHELL STRING MASTER TABLE

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
| STR_CODEX_RULES_EMPTY | (n/a — rules pre-loaded) |
| STR_CODEX_LORE_EMPTY | `The ledger is blank. Lore earns itself.` |
| STR_CODEX_BEST_EMPTY | `No creatures catalogued yet.` |
| STR_BOOT_ANY | `Press any button to continue.` |
| STR_CREDITS_END | `Made with love for the table. Never for sale.` |

*End of GDD-02 v1.0.*
