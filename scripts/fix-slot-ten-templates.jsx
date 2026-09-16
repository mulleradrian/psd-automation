/**
 * Place masked logo "10" (ten_logo_crop.png) into templater PSDs.
 * Uses the Perfect Ten logo PNG with wordmark already masked off — does NOT redraw.
 * Geometry from fixtures/layouts/ten_crop_meta.json.
 */
#target photoshop
app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;

function repoRoot() {
  return new File($.fileName).parent.parent;
}

function findLayer(container, name) {
  for (var i = 0; i < container.layers.length; i++) {
    var layer = container.layers[i];
    if (layer.name === name) return layer;
    if (layer.typename === "LayerSet") {
      var found = findLayer(layer, name);
      if (found) return found;
    }
  }
  return null;
}

function removeIfExists(doc, name) {
  var layer = findLayer(doc, name);
  if (!layer) return;
  try {
    layer.remove();
  } catch (e) {
    layer.visible = false;
  }
}

function convertToSmartObject() {
  try {
    executeAction(stringIDToTypeID("newPlacedLayer"), undefined, DialogModes.NO);
  } catch (e) {}
}

function readCropMeta(root) {
  // Defaults from ten_crop_meta.json (logo top-crop, wordmark masked)
  var meta = {
    left: 1,
    top: 98,
    right: 1046,
    bottom: 927,
    artW: 1080,
    artH: 1350,
  };
  var metaFile = new File(root.fsName + "/fixtures/layouts/ten_crop_meta.json");
  if (!metaFile.exists) return meta;
  metaFile.open("r");
  var raw = metaFile.read();
  metaFile.close();
  var m = raw.match(/"bbox"\s*:\s*\[\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/);
  if (m) {
    meta.left = parseInt(m[1], 10);
    meta.top = parseInt(m[2], 10);
    meta.right = parseInt(m[3], 10);
    meta.bottom = parseInt(m[4], 10);
  }
  return meta;
}

/**
 * Place pre-masked logo PNG (ten_logo_crop.png). No redraw.
 * Insets left/top so the brand mark is fully visible; slight scale pad.
 */
function placeMaskedLogoTen(doc) {
  var root = repoRoot();
  var file = new File(root.fsName + "/fixtures/layout-library/assets/ten_logo_crop.png");
  if (!file.exists) {
    throw new Error("Missing ten_logo_crop.png — run: python scripts/crop_logo_ten.py");
  }

  removeIfExists(doc, "slot/ten");

  var src = app.open(file);
  var ten = src.activeLayer.duplicate(doc, ElementPlacement.PLACEATBEGINNING);
  src.close(SaveOptions.DONOTSAVECHANGES);
  app.activeDocument = doc;
  ten.name = "slot/ten";
  ten.visible = true;

  var W = doc.width.as("px");
  var H = doc.height.as("px");
  var meta = readCropMeta(root);
  var authoredW = Math.max(1, meta.right - meta.left);
  var authoredH = Math.max(1, meta.bottom - meta.top);

  // Safe inset so brand mark is fully clear of canvas edges (no redraw)
  var inset = Math.max(36, Math.round(40 * (W / 1080)));
  var scalePad = 0.9;
  var textTopArt = 990;
  var maxBottom = Math.round(textTopArt * (H / meta.artH)) - Math.round(24 * (H / meta.artH));
  if (maxBottom > H - 40) maxBottom = H - 40;

  var b = ten.bounds;
  var lw = Math.max(1, b[2].as("px") - b[0].as("px"));
  var lh = Math.max(1, b[3].as("px") - b[1].as("px"));

  var availW = W - 2 * inset;
  var availH = maxBottom - inset;
  var s = Math.min(availW / authoredW, availH / authoredH) * scalePad;
  var targetW = authoredW * s;
  var targetH = authoredH * s;
  var destLeft = inset;
  var destTop = inset;

  var sPct = Math.min(targetW / lw, targetH / lh) * 100;
  ten.resize(sPct, sPct, AnchorPosition.TOPLEFT);
  b = ten.bounds;
  ten.translate(destLeft - b[0].as("px"), destTop - b[1].as("px"));

  // Final safety: keep fully inside canvas
  b = ten.bounds;
  if (b[0].as("px") < 2) ten.translate(2 - b[0].as("px"), 0);
  if (b[1].as("px") < 2) ten.translate(0, 2 - b[1].as("px"));
  var overflowR = b[2].as("px") - (W - 2);
  var overflowB = b[3].as("px") - (H - 2);
  if (overflowR > 0 || overflowB > 0) {
    var curW = b[2].as("px") - b[0].as("px");
    var curH = b[3].as("px") - b[1].as("px");
    var shrink = Math.min(
      overflowR > 0 ? (curW - overflowR) / curW : 1,
      overflowB > 0 ? (curH - overflowB) / curH : 1
    ) * 100;
    if (shrink > 10 && shrink < 100) {
      ten.resize(shrink, shrink, AnchorPosition.TOPLEFT);
      b = ten.bounds;
      ten.translate(destLeft - b[0].as("px"), destTop - b[1].as("px"));
    }
  }

  try {
    doc.activeLayer = ten;
    convertToSmartObject();
  } catch (e2) {}
  return findLayer(doc, "slot/ten") || ten;
}

function setPreviewType(doc) {
  var W = doc.width.as("px");
  var H = doc.height.as("px");
  var sx = W / 1080;
  var sy = H / 1350;
  var textLeft = Math.round(108 * sx);
  var rightPad = Math.round(64 * sx);
  var maxTextW = W - textLeft - rightPad;
  // Preview-scale type — conservative estimate (Poppins wider than old factors)
  var fontPx = Math.round(86 * Math.sqrt(sx * sy));
  if (fontPx < 72) fontPx = 72;
  if (fontPx > 100) fontPx = 100;
  function est(s, size) {
    var w = 0;
    var factors = {
      " ": 0.28,
      i: 0.32,
      l: 0.32,
      I: 0.32,
      t: 0.4,
      f: 0.4,
      m: 0.9,
      w: 0.9,
      W: 0.9,
      M: 0.9,
    };
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      w += size * (factors[ch] != null ? factors[ch] : /[A-Z]/.test(ch) ? 0.72 : 0.56);
    }
    return w * 1.12;
  }
  while (fontPx > 70 && est("The neighbourhood", fontPx) > maxTextW) fontPx -= 1;
  while (fontPx > 70 && est("Unlock the peace", fontPx) > maxTextW) fontPx -= 1;

  var line1Y = Math.round(990 * sy);
  var body = "Unlock the peace\ryou deserve";
  var leading = fontPx * 1.08;

  function ensureText(name, contents, x, y, size) {
    var layer = findLayer(doc, name);
    if (!layer || layer.kind !== LayerKind.TEXT) {
      if (layer) {
        try {
          layer.remove();
        } catch (e) {}
      }
      layer = doc.artLayers.add();
      layer.kind = LayerKind.TEXT;
      layer.name = name;
    }
    layer.visible = true;
    var ti = layer.textItem;
    ti.kind = TextType.POINTTEXT;
    ti.contents = contents;
    ti.size = (size * 72.0) / doc.resolution;
    try {
      ti.font = "Poppins-Medium";
    } catch (e) {
      try {
        ti.font = "ArialMT";
      } catch (e2) {}
    }
    try {
      ti.useAutoLeading = false;
      ti.leading = (leading * 72.0) / doc.resolution;
    } catch (e3) {}
    ti.justification = Justification.LEFT;
    var c = new SolidColor();
    c.rgb.hexValue = "FFFFFF";
    ti.color = c;
    ti.position = [UnitValue(x, "px"), UnitValue(y, "px")];
    return layer;
  }

  var head = ensureText("txt/headline", body, textLeft, line1Y, fontPx);
  var subOld = findLayer(doc, "txt/sub");
  if (subOld) {
    try {
      if (subOld.kind === LayerKind.TEXT) subOld.textItem.contents = " ";
    } catch (e) {}
    subOld.visible = false;
  }

  var hb = head.bounds;
  var ruleTop = hb[3].as("px") + Math.round(14 * sy);
  var rule = findLayer(doc, "lock/accent_rule");
  if (rule) {
    try {
      rule.remove();
    } catch (e) {}
  }
  rule = doc.artLayers.add();
  rule.name = "lock/accent_rule";
  var lime = new SolidColor();
  lime.rgb.hexValue = "B6F25C";
  // Rule to the right edge across all ratios
  var ruleRight = W - 2;
  doc.selection.select([
    [textLeft, ruleTop],
    [ruleRight, ruleTop],
    [ruleRight, ruleTop + Math.max(4, Math.round(5 * sy))],
    [textLeft, ruleTop + Math.max(4, Math.round(5 * sy))],
  ]);
  doc.selection.fill(lime);
  doc.selection.deselect();

  var dotFile = new File(repoRoot().fsName + "/fixtures/layout-library/assets/accent_dot.png");
  var oldDot = findLayer(doc, "lock/accent_dot");
  if (oldDot) {
    try {
      oldDot.remove();
    } catch (e4) {}
  }
  if (dotFile.exists) {
    var src = app.open(dotFile);
    var dot = src.activeLayer.duplicate(doc, ElementPlacement.PLACEATBEGINNING);
    src.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = doc;
    dot.name = "lock/accent_dot";
    var db = dot.bounds;
    var dw = db[2].as("px") - db[0].as("px");
    var target = Math.max(18, Math.round(22 * Math.sqrt(sx * sy)));
    if (dw > 1) dot.resize((target / dw) * 100, (target / dw) * 100, AnchorPosition.TOPLEFT);
    db = dot.bounds;
    var destX = textLeft - (db[2].as("px") - db[0].as("px")) - Math.round(16 * sx);
    var destY = hb[1].as("px") + fontPx * 0.4 - (db[3].as("px") - db[1].as("px")) / 2;
    if (destX < Math.round(12 * sx)) destX = Math.round(12 * sx);
    dot.translate(destX - db[0].as("px"), destY - db[1].as("px"));
  }

  return fontPx;
}

function fixOne(rel) {
  var root = repoRoot();
  var f = new File(root.fsName + "/" + rel);
  if (!f.exists) return "MISSING " + rel;
  var doc = app.open(f);
  placeMaskedLogoTen(doc);
  var fontPx = setPreviewType(doc);
  var opts = new PhotoshopSaveOptions();
  opts.embedColorProfile = true;
  opts.maximizeCompatibility = true;
  doc.saveAs(f, opts, true, Extension.LOWERCASE);
  doc.close(SaveOptions.DONOTSAVECHANGES);
  return "OK " + rel + " font=" + fontPx;
}

function main() {
  var log = [];
  try {
    log.push(fixOne("fixtures/templater/templates/tpl_4x5.psd"));
    log.push(fixOne("fixtures/templater/templates/tpl_1x1.psd"));
    log.push(fixOne("fixtures/templater/templates/tpl_9x16.psd"));
    log.push(fixOne("fixtures/templater/templates/tpl_16x9.psd"));
    log.push("DONE");
  } catch (e) {
    log.push("FAIL " + e);
  }
  var out = new File(repoRoot().fsName + "/fixtures/templater/fix_ten_log.txt");
  out.open("w");
  out.write(log.join("\n"));
  out.close();
}

main();
