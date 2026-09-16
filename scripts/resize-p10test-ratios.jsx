/**
 * Create aspect-ratio variants from p10test.psd (4:5 master).
 * Run: Photoshop.exe path\to\resize-p10test-ratios.jsx
 * Or File > Scripts > Browse…
 *
 * Expects: fixtures/templates/p10test/p10test.psd
 * Writes:  p10test_1x1.psd, p10test_9x16.psd, p10test_16x9.psd
 *          (+ keeps master as 4:5 reference)
 */
#target photoshop
app.displayDialogs = DialogModes.NO;

function repoRootFromScript() {
  var f = new File($.fileName);
  return f.parent.parent; // scripts/ -> repo root
}

function ensureFolder(folder) {
  if (!folder.exists) folder.create();
  return folder;
}

function openPsd(file) {
  if (!file.exists) {
    throw new Error("Missing PSD: " + file.fsName);
  }
  return app.open(file);
}

/**
 * Cover-fit resize: scale so the target ratio is filled, then center-crop.
 * Preserves smart objects / layers better than a naive stretch.
 */
function resizeCoverCrop(doc, targetW, targetH) {
  var srcW = doc.width.as("px");
  var srcH = doc.height.as("px");
  var scale = Math.max(targetW / srcW, targetH / srcH);
  var newW = Math.round(srcW * scale);
  var newH = Math.round(srcH * scale);

  doc.resizeImage(
    UnitValue(newW, "px"),
    UnitValue(newH, "px"),
    doc.resolution,
    ResampleMethod.BICUBICAUTOMATIC
  );

  // Center crop via canvas size
  doc.resizeCanvas(
    UnitValue(targetW, "px"),
    UnitValue(targetH, "px"),
    AnchorPosition.MIDDLECENTER
  );
}

function saveAsPsd(doc, outFile) {
  var opts = new PhotoshopSaveOptions();
  opts.embedColorProfile = true;
  opts.maximizeCompatibility = true;
  doc.saveAs(outFile, opts, true, Extension.LOWERCASE);
}

function main() {
  var root = repoRootFromScript();
  var srcDir = new Folder(root.fsName + "/fixtures/templates/p10test");
  var src = new File(srcDir.fsName + "/p10test.psd");
  ensureFolder(srcDir);

  var variants = [
    { name: "p10test_1x1.psd", w: 1080, h: 1080, label: "1:1" },
    { name: "p10test_9x16.psd", w: 1080, h: 1920, label: "9:16" },
    { name: "p10test_16x9.psd", w: 1920, h: 1080, label: "16:9" },
    // Keep a normalized 4:5 export at common IG size as well
    { name: "p10test_4x5.psd", w: 1080, h: 1350, label: "4:5" }
  ];

  var master = openPsd(src);
  var masterW = master.width.as("px");
  var masterH = master.height.as("px");
  $.writeln("Master: " + masterW + "x" + masterH);

  for (var i = 0; i < variants.length; i++) {
    var v = variants[i];
    var dup = master.duplicate(v.label, true);
    resizeCoverCrop(dup, v.w, v.h);
    var out = new File(srcDir.fsName + "/" + v.name);
    saveAsPsd(dup, out);
    dup.close(SaveOptions.DONOTSAVECHANGES);
    $.writeln("Wrote " + out.fsName + " (" + v.w + "x" + v.h + ")");
  }

  // Leave master open for UXP automation testing
  app.activeDocument = master;
  alert(
    "Ratio variants written to:\n" +
      srcDir.fsName +
      "\n\nMaster left open for automation testing."
  );
}

try {
  main();
} catch (e) {
  alert("resize-p10test-ratios failed:\n" + e);
  throw e;
}
