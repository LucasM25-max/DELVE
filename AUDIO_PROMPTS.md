# DELVE — AUDIO GENERATION PROMPT SHEET

Every sound in the web shell currently has a synthesized placeholder. To use real
generated audio: drop the files into `assets/audio/` **and add each filename to
`assets/audio/manifest.json`** (e.g. `{"files": ["mus_menu_theme.ogg", "sfx_ui_stamp.ogg"]}`).
The shell loads listed files at boot and prefers them over synthesis; anything not
listed keeps its synthesized fallback. Exact filenames and prompts below.

## Global style brief (paste once at the start of your session, then reference it)

> Dark-fantasy AAA video-game audio, Forgotten-Realms-flavoured low fantasy. Acoustic
> and physical sources only: hammered bronze, oak, stone, rope, parchment, straw,
> distant harbour bells, gulls. No modern synthesizers, no electronic beats, no rock
> drums. Warm, hand-played, slightly worn character; gentle tape-ish saturation;
> wide dynamic range; reverb only where specified. Master to −16 LUFS integrated
> for loops, true-peak ≤ −3 dBTP for one-shots. 48 kHz, 24-bit.

## Technical rules for loops

- Loops must be **seamless**: first and last waveform samples continuous, no fade-in,
  no fade-out, no reverb tail beyond the loop point (use "dry loop" or "no tail").
- State "perfect loop, exactly N seconds" in the prompt and trim to exact length.

---

## 1. Music

### `mus_menu_theme.ogg` — main menu theme (LOOP, 90 s)
> Seamless 90-second loop, dark-fantasy main-menu music: a slow dwarf march hummed by
> low male voices over a warm drone in D minor; plucked bouzouki and octave mandolin
> playing a sparse, wistful pentatonic air; soft frame drum and hand percussion on a
> steady 72 bpm heartbeat; occasional low cello swell. Intimate, hopeful-but-weary,
> tavern-adjacent, no climax, no drums kit, no brass. Constant energy from first to
> last second so it loops forever behind a game menu. Perfect loop, exactly 90 seconds.

### `mus_menu_theme_var.ogg` — menu theme variant (LOOP, 90 s)
> Same arrangement, key and 72 bpm pulse as the dwarf-march menu theme but at half
> intensity: thinner plucks, no drum, and a prominent low male hum melody (wordless,
> chest-register, slight vibrato) carrying the phrase; feeling of memory and longing.
> Must align bar-for-bar with the original so the two can crossfade. Perfect loop,
> exactly 90 seconds.

### `mus_boot_cadence.ogg` — logo sting cadence (ONE-SHOT, ~1.6 s)
> Two-note cadence for a game logo reveal: a single low bouzouki pluck on D, then a
> deeper open string on A half a second later, joined by a faint male hum on the second
> note; warm, final, like a door closing gently. Dry, no reverb tail longer than 0.4 s.

---

## 2. Boot / logo sting one-shots

### `sfx_boot_stone.ogg` (~1.2 s)
> Deep stone rumble and a single distant water drip in a cave; sub-bass granite groan
> swelling and fading; no melody. Dry-ish, small room tail.

### `sfx_boot_chime.ogg` (~1.2 s)
> One soft antique bronze bell chime, struck gently, warm fundamental with shimmering
> inharmonic partials; mystical but restrained; medium room reverb. (Played three times
> with rising pitch — keep the fundamental mid-low so pitch-ups stay natural.)

### `sfx_boot_chisel.ogg` (~0.15 s)
> A single sharp stone-chisel strike: metal tick plus a puff of granite dust; very
> short, dry, no reverb; crisp transient for UI-scale logo lettering impacts.

---

## 3. UI one-shots (all dry, ≤ 0.5 s, no reverb tail)

### `sfx_ui_move.ogg` (~0.08 s)
> Tiny soft wooden pip: a finger tap on oak, very quiet, rounded transient; menu
> cursor movement.

### `sfx_ui_confirm.ogg` (~0.35 s)
> Satisfying wooden knock plus a low bronze coin spin: menu selection confirm; warm,
> confident, single event.

### `sfx_ui_back.ogg` (~0.3 s)
> A single parchment page turning back: soft paper sweep with a small leather creak;
> gentle, non-sibilant.

### `sfx_ui_deny.ogg` (~0.25 s)
> Dull muffled thud of a padded practice blade against a shield: soft refusal, low
> mid-range, no brightness.

### `sfx_ui_page.ogg` (~0.25 s)
> One crisp parchment page turn, slightly louder than the back sound, with a faint
> quill scratch underneath.

### `sfx_ui_stamp.ogg` (~0.5 s)
> Hot wax seal stamp: a heavy wooden sigil pressed into wax — deep thock, small wax
> squish, faint bronze ring afterwards; ceremonial and final.

---

## 4. Ambience one-shots (scheduled randomly by the menu bed)

### `amb_gull.ogg` (~0.7 s)
> Two distant seagull cries over a harbour, thin and airy, high-pass filtered feel,
> slight natural reverb of open water; not close, not startling.

### `amb_bell.ogg` (~4 s)
> One distant harbour bell toll, low bronze fundamental, slow decay over four seconds,
> heard across water from far away; very gentle.

### `amb_creak.ogg` (~0.8 s)
> Rope and oak ship-rigging creak in a light breeze: one slow tortured-fibre groan,
> mid-range, distant dockyard character.

### `amb_clack.ogg` (~0.3 s)
> Distant sword-practice clack: two blunted steel blades meeting once, heard across a
> yard, small crowd-less openness, light natural echo.

---

## 5. Optional (not wired yet — future chapters)

- `amb_yrd_dawn_bed.ogg` — 60 s seamless yard dawn bed (mist, spar murmurs, flags).
- `mus_sting_sign.ogg` — 3 s contract-signing flourish.
- `mus_sting_spar_win.ogg` — 2 s sparring-victory flourish.

---

## Filename → id map (for reference)

| File | Used as |
|---|---|
| mus_menu_theme.* | menu theme loop |
| mus_menu_theme_var.* | CONTINUE-hover variant |
| mus_boot_cadence.* | sting cadence |
| sfx_boot_stone.* | sting opening rumble |
| sfx_boot_chime.* | step chimes ×3 (pitched up in play) |
| sfx_boot_chisel.* | letter chisel ticks ×5 |
| sfx_ui_move / confirm / back / deny / page / stamp.* | UI set |
| amb_gull / bell / creak / clack.* | menu ambience bed |
