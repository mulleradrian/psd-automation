import {
  RATIO_TO_TEMPLATE,
  TEMPLATE_TO_RATIO,
  type TemplateId,
} from "./layer-schema.js";
import type { JobSpec, EditOp, ExportSpec } from "./job-spec.js";
import type {
  BrandKitRow,
  ContentItem,
  LayerBinding,
  TemplateRow,
} from "./sheets.js";
import { parseRatios } from "./sheets.js";
import {
  maxTextWidthPx,
  P10_IG_4X5_WRAP,
  fitTypeBlock,
  type LayoutTextWrapConfig,
} from "./text-wrap.js";

export interface BuildJobSpecInput {
  jobId: string;
  content: ContentItem;
  brandKit: BrandKitRow;
  bindings: LayerBinding[];
  templates: TemplateRow[];
  ratio: string;
  worker?: "uxp" | "ps-api";
  parentJobId?: string;
  workingSetPathOverride?: string;
}

function resolveField(
  content: ContentItem,
  brandKit: BrandKitRow,
  field: string,
): string | undefined {
  const contentMap: Record<string, string | undefined> = {
    Title: content.Title,
    Copy: content.Copy,
    Copy_ZH: content.Copy_ZH,
    Hashtags: content.Hashtags,
    "slot.hero": content.Hero_File,
    "slot.bg": content.Bg_File,
    Hero_File: content.Hero_File,
    Bg_File: content.Bg_File,
  };
  const brandMap: Record<string, string | undefined> = {
    "color.bg": brandKit.color_bg,
    "color.accent": brandKit.color_accent,
    "color.type": brandKit.color_type,
    "font.headline": brandKit.font_headline,
    "font.body": brandKit.font_body,
    "slot.logo": brandKit.logo_filename,
  };
  return contentMap[field] ?? brandMap[field];
}

function wrapConfigForTemplate(templateId: string): LayoutTextWrapConfig {
  // Ratios share the same type block metrics until per-ratio recipes exist.
  void templateId;
  return P10_IG_4X5_WRAP;
}

/**
 * Prefer fewer lines + larger type via fitTypeBlock.
 * Entire block goes into txt/headline as one layer with \\r line breaks.
 */
function applySmartTextWrap(
  content: ContentItem,
  bindings: LayerBinding[],
  templateId: string,
  edits: EditOp[],
): EditOp[] {
  const cfg = wrapConfigForTemplate(templateId);
  const maxW = maxTextWidthPx(cfg);

  const hasHeadline = bindings.some(
    (b) =>
      b.Template_ID === templateId &&
      b.kind === "text" &&
      b.layer_name === "txt/headline",
  );
  const title = content.Title?.trim() ?? "";
  const copy = content.Copy?.trim() ?? "";
  if (!title && !copy) return edits;

  const fit = fitTypeBlock({
    title: title || copy,
    copy: title ? copy : "",
    maxWidthPx: maxW,
    fontSizePx: cfg.fontSizePx,
    minFontSizePx: 72,
    maxLines: cfg.maxLines ?? 3,
  });

  const body = fit.text || fit.lines.join("\r") || " ";
  const withoutText = edits.filter(
    (e) =>
      !(e.op === "setText" && (e.layer === "txt/headline" || e.layer === "txt/sub")),
  );

  if (hasHeadline) {
    return withoutText.concat(
      {
        layer: "txt/headline",
        op: "setText",
        value: body,
        sizePx: fit.fontSizePx,
      },
      { layer: "txt/sub", op: "setText", value: " " },
    );
  }

  return edits.map((e) => {
    if (e.op !== "setText") return e;
    if (e.layer === "txt/headline") {
      return { ...e, value: body, sizePx: fit.fontSizePx };
    }
    if (e.layer === "txt/sub") {
      return { ...e, value: " " };
    }
    return e;
  });
}

