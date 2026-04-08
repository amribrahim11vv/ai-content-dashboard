import { z } from "zod";
import type { BriefForm } from "./types";

/**
 * Mirrors prompt_builder_gemini.js:
 * - gExtractSubmissionData keys
 * - G_LIMITS numeric ranges
 */
export const BRIEF_LIMITS = {
  num_posts: { min: 1, max: 25, fallback: 5 },
  num_image_designs: { min: 1, max: 10, fallback: 5 },
  num_video_prompts: { min: 1, max: 10, fallback: 3 },
} as const;

const L = BRIEF_LIMITS;

export const briefSchema = z.object({
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(v), {
      message: "Invalid email format",
    }),
  brand_name: z.string().trim().min(1, "Brand name is required"),
  industry: z.string(),
  target_audience: z.string(),
  main_goal: z.string(),
  platforms: z.string(),
  brand_tone: z.string(),
  brand_colors: z.string(),
  offer: z.string(),
  competitors: z.string(),
  visual_notes: z.string(),
  campaign_duration: z.string(),
  budget_level: z.string(),
  best_content_types: z.string(),
  num_posts: z.coerce
    .number({ invalid_type_error: "Enter a valid number" })
    .int()
    .min(L.num_posts.min, `Must be between ${L.num_posts.min} and ${L.num_posts.max}`)
    .max(L.num_posts.max, `Must be between ${L.num_posts.min} and ${L.num_posts.max}`),
  num_image_designs: z.coerce
    .number({ invalid_type_error: "Enter a valid number" })
    .int()
    .min(L.num_image_designs.min, `Must be between ${L.num_image_designs.min} and ${L.num_image_designs.max}`)
    .max(L.num_image_designs.max, `Must be between ${L.num_image_designs.min} and ${L.num_image_designs.max}`),
  num_video_prompts: z.coerce
    .number({ invalid_type_error: "Enter a valid number" })
    .int()
    .min(L.num_video_prompts.min, `Must be between ${L.num_video_prompts.min} and ${L.num_video_prompts.max}`)
    .max(L.num_video_prompts.max, `Must be between ${L.num_video_prompts.min} and ${L.num_video_prompts.max}`),
  campaign_mode: z.enum(["social", "offer", "deep"]).default("social"),
});

export type BriefSchema = z.infer<typeof briefSchema>;

const requiredStr = (message: string) => z.string().trim().min(1, { message });

/** Social path: minimum viable brief for reach/engagement prompts. */
export const socialBriefSchema = briefSchema.extend({
  industry: requiredStr("Select an industry"),
  target_audience: requiredStr("Select at least one audience"),
  main_goal: requiredStr("Select a main campaign goal"),
  platforms: requiredStr("Select at least one active platform"),
  brand_tone: requiredStr("Select brand tone"),
});

/** Offer path: conversion-focused minimum. */
export const offerBriefSchema = briefSchema.extend({
  industry: requiredStr("Select an industry"),
  offer: requiredStr("Describe your offer"),
  target_audience: requiredStr("Select at least one audience"),
  main_goal: requiredStr("Select a main goal"),
});

/** Deep path: authority content minimum. */
export const deepBriefSchema = briefSchema.extend({
  industry: requiredStr("Select an industry"),
  target_audience: requiredStr("Select at least one audience"),
  main_goal: requiredStr("Select a main goal"),
  visual_notes: requiredStr("Add creative direction"),
  campaign_duration: requiredStr("Add timing or duration"),
  best_content_types: requiredStr("List content types you want"),
});

/** Fields validated when leaving each step (0–4). Step 5 uses full schema on submit. */
export const STEP_FIELD_KEYS: readonly (readonly (keyof BriefForm)[])[] = [
  ["brand_name", "industry"],
  ["target_audience", "main_goal"],
  ["platforms", "brand_tone", "brand_colors"],
  ["offer", "competitors"],
  ["visual_notes", "campaign_duration", "budget_level", "best_content_types"],
  [],
] as const;

export function initialBriefForm(): BriefForm {
  return {
    email: "",
    brand_name: "",
    industry: "",
    target_audience: "",
    main_goal: "",
    platforms: "",
    brand_tone: "",
    brand_colors: "",
    offer: "",
    competitors: "",
    visual_notes: "",
    campaign_duration: "",
    budget_level: "",
    best_content_types: "",
    num_posts: L.num_posts.fallback,
    num_image_designs: L.num_image_designs.fallback,
    num_video_prompts: L.num_video_prompts.fallback,
    campaign_mode: "social",
  };
}
