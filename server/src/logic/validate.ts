import type { SubmissionSnapshot } from "./constants.js";
import { isHighBudget } from "./industry.js";
import { isPlainObject } from "./parse.js";

export function validateGeminiResponse(aiContent: unknown, data: SubmissionSnapshot): string[] {
  const errors: string[] = [];

  if (!isPlainObject(aiContent)) {
    return ["Root response must be a JSON object."];
  }

  const highBudgetMode = isHighBudget(data.budget_level);

  validateArrayCount("posts", aiContent.posts, data.num_posts, highBudgetMode, errors);
  validateArrayCount("image_designs", aiContent.image_designs, data.num_image_designs, highBudgetMode, errors);
  validateArrayCount("video_prompts", aiContent.video_prompts, data.num_video_prompts, highBudgetMode, errors);

  validateObjectKeys(
    aiContent.marketing_strategy,
    ["content_mix_plan", "weekly_posting_plan", "platform_strategy", "key_messaging_angles", "brand_positioning_statement"],
    "marketing_strategy",
    errors
  );

  validateObjectKeys(
    aiContent.sales_system,
    ["pain_points", "offer_structuring", "funnel_plan", "ad_angles", "objection_handling", "cta_strategy"],
    "sales_system",
    errors
  );

  validateObjectKeys(aiContent.offer_optimization, ["rewritten_offer", "urgency_or_scarcity", "alternative_offers"], "offer_optimization", errors);

  if (highBudgetMode && !isPlainObject(aiContent.kpi_tracking)) {
    errors.push("kpi_tracking is required for high budget mode.");
  }

  if (!highBudgetMode && aiContent.kpi_tracking && !isPlainObject(aiContent.kpi_tracking)) {
    errors.push("kpi_tracking must be an object if provided.");
  }

  const posts = Array.isArray(aiContent.posts) ? aiContent.posts : [];
  posts.forEach((item: unknown, idx: number) => {
    validateObjectKeys(item, ["platform", "format", "goal", "post_ar", "post_en", "hashtags", "cta"], "posts[" + idx + "]", errors);
    if (isPlainObject(item) && !Array.isArray(item.hashtags)) {
      errors.push("posts[" + idx + "].hashtags must be an array.");
    }
  });

  const images = Array.isArray(aiContent.image_designs) ? aiContent.image_designs : [];
  images.forEach((item: unknown, idx: number) => {
    validateObjectKeys(
      item,
      [
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
      "image_designs[" + idx + "]",
      errors
    );
  });

  const videos = Array.isArray(aiContent.video_prompts) ? aiContent.video_prompts : [];
  videos.forEach((item: unknown, idx: number) => {
    validateObjectKeys(
      item,
      ["platform", "duration", "style", "hook_type", "scenes", "caption_ar", "caption_en", "ai_tool_instructions", "why_this_converts"],
      "video_prompts[" + idx + "]",
      errors
    );
    if (isPlainObject(item) && !Array.isArray(item.scenes)) {
      errors.push("video_prompts[" + idx + "].scenes must be an array.");
    }
  });

  return errors;
}

function validateArrayCount(field: string, value: unknown, requestedCount: number, allowExtra: boolean, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push(field + " must be an array.");
    return;
  }

  const minCount = requestedCount;
  const maxCount = allowExtra ? requestedCount + 1 : requestedCount;

  if (value.length < minCount || value.length > maxCount) {
    errors.push(field + " count must be between " + minCount + " and " + maxCount + ".");
  }
}

function validateObjectKeys(obj: unknown, requiredKeys: string[], path: string, errors: string[]): void {
  if (!isPlainObject(obj)) {
    errors.push(path + " must be an object.");
    return;
  }

  requiredKeys.forEach((key) => {
    if (!(key in obj)) {
      errors.push(path + "." + key + " is missing.");
    }
  });
}
