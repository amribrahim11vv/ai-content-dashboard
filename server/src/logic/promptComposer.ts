import type { CampaignMode } from "./campaignMode.js";
import type { SubmissionSnapshot } from "./constants.js";

function cleanText(v: unknown): string {
  return String(v ?? "").trim();
}

function cleanList(v: unknown): string {
  if (Array.isArray(v)) {
    return v
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .join("، ");
  }
  return cleanText(v);
}

const VIDEO_NEGATIVE_SUFFIX =
  "Ensure no text, no floating letters, no watermarks. Maintain strict physical consistency.";

function section(title: string, body: string): string {
  const normalized = cleanText(body);
  if (!normalized) return "";
  return `## ${title}\n${normalized}\n`;
}

type DiagnosticContext = {
  role: string;
  stage: string;
  followersBand: string;
  blocker: string;
  revenueGoal: string;
};

function normalizedOrNA(v: string): string {
  const value = cleanText(v);
  return value || "not_provided";
}

function parseFollowersBand(raw: string): { min: number; max: number; kind: "range" | "plus" | "exact" | "unknown" } {
  const text = cleanText(raw).toLowerCase();
  if (!text) return { min: 0, max: 0, kind: "unknown" };
  const tokenMatches = text.match(/\d+(?:\.\d+)?\s*[km]?/g) ?? [];
  const nums = tokenMatches
    .map((token) => {
      const t = token.trim();
      const num = parseFloat(t);
      if (Number.isNaN(num)) return NaN;
      if (t.endsWith("k")) return Math.round(num * 1000);
      if (t.endsWith("m")) return Math.round(num * 1000 * 1000);
      return Math.round(num);
    })
    .filter((n) => !Number.isNaN(n));
  if (nums.length >= 2) {
    const a = Math.min(nums[0]!, nums[1]!);
    const b = Math.max(nums[0]!, nums[1]!);
    return { min: a, max: b, kind: "range" };
  }
  if (nums.length === 1) {
    if (text.includes("+")) return { min: nums[0]!, max: Number.MAX_SAFE_INTEGER, kind: "plus" };
    return { min: nums[0]!, max: nums[0]!, kind: "exact" };
  }
  return { min: 0, max: 0, kind: "unknown" };
}

function buildDiagnosticContext(snapshot: SubmissionSnapshot): DiagnosticContext {
  return {
    role: normalizedOrNA(snapshot.diagnostic_role),
    stage: normalizedOrNA(snapshot.diagnostic_account_stage),
    followersBand: normalizedOrNA(snapshot.diagnostic_followers_band),
    blocker: normalizedOrNA(snapshot.diagnostic_primary_blocker),
    revenueGoal: normalizedOrNA(snapshot.diagnostic_revenue_goal),
  };
}

export function buildDiagnosticRulesBlock(snapshot: SubmissionSnapshot): string {
  const followers = parseFollowersBand(snapshot.diagnostic_followers_band);
  const lowerBlocker = cleanText(snapshot.diagnostic_primary_blocker).toLowerCase();
  const lines: string[] = [
    "Follow these diagnostic rules when choosing angles, offers, and CTA intensity:",
  ];

  if (followers.kind !== "unknown" && followers.max < 1000) {
    lines.push("- Prioritize reach and trust building. Avoid aggressive direct selling in primary content.");
    lines.push("- Use authority-building proof, audience pains, and simple CTA.");
  } else if (followers.kind !== "unknown" && followers.min >= 10000) {
    lines.push("- Prioritize conversion. Include lead magnet hooks, direct offer framing, and stronger CTA.");
    lines.push("- Add objection handling and intent-focused funnel cues.");
  } else {
    lines.push("- Balance reach and conversion. Mix authority and conversion creatives.");
  }

  if (lowerBlocker.includes("inconsistent")) {
    lines.push("- Blocker inconsistent execution: output low-friction ideas suitable for batch creation.");
  } else if (lowerBlocker.includes("no-conversion")) {
    lines.push("- Blocker no conversion: strengthen offer clarity, CTA specificity, and proof-led copy.");
  } else if (lowerBlocker.includes("low-reach")) {
    lines.push("- Blocker low reach: favor hook-first creatives and distribution-friendly formats.");
  } else if (lowerBlocker !== "") {
    lines.push(`- Blocker ${snapshot.diagnostic_primary_blocker}: tailor recommendations to reduce this blocker fast.`);
  } else {
    lines.push("- If blocker is not provided, infer the safest low-risk growth path.");
  }

  return lines.join("\n");
}

