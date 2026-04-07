import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { industries, industryPrompts } from "../db/schema.js";
import { campaignModeInstructionBlock } from "./campaignMode.js";
import { composePrompt } from "./promptComposer.js";
import type { SubmissionSnapshot } from "./constants.js";
import { isStrictPromptTemplates } from "./promptStrictEnv.js";
import { validatePromptTemplateContract } from "./promptTemplateValidation.js";

export type ResolvedPrompt = {
  industrySlugUsed: string;
  promptVersionId: string;
  promptVersionUsed: number;
  isFallback: boolean;
  renderedPrompt: string;
  rawTemplate: string;
};

export function normalizeIndustrySlug(value: string): string {
  const base = String(value ?? "").trim().toLowerCase();
  if (!base) return "general";
  return base
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/-{2,}/g, "-") || "general";
}

function snapshotMap(s: SubmissionSnapshot): Record<string, string> {
  return {
    brand_name: s.brand_name,
    industry: s.industry,
    /** Alias for agribusiness templates; same value as `industry`. */
    farming_niche: s.industry,
    /** Alias for seasonality; mapped from campaign duration / timing field. */
    season_or_timing: s.campaign_duration,
    target_audience: s.target_audience,
    main_goal: s.main_goal,
    platforms: s.platforms,
    brand_tone: s.brand_tone,
    brand_colors: s.brand_colors,
    offer: s.offer,
    competitors: s.competitors,
    visual_notes: s.visual_notes,
    campaign_duration: s.campaign_duration,
    budget_level: s.budget_level,
    best_content_types: s.best_content_types,
    num_posts: String(s.num_posts),
    num_image_designs: String(s.num_image_designs),
    num_video_prompts: String(s.num_video_prompts),
    email: s.email,
  };
}

export function renderPromptTemplate(template: string, snapshot: SubmissionSnapshot): string {
  const values = snapshotMap(snapshot);
  return String(template ?? "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, rawKey) => {
    const key = String(rawKey ?? "").trim();
    return values[key] ?? "";
  });
}

export async function resolvePrompt(industryInput: string, snapshot: SubmissionSnapshot): Promise<ResolvedPrompt> {
  const targetSlug = normalizeIndustrySlug(industryInput);

  const industry = await db.select().from(industries).where(eq(industries.slug, targetSlug)).get();
  let selected =
    industry &&
    (await db
      .select()
      .from(industryPrompts)
      .where(and(eq(industryPrompts.industryId, industry.id), eq(industryPrompts.status, "active")))
      .get());

  let isFallback = false;
  let usedSlug = targetSlug;
  if (!selected) {
    isFallback = true;
    usedSlug = "fallback";
    selected = await db
      .select()
      .from(industryPrompts)
      .where(and(isNull(industryPrompts.industryId), eq(industryPrompts.status, "active")))
      .get();
  }

  if (!selected) {
    throw new Error("No active prompt found. Please configure a global fallback prompt.");
  }

  const contract = validatePromptTemplateContract(selected.promptTemplate);
  if (!contract.ok) {
    if (isStrictPromptTemplates()) {
      throw new Error(`Active prompt template is invalid: missing variables [${contract.missingVariables.join(", ")}]`);
    }
    console.warn(
      `[resolvePrompt] Template missing placeholders (non-strict): [${contract.missingVariables.join(", ")}]. Empty strings will be used.`
    );
  }

  const industryPrompt = renderPromptTemplate(selected.promptTemplate, snapshot);
  const prefix = campaignModeInstructionBlock(snapshot.campaign_mode);
  const composed = composePrompt({
    campaignPrefix: prefix,
    creativeDirection: industryPrompt,
    snapshot,
    mode: snapshot.campaign_mode,
  });

  return {
    industrySlugUsed: usedSlug,
    promptVersionId: selected.id,
    promptVersionUsed: selected.version,
    isFallback,
    renderedPrompt: composed,
    rawTemplate: selected.promptTemplate,
  };
}
