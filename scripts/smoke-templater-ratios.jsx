/**
 * Smoke-test templater PSDs: open each ratio, check required layers + canvas size.
 * Writes fixtures/templater/ratio_smoke_log.txt
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

function checkOne(rel, expectW, expectH, required) {
  var root = repoRoot();
  var f = new File(root.fsName + "/" + rel);
  if (!f.exists) return "MISSING " + rel;
  var doc = app.open(f);
  var lines = [];
  var w = Math.round(doc.width.as("px"));
  var h = Math.round(doc.height.as("px"));
  if (w !== expectW || h !== expectH) {
    lines.push("SIZE " + w + "x" + h + " expected " + expectW + "x" + expectH);
  } else {
    lines.push("SIZE OK " + w + "x" + h);
  }
  for (var i = 0; i < required.length; i++) {
    var name = required[i];
    lines.push((findLayer(doc.layers, name) ? "OK " : "MISS ") + name);
  }
  doc.close(SaveOptions.DONOTSAVECHANGES);
  return rel + "\n  " + lines.join("\n  ");
}

function main() {
  var required = [
    "txt/headline",
    "txt/sub",
    "BG IMAGES",
    "lock/accent_dot",
    "lock/accent_rule",
    "slot/ten",
  ];
  var soft = ["P10 COLORS", "BG GRAPHICS"];
  var log = [];
  try {
    log.push(checkOne("fixtures/templater/templates/tpl_4x5.psd", 1080, 1350, required));
    log.push(checkOne("fixtures/templater/templates/tpl_1x1.psd", 1080, 1080, required));
    log.push(checkOne("fixtures/templater/templates/tpl_9x16.psd", 1080, 1920, required));
    log.push(checkOne("fixtures/templater/templates/tpl_16x9.psd", 1920, 1080, required));

    // Soft presence on 4x5 only (report)
    var root = repoRoot();
    var f = new File(root.fsName + "/fixtures/templater/templates/tpl_4x5.psd");
    var doc = app.open(f);
    for (var i = 0; i < soft.length; i++) {
      log.push((findLayer(doc.layers, soft[i]) ? "SOFT OK " : "SOFT MISS ") + soft[i]);
    }
    doc.close(SaveOptions.DONOTSAVECHANGES);
    log.push("DONE");
  } catch (e) {
    log.push("FAIL " + e);
  }
  var out = new File(repoRoot().fsName + "/fixtures/templater/ratio_smoke_log.txt");
  out.open("w");
  out.write(log.join("\n"));
  out.close();
}

main();
