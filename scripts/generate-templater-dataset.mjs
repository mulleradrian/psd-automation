/**
 * Generate Templater-style test dataset: each row = one variant.
 * Copy variants are short Preview-scale phrases (add more via Google Sheet).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fitTypeBlock, maxTextWidthPx, P10_IG_4X5_WRAP } from "../packages/shared/dist/text-wrap.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const RATIOS = [
  {
    ratio: "4:5",
    key: "4x5",
    template: "fixtures/templater/templates/tpl_4x5.psd",
    sourcePsd: "fixtures/workingsets/1.1.26/4x5_1.1.26/p10test.psd",
    canvas: { w: 1080, h: 1350 },
  },
  {
    ratio: "1:1",
    key: "1x1",
    template: "fixtures/templater/templates/tpl_1x1.psd",
    sourcePsd: "fixtures/workingsets/1.1.26/1x1_1.1.26/p10test_1x1.psd",
    canvas: { w: 1080, h: 1080 },
  },
  {
    ratio: "9:16",
    key: "9x16",
    template: "fixtures/templater/templates/tpl_9x16.psd",
    sourcePsd: "fixtures/workingsets/1.1.26/9x16_1.1.26/p10test_9x16.psd",
    canvas: { w: 1080, h: 1920 },
  },
  {
    ratio: "16:9",
    key: "16x9",
    template: "fixtures/templater/templates/tpl_16x9.psd",
    sourcePsd: "fixtures/workingsets/1.1.26/16x9_1.1.26/p10test_16x9.psd",
    canvas: { w: 1920, h: 1080 },
  },
];

const BGS = ["9", "10", "11", "12"];

/** Short Preview-scale phrases — keep ≤ ~40 chars title, optional short copy. */
const COPY_VARIANTS = [
  { code: "peace", title: "Unlock the peace you deserve", copy: "" },
  { code: "morning", title: "Morning light awaits", copy: "" },
  { code: "calm", title: "Find calm in every stay", copy: "" },
  {
    code: "neighbourhood",
    title: "The neighbourhood knows",
    copy: "Find calm here.",
  },
];

function linesFor(title, copy, canvasW) {
  const cfg = {
    ...P10_IG_4X5_WRAP,
    canvasWidthPx: Math.min(canvasW, 1080),
    textLeftPx: Math.round((108 / 1080) * Math.min(canvasW, 1080)),
  };
  const maxW = maxTextWidthPx(cfg);
  const fit = fitTypeBlock({
    title,
    copy,
    maxWidthPx: maxW,
    fontSizePx: cfg.fontSizePx,
    minFontSizePx: 72,
    maxLines: 3,
  });
  return {
    headline: fit.text || fit.headline,
    sub: "",
    fittedSizePx: fit.fontSizePx,
    lineCount: fit.lines.length,
  };
}

const rows = [];
let n = 0;
for (const r of RATIOS) {
  for (const bg of BGS) {
    for (const c of COPY_VARIANTS) {
      n += 1;
      const laid = linesFor(c.title, c.copy, r.canvas.w);
      const id = `V${String(n).padStart(2, "0")}_${r.key}_bg${bg}_${c.code}`;
      rows.push({
        id,
        index: n,
        ratio: r.ratio,
        ratioKey: r.key,
        template: r.template,
        sourcePsd: r.sourcePsd,
        bg,
        title: c.title,
        copy: c.copy,
        headline: laid.headline,
        sub: laid.sub,
        fittedSizePx: laid.fittedSizePx,
        fontPostScript: "Poppins-Medium",
        fontSizePx: 86,
        canvasWidth: r.canvas.w,
        canvasHeight: r.canvas.h,
        textLeft: Math.round((108 / 1080) * Math.min(r.canvas.w, 1080)),
        variant: c.code,
        exportFile: `${id}.jpg`,
        notes: `BG ${bg} · ${r.ratio} · ${c.code}`,
      });
    }
  }
}

const dataset = {
  version: 3,
  name: "Perfect Ten — Templater test rows",
  description:
    "Each row is one variant. Cycle in UXP, or Pull from Google Sheet Content_DB.",
  projectRootHint: "psd-automation",
  workingSet: "fixtures/workingsets/1.1.26",
  defaultFont: { postScript: "Poppins-Medium", sizePx: 86 },
  tenAsset: "fixtures/layout-library/assets/ten_logo_crop.png",
  accentDot: "fixtures/layout-library/assets/accent_dot.png",
  sheetTab: "Content_DB",
  ratios: RATIOS,
  rowCount: rows.length,
  rows,
};

const outDir = join(ROOT, "fixtures/templater");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "dataset.json");
writeFileSync(outPath, JSON.stringify(dataset, null, 2));
writeFileSync(
  join(outDir, "dataset.summary.txt"),
  rows.map((r) => `${r.id}\t${r.ratio}\tbg${r.bg}\t${r.title}`).join("\n"),
);
console.log(`wrote ${rows.length} rows → ${outPath}`);
