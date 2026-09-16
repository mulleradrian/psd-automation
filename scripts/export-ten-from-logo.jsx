/**
 * Export a clean white "10" matte from Perfect Ten logo layers in p10test.psd.
 * Strategy: show one dark logo on black, threshold to white silhouette, save PNG.
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

function hideAll(group) {
  if (!group) return;
  for (var i = 0; i < group.layers.length; i++) group.layers[i].visible = false;
}

function main() {
  var root = repoRoot();
  var master = new File(root.fsName + "/fixtures/templates/p10test/p10test_clean.psd");
  if (!master.exists) master = new File(root.fsName + "/fixtures/templates/p10test/p10test.psd");
  var doc = app.open(master);

  hideAll(findGroup(doc, "BG IMAGES"));
  hideAll(findGroup(doc, "BG GRAPHICS"));
  var colors = findGroup(doc, "P10 COLORS");
  hideAll(colors);

  // Prefer dark-green logo (light "10" strokes on dark plate)
  var picked = null;
  if (colors) {
    for (var i = 0; i < colors.layers.length; i++) {
      var n = colors.layers[i].name;
      if (n.indexOf("dark-green") >= 0 || n.indexOf("Vitality") >= 0 || n.indexOf("light-blue") >= 0) {
        colors.layers[i].visible = true;
        picked = n;
        break;
      }
    }
  }

  // Fill background black
  try {
    doc.activeLayer = doc.backgroundLayer;
  } catch (e) {}
  // Flatten for export
  var flat = doc.duplicate("ten_export", true);
  flat.flatten();
  // Desaturate + levels to pull white 10
  flat.activeLayer.desaturate();

  var outDir = new Folder(root.fsName + "/fixtures/layout-library/assets");
  if (!outDir.exists) outDir.create();
  var png = new File(outDir.fsName + "/ten_from_logo.png");
  var opts = new PNGSaveOptions();
  opts.compression = 5;
  flat.saveAs(png, opts, true, Extension.LOWERCASE);

  // Also JPG preview
  var jpg = new File(outDir.fsName + "/ten_from_logo_preview.jpg");
  var jo = new JPEGSaveOptions();
  jo.quality = 10;
  flat.saveAs(jpg, jo, true, Extension.LOWERCASE);

  flat.close(SaveOptions.DONOTSAVECHANGES);
  doc.close(SaveOptions.DONOTSAVECHANGES);

  var log = new File(root.fsName + "/fixtures/layouts/ten_export_log.txt");
  log.open("w");
  log.write("picked=" + picked + "\nout=" + png.fsName);
  log.close();
}

try {
  main();
} catch (e) {
  throw e;
}
