import type { BriefForm } from "./types";
import { normalizeCampaignMode } from "./types";

export const WIZARD_DRAFT_KEY = "ai-content-dashboard:wizard-draft:v1";

const BRIEF_KEYS: (keyof BriefForm)[] = [
  "email",
  "brand_name",
  "industry",
  "target_audience",
  "diagnostic_role",
  "diagnostic_account_stage",
  "diagnostic_followers_band",
  "diagnostic_primary_blocker",
  "diagnostic_revenue_goal",
  "main_goal",
  "platforms",
  "brand_tone",
  "brand_colors",
  "offer",
  "competitors",
  "visual_notes",
  "campaign_duration",
  "budget_level",
  "best_content_types",
  "campaign_mode",
  "num_posts",
  "num_image_designs",
  "num_video_prompts",
  "include_content_package",
  "content_package_idea_count",
];

export type WizardLimits = {
  num_posts: { min: number; max: number; fallback: number };
  num_image_designs: { min: number; max: number; fallback: number };
  num_video_prompts: { min: number; max: number; fallback: number };
  content_package_idea_count: { min: number; max: number; fallback: number };
};

export function isWizardDirty(form: BriefForm, step: number, limits: WizardLimits): boolean {
  if (step > 0) return true;
  if (
    form.brand_name.trim() ||
    form.industry.trim() ||
    form.email.trim() ||
    form.target_audience.length > 0 ||
    form.diagnostic_role.trim() ||
    form.diagnostic_account_stage.trim() ||
    form.diagnostic_followers_band.trim() ||
    form.diagnostic_primary_blocker.trim() ||
    form.diagnostic_revenue_goal.trim() ||
    form.main_goal.trim() ||
    form.platforms.length > 0 ||
    form.brand_tone.trim() ||
    form.brand_colors.trim() ||
    form.offer.trim() ||
    form.competitors.trim() ||
    form.visual_notes.trim() ||
    form.campaign_duration.trim() ||
    form.budget_level.trim() ||
    form.best_content_types.length > 0
  ) {
    return true;
  }
  if (
    form.num_posts !== limits.num_posts.fallback ||
    form.num_image_designs !== limits.num_image_designs.fallback ||
    form.num_video_prompts !== limits.num_video_prompts.fallback ||
    form.content_package_idea_count !== limits.content_package_idea_count.fallback
  ) {
    return true;
  }
  if (form.include_content_package) return true;
  return false;
}

export function parseWizardDraft(raw: string, limits: WizardLimits, maxStep: number): { step: number; form: BriefForm } | null {
  try {
    const o = JSON.parse(raw) as { step?: unknown; form?: unknown };
    if (typeof o.step !== "number" || !Number.isInteger(o.step) || o.step < 0 || o.step > maxStep) return null;
    if (!o.form || typeof o.form !== "object") return null;
    const f = o.form as Record<string, unknown>;
    for (const k of BRIEF_KEYS) {
      if (!(k in f)) {
        if (k === "campaign_mode") continue;
        if (k === "include_content_package") continue;
        if (k === "content_package_idea_count") continue;
        return null;
      }
    }
    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
    const num = (v: unknown, min: number, max: number, fb: number) => {
      const n = typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" ? Number(v) : NaN;
      return clamp(Number.isFinite(n) ? n : fb, min, max);
    };
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const strArray = (v: unknown): string[] => {
      if (Array.isArray(v)) {
        return v.map((item) => String(item ?? "").trim()).filter(Boolean);
      }
      if (typeof v === "string") {
        return v
          .split(/[,،]/g)
          .map((item) => item.trim())
          .filter(Boolean);
      }
      return [];
    };
    const form: BriefForm = {
      email: str(f.email),
      brand_name: str(f.brand_name),
      industry: str(f.industry),
      target_audience: strArray(f.target_audience),
      diagnostic_role: str(f.diagnostic_role),
      diagnostic_account_stage: str(f.diagnostic_account_stage),
      diagnostic_followers_band: str(f.diagnostic_followers_band),
      diagnostic_primary_blocker: str(f.diagnostic_primary_blocker),
      diagnostic_revenue_goal: str(f.diagnostic_revenue_goal),
      main_goal: str(f.main_goal),
      platforms: strArray(f.platforms),
      brand_tone: str(f.brand_tone),
      brand_colors: str(f.brand_colors),
      offer: str(f.offer),
      competitors: str(f.competitors),
      visual_notes: str(f.visual_notes),
      campaign_duration: str(f.campaign_duration),
      budget_level: str(f.budget_level),
      best_content_types: strArray(f.best_content_types),
      num_posts: num(f.num_posts, limits.num_posts.min, limits.num_posts.max, limits.num_posts.fallback),
      num_image_designs: num(
        f.num_image_designs,
        limits.num_image_designs.min,
        limits.num_image_designs.max,
        limits.num_image_designs.fallback
      ),
      num_video_prompts: num(
        f.num_video_prompts,
        limits.num_video_prompts.min,
        limits.num_video_prompts.max,
        limits.num_video_prompts.fallback
      ),
      content_package_idea_count: num(
        f.content_package_idea_count,
        limits.content_package_idea_count.min,
        limits.content_package_idea_count.max,
        limits.content_package_idea_count.fallback
      ),
      include_content_package: typeof f.include_content_package === "boolean" ? f.include_content_package : false,
      campaign_mode: normalizeCampaignMode("campaign_mode" in f ? f.campaign_mode : "social"),
    };
    return { step: o.step, form };
  } catch {
    return null;
  }
}

export function readWizardDraft(
  limits: WizardLimits,
  maxStep: number,
  fallbackForm: BriefForm
): { step: number; form: BriefForm; hadSavedDraft: boolean } {
  if (typeof localStorage === "undefined") {
    return { step: 0, form: fallbackForm, hadSavedDraft: false };
  }
  const raw = localStorage.getItem(WIZARD_DRAFT_KEY);
  if (!raw) return { step: 0, form: fallbackForm, hadSavedDraft: false };
  const parsed = parseWizardDraft(raw, limits, maxStep);
  if (!parsed) return { step: 0, form: fallbackForm, hadSavedDraft: false };
  return { ...parsed, hadSavedDraft: true };
}
