#target photoshop
app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;
function repoRoot(){ return new File($.fileName).parent.parent; }
function findGroup(doc,name){ for(var i=0;i<doc.layerSets.length;i++) if(doc.layerSets[i].name===name) return doc.layerSets[i]; return null; }
function hideAll(g){ if(!g) return; for(var i=0;i<g.layers.length;i++) g.layers[i].visible=false; }
var root = new File("C:/Users/amull/Documents/des/psd-automation");
var doc = app.open(new File(root.fsName + "/fixtures/templates/p10test/p10test_clean.psd"));
hideAll(findGroup(doc,"BG IMAGES")); hideAll(findGroup(doc,"BG GRAPHICS"));
var colors=findGroup(doc,"P10 COLORS"); hideAll(colors);
var names=[];
for(var i=0;i<colors.layers.length;i++){
  names.push(colors.layers[i].name);
  colors.layers[i].visible=true;
  var flat=doc.duplicate("t"+i,true); flat.flatten();
  var f=new File(root.fsName+"/fixtures/layout-library/assets/logo_"+i+".jpg");
  var jo=new JPEGSaveOptions(); jo.quality=8; flat.saveAs(f,jo,true,Extension.LOWERCASE);
  flat.close(SaveOptions.DONOTSAVECHANGES);
  colors.layers[i].visible=false;
}
doc.close(SaveOptions.DONOTSAVECHANGES);
var log=new File(root.fsName+"/fixtures/layouts/logo_names.txt"); log.open("w"); log.write(names.join("\n")); log.close();
