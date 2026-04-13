import type { CampaignMode } from "./campaignMode.js";

export const G_LIMITS = {
  num_posts: { min: 1, max: 25, fallback: 5 },
  num_image_designs: { min: 1, max: 10, fallback: 5 },
  num_video_prompts: { min: 1, max: 10, fallback: 3 },
  /** Ideas count for chained `content_ideas_package` (client-chosen; clamped server-side). */
  content_package_ideas: { min: 1, max: 25, fallback: 10 },
} as const;

export const G_DEFAULT_MODEL = "gemini-3-flash-preview";
export const G_DEFAULT_TIMEOUT_MS = 55_000;
export const G_DEFAULT_MAX_RETRIES = 1;

export type SubmissionSnapshot = {
  submitted_at: Date;
  email: string;
  brand_name: string;
  industry: string;
  target_audience: string;
  main_goal: string;
  platforms: string;
  brand_tone: string;
  brand_colors: string;
  offer: string;
  competitors: string;
  visual_notes: string;
  reference_image: string;
  campaign_duration: string;
  budget_level: string;
  best_content_types: string;
  /** Wizard path: shapes tone and priorities via prompt prefix (social / offer / deep). */
  campaign_mode: CampaignMode;
  num_posts: number;
  num_image_designs: number;
  num_video_prompts: number;
  diagnostic_role: string;
  diagnostic_account_stage: string;
  diagnostic_followers_band: string;
  diagnostic_primary_blocker: string;
  diagnostic_revenue_goal: string;
  /** When true and CONTENT_PACKAGE_CHAIN_ENABLED is set, kit generation runs the chained ideas/hooks/templates pipeline and merges `content_ideas_package` into result_json. */
  include_content_package: boolean;
  /** Count of strategic ideas (and matching templates); hooks total = this × PACKAGE_HOOKS_PER_IDEA on server. */
  content_package_idea_count: number;
};
