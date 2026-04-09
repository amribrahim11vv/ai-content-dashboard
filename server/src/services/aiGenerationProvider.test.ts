import { describe, expect, it } from "vitest";
import { buildSubmissionSnapshot } from "../logic/parse.js";
import { generateWithGuardrails } from "./aiGenerationProvider.js";

describe("aiGenerationProvider", () => {
  it("accepts injected callAPI dependency for testing", async () => {
    const snapshot = buildSubmissionSnapshot({
      brand_name: "X",
      budget_level: "3",
      num_posts: 1,
      num_image_designs: 1,
      num_video_prompts: 1,
    });
    const fakePayload = {
      posts: [{ platform: "ig", format: "post", goal: "reach", post_ar: "a", post_en: "a", hashtags: ["#a"], cta: "x" }],
      image_designs: [
        {
          platform_format: "1:1",
          design_type: "static",
          goal: "awareness",
          visual_scene: "scene",
          headline_text_overlay: "headline",
          supporting_copy: "copy",
          full_ai_image_prompt: "prompt",
          caption_ar: "تعليق",
          caption_en: "caption",
          text_policy: "no-arabic",
          conversion_trigger: "trigger",
        },
      ],
      video_prompts: [
        {
          platform: "ig",
          duration: "15s",
          style: "ugc",
          hook_type: "question",
          scenes: [{ time: "0-3", label: "hook", visual: "v", text: "t", audio: "a" }],
          caption_ar: "تعليق",
          caption_en: "caption",
          ai_tool_instructions: "instructions",
          why_this_converts: "because",
        },
      ],
      marketing_strategy: {
        content_mix_plan: "mix",
        weekly_posting_plan: "weekly",
        platform_strategy: "platforms",
        key_messaging_angles: ["angle"],
        brand_positioning_statement: "positioning",
      },
      sales_system: {
        pain_points: ["pain"],
        offer_structuring: "offer",
        funnel_plan: "funnel",
        ad_angles: ["angle"],
        objection_handling: [{ objection: "obj", response: "resp" }],
        cta_strategy: "cta",
      },
      offer_optimization: {
        rewritten_offer: "offer",
        urgency_or_scarcity: "urgency",
        alternative_offers: ["alt"],
      },
    };

    const result = await generateWithGuardrails(
      "prompt",
      snapshot,
      { apiKey: "x", model: "m", timeoutMs: 10000, maxRetries: 0 },
      undefined,
      { callAPI: async () => fakePayload }
    );
    expect(result.jsonValid).toBe(true);
  });
});
