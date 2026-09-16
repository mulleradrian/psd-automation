/**
 * Smoke export: show a BG and JPEG the baked templates as-is.
 * Does NOT rewrite type or remask the 10 (those come from fix-slot-ten-templates.jsx).
 */
#target photoshop
app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;

function repoRoot() {
  return new File($.fileName).parent.parent;
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

function showBg(doc, bgName) {
  var g = findLayer(doc.layers, "BG IMAGES");
  if (!g) return;
  for (var i = 0; i < g.layers.length; i++) {
    g.layers[i].visible = g.layers[i].name === String(bgName);
  }
}

function exportOne(rel, outName) {
  var root = repoRoot();
  var f = new File(root.fsName + "/" + rel);
  var doc = app.open(f);
  showBg(doc, "9");

  var outDir = new Folder(root.fsName + "/fixtures/templater/smoke-exports");
  if (!outDir.exists) outDir.create();
  var jpg = new File(outDir.fsName + "/" + outName);
  var opts = new JPEGSaveOptions();
  opts.quality = 10;
  doc.saveAs(jpg, opts, true, Extension.LOWERCASE);

  var ten = findLayer(doc.layers, "slot/ten");
  var note = outName;
  if (ten) {
    var b = ten.bounds;
    note +=
      " ten=[" +
      Math.round(b[0].as("px")) +
      "," +
      Math.round(b[1].as("px")) +
      "," +
      Math.round(b[2].as("px")) +
      "," +
      Math.round(b[3].as("px")) +
      "] canvas=" +
      Math.round(doc.width.as("px")) +
      "x" +
      Math.round(doc.height.as("px"));
  }
  doc.close(SaveOptions.DONOTSAVECHANGES);
  return note;
}

var log = [];
try {
  log.push(exportOne("fixtures/templater/templates/tpl_4x5.psd", "smoke_4x5.jpg"));
  log.push(exportOne("fixtures/templater/templates/tpl_1x1.psd", "smoke_1x1.jpg"));
  log.push(exportOne("fixtures/templater/templates/tpl_9x16.psd", "smoke_9x16.jpg"));
  log.push(exportOne("fixtures/templater/templates/tpl_16x9.psd", "smoke_16x9.jpg"));
  log.push("DONE");
} catch (e) {
  log.push("FAIL " + e);
}
var lf = new File(repoRoot().fsName + "/fixtures/templater/apply_smoke_log.txt");
lf.open("w");
lf.write(log.join("\n"));
lf.close();
