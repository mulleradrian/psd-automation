/**
 * Local worker bridge: writes a handshake file the UXP plugin watches,
 * or runs a dry-run simulation when Photoshop is unavailable.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  parseJobSpec,
  type JobResult,
  type JobSpec,
} from "@psd-automation/shared";
import { ensureDir, writeJobResult } from "./store.js";

export interface RenderOptions {
  jobSpecPath: string;
  doneDir: string;
  failedDir: string;
  /** When true, simulate success without Photoshop. */
  dryRun?: boolean;
  handshakeDir?: string;
}

export async function processJobSpecFile(
  options: RenderOptions,
): Promise<JobResult> {
  const raw = JSON.parse(readFileSync(options.jobSpecPath, "utf8"));
  const spec = parseJobSpec(raw);

  if (options.dryRun) {
    return dryRunRender(spec, options);
  }

  return handshakeRender(spec, options);
}

function dryRunRender(spec: JobSpec, options: RenderOptions): JobResult {
  const result: JobResult = {
    jobId: spec.jobId,
    status: "Rendered",
    outputPaths: spec.exports.map((e) =>
      join(spec.workingSetPath, e.subdir, e.filename ?? `${spec.contentId}.jpg`),
    ),
    previewUrl: `file://${join(spec.workingSetPath, spec.exports[0]?.subdir ?? "", spec.exports[0]?.filename ?? "preview.jpg")}`,
    finishedAt: new Date().toISOString(),
  };

  // Materialize empty placeholder outputs so the working-set layout is visible in dry-run.
  for (const out of result.outputPaths ?? []) {
    ensureDir(dirname(out));
    if (!existsSync(out)) {
      writeFileSync(
        out,
        `# dry-run placeholder for ${spec.contentId}\n${JSON.stringify(spec.edits, null, 2)}\n`,
        "utf8",
      );
    }
  }

  writeJobResult(options.doneDir, result, spec.jobId);
  moveSpec(options.jobSpecPath, options.doneDir);
  return result;
}

/**
 * Drop JobSpec into the UXP handshake folder. Photoshop plugin picks it up,
 * writes `<jobId>.result.json`, then we move the original into done/failed.
 */
async function handshakeRender(
  spec: JobSpec,
  options: RenderOptions,
): Promise<JobResult> {
  const handshake =
    options.handshakeDir ??
    join(dirname(options.doneDir), "handshake");
  ensureDir(handshake);

  const dest = join(handshake, `${spec.jobId}.json`);
  copyFileSync(options.jobSpecPath, dest);

  const resultPath = join(handshake, `${spec.jobId}.result.json`);
  const timeoutMs = Number(process.env.PSD_RENDER_TIMEOUT_MS ?? 120_000);
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (existsSync(resultPath)) {
      const result = JSON.parse(readFileSync(resultPath, "utf8")) as JobResult;
      const targetDir =
        result.status === "Rendered" ? options.doneDir : options.failedDir;
      writeJobResult(targetDir, result, spec.jobId);
      moveSpec(options.jobSpecPath, targetDir);
      return result;
    }
    await sleep(500);
  }

  const failed: JobResult = {
    jobId: spec.jobId,
    status: "Failed",
    error: `Timed out waiting for UXP worker (${timeoutMs}ms). Is Photoshop open with the plugin loaded?`,
    errorCode: "worker_error",
    finishedAt: new Date().toISOString(),
  };
  writeJobResult(options.failedDir, failed, spec.jobId);
  moveSpec(options.jobSpecPath, options.failedDir);
  return failed;
}

function moveSpec(from: string, toDir: string): void {
  ensureDir(toDir);
  const to = join(toDir, basename(from));
  try {
    renameSync(from, to);
  } catch {
    copyFileSync(from, to);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function markRendering(specPath: string, resultsDir: string): void {
  try {
    const raw = JSON.parse(readFileSync(specPath, "utf8"));
    writeJobResult(
      resultsDir,
      {
        jobId: raw.jobId,
        status: "Rendering",
      },
      raw.jobId,
    );
  } catch {
    // ignore
  }
}
