#!/usr/bin/env node
import { resolve } from "node:path";
import { renderJobSpecFile } from "./worker.js";

async function main() {
  const args = process.argv.slice(2);
  const job = args.find((a, i) => args[i - 1] === "--job");
  const dryRun = args.includes("--dry-run");
  if (!job) {
    console.error("Usage: ps-api-render --job <jobspec.json> [--dry-run]");
    process.exit(2);
  }
  const result = await renderJobSpecFile(resolve(job), dryRun);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "Rendered" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
