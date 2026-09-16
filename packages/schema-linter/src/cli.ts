#!/usr/bin/env node
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { formatLintReport, lintLayerNames, lintPsdFile } from "./lint.js";

function usage(): never {
  console.error(`Usage:
  psd-lint <path-to.psd>
  psd-lint --names txt/headline,clr/accent,slot/hero

Exit codes: 0 = pass, 1 = fail, 2 = usage error`);
  process.exit(2);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) usage();

  if (args[0] === "--names") {
    const names = (args[1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) usage();
    const result = lintLayerNames("(inline)", names);
    console.log(formatLintReport(result));
    process.exit(result.ok ? 0 : 1);
  }

  const requested = args[0]!;
  const candidates = [
    resolve(process.cwd(), requested),
    resolve(process.cwd(), "../..", requested),
    resolve(process.cwd(), "../../..", requested),
  ];
  const target = candidates.find((p) => existsSync(p));

  if (!target) {
    console.error(`File not found: ${candidates[0]}`);
    process.exit(2);
  }

  if (!target.toLowerCase().endsWith(".psd")) {
    console.error("Expected a .psd file");
    process.exit(2);
  }

  try {
    const result = lintPsdFile(target);
    console.log(formatLintReport(result));
    if (result.layers.length) {
      console.log("\nLayer inventory:");
      for (const l of result.layers) {
        console.log(
          `  - ${l.name} [${l.kind}]${l.isSmartObject ? " SO" : ""}${l.isText ? " TEXT" : ""}`,
        );
      }
    }
    process.exit(result.ok ? 0 : 1);
  } catch (err) {
    console.error(`Failed to parse PSD: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
