# Templater layout file contract

## Ratio baseline

Path: `fixtures/templater/layouts/{ratioKey}.json`  
Examples: `4x5.json`, `1x1.json`, `9x16.json`, `16x9.json`

Shared by all dataset rows with that `ratioKey` unless a variant override exists.

```json
{
  "ratioKey": "4x5",
  "canvas": { "w": 1080, "h": 1350 },
  "source": { "ratioKey": "4x5", "w": 1080, "h": 1350 },
  "updatedAt": "ISO-8601",
  "layers": {
    "slot/ten": {
      "left": 40, "top": 40, "width": 900, "height": 700,
      "leftFrac": 0.037, "topFrac": 0.03, "rightFrac": 0.13, "bottomFrac": 0.45,
      "widthFrac": 0.83, "heightFrac": 0.52,
      "locked": true,
      "smart": true,
      "visible": true,
      "fontSize": null,
      "props": {}
    }
  }
}
```

**Apply rule:** Prefer edge fracs (`leftFrac`…`bottomFrac` → `targetBoxFromFracs`) over absolute px so positions survive canvas size differences.

## Variant overrides (sparse)

Path: `fixtures/templater/layouts/variants/{contentId}_{ratioKey}.json`

Only stores layers/props that differ from the ratio baseline.

```json
{
  "contentId": "Q1_W1_01",
  "ratioKey": "4x5",
  "updatedAt": "ISO-8601",
  "layers": {
    "txt/headline": {
      "leftFrac": 0.1, "topFrac": 0.73, "rightFrac": 0.06, "bottomFrac": 0.12,
      "locked": false,
      "props": { "sizePx": 84 }
    }
  }
}
```

## Merge order on Apply

1. Ratio baseline layers  
2. Variant overrides (sparse merge by layer name)  
3. Row `props` from dataset / panel (contents, etc.)  
4. Autofit type placement for unlocked text  
5. Locked layers snapped via fracs  

## Propagate scopes

| Scope | Writes |
|-------|--------|
| This variant | `variants/{contentId}_{ratioKey}.json` (+ row props) |
| This Content_ID | All variant files for that contentId |
| This ratio | `{ratioKey}.json` baseline |
| All linked | All ratio baselines + all variant overrides in dataset |

Default: layout geometry → **This ratio**; content text → **This variant**.
