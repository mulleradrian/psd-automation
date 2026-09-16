#!/usr/bin/env node
/**
 * Dual-run: compare a UXP result file with a fresh Photoshop API dry/live render.
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import {
  loadSiblingResult,
  renderJobSpecFile,
  writeDualRunReport,
} from "./worker.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");

async function main() {
  const args = process.argv.slice(2);
  const job = args.find((a, i) => args[i - 1] === "--job");
  if (!job) {
    console.error(
      "Usage: npm run diff -w @psd-automation/ps-api-worker -- --job <jobspec.json> [--dry-run]",
    );
    process.exit(2);
  }
  const dryRun = args.includes("--dry-run");
  const jobPath = resolve(job);
  const spec = JSON.parse(readFileSync(jobPath, "utf8"));
  const doneDir = join(REPO_ROOT, "jobs", "done");
  let uxp = loadSiblingResult(doneDir, spec.jobId);
  if (!uxp) {
    const alt = join(doneDir, `${spec.jobId}.result.json`);
    if (existsSync(alt)) {
      uxp = JSON.parse(readFileSync(alt, "utf8"));
    }
  }
  if (!uxp) {
    uxp = {
      jobId: spec.jobId,
      status: "Failed",
      error: "No UXP result found in jobs/done — render with UXP first",
    };
  }
  const api = await renderJobSpecFile(jobPath, dryRun);
  const out = join(REPO_ROOT, "jobs", "done", `${spec.jobId}.dual-run.json`);
  writeDualRunReport(out, uxp, api);
  console.log(`Wrote ${out}`);
  console.log(JSON.stringify({ uxp: uxp.status, api: api.status }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
