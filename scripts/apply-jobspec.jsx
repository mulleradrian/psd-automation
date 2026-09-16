/**
 * Apply a JobSpec JSON to the active (or opened) document — ExtendScript fallback
 * when the UXP handshake folder hasn't been granted yet.
 *
 * Usage: Photoshop.exe scripts/apply-jobspec.jsx
 * Reads: jobs/queue/job_*_4x5.json (latest) OR JOBSPEC_PATH env via argument file
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

function setText(layer, value) {
  if (layer.kind !== LayerKind.TEXT) throw new Error(layer.name + " not text");
  layer.textItem.contents = value;
}

function setFillApprox(layer, hex) {
  // Best-effort: fill opaque pixels of a raster/fill layer
  app.activeDocument.activeLayer = layer;
  var c = new SolidColor();
  c.rgb.hexValue = String(hex).replace("#", "");
  try {
    // Prefer fill if selection possible
    if (layer.kind === LayerKind.TEXT) {
      layer.textItem.color = c;
      return;
    }
  } catch (e) {}
  try {
    app.activeDocument.selection.selectAll();
    app.activeDocument.selection.fill(c, ColorBlendMode.NORMAL, 100, true);
    app.activeDocument.selection.deselect();
  } catch (e2) {
    throw e2;
  }
}

function main() {
  var root = repoRoot();
  var queue = new Folder(root.fsName + "/jobs/queue");
  var jobFile = latestJob(queue, "_4x5");
  if (!jobFile) throw new Error("No *_4x5.json in jobs/queue");

  var spec = eval("(" + readText(jobFile) + ")"); // JobSpec is JSON
  var tpl = new File(spec.templatePath);
  if (!tpl.exists) throw new Error("Missing template: " + tpl.fsName);

  var doc = app.open(tpl);
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
      if (edit.op === "setText") {
        setText(layer, edit.value);
        applied.push(edit.layer + ":setText");
      } else if (edit.op === "setFill") {
        setFillApprox(layer, edit.hex);
        applied.push(edit.layer + ":setFill");
      } else if (edit.op === "setFont") {
        if (layer.kind === LayerKind.TEXT && edit.postScript) {
          try {
            layer.textItem.font = edit.postScript;
          } catch (fe) {
            skipped.push("font:" + edit.layer + ":" + fe);
            continue;
          }
        }
        applied.push(edit.layer + ":setFont");
      } else if (edit.op === "replaceSmartObject") {
        // ExtendScript SO replace is fragile; skip and let UXP handle
        skipped.push("so_skip:" + edit.layer);
      } else {
        skipped.push("unknown:" + edit.op);
      }
    } catch (err) {
      skipped.push("err:" + edit.layer + ":" + err);
    }
  }

  // Export JPG into working set
  var exp = spec.exports[0];
  var outDir = new Folder(spec.workingSetPath + "/" + exp.subdir);
  if (!outDir.exists) outDir.create();
  var outFile = new File(outDir.fsName + "/" + exp.filename);
  var jpg = new JPEGSaveOptions();
  jpg.quality = 10;
  jpg.embedColorProfile = true;
  doc.saveAs(outFile, jpg, true, Extension.LOWERCASE);

  var working = new File(spec.workingSetPath + "/" + spec.contentId + "_working.psd");
  var psdOpts = new PhotoshopSaveOptions();
  doc.saveAs(working, psdOpts, true, Extension.LOWERCASE);

  // Write a result sidecar next to job for orchestrator-style visibility
  var result = new File(root.fsName + "/jobs/handshake/" + spec.jobId + ".result.json");
  result.open("w");
  result.encoding = "UTF-8";
  result.write(
    '{"jobId":"' +
      spec.jobId +
      '","status":"Rendered","outputPaths":["' +
      outFile.fsName.replace(/\\/g, "\\\\") +
      '"],"finishedAt":"' +
      new Date().toISOString() +
      '","notes":"jsx-apply applied=' +
      applied.join("|") +
      " skipped=" +
      skipped.join("|") +
      '"}'
  );
  result.close();

  alert(
    "Applied JobSpec " +
      spec.jobId +
      "\n\nApplied:\n" +
      applied.join("\n") +
      "\n\nSkipped:\n" +
      skipped.join("\n") +
      "\n\nExport:\n" +
      outFile.fsName
  );
}

try {
  main();
} catch (e) {
  alert("apply-jobspec failed:\n" + e);
  throw e;
}
