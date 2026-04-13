import type { SubmissionSnapshot } from "./constants.js";
import { buildClientContextBlock } from "./promptComposer.js";
import { PACKAGE_HOOKS_PER_IDEA, expectedHooksTotal } from "./packageConstants.js";

export function buildIdeasStepPrompt(snapshot: SubmissionSnapshot): string {
  const n = snapshot.content_package_idea_count;
  return [
    "You are a social content strategist.",
    `Generate exactly ${n} distinct short-form content ideas for the brand below.`,
    "Return JSON with root key `ideas`: array of objects with integer `id`, string `title`, and string `description`.",
    `CRITICAL: use ids 1 through ${n} exactly once each (one idea per id).`,
    "Titles and descriptions must be non-empty and specific to the brief.",
    "",
    "Client context:",
    buildClientContextBlock(snapshot),
  ].join("\n");
}

export function buildHooksStepPrompt(snapshot: SubmissionSnapshot, ideasPayloadJson: string): string {
  const n = snapshot.content_package_idea_count;
  const total = expectedHooksTotal(n);
  const variantList =
    PACKAGE_HOOKS_PER_IDEA === 2
      ? "1 and 2 only"
      : Array.from({ length: PACKAGE_HOOKS_PER_IDEA }, (_, i) => String(i + 1)).join(", ");
  return [
    "You are a hook copywriter for short-form social video.",
    `Given the ideas JSON below, write exactly ${PACKAGE_HOOKS_PER_IDEA} hook lines per idea (${total} hooks total).`,
    "Return JSON with root key `hooks`: array of objects with integer `idea_id`, integer `variant_index`, and string `hook_text`.",
    `variant_index must be ${variantList} for each idea_id, with no duplicates per idea.`,
    "",
    "Client context:",
    buildClientContextBlock(snapshot),
    "",
    "Ideas (source of truth):",
    ideasPayloadJson,
  ].join("\n");
}

export function buildTemplatesStepPrompt(snapshot: SubmissionSnapshot, ideasPayloadJson: string): string {
  const n = snapshot.content_package_idea_count;
  return [
    "You are a content systems designer.",
    `Given the ideas JSON below, produce exactly ${n} reusable template descriptions (one per idea).`,
    "Return JSON with root key `templates`: array of objects with integer `idea_id` and string `template_format` (e.g. carousel slide outline, reel beat sheet, story sequence).",
    "Each idea_id from the input must appear exactly once.",
    "",
    "Client context:",
    buildClientContextBlock(snapshot),
    "",
    "Ideas (source of truth):",
    ideasPayloadJson,
  ].join("\n");
}
