import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { industries, industryPrompts } from "../db/schema.js";
import { campaignModeInstructionBlock } from "./campaignMode.js";
import { composePrompt } from "./promptComposer.js";
import type { SubmissionSnapshot } from "./constants.js";
import { isUseMetaPrompt } from "./promptModeEnv.js";
import { isStrictPromptTemplates } from "./promptStrictEnv.js";
import { validatePromptTemplateContract } from "./promptTemplateValidation.js";

export type ResolvedPrompt = {
  industrySlugUsed: string;
  promptVersionId: string;
  promptVersionUsed: number;
  isFallback: boolean;
  renderedPrompt: string;
  rawTemplate: string;
  promptMode: "meta" | "catalog";
  industrySource: "brief" | "fallback";
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
  const useMetaPrompt = isUseMetaPrompt();
  const hasCoreContext =
    Boolean(String(snapshot.industry ?? "").trim()) &&
    Boolean(String(snapshot.target_audience ?? "").trim()) &&
    (Boolean(String(snapshot.main_goal ?? "").trim()) || Boolean(String(snapshot.offer ?? "").trim()));

  if (useMetaPrompt && hasCoreContext) {
    const prefix = campaignModeInstructionBlock(snapshot.campaign_mode);
    const composed = composePrompt({
      campaignPrefix: prefix,
      creativeDirection:
        "Use the client context to produce high-conversion assets with platform-native execution and strict bilingual parity.",
      snapshot,
      mode: snapshot.campaign_mode,
      useMetaPrompt: true,
    });
    return {
      industrySlugUsed: targetSlug,
      promptVersionId: "meta-prompt:v1",
      promptVersionUsed: 1,
      isFallback: false,
      renderedPrompt: composed,
      rawTemplate: "meta-prompt:v1",
      promptMode: "meta",
      industrySource: "brief",
    };
  }

  const industryRows = await db.select().from(industries).where(eq(industries.slug, targetSlug)).limit(1);
  const industry = industryRows[0];
  let selected: (typeof industryPrompts.$inferSelect) | undefined;
  if (industry) {
    const promptRows = await db
      .select()
      .from(industryPrompts)
      .where(and(eq(industryPrompts.industryId, industry.id), eq(industryPrompts.status, "active")))
      .limit(1);
    selected = promptRows[0];
  }

  let isFallback = false;
  let usedSlug = targetSlug;
  if (!selected) {
    isFallback = true;
    usedSlug = "fallback";
    const fbRows = await db
      .select()
      .from(industryPrompts)
      .where(and(isNull(industryPrompts.industryId), eq(industryPrompts.status, "active")))
      .limit(1);
    selected = fbRows[0];
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
    useMetaPrompt: false,
  });

  return {
    industrySlugUsed: usedSlug,
    promptVersionId: selected.id,
    promptVersionUsed: selected.version,
    isFallback,
    renderedPrompt: composed,
    rawTemplate: selected.promptTemplate,
    promptMode: "catalog",
    industrySource: isFallback ? "fallback" : "brief",
  };
}
