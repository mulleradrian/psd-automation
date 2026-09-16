import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFixtures, findContent } from "./store.js";
import { queueFromData } from "./queue.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "../../../fixtures/sheets");

describe("fixtures + queue", () => {
  it("loads Q1_W1_01 from Content_DB", () => {
    const data = loadFixtures(fixturesDir);
    const item = findContent(data, "Q1_W1_01");
    assert.ok(item);
    assert.equal(item.Title, "Unlock the peace you deserve");
  });

  it("queues ratio fan-out jobspecs", () => {
    const data = loadFixtures(fixturesDir);
    const tmp = mkdtempSync(join(tmpdir(), "psd-q-"));
    const result = queueFromData(
      data,
      {
        contentId: "Q1_W1_01",
        repoRoot: tmp,
        worker: "uxp",
      },
      {
        fixturesDir,
        queueDir: join(tmp, "queue"),
        doneDir: join(tmp, "done"),
        failedDir: join(tmp, "failed"),
        jobsCsv: join(tmp, "Jobs.csv"),
      },
    );
    assert.ok(result.specs.length >= 2);
    assert.ok(result.specs.some((s) => s.templateId === "tpl_ig_4x5"));
    assert.ok(result.specs.some((s) => s.templateId === "tpl_ig_1x1"));
  });
});
