# DELVE — import, play, and publish

**Native Godot edition · 0.1 · September 20, 2026**  
**Use Godot 4.7.2 Standard (GDScript), not Godot 3 or the .NET edition.**

## What you have

This is a real Godot project: `.tscn` scenes, editable `.gd` scripts, bundled artwork,
fonts and music. It is **not a website embedded inside Godot**. No plugins, Blender
installation, asset purchase, Node.js or account are needed to run it.

The existing web preview is a menu shell, not a finished game. This conversion includes:

- Attribution screen and animated logo introduction.
- The dawn training-yard menu with the original DELVE artwork and supplied music.
- Play → contract choices → real resource-loading screen → signed-contract threshold.
- Continue with a local ledger of up to eight contracts, including confirmed deletion.
- Six options categories, keyboard rebinding, codex rules/lore/bestiary, scrolling credits.
- **An optional new 3D test yard:** walking, sprinting, jumping, collision and first/third-person cameras.
- A single-threaded, Compatibility-renderer Web export preset.

**Not included yet:** a playable campaign, character creation, combat, quests, inventory,
multiplayer, cloud saves, finished character/environment models or a mobile-touch controller.
The 3D yard is deliberately a small placeholder blockout. Settings marked **†** are stored
for future development; they do not secretly enable unimplemented systems.

---

## 1. Install Godot

