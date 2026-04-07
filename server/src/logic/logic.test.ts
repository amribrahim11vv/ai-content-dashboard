import { describe, it, expect, afterEach, vi } from "vitest";
import { buildSubmissionSnapshot, sanitizeCount, extractFirstEmail, briefFingerprint } from "./parse.js";
import { getIndustryModule, isHighBudget, parseBudgetLevel } from "./industry.js";
import { normalizeDeliveryStatus, getStatusBadgeLabel, getStatusBadgePalette } from "./status.js";
import { validateGeminiResponse } from "./validate.js";
import { validatePromptTemplateContract } from "./promptTemplateValidation.js";
import { isStrictPromptTemplates } from "./promptStrictEnv.js";
import { campaignModeInstructionBlock } from "./campaignMode.js";
import { buildClientContextBlock, buildOutputPolicyBlock, composePrompt } from "./promptComposer.js";
import { getGeminiResponseSchema } from "./responseSchema.js";
import { getRegenerateItemSchema, getSectionArray } from "../routes/kits.js";

describe("parse", () => {
  it("sanitizes counts", () => {
    expect(sanitizeCount("x", 1, 10, 5)).toBe(5);
    expect(sanitizeCount("12 posts", 1, 10, 5)).toBe(10);
    expect(sanitizeCount(3, 1, 10, 5)).toBe(3);
  });

  it("extracts first email", () => {
    expect(extractFirstEmail("contact me at test@example.com thanks")).toBe("test@example.com");
  });

  it("brief fingerprint stable for same snapshot", () => {
    const a = buildSubmissionSnapshot({
      brand_name: "X",
      num_posts: 5,
      submitted_at: "2020-01-01T00:00:00.000Z",
    });
    const b = buildSubmissionSnapshot({
      brand_name: "X",
      num_posts: 5,
      submitted_at: "2020-01-01T00:00:00.000Z",
    });
    expect(briefFingerprint(a)).toBe(briefFingerprint(b));
  });

  it("normalizes campaign_mode", () => {
    expect(buildSubmissionSnapshot({ campaign_mode: "deep" }).campaign_mode).toBe("deep");
    expect(buildSubmissionSnapshot({}).campaign_mode).toBe("social");
    expect(buildSubmissionSnapshot({ campaign_mode: "bogus" }).campaign_mode).toBe("social");
  });
});

describe("industry", () => {
  it("clinic module includes Arabic طب", () => {
    expect(getIndustryModule("عيادة طب")).toContain("CLINIC");
  });

  it("high budget", () => {
    expect(isHighBudget("6")).toBe(true);
    expect(parseBudgetLevel("")).toBe(3);
  });
});

describe("status", () => {
  it("normalizes delivery statuses", () => {
    expect(normalizeDeliveryStatus("FAILED_GENERATION")).toBe("failed_generation");
    expect(getStatusBadgeLabel("failed_generation")).toBe("Failed");
    expect(getStatusBadgeLabel("retry_in_progress")).toBe("Running");
    expect(getStatusBadgePalette("failed_generation").fg).toContain("#");
  });
});

describe("promptTemplateValidation", () => {
  it("accepts farming_niche as alias for industry", () => {
    const t =
      "{{brand_name}}{{farming_niche}}{{target_audience}}{{main_goal}}{{platforms}}{{brand_tone}}{{offer}}{{num_posts}}{{num_image_designs}}{{num_video_prompts}}";
    const r = validatePromptTemplateContract(t);
    expect(r.ok).toBe(true);
  });

  it("accepts creative-only text without placeholders", () => {
    const r = validatePromptTemplateContract("Focus on trust, clarity, and practical demonstrations.");
    expect(r.ok).toBe(true);
    expect(r.mode).toBe("creative_only");
    expect(r.missingVariables.length).toBe(0);
  });
});

describe("campaignModeInstructionBlock", () => {
  it("returns non-empty blocks for each mode", () => {
    expect(campaignModeInstructionBlock("social").length).toBeGreaterThan(40);
    expect(campaignModeInstructionBlock("offer")).toContain("conversion");
    expect(campaignModeInstructionBlock("deep")).toContain("authority");
  });
});

