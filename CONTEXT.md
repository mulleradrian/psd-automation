# PSD Calendar Automation

Domain language for sheet-driven Photoshop renders of hotel social stills.

## Language

**Property**:
A hotel or market brand identity (Hotel 1, Tsuen Wan, Singapore).
_Avoid_: Client, account, brand (use BrandKit for tokens)

**ContentItem**:
One social post keyed by `Content_ID` (e.g. `Q1_W1_01`).
_Avoid_: Row, job, calendar entry

**Variant**:
One output of a ContentItem for a platform + aspect ratio (IG 4:5, TikTok 9:16).
_Avoid_: Export, size, format

**Template**:
A master PSD that conforms to the layer schema and is copied into a WorkingSet per job.
_Avoid_: Working PSD, mockup, file

**LayerBinding**:
A mapping from a sheet field to a PSD layer name and edit kind.
_Avoid_: Mapping, field map

**AssetSlot**:
A named smart-object layer that accepts photo or graphic swaps (`slot/hero`, `slot/bg`, `slot/logo`).
_Avoid_: Placeholder, image layer

**WorkingSet**:
The Drive folder for one ContentItem: sources, working PSD, and ratio export subfolders.
_Avoid_: Template folder, material link (UI label only)

**JobSpec**:
The JSON contract the orchestrator hands a worker (UXP or Photoshop API).
_Avoid_: Job, render request (those are queue rows)

**BrandKit**:
Hex colors, PostScript font names, logo files, and default templates for one Property.
_Avoid_: Theme, style guide

**Job**:
An append-only queue row that tracks render status for a ContentItem (or Variant fan-out child).
_Avoid_: ContentItem, calendar row
