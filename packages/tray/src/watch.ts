#!/usr/bin/env node
/**
 * Windows tray/CLI watcher: polls jobs/queue every 15–30s and hands JobSpecs
 * to the UXP handshake folder.
 *
 * Photoshop must be running with the PSD Calendar plugin watching the same handshake dir.
 */
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, watch } from "node:fs";
import {
  defaultPaths,
  ensureDir,
  listQueuedJobSpecs,
  processJobSpecFile,
} from "@psd-automation/orchestrator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const POLL_MS = Number(process.env.PSD_POLL_MS ?? 20_000);
const DRY_RUN = process.env.PSD_DRY_RUN === "1";

async function drainQueue(): Promise<void> {
  const paths = defaultPaths(REPO_ROOT);
  const handshakeDir = resolve(REPO_ROOT, "jobs", "handshake");
  ensureDir(handshakeDir);
  ensureDir(paths.queueDir);

  const files = listQueuedJobSpecs(paths.queueDir);
  if (!files.length) return;

  console.log(`[tray] ${files.length} queued job(s)`);
  for (const file of files) {
    console.log(`[tray] processing ${basename(file)}`);
    if (!DRY_RUN) {
      copyFileSync(file, join(handshakeDir, basename(file)));
    }
    const result = await processJobSpecFile({
      jobSpecPath: file,
      doneDir: paths.doneDir,
      failedDir: paths.failedDir,
      dryRun: DRY_RUN,
      handshakeDir,
    });
    console.log(`[tray] ${result.jobId} → ${result.status}`);
  }
}

async function main(): Promise<void> {
  console.log(`[tray] watching ${REPO_ROOT}`);
  console.log(`[tray] poll=${POLL_MS}ms dryRun=${DRY_RUN}`);
  console.log("[tray] Keep Photoshop open with PSD Calendar plugin loaded.");

  await drainQueue();

  const paths = defaultPaths(REPO_ROOT);
  ensureDir(paths.queueDir);

  try {
    watch(paths.queueDir, { persistent: true }, () => {
      void drainQueue();
    });
  } catch {
    // fall back to poll only
  }

  setInterval(() => {
    void drainQueue();
  }, POLL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
