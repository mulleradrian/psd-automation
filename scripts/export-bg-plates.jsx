/**
 * Export BG-only plates from p10test (no logos / no PerfectTen wordmark).
 * These become photo slots for the Preview-matched compositor.
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

function findGroup(doc, name) {
  for (var i = 0; i < doc.layerSets.length; i++) {
    if (doc.layerSets[i].name === name) return doc.layerSets[i];
  }
  return null;
}

function hideAllInGroup(group) {
  if (!group) return;
  for (var i = 0; i < group.layers.length; i++) group.layers[i].visible = false;
}

function showOnly(group, name) {
  hideAllInGroup(group);
  if (!group) return;
  for (var i = 0; i < group.layers.length; i++) {
    if (group.layers[i].name === name) group.layers[i].visible = true;
  }
}

function exportJpg(doc, outFile) {
  var opts = new JPEGSaveOptions();
  opts.quality = 12;
  opts.embedColorProfile = true;
  doc.saveAs(outFile, opts, true, Extension.LOWERCASE);
}

function main() {
  var root = repoRoot();
  // Prefer live master; fall back to clean snapshot
  var master = new File(root.fsName + "/fixtures/templates/p10test/p10test.psd");
  if (!master.exists) {
    master = new File(root.fsName + "/fixtures/templates/p10test/p10test_clean.psd");
  }
  var outDir = ensureFolder(root.fsName + "/fixtures/layout-library/plates");
  var doc = app.open(master);

  // Strip any prior schema junk if present
  for (var i = doc.layers.length - 1; i >= 0; i--) {
    var n = doc.layers[i].name;
    if (n.indexOf("txt/") === 0 || n.indexOf("clr/") === 0 || n.indexOf("slot/") === 0 || n.indexOf("lock/") === 0) {
      try {
        doc.layers[i].remove();
      } catch (e) {
        doc.layers[i].visible = false;
      }
    }
  }

  hideAllInGroup(findGroup(doc, "P10 COLORS")); // kill PerfectTen wordmarks
  hideAllInGroup(findGroup(doc, "BG GRAPHICS"));
  var bgs = ["9", "10", "11", "12"];
  var bgGroup = findGroup(doc, "BG IMAGES");
  for (var b = 0; b < bgs.length; b++) {
    showOnly(bgGroup, bgs[b]);
    exportJpg(doc, new File(outDir.fsName + "/bg_" + bgs[b] + ".jpg"));
  }
  doc.close(SaveOptions.DONOTSAVECHANGES);
  $.writeln("plates exported");
}

try {
  main();
} catch (e) {
  $.writeln("FAILED: " + e);
  throw e;
}
