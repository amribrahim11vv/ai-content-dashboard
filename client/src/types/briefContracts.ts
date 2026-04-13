import type { CampaignMode } from "../types";

/**
 * Narrower contracts by wizard path.
 * Keep `BriefForm` as the transport shape, but rely on these
 * scoped contracts in UI/business logic to reduce over-coupling.
 */
export type BaseBrief = {
  email: string;
  brand_name: string;
  industry: string;
  target_audience: string;
  main_goal: string;
  platforms: string;
  brand_tone: string;
  campaign_mode: CampaignMode;
};

export type OfferBrief = BaseBrief & {
  offer: string;
  competitors: string;
};

export type SocialBrief = BaseBrief & {
  visual_notes: string;
  best_content_types: string;
};

export type DeepBrief = BaseBrief & {
  campaign_duration: string;
  budget_level: string;
  best_content_types: string;
};

export type BriefByMode = {
  social: SocialBrief;
  offer: OfferBrief;
  deep: DeepBrief;
};
