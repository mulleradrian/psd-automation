# 0001 — Local UXP first, Photoshop API later via shared JobSpec

## Context

We need high-fidelity Photoshop edits (live text, fonts, solid fills, smart-object swaps) driven by a Google Sheet content calendar. Designers already use Photoshop on Windows. Cloud rendering is desirable later but not required for v1.

## Decision

1. **Primary worker:** Photoshop desktop UXP plugin on the render PC.
2. **Contract:** A versioned `JobSpec` JSON is the only input to workers.
3. **Secondary worker (Wave 6):** Adobe Photoshop API (`/v2/create-composite` + `/v2/execute-actions`) consuming the same JobSpec.
4. **Orchestrator:** Node CLI/tray on Windows reads machine-readable Sheet tabs (or CSV fixtures) and writes JobSpecs; Apps Script queues Jobs rows and syncs structured Hotel calendar columns into `Content_DB`.

## Sheets hybrid (amended)

- Humans fill **Hotel 1** (and sibling hotel tabs) for Title / Copy / Preview / BG.
- **Sync Hotel 1 → Content_DB** copies structured columns only (see `docs/hotel1-column-map.md`).
- Workers and the UXP panel read **Content_DB** (and other machine tabs), not calendar decoration.
- **Parsing merged freeform calendar cells remains rejected** — too fragile.

## Alternatives considered

- Headless `ag-psd` / pure Node render — rejected for font/effect/smart-object fidelity.
- Photoshop API only — rejected for Wave 0–5 due to font packaging and designer feedback loop.
- Parsing merged Hotel calendar cells — rejected; too fragile.
- Reading Hotel 1 directly from UXP without Content_DB — rejected; machine tabs keep Jobs/bindings/status clean.

## Consequences

- Photoshop must be open for local renders.
- Sheets menu cannot render alone; tray watcher is mandatory for operator flow.
- Dual-run visual diffs are required before flipping the default worker to `ps-api`.
- Operators must run **Sync Hotel 1 → Content_DB** (or scheduled trigger) before Pull/Apply.
