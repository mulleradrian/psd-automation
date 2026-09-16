/**
 * Dump top-level + nested layer names from tpl_4x5 for smoke required-list.
 */
#target photoshop
app.displayDialogs = DialogModes.NO;

function repoRoot() {
  return new File($.fileName).parent.parent;
}

function dump(layers, indent, out) {
  for (var i = 0; i < layers.length; i++) {
    var L = layers[i];
    out.push(indent + L.name + " [" + L.typename + "]");
    if (L.typename === "LayerSet") dump(L.layers, indent + "  ", out);
  }
}

var f = new File(repoRoot().fsName + "/fixtures/templater/templates/tpl_4x5.psd");
var doc = app.open(f);
var out = [];
out.push("SIZE " + Math.round(doc.width.as("px")) + "x" + Math.round(doc.height.as("px")));
dump(doc.layers, "", out);
doc.close(SaveOptions.DONOTSAVECHANGES);
var log = new File(repoRoot().fsName + "/fixtures/templater/layer_dump_4x5.txt");
log.open("w");
log.write(out.join("\n"));
log.close();
