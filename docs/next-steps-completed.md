# Next steps — done for you

Completed on 2026-09-13.

## Spreadsheet / machine tabs

| Item | Link |
|------|------|
| **Full machine-tabs workbook** (Content_DB, Brand_Kits, Templates, Layer_Bindings, Jobs) | https://docs.google.com/spreadsheets/d/1t3BEqm3hnGz2qOqrdqwLUOiwP97NDRxhPOXIM_mMzAs/edit |
| **Apps Script source** (paste into live calendar) | https://docs.google.com/document/d/159iYJik__RuzpNt8XMdLNMRWoywUv9g9rhtWCx9vkcI/edit |
| Live calendar (existing) | https://docs.google.com/spreadsheets/d/1OqyooDCwGJfvtC6QIW18Q2rSvmvfzF_jSWVncoh7dMQ/edit |

**Still one click on your side for the live calendar:** open the Apps Script doc → copy all → live sheet **Extensions → Apps Script** → paste → Save → reload → **PSD Automation → Ensure machine tabs**. Google does not allow attaching Apps Script to someone else’s spreadsheet via API from this account.

You can also use the machine-tabs workbook as the automation source of truth (`PSD_SHEET_ID=1t3BEqm3hnGz2qOqrdqwLUOiwP97NDRxhPOXIM_mMzAs`).

## WorkingSet `1.1.26`

Uploaded into https://drive.google.com/drive/folders/1IjyC-xQ1-1ctnDCE2TGUzJJsl0Xs-JPG :

- `hero.jpg`, `bg.jpg`, `logo.png` (placeholders)
- `tpl_ig_4x5_schema.psd` (schema layers: `txt/headline`, `clr/accent`, `slot/hero`) — Drive ID `1VmzefS8KOcpRDk2HbOE3cnnSjCfhSw17`
- `README_AUTOMATION` doc
- reference PSD copy (not schema)

Templates library folder: https://drive.google.com/drive/folders/1nr8lXdYLvsqWE43nQwIcEH1Ad9RFkWDB

## Photoshop / UXP

- Plugin junction installed at: `%APPDATA%\Adobe\UXP\Plugins\External\com.psdautomation.renderer` → repo `packages/uxp-plugin`
- Launched **UXP Developer Tools** and **Photoshop 2026**
- Helper script: `scripts/open-uxp-and-photoshop.ps1`

**Still one click on your side:** In UXP Developer Tools → enable Developer Mode → **Add Plugin** → select `packages/uxp-plugin` → Load against Photoshop → in the panel **Browse** to `jobs/handshake`.

(Adobe does not expose a reliable headless “Add Plugin” API; the External junction helps but Dev Tools load is still required once.)

## Verified

- Schema lint PASS on `tpl_ig_4x5_minimal.psd`
- Dry-run render of `Q1_W1_01` → `4x5` + `1x1` exports

## After plugin is loaded

```powershell
npm run render -- --id Q1_W1_01
# Photoshop open, panel watching jobs/handshake
```
