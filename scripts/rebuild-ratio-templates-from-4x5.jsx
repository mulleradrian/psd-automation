/**
 * Aspect-ratio variation engine.
 *
 * From master tpl_4x5.psd:
 * 1. Convert graphic placeholders (slot/*, lock/*) to Smart Objects
 * 2. Capture each layer's edge-margin ratios vs canvas
 * 3. For each target ratio: duplicate, resize canvas, remap every layer so
 *    left/right/top/bottom margin ratios match the master
 * 4. Write fixtures/templater/layouts/{ratioKey}.json for UXP lock/nudge
 */
#target photoshop
app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;

function repoRoot() {
  return new File($.fileName).parent.parent;
}

function logFile() {
  return new File(repoRoot().fsName + "/fixtures/templater/ratio_rebuild_log.txt");
}

function logWrite(lines) {
  var f = logFile();
  f.open("w");
  f.write(lines.join("\n"));
  f.close();
}

function findLayer(layers, name) {
  for (var i = 0; i < layers.length; i++) {
    var L = layers[i];
    if (L.name === name) return L;
    if (L.typename === "LayerSet") {
      var found = findLayer(L.layers, name);
      if (found) return found;
    }
  }
  return null;
}

function isSmartObject(layer) {
  try {
    return layer.kind === LayerKind.SMARTOBJECT;
  } catch (e) {
    return false;
  }
}

function convertActiveToSmartObject() {
  executeAction(stringIDToTypeID("newPlacedLayer"), undefined, DialogModes.NO);
}

function ensureSmartObject(doc, layer) {
  if (!layer || layer.typename === "LayerSet") return layer;
  if (isSmartObject(layer)) return layer;
  try {
    if (layer.kind === LayerKind.TEXT) return layer;
  } catch (e) {}
  doc.activeLayer = layer;
  try {
    convertActiveToSmartObject();
    return doc.activeLayer;
  } catch (e) {
    return layer;
  }
}

/** Placeholders only — not full-res BG plates (those hang / bloat). */
function shouldBeSmart(name) {
  return name.indexOf("slot/") === 0 || name.indexOf("lock/") === 0;
}

function walkConvertSmart(doc, layers, log) {
  var list = [];
  for (var i = 0; i < layers.length; i++) list.push(layers[i]);
  for (var j = 0; j < list.length; j++) {
    var L = list[j];
    if (L.typename === "LayerSet") {
      walkConvertSmart(doc, L.layers, log);
    } else if (shouldBeSmart(L.name)) {
      if (!isSmartObject(L)) {
        log.push("SO " + L.name);
        logWrite(log);
        ensureSmartObject(doc, L);
      } else {
        log.push("SO already " + L.name);
      }
    }
  }
}

function boundsPx(layer) {
  var b = layer.bounds;
  return {
    left: b[0].as("px"),
    top: b[1].as("px"),
    right: b[2].as("px"),
    bottom: b[3].as("px"),
  };
}

function captureTree(layers, W, H, out) {
  for (var i = 0; i < layers.length; i++) {
    var L = layers[i];
    if (L.typename === "LayerSet") {
      captureTree(L.layers, W, H, out);
      continue;
    }
    var b = boundsPx(L);
    var w = b.right - b.left;
    var h = b.bottom - b.top;
    if (w < 1 || h < 1) continue;
    var item = {
      name: L.name,
      leftFrac: b.left / W,
      topFrac: b.top / H,
      rightFrac: (W - b.right) / W,
      bottomFrac: (H - b.bottom) / H,
      widthFrac: w / W,
      heightFrac: h / H,
      visible: !!L.visible,
      isText: false,
      fontSize: null,
      smart: isSmartObject(L),
    };
    try {
      if (L.kind === LayerKind.TEXT) {
        item.isText = true;
        item.fontSize = L.textItem.size.as("px");
      }
    } catch (e) {}
    out.push(item);
  }
}

