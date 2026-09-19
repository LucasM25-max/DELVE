# DELVE — Audio Generation & Upload Guide

**Everything here is copy-paste.** Part 1 tells you which AI tool to use for each asset.
Part 2 gives the exact prompt and settings per asset. Part 3 shows how to clean/export the files.
Part 4 walks you through putting them in GitHub (web upload **or** git commands) and switching them on.

> The shell contains **no synthesised audio whatsoever**. Until you upload files it plays
> intentional, designed silence. Missing files never error.

---

## Part 1 — Tool assignments

| Asset type | Assets | Recommended tool | Why |
|---|---|---|---|
| Orchestral music | `mus_menu_theme`, `mus_menu_theme_var`, `mus_boot_cadence` | **Stable Audio** (stableaudio.com, free tier) or **Suno** (suno.com) | Both take plain-English prompts and produce instrumental tracks; Stable Audio lets you set an exact duration and returns clean WAVs. Suno is best if you want a more "composed" melody. |
| UI & impact SFX | `sfx_boot_stone`, `sfx_boot_chime`, `sfx_boot_chisel`, `sfx_ui_move`, `sfx_ui_confirm`, `sfx_ui_back`, `sfx_ui_deny`, `sfx_ui_page`, `sfx_ui_stamp` | **ElevenLabs Sound Effects** (elevenlabs.io → Sound Effects, free tier) | Text-to-SFX with a **duration slider in seconds** — perfect for sub-second UI ticks. Export MP3/WAV. |
| Ambient one-shots | `amb_gull`, `amb_bell`, `amb_creak`, `amb_clack` | **ElevenLabs Sound Effects** (same session) | 2–6 s natural recordings are exactly what it does best. |

Free/open fallbacks if you'd rather not sign up anywhere: **Meta's AudioCraft / AudioGen** (run on Hugging Face Spaces — search "audiogen space"), or the **Stable Audio Open** model. Quality is a step down; the workflow below is identical.

---

## Part 2 — Generate each asset

### 2.1 Music — Stable Audio route

1. Go to **stableaudio.com** → sign in (free tier gives monthly credits).
2. Paste the prompt (from `AUDIO_PROMPTS.md`, repeated here), set the **Duration**, and Generate.
3. Generate **3–4 takes**, pick the best, and download the WAV.

| File to produce | Prompt | Duration |
|---|---|---|
| `mus_menu_theme.ogg/.wav` | *Sparse medieval-fantasy menu music for a D&D adventure game opening screen. Soft Dorian-mode strings and warm low brass under a slow hammered dulcimer ostinato; a gentle Irish tin whistle melody floats over the top; very distant frame-drum pulse like a heartbeat; ends calm and unresolved with long string sustain. Reverberant stone-hall atmosphere. No vocals, no drums forward, no modern instruments.* | **90 s** |
| `mus_menu_theme_var.ogg/.wav` | *Second variation of a sparse medieval-fantasy menu theme: tin whistle leads with ornaments, hammered dulcimer ostinato continues, strings add one rising counter-line near the end, frame-drum heartbeat pulse slightly more present. Dorian mode, reverberant stone-hall atmosphere, calm and unresolved ending. No vocals, no modern instruments.* | **60 s** |
| `mus_boot_cadence.ogg/.wav` | *Three-second orchestral logo sting: soft stone impact hit, then two rising harp harmonics and one warm low-brass swell resolving into a gentle bell tone with long reverb tail. Single clean hit at the start, no rhythm, no melody development. Fantasy game publisher sting, dignified and quiet.* | **5 s** |

**Suno route (alternative):** Custom mode → Instrumental ON → paste the same prompt → style tags
`orchestral, medieval fantasy, ambient, tin whistle, hammered dulcimer, cinematic, calm` → generate.
Suno outputs are longer; use the Part 3 trim step.

### 2.2 SFX — ElevenLabs route

