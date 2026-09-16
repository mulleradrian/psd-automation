/**
 * Apply latest *_1x1 JobSpec (same as apply-jobspec.jsx but 1x1).
 */
#target photoshop
app.displayDialogs = DialogModes.NO;

function repoRoot() {
  return new File($.fileName).parent.parent;
}
function readText(file) {
  file.open("r");
  file.encoding = "UTF-8";
  var t = file.read();
  file.close();
  return t;
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
function latestJob(queueFolder, suffix) {
  var files = queueFolder.getFiles("*" + suffix + ".json");
  if (!files || !files.length) return null;
  files.sort(function (a, b) {
    return b.modified.getTime() - a.modified.getTime();
  });
  return files[0];
}
function main() {
  var root = repoRoot();
  var jobFile = latestJob(new Folder(root.fsName + "/jobs/queue"), "_1x1");
  if (!jobFile) throw new Error("No *_1x1.json in jobs/queue");
  var spec = eval("(" + readText(jobFile) + ")");
  var doc = app.open(new File(spec.templatePath));
  var applied = [];
  var skipped = [];
  for (var i = 0; i < spec.edits.length; i++) {
    var edit = spec.edits[i];
    var layer = findLayer(doc, edit.layer);
    if (!layer) {
      skipped.push("missing:" + edit.layer);
      continue;
    }
    try {
      if (edit.op === "setText" && layer.kind === LayerKind.TEXT) {
        layer.textItem.contents = edit.value;
        applied.push(edit.layer);
      } else if (edit.op === "setFill") {
        app.activeDocument.activeLayer = layer;
        var c = new SolidColor();
        c.rgb.hexValue = String(edit.hex).replace("#", "");
        if (layer.kind === LayerKind.TEXT) layer.textItem.color = c;
        else {
          app.activeDocument.selection.selectAll();
          app.activeDocument.selection.fill(c, ColorBlendMode.NORMAL, 100, true);
          app.activeDocument.selection.deselect();
        }
        applied.push(edit.layer);
      } else if (edit.op === "setFont" && layer.kind === LayerKind.TEXT) {
        try {
          layer.textItem.font = edit.postScript;
        } catch (fe) {}
        applied.push(edit.layer + ":font");
      } else {
        skipped.push(edit.op + ":" + edit.layer);
      }
    } catch (err) {
      skipped.push("err:" + edit.layer);
    }
  }
  var exp = spec.exports[0];
  var outDir = new Folder(spec.workingSetPath + "/" + exp.subdir);
  if (!outDir.exists) outDir.create();
  var outFile = new File(outDir.fsName + "/" + exp.filename);
  var jpg = new JPEGSaveOptions();
  jpg.quality = 10;
  doc.saveAs(outFile, jpg, true, Extension.LOWERCASE);
  alert("1x1 export:\n" + outFile.fsName + "\nApplied: " + applied.join(", "));
}
try {
  main();
} catch (e) {
  alert(e);
  throw e;
}
