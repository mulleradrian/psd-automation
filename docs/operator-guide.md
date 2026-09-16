# Operator guide — Perfect Ten hybrid flow

## First-time machine setup

Follow [quickstart.md](./quickstart.md) (Windows: `setup.bat` / `open-photoshop.bat`; Mac: `setup.command` / `open-photoshop.command`).

You need Node.js LTS, Photoshop 2023+, and Adobe UXP Developer Tools. No manual `npm` commands required if you use the launchers.

## Human input surface

Edit **Hotel 1** on the live calendar (gid `690745977`): Title, Copy, Preview, BG, dates.

Do **not** expect the panel to scrape merged decorative calendar cells.

## Sync → Pull → Apply

1. Sheets → **PSD Automation → Ensure machine tabs** (once).
2. **PSD Automation → Sync Hotel 1 → Content_DB**.
3. Photoshop UXP panel → **Pull Content_DB** (optional: **Repo folder…** for templates/layouts).
4. **Apply row** / cycle variants. Open a PSD manually if no repo folder.
5. Nudge / bind props → **Save** with scope (needs **Repo folder…**):
   - **This ratio** — shared geometry for all variants of that aspect
   - **This variant** — sparse override file under `layouts/variants/`
   - **This Content_ID** — all ratios for that content
   - **All linked** — updates current ratio baseline

## Status fields

`Status`, `Preview_URL`, `Render_Error`, and Jobs live only on machine tabs. Sync preserves existing Status/Preview when Hotel 1 leaves them blank.

## Preview images

Embedded Preview images in Hotel 1 do not become URLs automatically. Leave `Preview_URL` empty or paste a Drive link. Optional later: export Preview → Drive.

## E2E smoke checklist

See [e2e-smoke-checklist.md](./e2e-smoke-checklist.md).

## Key docs

- [quickstart.md](./quickstart.md)
- [hotel1-column-map.md](./hotel1-column-map.md)
- [layout-schema.md](./layout-schema.md)
- [property-registry.md](./property-registry.md)
- [sheets-tabs.md](./sheets-tabs.md)
