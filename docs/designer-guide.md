# Designer guide — automation-ready PSDs

## Layer schema

| Prefix | Purpose | Examples |
|--------|---------|----------|
| `txt/` | Live text (paragraph text for variable copy) | `txt/headline`, `txt/sub`, `txt/cta`, `txt/copy_zh` |
| `clr/` | Solid / shape fills bound to BrandKit | `clr/bg`, `clr/accent`, `clr/bar` |
| `slot/` | **Smart objects only** for swaps | `slot/hero`, `slot/bg`, `slot/logo` |
| `lock/` | Never touched by automation | effects, ornaments |

## Rules

1. Required: `txt/headline` (paragraph text with a box).
2. Swappable photos must be smart objects named `slot/*`.
3. Fonts in Brand_Kits use **PostScript names** (Type → Font menu often shows a friendlier name).
4. One template per ratio: `tpl_ig_4x5`, `tpl_ig_1x1`, `tpl_story_9x16`, `tpl_cover_16x9`.
5. Keep masters lean — place large photos via slots, do not embed 4K stacks in the master.

## Validate

```bash
npm run lint-schema -- path\to\tpl_ig_4x5.psd
```

Exit 0 = automation-ready for the required layers. Recommended layers may still warn.

## Adding a template

1. Rename layers to schema.
2. Add a row to `Templates`.
3. Copy `Layer_Bindings` rows for that `Template_ID`.
4. Lint until green.
5. Point `Master_PSD_Path` (Drive-for-Desktop) or `Master_PSD_Drive_ID`.
