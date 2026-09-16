import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintLayerNames } from "./lint.js";

describe("lintLayerNames", () => {
  it("fails without txt/headline", () => {
    const result = lintLayerNames("test", ["clr/accent", "Background"]);
    assert.equal(result.ok, false);
    assert.ok(result.missingRequired.includes("txt/headline"));
  });

  it("passes with required layer", () => {
    const result = lintLayerNames("test", [
      "txt/headline",
      "clr/accent",
      "slot/hero",
    ]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.missingRequired, []);
  });
});
