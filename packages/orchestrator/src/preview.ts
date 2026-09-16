import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";

/** Patch Preview_URL / Render_Error on Content_DB.csv for local fixture mode. */
export function updateContentPreview(
  fixturesDir: string,
  contentId: string,
  previewUrl: string,
  renderError: string,
): void {
  const path = join(fixturesDir, "Content_DB.csv");
  if (!existsSync(path)) return;

  const raw = readFileSync(path, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  if (!rows.length) return;
  const headers = Object.keys(rows[0]!);

  for (const row of rows) {
    if (row.Content_ID === contentId) {
      if (previewUrl) row.Preview_URL = previewUrl;
      row.Render_Error = renderError;
      if (previewUrl && !renderError) row.Status = "Rendered";
      if (renderError) row.Status = "Failed";
    }
  }

  const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(",")),
  ];
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
}
