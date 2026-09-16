# p10test WorkingSet notes (2026-09-13)

## Source
- Drive 4:5 folder: https://drive.google.com/drive/folders/1iqJGEj2evHmhk1O3wol_axRIptp85nk7
- Original: `p10test.psd` (1080×1350, Drive ID `1xY8eR34iG6FrLLMDwg2hBuf-rM1EzIq6`)

## Local copies (schema-enhanced + ratio variants)
| File | Size | Ratio |
|------|------|-------|
| `fixtures/templates/p10test/p10test.psd` | master + schema layers | 4:5 |
| `p10test_4x5.psd` | normalized 1080×1350 | 4:5 |
| `p10test_1x1.psd` | 1080×1080 | 1:1 |
| `p10test_9x16.psd` | 1080×1920 | 9:16 |
| `p10test_16x9.psd` | 1920×1080 | 16:9 |

Also copied into `fixtures/workingsets/1.1.26/{1x1,4x5,9x16,16x9}_1.1.26/`.

## Schema layers added for automation
`txt/headline`, `txt/sub`, `txt/cta`, `clr/accent`, `slot/hero`, `slot/logo`  
Lint: **PASS**

## Drive upload status
MCP cannot upload/download files >10MB; resized variants are 2.5–4.5MB each but base64 payload is too large for the tool channel.
**Action:** drag the four `p10test_*.psd` files from Explorer into the matching Drive ratio folders:
- [1:1](https://drive.google.com/drive/folders/1-JVyf5wQQYgOQTQ2Whkh55wQgQNZWwMy)
- [4:5](https://drive.google.com/drive/folders/1iqJGEj2evHmhk1O3wol_axRIptp85nk7)
- [9:16](https://drive.google.com/drive/folders/18BGJkgTXWJbMI78hGniOqvBwXvyYxr6-)
- [16:9](https://drive.google.com/drive/folders/1oGuqszvIwxVDmGYfD9mplAyGTHgS558d)

## Automation test
- JobSpec queued for `Q1_W1_01` → template `fixtures/templates/p10test/p10test.psd`
- Applied via `scripts/apply-jobspec.jsx` (setText / setFill / setFont)
- Export: `fixtures/workingsets/1.1.26/4x5_1.1.26/Q1_W1_01_4x5.jpg` (~370KB)
- Working PSD: `fixtures/workingsets/1.1.26/Q1_W1_01_working.psd`

## Scripts
- `scripts/resize-p10test-ratios.jsx`
- `scripts/add-p10test-schema-layers.jsx`
- `scripts/apply-jobspec.jsx` / `apply-jobspec-1x1.jsx`