1. Go to **elevenlabs.io** → **Sound Effects** (left sidebar).
2. Paste the prompt, set **Duration prompt** as listed, click Generate.
3. Download WAV (preferred) or MP3. Generate 2–3 takes per asset and pick the cleanest.

| File to produce | Prompt | Duration |
|---|---|---|
| `sfx_boot_stone` | *Deep stone door grinding open, heavy granite slab on stone tracks, low resonant rumble, slight rocky scrape at the end, large cave reverb tail.* | 8 s |
| `sfx_boot_chime` | *Single soft bronze bell chime, one gentle strike, warm metallic shimmer, long quiet decay.* | 3 s |
| `sfx_boot_chisel` | *Three quick light chisel taps on stone, crisp and dry, small stone chips falling.* | 3 s |
| `sfx_ui_move` | *Tiny dry wooden tick, single soft click, UI selection blip, very short, quiet, no reverb.* | 2 s |
| `sfx_ui_confirm` | *Two-note soft wooden knock, low then slightly higher, warm and short, gentle confirmation.* | 2 s |
| `sfx_ui_back` | *Single hollow wooden knock, quiet descending tone, short UI back sound.* | 2 s |
| `sfx_ui_deny` | *Short dull muted thud, soft leather slap, brief low error tone, quiet.* | 2 s |
| `sfx_ui_page` | *Parchment page turn, dry paper rustle, crisp and short.* | 2 s |
| `sfx_ui_stamp` | *Heavy wax seal stamp press, solid thump with slight crackle, deep and final.* | 3 s |
| `amb_gull` | *Single distant seagull cry over faint ocean wind, far away, lonely, natural.* | 4 s |
| `amb_bell` | *Distant town bell, one slow toll, muffled by distance, long quiet decay.* | 6 s |
| `amb_creak` | *Slow wooden sign creaking in the wind, two or three short creaks, old hinges.* | 6 s |
| `amb_clack` | *Two wooden cart wheels rolling over cobblestones, short clatter, passing by.* | 5 s |

---

## Part 3 — Clean up & export (Audacity, free — or ffmpeg)

For **every** file:

1. **Trim** dead air from start/end (keep ~0.5 s reverb tail on stings/ambience).
2. **Loudness target:** *Effect → Loudness Normalization* → **−16 LUFS**, peak normalise to **−1 dB**.
   (UI ticks may sit quieter, around −20 LUFS; music around −18 LUFS.)
3. **Music loops only** (`mus_menu_theme`, `mus_menu_theme_var`): make them loop seamlessly —
   select the last ~2 s, *Effect → Crossfade (clip boundaries)* or copy the tail over the head with a
   1 s crossfade, so the seam disappears.
4. **Export:** *File → Export Audio* →
   - Format **OGG Vorbis**, quality **6** → filename exactly as in the tables above (e.g. `sfx_ui_move.ogg`), **or**
   - Format **WAV** (16-bit PCM) → e.g. `sfx_ui_move.wav`. Either extension works; the engine looks for `.ogg` then `.wav`.

**ffmpeg one-liners** (if you prefer the terminal):

```bash
# convert + loudness-normalise in one go (any input → ogg):
ffmpeg -i input.mp3 -af loudnorm=I=-16:TP=-1 -c:a libvorbis -q:a 6 sfx_ui_move.ogg

# trim dead air (silence removal from head/tail):
ffmpeg -i input.wav -af "areverse,silenceremove=1:0.02:-45dB,areverse,silenceremove=1:0.02:-45dB" trimmed.wav
```

---

## Part 4 — Add to GitHub (and it goes live on Vercel)

### 4.1 Upload via the GitHub website (no tools needed)

1. Open your repo (e.g. `github.com/<you>/delve-web-shell`).
2. Click **Add file → Upload files**.
3. In the file path box at top-left of the drop area, type **`assets/audio/`** so the files land in the right folder, then drag in your finished audio files.
4. Scroll down → **Commit changes** → *Commit directly to the `main` branch* → **Commit changes**.
5. Vercel sees the push and redeploys automatically (~30 s). Hard-refresh your site.

