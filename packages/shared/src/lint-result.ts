export interface LayerInventoryItem {
  name: string;
  kind: "text" | "color" | "slot" | "lock" | "unknown";
  isSmartObject?: boolean;
  isText?: boolean;
  visible?: boolean;
}

export interface SchemaLintResult {
  ok: boolean;
  filePath: string;
  layers: LayerInventoryItem[];
  missingRequired: string[];
  missingRecommended: string[];
  unknownNamed: string[];
  warnings: string[];
  errors: string[];
}

export function formatLintReport(result: SchemaLintResult): string {
  const lines: string[] = [];
  lines.push(`Schema lint: ${result.filePath}`);
  lines.push(`Status: ${result.ok ? "PASS" : "FAIL"}`);
  lines.push(`Layers found: ${result.layers.length}`);
  if (result.missingRequired.length) {
    lines.push(`Missing required: ${result.missingRequired.join(", ")}`);
  }
  if (result.missingRecommended.length) {
    lines.push(`Missing recommended: ${result.missingRecommended.join(", ")}`);
  }
  if (result.unknownNamed.length) {
    lines.push(
      `Non-schema named layers: ${result.unknownNamed.slice(0, 20).join(", ")}${result.unknownNamed.length > 20 ? "…" : ""}`,
    );
  }
  for (const w of result.warnings) lines.push(`WARN: ${w}`);
  for (const e of result.errors) lines.push(`ERROR: ${e}`);
  return lines.join("\n");
}
