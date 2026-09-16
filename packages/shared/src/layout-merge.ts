/**
 * Layout merge + property registry for ratio baselines and variant overrides.
 */
import {
  fracsFromBox,
  targetBoxFromFracs,
  type LayoutFrac,
  type PixelBox,
} from "./layout-ratios.js";

export type LayerLayoutEntry = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  leftFrac?: number;
  topFrac?: number;
  rightFrac?: number;
  bottomFrac?: number;
  widthFrac?: number;
  heightFrac?: number;
  locked?: boolean;
  smart?: boolean;
  visible?: boolean;
  fontSize?: number | null;
  props?: Record<string, unknown>;
};

export type RatioLayoutFile = {
  ratioKey: string;
  canvas: { w: number; h: number };
  source?: { ratioKey: string; w: number; h: number };
  updatedAt?: string;
  layers: Record<string, LayerLayoutEntry>;
};

export type VariantLayoutFile = {
  contentId: string;
  ratioKey: string;
  updatedAt?: string;
  layers: Record<string, LayerLayoutEntry>;
};

export type PropagateScope = "variant" | "content" | "ratio" | "all";

/** UXP-supported editable properties by layer kind. */
export const PROPERTY_REGISTRY: Record<string, string[]> = {
  text: ["contents", "font", "sizePx", "leading", "color", "alignment"],
  color: ["hex", "opacity"],
  slot: ["file", "opacity"],
  lock: ["opacity", "visible", "bounds", "fxScale"],
  bg: ["opacity", "visible"],
  other: ["opacity", "visible", "bounds", "fxScale"],
  any: ["opacity", "visible", "bounds", "fxScale"],
};

export function propsForKind(kind: string): string[] {
  return PROPERTY_REGISTRY[kind] || PROPERTY_REGISTRY.any || [];
}

export function entryToFracs(entry: LayerLayoutEntry): LayoutFrac | null {
  if (
    entry.leftFrac != null &&
    entry.topFrac != null &&
    entry.rightFrac != null &&
    entry.bottomFrac != null
  ) {
    return {
      leftFrac: entry.leftFrac,
      topFrac: entry.topFrac,
      rightFrac: entry.rightFrac,
      bottomFrac: entry.bottomFrac,
      widthFrac: entry.widthFrac ?? Math.max(0, 1 - entry.leftFrac - entry.rightFrac),
      heightFrac: entry.heightFrac ?? Math.max(0, 1 - entry.topFrac - entry.bottomFrac),
    };
  }
  if (
    entry.left != null &&
    entry.top != null &&
    entry.width != null &&
    entry.height != null
  ) {
    // Absolute-only legacy — caller should supply canvas size
    return null;
  }
  return null;
}

export function boxFromEntry(
  entry: LayerLayoutEntry,
  canvasW: number,
  canvasH: number,
): PixelBox | null {
  const fr = entryToFracs(entry);
  if (fr) return targetBoxFromFracs(fr, canvasW, canvasH);
  if (
    entry.left != null &&
    entry.top != null &&
    entry.width != null &&
    entry.height != null
  ) {
    return {
      left: entry.left,
      top: entry.top,
      right: entry.left + entry.width,
      bottom: entry.top + entry.height,
      width: entry.width,
      height: entry.height,
    };
  }
  return null;
}

export function captureEntryFromBounds(
  left: number,
  top: number,
  right: number,
  bottom: number,
  canvasW: number,
  canvasH: number,
  prev?: LayerLayoutEntry,
): LayerLayoutEntry {
  const fr = fracsFromBox({ left, top, right, bottom }, canvasW, canvasH);
  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
    ...fr,
    locked: prev?.locked || false,
    smart: prev?.smart || false,
    visible: prev?.visible !== false,
    fontSize: prev?.fontSize ?? null,
    props: prev?.props ? { ...prev.props } : {},
  };
}

/** Sparse merge: baseline ← overrides (layer-level). */
export function mergeLayoutLayers(
  baseline: Record<string, LayerLayoutEntry>,
  overrides?: Record<string, LayerLayoutEntry> | null,
): Record<string, LayerLayoutEntry> {
  const out: Record<string, LayerLayoutEntry> = {};
  for (const [name, entry] of Object.entries(baseline || {})) {
    out[name] = { ...entry, props: { ...(entry.props || {}) } };
  }
  if (!overrides) return out;
  for (const [name, over] of Object.entries(overrides)) {
    const base = out[name] || {};
    out[name] = {
      ...base,
      ...over,
      props: { ...(base.props || {}), ...(over.props || {}) },
    };
  }
  return out;
}

export function variantLayoutPath(contentId: string, ratioKey: string): string {
  const safe = String(contentId || "row").replace(/[^\w.-]+/g, "_");
  return `fixtures/templater/layouts/variants/${safe}_${ratioKey}.json`;
}

export function ratioLayoutPath(ratioKey: string): string {
  return `fixtures/templater/layouts/${ratioKey}.json`;
}

/** Optional layout groups: move/scale as a unit preserving gap ratios. */
export type LayoutGroup = {
  id: string;
  members: string[];
  /** Locked gaps between members as fractions of canvas (memberA→memberB) */
  gaps?: Array<{ from: string; to: string; dxFrac: number; dyFrac: number }>;
};

export const DEFAULT_TYPE_GROUP: LayoutGroup = {
  id: "type_accents",
  members: ["txt/headline", "lock/accent_dot", "lock/accent_rule"],
  gaps: [
    { from: "txt/headline", to: "lock/accent_rule", dxFrac: 0, dyFrac: 14 / 1350 },
    { from: "txt/headline", to: "lock/accent_dot", dxFrac: -40 / 1080, dyFrac: 0 },
  ],
};

/**
 * Given a moved anchor box, place other group members using locked gap fracs.
 */
export function placeGroupFromAnchor(
  group: LayoutGroup,
  anchorName: string,
  anchorBox: PixelBox,
  canvasW: number,
  canvasH: number,
): Record<string, PixelBox> {
  const out: Record<string, PixelBox> = { [anchorName]: { ...anchorBox } };
  for (const gap of group.gaps || []) {
    if (gap.from !== anchorName) continue;
    const w = anchorBox.width;
    const h = anchorBox.height;
    const placed: PixelBox = {
      left: anchorBox.left + gap.dxFrac * canvasW,
      top: anchorBox.bottom + gap.dyFrac * canvasH,
      width: w,
      height: Math.max(4, h * 0.05),
      right: 0,
      bottom: 0,
    };
    placed.right = placed.left + placed.width;
    placed.bottom = placed.top + placed.height;
    out[gap.to] = placed;
  }
  return out;
}

