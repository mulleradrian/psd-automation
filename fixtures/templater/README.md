# Templater fixtures

## Layout engine (aspect ratios)

Master: `fixtures/templater/templates/tpl_4x5.psd`

1. Graphic placeholders (`slot/*`, `lock/*`, BG plates) are converted to **Smart Objects**
2. Each layer’s **edge-margin ratios** (left/right/top/bottom ÷ canvas) are captured
3. Variants remap every layer onto the new canvas so spacing ratios to borders match the master
4. Per-ratio lock files: `fixtures/templater/layouts/{4x5,1x1,9x16,16x9}.json`

| File | Size | How |
|------|------|-----|
| `templates/tpl_4x5.psd` | 1080×1350 | Master (smartified) |
| `templates/tpl_1x1.psd` | 1080×1080 | Edge-ratio remap from 4:5 |
| `templates/tpl_9x16.psd` | 1080×1920 | Edge-ratio remap from 4:5 |
| `templates/tpl_16x9.psd` | 1920×1080 | Edge-ratio remap from 4:5 |

Rebuild:
```
Photoshop → Scripts → scripts/rebuild-ratio-templates-from-4x5.jsx
```

Smoke checks:
```
scripts/smoke-templater-ratios.jsx
scripts/smoke-templater-apply.jsx
```

Panel: **Layout nudge** — pick layer (or PS sel) → ←→↑↓ / Sz± → **Toggle lock** → **Save**.

## Dataset
`dataset.json` — 64 rows (4 ratios × 4 BGs × 4 copy variants)

## Layer schema (from panel Scan)
- `layer-schema.json` — scanned layers + editable flags
- `Editable_Layers.csv` — exported editable props
- Also merges into `fixtures/sheets/Layer_Bindings.csv`

## Panel features
- **Auto** — apply on ◀▶ / Jump
- **AutoFit** — ≤3 lines + shrink font
- **Scan layers** — discover txt/clr/slot/lock/bg
- **Editable props** — text / color / opacity / visibility / fxScale
- **Layout nudge** — position/size + lock/save per ratio
- **Add to sheet** — write bindings CSV
