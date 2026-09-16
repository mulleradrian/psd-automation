/**
 * Optional Google Sheets live reader.
 * Uses GOOGLE_APPLICATION_CREDENTIALS or OAuth token when available.
 * Falls back is handled by fixture CSV loader in store.ts.
 */
import { google } from "googleapis";
import {
  BrandKitRowSchema,
  ContentItemSchema,
  JobRowSchema,
  LayerBindingSchema,
  TemplateRowSchema,
  type BrandKitRow,
  type ContentItem,
  type JobRow,
  type LayerBinding,
  type TemplateRow,
} from "@psd-automation/shared";
import type { SheetData } from "./store.js";

const TAB = {
  Content_DB: "Content_DB",
  Brand_Kits: "Brand_Kits",
  Templates: "Templates",
  Layer_Bindings: "Layer_Bindings",
  Jobs: "Jobs",
} as const;

async function sheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function rowsToObjects(values: string[][]): Record<string, string>[] {
  if (!values.length) return [];
  const [header, ...rows] = values;
  if (!header) return [];
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

export async function loadFromGoogleSheet(
  spreadsheetId: string,
): Promise<SheetData> {
  const sheets = await sheetsClient();
  const ranges = Object.values(TAB).map((t) => `${t}!A:Z`);
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });

  const byTitle = new Map<string, string[][]>();
  res.data.valueRanges?.forEach((vr, i) => {
    const title = Object.values(TAB)[i]!;
    byTitle.set(title, (vr.values as string[][]) ?? []);
  });

  const parseTab = <T>(
    title: string,
    schema: { parse: (row: unknown) => T },
  ): T[] =>
    rowsToObjects(byTitle.get(title) ?? []).map((r) => schema.parse(r));

  return {
    content: parseTab(TAB.Content_DB, ContentItemSchema),
    brandKits: parseTab(TAB.Brand_Kits, BrandKitRowSchema),
    templates: parseTab(TAB.Templates, TemplateRowSchema),
    bindings: parseTab(TAB.Layer_Bindings, LayerBindingSchema),
    jobs: parseTab(TAB.Jobs, JobRowSchema),
  };
}

export async function appendJobToSheet(
  spreadsheetId: string,
  row: JobRow,
): Promise<void> {
  const sheets = await sheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${TAB.Jobs}!A:L`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          row.Job_ID,
          row.Content_ID,
          row.Requested_By,
          row.Status,
          row.Worker,
          row.Parent_Job_ID,
          row.Template_ID,
          row.Ratio,
          row.Created_At,
          row.Updated_At,
          row.Output_Links,
          row.Error,
        ],
      ],
    },
  });
}

export async function updateJobStatusInSheet(
  spreadsheetId: string,
  jobId: string,
  status: string,
  outputLinks: string,
  error: string,
): Promise<void> {
  const sheets = await sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TAB.Jobs}!A:L`,
  });
  const values = res.data.values ?? [];
  const rowIndex = values.findIndex((r, i) => i > 0 && r[0] === jobId);
  if (rowIndex === -1) return;

  const sheetRow = rowIndex + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAB.Jobs}!D${sheetRow}:L${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          status,
          values[rowIndex]?.[4] ?? "uxp",
          values[rowIndex]?.[5] ?? "",
          values[rowIndex]?.[6] ?? "",
          values[rowIndex]?.[7] ?? "",
          values[rowIndex]?.[8] ?? "",
          new Date().toISOString(),
          outputLinks,
          error,
        ],
      ],
    },
  });
}

export async function updateContentPreviewInSheet(
  spreadsheetId: string,
  contentId: string,
  previewUrl: string,
  renderError: string,
): Promise<void> {
  const sheets = await sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TAB.Content_DB}!A:Z`,
  });
  const values = res.data.values ?? [];
  if (!values.length) return;
  const header = values[0]!;
  const idCol = header.indexOf("Content_ID");
  const previewCol = header.indexOf("Preview_URL");
  const errorCol = header.indexOf("Render_Error");
  const statusCol = header.indexOf("Status");
  const rowIndex = values.findIndex(
    (r, i) => i > 0 && r[idCol] === contentId,
  );
  if (rowIndex === -1) return;

  const sheetRow = rowIndex + 1;
  const updates: { range: string; values: string[][] }[] = [];
  if (previewCol >= 0 && previewUrl) {
    updates.push({
      range: `${TAB.Content_DB}!${colLetter(previewCol)}${sheetRow}`,
      values: [[previewUrl]],
    });
  }
  if (errorCol >= 0) {
    updates.push({
      range: `${TAB.Content_DB}!${colLetter(errorCol)}${sheetRow}`,
      values: [[renderError]],
    });
  }
  if (statusCol >= 0) {
    updates.push({
      range: `${TAB.Content_DB}!${colLetter(statusCol)}${sheetRow}`,
      values: [[renderError ? "Failed" : "Rendered"]],
    });
  }
  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates,
      },
    });
  }
}

function colLetter(index: number): string {
  let n = index;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export type { ContentItem, BrandKitRow, TemplateRow, LayerBinding, JobRow };
