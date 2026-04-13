import type { SubmissionSnapshot } from "../logic/constants.js";
import {
  callGeminiAPI,
  type GeminiReferenceImage,
  type GeminiSettings,
} from "../logic/geminiClient.js";
import { isPlainObject } from "../logic/parse.js";
import { validateGeminiResponse } from "../logic/validate.js";

export type AIGenerationDependencies = {
  callAPI?: typeof callGeminiAPI;
};

export function buildJsonCorrectionPrompt(basePrompt: string, validationErrors: string[]): string {
  return [
    basePrompt,
    "",
    "STRICT CORRECTION:",
    "Your previous output violated the JSON contract.",
    "Return ONLY valid JSON that strictly matches the required schema.",
    "Do not include markdown, code fences, or explanation text.",
    validationErrors.length
      ? `Fix these errors exactly: ${validationErrors.join(" | ")}`
      : "Fix structural JSON issues and return valid object JSON.",
  ].join("\n");
}

export type JsonStepValidate<T> = (raw: unknown) => { ok: true; data: T } | { ok: false; errors: string[] };

export async function generateJsonStepWithGuardrails<T>(
  basePrompt: string,
  settings: GeminiSettings,
  responseSchema: Record<string, unknown>,
  validate: JsonStepValidate<T>,
  referenceImage?: GeminiReferenceImage,
  deps?: AIGenerationDependencies
): Promise<T> {
  const callAPI = deps?.callAPI ?? callGeminiAPI;
  let promptText = basePrompt;
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await callAPI(promptText, settings, responseSchema, referenceImage);
    const result = validate(raw);
    if (result.ok) return result.data;
    lastErrors = result.errors;
    if (attempt === 0) {
      promptText = buildJsonCorrectionPrompt(basePrompt, lastErrors);
      continue;
    }
  }
  throw new Error("content_package_chain: step validation failed: " + lastErrors.join(" | "));
}

export async function generateWithGuardrails(
  basePrompt: string,
  snapshot: SubmissionSnapshot,
  settings: GeminiSettings,
  referenceImage?: GeminiReferenceImage,
  deps?: AIGenerationDependencies
): Promise<{ aiContent: Record<string, unknown>; jsonValid: boolean; retryCount: number }> {
  const callAPI = deps?.callAPI ?? callGeminiAPI;
  let retryCount = 0;
  let promptText = basePrompt;
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await callAPI(promptText, settings, undefined, referenceImage);
    if (!isPlainObject(raw)) {
      lastErrors = ["Gemini returned non-object JSON."];
    } else {
      const validationErrors = validateGeminiResponse(raw, snapshot);
      if (validationErrors.length === 0) {
        return { aiContent: raw as Record<string, unknown>, jsonValid: true, retryCount };
      }
      lastErrors = validationErrors;
    }
    if (attempt === 0) {
      retryCount += 1;
      promptText = buildJsonCorrectionPrompt(basePrompt, lastErrors);
      continue;
    }
  }
  throw new Error("Gemini validation failed after corrective retry: " + lastErrors.join(" | "));
}
