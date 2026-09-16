/**
 * Adobe Photoshop API (Firefly Services) worker.
 * Consumes the same JobSpec as UXP. Requires:
 *   PSD_API_CLIENT_ID, PSD_API_CLIENT_SECRET, PSD_API_ACCESS_TOKEN (or client credentials flow)
 *
 * Endpoints (v2):
 *   - /v2/create-composite  — smart object replace + solid fills where supported
 *   - /v2/execute-actions   — text/font via ActionJSON / UXP script payload
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  parseJobSpec,
  type EditOp,
  type JobResult,
  type JobSpec,
} from "@psd-automation/shared";

const API_BASE =
  process.env.PSD_API_BASE ?? "https://photoshop-api.adobe.io";

export interface PsApiConfig {
  accessToken: string;
  clientId: string;
}

export function loadConfig(): PsApiConfig {
  const accessToken = process.env.PSD_API_ACCESS_TOKEN ?? "";
  const clientId = process.env.PSD_API_CLIENT_ID ?? "";
  if (!accessToken || !clientId) {
    throw new Error(
      "Set PSD_API_ACCESS_TOKEN and PSD_API_CLIENT_ID for the Photoshop API worker",
    );
  }
  return { accessToken, clientId };
}

function authHeaders(cfg: PsApiConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.accessToken}`,
    "x-api-key": cfg.clientId,
    "Content-Type": "application/json",
  };
}

/** Build create-composite edits for smart-object and (where possible) color layers. */
export function buildCompositeEdits(edits: EditOp[]) {
  return edits
    .filter((e) => e.op === "replaceSmartObject" || e.op === "setFill")
    .map((edit) => {
      if (edit.op === "replaceSmartObject") {
        return {
          type: "smart_object_layer",
          name: edit.layer,
          operation: { type: "edit" },
          smartObject: {
            smartObjectFile: {
              source: { url: `file://${edit.file}` },
            },
            autoResize: true,
          },
          transformMode: edit.transformMode === "cover" ? "fill" : "fit",
        };
      }
      return {
        type: "adjustment_layer",
        name: edit.layer,
        operation: { type: "edit" },
        // Color application details depend on layer type; documented for dual-run.
        note: `setFill ${edit.hex}`,
      };
    });
}

/** Build execute-actions payload for text + font (V2 has no declarative /text endpoint). */
export function buildTextActions(edits: EditOp[]) {
  const textEdits = edits.filter(
    (e) => e.op === "setText" || e.op === "setFont",
  );
  return {
    actions: textEdits.map((edit) => {
      if (edit.op === "setText") {
        return {
          _obj: "set",
          layerName: edit.layer,
          text: edit.value,
        };
      }
      return {
        _obj: "setFont",
        layerName: edit.layer,
        fontPostScriptName: edit.postScript,
        size: edit.sizePx,
      };
    }),
    fontOptions: {
      missingFontStrategy: "fail",
      additionalFonts: [] as { source: { url: string } }[],
    },
  };
}

export async function renderWithPsApi(
  spec: JobSpec,
  cfg: PsApiConfig,
  options?: { dryRun?: boolean; fontUrls?: string[] },
): Promise<JobResult> {
  if (options?.dryRun || process.env.PSD_API_DRY_RUN === "1") {
    return {
      jobId: spec.jobId,
      status: "Rendered",
      previewUrl: `ps-api-dry-run://${spec.contentId}`,
      outputPaths: spec.exports.map(
        (e) => join(spec.workingSetPath, e.subdir, e.filename ?? "out.jpg"),
      ),
      finishedAt: new Date().toISOString(),
    };
  }

  const compositeBody = {
    image: {
      source: {
        url: spec.templatePath
          ? `file://${spec.templatePath}`
          : undefined,
      },
    },
    edits: {
      layers: buildCompositeEdits(spec.edits),
    },
    outputs: spec.exports.map((e) => ({
      destination: {
        url: `file://${join(spec.workingSetPath, e.subdir, e.filename ?? "out.jpg")}`,
      },
      mediaType: e.format === "png" ? "image/png" : "image/jpeg",
    })),
  };

  const textBody = buildTextActions(spec.edits);
  if (options?.fontUrls?.length) {
    textBody.fontOptions.additionalFonts = options.fontUrls.map((url) => ({
      source: { url },
    }));
  }

  // Composite first (slots), then text actions — same JobSpec, two API calls.
  const compositeRes = await fetch(`${API_BASE}/v2/create-composite`, {
    method: "POST",
    headers: authHeaders(cfg),
    body: JSON.stringify(compositeBody),
  });

  if (!compositeRes.ok) {
    const body = await compositeRes.text();
    return {
      jobId: spec.jobId,
      status: "Failed",
      error: `create-composite ${compositeRes.status}: ${body}`,
      errorCode: "worker_error",
      finishedAt: new Date().toISOString(),
    };
  }

  const actionsRes = await fetch(`${API_BASE}/v2/execute-actions`, {
    method: "POST",
    headers: authHeaders(cfg),
    body: JSON.stringify({
      image: compositeBody.image,
      options: textBody,
      outputs: compositeBody.outputs,
    }),
  });

  if (!actionsRes.ok) {
    const body = await actionsRes.text();
    return {
      jobId: spec.jobId,
      status: "Failed",
      error: `execute-actions ${actionsRes.status}: ${body}`,
      errorCode: "worker_error",
      finishedAt: new Date().toISOString(),
    };
  }

  return {
    jobId: spec.jobId,
    status: "Rendered",
    outputPaths: spec.exports.map((e) =>
      join(spec.workingSetPath, e.subdir, e.filename ?? "out.jpg"),
    ),
    finishedAt: new Date().toISOString(),
  };
}

export async function renderJobSpecFile(
  path: string,
  dryRun = false,
): Promise<JobResult> {
  const spec = parseJobSpec(JSON.parse(readFileSync(path, "utf8")));
  if (dryRun) {
    return renderWithPsApi(spec, { accessToken: "dry", clientId: "dry" }, {
      dryRun: true,
    });
  }
  return renderWithPsApi(spec, loadConfig());
}

export function writeDualRunReport(
  outPath: string,
  uxpResult: JobResult,
  apiResult: JobResult,
): void {
  const report = {
    comparedAt: new Date().toISOString(),
    uxp: uxpResult,
    api: apiResult,
    statusMatch: uxpResult.status === apiResult.status,
    notes: [
      "Fonts: upload OTFs via fontOptions.additionalFonts or local/cloud will differ (Arial fallback).",
      "Effects on lock/ layers are preserved by both workers; do not edit them.",
      "Smart object linked→embedded replace is unsupported on API v2.",
    ],
  };
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
}

export function loadSiblingResult(
  doneDir: string,
  jobId: string,
): JobResult | null {
  const p = join(doneDir, `${jobId}.result.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as JobResult;
}

void basename;
void dirname;
