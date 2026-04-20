import type { KitPostItem, KitSummary } from "../../types";

const CONTENT_IDEAS_PACKAGE_KEY = "content_ideas_package";

/** Hooks per idea is fixed server-side (PACKAGE_HOOKS_PER_IDEA = 2); used for display only. */
export const KIT_CONTENT_PACKAGE_HOOKS_PER_IDEA = 2;

export type KitContentIdeaItem = {
  id?: number;
  title?: string;
  description?: string;
};

export type KitContentHookItem = {
  idea_id?: number;
  variant_index?: number;
  hook_text?: string;
};

export type KitContentTemplateItem = {
  idea_id?: number;
  template_format?: string;
};

export type KitContentIdeasPackageView = {
  ideas: KitContentIdeaItem[];
  hooks: KitContentHookItem[];
  templates: KitContentTemplateItem[];
};

export type KitStrategicRationale = {
  trigger_used?: string;
  contrast_note?: string;
  engagement_vector?: string;
};

export type KitStrategyMetadata = {
  strategic_rationale: KitStrategicRationale | null;
  algorithmic_advantage: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asIdeaItems(v: unknown): KitContentIdeaItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (isRecord(x) ? (x as KitContentIdeaItem) : {}));
}

function asHookItems(v: unknown): KitContentHookItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (isRecord(x) ? (x as KitContentHookItem) : {}));
}

function asTemplateItems(v: unknown): KitContentTemplateItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (isRecord(x) ? (x as KitContentTemplateItem) : {}));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function asStrategyMetadata(v: unknown): KitStrategyMetadata {
  if (!isRecord(v)) {
    return {
      strategic_rationale: null,
      algorithmic_advantage: "",
    };
  }
  const rationale = isRecord(v.strategic_rationale)
    ? {
        trigger_used:
          typeof v.strategic_rationale.trigger_used === "string" ? v.strategic_rationale.trigger_used : undefined,
        contrast_note:
          typeof v.strategic_rationale.contrast_note === "string" ? v.strategic_rationale.contrast_note : undefined,
        engagement_vector:
          typeof v.strategic_rationale.engagement_vector === "string"
            ? v.strategic_rationale.engagement_vector
            : undefined,
      }
    : null;
  return {
    strategic_rationale: rationale,
    algorithmic_advantage: typeof v.algorithmic_advantage === "string" ? v.algorithmic_advantage.trim() : "",
  };
}

function pickFirstSection(data: Record<string, unknown> | null, keys: string[]) {
  if (!data) return null as { title: string; items: unknown[] } | null;
  for (const key of keys) {
    const v = data[key];
    if (Array.isArray(v) && v.length > 0) {
      return { title: key.replace(/_/g, " "), items: v };
    }
  }
  return null;
}

function parseContentIdeasPackage(raw: unknown): KitContentIdeasPackageView | null {
  if (!isRecord(raw)) return null;
  const ideas = asIdeaItems(raw.ideas);
  const hooks = asHookItems(raw.hooks);
  const templates = asTemplateItems(raw.templates);
  if (!ideas.length && !hooks.length && !templates.length) return null;
  return { ideas, hooks, templates };
}

export function buildKitViewModel(kit: KitSummary) {
  const data = (kit.result_json ?? null) as Record<string, unknown> | null;
  const posts = Array.isArray(data?.posts) ? (data!.posts as KitPostItem[]) : [];
  const postStrategy = posts.map((item) => asStrategyMetadata(item));
  const marketingStrategy = isRecord(data?.marketing_strategy) ? (data!.marketing_strategy as Record<string, unknown>) : null;
  const salesSystem = isRecord(data?.sales_system) ? (data!.sales_system as Record<string, unknown>) : null;
  const offerOptimization = isRecord(data?.offer_optimization) ? (data!.offer_optimization as Record<string, unknown>) : null;
  const videoSection = pickFirstSection(data, ["video_prompts", "video_assets", "ai_video_assets", "assets"]);
  const imageSection = pickFirstSection(data, ["image_prompts", "image_designs", "creative_prompts", "design_prompts", "visual_prompts"]);
  const imageStrategy = (imageSection?.items ?? []).map((item) => asStrategyMetadata(item));
  const videoStrategy = (videoSection?.items ?? []).map((item) => asStrategyMetadata(item));
  const contentIdeasPackage = data ? parseContentIdeasPackage(data[CONTENT_IDEAS_PACKAGE_KEY]) : null;
  const hasStrategyBlock = Boolean(marketingStrategy || salesSystem || offerOptimization);
  const painPoints = asStringArray(salesSystem?.pain_points);
  const hasCriticalPosts = posts.length > 0;
  const hasCriticalImages = Boolean(imageSection && imageSection.items.length > 0);
  const hasCriticalVideos = Boolean(videoSection && videoSection.items.length > 0);
  const missingCriticalSections: string[] = [];
  if (!hasCriticalPosts) missingCriticalSections.push("posts");
  if (!hasCriticalImages) missingCriticalSections.push("image_designs");
  if (!hasCriticalVideos) missingCriticalSections.push("video_prompts");
  const hasStructuredPreview =
    posts.length > 0 || !!imageSection || !!videoSection || Boolean(contentIdeasPackage?.ideas.length);

  return {
    data,
    posts,
    postStrategy,
    videoSection,
    videoStrategy,
    imageSection,
    imageStrategy,
    hasStrategyBlock,
    marketingStrategy,
    salesSystem,
    offerOptimization,
    painPoints,
    hasStructuredPreview,
    contentIdeasPackage,
    hasCriticalPosts,
    hasCriticalImages,
    hasCriticalVideos,
    missingCriticalSections,
    localizationCheckPassed:
      typeof data?.localization_check_passed === "boolean" ? data.localization_check_passed : null,
  };
}
