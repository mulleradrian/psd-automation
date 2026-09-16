/**
 * UXP copy of layout-ratios + layout-merge (keep in sync with packages/shared).
 */
(function (global) {
  function fracsFromBox(box, canvasW, canvasH) {
    var width = box.right - box.left;
    var height = box.bottom - box.top;
    return {
      leftFrac: box.left / canvasW,
      topFrac: box.top / canvasH,
      rightFrac: (canvasW - box.right) / canvasW,
      bottomFrac: (canvasH - box.bottom) / canvasH,
      widthFrac: width / canvasW,
      heightFrac: height / canvasH,
    };
  }

  function targetBoxFromFracs(m, canvasW, canvasH) {
    var left = m.leftFrac * canvasW;
    var top = m.topFrac * canvasH;
    var right = canvasW - m.rightFrac * canvasW;
    var bottom = canvasH - m.bottomFrac * canvasH;
    if (right <= left + 2) {
      left = m.leftFrac * canvasW;
      right = left + Math.max(2, m.widthFrac * canvasW);
    }
    if (bottom <= top + 2) {
      top = m.topFrac * canvasH;
      bottom = top + Math.max(2, m.heightFrac * canvasH);
    }
    return {
      left: left,
      top: top,
      right: right,
      bottom: bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  function fontScaleForCanvas(srcW, srcH, dstW, dstH) {
    return Math.sqrt((dstW / srcW) * (dstH / srcH));
  }

  var P10_ART = { w: 1080, h: 1350 };
  var PREVIEW_SAFE = {
    marginFrac: 28 / 1080,
    ten: fracsFromBox({ left: 40, top: 72, right: 1000, bottom: 900 }, 1080, 1350),
    typeLeftFrac: 108 / 1080,
    typeRightPadFrac: 64 / 1080,
    typeBaselineFrac: 990 / 1350,
    typeBottomClearFrac: 120 / 1350,
    accentRightPadFrac: 2 / 1080,
    fontTarget: 86,
    fontMin: 72,
    leadingRatio: 1.08,
  };

  function canvasSafeBounds(width, height) {
    var w = Math.max(1, width);
    var h = Math.max(1, height);
    var marginPx = Math.max(16, Math.round(PREVIEW_SAFE.marginFrac * w));
    var ten = targetBoxFromFracs(PREVIEW_SAFE.ten, w, h);
    var typeLeft = Math.round(PREVIEW_SAFE.typeLeftFrac * w);
    var typeRight = Math.round(w - PREVIEW_SAFE.typeRightPadFrac * w);
    var typeMaxWidth = Math.max(120, typeRight - typeLeft);
    var typeBaselineY = Math.round(PREVIEW_SAFE.typeBaselineFrac * h);
    var typeBottomMax = Math.round(h - PREVIEW_SAFE.typeBottomClearFrac * h);
    var accentRuleRight = Math.round(w - PREVIEW_SAFE.accentRightPadFrac * w);
    var scale = fontScaleForCanvas(P10_ART.w, P10_ART.h, w, h);
    return {
      width: w,
      height: h,
      marginPx: marginPx,
      content: {
        left: marginPx,
        top: marginPx,
        right: w - marginPx,
        bottom: h - marginPx,
        width: w - 2 * marginPx,
        height: h - 2 * marginPx,
      },
      ten: ten,
      typeLeft: typeLeft,
      typeRight: typeRight,
      typeMaxWidth: typeMaxWidth,
      typeBaselineY: typeBaselineY,
      typeBottomMax: typeBottomMax,
      accentRuleRight: accentRuleRight,
      fontTargetPx: Math.round(PREVIEW_SAFE.fontTarget * scale),
      fontMinPx: Math.round(PREVIEW_SAFE.fontMin * scale),
      leadingRatio: PREVIEW_SAFE.leadingRatio,
      allowTenOverlap: false,
    };
  }

  function entryToFracs(entry) {
    if (
      entry &&
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
        widthFrac: entry.widthFrac != null ? entry.widthFrac : Math.max(0, 1 - entry.leftFrac - entry.rightFrac),
        heightFrac:
          entry.heightFrac != null ? entry.heightFrac : Math.max(0, 1 - entry.topFrac - entry.bottomFrac),
      };
    }
    return null;
  }

  function boxFromEntry(entry, canvasW, canvasH) {
    var fr = entryToFracs(entry);
    if (fr) return targetBoxFromFracs(fr, canvasW, canvasH);
    if (entry && entry.left != null && entry.top != null && entry.width != null && entry.height != null) {
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

  function mergeLayoutLayers(baseline, overrides) {
    var out = {};
    var k;
    for (k in baseline || {}) {
      if (!Object.prototype.hasOwnProperty.call(baseline, k)) continue;
      var e = baseline[k] || {};
      out[k] = Object.assign({}, e, { props: Object.assign({}, e.props || {}) });
    }
    if (!overrides) return out;
    for (k in overrides) {
      if (!Object.prototype.hasOwnProperty.call(overrides, k)) continue;
      var base = out[k] || {};
      var over = overrides[k] || {};
      out[k] = Object.assign({}, base, over, {
        props: Object.assign({}, base.props || {}, over.props || {}),
      });
    }
    return out;
  }

  function aabbOverlap(a, b) {
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  }

  /** Estimate type block height from lines + leading. */
  function estimateTypeBlockHeight(lineCount, fontSizePx, leadingRatio) {
    var lead = fontSizePx * (leadingRatio || 1.08);
    return Math.max(fontSizePx, lineCount * lead);
  }

  /**
   * Multi-edge fit: shrink until type fits width AND bottom clearance,
   * and optionally avoids overlapping ten AABB.
   */
  function fitAgainstSafeBounds(fitApi, opts) {
    var safe = opts.safe;
    var title = opts.title || "";
    var copy = opts.copy || "";
    var wantSize = opts.fontSizePx || safe.fontTargetPx;
    var minSize = opts.minFontSizePx != null ? opts.minFontSizePx : safe.fontMinPx;
    var maxWidthPx = opts.maxWidthPx != null ? opts.maxWidthPx : safe.typeMaxWidth;
    var fit = fitApi.fitTypeBlock({
      title: title,
      copy: copy,
      maxWidthPx: maxWidthPx,
      fontSizePx: wantSize,
      minFontSizePx: minSize,
      maxLines: 3,
    });
    var lines = (fit.lines || []).filter(Boolean);
    var size = fit.fontSizePx || wantSize;
    var leadingRatio = safe.leadingRatio || 1.08;

    function blockOk(sz) {
      if (!fitApi.linesFitInBounds(lines, sz, maxWidthPx)) return false;
      var h = estimateTypeBlockHeight(lines.length || 1, sz, leadingRatio);
      var top = safe.typeBaselineY - sz;
      var bottom = top + h;
      if (bottom > safe.typeBottomMax) return false;
      if (top < safe.marginPx) return false;
      if (!safe.allowTenOverlap && safe.ten) {
        var typeBox = {
          left: safe.typeLeft,
          top: top,
          right: safe.typeLeft + maxWidthPx,
          bottom: bottom,
        };
        if (aabbOverlap(typeBox, safe.ten)) return false;
      }
      return true;
    }

    while (size > minSize && !blockOk(size)) {
      size -= 2;
    }
    // If still colliding with ten at min size, allow overlap but keep width/bottom
    var allowOverlap = false;
    if (!blockOk(size) && safe.ten) {
      allowOverlap = true;
      var safeLoose = Object.assign({}, safe, { allowTenOverlap: true });
      while (size > minSize) {
        var h2 = estimateTypeBlockHeight(lines.length || 1, size, leadingRatio);
        var top2 = safeLoose.typeBaselineY - size;
        var bottom2 = top2 + h2;
        if (
          fitApi.linesFitInBounds(lines, size, maxWidthPx) &&
          bottom2 <= safeLoose.typeBottomMax &&
          top2 >= safeLoose.marginPx
        ) {
          break;
        }
        size -= 2;
      }
    }

    return {
      lines: lines,
      fontSizePx: size,
      text: lines.join("\r"),
      headline: lines.join("\r"),
      sub: "",
      allowTenOverlap: allowOverlap,
      typeBlockHeight: estimateTypeBlockHeight(lines.length || 1, size, leadingRatio),
    };
  }

  var PROPERTY_REGISTRY = {
    text: ["contents", "font", "sizePx", "leading", "color", "alignment"],
    color: ["hex", "opacity"],
    slot: ["file", "opacity"],
    lock: ["opacity", "visible", "bounds", "fxScale"],
    bg: ["opacity", "visible"],
    other: ["opacity", "visible", "bounds", "fxScale"],
    any: ["opacity", "visible", "bounds", "fxScale"],
  };

  function propsForKind(kind) {
    return PROPERTY_REGISTRY[kind] || PROPERTY_REGISTRY.any;
  }

  function variantRelPath(contentId, ratioKey) {
    var safe = String(contentId || "row").replace(/[^\w.-]+/g, "_");
    return "fixtures/templater/layouts/variants/" + safe + "_" + ratioKey + ".json";
  }

  var DEFAULT_TYPE_GROUP = {
    id: "type_accents",
    members: ["txt/headline", "lock/accent_dot", "lock/accent_rule"],
    gaps: [
      { from: "txt/headline", to: "lock/accent_rule", dxFrac: 0, dyFrac: 14 / 1350 },
      { from: "txt/headline", to: "lock/accent_dot", dxFrac: -40 / 1080, dyFrac: 0 },
    ],
  };

  function placeGroupFromAnchor(group, anchorName, anchorBox, canvasW, canvasH) {
    var out = {};
    out[anchorName] = Object.assign({}, anchorBox);
    var gaps = group.gaps || [];
    for (var i = 0; i < gaps.length; i++) {
      var gap = gaps[i];
      if (gap.from !== anchorName) continue;
      var box = {
        left: anchorBox.left + gap.dxFrac * canvasW,
        top: anchorBox.bottom + gap.dyFrac * canvasH,
        width: anchorBox.width,
        height: Math.max(4, anchorBox.height * 0.05),
      };
      box.right = box.left + box.width;
      box.bottom = box.top + box.height;
      out[gap.to] = box;
    }
    return out;
  }

  global.P10Layout = {
    fracsFromBox: fracsFromBox,
    targetBoxFromFracs: targetBoxFromFracs,
    canvasSafeBounds: canvasSafeBounds,
    boxFromEntry: boxFromEntry,
    mergeLayoutLayers: mergeLayoutLayers,
    fitAgainstSafeBounds: fitAgainstSafeBounds,
    propsForKind: propsForKind,
    PROPERTY_REGISTRY: PROPERTY_REGISTRY,
    variantRelPath: variantRelPath,
    aabbOverlap: aabbOverlap,
    DEFAULT_TYPE_GROUP: DEFAULT_TYPE_GROUP,
    placeGroupFromAnchor: placeGroupFromAnchor,
  };
})(typeof window !== "undefined" ? window : globalThis);
