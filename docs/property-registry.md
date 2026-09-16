# Property registry (layer × property)

UXP panel v1 bindable properties by layer kind. Bound values can live in:

- Row `props` on `dataset.json` (per variant)
- `Layer_Bindings` sheet rows (`Template_ID`, `layer_name`, `kind`, `field`)
- Future: `Layer_Props` JSON column on Content_DB

| Kind | Properties |
|------|------------|
| text | contents, font, sizePx, leading, color, alignment |
| color / solid | hex, opacity |
| smart / slot | file (replace), opacity |
| lock / any | opacity, visible, bounds (x,y,w,h), fxScale |

## Lock vs editable

- **Locked across ratio** (default for layout-ish props: bounds, size of ten/accents): stored on `{ratioKey}.json`
- **Editable per variant**: stored on `variants/{contentId}_{ratioKey}.json` or row `props`

Anything not explicitly overridden inherits the ratio baseline.

See also: `docs/layout-schema.md`, `packages/shared/src/layout-merge.ts` (`PROPERTY_REGISTRY`).
