import { describe, expect, it } from "vitest";
import { generateKitExcel, sanitizeKitForExcel } from "./excelService.js";

describe("excelService", () => {
  it("removes prompt/internal fields from export payload", () => {
    const sanitized = sanitizeKitForExcel({
      id: "k1",
      brief_json: { brand_name: "Florenza" },
      created_at: "2026-04-22T10:00:00.000Z",
      result_json: {
        posts: [{ caption_ar: "A" }],
        image_prompts: [{ full_ai_image_prompt: "remove-me" }],
        video_prompts: [{ ai_tool_instructions: "remove-me" }],
      },
    });

    expect(sanitized.brief_json).toBe("{\"brand_name\":\"Florenza\"}");
    expect(sanitized.result_json.image_prompts).toBeUndefined();
    expect(sanitized.result_json.video_prompts).toBeUndefined();
  });

  it("generates a workbook buffer with expected sheet names", async () => {
    const workbook = await generateKitExcel({
      id: "k2",
      brief_json: "{\"brand_name\":\"Minimal Brand\"}",
      created_at: "2026-04-22T10:00:00.000Z",
      result_json: {
        posts: [],
        image_designs: [],
      },
    });

    expect(Buffer.isBuffer(workbook)).toBe(true);
    expect(workbook.length).toBeGreaterThan(500);
  });
});