### 4.2 Or via git commands (Desktop/Terminal)

```bash
cd delve-web-shell                     # your local clone
cp ~/Downloads/mus_menu_theme.ogg assets/audio/
cp ~/Downloads/sfx_ui_move.ogg   assets/audio/   # ...and the rest

git add assets/audio/
git commit -m "audio: add generated menu theme and UI sound effects"
git push origin main                   # Vercel auto-deploys on push
```

### 4.3 Register the files in the manifest (one edit — this is the on/off switch)

Open **`assets/audio/manifest.json`** (edit directly on GitHub: click the file → pencil icon → Commit)
and list every filename you uploaded:

```json
{
  "files": [
    "mus_menu_theme.ogg",
    "mus_menu_theme_var.ogg",
    "mus_boot_cadence.ogg",
    "sfx_boot_stone.ogg",
    "sfx_boot_chime.ogg",
    "sfx_boot_chisel.ogg",
    "sfx_ui_move.ogg",
    "sfx_ui_confirm.ogg",
    "sfx_ui_back.ogg",
    "sfx_ui_deny.ogg",
    "sfx_ui_page.ogg",
    "sfx_ui_stamp.ogg",
    "amb_gull.ogg",
    "amb_bell.ogg",
    "amb_creak.ogg",
    "amb_clack.ogg"
  ]
}
```

Commit. The engine fetches the manifest, loads only what's listed, and everything else stays silent.
**You can add files one at a time** — upload a batch, list it, commit; the site picks it up on the next deploy.

### 4.4 Verify

1. Open the site, press F12 → **Console** → reload. No red 404s should appear for files you listed.
2. Play the menu: theme fades in under the sting after ~4 s; hovering menu items ticks (`sfx_ui_move`).
3. Wrong filename in the manifest? That asset is simply skipped — no crash.

---

## Appendix — filename ↔ engine id map

| Engine id | Filename (either extension) | Where it plays |
|---|---|---|
| `mus_menu_theme` | mus_menu_theme.ogg/.wav | menu bed (after boot sting, 4 s) |
| `mus_menu_theme_var` | mus_menu_theme_var.ogg/.wav | idle variant after ~100 s |
| `sfx_boot_stone` | sfx_boot_stone.ogg/.wav | title reveal @0.8 s |
| `sfx_boot_chime` | sfx_boot_chime.ogg/.wav | ×3 @1.0/1.35/1.7 s |
| `sfx_boot_chisel` | sfx_boot_chisel.ogg/.wav | wordmark etch @3.0 s |
| `mus_boot_cadence` | mus_boot_cadence.ogg/.wav | sting tail @3.0 s |
| `sfx_ui_move` | sfx_ui_move.ogg/.wav | menu hover/navigate |
| `sfx_ui_confirm` | sfx_ui_confirm.ogg/.wav | PLAY, CONFIRM, SIGN |
| `sfx_ui_back` | sfx_ui_back.ogg/.wav | BACK |
| `sfx_ui_deny` | sfx_ui_deny.ogg/.wav | disabled choices, stubs |
| `sfx_ui_page` | sfx_ui_page.ogg/.wav | First Run page turn |
| `sfx_ui_stamp` | sfx_ui_stamp.ogg/.wav | end-card wax seal |
| `amb_gull` | amb_gull.ogg/.wav | random 20–40 s over bed |
| `amb_bell` | amb_bell.ogg/.wav | ~every 22 s, quiet |
| `amb_creak` | amb_creak.ogg/.wav | random 8–16 s |
| `amb_clack` | amb_clack.ogg/.wav | random 5–9 s |

Ambience runs continuously **only after audio files are uploaded** — with an empty manifest
nothing plays at all, by design.
