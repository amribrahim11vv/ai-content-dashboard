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
    `Reference image attached: ${cleanText(snapshot.reference_image) ? "yes" : "no"}`,
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

export function buildMetaPromptBlock(snapshot: SubmissionSnapshot): string {
  const industry = cleanText(snapshot.industry) || "General";
  const audience = cleanText(snapshot.target_audience) || "General audience";
  const goal = cleanText(snapshot.main_goal) || "Drive measurable marketing outcomes";
  const offer = cleanText(snapshot.offer) || "Not specified";
  const platforms = cleanText(snapshot.platforms) || "Not specified";
  const hasReferenceImage = Boolean(cleanText(snapshot.reference_image));
  return [
    "You are a Creative Director and strategic marketer.",
    "Use a meta-prompting workflow internally before producing output.",
    "Internal-only sequence (never expose chain-of-thought):",
    "1) Deduce psychological triggers for this audience and buying context.",
    "2) Deduce an effective tone/style that fits trust level and goal urgency.",
    "3) Deduce visual identity direction that can convert on the requested platforms.",
    "",
    `Client industry: ${industry}`,
    `Client audience: ${audience}`,
    `Primary goal: ${goal}`,
    `Offer context: ${offer}`,
    `Target platforms: ${platforms}`,
    `Reference image available: ${hasReferenceImage ? "yes" : "no"}`,
    "",
    hasReferenceImage
      ? "You are given a visual reference image. Infer color palette, style language, and art direction, then apply it consistently in all generated outputs."
      : "No visual reference image was provided. Infer the visual identity from client context only.",
    "",
    "Apply the deduced strategy directly in the generated assets.",
    "Do not output reasoning, hidden analysis, or planning notes.",
  ].join("\n");
}

export function composePrompt(input: {
  campaignPrefix: string;
  creativeDirection: string;
  snapshot: SubmissionSnapshot;
  mode: CampaignMode;
  useMetaPrompt?: boolean;
}): string {
  const parts = [
    cleanText(input.campaignPrefix),
    input.useMetaPrompt ? section("Meta Strategy Core", buildMetaPromptBlock(input.snapshot)) : "",
    section("Creative Direction", input.creativeDirection),
    section("Client Context (auto-injected)", buildClientContextBlock(input.snapshot)),
    section("Output Rules", buildOutputPolicyBlock(input.mode)),
  ]
    .map((x) => cleanText(x))
    .filter(Boolean);
  return parts.join("\n\n");
}
