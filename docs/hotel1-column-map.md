# Hotel 1 → Content_DB column map

Live calendar workbook: [Social Media Content Calendar](https://docs.google.com/spreadsheets/d/1OqyooDCwGJfvtC6QIW18Q2rSvmvfzF_jSWVncoh7dMQ/edit)  
Hotel 1 tab gid: `690745977`

## Hybrid flow (locked)

1. Humans edit **Hotel 1** (at least Title / headline text, plus Preview / BG / dates as available).
2. **PSD Automation → Sync Hotel 1 → Content_DB** copies structured columns into the machine tab.
3. UXP / orchestrator read **Content_DB** only (never scrape merged calendar decoration).

## Sync integrity policy

**Never invent content.** If Hotel 1 doesn’t have it, Content_DB gets blank (or a warning), not a guess.

| Field | Invented before (bad) | Now |
|-------|----------------------|-----|
| `Ratios` | `4:5,1:1,9:16,16:9` | Only Asset Description / ratio checkboxes; else blank |
| `Platforms` | `Instagram` | Pass-through only; else blank |
| `Status` | `Approved` | Pass-through only; else blank (preserve existing on update) |
| `Bg_File` | (panel used `9`) | Digits from Hotel only; else blank |
| `Property` | always `hotel_1` | Hotel column, or `hotel_1` only when syncing the Hotel 1 tab with no Property column |
| `Content_ID` | — | Hotel ID, or synthesized `H1_R{row}` (flagged in sync alert) |
| `Title` / `Copy` / dates / hashtags | — | Pass-through; row skipped if no Title/Copy |

Queue / Pull also refuse to invent ratios or BG.

## One PSD text box

The template has a **single** editable text layer (`txt/headline`).  

| Sheet field | Required? | What happens in Photoshop |
|-------------|-----------|---------------------------|
| **Title** | Yes (or an alias below) | Primary text in the one box |
| **Copy** | **No** | Optional second phrase; autofit merges it into the **same** box (extra lines). Not a second layer. |

Leave Copy blank if you only have one line of copy — that is the normal Perfect Ten case.

## Ratios integrity (critical)

Sync **must not** invent aspect ratios.

| Hotel 1 source | Content_DB result |
|----------------|-------------------|
| Asset Description selects `4:5` + `1:1` | **Two rows**: `{id}_4x5` with `Ratios=4:5`, `{id}_1x1` with `Ratios=1:1` |
| Checkbox columns `4:5` + `9:16` | Two forked rows |
| No selectable ratios found | One stub row, `Ratios` **blank** + warning |

**one row = one variant.** `Content_Group_ID` holds the Hotel base id so siblings stay linked.

Re-paste `sheets/Code.gs` after this fix and run Sync again.

## Column aliases → ContentItem

Hotel 1 headers vary by season. Sync matches **case-insensitive** aliases and scans the first ~8 rows for a header (banner rows above are OK):

| Content_DB field | Hotel 1 aliases (first match wins) | Notes |
|------------------|--------------------------------------|--------|
| `Content_ID` | Content_ID, Content ID, ID, Post ID, QW, Post# | If missing, synthesize `H1_R{row}` |
| `Property` | Property, Hotel, Brand | Default `hotel_1` |
| `Publish_Date` | Publish_Date, Publish Date, Date, Week, Go Live | |
| `Title` | Title, Headline, Hook, Post, Caption, Text, Message, Content, English… | **Required** for sync |
| `Copy` | Copy, Body, Sub, Subtitle, Subhead, Supporting | **Optional** |
| `Copy_ZH` | Copy_ZH, Copy ZH, 中文 | Optional |
| `Hashtags` | Hashtags, Tags | |
| `Platforms` | Platforms, Channel | Default `Instagram` |
| `Ratios` | Ratios, Ratio, Formats, Aspect, **Asset Description**, Assets, Sizes | **Only what Hotel 1 selected.** Sync never invents `4:5,1:1,9:16,16:9`. Also reads checkbox columns named `4:5` / `1:1` / … |
| `Hero_File` | Hero_File, Hero | |
| `Bg_File` | Bg_File, BG, Bg, Background, Plate, BG # | Prefer `9`–`12`; strip non-digits |
| `Status` | Status | Default `Approved` if empty |
| `Preview_URL` | Preview_URL, Preview Link, Preview | Only if cell is a URL |
| _(skip)_ | Preview (embedded image) | No stable URL from Sheets — leave blank |

## Sync errors

If Sync fails with “needs a Title column”, the alert lists the headers it actually saw. Rename your text column to one of the Title aliases (or add a `Title` header). **You do not need a Copy column.**

## Preview images

Hotel 1 **Preview** is often an embedded image. Leave `Preview_URL` blank or paste a Drive link.

## Verified headers (fill after sync test)

```
(pending live audit — paste header row after a successful Sync)
```
