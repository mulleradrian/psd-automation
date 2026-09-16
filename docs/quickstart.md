# Quick start — Windows & Mac

Get from install to first Apply without typing terminal commands.

## Get the project

1. Clone or download: https://github.com/mulleradrian/psd-automation  
2. If cloning, Git LFS is required for Photoshop templates (`*.psd`). Install [Git LFS](https://git-lfs.com), then:

   ```bash
   git lfs install
   git clone https://github.com/mulleradrian/psd-automation.git
   ```

   (Or use GitHub Desktop → Clone — it handles LFS for you.)

## One-click setup

| | Windows | Mac |
|---|---------|-----|
| Install | Double-click **`setup.bat`** | Double-click **`setup.command`** |
| Open apps | Double-click **`open-photoshop.bat`** | Double-click **`open-photoshop.command`** |

**Mac:** first time Finder may block the `.command` file → **right-click → Open → Open**.

`setup` runs `npm install`, builds packages, creates `.env.local`, and generates the templater dataset.

## Load the Photoshop panel (one-time)

1. Run **open-photoshop** (table above). Plugin path is copied to the clipboard.
2. **UXP Developer Tools** → Developer Mode → **Add Plugin** → paste/select `packages/uxp-plugin` → **Load / Watch**.
3. Photoshop → **Plugins → P10 Templater**.
4. Panel → **Repo folder…** → choose the repo root (folder with `setup.bat` / `setup.command`).
5. **Pull Content_DB** → **Apply this row**.

## Daily operator loop

See [operator-guide.md](./operator-guide.md). Short version:

1. Edit **Hotel 1** on the live calendar.  
2. Sheet menu **PSD Automation → Sync Hotel 1 → Content_DB**.  
3. Panel → **Pull Content_DB** → Apply.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Setup says Node is missing | Install [Node.js LTS](https://nodejs.org/en/download), re-run setup |
| Mac won’t open `.command` | Right-click → Open → Open |
| UXP / Photoshop not found | Install from Creative Cloud; apps must live under Program Files (Windows) or `/Applications` (Mac) |
| Apply: template missing | Photoshop → File → Scripts → Browse → `scripts/prepare-templater-templates.jsx` |
| Pull Content_DB empty | Share sheet **Anyone with the link → Viewer**; run Sync from Sheets menu first |
| Clone missing `.psd` files | `git lfs install` then `git lfs pull` |

Full README: [../README.md](../README.md).
