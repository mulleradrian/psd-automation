# PSD Automation

Google Sheets content calendar → Photoshop template stills for hotel social (text, colors, fonts, background/hero swaps).

**Engine:** Photoshop desktop UXP panel (primary). Adobe Photoshop API later behind the same `JobSpec`.  
**Source sheet:** [Social Media Content Calendar Template](https://docs.google.com/spreadsheets/d/1OqyooDCwGJfvtC6QIW18Q2rSvmvfzF_jSWVncoh7dMQ/edit)

---

## Quick start (no terminal required)

Works on **Windows** and **Mac** — use the matching double-click launcher below.

### What you need

| App | Notes |
|-----|--------|
| **Node.js LTS** | Only if setup says it is missing — install from [nodejs.org](https://nodejs.org/en/download), defaults are fine |
| **Adobe Photoshop** | 2023 or newer |
| **Adobe UXP Developer Tools** | From Creative Cloud (free companion for loading panels) |
| **This repo folder** | Cloned or downloaded from GitHub |

### Launchers

| Step | Windows | Mac |
|------|---------|-----|
| Install / build | Double-click **`setup.bat`** | Double-click **`setup.command`** |
| Open Photoshop + panel | Double-click **`open-photoshop.bat`** | Double-click **`open-photoshop.command`** |

**Mac tip:** If Finder says the file can’t be opened, **right-click → Open → Open** once (Gatekeeper). After that, normal double-click works.

### 1) One-click install

1. Open this project folder in File Explorer (Windows) or Finder (Mac).
2. Double-click **`setup.bat`** (Windows) or **`setup.command`** (Mac).
3. Wait until it says **Setup complete** (first run may take a few minutes).
4. Press a key / Enter to close the window.

That installs packages, builds the project, creates `.env.local`, and generates the templater test dataset.

### 2) Open Photoshop + load the panel

1. Double-click **`open-photoshop.bat`** (Windows) or **`open-photoshop.command`** (Mac).
2. Photoshop and UXP Developer Tools open.
3. The plugin folder path is **copied to your clipboard**.
4. In **UXP Developer Tools**:
   - Turn on **Developer Mode** (gear).
   - **Add Plugin** → paste / select the clipboard path (`…/packages/uxp-plugin`).
   - **Load** / **Watch** against Photoshop.
5. In Photoshop: **Plugins → P10 Templater**.
6. In the panel, click **Repo folder…** and choose this project folder (the folder that contains `setup.bat` / `setup.command`).
7. Click **Pull Content_DB**, pick a row, then **Apply this row**.

You should see headline/copy and background updates on the open template.

### 3) Day-to-day use (Sheets → Photoshop)

1. Edit **Hotel 1** on the [live calendar](https://docs.google.com/spreadsheets/d/1OqyooDCwGJfvtC6QIW18Q2rSvmvfzF_jSWVncoh7dMQ/edit#gid=690745977) (Title, Copy, Preview, BG, dates).
2. In the sheet menu: **PSD Automation → Sync Hotel 1 → Content_DB**  
   (First time only: **PSD Automation → Ensure machine tabs**.)
3. In the Photoshop panel: **Pull Content_DB** → cycle rows with ◀ ▶ → **Apply**.
4. Optional: nudge layers → **Save** (needs **Repo folder…** set) to write layout JSON.

**Sheet sharing:** the panel reads Content_DB via CSV export — share the spreadsheet as **Anyone with the link → Viewer** (or grant Viewer to your account).

More detail: [docs/quickstart.md](docs/quickstart.md) · [docs/operator-guide.md](docs/operator-guide.md).

---

## Clone note (templates via Git LFS)

Photoshop fixtures are stored with **Git LFS**. After clone, if `.psd` files are tiny pointer files, run `git lfs pull`. [GitHub Desktop](https://desktop.github.com/) clones LFS assets automatically.

---

## Google Sheets menu (one-time, ~2 minutes)

If the spreadsheet does not show **PSD Automation** in the menu:

1. Open the [live calendar](https://docs.google.com/spreadsheets/d/1OqyooDCwGJfvtC6QIW18Q2rSvmvfzF_jSWVncoh7dMQ/edit).
2. **Extensions → Apps Script**.
3. Delete any placeholder code; open `sheets/Code.gs` from this repo in Notepad / VS Code; copy all; paste into Apps Script; **Save**.
4. Reload the spreadsheet. Approve permissions when prompted.
5. Run **PSD Automation → Ensure machine tabs** once.

---

## First-time Photoshop templates (if Apply says a template is missing)

Templates live under `fixtures/templater/templates/`. If they are missing after clone:

1. Open Photoshop.
2. **File → Scripts → Browse…**
3. Choose `scripts/prepare-templater-templates.jsx` from this repo.
4. Let it build `tpl_4x5`, `tpl_1x1`, `tpl_9x16`, `tpl_16x9`.

(Requires the working-set PSDs under `fixtures/workingsets/1.1.26/`.)

---

## Verify install (optional)

Double-click **`setup.bat`** / **`setup.command`** again anytime — it is safe to re-run.

If you prefer a terminal check:

```bash
npm test
npm run lint-schema -- --names txt/headline,clr/accent,slot/hero
npm run render -- --id Q1_W1_01 --dry-run
```

---

## Packages

| Package | Role |
|---------|------|
| `@psd-automation/shared` | Layer schema, JobSpec zod types, JobSpec builder |
| `@psd-automation/schema-linter` | `psd-lint` — PSD / layer-name schema gate |
| `@psd-automation/orchestrator` | `psd-render` CLI — queue, JobSpec, dry-run / UXP handshake |
| `packages/uxp-plugin` | Photoshop panel (**P10 Templater**) |
| `@psd-automation/tray` | Polls queue / signals UXP |
| `@psd-automation/ps-api-worker` | Cloud worker + dual-run diff |
| `sheets/Code.gs` | Spreadsheet menu (queue / sync) |

## Docs

| Doc | Audience |
|-----|----------|
| [docs/quickstart.md](docs/quickstart.md) | First install (Windows + Mac) |
| [docs/operator-guide.md](docs/operator-guide.md) | Daily Sheets → panel flow |
| [docs/designer-guide.md](docs/designer-guide.md) | Automation-ready PSD layer schema |
| [docs/e2e-smoke-checklist.md](docs/e2e-smoke-checklist.md) | Smoke test after changes |
| [CONTEXT.md](CONTEXT.md) | Domain language (ContentItem, Variant, JobSpec, …) |
| [packages/uxp-plugin/README.md](packages/uxp-plugin/README.md) | Panel controls & test matrix |

## Domain

See [CONTEXT.md](CONTEXT.md). Do not call calendar rows “jobs” or Drive folders “templates.”

## License

UNLICENSED — internal tooling.
