import type { CampaignMode } from "./campaignMode.js";
import type { SubmissionSnapshot } from "./constants.js";

function cleanText(v: unknown): string {
  return String(v ?? "").trim();
}

function section(title: string, body: string): string {
  const normalized = cleanText(body);
  if (!normalized) return "";
  return `## ${title}\n${normalized}\n`;
}

export function buildClientContextBlock(snapshot: SubmissionSnapshot): string {
  const lines = [
    `Brand name: ${cleanText(snapshot.brand_name)}`,
    `Industry: ${cleanText(snapshot.industry)}`,
    `Target audience: ${cleanText(snapshot.target_audience)}`,
    `Main goal: ${cleanText(snapshot.main_goal)}`,
    `Platforms: ${cleanText(snapshot.platforms)}`,
    `Brand tone: ${cleanText(snapshot.brand_tone)}`,
    `Brand colors: ${cleanText(snapshot.brand_colors)}`,
    `Offer: ${cleanText(snapshot.offer)}`,
    `Competitors: ${cleanText(snapshot.competitors)}`,
    `Visual notes: ${cleanText(snapshot.visual_notes)}`,
    `Campaign duration/timing: ${cleanText(snapshot.campaign_duration)}`,
    `Budget level: ${cleanText(snapshot.budget_level)}`,
    `Best content types: ${cleanText(snapshot.best_content_types)}`,
    `Requested posts count: ${snapshot.num_posts}`,
    `Requested image designs count: ${snapshot.num_image_designs}`,
    `Requested video prompts count: ${snapshot.num_video_prompts}`,
  ];
  return lines.join("\n");
}

export function buildOutputPolicyBlock(mode: CampaignMode): string {
  return [
    "Return strict JSON matching the response schema exactly.",
    "Use `post_ar` and `post_en` for social post copy (do not return legacy `post`). Both versions must carry the same meaning and persuasion level.",
    "Each social post must be long-form, rich, and detailed (not short snippets) in both languages.",
    "Each image design item must include `caption_ar` and `caption_en` that match that exact visual concept.",
    "Each video prompt item must include `caption_ar` and `caption_en` that match that exact video concept.",
    "For every social post and media caption, you MUST provide two equivalent versions in meaning: local Arabic (`_ar`) and professional English (`_en`).",
    "CRITICAL: DO NOT include Arabic typography, text overlays, or lettering inside image prompts or video scene visuals. Visuals must be text-free.",
    "Spoken scripts and external captions can remain in Arabic.",
    `Campaign mode: ${mode}. Keep style aligned with this mode while preserving factual clarity.`,
  ].join("\n");
}

export function composePrompt(input: {
  campaignPrefix: string;
  creativeDirection: string;
  snapshot: SubmissionSnapshot;
  mode: CampaignMode;
}): string {
  const parts = [
    cleanText(input.campaignPrefix),
    section("Creative Direction", input.creativeDirection),
    section("Client Context (auto-injected)", buildClientContextBlock(input.snapshot)),
    section("Output Rules", buildOutputPolicyBlock(input.mode)),
  ]
    .map((x) => cleanText(x))
    .filter(Boolean);
  return parts.join("\n\n");
}
