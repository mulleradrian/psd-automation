/**
 * PSD layer schema v0 — automation-ready templates must expose these names.
 * Prefix convention: txt/ | clr/ | slot/ | lock/
 */

export const LAYER_PREFIXES = ["txt/", "clr/", "slot/", "lock/"] as const;
export type LayerPrefix = (typeof LAYER_PREFIXES)[number];

/** Required text layers for a social still template. */
export const REQUIRED_TEXT_LAYERS = ["txt/headline"] as const;

/** Optional text layers. */
export const OPTIONAL_TEXT_LAYERS = [
  "txt/sub",
  "txt/cta",
  "txt/handle",
  "txt/copy_zh",
] as const;

/** Required / optional color fill layers. */
export const OPTIONAL_COLOR_LAYERS = [
  "clr/bg",
  "clr/accent",
  "clr/bar",
] as const;

/** Smart-object asset slots. */
export const OPTIONAL_SLOT_LAYERS = [
  "slot/hero",
  "slot/bg",
  "slot/logo",
] as const;

/** Minimum set a template must pass the linter with. */
export const SCHEMA_REQUIRED_LAYERS = [...REQUIRED_TEXT_LAYERS] as const;

export const SCHEMA_RECOMMENDED_LAYERS = [
  ...OPTIONAL_TEXT_LAYERS,
  ...OPTIONAL_COLOR_LAYERS,
  ...OPTIONAL_SLOT_LAYERS,
] as const;

export type TextLayerName =
  | (typeof REQUIRED_TEXT_LAYERS)[number]
  | (typeof OPTIONAL_TEXT_LAYERS)[number];

export type ColorLayerName = (typeof OPTIONAL_COLOR_LAYERS)[number];
export type SlotLayerName = (typeof OPTIONAL_SLOT_LAYERS)[number];

export const TEMPLATE_IDS = [
  "tpl_ig_4x5",
  "tpl_ig_1x1",
  "tpl_story_9x16",
  "tpl_cover_16x9",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const RATIO_TO_TEMPLATE: Record<string, TemplateId> = {
  "4:5": "tpl_ig_4x5",
  "1:1": "tpl_ig_1x1",
  "9:16": "tpl_story_9x16",
  "16:9": "tpl_cover_16x9",
};

export const TEMPLATE_TO_RATIO: Record<TemplateId, string> = {
  tpl_ig_4x5: "4:5",
  tpl_ig_1x1: "1:1",
  tpl_story_9x16: "9:16",
  tpl_cover_16x9: "16:9",
};

export const RATIO_SUBDIR_PATTERN = /^(\d+:\d+)_(.+)$/;

export function isSchemaLayerName(name: string): boolean {
  return LAYER_PREFIXES.some((p) => name.startsWith(p));
}

export function layerKind(
  name: string,
): "text" | "color" | "slot" | "lock" | "unknown" {
  if (name.startsWith("txt/")) return "text";
  if (name.startsWith("clr/")) return "color";
  if (name.startsWith("slot/")) return "slot";
  if (name.startsWith("lock/")) return "lock";
  return "unknown";
}
