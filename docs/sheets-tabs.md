# Machine-readable Sheet tabs

Human calendars (`Hotel 1`, `Tsuen Wan Perfect 10`, `Singapore Perfect 10`, `Overall`) stay as the **human input surface**. Automation reads machine tabs only.

**Hybrid flow:** Edit Hotel 1 → **PSD Automation → Sync Hotel 1 → Content_DB** → UXP/orchestrator Pull from `Content_DB`.

See [hotel1-column-map.md](./hotel1-column-map.md) and [operator-guide.md](./operator-guide.md).

| Tab | Purpose |
|-----|---------|
| `Content_DB` | One row per ContentItem (synced from Hotel 1) |
| `Brand_Kits` | Colors, fonts, logos per Property |
| `Templates` | Master PSD paths / Drive IDs per ratio |
| `Layer_Bindings` | field → layer → kind |
| `Jobs` | Append-only render queue |

## Install into the live spreadsheet

1. Open [Social Media Content Calendar](https://docs.google.com/spreadsheets/d/1OqyooDCwGJfvtC6QIW18Q2rSvmvfzF_jSWVncoh7dMQ/edit).
2. **Extensions → Apps Script**, paste [`sheets/Code.gs`](../sheets/Code.gs), save.
3. Reload the sheet → **PSD Automation → Ensure machine tabs**.
4. **Sync Hotel 1 → Content_DB** after editing calendar content.
5. Optionally **Seed sample Q1_W1_01**.
6. Or copy CSV fixtures from `fixtures/sheets/*.csv` into the new tabs.

A seed companion sheet (Content_DB only) was also created for reference:

https://docs.google.com/spreadsheets/d/1ZZTSega50Hc4lf77Q8dTVKstXP6IjX0NrU5DmtiYh80/edit

**Full machine-tabs workbook (all 5 tabs, seeded):**  
https://docs.google.com/spreadsheets/d/1t3BEqm3hnGz2qOqrdqwLUOiwP97NDRxhPOXIM_mMzAs/edit

**Apps Script ready to paste:**  
https://docs.google.com/document/d/159iYJik__RuzpNt8XMdLNMRWoywUv9g9rhtWCx9vkcI/edit

See [next-steps-completed.md](./next-steps-completed.md) for what was uploaded to Drive / WorkingSet.

**Never** parse merged calendar cells in code — only structured column sync.

## Ratio folder naming

- Drive web sample uses `4:5_1.1.26`.
- Windows local paths cannot contain `:`. The orchestrator writes `4x5_1.1.26`.
- Map Drive folder names ↔ local sanitized names in the WorkingSet sync layer when needed.

## Local fixtures

`fixtures/sheets/` mirrors the five tabs for offline CLI/tests (Hotel 1–shaped Title/Copy samples). Set:

```bash
npm run render -- --id Q1_W1_01 --dry-run
```
