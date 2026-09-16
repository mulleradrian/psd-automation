import { z } from "zod";
import { TEMPLATE_IDS } from "./layer-schema.js";

export const JobStatusSchema = z.enum([
  "Queued",
  "Rendering",
  "Rendered",
  "Failed",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const WorkerKindSchema = z.enum(["uxp", "ps-api"]);
export type WorkerKind = z.infer<typeof WorkerKindSchema>;

export const EditOpSchema = z.discriminatedUnion("op", [
  z.object({
    layer: z.string().min(1),
    op: z.literal("setText"),
    value: z.string(),
    sizePx: z.number().positive().optional(),
  }),
  z.object({
    layer: z.string().min(1),
    op: z.literal("setFill"),
    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
  z.object({
    layer: z.string().min(1),
    op: z.literal("setFont"),
    postScript: z.string().min(1),
    sizePx: z.number().positive().optional(),
    minSizePx: z.number().positive().optional(),
  }),
  z.object({
    layer: z.string().min(1),
    op: z.literal("replaceSmartObject"),
    file: z.string().min(1),
    transformMode: z.enum(["cover", "contain", "stretch"]).optional(),
  }),
]);
export type EditOp = z.infer<typeof EditOpSchema>;

export const ExportSpecSchema = z.object({
  ratio: z.string().min(1),
  format: z.enum(["jpg", "png"]),
  quality: z.number().int().min(1).max(12).default(12),
  subdir: z.string().min(1),
  filename: z.string().optional(),
});
export type ExportSpec = z.infer<typeof ExportSpecSchema>;

export const JobSpecSchema = z.object({
  jobId: z.string().min(1),
  contentId: z.string().min(1),
  property: z.string().min(1),
  templateId: z.enum(TEMPLATE_IDS),
  workingSetPath: z.string().min(1),
  templatePath: z.string().optional(),
  parentJobId: z.string().optional(),
  worker: WorkerKindSchema.default("uxp"),
  edits: z.array(EditOpSchema),
  exports: z.array(ExportSpecSchema).min(1),
  brandKit: z
    .object({
      colors: z.record(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).optional(),
      fonts: z.record(z.string()).optional(),
      logoFile: z.string().optional(),
    })
    .optional(),
  createdAt: z.string().datetime().optional(),
});
export type JobSpec = z.infer<typeof JobSpecSchema>;

export const JobResultSchema = z.object({
  jobId: z.string(),
  status: JobStatusSchema,
  previewUrl: z.string().optional(),
  outputPaths: z.array(z.string()).optional(),
  error: z.string().optional(),
  errorCode: z
    .enum([
      "text_overflow",
      "missing_layer",
      "missing_source",
      "font_missing",
      "schema_fail",
      "worker_error",
      "drive_403",
    ])
    .optional(),
  finishedAt: z.string().datetime().optional(),
});
export type JobResult = z.infer<typeof JobResultSchema>;

export function parseJobSpec(data: unknown): JobSpec {
  return JobSpecSchema.parse(data);
}

export function safeParseJobSpec(data: unknown) {
  return JobSpecSchema.safeParse(data);
}
