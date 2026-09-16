import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estimateTextWidthPx,
  smartLineBreak,
  wrapWordsToWidth,
  balancedTwoLineWrap,
  fitTypeBlock,
  preferredMaxLines,
  P10_IG_4X5_WRAP,
  maxTextWidthPx,
} from "./text-wrap.js";

describe("text-wrap", () => {
  it("estimates wider text as longer", () => {
    assert.ok(
      estimateTextWidthPx("WWWWW", 90) > estimateTextWidthPx("iiiii", 90),
    );
  });

  it("balances title couplet like Preview", () => {
    const maxW = maxTextWidthPx(P10_IG_4X5_WRAP);
    const couplet = balancedTwoLineWrap("Unlock the peace you deserve", {
      maxWidthPx: maxW,
      fontSizePx: 86,
    });
    assert.deepEqual(couplet, ["Unlock the peace", "you deserve"]);
  });

  it("prefers 2 lines for peace phrase, not 3", () => {
    const maxW = maxTextWidthPx(P10_IG_4X5_WRAP);
    assert.equal(preferredMaxLines("Unlock the peace you deserve"), 2);
    const fit = fitTypeBlock({
      title: "Unlock the peace you deserve",
      maxWidthPx: maxW,
      fontSizePx: 110,
      minFontSizePx: 72,
      maxLines: 3,
    });
    assert.equal(fit.lines.length, 2);
    assert.deepEqual(fit.lines, ["Unlock the peace", "you deserve"]);
    assert.ok(fit.fontSizePx >= 72, `expected readable type, got ${fit.fontSizePx}`);
  });

  it("keeps very short copy on one line at large size", () => {
    const fit = fitTypeBlock({
      title: "Find calm",
      maxWidthPx: 800,
      fontSizePx: 110,
      minFontSizePx: 72,
    });
    assert.equal(fit.lines.length, 1);
    assert.equal(fit.fontSizePx, 110);
  });

  it("fits long title+copy in ≤3 lines without tiny type", () => {
    const maxW = maxTextWidthPx(P10_IG_4X5_WRAP);
    const fit = fitTypeBlock({
      title: "The neighbourhood knows",
      copy: "Find calm in every stay.",
      maxWidthPx: maxW,
      fontSizePx: 110,
      minFontSizePx: 72,
      maxLines: 3,
    });
    assert.ok(fit.lines.length <= 3);
    assert.ok(fit.fontSizePx >= 52);
    for (const line of fit.lines) {
      assert.ok(estimateTextWidthPx(line, fit.fontSizePx) <= maxW + 1);
    }
  });

  it("joins with Photoshop CR when wrapping long single field", () => {
    const s = smartLineBreak(
      "Stay vibrant stay Perfect Ten this season across town",
      {
        maxWidthPx: maxTextWidthPx(P10_IG_4X5_WRAP),
        fontSizePx: 90,
      },
    );
    assert.ok(s.includes("\r"));
  });

  it("keeps neighbourhood within bounds at autofit size", () => {
    const maxW = maxTextWidthPx(P10_IG_4X5_WRAP);
    const fit = fitTypeBlock({
      title: "The neighbourhood knows",
      copy: "Find calm here.",
      maxWidthPx: maxW,
      fontSizePx: 86,
      minFontSizePx: 72,
      maxLines: 3,
    });
    assert.ok(fit.lines.length >= 2);
    for (const line of fit.lines) {
      assert.ok(
        estimateTextWidthPx(line, fit.fontSizePx) <= maxW + 1,
        `line overflow: "${line}" @ ${fit.fontSizePx}`,
      );
    }
  });

  it("does not orphan The / neighbourhood on 1:1 width", () => {
    const maxW = 908; // canvasSafeBounds(1080,1080).typeMaxWidth
    const fit = fitTypeBlock({
      title: "The neighbourhood knows",
      copy: "Find calm here.",
      maxWidthPx: maxW,
      fontSizePx: 110,
      minFontSizePx: 90,
      maxLines: 3,
    });
    assert.notEqual(fit.lines[0], "The");
    assert.ok(!fit.lines.some((l) => l === "neighbourhood"));
    // Copy stays intact on its own line
    assert.ok(fit.lines.some((l) => l === "Find calm here."));
    assert.ok(!fit.lines.some((l) => /knows Find/.test(l)));
  });

  it("keeps short copy on one line", () => {
    const lines = wrapWordsToWidth("Find calm", {
      maxWidthPx: 800,
      fontSizePx: 90,
    });
    assert.deepEqual(lines, ["Find calm"]);
  });

  it("does not break inside a word", () => {
    const lines = wrapWordsToWidth("Supercalifragilistic expialidocious", {
      maxWidthPx: 200,
      fontSizePx: 90,
    });
    assert.equal(lines.length, 2);
    assert.ok(!lines[0]?.includes(" "));
  });
});
