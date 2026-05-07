import { z } from "zod";
import type { BriefForm } from "./types";

/**
 * Mirrors prompt_builder_gemini.js:
 * - gExtractSubmissionData keys
 * - G_LIMITS numeric ranges
 */
export const BRIEF_LIMITS = {
  num_posts: { min: 0, max: 25, fallback: 0 },
  num_image_designs: { min: 0, max: 10, fallback: 0 },
  num_video_prompts: { min: 0, max: 10, fallback: 0 },
  content_package_idea_count: { min: 0, max: 25, fallback: 0 },
} as const;

const L = BRIEF_LIMITS;

export const briefSchema = z.object({
  client_name: z.string().trim().default(""),
  client_phone: z.string().trim().default(""),
  client_email: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(v), {
      message: "Please enter a valid email address",
    }),
  source_mode: z.enum(["self_serve", "agency"]).default("self_serve"),
  brand_name: z.string().trim().min(1, "Brand name is required"),
  industry: z.string(),
  business_links: z.string().default(""),
  target_audience: z.array(z.string().trim().min(1)).default([]),
  main_goal: z.string(),
  platforms: z.array(z.string().trim().min(1)).default([]),
  brand_tone: z.string(),
  brand_colors: z.string(),
  offer: z.string(),
  competitors: z.string(),
  audience_pain_point: z.string().default(""),
  visual_notes: z.string(),
  product_details: z
    .string()
    .trim()
    .max(8000, { message: "Product details must be at most 8000 characters." })
    .default(""),
  reference_image: z
    .string()
    .max(3_000_000, { message: "Reference image exceeds the maximum allowed size." })
    .optional(),
  campaign_duration: z.string(),
  budget_level: z.string(),
  best_content_types: z.array(z.string().trim().min(1)).default([]),
  num_posts: z.coerce
    .number({ invalid_type_error: "Please enter a valid number" })
    .int()
    .min(L.num_posts.min, `Must be between ${L.num_posts.min} and ${L.num_posts.max}`)
    .max(L.num_posts.max, `Must be between ${L.num_posts.min} and ${L.num_posts.max}`),
  num_image_designs: z.coerce
    .number({ invalid_type_error: "Please enter a valid number" })
    .int()
    .min(L.num_image_designs.min, `Must be between ${L.num_image_designs.min} and ${L.num_image_designs.max}`)
    .max(L.num_image_designs.max, `Must be between ${L.num_image_designs.min} and ${L.num_image_designs.max}`),
  num_video_prompts: z.coerce
    .number({ invalid_type_error: "Please enter a valid number" })
    .int()
    .min(L.num_video_prompts.min, `Must be between ${L.num_video_prompts.min} and ${L.num_video_prompts.max}`)
    .max(L.num_video_prompts.max, `Must be between ${L.num_video_prompts.min} and ${L.num_video_prompts.max}`),
  include_content_package: z.boolean().default(false),
  content_package_idea_count: z.coerce
    .number({ invalid_type_error: "Please enter a valid number" })
    .int()
    .min(
      L.content_package_idea_count.min,
      `Must be between ${L.content_package_idea_count.min} and ${L.content_package_idea_count.max}`
    )
    .max(
      L.content_package_idea_count.max,
      `Must be between ${L.content_package_idea_count.min} and ${L.content_package_idea_count.max}`
    ),
  diagnostic_role: z.string().optional().default(""),
  diagnostic_account_stage: z.string().optional().default(""),
  diagnostic_followers_band: z.string().optional().default(""),
  diagnostic_primary_blocker: z.string().optional().default(""),
  diagnostic_revenue_goal: z.string().optional().default(""),
  campaign_mode: z.enum(["social", "offer", "deep"]).default("social"),
});

export type BriefSchema = z.infer<typeof briefSchema>;

const requiredStr = (message: string) => z.string().trim().min(1, { message });
const requiredClientContactShape = {
  client_name: requiredStr("Client name is required"),
  client_phone: requiredStr("Client phone number is required"),
  client_email: z
    .string()
    .trim()
    .min(1, "Client email is required")
    .refine((v) => /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(v), {
      message: "Please enter a valid email address",
    }),
} as const;

/** Social path: minimum viable brief for reach/engagement prompts. */
export const socialBriefSchema = briefSchema.extend({
  industry: requiredStr("Please select an industry"),
  target_audience: z.array(z.string().trim().min(1)).min(1, "Please select at least one target audience"),
  main_goal: requiredStr("Please select a main campaign goal"),
  platforms: z.array(z.string().trim().min(1)).min(1, "Please select at least one active platform"),
  brand_tone: requiredStr("Please select a brand tone"),
});

