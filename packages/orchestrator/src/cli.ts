#!/usr/bin/env node
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { queueContentRender } from "./queue.js";
import { defaultPaths, listQueuedJobSpecs } from "./store.js";
import { processJobSpecFile } from "./render.js";
import { updateContentPreview } from "./preview.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");

function usage(): never {
  console.error(`psd-render — Sheets → Photoshop orchestrator

Commands:
  psd-render queue --id <Content_ID> [--worker uxp|ps-api] [--dry-run ratios]
  psd-render render --id <Content_ID> [--dry-run]
  psd-render render --job <path-to-jobspec.json> [--dry-run]
  psd-render process-queue [--dry-run]

Examples:
  psd-render queue --id Q1_W1_01
  psd-render render --id Q1_W1_01 --dry-run
`);
  process.exit(2);
}

function getFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) usage();

  const dryRun = hasFlag(rest, "--dry-run");
  const paths = defaultPaths(REPO_ROOT);
  const worker = (getFlag(rest, "--worker") as "uxp" | "ps-api" | undefined) ?? "uxp";

  switch (cmd) {
    case "queue": {
      const id = getFlag(rest, "--id");
      if (!id) usage();
      const result = queueContentRender({
        contentId: id,
        repoRoot: REPO_ROOT,
        worker,
        requestedBy: "cli",
      });
      console.log(`Queued parent ${result.parentJobId}`);
      for (const p of result.paths) console.log(`  ${p}`);
      break;
    }
    case "render": {
      const id = getFlag(rest, "--id");
      const jobPath = getFlag(rest, "--job");

      if (id) {
        const queued = queueContentRender({
          contentId: id,
          repoRoot: REPO_ROOT,
          worker,
          requestedBy: "cli",
        });
        for (const p of queued.paths) {
          console.log(`Rendering ${p}${dryRun ? " (dry-run)" : ""}…`);
          const result = await processJobSpecFile({
            jobSpecPath: p,
            doneDir: paths.doneDir,
            failedDir: paths.failedDir,
            dryRun,
            handshakeDir: resolve(REPO_ROOT, "jobs", "handshake"),
          });
          console.log(JSON.stringify(result, null, 2));
          if (result.status === "Rendered" && result.previewUrl) {
            updateContentPreview(
              paths.fixturesDir,
              id,
              result.previewUrl,
              "",
            );
          }
          if (result.status === "Failed") {
            updateContentPreview(
              paths.fixturesDir,
              id,
              "",
              result.error ?? "render failed",
            );
          }
        }
        break;
      }

      if (jobPath) {
        const result = await processJobSpecFile({
          jobSpecPath: resolve(jobPath),
          doneDir: paths.doneDir,
          failedDir: paths.failedDir,
          dryRun,
          handshakeDir: resolve(REPO_ROOT, "jobs", "handshake"),
        });
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      usage();
      break;
    }
    case "process-queue": {
      const files = listQueuedJobSpecs(paths.queueDir);
      if (!files.length) {
        console.log("Queue empty");
        break;
      }
      for (const file of files) {
        console.log(`Processing ${file}…`);
        const result = await processJobSpecFile({
          jobSpecPath: file,
          doneDir: paths.doneDir,
          failedDir: paths.failedDir,
          dryRun,
          handshakeDir: resolve(REPO_ROOT, "jobs", "handshake"),
        });
        console.log(`  → ${result.status}`);
      }
      break;
    }
    default:
      usage();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
