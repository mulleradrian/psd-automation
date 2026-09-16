import { z } from "zod";

export const ContentItemSchema = z.object({
  Content_ID: z.string().min(1),
  Property: z.string().min(1),
  Publish_Date: z.string().optional().default(""),
  Title: z.string().optional().default(""),
  Copy: z.string().optional().default(""),
  Copy_ZH: z.string().optional().default(""),
  Hashtags: z.string().optional().default(""),
  Platforms: z.string().optional().default(""),
  Ratios: z.string().optional().default("4:5,1:1"),
  Template_ID: z.string().optional().default(""),
  WorkingSet_Folder_ID: z.string().optional().default(""),
  WorkingSet_Path: z.string().optional().default(""),
  Hero_File: z.string().optional().default("hero.jpg"),
  Bg_File: z.string().optional().default("bg.jpg"),
  Content_Group_ID: z.string().optional().default(""),
  Status: z.string().optional().default("Draft"),
  Preview_URL: z.string().optional().default(""),
  Render_Error: z.string().optional().default(""),
});
export type ContentItem = z.infer<typeof ContentItemSchema>;

export const BrandKitRowSchema = z.object({
  Property: z.string().min(1),
  color_bg: z.string().optional().default("#FFFFFF"),
  color_accent: z.string().optional().default("#1A1A1A"),
  color_type: z.string().optional().default("#111111"),
  font_headline: z.string().optional().default("MyriadPro-Bold"),
  font_body: z.string().optional().default("MyriadPro-Regular"),
  logo_file_id: z.string().optional().default(""),
  logo_filename: z.string().optional().default("logo.png"),
  default_template_4x5: z.string().optional().default("tpl_ig_4x5"),
  default_template_1x1: z.string().optional().default("tpl_ig_1x1"),
  default_template_9x16: z.string().optional().default("tpl_story_9x16"),
  default_template_16x9: z.string().optional().default("tpl_cover_16x9"),
});
export type BrandKitRow = z.infer<typeof BrandKitRowSchema>;

export const TemplateRowSchema = z.object({
  Template_ID: z.string().min(1),
  Master_PSD_Drive_ID: z.string().optional().default(""),
  Master_PSD_Path: z.string().optional().default(""),
  Ratio: z.string().min(1),
  Artboard: z.string().optional().default(""),
  Photoshop_Min_Version: z.string().optional().default("24.2"),
});
export type TemplateRow = z.infer<typeof TemplateRowSchema>;

export const LayerBindingSchema = z.object({
  Template_ID: z.string().min(1),
  layer_name: z.string().min(1),
  kind: z.enum(["text", "color", "font", "slot"]),
  field: z.string().min(1),
});
export type LayerBinding = z.infer<typeof LayerBindingSchema>;

export const JobRowSchema = z.object({
  Job_ID: z.string().min(1),
  Content_ID: z.string().min(1),
  Requested_By: z.string().optional().default(""),
  Status: z.enum(["Queued", "Rendering", "Rendered", "Failed"]),
  Worker: z.enum(["uxp", "ps-api"]).default("uxp"),
  Parent_Job_ID: z.string().optional().default(""),
  Template_ID: z.string().optional().default(""),
  Ratio: z.string().optional().default(""),
  Created_At: z.string().optional().default(""),
  Updated_At: z.string().optional().default(""),
  Output_Links: z.string().optional().default(""),
  Error: z.string().optional().default(""),
});
export type JobRow = z.infer<typeof JobRowSchema>;

export function parseRatios(ratios: string): string[] {
  return String(ratios || "")
    .split(/[,;/|]+/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => r.replace(/[x×]/gi, ":").replace(/\s+/g, ""))
    .filter((r) => /^(4:5|1:1|9:16|16:9)$/.test(r));
}
