/**
 * Diagnose p10test canvas size + layer stack after open.
 */
#target photoshop
app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;

function repoRoot() {
  return new File($.fileName).parent.parent;
}

var lines = [];
function dumpLayers(container, indent) {
  for (var i = 0; i < container.layers.length; i++) {
    var layer = container.layers[i];
    lines.push(indent + layer.name + " [" + layer.typename + "] vis=" + layer.visible);
    if (layer.typename === "LayerSet") dumpLayers(layer, indent + "  ");
  }
}

var root = repoRoot();
var master = new File(root.fsName + "/fixtures/templates/p10test/p10test.psd");
var doc = app.open(master);
lines.push("size " + doc.width.as("px") + "x" + doc.height.as("px") + " dpi=" + doc.resolution);
dumpLayers(doc, "");
doc.close(SaveOptions.DONOTSAVECHANGES);
var out = new File(root.fsName + "/fixtures/layouts/p10test_diag.txt");
out.open("w");
out.write(lines.join("\n"));
out.close();