export function buildFewShotGuidanceBlock(): string {
  const examples = [
    {
      blocker: "no-conversion",
      guidance: "clarify the offer, define target segment, and include concrete CTA with urgency",
    },
    {
      blocker: "inconsistent-execution",
      guidance: "suggest lightweight repeatable content formats and batch-friendly weekly cadence",
    },
    {
      blocker: "low-reach",
      guidance: "use hook-driven opening lines, contrast-based visuals, and platform-native discoverability",
    },
  ];
  return [
    "Few-shot guidance (style constraints):",
    ...examples.map(
      (e, idx) =>
        `${idx + 1}) If blocker is "${e.blocker}", then recommendations must ${e.guidance}.`
    ),
  ].join("\n");
}

export function buildClientContextBlock(snapshot: SubmissionSnapshot): string {
  const diagnostic = buildDiagnosticContext(snapshot);
  const lines = [
    `Brand name: ${cleanText(snapshot.brand_name)}`,
    `Industry: ${cleanText(snapshot.industry)}`,
    `Business links: ${cleanText(snapshot.business_links)}`,
    `Target audience: ${cleanList(snapshot.target_audience)}`,
    `Main goal: ${cleanText(snapshot.main_goal)}`,
    `Platforms: ${cleanList(snapshot.platforms)}`,
    `Brand tone: ${cleanText(snapshot.brand_tone)}`,
    `Brand colors: ${cleanText(snapshot.brand_colors)}`,
    `Offer: ${cleanText(snapshot.offer)}`,
    `Competitors: ${cleanText(snapshot.competitors)}`,
    `Audience pain point: ${cleanText(snapshot.audience_pain_point)}`,
    `Visual notes: ${cleanText(snapshot.visual_notes)}`,
    `Detailed product/service facts: ${cleanText(snapshot.product_details) || "not_provided"}`,
    `Reference image attached: ${cleanText(snapshot.reference_image) ? "yes" : "no"}`,
    `Campaign duration/timing: ${cleanText(snapshot.campaign_duration)}`,
    `Budget level: ${cleanText(snapshot.budget_level)}`,
    `Best content types: ${cleanList(snapshot.best_content_types)}`,
    `Requested posts count: ${snapshot.num_posts}`,
    `Requested image designs count: ${snapshot.num_image_designs}`,
    `Requested video prompts count: ${snapshot.num_video_prompts}`,
    "Diagnostic context (JSON):",
    JSON.stringify(diagnostic),
  ];
  return lines.join("\n");
}

export const REFERENCE_IMAGE_PROMPT_PREFIX = "[INSTRUCTION: USE ATTACHED IMAGE AS EXACT REFERENCE]";

export function buildProductAccuracyPolicyBlock(snapshot: SubmissionSnapshot): string {
  const details = cleanText(snapshot.product_details);
  if (details) {
    return [
      "CRITICAL — product facts (zero hallucination):",
      "The user provided the following detailed product/service description. Treat it as the only source of truth for specific product attributes (colors, materials, fit, shape, features, variants) in all social posts, captions, headlines, and supporting copy:",
      "---",
      details,
      "---",
      "You MUST strictly adhere to this description. DO NOT invent, hallucinate, or assume any product features, colors, materials, shapes, or specs that are not explicitly stated above or in other brief fields when describing the product itself.",
      "If something is unspecified, keep copy at the brand/offer level or use neutral wording; do not fill gaps with invented product traits.",
    ].join("\n");
  }
  return [
    "Product facts: No dedicated `Detailed product/service facts` block was provided.",
    "Do not invent specific physical product attributes (exact colors, materials, dimensions, model variants) in posts or captions unless they appear explicitly elsewhere in the brief (e.g. offer, visual notes, brand colors). Prefer brand- and offer-level messaging when product specifics are absent.",
  ].join("\n");
}

