import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fracsFromBox,
  targetBoxFromFracs,
  canvasSafeBounds,
} from "./layout-ratios.js";

describe("layout-ratios", () => {
  it("round-trips fracsFromBox → targetBoxFromFracs", () => {
    const fr = fracsFromBox({ left: 100, top: 200, right: 400, bottom: 500 }, 1000, 1000);
    const box = targetBoxFromFracs(fr, 1000, 1000);
    assert.equal(Math.round(box.left), 100);
    assert.equal(Math.round(box.top), 200);
  });

  it("maps fracs across canvas sizes", () => {
    const fr = fracsFromBox({ left: 108, top: 100, right: 972, bottom: 200 }, 1080, 1350);
    const box = targetBoxFromFracs(fr, 1920, 1080);
    assert.ok(box.width > 0);
    assert.ok(box.height > 0);
  });

  it("canvasSafeBounds includes multi-edge type constraints", () => {
    const b = canvasSafeBounds(1080, 1350);
    assert.ok(b.typeMaxWidth > 800);
    assert.ok(b.typeBottomMax < b.height);
    assert.ok(b.ten.width > 0);
    assert.equal(b.allowTenOverlap, false);
  });

  it("tall story has bottom clearance", () => {
    const tall = canvasSafeBounds(1080, 1920);
    assert.ok(tall.typeBottomMax < tall.height - 50);
  });
});
