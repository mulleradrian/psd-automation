/**
 * Perfect Ten IG 4:5 — paragraph text boxes with fixed geometry.
 * Each field owns a non-overlapping box. No point-text overflow.
 */
#target photoshop
app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;

function repoRoot() {
  return new File($.fileName).parent.parent;
}

function ensureFolder(path) {
  var f = new Folder(path);
  if (!f.exists) f.create();
  return f;
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

function findGroup(doc, name) {
  for (var i = 0; i < doc.layerSets.length; i++) {
    if (doc.layerSets[i].name === name) return doc.layerSets[i];
  }
  return null;
}

function setExclusiveVisible(group, keepName) {
  if (!group) return;
  for (var i = 0; i < group.layers.length; i++) {
    var layer = group.layers[i];
    var n = String(layer.name);
    if (n.indexOf("slot/") === 0 || n.indexOf("txt/") === 0 || n.indexOf("clr/") === 0) continue;
    layer.visible = keepName ? layer.name === keepName : false;
  }
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

function bringToFront(doc, layer) {
  try {
    layer.move(doc, ElementPlacement.PLACEATBEGINNING);
  } catch (e) {
    try {
      layer.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
    } catch (e2) {}
  }
}

function makeScrim(doc, top, bottom) {
  removeIfExists(doc, "clr/scrim");
  var layer = doc.artLayers.add();
  layer.name = "clr/scrim";
  doc.selection.select([
    [0, top],
    [1080, top],
    [1080, bottom],
    [0, bottom]
  ]);
  var c = new SolidColor();
  c.rgb.hexValue = "000000";
  doc.selection.fill(c);
  doc.selection.deselect();
  layer.opacity = 50;
  bringToFront(doc, layer);
}

/**
 * Paragraph text in a fixed box — cannot spill into neighbors.
 * x,y = top-left of box; w,h = box size in px.
 */
function makeBoxText(doc, name, contents, sizePt, x, y, w, h, colorHex, fontName) {
  removeIfExists(doc, name);
  var clean = String(contents).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");
  var layer = doc.artLayers.add();
  layer.kind = LayerKind.TEXT;
  layer.name = name;
  var ti = layer.textItem;
  ti.kind = TextType.PARAGRAPHTEXT;
  ti.position = [x, y];
  try {
    ti.width = w;
    ti.height = h;
  } catch (e) {}
  ti.contents = clean;
  ti.size = sizePt;
  ti.font = fontName || "ArialMT";
  ti.justification = Justification.CENTER;
  try {
    ti.useAutoLeading = false;
    ti.leading = Math.round(sizePt * 1.2);
  } catch (e2) {}
  var c = new SolidColor();
  c.rgb.hexValue = String(colorHex || "FFFFFF").replace("#", "");
  ti.color = c;
  bringToFront(doc, layer);
  return layer;
}

function applyTextStack(doc, variant) {
  var hex = variant.textHex || "FFFFFF";
  // Band above PerfectTen wordmark (~y 1150+)
  makeScrim(doc, 820, 1120);
  // Fixed non-overlapping boxes (60–70px tall each, 20px gaps)
  makeBoxText(doc, "txt/cta", variant.cta, 16, 80, 1040, 920, 50, hex, "ArialMT");
  makeBoxText(doc, "txt/sub", variant.sub, 18, 80, 970, 920, 50, hex, "ArialMT");
  makeBoxText(
    doc,
    "txt/headline",
    variant.headline,
    variant.headlineSize || 26,
    80,
    860,
    920,
    90,
    hex,
    "Arial-BoldMT"
  );
}

function applyVariant(doc, variant) {
  setExclusiveVisible(findGroup(doc, "BG IMAGES"), variant.bg);
  if (variant.graphic) {
    setExclusiveVisible(findGroup(doc, "BG GRAPHICS"), variant.graphic);
  } else {
    setExclusiveVisible(findGroup(doc, "BG GRAPHICS"), null);
  }
  setExclusiveVisible(findGroup(doc, "P10 COLORS"), variant.logo);
  applyTextStack(doc, variant);
}

function exportJpg(doc, outFile) {
  var opts = new JPEGSaveOptions();
  opts.quality = 11;
  opts.embedColorProfile = true;
  doc.saveAs(outFile, opts, true, Extension.LOWERCASE);
}

function main() {
  var root = repoRoot();
  var master = new File(root.fsName + "/fixtures/templates/p10test/p10test_clean.psd");
  if (!master.exists) throw new Error("Missing p10test_clean.psd");
  var outDir = ensureFolder(root.fsName + "/fixtures/layout-library/p10_ig_4x5");

  var old = outDir.getFiles("*.jpg");
  for (var o = 0; o < old.length; o++) old[o].remove();

  var doc = app.open(master);
  var junk = ["clr/accent", "clr/scrim", "txt/headline", "txt/sub", "txt/cta", "slot/hero", "slot/logo"];
  for (var j = 0; j < junk.length; j++) removeIfExists(doc, junk[j]);

  var baseline = {
    id: "Q1_W1_01_baseline",
    bg: "12",
    graphic: null,
    logo: "Perfect-Ten-Logo-light-blue",
    headline: "Unlock the peace you deserve",
    sub: "Find calm in every stay.",
    cta: "Book now",
    textHex: "FFFFFF",
    headlineSize: 26
  };

  var variants = [
    baseline,
    {
      id: "var_bg_9",
      bg: "9",
      graphic: null,
      logo: baseline.logo,
      headline: baseline.headline,
      sub: baseline.sub,
      cta: baseline.cta,
      textHex: "FFFFFF",
      headlineSize: 26
    },
    {
      id: "var_bg_10",
      bg: "10",
      graphic: null,
      logo: baseline.logo,
      headline: baseline.headline,
      sub: baseline.sub,
      cta: baseline.cta,
      textHex: "FFFFFF",
      headlineSize: 26
    },
    {
      id: "var_bg_11",
      bg: "11",
      graphic: null,
      logo: baseline.logo,
      headline: baseline.headline,
      sub: baseline.sub,
      cta: baseline.cta,
      textHex: "FFFFFF",
      headlineSize: 26
    },
    {
      id: "var_logo_darkgreen",
      bg: "12",
      graphic: null,
      logo: "Perfect-Ten-Logo-dark-green",
      headline: baseline.headline,
      sub: baseline.sub,
      cta: baseline.cta,
      textHex: "FFFFFF",
      headlineSize: 26
    },
    {
      id: "var_logo_vitality",
      bg: "12",
      graphic: null,
      logo: "Perfect-Ten-Logo-dark-Vitality Green",
      headline: baseline.headline,
      sub: baseline.sub,
      cta: baseline.cta,
      textHex: "FFFFFF",
      headlineSize: 26
    },
    {
      id: "var_copy_morning",
      bg: "12",
      graphic: null,
      logo: baseline.logo,
      headline: "Morning light awaits",
      sub: "Start soft. Stay longer.",
      cta: "Explore stays",
      textHex: "FFFFFF",
      headlineSize: 28
    },
    {
      id: "var_copy_neighbourhood",
      bg: "12",
      graphic: null,
      logo: baseline.logo,
      headline: "The neighbourhood knows",
      sub: "Local gems, curated for you.",
      cta: "Join Perfect Ten",
      textHex: "FFFFFF",
      headlineSize: 24
    },
    {
      id: "var_combo_bg9_vitality",
      bg: "9",
      graphic: null,
      logo: "Perfect-Ten-Logo-dark-Vitality Green",
      headline: "Stay vibrant. Stay Perfect Ten.",
      sub: "Wellness built into every night.",
      cta: "Learn more",
      textHex: "FFFFFF",
      headlineSize: 22
    }
  ];

  for (var v = 0; v < variants.length; v++) {
    applyVariant(doc, variants[v]);
    exportJpg(doc, new File(outDir.fsName + "/" + variants[v].id + ".jpg"));
  }

  applyVariant(doc, baseline);
  var psdOpts = new PhotoshopSaveOptions();
  psdOpts.embedColorProfile = true;
  psdOpts.maximizeCompatibility = true;
  doc.saveAs(
    new File(root.fsName + "/fixtures/templates/p10test/tpl_p10_ig_4x5_library.psd"),
    psdOpts,
    true,
    Extension.LOWERCASE
  );
  $.writeln("DONE " + variants.length);
}

try {
  main();
} catch (e) {
  $.writeln("FAILED: " + e);
  throw e;
}
