# QA checklist

## Schema

- [ ] `psd-lint` passes on every Template_ID in `Templates`
- [ ] `slot/*` layers are smart objects
- [ ] `txt/headline` is paragraph text
- [ ] BrandKit fonts installed locally (PostScript names match)

## Sample render — Q1_W1_01

- [ ] Dry-run creates files under `fixtures/workingsets/1.1.26/4x5_1.1.26/`
- [ ] UXP render: headline matches Title
- [ ] Accent color matches BrandKit
- [ ] Hero smart object replaced from `hero.jpg`
- [ ] Working PSD saved as `Q1_W1_01_working.psd`
- [ ] Jobs row ends `Rendered`; Preview_URL set
- [ ] Failure path: missing font → `font_missing`; long copy → `text_overflow`

## Ratio fan-out

- [ ] `4:5` and `1:1` both export for sample Ratios
- [ ] `9:16` / `16:9` when templates exist

## Multi-property

- [ ] `tsuen_wan` / `singapore` BrandKits produce different accent colors
- [ ] `Copy_ZH` binds to `txt/copy_zh` for Red Book

## Dual-run (Wave 6)

- [ ] Same JobSpec through UXP and `ps-api`
- [ ] Report written to `jobs/done/<id>.dual-run.json`
- [ ] Font gaps documented before switching default worker
