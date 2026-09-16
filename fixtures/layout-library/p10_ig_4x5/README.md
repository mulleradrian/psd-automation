# Perfect Ten IG 4:5 — layout library

Rebuilt from `p10test.psd` so variants are **exclusive**, not stacked.

## What was wrong
The master PSD had every BG image, every graphic, and every logo colorway visible at once. Schema text was also dumped on top without a text zone, so everything read as one muddy overlay.

## Rules
1. **BG IMAGES** — show exactly one of `9` / `10` / `11` / `12`
2. **P10 COLORS** — show exactly one logo colorway (this SO already has the **10** + **PerfectTen** wordmark)
3. **BG GRAPHICS** — off by default (optional wash only)
4. **Text** — `txt/headline`, `txt/sub`, `txt/cta` centered in the lower mid, above PerfectTen

## Baseline (Hotel 1 / Q1_W1_01)
File: `Q1_W1_01_baseline.jpg`

| Slot | Value |
|------|--------|
| BG | `12` (lobby conversation) |
| Logo | `Perfect-Ten-Logo-light-blue` |
| Graphic | none |
| Headline | Unlock the peace / you deserve |
| Sub | Find calm in every stay. |
| CTA | Book now |

Recipe: `fixtures/layouts/p10_ig_4x5.json`  
Working template: `fixtures/templates/p10test/tpl_p10_ig_4x5_library.psd`  
Rebuild: Photoshop COM → `scripts/build-layout-library.jsx`

## Variation exports
| File | What changes |
|------|----------------|
| `var_bg_9/10/11.jpg` | Photo only |
| `var_logo_darkgreen.jpg` | Dark green 10 + wordmark |
| `var_logo_vitality.jpg` | Vitality green colorway |
| `var_gfx_*_wash.jpg` | Optional graphic wash on |
| `var_copy_*.jpg` | Headline / sub / CTA copy |
| `var_combo_bg9_vitality.jpg` | Photo + colorway + copy |

## Note on sheet Preview
The Hotel 1 **Preview** cell is an embedded image (not exported as a URL by Drive text APIs). This baseline matches the row’s Title/Copy against the Perfect Ten template system. If the Preview uses a different BG index or colorway, say which and we’ll lock that as the canonical baseline.