1. Download **Godot 4.7.2 — Standard** for your operating system from
   [Godot's official download/archive page](https://godotengine.org/download/archive/).
2. Extract or install the editor and open **Godot Project Manager**.
3. Do not select Godot 3. The project uses Godot 4 APIs. You do not need .NET or Visual Studio.
4. If using a newer stable Godot release, make a backup first. This delivery was tested in 4.7.2;
   export templates must always match your editor's exact version.

## 2. Import the ZIP

**Recommended, most predictable route:**

1. Download `DELVE_Godot_4.7.2.zip`.
2. Extract it into a permanent folder, for example `Documents/Godot/DELVE`.
3. In Godot Project Manager, click **Import**.
4. Browse to that folder and select **`project.godot`**.
5. Choose **Import & Edit** (wording may vary slightly by OS/editor version).
6. Let the asset-import progress finish. Godot creates a `.godot` cache automatically.

**Direct ZIP import:** Project Manager can also import the ZIP itself. Choose an empty
extraction folder when prompted. The archive contains `project.godot` at its root.
If ZIP import is confusing, use the extraction method above.

Keep the renderer on **Compatibility**. Do not convert this browser-targeted project to
Forward+ or Mobile. No editing is needed before running.

## 3. Play the menu and sign a contract

1. Press **F6 only if you want to run an individual scene**. Normally press **F5 / Run Project**.
   The configured main scene is `scenes/ui/shell.tscn`.
2. Click Continue on the attribution screen, or press a key. This also starts the music.
3. Watch the logo introduction; after 1.5 seconds, press a key/click to skip it.
4. Select **PLAY**.
5. Choose difficulty, combat pacing, subtitles and camera comfort.
6. Select **SIGN & DESCEND**.
7. The map loads the optional yard scene and then displays **CONTRACT SIGNED**.
8. Choose **BACK** to return to the menu, or **ENTER THE TEST YARD** to try the 3D foundation.
9. On later launches, use **CONTINUE** to select a saved contract.

You can also inspect **OPTIONS**, **CODEX**, and **CREDITS** before signing.
Lore unlocks after the first contract; the bestiary is intentionally empty.

### Menu controls

| Input | Action |
|---|---|
| Mouse click | Activate controls |
| Up/down arrows, or W/S on the main menu | Select an action |
| Tab / Shift+Tab | Move between native controls |
| Enter / Space | Activate the focused button |
| Escape | Back to the menu; cancels a pending key rebind |
| Gamepad D-pad / A / B | Native menu navigation / activate / back |
| Hold Space or Shift in credits | Faster scrolling |

Scroll long options and codex pages with the mouse wheel. In Options → Controls, click a
binding and press a key. Used keys swap with the other action; Escape and WASD are reserved.
The 3D yard is keyboard/mouse-only in this delivery; menu gamepad support is not a full
3D controller implementation.

## 4. Explore the optional 3D yard

1. Select **ENTER THE TEST YARD** after signing/restoring a contract.
2. Click **EXPLORE / RESUME**. This deliberate click allows a browser to capture the mouse.
3. Walk around the floor, crates, tables and training dummies.
4. Press **Esc** to release the mouse and pause.
5. Choose **RETURN TO MENU** to get back to the original menu flow.

| Input | Default action |
|---|---|
| W A S D | Move relative to the camera |
| Mouse | Look around |
| Shift | Sprint |
| Space | Jump |
| V | Switch first/third-person view |
| Esc | Pause / release the mouse |

The gate is closed on purpose. No campaign exists beyond it yet. The green capsule is an
intentional placeholder character, not a failed model import. Yard position is not saved;
re-entry starts at the spawn point. Only the contract ledger and options persist.

If Godot's embedded game window makes mouse capture awkward, disable **Embed Game on Play**
from the editor's game/run window controls and run in a separate window. In a browser, the
first Escape may release pointer lock; the yard detects that and opens its pause screen.

---

## 5. Export an actual website

Godot can run 3D games in a browser. This project already uses **GDScript + Compatibility
(WebGL 2)** and a **single-threaded** Web preset. It does not need a game server for its
current features. A static web host is enough.

### Install matching export templates — once

1. In the editor, open **Editor → Manage Export Templates**.
2. Install the templates for **4.7.2**, matching the editor you are using.
3. Wait for installation to complete. Templates are not bundled in this ZIP because they
   are large, platform-wide Godot downloads.

### Export through the editor

1. Open **Project → Export**.
2. Select the included **Web** preset.
3. Confirm **Thread Support** is **off** and **Extensions Support** is **off**.
4. Click **Export Project** — not merely **Export PCK/ZIP**.
5. Create an output directory such as `exports/web`.
6. Export as **`index.html`**. Turn off **Export With Debug** for a public release.
7. Keep **all generated files together**. The HTML, JavaScript, WASM, PCK and accompanying
   files are one website; uploading only `index.html` will not work.
8. For distribution, also copy `licenses/`, `THIRD_PARTY.md` and the two `*OFL.txt` font
   notices into a `licenses/` folder beside `index.html`.

The equivalent optional command-line helper handles the notices for you:

```sh
# Run from the extracted project folder; Python 3 is only needed for these helpers.
python tools/export_web.py --godot "/full/path/to/your/Godot-executable"
```

On Windows, use your Godot `.exe` path in quotes. On macOS, the executable is normally inside
`Godot.app/Contents/MacOS/Godot`. If `godot` is already on PATH, `--godot` is optional.

### Test the website locally

1. Do **not** double-click the exported HTML file. Browsers block required requests under `file://`.
2. Open a terminal in the extracted project folder.
3. Run:

   ```sh
   python tools/serve_web.py
   ```

   On Windows, `py tools/serve_web.py` may be the command if Python is installed as `py`.
4. Open **http://localhost:8080** in a recent desktop browser with WebGL 2 and WebAssembly.
5. Click inside the game to unlock audio. Test the menu, save/reload and mouse capture.
6. Stop the local server with **Ctrl+C** when done.

No Python? Use Godot's Web remote-run option after installing the matching templates, or
upload the exported folder to a static host. Python is a convenience, not a game dependency.

### Publish it online

- Upload the **contents of `exports/web`** to an HTTPS static host such as itch.io HTML5,
  GitHub Pages, Netlify or Vercel.
- **itch.io:** ZIP the exported website files with `index.html` at the archive root. Create an
  HTML project, upload that **website ZIP**, and mark it playable in the browser. This is a
  different ZIP from the editable source-project delivery.
- **Vercel / Netlify:** deploy the exported folder as the static site's output directory;
  no Node build is needed. The existing repository's root `index.html` is still the OLD
  JavaScript preview. Hosting the repo root unchanged does not publish the Godot version.
- **GitHub Pages:** publish the exported folder's contents, not the `.gd`/`.tscn` source tree.
- A host must serve `.wasm` as `application/wasm`, `.js` as JavaScript, and `.pck` as a binary
  file. Do not use an SPA rewrite that replaces missing game files with HTML.
- Keep stable URLs and update the HTML/JS/WASM/PCK files together. Test after each deployment.
- Single-threaded export avoids the extra COOP/COEP cross-origin-isolation requirement.
  If we enable threads later, hosting headers and embedding behavior will need revisiting.

If embedding inside a larger website, host the exported files in a subdirectory and point
an iframe at its `index.html`. Give it a useful size (ideally landscape, at least 960×540).
If the iframe is sandboxed, permit scripts, same-origin storage and pointer lock; provide
fullscreen permission where appropriate. Test direct navigation first, then the embed.

### Browser saves

Contracts and preferences are **local**, not cloud-backed. Godot uses `user://delve_v1.json`;
in a browser this is stored through its virtual filesystem/IndexedDB. Storage restrictions,
private browsing, clearing site data or changing domain can lose or separate saves.
The original JavaScript preview's `localStorage` saves are **not migrated automatically**.
Native-editor saves and browser saves are separate. A visible warning is shown when a
synchronous save fails; a browser can still restrict or evict storage later.

---

## 6. Later Blender and third-party 3D assets

You do not need to create models or write GDScript just to run this delivery. The project is
organized so later work can add authored Blender assets or properly licensed third-party
models without rebuilding the menu. The native scripts are all included and editable.

Godot has an **Asset Library** (mostly community assets and add-ons); third-party stores
also distribute Godot-compatible models. There is no requirement to buy anything now.
We should review each asset's license, polygon count, textures and shader compatibility
before choosing it for a browser build.

Recommended future workflow:

1. Create or acquire the model and record its source and license.
2. In Blender, use consistent scale (**1 unit = 1 metre**), apply rotation/scale, and set a
   useful origin. Use ordinary Principled BSDF materials and UV-mapped textures.
3. Export **glTF 2.0 Binary (`.glb`)**, including required animation. This is the preferred
   interchange format. You can use `.blend` imports, but then every importing machine must
   have the appropriate Blender installation; `.glb` avoids that dependency.
4. Put the file under `assets/models/`. Godot imports it automatically.
5. Open `scenes/world/test_yard.tscn` and instance environment models under **Art**.
6. Replace corresponding nodes under **Blockout** only after adding and testing collision.
   Complex visual meshes should generally use simpler separate collision shapes.
7. For a character, instance its model under `scenes/actors/player.tscn` → **Visuals** and
   replace **Placeholder**. Keep the `CharacterBody3D`, capsule collision, camera pivot and
   SpringArm. AnimationTree/AnimationPlayer integration is a future implementation task.
8. Do not edit imported `.glb` scene internals destructively: use an inherited/wrapper scene
   so re-exporting from Blender does not overwrite game logic.
9. Export to the browser early and profile on the weakest supported device.

Use modest texture sizes (often 1K–2K), sensible polygon counts, LODs and a small number of
materials. Prefer baked lighting/simple shadows to expensive dynamic effects. Avoid
Forward+-only shaders, hardware ray tracing, native-only extensions and mandatory threads
unless we intentionally change the browser support plan.

See `ARCHITECTURE.md` for exact code and scene extension points.

---

## Troubleshooting

| Symptom | What to do |
|---|---|
| Godot cannot import the project | Extract the whole ZIP, select `project.godot`, use Godot 4.7.2 Standard, and let imports finish. |
| Nothing happens when pressing F6 | Use **F5** to run the configured full project. |
| Continue is grey | Sign a contract through Play first. |
| The adventure does not start | That is expected: this delivery is the menu shell plus an optional 3D blockout. |
| No sound in a browser | Click Continue in the game; check Options → Audio, tab mute and browser audio permissions. |
| The mouse is stuck in the yard | Press Esc. On the web, pointer-lock release will also pause the yard. |
| Website is blank or files fail to load | Use HTTP/HTTPS, keep all export files together, check browser developer-console/network errors and MIME types. |
| Template error during export | Install templates matching the exact editor version, not just any Godot 4 release. |
| Website still looks like the old HTML preview | You deployed the repo root instead of the Godot export folder. |
| Save disappears online | Check private browsing, origin/iframe storage policies, site-data cleanup and domain changes. No cloud save exists. |
| Small screen is uncomfortable | Use a landscape desktop window/fullscreen. A dedicated touch/mobile UI is not included yet. |
| A setting seems to do nothing | Settings marked † are future-only. Graphics quality, ray tracing and combat systems are not implemented. |

## Validation included with this delivery

The source was imported and executed using **official Godot 4.7.2**. Automated headless
checks exercise screens, options, save/reload, contract limits, threaded loading and the
3D controller. A Web-target PCK was also exported successfully.

**Validation boundary:** the full HTML/WASM website and hardware-rendered desktop visuals
were not tested in this sandbox. Matching Web export templates are not included. Follow
Section 5 to export and verify the actual website in your target browsers before publishing.
See `tests/TEST_REPORT.md` for the exact checks and commands.

## Rights and publication

The original fan-work disclaimer is preserved. Non-commercial status does **not** itself
grant permission to distribute Wizards of the Coast content. Confirm the applicable
permissions/licenses for names, rule excerpts, artwork, music and later purchased assets
before public distribution. See `THIRD_PARTY.md` and the included license notices.
