import { getGeminiResponseSchema } from "./responseSchema.js";
import { G_DEFAULT_MAX_RETRIES, G_DEFAULT_MODEL } from "./constants.js";

export type GeminiSettings = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  temperature?: number;
  topP?: number;
};

export type GeminiReferenceImage = {
  mimeType: string;
  dataBase64: string;
};

export type GeminiUsageMetadata = {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
};

export type GeminiCallResult = {
  json: unknown;
  usage?: GeminiUsageMetadata;
};

function shouldRetryGemini(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

function isTransientFetchError(error: unknown): boolean {
  const text = String(error ?? "").toLowerCase();
  return (
    text.includes("fetch failed") ||
    text.includes("network") ||
    text.includes("timed out") ||
    text.includes("timeout") ||
    text.includes("econnreset") ||
    text.includes("socket hang up")
  );
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

export function parseJsonFromModelText(text: string): unknown {
  let normalized = String(text ?? "").trim();
  if (normalized.startsWith("```")) {
    normalized = normalized.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  try {
    return JSON.parse(normalized);
  } catch {
    const objectStart = normalized.indexOf("{");
    const arrayStart = normalized.indexOf("[");
    const start =
      objectStart === -1
        ? arrayStart
        : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);
    if (start === -1) throw new Error("No JSON payload found in model text.");

    const objectEnd = normalized.lastIndexOf("}");
    const arrayEnd = normalized.lastIndexOf("]");
    const end = Math.max(objectEnd, arrayEnd);
    if (end === -1 || end <= start) throw new Error("Incomplete JSON payload in model text.");
    const candidate = normalized.slice(start, end + 1);
    return JSON.parse(candidate);
  }
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
): Promise<GeminiCallResult> {
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
      temperature: settings.temperature ?? 0.75,
      topP: settings.topP ?? 0.9,
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
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        };
        const modelText =
          parsedBody?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!modelText) {
          throw new Error("Gemini response missing candidates[0].content.parts[0].text");
        }

        const json = parseJsonFromModelText(modelText);
        const usage =
          parsedBody?.usageMetadata &&
          typeof parsedBody.usageMetadata.promptTokenCount === "number" &&
          typeof parsedBody.usageMetadata.candidatesTokenCount === "number" &&
          typeof parsedBody.usageMetadata.totalTokenCount === "number"
            ? {
                promptTokenCount: parsedBody.usageMetadata.promptTokenCount,
                candidatesTokenCount: parsedBody.usageMetadata.candidatesTokenCount,
                totalTokenCount: parsedBody.usageMetadata.totalTokenCount,
              }
            : undefined;

        return { json, usage };
      }

      lastError = "HTTP " + statusCode + " - " + truncate(rawBody, 800);

      if (!shouldRetryGemini(statusCode) || attempt >= settings.maxRetries) {
        throw new Error("Gemini API error: " + lastError);
      }

      await new Promise((r) => setTimeout(r, getBackoffMs(attempt)));
    } catch (error) {
      lastError = String(error);
      // Retry only transient transport failures; parse/validation errors should fail fast.
      if (!isTransientFetchError(error) || attempt >= settings.maxRetries) {
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
  const temperature = Math.min(1, Math.max(0, parseFloat(process.env.GEMINI_TEMPERATURE ?? "0.75") || 0.75));
  const topP = Math.min(1, Math.max(0, parseFloat(process.env.GEMINI_TOP_P ?? "0.9") || 0.9));

  return { apiKey, model, timeoutMs, maxRetries, temperature, topP };
}
