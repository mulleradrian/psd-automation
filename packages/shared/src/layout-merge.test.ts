import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  boxFromEntry,
  captureEntryFromBounds,
  mergeLayoutLayers,
  propsForKind,
  variantLayoutPath,
  placeGroupFromAnchor,
  DEFAULT_TYPE_GROUP,
} from "./layout-merge.js";

describe("layout-merge", () => {
  it("captures fracs and round-trips via boxFromEntry", () => {
    const entry = captureEntryFromBounds(108, 990, 1016, 1200, 1080, 1350);
    assert.ok(entry.leftFrac != null);
    const box = boxFromEntry(entry, 1080, 1350);
    assert.ok(box);
    assert.equal(Math.round(box!.left), 108);
    assert.equal(Math.round(box!.top), 990);
  });

  it("merges sparse variant overrides", () => {
    const merged = mergeLayoutLayers(
      { "slot/ten": { leftFrac: 0.1, locked: true }, "txt/headline": { locked: false } },
      { "txt/headline": { locked: true, props: { sizePx: 80 } } },
    );
    assert.equal(merged["slot/ten"]?.locked, true);
    assert.equal(merged["txt/headline"]?.locked, true);
    assert.equal(merged["txt/headline"]?.props?.sizePx, 80);
  });

  it("lists text props from registry", () => {
    assert.ok(propsForKind("text").includes("contents"));
    assert.ok(propsForKind("text").includes("sizePx"));
  });

  it("builds variant path", () => {
    assert.equal(
      variantLayoutPath("Q1_W1_01", "4x5"),
      "fixtures/templater/layouts/variants/Q1_W1_01_4x5.json",
    );
  });

  it("places type group from headline anchor", () => {
    const placed = placeGroupFromAnchor(
      DEFAULT_TYPE_GROUP,
      "txt/headline",
      { left: 108, top: 900, right: 900, bottom: 1100, width: 792, height: 200 },
      1080,
      1350,
    );
    assert.ok(placed["lock/accent_rule"]);
    assert.ok(placed["lock/accent_dot"]);
    assert.ok(placed["lock/accent_rule"].top >= 1100);
  });
});
