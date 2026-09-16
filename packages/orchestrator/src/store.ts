import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "csv-parse/sync";
import {
  BrandKitRowSchema,
  ContentItemSchema,
  JobRowSchema,
  LayerBindingSchema,
  TemplateRowSchema,
  type BrandKitRow,
  type ContentItem,
  type JobRow,
  type LayerBinding,
  type TemplateRow,
} from "@psd-automation/shared";

export interface SheetData {
  content: ContentItem[];
  brandKits: BrandKitRow[];
  templates: TemplateRow[];
  bindings: LayerBinding[];
  jobs: JobRow[];
}

function parseCsvFile<T>(
  filePath: string,
  schema: { parse: (row: unknown) => T },
): T[] {
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  return rows.map((row) => schema.parse(row));
}

export function loadFixtures(fixturesDir: string): SheetData {
  const dir = resolve(fixturesDir);
  return {
    content: parseCsvFile(join(dir, "Content_DB.csv"), ContentItemSchema),
    brandKits: parseCsvFile(join(dir, "Brand_Kits.csv"), BrandKitRowSchema),
    templates: parseCsvFile(join(dir, "Templates.csv"), TemplateRowSchema),
    bindings: parseCsvFile(join(dir, "Layer_Bindings.csv"), LayerBindingSchema),
    jobs: parseCsvFile(join(dir, "Jobs.csv"), JobRowSchema),
  };
}

export function findContent(
  data: SheetData,
  contentId: string,
): ContentItem | undefined {
  return data.content.find((c) => c.Content_ID === contentId);
}

export function findBrandKit(
  data: SheetData,
  property: string,
): BrandKitRow | undefined {
  return data.brandKits.find(
    (b) => b.Property.toLowerCase() === property.toLowerCase(),
  );
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function writeJobSpecFile(
  queueDir: string,
  spec: object,
  jobId: string,
): string {
  ensureDir(queueDir);
  const out = join(queueDir, `${jobId}.json`);
  writeFileSync(out, JSON.stringify(spec, null, 2), "utf8");
  return out;
}

export function writeJobResult(
  resultsDir: string,
  result: object,
  jobId: string,
): string {
  ensureDir(resultsDir);
  const out = join(resultsDir, `${jobId}.result.json`);
  writeFileSync(out, JSON.stringify(result, null, 2), "utf8");
  return out;
}

export function appendJobCsv(jobsPath: string, row: JobRow): void {
  ensureDir(dirname(jobsPath));
  const header =
    "Job_ID,Content_ID,Requested_By,Status,Worker,Parent_Job_ID,Template_ID,Ratio,Created_At,Updated_At,Output_Links,Error\n";
  if (!existsSync(jobsPath)) {
    writeFileSync(jobsPath, header, "utf8");
  }
  const line = [
    row.Job_ID,
    row.Content_ID,
    row.Requested_By,
    row.Status,
    row.Worker,
    row.Parent_Job_ID,
    row.Template_ID,
    row.Ratio,
    row.Created_At,
    row.Updated_At,
    row.Output_Links,
    row.Error,
  ]
    .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
    .join(",");
  writeFileSync(jobsPath, readFileSync(jobsPath, "utf8") + line + "\n", "utf8");
}

export function listQueuedJobSpecs(queueDir: string): string[] {
  if (!existsSync(queueDir)) return [];
  return readdirSync(queueDir)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".result.json"))
    .map((f) => join(queueDir, f));
}

export function defaultPaths(repoRoot: string) {
  return {
    fixturesDir: join(repoRoot, "fixtures", "sheets"),
    queueDir: join(repoRoot, "jobs", "queue"),
    doneDir: join(repoRoot, "jobs", "done"),
    failedDir: join(repoRoot, "jobs", "failed"),
    jobsCsv: join(repoRoot, "fixtures", "sheets", "Jobs.csv"),
  };
}