/** Offer path: conversion-focused minimum. */
export const offerBriefSchema = briefSchema.extend({
  industry: requiredStr("Please select an industry"),
  offer: requiredStr("Please describe your core offer"),
  target_audience: z.array(z.string().trim().min(1)).min(1, "Please select at least one target audience"),
  main_goal: requiredStr("Please select a main goal"),
});

/** Deep path: authority content minimum. */
export const deepBriefSchema = briefSchema.extend({
  industry: requiredStr("Please select an industry"),
  target_audience: z.array(z.string().trim().min(1)).min(1, "Please select at least one target audience"),
  main_goal: requiredStr("Please select a main goal"),
  visual_notes: requiredStr("Please add a creative direction"),
  campaign_duration: requiredStr("Please specify the campaign duration"),
  best_content_types: z.array(z.string().trim().min(1)).min(1, "Please select at least one content format"),
});

export const socialBriefSchemaWithDiagnosis = socialBriefSchema.extend({
  diagnostic_role: requiredStr("Please select your role"),
  diagnostic_account_stage: requiredStr("Please select your business stage"),
  diagnostic_followers_band: requiredStr("Please select your follower range"),
  diagnostic_primary_blocker: requiredStr("Please select your primary challenge"),
  diagnostic_revenue_goal: requiredStr("Please select a target revenue range"),
});

export const offerBriefSchemaWithDiagnosis = offerBriefSchema.extend({
  diagnostic_role: requiredStr("Please select your role"),
  diagnostic_account_stage: requiredStr("Please select your business stage"),
  diagnostic_followers_band: requiredStr("Please select your follower range"),
  diagnostic_primary_blocker: requiredStr("Please select your primary challenge"),
  diagnostic_revenue_goal: requiredStr("Please select a target revenue range"),
});

export const deepBriefSchemaWithDiagnosis = deepBriefSchema.extend({
  diagnostic_role: requiredStr("Please select your role"),
  diagnostic_account_stage: requiredStr("Please select your business stage"),
  diagnostic_followers_band: requiredStr("Please select your follower range"),
  diagnostic_primary_blocker: requiredStr("Please select your primary challenge"),
  diagnostic_revenue_goal: requiredStr("Please select a target revenue range"),
});

export const socialBriefSchemaAgency = socialBriefSchema.extend(requiredClientContactShape);
export const offerBriefSchemaAgency = offerBriefSchema.extend(requiredClientContactShape);
export const deepBriefSchemaAgency = deepBriefSchema.extend(requiredClientContactShape);
export const socialBriefSchemaWithDiagnosisAgency = socialBriefSchemaWithDiagnosis.extend(requiredClientContactShape);
export const offerBriefSchemaWithDiagnosisAgency = offerBriefSchemaWithDiagnosis.extend(requiredClientContactShape);
export const deepBriefSchemaWithDiagnosisAgency = deepBriefSchemaWithDiagnosis.extend(requiredClientContactShape);

/** Fields validated when leaving each step (0–4). Step 5 uses full schema on submit. */
export const STEP_FIELD_KEYS: readonly (readonly (keyof BriefForm)[])[] = [
  [
    "diagnostic_role",
    "diagnostic_account_stage",
    "diagnostic_followers_band",
    "diagnostic_primary_blocker",
    "diagnostic_revenue_goal",
  ],
  ["brand_name", "industry", "business_links"],
  ["target_audience", "main_goal"],
  ["platforms", "brand_tone", "brand_colors"],
  ["offer", "competitors"],
  ["visual_notes", "product_details", "reference_image", "campaign_duration", "budget_level", "best_content_types"],
  ["include_content_package", "content_package_idea_count", "num_posts", "num_image_designs", "num_video_prompts"],
] as const;

export function initialBriefForm(): BriefForm {
  return {
    client_name: "",
    client_phone: "",
    client_email: "",
    source_mode: "self_serve",
    brand_name: "",
    industry: "",
    business_links: "",
    target_audience: [],
    main_goal: "",
    platforms: [],
    brand_tone: "",
    brand_colors: "",
    offer: "",
    competitors: "",
    audience_pain_point: "",
    visual_notes: "",
    product_details: "",
    reference_image: "",
    campaign_duration: "",
    budget_level: "",
    best_content_types: [],
    num_posts: L.num_posts.fallback,
    num_image_designs: L.num_image_designs.fallback,
    num_video_prompts: L.num_video_prompts.fallback,
    include_content_package: false,
    content_package_idea_count: L.content_package_idea_count.fallback,
    diagnostic_role: "",
    diagnostic_account_stage: "",
    diagnostic_followers_band: "",
    diagnostic_primary_blocker: "",
    diagnostic_revenue_goal: "",
    campaign_mode: "social",
  };
}
