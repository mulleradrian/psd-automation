/**
 * Dump tpl_p10_preview_matched.psd layer stack + bounds.
 */
#target photoshop
app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;

function repoRoot() {
  return new File($.fileName).parent.parent;
}

var lines = [];
function dump(container, indent) {
  for (var i = 0; i < container.layers.length; i++) {
    var layer = container.layers[i];
    var b = "";
    try {
      var bounds = layer.bounds;
      b =
        " bounds=[" +
        bounds[0].as("px") +
        "," +
        bounds[1].as("px") +
        "," +
        bounds[2].as("px") +
        "," +
        bounds[3].as("px") +
        "]";
    } catch (e) {}
    lines.push(indent + layer.name + " [" + layer.typename + "] vis=" + layer.visible + b);
    if (layer.typename === "LayerSet") dump(layer, indent + "  ");
  }
}

var root = repoRoot();
var file = new File(root.fsName + "/fixtures/templates/p10test/tpl_p10_preview_matched.psd");
var doc = app.open(file);
lines.push("size " + doc.width.as("px") + "x" + doc.height.as("px"));
dump(doc, "");
doc.close(SaveOptions.DONOTSAVECHANGES);
var out = new File(root.fsName + "/fixtures/layouts/matched_diag.txt");
out.open("w");
out.write(lines.join("\n"));
out.close();
