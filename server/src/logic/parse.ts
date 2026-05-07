import { createHash } from "node:crypto";
import { normalizeCampaignMode } from "./campaignMode.js";
import { G_LIMITS, type SubmissionSnapshot } from "./constants.js";

export function normalizeCellValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? "").trim()).filter(Boolean).join(", ");
  }
  return String(value ?? "").trim();
}

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
      )
    );
  }

  const text = String(value ?? "").trim();
  if (!text) return [];
  return Array.from(
    new Set(
      text
        .split(/[,،]/g)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function normalizeKey(value: unknown): string {
  return normalizeCellValue(value)
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\w\u0600-\u06FF ]/g, "")
    .trim();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeCount(rawValue: unknown, min: number, max: number, fallback: number): number {
  const numericMatch = String(rawValue ?? "").match(/\d+/);
  const parsed = numericMatch ? parseInt(numericMatch[0], 10) : NaN;
  if (Number.isNaN(parsed)) return fallback;
  return clamp(parsed, min, max);
}

export function extractFirstEmail(value: string): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const matched = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return matched ? matched[0] : "";
}

export function isValidEmail(email: string): boolean {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(String(email ?? "").trim());
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function buildSubmissionSnapshot(source: Record<string, unknown> | null | undefined): SubmissionSnapshot {
  const s = source ?? {};
  const submittedAtCandidate = s.submitted_at ? new Date(String(s.submitted_at)) : new Date();
  const submittedAt = Number.isNaN(submittedAtCandidate.getTime()) ? new Date() : submittedAtCandidate;
  const legacyArrayFields = ["target_audience", "platforms", "best_content_types"].filter(
    (key) => typeof s[key] === "string" && String(s[key] ?? "").trim().length > 0
  );
  if (legacyArrayFields.length > 0) {
    console.info(
      "[legacy_array_payload]",
      JSON.stringify({
        fields: legacyArrayFields,
      })
    );
  }

  return {
    submitted_at: submittedAt,
    email: extractFirstEmail(String(s.email ?? "")),
    client_name: String(s.client_name ?? "").trim(),
    client_phone: String(s.client_phone ?? "").trim(),
    client_email: extractFirstEmail(String(s.client_email ?? "")),
    source_mode: String(s.source_mode ?? "").trim().toLowerCase() === "agency" ? "agency" : "self_serve",
    brand_name: String(s.brand_name ?? "").trim(),
    industry: String(s.industry ?? "").trim(),
    business_links: String(s.business_links ?? "").trim(),
    target_audience: normalizeStringArray(s.target_audience),
    main_goal: String(s.main_goal ?? "").trim(),
    platforms: normalizeStringArray(s.platforms),
    brand_tone: String(s.brand_tone ?? "").trim(),
    brand_colors: String(s.brand_colors ?? "").trim(),
    offer: String(s.offer ?? "").trim(),
    competitors: String(s.competitors ?? "").trim(),
    audience_pain_point: String(s.audience_pain_point ?? "").trim(),
    visual_notes: String(s.visual_notes ?? "").trim(),
    product_details: String(s.product_details ?? "").trim(),
    reference_image: String(s.reference_image ?? "").trim(),
    campaign_duration: String(s.campaign_duration ?? "").trim(),
    budget_level: String(s.budget_level ?? "").trim(),
    best_content_types: normalizeStringArray(s.best_content_types),
    campaign_mode: normalizeCampaignMode(s.campaign_mode),
    num_posts: sanitizeCount(s.num_posts, G_LIMITS.num_posts.min, G_LIMITS.num_posts.max, G_LIMITS.num_posts.fallback),
    num_image_designs: sanitizeCount(
      s.num_image_designs,
      G_LIMITS.num_image_designs.min,
      G_LIMITS.num_image_designs.max,
      G_LIMITS.num_image_designs.fallback
    ),
    num_video_prompts: sanitizeCount(
      s.num_video_prompts,
      G_LIMITS.num_video_prompts.min,
      G_LIMITS.num_video_prompts.max,
      G_LIMITS.num_video_prompts.fallback
    ),
    content_package_idea_count: sanitizeCount(
      s.content_package_idea_count,
      G_LIMITS.content_package_ideas.min,
      G_LIMITS.content_package_ideas.max,
      G_LIMITS.content_package_ideas.fallback
    ),
    diagnostic_role: String(s.diagnostic_role ?? "").trim(),
    diagnostic_account_stage: String(s.diagnostic_account_stage ?? "").trim(),
    diagnostic_followers_band: String(s.diagnostic_followers_band ?? "").trim(),
    diagnostic_primary_blocker: String(s.diagnostic_primary_blocker ?? "").trim(),
    diagnostic_revenue_goal: String(s.diagnostic_revenue_goal ?? "").trim(),
    include_content_package: s.include_content_package === true,
  };
}

export function parseSubmissionSnapshotJson(jsonText: string): SubmissionSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(jsonText ?? "").trim());
  } catch {
    throw new Error("brief_json is invalid JSON.");
  }
  if (!isPlainObject(parsed)) throw new Error("brief_json must be a JSON object.");
  return buildSubmissionSnapshot(parsed);
}

export function snapshotToBriefJson(snapshot: SubmissionSnapshot): string {
  return JSON.stringify({
    ...snapshot,
    submitted_at: snapshot.submitted_at.toISOString(),
  });
}

export function briefFingerprint(snapshot: SubmissionSnapshot): string {
  const normalized = {
    ...snapshot,
    submitted_at: "stable",
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
