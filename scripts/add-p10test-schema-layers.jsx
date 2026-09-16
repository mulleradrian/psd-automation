/**
 * Add minimal automation schema layers on top of p10test for UXP testing.
 * Safe: does not delete existing design layers.
 *
 * Adds:
 *   txt/headline, txt/sub, txt/cta
 *   clr/accent (solid fill)
 *   slot/hero, slot/logo aliases as note layers if missing
 */
#target photoshop
app.displayDialogs = DialogModes.NO;

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

function ensureTextLayer(doc, name, contents, sizePt, colorHex, yOffset) {
  if (findLayer(doc, name)) return;
  var layer = doc.artLayers.add();
  layer.kind = LayerKind.TEXT;
  layer.name = name;
  var ti = layer.textItem;
  ti.contents = contents;
  ti.size = sizePt;
  ti.font = "ArialMT";
  ti.justification = Justification.CENTER;
  ti.position = [doc.width.as("px") / 2, yOffset];
  var c = new SolidColor();
  c.rgb.hexValue = colorHex;
  ti.color = c;
}

function ensureSolidFill(doc, name, hex) {
  if (findLayer(doc, name)) return;
  // Create a normal fill layer via solid color art layer
  var layer = doc.artLayers.add();
  layer.name = name;
  layer.kind = LayerKind.NORMAL;
  // Fill selection
  doc.selection.selectAll();
  var c = new SolidColor();
  c.rgb.hexValue = hex;
  doc.selection.fill(c);
  doc.selection.deselect();
  layer.opacity = 20;
  // Move to bottom-ish (above Background if present)
  try {
    layer.move(doc.layers[doc.layers.length - 1], ElementPlacement.PLACEBEFORE);
  } catch (e) {}
}

function main() {
  if (!app.documents.length) {
    throw new Error("Open p10test.psd first");
  }
  var doc = app.activeDocument;
  ensureTextLayer(doc, "txt/headline", "Unlock the peace you deserve", 48, "FFFFFF", doc.height.as("px") * 0.72);
  ensureTextLayer(doc, "txt/sub", "Find calm in every stay.", 28, "FFFFFF", doc.height.as("px") * 0.80);
  ensureTextLayer(doc, "txt/cta", "Book now", 22, "FFFFFF", doc.height.as("px") * 0.88);
  ensureSolidFill(doc, "clr/accent", "2E5C4E");

  // Rename a visible BG image SO to slot/hero if none exists
  if (!findLayer(doc, "slot/hero")) {
    // Prefer first SO under BG IMAGES
    try {
      var bgImages = null;
      for (var i = 0; i < doc.layerSets.length; i++) {
        if (doc.layerSets[i].name === "BG IMAGES") {
          bgImages = doc.layerSets[i];
          break;
        }
      }
      if (bgImages && bgImages.artLayers.length) {
        // Duplicate top art layer and rename duplicate for schema (keep original)
        var src = bgImages.artLayers[0];
        var dup = src.duplicate();
        dup.name = "slot/hero";
      }
    } catch (e2) {
      $.writeln("slot/hero skip: " + e2);
    }
  }

  if (!findLayer(doc, "slot/logo")) {
    try {
      var colors = null;
      for (var j = 0; j < doc.layerSets.length; j++) {
        if (doc.layerSets[j].name === "P10 COLORS") {
          colors = doc.layerSets[j];
          break;
        }
      }
      if (colors && colors.artLayers.length) {
        var logoDup = colors.artLayers[0].duplicate();
        logoDup.name = "slot/logo";
      }
    } catch (e3) {
      $.writeln("slot/logo skip: " + e3);
    }
  }

  doc.save();
  alert("Schema layers added and document saved.");
}

try {
  main();
} catch (e) {
  alert("add-schema-layers failed:\n" + e);
  throw e;
}
