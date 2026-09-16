# WorkingSet inventory — Hotel 1 / Q1_W1_01 / folder 1.1.26

**Drive folder:** https://drive.google.com/drive/folders/1IjyC-xQ1-1ctnDCE2TGUzJJsl0Xs-JPG  
**Observed (2026-09-13):** Parent folder shared; ratio subfolders exist and are writable; file contents inside ratio folders were empty/unshared from the automation account.

## Expected layout (full working set)

```
1.1.26/
  hero.jpg                 # slot/hero source
  bg.jpg                   # slot/bg source
  logo.png                 # optional override; else BrandKit logo
  Q1_W1_01_working.psd     # working PSD after render
  4x5_1.1.26/              # local exports (Windows-safe; Drive may show 4:5_…)
  1x1_1.1.26/
  9x16_1.1.26/
  16x9_1.1.26/
```

## Schema gap list (until first PSD is shared)

| Layer | Status | Notes |
|-------|--------|-------|
| `txt/headline` | required | Map from Content_DB.Title |
| `txt/sub` | recommended | Map from Copy |
| `txt/copy_zh` | recommended | Red Book / ZH |
| `clr/accent` | recommended | BrandKit color.accent |
| `clr/bg` | recommended | BrandKit color.bg |
| `slot/hero` | recommended | Must be smart object |
| `slot/bg` | recommended | Must be smart object; cover fit |
| `slot/logo` | recommended | BrandKit logo |
| `lock/*` | optional | Never edited |

## Local fixture mirror

`fixtures/workingsets/1.1.26/` mirrors this layout for dry-run CLI tests.