function targetBox(m, W2, H2) {
  var left = m.leftFrac * W2;
  var top = m.topFrac * H2;
  var right = W2 - m.rightFrac * W2;
  var bottom = H2 - m.bottomFrac * H2;
  if (right <= left + 2) {
    left = m.leftFrac * W2;
    right = left + Math.max(2, m.widthFrac * W2);
  }
  if (bottom <= top + 2) {
    top = m.topFrac * H2;
    bottom = top + Math.max(2, m.heightFrac * H2);
  }
  return { left: left, top: top, right: right, bottom: bottom, width: right - left, height: bottom - top };
}

function moveLayerToBox(doc, layer, box, uniform) {
  try {
    var b = boundsPx(layer);
    var cw = b.right - b.left;
    var ch = b.bottom - b.top;
    if (cw < 1 || ch < 1) return;

    var sx = (box.width / cw) * 100;
    var sy = (box.height / ch) * 100;
    if (uniform) {
      var s = Math.min(sx, sy);
      sx = s;
      sy = s;
    }
    doc.activeLayer = layer;
    // Unlock position if needed
    try {
      layer.allLocked = false;
      layer.positionLocked = false;
    } catch (e0) {}
    layer.resize(sx, sy, AnchorPosition.TOPLEFT);
    b = boundsPx(layer);
    var nw = b.right - b.left;
    var nh = b.bottom - b.top;
    var destLeft = uniform ? box.left + (box.width - nw) / 2 : box.left;
    var destTop = uniform ? box.top + (box.height - nh) / 2 : box.top;
    layer.translate(destLeft - b.left, destTop - b.top);
  } catch (e) {
    // Skip layers that cannot transform (background / constrained)
  }
}

function setTextSize(layer, sizePx) {
  try {
    layer.textItem.size = new UnitValue(sizePx, "px");
  } catch (e) {}
}

function applyMetrics(doc, metrics, W2, H2, srcW, srcH, scaleFont) {
  for (var i = 0; i < metrics.length; i++) {
    var m = metrics[i];
    var layer = findLayer(doc.layers, m.name);
    if (!layer) continue;
    var box = targetBox(m, W2, H2);
    if (m.isText) {
      var b = boundsPx(layer);
      layer.translate(box.left - b.left, box.top - b.top);
      if (m.fontSize && scaleFont) {
        var fs = m.fontSize * Math.sqrt((W2 / srcW) * (H2 / srcH));
        setTextSize(layer, Math.max(24, Math.round(fs)));
      }
    } else if (/^\d+$/.test(m.name) || m.name === "Background") {
      moveLayerToBox(doc, layer, { left: 0, top: 0, width: W2, height: H2, right: W2, bottom: H2 }, true);
    } else if (m.name.indexOf("Perfect-Ten-Graphic") === 0) {
      moveLayerToBox(doc, layer, box, true);
    } else {
      var uniform = m.name.indexOf("lock/accent_rule") !== 0;
      moveLayerToBox(doc, layer, box, uniform);
    }
  }
}

function isoNow() {
  var d = new Date();
  function p(n) {
    return (n < 10 ? "0" : "") + n;
  }
  return (
    d.getFullYear() +
    "-" +
    p(d.getMonth() + 1) +
    "-" +
    p(d.getDate()) +
    "T" +
    p(d.getHours()) +
    ":" +
    p(d.getMinutes()) +
    ":" +
    p(d.getSeconds()) +
    "Z"
  );
}

function stringify(v) {
  if (v === null) return "null";
  var t = typeof v;
  if (t === "number" || t === "boolean") return String(v);
  if (t === "string") return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  if (v instanceof Array) {
    var a = [];
    for (var i = 0; i < v.length; i++) a.push(stringify(v[i]));
    return "[" + a.join(",") + "]";
  }
  var keys = [];
  for (var k in v) if (v.hasOwnProperty(k)) keys.push(k);
  var parts = [];
  for (var j = 0; j < keys.length; j++) {
    parts.push(stringify(keys[j]) + ":" + stringify(v[keys[j]]));
  }
  return "{" + parts.join(",") + "}";
}

