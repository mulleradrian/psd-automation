/**
 * Build a multi-sheet Excel workbook from fixtures/sheets CSVs,
 * then upload to Drive (converted to Google Sheets).
 */
import ExcelJS from "exceljs";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const sheetsDir = join(root, "fixtures", "sheets");
const outPath = join(root, "fixtures", "PSD_Automation_Machine_Tabs.xlsx");

const TAB_FILES = [
  "Content_DB.csv",
  "Brand_Kits.csv",
  "Templates.csv",
  "Layer_Bindings.csv",
  "Jobs.csv",
];

const wb = new ExcelJS.Workbook();
wb.creator = "psd-automation";

for (const file of TAB_FILES) {
  const name = file.replace(/\.csv$/, "");
  const raw = readFileSync(join(sheetsDir, file), "utf8");
  const rows = parse(raw, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
  const ws = wb.addWorksheet(name);
  for (const row of rows) {
    // Clean Content_DB quotes from prior dry-run rewrite
    ws.addRow(row.map((c) => String(c ?? "").replace(/^"|"$/g, "")));
  }
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

await wb.xlsx.writeFile(outPath);
console.log(`Wrote ${outPath}`);
