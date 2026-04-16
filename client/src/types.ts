export type KitSummary = {
  id: string;
  brief_json: string;
  result_json: unknown;
  delivery_status: string;
  status_badge: string;
  badge_palette: { bg: string; fg: string; border: string };
  model_used: string;
  last_error: string;
  correlation_id: string;
  prompt_version_id?: string | null;
  is_fallback?: boolean;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type CampaignMode = "social" | "offer" | "deep";

export function normalizeCampaignMode(v: unknown): CampaignMode {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (s === "social" || s === "offer" || s === "deep") return s;
  return "social";
}

export type BriefForm = {
  email: string;
  brand_name: string;
  industry: string;
  target_audience: string[];
  main_goal: string;
  platforms: string[];
  brand_tone: string;
  brand_colors: string;
  offer: string;
  competitors: string;
  visual_notes: string;
  reference_image?: string;
  campaign_duration: string;
  budget_level: string;
  best_content_types: string[];
  /** Matches wizard path; sent to API for prompt instruction injection. */
  campaign_mode: CampaignMode;
  num_posts: number;
  num_image_designs: number;
  num_video_prompts: number;
  /** When true, server may run extra Gemini steps for content ideas package (requires CONTENT_PACKAGE_CHAIN_ENABLED). */
  include_content_package: boolean;
  /** Strategic ideas count for content package (1–25); hooks = this × 2 on server. */
  content_package_idea_count: number;
  diagnostic_role: string;
  diagnostic_account_stage: string;
  diagnostic_followers_band: string;
  diagnostic_primary_blocker: string;
  diagnostic_revenue_goal: string;
};

export type KitPostItem = {
  platform?: string;
  format?: string;
  goal?: string;
  post_ar?: string;
  post_en?: string;
  post?: string;
  /** Backward compatibility for historical kits. */
  caption?: string;
  hashtags?: string[];
  cta?: string;
};

export type KitImageDesignItem = {
  platform_format?: string;
  design_type?: string;
  goal?: string;
  visual_scene?: string;
  headline_text_overlay?: string;
  supporting_copy?: string;
  full_ai_image_prompt?: string;
  caption_ar?: string;
  caption_en?: string;
  caption?: string;
  text_policy?: string;
  conversion_trigger?: string;
};

export type KitVideoPromptItem = {
  platform?: string;
  duration?: string;
  style?: string;
  hook_type?: string;
  scenes?: Array<Record<string, unknown>>;
  caption_ar?: string;
  caption_en?: string;
  caption?: string;
  ai_tool_instructions?: string;
  why_this_converts?: string;
};

export type { BaseBrief, BriefByMode, DeepBrief, OfferBrief, SocialBrief } from "./types/briefContracts";