export function buildOutputPolicyBlock(mode: CampaignMode, snapshot: SubmissionSnapshot): string {
  const hasReferenceImage = Boolean(cleanText(snapshot.reference_image));
  const referenceImageImagePromptRules = hasReferenceImage
    ? [
        "",
        "CRITICAL — reference image + `image_designs[].full_ai_image_prompt`:",
        `A reference image is attached. For EVERY item in \`image_designs\`, the field \`full_ai_image_prompt\` MUST begin with this exact string (including brackets): ${REFERENCE_IMAGE_PROMPT_PREFIX}`,
        "After that prefix, describe ONLY the surrounding lifestyle environment, lighting, camera angle, composition, and how models or hands interact with the product—without verbally redescribing the product, logo, marks, silhouette, or colors that duplicate what is already in the attachment.",
        "Do NOT paraphrase the reference (e.g. do not say 'a star-shaped logo'); the tool must use the attachment as the exact visual for the product or logo.",
        "Product-specific wording in captions may still align with the brief and `Detailed product/service facts` when provided; keep `full_ai_image_prompt` directive-first as above.",
      ].join("\n")
    : "";

  return [
    "Return strict JSON matching the response schema exactly.",
    "Preserve response property order exactly as schema-defined (light fields first).",
    "Use `post_ar` and `post_en` for social post copy (do not return legacy `post`). Both versions must carry the same meaning and persuasion level.",
    "Each social post must be long-form, rich, and detailed (not short snippets) in both languages.",
    "Each image design item must include `caption_ar` and `caption_en` that match that exact visual concept.",
    "Each video prompt item must include `caption_ar` and `caption_en` that match that exact video concept.",
    "Each post/image/video item must include `strategic_rationale` as an object with: `trigger_used`, `contrast_note`, `engagement_vector`.",
    "Each post/image/video item must include `algorithmic_advantage` as one concise sentence about expected platform performance.",
    "Each `video_prompts[].ai_tool_instructions` must be one compact cinematic prompt composed of exactly 3 clauses in this order: (1) camera-work clause, (2) motion-control clause, (3) strict negative ending clause.",
    "The camera-work clause must specify shot type + camera movement + lighting mood (example tokens: close-up, medium shot, wide shot, dolly-in, slow tilt up, cinematic lighting, 4k).",
    "The motion-control clause must enforce stability and low-artifact behavior (example tokens: slow motion, subtle movement, stable transitions, smooth pacing).",
    `The final clause of every video prompt must be exactly: ${VIDEO_NEGATIVE_SUFFIX}`,
    "For every social post and media caption, you MUST provide two equivalent versions in meaning: local Arabic (`_ar`) and professional English (`_en`).",
    "Bilingual parity is mandatory: `_ar` and `_en` variants must preserve the same intent, persuasion, and offer details without omissions.",
    "Do not use literal word-by-word translation between Arabic and English; rewrite naturally while preserving semantic equivalence.",
    "Set root `localization_check_passed` to true only when all bilingual pairs are semantically aligned and culturally appropriate.",
    "CRITICAL: DO NOT include Arabic typography, text overlays, or lettering inside image prompts or video scene visuals. Visuals must be text-free.",
    "Spoken scripts and external captions can remain in Arabic.",
    "Arabic for strategy & narrative (mandatory): Every string and every list item inside `marketing_strategy`, `sales_system`, `offer_optimization`, `diagnosis_plan`, `narrative_summary`, and (if present) `kpi_tracking` MUST be written in fluent Arabic (فصحى معاصرة أو لهجة مناسبة لجمهور البراند حسب نبرة البراند في البريف). Do not output those sections in English. Keep Latin only for unavoidable brand names, app names, or standard platform labels (e.g. TikTok, Instagram, Reels) when they are normally written that way.",
    "Return `diagnosis_plan` object with keys: `quickWin24h`, `focus7d`, `priority`, `rationale`.",
    "Return `narrative_summary` as a short 2-4 line user-facing summary in Arabic.",
    `Campaign mode: ${mode}. Keep style aligned with this mode while preserving factual clarity.`,
    referenceImageImagePromptRules,
  ].join("\n");
}

export function buildVideoDirectorPolicyBlock(): string {
  return [
    "Treat all video prompts as cinematic direction, not plain event descriptions.",
    "Camera work is mandatory: specify shot framing, lens perspective, camera move, and lighting mood in each video prompt.",
    "Motion control is mandatory: prefer slow, subtle, physically coherent movement to reduce artifacts.",
    "Avoid fast chaotic motion unless the brief explicitly requires it; default to smooth pacing and stable transitions.",
    "Every generated `ai_tool_instructions` must end with this exact sentence:",
    VIDEO_NEGATIVE_SUFFIX,
  ].join("\n");
}

