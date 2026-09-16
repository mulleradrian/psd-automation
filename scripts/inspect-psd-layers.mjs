import { readPsd } from "ag-psd";
import { readFileSync } from "fs";

const path = process.argv[2] || "fixtures/templates/p10test/p10test.psd";
const psd = readPsd(readFileSync(path), {
  skipLayerImageData: true,
  skipCompositeImageData: true,
  skipThumbnail: true,
});

function walk(layers, depth = 0) {
  if (!layers) return;
  for (const l of layers) {
    const b =
      l.left != null
        ? ` @(${l.left},${l.top})-(${l.right},${l.bottom})`
        : "";
    const vis = l.hidden ? " HIDDEN" : "";
    const kind = l.text ? " TEXT" : l.placedLayer || l.smartObject ? " SO" : "";
    console.log("  ".repeat(depth) + (l.name || "?") + b + vis + kind);
    if (l.children) walk(l.children, depth + 1);
  }
}

console.log(path);
console.log(`${psd.width}x${psd.height}`);
walk(psd.children);
