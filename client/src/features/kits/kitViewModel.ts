import type { KitPostItem, KitSummary } from "../../types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
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

export function buildKitViewModel(kit: KitSummary) {
  const data = (kit.result_json ?? null) as Record<string, unknown> | null;
  const posts = Array.isArray(data?.posts) ? (data!.posts as KitPostItem[]) : [];
  const marketingStrategy = isRecord(data?.marketing_strategy) ? (data!.marketing_strategy as Record<string, unknown>) : null;
  const salesSystem = isRecord(data?.sales_system) ? (data!.sales_system as Record<string, unknown>) : null;
  const offerOptimization = isRecord(data?.offer_optimization) ? (data!.offer_optimization as Record<string, unknown>) : null;
  const videoSection = pickFirstSection(data, ["video_prompts", "video_assets", "ai_video_assets", "assets"]);
  const imageSection = pickFirstSection(data, ["image_prompts", "image_designs", "creative_prompts", "design_prompts", "visual_prompts"]);
  const hasStrategyBlock = Boolean(marketingStrategy || salesSystem || offerOptimization);
  const painPoints = asStringArray(salesSystem?.pain_points);
  const hasStructuredPreview = posts.length > 0 || !!imageSection || !!videoSection;

  return {
    data,
    posts,
    videoSection,
    imageSection,
    hasStrategyBlock,
    marketingStrategy,
    salesSystem,
    offerOptimization,
    painPoints,
    hasStructuredPreview,
  };
}