export function buildMetaPromptBlock(snapshot: SubmissionSnapshot): string {
  const industry = cleanText(snapshot.industry) || "General";
  const audience = cleanList(snapshot.target_audience) || "General audience";
  const goal = cleanText(snapshot.main_goal) || "Drive measurable marketing outcomes";
  const offer = cleanText(snapshot.offer) || "Not specified";
  const platforms = cleanList(snapshot.platforms) || "Not specified";
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
      ? "A visual reference image is attached for this run. Use brief fields (including brand colors, tone, offer, and any detailed product/service facts) for strategy and copy. For image generation, do not substitute a verbal redescription of the attachment: follow Output Rules so each `image_designs[].full_ai_image_prompt` uses the required directive prefix and focuses on environment, lighting, and scene—while the attached image supplies exact product or logo appearance."
      : "No visual reference image was provided. Infer the visual identity from client context only.",
    "",
    "Apply the deduced strategy directly in the generated assets.",
    "Default language for strategic planning fields (marketing_strategy, sales_system, offer_optimization, diagnosis_plan, narrative_summary, kpi_tracking when returned) is Arabic; match the client's market and brand tone.",
    "Do not output reasoning, hidden analysis, or planning notes.",
  ].join("\n");
}

function hashDiversitySeed(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export function buildDiversityPolicyBlock(snapshot: SubmissionSnapshot): string {
  const saltInput = [
    cleanText(snapshot.brand_name),
    cleanText(snapshot.industry),
    cleanText(snapshot.main_goal),
    cleanList(snapshot.platforms),
    snapshot.submitted_at.toISOString(),
  ].join("|");
  const runSalt = hashDiversitySeed(saltInput);

  return [
    `Run diversity salt: ${runSalt}`,
    "Generate fresh concepts for this specific run. Do not copy phrase templates from previous outputs.",
    "For posts, vary hook style, opening angle, and CTA framing across items while staying on-brand.",
    "For image/video concepts, vary scene composition, context, and emotional trigger (avoid repeated setup).",
    "Never repeat identical captions, headlines, or `ai_tool_instructions` across this response.",
  ].join("\n");
}

export type BrandVoiceContext = {
  pillars: { title: string; body: string }[];
  avoidWords: string[];
  sampleSnippet: string;
};

export function buildBrandVoiceBlock(voice?: BrandVoiceContext): string {
  if (!voice) return "";
  const lines: string[] = ["Follow these core brand voice guidelines for all generated copy:"];
  if (voice.pillars.length > 0) {
    lines.push("### Voice Pillars:");
    voice.pillars.forEach((p) => {
      lines.push(`- **${cleanText(p.title)}**: ${cleanText(p.body)}`);
    });
  }
  if (voice.avoidWords.length > 0) {
    lines.push(`### Words/Phrases to avoid: ${voice.avoidWords.join(", ")}`);
  }
  if (cleanText(voice.sampleSnippet)) {
    lines.push("### Style Sample (Match this vibe):");
    lines.push(cleanText(voice.sampleSnippet));
  }
  return lines.join("\n");
}

export function buildHistoricalContextBlock(historicalContext?: string): string {
  const normalized = cleanText(historicalContext);
  if (!normalized) return "";
  return [
    "Use this previous successful context only as guidance for continuity. Do not copy text verbatim.",
    "Prefer preserving strategic consistency while still generating fresh executional angles.",
    normalized,
  ].join("\n");
}

export function composePrompt(input: {
  campaignPrefix: string;
  creativeDirection: string;
  snapshot: SubmissionSnapshot;
  mode: CampaignMode;
  useMetaPrompt?: boolean;
  brandVoice?: BrandVoiceContext;
  historicalContext?: string;
}): string {
  const parts = [
    cleanText(input.campaignPrefix),
    input.useMetaPrompt ? section("Meta Strategy Core", buildMetaPromptBlock(input.snapshot)) : "",
    section("Brand Voice & Tone", buildBrandVoiceBlock(input.brandVoice)),
    section("Creative Direction", input.creativeDirection),
    section("Client Context (auto-injected)", buildClientContextBlock(input.snapshot)),
    section("Historical Context", buildHistoricalContextBlock(input.historicalContext)),
    section("Conditional Diagnostic Rules", buildDiagnosticRulesBlock(input.snapshot)),
    section("Few-shot Guidance", buildFewShotGuidanceBlock()),
    section("Diversity Rules", buildDiversityPolicyBlock(input.snapshot)),
    section("Video Director Rules", buildVideoDirectorPolicyBlock()),
    section("Product Accuracy Rules", buildProductAccuracyPolicyBlock(input.snapshot)),
    section("Output Rules", buildOutputPolicyBlock(input.mode, input.snapshot)),
  ]
    .map((x) => cleanText(x))
    .filter(Boolean);
  return parts.join("\n\n");
}
