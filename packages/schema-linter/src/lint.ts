import { readFileSync } from "node:fs";
import { readPsd, type Layer } from "ag-psd";
import {
  SCHEMA_RECOMMENDED_LAYERS,
  SCHEMA_REQUIRED_LAYERS,
  formatLintReport,
  isSchemaLayerName,
  layerKind,
  type LayerInventoryItem,
  type SchemaLintResult,
} from "@psd-automation/shared";

function walkLayers(
  layers: Layer[] | undefined,
  out: LayerInventoryItem[],
): void {
  if (!layers) return;
  for (const layer of layers) {
    const name = layer.name ?? "";
    if (name) {
      out.push({
        name,
        kind: layerKind(name),
        isSmartObject: Boolean(
          layer.placedLayer ||
            (layer as Layer & { smartObject?: unknown }).smartObject,
        ),
        isText: Boolean(layer.text),
        visible: layer.hidden !== true,
      });
    }
    if (layer.children) {
      walkLayers(layer.children, out);
    }
  }
}

export function lintPsdBuffer(
  filePath: string,
  buffer: ArrayBuffer | Buffer,
): SchemaLintResult {
  const ab =
    buffer instanceof ArrayBuffer
      ? buffer
      : buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        );
  const psd = readPsd(ab as ArrayBuffer, {
    skipLayerImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
  });

  const layers: LayerInventoryItem[] = [];
  walkLayers(psd.children, layers);

  const names = new Set(layers.map((l) => l.name));
  const missingRequired = SCHEMA_REQUIRED_LAYERS.filter((n) => !names.has(n));
  const missingRecommended = SCHEMA_RECOMMENDED_LAYERS.filter(
    (n) => !names.has(n),
  );
  const unknownNamed = layers
    .map((l) => l.name)
    .filter((n) => !isSchemaLayerName(n));

  const warnings: string[] = [];
  const errors: string[] = [];

  for (const name of SCHEMA_REQUIRED_LAYERS) {
    if (!names.has(name)) {
      errors.push(`Required layer missing: ${name}`);
    }
  }

  for (const layer of layers) {
    if (layer.name.startsWith("slot/") && !layer.isSmartObject) {
      warnings.push(
        `${layer.name} should be a smart object for replaceSmartObject`,
      );
    }
    if (layer.name.startsWith("txt/") && !layer.isText) {
      warnings.push(`${layer.name} is named as text but has no text data`);
    }
  }

  return {
    ok: missingRequired.length === 0 && errors.length === 0,
    filePath,
    layers,
    missingRequired: [...missingRequired],
    missingRecommended: [...missingRecommended],
    unknownNamed,
    warnings,
    errors,
  };
}

export function lintPsdFile(filePath: string): SchemaLintResult {
  const buf = readFileSync(filePath);
  return lintPsdBuffer(filePath, buf);
}

export function lintLayerNames(
  filePath: string,
  layerNames: string[],
): SchemaLintResult {
  const layers: LayerInventoryItem[] = layerNames.map((name) => ({
    name,
    kind: layerKind(name),
  }));
  const names = new Set(layerNames);
  const missingRequired = SCHEMA_REQUIRED_LAYERS.filter((n) => !names.has(n));
  const missingRecommended = SCHEMA_RECOMMENDED_LAYERS.filter(
    (n) => !names.has(n),
  );
  return {
    ok: missingRequired.length === 0,
    filePath,
    layers,
    missingRequired: [...missingRequired],
    missingRecommended: [...missingRecommended],
    unknownNamed: layerNames.filter((n) => !isSchemaLayerName(n)),
    warnings: [],
    errors: missingRequired.map((n) => `Required layer missing: ${n}`),
  };
}

export { formatLintReport };
