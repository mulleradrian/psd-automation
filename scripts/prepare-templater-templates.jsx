/**
 * Build Templater templates from workingset p10test PSDs.
 * - BG IMAGES cover-scaled to frame
 * - slot/ten = logo layer + layer mask (hides PerfectTen wordmark, keeps brand dot)
 * - txt/headline + txt/sub left-aligned
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

function setFont(ti) {
  var fonts = ["Poppins-Medium", "Inter-Medium", "ArialMT"];
  for (var i = 0; i < fonts.length; i++) {
    try {
      ti.font = fonts[i];
      return;
    } catch (e) {}
  }
}

function coverScaleLayer(doc, layer) {
  if (!layer) return;
  var b = layer.bounds;
  var lw = b[2].as("px") - b[0].as("px");
  var lh = b[3].as("px") - b[1].as("px");
  var dw = doc.width.as("px");
  var dh = doc.height.as("px");
  if (lw <= 1 || lh <= 1) return;
  var scale = Math.max(dw / lw, dh / lh) * 100;
  layer.resize(scale, scale, AnchorPosition.MIDDLECENTER);
  // Re-center
  b = layer.bounds;
  var cx = (b[0].as("px") + b[2].as("px")) / 2;
  var cy = (b[1].as("px") + b[3].as("px")) / 2;
  layer.translate(UnitValue(dw / 2 - cx, "px"), UnitValue(dh / 2 - cy, "px"));
}

function coverAllBgs(doc) {
  var group = findGroup(doc, "BG IMAGES");
  if (!group) return;
  for (var i = 0; i < group.layers.length; i++) {
    var layer = group.layers[i];
    var was = layer.visible;
    layer.visible = true;
    coverScaleLayer(doc, layer);
    layer.visible = was;
  }
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
  ti.size = (sizePx * 72.0) / doc.resolution;
  setFont(ti);
  ti.justification = Justification.LEFT;
  try {
    ti.autoLeadingAmount = 130;
  } catch (e) {}
  var c = new SolidColor();
  c.rgb.hexValue = "FFFFFF";
  ti.color = c;
  ti.position = [UnitValue(x, "px"), UnitValue(yPx + sizePx * 0.8, "px")];
  try {
    layer.move(doc, ElementPlacement.PLACEATBEGINNING);
  } catch (e2) {}
  return layer;
}

function placePng(doc, file, name, left, top) {
  removeIfExists(doc, name);
  if (!file.exists) return null;
  var src = app.open(file);
  var layer = src.activeLayer.duplicate(doc, ElementPlacement.PLACEATBEGINNING);
  src.close(SaveOptions.DONOTSAVECHANGES);
  app.activeDocument = doc;
  layer.name = name;
  layer.visible = true;
  var b = layer.bounds;
  layer.translate(UnitValue(left - b[0].as("px"), "px"), UnitValue(top - b[1].as("px"), "px"));
  return layer;
}

function makeRule(doc, name, left, top, right, bottom, hex) {
  removeIfExists(doc, name);
  var layer = doc.artLayers.add();
  layer.name = name;
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

/**
 * Place pre-masked logo PNG (wordmark already cut). Do not redraw the 10.
 * Fallback: duplicate in-PSD logo and mask at the wordmark gap (~cut_y 928 on 1350 art),
 * never a naive canvas-fraction cut that chops numeral bottoms.
 */
