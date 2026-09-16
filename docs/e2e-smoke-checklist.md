# E2E smoke checklist

Run after Hotel 1 / panel / layout changes.

## Sheets

- [ ] Live calendar opens; Hotel 1 tab visible (`gid=690745977`)
- [ ] Apps Script pasted from `sheets/Code.gs`; menu **PSD Automation** present
- [ ] **Ensure machine tabs** creates Content_DB + Jobs + …
- [ ] Edit a Title on Hotel 1 → **Sync Hotel 1 → Content_DB** → row upserts by Content_ID
- [ ] Missing Title+Copy rows are skipped; alert shows counts

## Panel

- [ ] Set project → status shows linked live calendar (or paste ID)
- [ ] **Open Hotel 1** deep-links with `#gid=690745977`
- [ ] **Pull Content_DB** expands Ratios into dataset rows
- [ ] Apply shows Title/Copy in `txt/headline` as one box with `\r` breaks
- [ ] **Scan template** lists all non-group layers; filters All / Editable / Bound / Locked work
- [ ] Bind prop adds property fields; **Save** applies props to the open document
- [ ] Nudge unlocked layer; ratio-lock toggle works

## Layout scopes

- [ ] Nudge on 4:5 → **Save** · **This ratio** → jump another 4:5 variant → Apply → position matches
- [ ] **Save** · **This variant** → other Content_IDs on same ratio unchanged
- [ ] Checked layers → **Save** writes only those; sheet ticks push bindings
- [ ] Locked layers apply via edge fracs (not absolute-only); text locked = translate + size, no scale crush

## Autofit

- [ ] Long word (“neighbourhood”) does not clip right edge
- [ ] 3-line blocks respect bottom clearance
- [ ] 9:16 has bottom margin; type does not sit under fold without shrink
- [ ] If type would collide with ten, size shrinks or allowOverlap is noted in status

## Export

- [ ] Export JPG writes under `fixtures/templater/exports/`
- [ ] Optional: Render all rows completes without modal hang
