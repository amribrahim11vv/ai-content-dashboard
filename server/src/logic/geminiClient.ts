import { getGeminiResponseSchema } from "./responseSchema.js";
import { G_DEFAULT_MAX_RETRIES, G_DEFAULT_MODEL } from "./constants.js";

export type GeminiSettings = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
};

export type GeminiReferenceImage = {
  mimeType: string;
  dataBase64: string;
};

function shouldRetryGemini(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

/** Apps Script uses 2–5 min on first retry; HTTP BFF uses shorter delays capped by timeout. */
function getBackoffMs(attempt: number): number {
  if (attempt === 0) {
    return 2000 + Math.floor(Math.random() * 6000);
  }
  const base = 1000;
  const max = 8000;
  return Math.min(max, base * Math.pow(2, attempt));
}

function parseJsonFromModelText(text: string): unknown {
  let normalized = String(text ?? "").trim();
  if (normalized.startsWith("```")) {
    normalized = normalized.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  return JSON.parse(normalized);
}

function truncate(value: string, maxLen: number): string {
  const t = String(value ?? "");
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 3) + "...";
}

export async function callGeminiAPI(
  promptText: string,
  settings: GeminiSettings,
  responseSchema?: Record<string, unknown>,
  referenceImage?: GeminiReferenceImage
): Promise<unknown> {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(settings.model) + ":generateContent";
  const parts: Array<Record<string, unknown>> = [{ text: promptText }];
  if (referenceImage) {
    parts.push({
      inlineData: {
        mimeType: referenceImage.mimeType,
        data: referenceImage.dataBase64,
      },
    });
  }

  const payload = {
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema ?? getGeminiResponseSchema(),
      temperature: 0.4,
      topP: 0.9,
    },
  };

  const startedAt = Date.now();
  let lastError = "";

  for (let attempt = 0; attempt <= settings.maxRetries; attempt++) {
    if (Date.now() - startedAt > settings.timeoutMs) {
      throw new Error("Gemini timeout exceeded " + settings.timeoutMs + "ms. LastError=" + lastError);
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": settings.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const statusCode = response.status;
      const rawBody = await response.text();

      if (statusCode >= 200 && statusCode < 300) {
        const parsedBody = JSON.parse(rawBody) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const modelText =
          parsedBody?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!modelText) {
          throw new Error("Gemini response missing candidates[0].content.parts[0].text");
        }

        return parseJsonFromModelText(modelText);
      }

      lastError = "HTTP " + statusCode + " - " + truncate(rawBody, 800);

      if (!shouldRetryGemini(statusCode) || attempt >= settings.maxRetries) {
        throw new Error("Gemini API error: " + lastError);
      }

      await new Promise((r) => setTimeout(r, getBackoffMs(attempt)));
    } catch (error) {
      lastError = String(error);
      if (attempt >= settings.maxRetries) {
        throw new Error("Gemini request failed after retries: " + lastError);
      }
      await new Promise((r) => setTimeout(r, getBackoffMs(attempt)));
    }
  }

  throw new Error("Gemini failed unexpectedly.");
}

export function loadGeminiSettingsFromEnv(): GeminiSettings {
  const apiKey = String(process.env.GEMINI_API_KEY ?? "").trim();
  const model = String(process.env.GEMINI_MODEL ?? G_DEFAULT_MODEL).trim() || G_DEFAULT_MODEL;
  const timeoutMs = Math.min(55_000, Math.max(5_000, parseInt(process.env.GEMINI_TIMEOUT_MS ?? "55000", 10) || 55_000));
  const maxRetries = Math.max(0, Math.min(3, parseInt(process.env.GEMINI_MAX_RETRIES ?? String(G_DEFAULT_MAX_RETRIES), 10) || G_DEFAULT_MAX_RETRIES));

  return { apiKey, model, timeoutMs, maxRetries };
}
