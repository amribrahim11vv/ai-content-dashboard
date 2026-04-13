export type RegenerateItemType = "post" | "image" | "video";

const SECTION_KEYS: Record<RegenerateItemType, string[]> = {
  post: ["posts"],
  image: ["image_designs", "image_prompts", "creative_prompts", "design_prompts", "visual_prompts"],
  video: ["video_prompts", "video_assets", "ai_video_assets", "assets"],
};

export function getSectionArray(result: Record<string, unknown>, type: RegenerateItemType): { key: string; items: unknown[] } | null {
  const keys = SECTION_KEYS[type];
  for (const key of keys) {
    const value = result[key];
    if (Array.isArray(value)) return { key, items: value };
  }
  return null;
}

export function getRegenerateItemSchema(type: RegenerateItemType): Record<string, unknown> {
  if (type === "post") {
    return {
      type: "OBJECT",
      required: ["item"],
      properties: {
        item: {
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
    };
  }
  if (type === "image") {
    return {
      type: "OBJECT",
      required: ["item"],
      properties: {
        item: {
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
    };
  }
  return {
    type: "OBJECT",
    required: ["item"],
    properties: {
      item: {
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
  };
}