export function buildEdits(
  content: ContentItem,
  brandKit: BrandKitRow,
  bindings: LayerBinding[],
  templateId: string,
): EditOp[] {
  const relevant = bindings.filter((b) => b.Template_ID === templateId);
  const edits: EditOp[] = [];

  for (const b of relevant) {
    const value = resolveField(content, brandKit, b.field);
    if (value === undefined || value === "") continue;

    switch (b.kind) {
      case "text":
        edits.push({ layer: b.layer_name, op: "setText", value });
        break;
      case "color": {
        const hex = value.startsWith("#") ? value : `#${value}`;
        edits.push({ layer: b.layer_name, op: "setFill", hex });
        break;
      }
      case "font":
        edits.push({
          layer: b.layer_name,
          op: "setFont",
          postScript: value,
          minSizePx: 18,
        });
        break;
      case "slot":
        edits.push({
          layer: b.layer_name,
          op: "replaceSmartObject",
          file: value,
          transformMode: b.layer_name === "slot/bg" ? "cover" : "contain",
        });
        break;
      default: {
        const _exhaustive: never = b.kind;
        void _exhaustive;
        break;
      }
    }
  }

  return applySmartTextWrap(content, relevant, templateId, edits);
}

export function buildJobSpec(input: BuildJobSpecInput): JobSpec {
  const templateId =
    (input.content.Template_ID as TemplateId) ||
    RATIO_TO_TEMPLATE[input.ratio] ||
    "tpl_ig_4x5";

  const templateRow = input.templates.find((t) => t.Template_ID === templateId);
  const ratio = input.ratio || TEMPLATE_TO_RATIO[templateId as TemplateId] || "4:5";
  const workingSetPath =
    input.workingSetPathOverride ||
    input.content.WorkingSet_Path ||
    "";

  if (!workingSetPath) {
    throw new Error(
      `ContentItem ${input.content.Content_ID} has no WorkingSet_Path`,
    );
  }

  const dateSuffix =
    input.content.Publish_Date?.replace(/\//g, ".") ||
    workingSetPath.split(/[/\\]/).pop() ||
    "export";

  // Windows FS forbids `:`; Drive web folders may still show `4:5_…`.
  // Local + Drive-for-Desktop paths use `4x5_…` (see docs/sheets-tabs.md).
  const subdir = `${ratio.replace(/:/g, "x")}_${dateSuffix}`.replace(/\s+/g, "");
  const edits = buildEdits(
    input.content,
    input.brandKit,
    input.bindings,
    templateId,
  );

  const exportSpec: ExportSpec = {
    ratio,
    format: "jpg",
    quality: 12,
    subdir,
    filename: `${input.content.Content_ID}_${ratio.replace(":", "x")}.jpg`,
  };

  return {
    jobId: input.jobId,
    contentId: input.content.Content_ID,
    property: input.content.Property,
    templateId: templateId as TemplateId,
    workingSetPath,
    templatePath: templateRow?.Master_PSD_Path || undefined,
    parentJobId: input.parentJobId,
    worker: input.worker ?? "uxp",
    edits,
    exports: [exportSpec],
    brandKit: {
      colors: {
        bg: input.brandKit.color_bg,
        accent: input.brandKit.color_accent,
        type: input.brandKit.color_type,
      },
      fonts: {
        headline: input.brandKit.font_headline,
        body: input.brandKit.font_body,
      },
      logoFile: input.brandKit.logo_filename,
    },
    createdAt: new Date().toISOString(),
  };
}

export function buildJobSpecsForContent(input: {
  baseJobId: string;
  content: ContentItem;
  brandKit: BrandKitRow;
  bindings: LayerBinding[];
  templates: TemplateRow[];
  worker?: "uxp" | "ps-api";
}): JobSpec[] {
  const ratios = parseRatios(input.content.Ratios || "");
  if (!ratios.length) return [];
  return ratios.map((ratio) =>
    buildJobSpec({
      jobId: `${input.baseJobId}_${ratio.replace(":", "x")}`,
      content: input.content,
      brandKit: input.brandKit,
      bindings: input.bindings,
      templates: input.templates,
      ratio,
      worker: input.worker,
      parentJobId: input.baseJobId,
    }),
  );
}