function makeTenFromLogoMask(doc) {
  removeIfExists(doc, "slot/ten");
  var root = repoRoot();
  var cropFile = new File(root.fsName + "/fixtures/layout-library/assets/ten_logo_crop.png");
  if (cropFile.exists) {
    var srcPng = app.open(cropFile);
    var tenPng = srcPng.activeLayer.duplicate(doc, ElementPlacement.PLACEATBEGINNING);
    srcPng.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = doc;
    tenPng.name = "slot/ten";
    tenPng.visible = true;
    var left = 1;
    var top = 98;
    var right = 1046;
    var bottom = 927;
    var metaFile = new File(root.fsName + "/fixtures/layouts/ten_crop_meta.json");
    if (metaFile.exists) {
      metaFile.open("r");
      var raw = metaFile.read();
      metaFile.close();
      var m = raw.match(/"bbox"\s*:\s*\[\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/);
      if (m) {
        left = parseInt(m[1], 10);
        top = parseInt(m[2], 10);
        right = parseInt(m[3], 10);
        bottom = parseInt(m[4], 10);
      }
    }
    var W = doc.width.as("px");
    var H = doc.height.as("px");
    var authoredW = Math.max(1, right - left);
    var authoredH = Math.max(1, bottom - top);
    var inset = Math.max(36, Math.round(40 * (W / 1080)));
    var scalePad = 0.9;
    var maxBottom = Math.round(966 * (H / 1350));
    var b = tenPng.bounds;
    var lw = Math.max(1, b[2].as("px") - b[0].as("px"));
    var lh = Math.max(1, b[3].as("px") - b[1].as("px"));
    var sFit = Math.min((W - 2 * inset) / authoredW, (maxBottom - inset) / authoredH) * scalePad;
    var s2 = Math.min((authoredW * sFit) / lw, (authoredH * sFit) / lh) * 100;
    tenPng.resize(s2, s2, AnchorPosition.TOPLEFT);
    b = tenPng.bounds;
    tenPng.translate(inset - b[0].as("px"), inset - b[1].as("px"));
    return tenPng;
  }

  var colors = findGroup(doc, "P10 COLORS");
  if (!colors) return null;

  hideAll(colors);
  var src =
    findLayer(colors, "Perfect-Ten-Logo-light-blue") ||
    findLayer(colors, "Perfect-Ten-Logo-dark-Vitality Green") ||
    findLayer(colors, "Perfect-Ten-Logo-dark-green") ||
    colors.layers[0];
  src.visible = true;

  var ten = src.duplicate(doc, ElementPlacement.PLACEATBEGINNING);
  ten.name = "slot/ten";
  ten.visible = true;
  src.visible = false;
  hideAll(colors);

  try {
    ten.rasterize(RasterizeType.ENTIRELAYER);
  } catch (e) {}

  var W2 = doc.width.as("px");
  var H2 = doc.height.as("px");
  // Mask at wordmark gap on layer (928/1350), not canvas*0.68
  var b0 = ten.bounds;
  var layerTop = b0[1].as("px");
  var layerBot = b0[3].as("px");
  var cutY = Math.round(layerTop + (layerBot - layerTop) * (928 / 1350));

  doc.activeLayer = ten;
  doc.selection.select([
    [0, cutY],
    [W2, cutY],
    [W2, H2],
    [0, H2],
  ]);
  try {
    var idMk = charIDToTypeID("Mk  ");
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(charIDToTypeID("Chnl"));
    desc.putReference(charIDToTypeID("null"), ref);
    desc.putEnumerated(
      charIDToTypeID("Nw  "),
      charIDToTypeID("Chnl"),
      charIDToTypeID("Msk ")
    );
    desc.putEnumerated(
      charIDToTypeID("Usng"),
      charIDToTypeID("UsrM"),
      charIDToTypeID("HdSl")
    );
    executeAction(idMk, desc, DialogModes.NO);
  } catch (e3) {
    try {
      doc.selection.clear();
    } catch (e4) {}
  }
  doc.selection.deselect();

  try {
    var b2 = ten.bounds;
    if (b2[0].as("px") < 8) {
      ten.translate(UnitValue(12 - b2[0].as("px"), "px"), UnitValue(0, "px"));
    }
  } catch (e5) {}

  return ten;
}

function prepareOne(srcPath, outPath, textX, textY1, textY2, sizePx) {
  var root = repoRoot();
  var src = new File(root.fsName + "/" + srcPath.replace(/^\.\//, ""));
  if (!src.exists) throw new Error("Missing " + src.fsName);
  var doc = app.open(src);

  var junk = [
    "txt/headline",
    "txt/sub",
    "txt/cta",
    "slot/ten",
    "slot/hero",
    "slot/logo",
    "lock/accent_dot",
    "lock/accent_rule",
    "lock/type_overlay",
    "clr/accent",
    "clr/scrim"
  ];
  for (var i = 0; i < junk.length; i++) removeIfExists(doc, junk[i]);

  coverAllBgs(doc);
  hideAll(findGroup(doc, "P10 COLORS"));
  hideAll(findGroup(doc, "BG GRAPHICS"));
  showOnly(findGroup(doc, "BG IMAGES"), "12");

  makeTenFromLogoMask(doc);

  var headline = makeText(doc, "txt/headline", "Unlock the peace", textX, textY1, sizePx);
  var sub = makeText(doc, "txt/sub", "you deserve", textX, textY2, sizePx);

  var hb = headline.bounds;
  var sb = sub.bounds;
  var dotFile = new File(root.fsName + "/fixtures/layout-library/assets/accent_dot.png");
  var dotSize = 22;
  var pad = 48;
  placePng(
    doc,
    dotFile,
    "lock/accent_dot",
    Math.round(hb[0].as("px") - pad - dotSize),
    Math.round((hb[1].as("px") + hb[3].as("px")) / 2 - dotSize / 2)
  );
  makeRule(
    doc,
    "lock/accent_rule",
    sb[0].as("px"),
    sb[3].as("px") + 16,
    doc.width.as("px"),
    sb[3].as("px") + 21,
    "B6F25C"
  );

  var out = new File(root.fsName + "/" + outPath);
  out.parent.create();
  var opts = new PhotoshopSaveOptions();
  opts.embedColorProfile = true;
  opts.maximizeCompatibility = true;
  doc.saveAs(out, opts, true, Extension.LOWERCASE);
  doc.close(SaveOptions.DONOTSAVECHANGES);
  return out.fsName;
}

function main() {
  var jobs = [
    {
      src: "fixtures/workingsets/1.1.26/4x5_1.1.26/p10test.psd",
      out: "fixtures/templater/templates/tpl_4x5.psd",
      x: 235,
      y1: 1015,
      y2: 1145,
      size: 90
    },
    {
      src: "fixtures/workingsets/1.1.26/1x1_1.1.26/p10test_1x1.psd",
      out: "fixtures/templater/templates/tpl_1x1.psd",
      x: 200,
      y1: 800,
      y2: 920,
      size: 72
    },
    {
      src: "fixtures/workingsets/1.1.26/9x16_1.1.26/p10test_9x16.psd",
      out: "fixtures/templater/templates/tpl_9x16.psd",
      x: 200,
      y1: 1480,
      y2: 1620,
      size: 84
    },
    {
      src: "fixtures/workingsets/1.1.26/16x9_1.1.26/p10test_16x9.psd",
      out: "fixtures/templater/templates/tpl_16x9.psd",
      x: 360,
      y1: 800,
      y2: 920,
      size: 72
    }
  ];

  var log = [];
  for (var j = 0; j < jobs.length; j++) {
    var job = jobs[j];
    try {
      log.push("OK " + prepareOne(job.src, job.out, job.x, job.y1, job.y2, job.size));
    } catch (e) {
      log.push("FAIL " + job.out + " :: " + e);
    }
  }
  var f = new File(repoRoot().fsName + "/fixtures/templater/prepare_log.txt");
  f.open("w");
  f.write(log.join("\n"));
  f.close();
}

try {
  main();
} catch (e) {
  throw e;
}