function writeLayoutJson(root, ratioKey, W, H, metrics, srcW, srcH) {
  var layers = {};
  for (var i = 0; i < metrics.length; i++) {
    var m = metrics[i];
    var box = targetBox(m, W, H);
    layers[m.name] = {
      left: Math.round(box.left),
      top: Math.round(box.top),
      width: Math.round(box.width),
      height: Math.round(box.height),
      leftFrac: m.leftFrac,
      topFrac: m.topFrac,
      rightFrac: m.rightFrac,
      bottomFrac: m.bottomFrac,
      fontSize: m.fontSize,
      smart: !!m.smart,
      locked: false,
      visible: m.visible,
    };
  }
  var payload = {
    ratioKey: ratioKey,
    canvas: { w: W, h: H },
    source: { ratioKey: "4x5", w: srcW, h: srcH },
    updatedAt: isoNow(),
    layers: layers,
  };
  var dir = new Folder(root.fsName + "/fixtures/templater/layouts");
  if (!dir.exists) dir.create();
  var f = new File(dir.fsName + "/" + ratioKey + ".json");
  f.open("w");
  f.write(stringify(payload));
  f.close();
}

function savePsd(doc, outRel) {
  var root = repoRoot();
  var out = new File(root.fsName + "/" + outRel);
  out.parent.create();
  var opts = new PhotoshopSaveOptions();
  opts.embedColorProfile = true;
  opts.maximizeCompatibility = true;
  doc.saveAs(out, opts, true, Extension.LOWERCASE);
  return out.fsName;
}

function makeVariant(srcRel, outRel, ratioKey, W2, H2, metrics, srcW, srcH, log) {
  log.push("VARIANT " + ratioKey);
  logWrite(log);
  var root = repoRoot();
  var src = new File(root.fsName + "/" + srcRel);
  var doc = app.open(src);
  var dup = doc.duplicate("tmp_" + ratioKey, false);
  doc.close(SaveOptions.DONOTSAVECHANGES);
  app.activeDocument = dup;

  dup.resizeCanvas(UnitValue(W2, "px"), UnitValue(H2, "px"), AnchorPosition.TOPLEFT);
  applyMetrics(dup, metrics, W2, H2, srcW, srcH, true);
  writeLayoutJson(root, ratioKey, W2, H2, metrics, srcW, srcH);
  var path = savePsd(dup, outRel);
  dup.close(SaveOptions.DONOTSAVECHANGES);
  return path + " " + W2 + "x" + H2;
}

function main() {
  var root = repoRoot();
  var srcRel = "fixtures/templater/templates/tpl_4x5.psd";
  var srcFile = new File(root.fsName + "/" + srcRel);
  if (!srcFile.exists) throw new Error("Missing " + srcRel);

  var log = [];
  try {
    log.push("OPEN master");
    logWrite(log);
    var master = app.open(srcFile);
    log.push("SMARTIFY placeholders (slot/*, lock/*)");
    logWrite(log);
    walkConvertSmart(master, master.layers, log);

    var W = master.width.as("px");
    var H = master.height.as("px");
    var metrics = [];
    captureTree(master.layers, W, H, metrics);
    log.push("CAPTURED " + metrics.length + " layers @ " + W + "x" + H);
    logWrite(log);

    var opts = new PhotoshopSaveOptions();
    opts.embedColorProfile = true;
    opts.maximizeCompatibility = true;
    master.saveAs(srcFile, opts, true, Extension.LOWERCASE);
    writeLayoutJson(root, "4x5", W, H, metrics, W, H);
    master.close(SaveOptions.DONOTSAVECHANGES);
    log.push("SAVED master + layouts/4x5.json");
    logWrite(log);

    log.push(
      "OK " +
        makeVariant(srcRel, "fixtures/templater/templates/tpl_1x1.psd", "1x1", 1080, 1080, metrics, W, H, log),
    );
    log.push(
      "OK " +
        makeVariant(srcRel, "fixtures/templater/templates/tpl_9x16.psd", "9x16", 1080, 1920, metrics, W, H, log),
    );
    log.push(
      "OK " +
        makeVariant(srcRel, "fixtures/templater/templates/tpl_16x9.psd", "16x9", 1920, 1080, metrics, W, H, log),
    );
    log.push("DONE");
  } catch (e) {
    log.push("FAIL " + e);
  }
  logWrite(log);
}

try {
  main();
} catch (e) {
  throw e;
}
