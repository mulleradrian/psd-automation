/**
 * Build tpl_p10_preview_matched.psd the simple way:
 * - BG from p10test BG IMAGES
 * - slot/ten = top crop of Perfect Ten logo (no PerfectTen wordmark)
 * - live visible txt/headline + txt/sub
 * - separate lock/accent_dot + lock/accent_rule
 * - NO baked lock/type_overlay
 */
#target photoshop
app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;

function repoRoot() {
  return new File($.fileName).parent.parent;
}

function findGroup(doc, name) {
  for (var i = 0; i < doc.layerSets.length; i++) {
    if (doc.layerSets[i].name === name) return doc.layerSets[i];
  }
  return null;
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

function hideAll(group) {
  if (!group) return;
  for (var i = 0; i < group.layers.length; i++) group.layers[i].visible = false;
}

function showOnly(group, name) {
  hideAll(group);
  if (!group) return;
  for (var i = 0; i < group.layers.length; i++) {
    if (group.layers[i].name === name) group.layers[i].visible = true;
  }
}

function alignTopLeft(layer, targetLeft, targetTop) {
  var b = layer.bounds;
  var dx = targetLeft - b[0].as("px");
  var dy = targetTop - b[1].as("px");
  layer.translate(UnitValue(dx, "px"), UnitValue(dy, "px"));
}

function setFont(ti) {
  var fonts = ["Poppins-Medium", "Inter-Medium", "Inter-Regular", "ArialMT"];
  for (var i = 0; i < fonts.length; i++) {
    try {
      ti.font = fonts[i];
      return fonts[i];
    } catch (e) {}
  }
  return "ArialMT";
}

function makeText(doc, name, contents, x, yPx, sizePx) {
  removeIfExists(doc, name);
  var layer = doc.artLayers.add();
  layer.kind = LayerKind.TEXT;
  layer.name = name;
  layer.visible = true;
  var ti = layer.textItem;
  ti.kind = TextType.POINTTEXT;
  ti.contents = contents;
  // Doc is often 264dpi — convert desired pixel size to points
  var sizePt = (sizePx * 72.0) / doc.resolution;
  ti.size = sizePt;
  setFont(ti);
  ti.justification = Justification.LEFT;
  var c = new SolidColor();
  c.rgb.hexValue = "FFFFFF";
  ti.color = c;
  // yPx is desired glyph TOP; approximate baseline = top + 0.8*size
  var baseline = yPx + sizePx * 0.8;
  ti.position = [UnitValue(x, "px"), UnitValue(baseline, "px")];
  try {
    layer.move(doc, ElementPlacement.PLACEATBEGINNING);
  } catch (e) {}
  return layer;
}

function placePngAt(doc, file, name, left, top) {
  removeIfExists(doc, name);
  var src = app.open(file);
  var layer = src.activeLayer.duplicate(doc, ElementPlacement.PLACEATBEGINNING);
  src.close(SaveOptions.DONOTSAVECHANGES);
  app.activeDocument = doc;
  doc.activeLayer = layer;
  layer.name = name;
  layer.visible = true;
  alignTopLeft(layer, left, top);
  return layer;
}

/** Solid lime rectangle layer (accent rule). */
function makeRectLayer(doc, name, left, top, right, bottom, hex) {
  removeIfExists(doc, name);
  var layer = doc.artLayers.add();
  layer.name = name;
  layer.visible = true;
  doc.activeLayer = layer;
  doc.selection.select([
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom]
  ]);
  var c = new SolidColor();
  c.rgb.hexValue = hex;
  doc.selection.fill(c);
  doc.selection.deselect();
  try {
    layer.move(doc, ElementPlacement.PLACEATBEGINNING);
  } catch (e) {}
  return layer;
}

