# DELVE — Web Shell (Main Menu, Boot Sequence, First Run)

Production-ready web build of the **DELVE** game shell: boot/attribution screen, animated
logo sting, main menu over the Neverwinter training-yard dawn scene, the PLAY →
**First Run contract page** flow, and the signed-contract end card.

Implements [`02_DELVE_SHELL_SPEC.md`](../SHATTERED_OBELISK_GAME/02_DELVE_SHELL_SPEC.md)
(GDD-02) §1.1–1.5, §2.1–2.4, §2.8 and the §4 string master.

**Deliberately not in this build** (per product decision): the options tree, the codex
contents, the credits scroll and the loading screen. Those menu items appear in the menu
(as the spec's layout requires) and open a sealed-stub card; the loading screen's entry
point is replaced by the signed-contract end card.

## Run locally

Any static server works — no build step, no dependencies:

```bash
python3 -m http.server 3000        # then open http://localhost:3000
# or: npx serve .
```

## Deploy to Vercel

1. Push this folder to a GitHub repository (it is the repo root: `index.html` at top level).
2. Vercel → **Add New… → Project** → import the repo.
3. Framework Preset: **Other** (static). Build command: *(leave empty)*. Output directory: *(leave empty / `.`)*.
4. Deploy. `vercel.json` already sets clean URLs and immutable caching for `/assets`.

## Deploy to GitHub Pages

Push to a repo, enable Pages on the branch root — the site is fully static.
(Fonts load from Google Fonts; offline environments fall back to system serifs gracefully.)

## Controls

| Input | Action |
|---|---|
| Any key / click (attribution screen) | continue (also unlocks audio) |
| Any key / click (after 1.5 s of the sting) | skip logo sting |
| ↑ / ↓ or W / S, mouse hover, d-pad/stick | move menu selection |
| Enter / Space / click / A button | activate |
| B button / Esc | back out of cards (Esc does nothing on the menu, per spec) |

## What is synthesized vs generated

- **Audio:** 100 % runtime Web Audio synthesis (`js/audio.js`) — the 90-second dwarf-march
  menu loop (Karplus-Strong bouzouki plucks, frame drum, pad), its 50 %-intensity hum
  variant, the harbour-dawn ambience bed (bell ≈22 s, gulls, rope creaks, blade clacks),
  the boot-sting one-shots and every UI sound. Zero audio files, zero licensing.
- **Images:** `assets/img/yard_dawn_panorama.png` (menu background, generated matte
  painting) and `assets/img/parchment.jpg` (card/sheet grain). The DELVE wordmark, the
  delve-stair emblem and the wax contract seal are hand-built inline SVG per GDD-02 §1.2–1.3
  (crisp at every size, animatable for the sting).
- **Motion:** the §2.2 camera drift is a 90-second keyframed pan/zoom over the matte with
  mist, gull and handheld-noise layers; `Reduced motion` (and the OS preference) freezes it.

## Test hooks (for screenshots / CI)

`?s=legal|sting|menu|new|firstrun|end|stub2|stub3|stub4` jump to a state ·
`?save=1` seeds a signed contract · `?still=1` freezes background motion ·
`?t=<ms>` holds the sting timeline at a moment.

## Saved data

A signed contract persists in `localStorage` (`delve.contract.v1`) so CONTINUE's
dim/lit logic and the menu-theme variant behave per spec across sessions.

## Attribution

An unofficial, non-commercial fan project. Dungeons & Dragons, *Phandelver and Below: The
Shattered Obelisk* and all Wizards of the Coast characters and locations are trademarks of
Wizards of the Coast LLC. Used here without permission; no challenge to any trademark or
copyright. This game will never be sold. Typefaces: Cinzel, Alegreya, IM Fell English (SIL
OFL).
