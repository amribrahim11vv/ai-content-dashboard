import type { SubmissionSnapshot } from "../logic/constants.js";
import type { GeminiReferenceImage, GeminiSettings } from "../logic/geminiClient.js";
import { buildHooksStepPrompt, buildIdeasStepPrompt, buildTemplatesStepPrompt } from "../logic/packagePrompts.js";
import { getHooksStepSchema, getIdeasStepSchema, getTemplatesStepSchema } from "../logic/packageResponseSchema.js";
import {
  type ContentHook,
  type ContentIdea,
  type ContentIdeasPackage,
  type ContentTemplate,
  validateHooksStep,
  validateIdeasStep,
  validatePackageCoherence,
  validateTemplatesStep,
} from "../logic/packageValidate.js";
import {
  addUsageTotals,
  type AIGenerationDependencies,
  type GenerationUsageTotals,
  generateJsonStepWithGuardrails,
} from "./aiGenerationProvider.js";

function asIdeasData(ideaCount: number) {
  return (raw: unknown) => {
    const r = validateIdeasStep(raw, ideaCount);
    if (!r.ok) return r;
    return { ok: true as const, data: r.data.ideas };
  };
}

function asHooksData(ideaCount: number) {
  return (raw: unknown) => {
    const r = validateHooksStep(raw, ideaCount);
    if (!r.ok) return r;
    return { ok: true as const, data: r.data.hooks };
  };
}

function asTemplatesData(ideaCount: number) {
  return (raw: unknown) => {
    const r = validateTemplatesStep(raw, ideaCount);
    if (!r.ok) return r;
    return { ok: true as const, data: r.data.templates };
  };
}

export async function runContentPackageChain(
  snapshot: SubmissionSnapshot,
  settings: GeminiSettings,
  referenceImage?: GeminiReferenceImage,
  deps?: AIGenerationDependencies
): Promise<{ data: ContentIdeasPackage; usage: GenerationUsageTotals }> {
  const ideaCount = snapshot.content_package_idea_count;
  let usage: GenerationUsageTotals = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  const ideasPrompt = buildIdeasStepPrompt(snapshot);
  const ideasResult = await generateJsonStepWithGuardrails(
    ideasPrompt,
    settings,
    getIdeasStepSchema(ideaCount),
    asIdeasData(ideaCount),
    referenceImage,
    deps
  );
  usage = addUsageTotals(usage, ideasResult.usage);
  const ideas: ContentIdea[] = ideasResult.data;

  const ideasPayloadJson = JSON.stringify({ ideas }, null, 2);

  const hooksPrompt = buildHooksStepPrompt(snapshot, ideasPayloadJson);
  const templatesPrompt = buildTemplatesStepPrompt(snapshot, ideasPayloadJson);

  let hooks: ContentHook[];
  let templates: ContentTemplate[];
  try {
    const [hooksResult, templatesResult] = await Promise.all([
      generateJsonStepWithGuardrails(
        hooksPrompt,
        settings,
        getHooksStepSchema(ideaCount),
        asHooksData(ideaCount),
        referenceImage,
        deps
      ),
      generateJsonStepWithGuardrails(
        templatesPrompt,
        settings,
        getTemplatesStepSchema(ideaCount),
        asTemplatesData(ideaCount),
        referenceImage,
        deps
      ),
    ]);
    hooks = hooksResult.data;
    templates = templatesResult.data;
    usage = addUsageTotals(usage, hooksResult.usage);
    usage = addUsageTotals(usage, templatesResult.usage);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`content_package_chain phase2 failed: ${msg}`);
  }

  const coherence = validatePackageCoherence(ideas, hooks, templates);
  if (coherence.length) {
    throw new Error(`content_package_chain coherence failed: ${coherence.join(" | ")}`);
  }

  return { data: { ideas, hooks, templates }, usage };
}
