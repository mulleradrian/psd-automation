/**
 * Shared layout-ratio helpers (edge-margin mapping across aspect ratios).
 */
export type LayoutFrac = {
  leftFrac: number;
  topFrac: number;
  rightFrac: number;
  bottomFrac: number;
  widthFrac: number;
  heightFrac: number;
};

export type PixelBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export function fracsFromBox(
  box: { left: number; top: number; right: number; bottom: number },
  canvasW: number,
  canvasH: number,
): LayoutFrac {
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  return {
    leftFrac: box.left / canvasW,
    topFrac: box.top / canvasH,
    rightFrac: (canvasW - box.right) / canvasW,
    bottomFrac: (canvasH - box.bottom) / canvasH,
    widthFrac: width / canvasW,
    heightFrac: height / canvasH,
  };
}

/** Map edge-margin ratios onto a new canvas (preserves spacing ratios to borders). */
export function targetBoxFromFracs(m: LayoutFrac, canvasW: number, canvasH: number): PixelBox {
  let left = m.leftFrac * canvasW;
  let top = m.topFrac * canvasH;
  let right = canvasW - m.rightFrac * canvasW;
  let bottom = canvasH - m.bottomFrac * canvasH;
  if (right <= left + 2) {
    left = m.leftFrac * canvasW;
    right = left + Math.max(2, m.widthFrac * canvasW);
  }
  if (bottom <= top + 2) {
    top = m.topFrac * canvasH;
    bottom = top + Math.max(2, m.heightFrac * canvasH);
  }
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

export function fontScaleForCanvas(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): number {
  return Math.sqrt((dstW / srcW) * (dstH / srcH));
}

/** Reference art the Preview / 4:5 lockup is authored against. */
export const P10_ART = { w: 1080, h: 1350 } as const;

/**
 * Safe content / type / ten bounds for a canvas size.
 * Fracs come from the sheet Preview lockup so ratio variants stay consistent
 * when templates are remapped from a master.
 */
export type CanvasSafeBounds = {
  width: number;
  height: number;
  /** Outer margin that must stay clear of ink */
  marginPx: number;
  content: PixelBox;
  /** slot/ten placement box (full logo crop including brand mark) */
  ten: PixelBox;
  /** Type column */
  typeLeft: number;
  typeRight: number;
  typeMaxWidth: number;
  typeBaselineY: number;
  /** Max bottom edge of type block (bottom clearance) */
  typeBottomMax: number;
  /** Accent rule spans typeLeft → accentRuleRight */
  accentRuleRight: number;
  fontTargetPx: number;
  fontMinPx: number;
  leadingRatio: number;
  /** When true, autofit may overlap ten AABB */
  allowTenOverlap: boolean;
};

/** Preview-locked fracs on 1080×1350 art (tuned for margins + no clip). */
const PREVIEW_SAFE = {
  marginFrac: 28 / 1080,
  ten: fracsFromBox({ left: 40, top: 72, right: 1000, bottom: 900 }, 1080, 1350),
  typeLeftFrac: 108 / 1080,
  typeRightPadFrac: 64 / 1080,
  typeBaselineFrac: 990 / 1350,
  typeBottomClearFrac: 120 / 1350,
  /** Rule runs to the right edge */
  accentRightPadFrac: 2 / 1080,
  fontTarget: 86,
  fontMin: 72,
  leadingRatio: 1.08,
};

export function canvasSafeBounds(width: number, height: number): CanvasSafeBounds {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const marginPx = Math.max(16, Math.round(PREVIEW_SAFE.marginFrac * w));
  const ten = targetBoxFromFracs(PREVIEW_SAFE.ten, w, h);
  const typeLeft = Math.round(PREVIEW_SAFE.typeLeftFrac * w);
  const typeRight = Math.round(w - PREVIEW_SAFE.typeRightPadFrac * w);
  const typeMaxWidth = Math.max(120, typeRight - typeLeft);
  const typeBaselineY = Math.round(PREVIEW_SAFE.typeBaselineFrac * h);
  const typeBottomMax = Math.round(h - PREVIEW_SAFE.typeBottomClearFrac * h);
  const accentRuleRight = Math.round(w - PREVIEW_SAFE.accentRightPadFrac * w);
  const scale = fontScaleForCanvas(P10_ART.w, P10_ART.h, w, h);
  return {
    width: w,
    height: h,
    marginPx,
    content: {
      left: marginPx,
      top: marginPx,
      right: w - marginPx,
      bottom: h - marginPx,
      width: w - 2 * marginPx,
      height: h - 2 * marginPx,
    },
    ten,
    typeLeft,
    typeRight,
    typeMaxWidth,
    typeBaselineY,
    typeBottomMax,
    accentRuleRight,
    fontTargetPx: Math.round(PREVIEW_SAFE.fontTarget * scale),
    fontMinPx: Math.round(PREVIEW_SAFE.fontMin * scale),
    leadingRatio: PREVIEW_SAFE.leadingRatio,
    allowTenOverlap: false,
  };
}