/** Place pre-cropped logo-ten PNG (top of lockup only). */
function placeTenCrop(doc, file) {
  removeIfExists(doc, "slot/ten");
  var src = app.open(file);
  var layer = src.activeLayer.duplicate(doc, ElementPlacement.PLACEATBEGINNING);
  src.close(SaveOptions.DONOTSAVECHANGES);
  app.activeDocument = doc;
  doc.activeLayer = layer;
  layer.name = "slot/ten";
  layer.visible = true;
  layer.opacity = 100;
  // Authored full-frame crop — pin opaque content to its natural origin
  var metaFile = new File(repoRoot().fsName + "/fixtures/layouts/ten_crop_meta.json");
  var left = 0;
  var top = 0;
  if (metaFile.exists) {
    metaFile.open("r");
    var raw = metaFile.read();
    metaFile.close();
    var m = raw.match(/"bbox"\s*:\s*\[\s*(-?\d+)\s*,\s*(-?\d+)/);
    if (m) {
      left = parseInt(m[1], 10);
      top = parseInt(m[2], 10);
    }
  }
  alignTopLeft(layer, left, top);
  return layer;
}

function main() {
  var root = repoRoot();
  var master = new File(root.fsName + "/fixtures/templates/p10test/p10test.psd");
  if (!master.exists) throw new Error("Missing p10test.psd");

  var tenFile = new File(root.fsName + "/fixtures/layout-library/assets/ten_logo_crop.png");
  if (!tenFile.exists) {
    throw new Error("Missing ten_logo_crop.png — run: python scripts/crop_logo_ten.py");
  }

  var doc = app.open(master);

  var junk = [
    "clr/accent",
    "clr/scrim",
    "txt/headline",
    "txt/sub",
    "txt/cta",
    "slot/hero",
    "slot/logo",
    "slot/ten",
    "lock/accent_dot",
    "lock/accent_rule",
    "lock/preview_plate",
    "lock/type_overlay",
    "lock/readme",
    "lock/preview_beauty"
  ];
  for (var j = 0; j < junk.length; j++) removeIfExists(doc, junk[j]);

  hideAll(findGroup(doc, "P10 COLORS"));
  hideAll(findGroup(doc, "BG GRAPHICS"));
  showOnly(findGroup(doc, "BG IMAGES"), "12");

  // 1) Simple logo top-crop
  placeTenCrop(doc, tenFile);

  // 2) Live editable text (90px visual at doc DPI)
  var textX = 235;
  var headline = makeText(doc, "txt/headline", "Unlock the peace", textX, 1015, 90);
  var sub = makeText(doc, "txt/sub", "you deserve", textX, 1130, 90);

  // 3) Separate accents — circular dot with padding; rule to right edge
  var hb = headline.bounds;
  var sb = sub.bounds;
  var lime = "B6F25C";
  var W = doc.width.as("px");
  var dotSize = 22;
  var dotPad = 48; // space between circle and text
  var dotLeft = hb[0].as("px") - dotPad - dotSize;
  var dotTop = (hb[1].as("px") + hb[3].as("px")) / 2 - dotSize / 2;
  var dotFile = new File(root.fsName + "/fixtures/layout-library/assets/accent_dot.png");
  if (!dotFile.exists) throw new Error("Missing accent_dot.png");
  placePngAt(doc, dotFile, "lock/accent_dot", Math.round(dotLeft), Math.round(dotTop));

  var ruleTop = sb[3].as("px") + 16;
  makeRectLayer(doc, "lock/accent_rule", sb[0].as("px"), ruleTop, W, ruleTop + 5, lime);

  // Keep ten under text/accents
  var ten = findLayer(doc, "slot/ten");
  var bg = findGroup(doc, "BG IMAGES");
  if (ten && bg) {
    try {
      ten.move(bg, ElementPlacement.PLACEBEFORE);
    } catch (e) {}
  }

  var out = new File(root.fsName + "/fixtures/templates/p10test/tpl_p10_preview_matched.psd");
  var opts = new PhotoshopSaveOptions();
  opts.embedColorProfile = true;
  opts.maximizeCompatibility = true;
  doc.saveAs(out, opts, true, Extension.LOWERCASE);

  var jpg = new File(root.fsName + "/fixtures/layout-library/p10_ig_4x5/Q1_W1_01_from_psd.jpg");
  var jo = new JPEGSaveOptions();
  jo.quality = 12;
  doc.saveAs(jpg, jo, true, Extension.LOWERCASE);

  // Layer dump for QA
  var lines = [];
  for (var i = 0; i < doc.layers.length; i++) {
    var L = doc.layers[i];
    var b = "";
    try {
      b =
        " [" +
        L.bounds[0].as("px") +
        "," +
        L.bounds[1].as("px") +
        "," +
        L.bounds[2].as("px") +
        "," +
        L.bounds[3].as("px") +
        "]";
    } catch (e3) {}
    lines.push(L.name + " vis=" + L.visible + b);
  }
  var log = new File(root.fsName + "/fixtures/layouts/build_log.txt");
  log.open("w");
  log.write(lines.join("\n"));
  log.close();
}

try {
  main();
} catch (e) {
  throw e;
}
