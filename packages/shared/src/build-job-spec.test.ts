import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildJobSpec, buildEdits } from "./build-job-spec.js";
import { parseJobSpec } from "./job-spec.js";
import type { BrandKitRow, ContentItem, LayerBinding, TemplateRow } from "./sheets.js";

const content: ContentItem = {
  Content_ID: "Q1_W1_01",
  Property: "hotel_1",
  Publish_Date: "1.1.26",
  Title: "Unlock the peace you deserve",
  Copy: "",
  Copy_ZH: "",
  Hashtags: "",
  Platforms: "Instagram",
  Ratios: "4:5,1:1",
  Template_ID: "",
  WorkingSet_Folder_ID: "1IjyC-xQ1-1ctnDCE2TGUzJJsl0Xs-JPG",
  WorkingSet_Path: "G:/Shared drives/Hotel1/1.1.26",
  Hero_File: "hero.jpg",
  Bg_File: "bg.jpg",
  Content_Group_ID: "",
  Status: "Approved",
  Preview_URL: "",
  Render_Error: "",
};

const brandKit: BrandKitRow = {
  Property: "hotel_1",
  color_bg: "#F5F0E8",
  color_accent: "#1A1A1A",
  color_type: "#111111",
  font_headline: "MyriadPro-Bold",
  font_body: "MyriadPro-Regular",
  logo_file_id: "",
  logo_filename: "logo.png",
  default_template_4x5: "tpl_ig_4x5",
  default_template_1x1: "tpl_ig_1x1",
  default_template_9x16: "tpl_story_9x16",
  default_template_16x9: "tpl_cover_16x9",
};

const bindings: LayerBinding[] = [
  {
    Template_ID: "tpl_ig_4x5",
    layer_name: "txt/headline",
    kind: "text",
    field: "Title",
  },
  {
    Template_ID: "tpl_ig_4x5",
    layer_name: "txt/sub",
    kind: "text",
    field: "Copy",
  },
  {
    Template_ID: "tpl_ig_4x5",
    layer_name: "clr/accent",
    kind: "color",
    field: "color.accent",
  },
  {
    Template_ID: "tpl_ig_4x5",
    layer_name: "txt/headline",
    kind: "font",
    field: "font.headline",
  },
  {
    Template_ID: "tpl_ig_4x5",
    layer_name: "slot/hero",
    kind: "slot",
    field: "slot.hero",
  },
];

const templates: TemplateRow[] = [
  {
    Template_ID: "tpl_ig_4x5",
    Master_PSD_Drive_ID: "",
    Master_PSD_Path: "G:/templates/tpl_ig_4x5.psd",
    Ratio: "4:5",
    Artboard: "",
    Photoshop_Min_Version: "24.2",
  },
];

describe("buildJobSpec", () => {
  it("builds a valid JobSpec for Q1_W1_01 4:5", () => {
    const spec = buildJobSpec({
      jobId: "job_test_4x5",
      content,
      brandKit,
      bindings,
      templates,
      ratio: "4:5",
    });
    const parsed = parseJobSpec(spec);
    assert.equal(parsed.contentId, "Q1_W1_01");
    assert.equal(parsed.templateId, "tpl_ig_4x5");
    assert.equal(parsed.exports[0]?.subdir, "4x5_1.1.26");
    assert.ok(parsed.edits.some((e) => e.op === "setText"));
  });

  it("maps bindings to edits", () => {
    const edits = buildEdits(content, brandKit, bindings, "tpl_ig_4x5");
    // Copy empty → Title smart-wrapped into a single txt/headline box
    assert.equal(edits.length, 5);
    const headline = edits.find(
      (e) => e.op === "setText" && e.layer === "txt/headline",
    );
    const sub = edits.find((e) => e.op === "setText" && e.layer === "txt/sub");
    assert.ok(headline && headline.op === "setText");
    assert.ok(sub && sub.op === "setText");
    if (headline.op === "setText" && sub.op === "setText") {
      assert.equal(headline.value, "Unlock the peace\ryou deserve");
      assert.equal(sub.value.trim(), "");
      assert.ok((headline.sizePx ?? 0) >= 72);
    }
  });

  it("wraps long Copy into one headline box with fitTypeBlock", () => {
    const withCopy = {
      ...content,
      Title: "Short",
      Copy: "Find calm in every stay across the neighbourhood this season",
    };
    const edits = buildEdits(withCopy, brandKit, bindings, "tpl_ig_4x5");
    const headline = edits.find(
      (e) => e.op === "setText" && e.layer === "txt/headline",
    );
    const sub = edits.find((e) => e.op === "setText" && e.layer === "txt/sub");
    assert.ok(headline && headline.op === "setText");
    assert.ok(sub && sub.op === "setText");
    if (headline.op === "setText" && sub.op === "setText") {
      assert.ok(headline.value.includes("neighbourhood"));
      assert.ok(
        headline.value.includes("\r") || headline.value.split(/\s+/).length >= 2,
        "expected multi-line type block in one layer",
      );
      assert.equal(sub.value.trim(), "");
    }
  });
});
