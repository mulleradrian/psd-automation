# P10 Templater (Photoshop UXP)

Templater-style panel: **each dataset row = one variant**. Cycle with ◀ ▶, Apply updates the open document.

## What it does (plain English)

| Control | Meaning |
|--------|---------|
| **Repo folder…** | Optional — `psd-automation` repo for templates, layout Save, export |
| **Pull Content_DB** | Load live rows from Google Sheet (no repo needed) |
| **◀ ▶** | Previous / next variant row |
| **Apply this row** | Open that row’s ratio template, show the chosen BG (`9`–`12`), set headline + sub |
| **Apply → Next** | Apply, then advance |
| **Export JPG** | Apply + save under `fixtures/templater/exports/<ratio>/` |
| **Render all rows** | Batch every test variant |

No handshake queue. No JSON job dump in your face.

## First-time setup

```bash
# 1) Build the test dataset (64 rows: 4 ratios × 4 BGs × 4 copy variants)
node scripts/generate-templater-dataset.mjs

# 2) In Photoshop, File → Scripts → Browse…
#    scripts/prepare-templater-templates.jsx
#    (builds fixtures/templater/templates/tpl_{4x5,1x1,9x16,16x9}.psd
#     from fixtures/workingsets/1.1.26/*/p10test*.psd)
```

## Load the panel

1. UXP Developer Tool → **Add Plugin** → `packages/uxp-plugin`
2. Photoshop → Plugins → **P10 Templater**
3. **Pull Content_DB** (sheet must be shared Viewer). Open a ratio PSD, or set **Repo folder…** to auto-open templates.
4. Cycle rows → **Apply**

## Test matrix

| Ratio | Source PSD | Template out |
|------|------------|--------------|
| 4:5 | `workingsets/1.1.26/4x5_1.1.26/p10test.psd` | `templater/templates/tpl_4x5.psd` |
| 1:1 | `…/1x1_1.1.26/p10test_1x1.psd` | `tpl_1x1.psd` |
| 9:16 | `…/9x16_1.1.26/p10test_9x16.psd` | `tpl_9x16.psd` |
| 16:9 | `…/16x9_1.1.26/p10test_16x9.psd` | `tpl_16x9.psd` |

Each ratio × BG `9|10|11|12` × copy variants:

- `peace` — “Unlock the peace you deserve”
- `morning` — “Morning light awaits”
- `calm` — “Find calm in every stay”
- `neighbourhood` — “The neighbourhood knows” / “Find calm here.”

Dataset: `fixtures/templater/dataset.json`

## Live Google Sheet (Hotel 1 hybrid)

1. Edit **Hotel 1** on the live calendar → Sheets menu **PSD Automation → Sync Hotel 1 → Content_DB**
2. Panel → **Pull Content_DB** (Link optional — defaults to live calendar)
3. Share the sheet: **Anyone with the link → Viewer** (required for gviz CSV)
4. **Open Hotel 1** uses `#gid=690745977`
5. **Layers** / **Save**: set **Repo folder…** once if you need layout JSON + template open

Sheet link + last pull cache live in the plugin data folder (no repo required).  
Optional repo mirror: `fixtures/templater/sheet-link.json`  
Operator guide: `docs/operator-guide.md`  
Fixture seed CSV: `fixtures/sheets/Content_DB.csv`

