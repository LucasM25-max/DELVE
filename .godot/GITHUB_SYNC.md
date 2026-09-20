# DELVE — GitHub ⇄ Godot sync guide (the easy version)

This is the plain-language routine for keeping **your Godot editor**, **the GitHub
repository** and **the zips I deliver** in sync. Nothing here requires command-line
confidence; the GUI route is listed first and the terminal route second.

The golden rule: **GitHub is the source of truth.** Your PC's copy and my zips are
travelling copies. Everything flows through the repository.

---

## 0. One-time setup (10 minutes)

### Option A — GitHub Desktop (recommended, no terminal)
1. Install **GitHub Desktop** from desktop.github.com and sign in with your GitHub account.
2. **File → Clone repository → URL** and paste `https://github.com/LucasM25-max/DELVE.git`.
   Choose a folder you will remember, e.g. `Documents\DELVE`.
3. Install **Godot 4.7.2 Standard** (not .NET) from godotengine.org.
4. In Godot: **Project → Import…** → browse to `Documents\DELVE\godot\project.godot` →
   **Import & Edit**. Let the first import finish (progress bar bottom-right).
5. Press **F5**. You should see the attribution screen → logo sting → DELVE menu.

### Option B — terminal
```bash
git clone https://github.com/LucasM25-max/DELVE.git
cd DELVE/godot
# open project.godot in Godot 4.7.2, let it import, press F5
```

---

## 1. Pulling updates FROM GitHub (e.g. after I deliver a new round)

1. **Close the Godot editor** (important — it holds file locks and caches).
2. GitHub Desktop: click **Fetch origin**, then **Pull origin** (blue button, toolbar).
   Terminal: `git pull` inside the `DELVE` folder.
3. Reopen Godot. If new assets arrived, Godot shows a re-import progress bar — let it finish.
4. F5 and play. Done.

> If GitHub Desktop says you have **local changes** that would be overwritten: either
> **Commit** them first (box on the left → "Commit to main" → push), or
> **Repository → Repository Settings… → discard**, depending on whether you want to keep them.

---

## 2. Merging one of my delivery zips

My zips contain the whole `godot/` folder **except** `.godot/` and **except** `addons/`
(Terrain3D, Sky3D and other plugin binaries stay yours — they live on your disk and in
GitHub, never in my zips).

1. Close Godot.
2. Open the zip. Copy the `godot/` folder **over** your `DELVE\godot\` folder and choose
   **Replace/merge files** when asked. Your `addons/` folder is untouched by this.
3. Reopen Godot → let it re-import → F5.
4. Push to GitHub (next section) so the round is safely stored.

---

## 3. Pushing your local project TO GitHub

### GitHub Desktop
1. Open the repository. The left panel lists every changed file.
2. Tick the files you want (or all). Type a message like `round 13: humanoid + docs`.
3. **Commit to main**, then **Push origin** (toolbar).
4. Check github.com/LucasM25-max/DELVE in the browser — your files should be there.

### Terminal
```bash
git add -A
git commit -m "round 13: humanoid + docs"
git push
```

### What NOT to push
- Never push `.godot/` (if it ever appears in the change list, untick it; add it to
  `.gitignore` if needed — the repository already ignores it).
- Never push engine binaries, export templates or web-export output folders.
- Big media is fine up to **100 MB per file** (GitHub limit); the character kit (~40 MB)
  is comfortably inside that.

---

## 4. Plugins you installed from the Asset Library (Terrain3D, Sky3D, …)

They live in `godot/addons/`. After a **pull** or a **zip merge** they remain on disk.
After any change:
1. Godot → **Project → Project Settings → Plugins** — confirm each plugin shows **Enable ☑**.
2. If a plugin vanished from the list: close Godot, check `addons/<name>/plugin.cfg` exists,
   reopen.

Remember: **Terrain3D does not support Web export yet** (experimental upstream). Desktop
builds are fully supported, including our Compatibility renderer. Sky3D works everywhere,
including web.

---

## 5. "It broke" troubleshooting

| Symptom | Fix |
| --- | --- |
| Godot shows missing-file errors after a pull | Close Godot, delete the `godot/.godot` folder, reopen (cache rebuilds). |
| Plugins missing from Plugins list | `addons/` folder not present — you merged a zip with "replace folder" instead of "merge"; restore `addons/` from GitHub (pull again). |
| Pull refused: "local changes" | Commit or stash your edits first (§1 note). |
| F5 opens the wrong scene | **Project → Project Settings → Application → Main Scene** = `scenes/ui/shell.tscn`. |
| Everything looks unstyled / fonts missing | Re-import: delete `.godot`, reopen. |
| Terrain3D menu items absent | Enable plugin (§4) and restart the editor once. |

---

## 6. The routine in one paragraph

Close Godot → pull (or merge my zip) → reopen Godot → let it import → F5 → play-test →
commit → push. That loop is the whole workflow. GitHub always ends up with the newest
working version, and any machine (yours, mine, a future collaborator's) can reproduce the
game exactly by cloning and pressing F5.
