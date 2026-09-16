import { randomUUID } from "node:crypto";
import { resolve, isAbsolute } from "node:path";
import {
  buildJobSpecsForContent,
  type JobSpec,
  type JobRow,
  type ContentItem,
} from "@psd-automation/shared";
import {
  appendJobCsv,
  defaultPaths,
  findBrandKit,
  findContent,
  loadFixtures,
  writeJobSpecFile,
  type SheetData,
} from "./store.js";

export interface QueueOptions {
  contentId: string;
  repoRoot: string;
  worker?: "uxp" | "ps-api";
  requestedBy?: string;
  ratios?: string[];
}

export interface QueueResult {
  parentJobId: string;
  specs: JobSpec[];
  paths: string[];
}

function resolveWorkingSetPath(
  content: ContentItem,
  repoRoot: string,
): ContentItem {
  const path = content.WorkingSet_Path;
  if (!path) return content;
  if (isAbsolute(path)) return content;
  return {
    ...content,
    WorkingSet_Path: resolve(repoRoot, path),
  };
}

export function queueContentRender(options: QueueOptions): QueueResult {
  const paths = defaultPaths(options.repoRoot);
  const data = loadFixtures(paths.fixturesDir);
  return queueFromData(data, options, paths);
}

export function queueFromData(
  data: SheetData,
  options: QueueOptions,
  paths: ReturnType<typeof defaultPaths>,
): QueueResult {
  const found = findContent(data, options.contentId);
  if (!found) {
    throw new Error(`Content_ID not found: ${options.contentId}`);
  }

  const content = resolveWorkingSetPath(found, options.repoRoot);

  const brandKit = findBrandKit(data, content.Property);
  if (!brandKit) {
    throw new Error(`Brand kit not found for property: ${content.Property}`);
  }

  if (options.ratios?.length) {
    content.Ratios = options.ratios.join(",");
  }

  const templates = data.templates.map((t) => ({
    ...t,
    Master_PSD_Path:
      t.Master_PSD_Path && !isAbsolute(t.Master_PSD_Path)
        ? resolve(options.repoRoot, t.Master_PSD_Path)
        : t.Master_PSD_Path,
  }));

  const parentJobId = `job_${randomUUID().slice(0, 8)}`;
  const specs = buildJobSpecsForContent({
    baseJobId: parentJobId,
    content,
    brandKit,
    bindings: data.bindings,
    templates,
    worker: options.worker ?? "uxp",
  });

  const written: string[] = [];
  const now = new Date().toISOString();

  for (const spec of specs) {
    const path = writeJobSpecFile(paths.queueDir, spec, spec.jobId);
    written.push(path);

    const row: JobRow = {
      Job_ID: spec.jobId,
      Content_ID: spec.contentId,
      Requested_By: options.requestedBy ?? "cli",
      Status: "Queued",
      Worker: spec.worker ?? "uxp",
      Parent_Job_ID: parentJobId,
      Template_ID: spec.templateId,
      Ratio: spec.exports[0]?.ratio ?? "",
      Created_At: now,
      Updated_At: now,
      Output_Links: "",
      Error: "",
    };
    appendJobCsv(paths.jobsCsv, row);
  }

  return { parentJobId, specs, paths: written };
}
