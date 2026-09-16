/**
 * Writes minimal schema-named PSD stubs for linter smoke tests.
 * Layer names only — not production design templates.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writePsd, type Layer, type Psd } from "ag-psd";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../../../fixtures/templates");

function textLayer(name: string, text: string): Layer {
  return {
    name,
    text: { text },
  };
}

function namedLayer(name: string): Layer {
  return { name };
}

function makeDoc(width: number, height: number): Psd {
  return {
    width,
    height,
    children: [
      namedLayer("lock/decor"),
      namedLayer("slot/bg"),
      namedLayer("slot/hero"),
      namedLayer("slot/logo"),
      namedLayer("clr/bg"),
      namedLayer("clr/accent"),
      textLayer("txt/headline", "Sample headline"),
      textLayer("txt/sub", "Sample sub"),
      textLayer("txt/copy_zh", "示例"),
    ],
  };
}

mkdirSync(outDir, { recursive: true });

const templates: [string, number, number][] = [
  ["tpl_ig_4x5.psd", 1080, 1350],
  ["tpl_ig_1x1.psd", 1080, 1080],
  ["tpl_story_9x16.psd", 1080, 1920],
  ["tpl_cover_16x9.psd", 1920, 1080],
];

for (const [file, w, h] of templates) {
  const buffer = writePsd(makeDoc(w, h));
  writeFileSync(resolve(outDir, file), Buffer.from(buffer));
  console.log(`Wrote ${file}`);
}
