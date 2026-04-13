/** Gemini API responseSchema — parity with gGetGeminiResponseSchema */
export function getGeminiResponseSchema(): Record<string, unknown> {
  return {
    type: "OBJECT",
    required: [
      "posts",
      "image_designs",
      "video_prompts",
      "marketing_strategy",
      "sales_system",
      "offer_optimization",
      "diagnosis_plan",
      "narrative_summary",
    ],
    properties: {
      posts: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          required: ["platform", "format", "goal", "post_ar", "post_en", "hashtags", "cta"],
          properties: {
            platform: { type: "STRING" },
            format: { type: "STRING" },
            goal: { type: "STRING" },
            post_ar: { type: "STRING" },
            post_en: { type: "STRING" },
            hashtags: { type: "ARRAY", items: { type: "STRING" } },
            cta: { type: "STRING" },
          },
        },
      },
      image_designs: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          required: [
            "platform_format",
            "design_type",
            "goal",
            "visual_scene",
            "headline_text_overlay",
            "supporting_copy",
            "full_ai_image_prompt",
            "caption_ar",
            "caption_en",
            "text_policy",
            "conversion_trigger",
          ],
          properties: {
            platform_format: { type: "STRING" },
            design_type: { type: "STRING" },
            goal: { type: "STRING" },
            visual_scene: { type: "STRING" },
            headline_text_overlay: { type: "STRING" },
            supporting_copy: { type: "STRING" },
            full_ai_image_prompt: { type: "STRING" },
            caption_ar: { type: "STRING" },
            caption_en: { type: "STRING" },
            text_policy: { type: "STRING" },
            conversion_trigger: { type: "STRING" },
          },
        },
      },
      video_prompts: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          required: ["platform", "duration", "style", "hook_type", "scenes", "caption_ar", "caption_en", "ai_tool_instructions", "why_this_converts"],
          properties: {
            platform: { type: "STRING" },
            duration: { type: "STRING" },
            style: { type: "STRING" },
            hook_type: { type: "STRING" },
            scenes: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                required: ["time", "label", "visual", "text", "audio"],
                properties: {
                  time: { type: "STRING" },
                  label: { type: "STRING" },
                  visual: { type: "STRING" },
                  text: { type: "STRING" },
                  audio: { type: "STRING" },
                },
              },
            },
            caption_ar: { type: "STRING" },
            caption_en: { type: "STRING" },
            ai_tool_instructions: { type: "STRING" },
            why_this_converts: { type: "STRING" },
          },
        },
      },
      marketing_strategy: {
        type: "OBJECT",
        required: [
          "content_mix_plan",
          "weekly_posting_plan",
          "platform_strategy",
          "key_messaging_angles",
          "brand_positioning_statement",
        ],
        properties: {
          content_mix_plan: { type: "STRING" },
          weekly_posting_plan: { type: "STRING" },
          platform_strategy: { type: "STRING" },
          key_messaging_angles: { type: "ARRAY", items: { type: "STRING" } },
          brand_positioning_statement: { type: "STRING" },
        },
      },
      sales_system: {
        type: "OBJECT",
        required: ["pain_points", "offer_structuring", "funnel_plan", "ad_angles", "objection_handling", "cta_strategy"],
        properties: {
          pain_points: { type: "ARRAY", items: { type: "STRING" } },
          offer_structuring: { type: "STRING" },
          funnel_plan: { type: "STRING" },
          ad_angles: { type: "ARRAY", items: { type: "STRING" } },
          objection_handling: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              required: ["objection", "response"],
              properties: {
                objection: { type: "STRING" },
                response: { type: "STRING" },
              },
            },
          },
          cta_strategy: { type: "STRING" },
        },
      },
      offer_optimization: {
        type: "OBJECT",
        required: ["rewritten_offer", "urgency_or_scarcity", "alternative_offers"],
        properties: {
          rewritten_offer: { type: "STRING" },
          urgency_or_scarcity: { type: "STRING" },
          alternative_offers: { type: "ARRAY", items: { type: "STRING" } },
        },
      },
      diagnosis_plan: {
        type: "OBJECT",
        required: ["quickWin24h", "focus7d", "priority", "rationale"],
        properties: {
          quickWin24h: { type: "STRING" },
          focus7d: { type: "STRING" },
          priority: { type: "STRING" },
          rationale: { type: "STRING" },
        },
      },
      narrative_summary: {
        type: "STRING",
      },
      kpi_tracking: {
        type: "OBJECT",
        properties: {
          top_kpis: { type: "ARRAY", items: { type: "STRING" } },
          benchmarks: { type: "STRING" },
          optimization_actions: { type: "STRING" },
          ab_tests_week1: { type: "ARRAY", items: { type: "STRING" } },
        },
      },
    },
  };
}