describe("promptComposer", () => {
  it("injects client context and strict output policy", () => {
    const snapshot = buildSubmissionSnapshot({
      brand_name: "Alpha Seeds",
      industry: "Agriculture",
      target_audience: "Farm owners",
      main_goal: "Increase inquiries",
      platforms: "Instagram, YouTube",
      campaign_mode: "offer",
      num_posts: 6,
      num_image_designs: 4,
      num_video_prompts: 2,
    });
    const composed = composePrompt({
      campaignPrefix: campaignModeInstructionBlock("offer"),
      creativeDirection: "Show durability in real muddy field operations.",
      snapshot,
      mode: "offer",
    });
    expect(composed).toContain("Client Context (auto-injected)");
    expect(composed).toContain("Brand name: Alpha Seeds");
    expect(composed).toContain("Use `post_ar` and `post_en`");
    expect(composed).toContain("equivalent versions in meaning");
    expect(composed).toContain("DO NOT include Arabic typography");
  });

  it("output policy contains media caption constraints", () => {
    const block = buildOutputPolicyBlock("social");
    expect(block).toContain("caption_ar");
    expect(block).toContain("caption_en");
  });

  it("client context block includes requested counts", () => {
    const snapshot = buildSubmissionSnapshot({
      num_posts: 9,
      num_image_designs: 5,
      num_video_prompts: 3,
    });
    const block = buildClientContextBlock(snapshot);
    expect(block).toContain("Requested posts count: 9");
    expect(block).toContain("Requested image designs count: 5");
    expect(block).toContain("Requested video prompts count: 3");
  });
});

describe("responseSchema", () => {
  it("requires post key and media captions", () => {
    const schema = getGeminiResponseSchema();
    const props = (schema.properties ?? {}) as Record<string, any>;
    const postReq = props.posts.items.required as string[];
    expect(postReq).toContain("post_ar");
    expect(postReq).toContain("post_en");

    const imageReq = props.image_designs.items.required as string[];
    expect(imageReq).toContain("caption_ar");
    expect(imageReq).toContain("caption_en");

    const videoReq = props.video_prompts.items.required as string[];
    expect(videoReq).toContain("caption_ar");
    expect(videoReq).toContain("caption_en");
  });
});

describe("promptStrictEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to non-strict when STRICT_PROMPT_TEMPLATES unset", () => {
    vi.stubEnv("STRICT_PROMPT_TEMPLATES", "");
    expect(isStrictPromptTemplates()).toBe(false);
  });

  it("is strict when STRICT_PROMPT_TEMPLATES is true", () => {
    vi.stubEnv("STRICT_PROMPT_TEMPLATES", "true");
    expect(isStrictPromptTemplates()).toBe(true);
  });
});

describe("validate", () => {
  it("requires kpi for high budget", () => {
    const data = buildSubmissionSnapshot({ brand_name: "b", budget_level: "7", num_posts: 1, num_image_designs: 1, num_video_prompts: 1 });
    const bad = {
      posts: [{ platform: "x", format: "y", goal: "g", post_ar: "c", post_en: "c", hashtags: ["#a"], cta: "x" }],
      image_designs: [
        {
          platform_format: "1:1",
          design_type: "d",
          goal: "g",
          visual_scene: "v",
          headline_text_overlay: "h",
          supporting_copy: "s",
          full_ai_image_prompt: "9:16 detailed",
          caption_ar: "تعليق الصورة",
          caption_en: "Image caption",
          text_policy: "ar",
          conversion_trigger: "t",
        },
      ],
      video_prompts: [
        {
          platform: "p",
          duration: "15s",
          style: "s",
          hook_type: "h",
          scenes: [{ time: "0", label: "l", visual: "v", text: "t", audio: "a" }],
          caption_ar: "تعليق الفيديو",
          caption_en: "Video caption",
          ai_tool_instructions: "i",
          why_this_converts: "w",
        },
      ],
      marketing_strategy: {
        content_mix_plan: "a",
        weekly_posting_plan: "b",
        platform_strategy: "c",
        key_messaging_angles: ["d"],
        brand_positioning_statement: "e",
      },
      sales_system: {
        pain_points: ["p"],
        offer_structuring: "o",
        funnel_plan: "f",
        ad_angles: ["a"],
        objection_handling: [{ objection: "o", response: "r" }],
        cta_strategy: "c",
      },
      offer_optimization: {
        rewritten_offer: "r",
        urgency_or_scarcity: "u",
        alternative_offers: ["a"],
      },
    };
    expect(validateGeminiResponse(bad, data).some((e) => e.includes("kpi_tracking"))).toBe(true);
  });
});

describe("regenerate-item helpers", () => {
  it("selects correct section by item type", () => {
    const obj = {
      posts: [{ post_ar: "a", post_en: "a" }],
      image_designs: [{ caption_ar: "a", caption_en: "a" }],
      video_prompts: [{ caption_ar: "a", caption_en: "a" }],
    };
    expect(getSectionArray(obj, "post")?.key).toBe("posts");
    expect(getSectionArray(obj, "image")?.key).toBe("image_designs");
    expect(getSectionArray(obj, "video")?.key).toBe("video_prompts");
  });

  it("builds bilingual regenerate schema for post", () => {
    const schema = getRegenerateItemSchema("post") as Record<string, any>;
    const req = schema.properties.item.required as string[];
    expect(req).toContain("post_ar");
    expect(req).toContain("post_en");
  });
});
