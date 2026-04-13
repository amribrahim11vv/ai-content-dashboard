import { createHash } from "node:crypto";
import { eq, desc, lt, and } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { kits, idempotencyKeys, type KitRow } from "../db/schema.js";
import { buildSubmissionSnapshot, briefFingerprint, isPlainObject, parseSubmissionSnapshotJson } from "../logic/parse.js";
import { resolvePrompt } from "../logic/promptResolver.js";
import { callGeminiAPI, loadGeminiSettingsFromEnv, type GeminiReferenceImage, type GeminiSettings } from "../logic/geminiClient.js";
import { validateGeminiResponse } from "../logic/validate.js";
import { getStatusBadgeLabel, getStatusBadgePalette, normalizeDeliveryStatus } from "../logic/status.js";
import { buildDemoKitContent } from "../logic/demoKit.js";
import { resolveDeliveryStatus, sendAdminFailureAlert, sendClientDelayEmail, sendKitEmail } from "../email/send.js";
import { recordKitNotification } from "../logic/notifyKit.js";
import type { SubmissionSnapshot } from "../logic/constants.js";
import type { Next } from "hono";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_REFERENCE_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_REFERENCE_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

const generateBodySchema = z
  .object({
    submitted_at: z.union([z.string(), z.number()]).optional(),
    email: z.string().optional(),
    brand_name: z.string().optional().default(""),
    industry: z.string().optional().default(""),
    target_audience: z.string().optional().default(""),
    main_goal: z.string().optional().default(""),
    platforms: z.string().optional().default(""),
    brand_tone: z.string().optional().default(""),
    brand_colors: z.string().optional().default(""),
    offer: z.string().optional().default(""),
    competitors: z.string().optional().default(""),
    visual_notes: z.string().optional().default(""),
    reference_image: z.string().optional().default(""),
    campaign_duration: z.string().optional().default(""),
    budget_level: z.string().optional().default(""),
    best_content_types: z.string().optional().default(""),
    num_posts: z.number().optional(),
    num_image_designs: z.number().optional(),
    num_video_prompts: z.number().optional(),
    campaign_mode: z.enum(["social", "offer", "deep"]).optional(),
  })
  .passthrough();

const retryBodySchema = z.object({
  brief_json: z.string().min(1),
  row_version: z.number().int().nonnegative(),
});

const regenerateItemBodySchema = z.object({
  item_type: z.enum(["post", "image", "video"]),
  index: z.number().int().nonnegative(),
  row_version: z.number().int().nonnegative(),
  feedback: z.string().trim().max(1200).optional(),
});

type RegenerateItemType = z.infer<typeof regenerateItemBodySchema>["item_type"];

const SECTION_KEYS: Record<RegenerateItemType, string[]> = {
  post: ["posts"],
  image: ["image_designs", "image_prompts", "creative_prompts", "design_prompts", "visual_prompts"],
  video: ["video_prompts", "video_assets", "ai_video_assets", "assets"],
};

export function getSectionArray(result: Record<string, unknown>, type: RegenerateItemType): { key: string; items: unknown[] } | null {
  const keys = SECTION_KEYS[type];
  for (const key of keys) {
    const v = result[key];
    if (Array.isArray(v)) return { key, items: v };
  }
  return null;
}

export function getRegenerateItemSchema(type: RegenerateItemType): Record<string, unknown> {
  if (type === "post") {
    return {
      type: "OBJECT",
      required: ["item"],
      properties: {
        item: {
          type: "OBJECT",
          required: ["platform", "format", "goal", "post_ar", "post_en", "hashtags", "cta"],
          properties: {
            platform: { type: "STRING" },
            format: { type: "STRING" },
            goal: { type: "STRING" },
            post_ar: { type: "STRING" },
            post_en: { type: "STRING" },
            hashtags: { type: "ARRAY", items: { type: "STRING" } },
            cta: { type: "STRING" },
          },
        },
      },
    };
  }
  if (type === "image") {
    return {
      type: "OBJECT",
      required: ["item"],
      properties: {
        item: {
          type: "OBJECT",
          required: [
            "platform_format",
            "design_type",
            "goal",
            "visual_scene",
            "headline_text_overlay",
            "supporting_copy",
            "full_ai_image_prompt",
            "caption_ar",
            "caption_en",
            "text_policy",
            "conversion_trigger",
          ],
          properties: {
            platform_format: { type: "STRING" },
            design_type: { type: "STRING" },
            goal: { type: "STRING" },
            visual_scene: { type: "STRING" },
            headline_text_overlay: { type: "STRING" },
            supporting_copy: { type: "STRING" },
            full_ai_image_prompt: { type: "STRING" },
            caption_ar: { type: "STRING" },
            caption_en: { type: "STRING" },
            text_policy: { type: "STRING" },
            conversion_trigger: { type: "STRING" },
          },
        },
      },
    };
  }
  return {
    type: "OBJECT",
    required: ["item"],
    properties: {
      item: {
        type: "OBJECT",
        required: ["platform", "duration", "style", "hook_type", "scenes", "caption_ar", "caption_en", "ai_tool_instructions", "why_this_converts"],
        properties: {
          platform: { type: "STRING" },
          duration: { type: "STRING" },
          style: { type: "STRING" },
          hook_type: { type: "STRING" },
          scenes: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              required: ["time", "label", "visual", "text", "audio"],
              properties: {
                time: { type: "STRING" },
                label: { type: "STRING" },
                visual: { type: "STRING" },
                text: { type: "STRING" },
                audio: { type: "STRING" },
              },
            },
          },
          caption_ar: { type: "STRING" },
          caption_en: { type: "STRING" },
          ai_tool_instructions: { type: "STRING" },
          why_this_converts: { type: "STRING" },
        },
      },
    },
  };
}

export function hashIdempotencyKey(key: string): string {
  return createHash("sha256").update(String(key).trim(), "utf8").digest("hex");
}

function pruneExpiredIdempotency() {
  const now = Date.now();
  db.delete(idempotencyKeys).where(lt(idempotencyKeys.expiresAt, now)).run();
}

function serializeKit(row: KitRow) {
  const status = row.deliveryStatus;
  const palette = getStatusBadgePalette(status);
  let result: unknown = null;
  if (row.resultJson) {
    try {
      result = JSON.parse(row.resultJson);
    } catch {
      result = null;
    }
  }
  return {
    id: row.id,
    brief_json: row.briefJson,
    result_json: result,
    delivery_status: row.deliveryStatus,
    status_badge: getStatusBadgeLabel(status),
    badge_palette: palette,
    model_used: row.modelUsed,
    last_error: row.lastError,
    correlation_id: row.correlationId,
    prompt_version_id: row.promptVersionId ?? null,
    is_fallback: Boolean(row.isFallback),
    row_version: row.rowVersion,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function persistKit(
  snapshot: ReturnType<typeof buildSubmissionSnapshot>,
  aiContent: Record<string, unknown> | null,
  meta: {
    deliveryStatus: string;
    modelUsed: string;
    lastError: string;
    correlationId: string;
    promptVersionId?: string | null;
    isFallback?: boolean;
    rowVersion?: number;
  }
) {
  const id = nanoid();
  const now = new Date();
  const briefJson = JSON.stringify({
    ...snapshot,
    submitted_at: snapshot.submitted_at.toISOString(),
  });

  await db.insert(kits).values({
    id,
    briefJson,
    resultJson: aiContent ? JSON.stringify(aiContent) : null,
    deliveryStatus: meta.deliveryStatus,
    modelUsed: meta.modelUsed,
    lastError: meta.lastError,
    correlationId: meta.correlationId,
    promptVersionId: meta.promptVersionId ?? null,
    isFallback: meta.isFallback ?? false,
    rowVersion: meta.rowVersion ?? 0,
    createdAt: now,
    updatedAt: now,
  });

  const row = await db.select().from(kits).where(eq(kits.id, id)).get();
  if (!row) throw new Error("Failed to read inserted kit");
  return row;
}

async function updateKit(
  id: string,
  snapshot: ReturnType<typeof buildSubmissionSnapshot>,
  aiContent: Record<string, unknown> | null,
  meta: {
    deliveryStatus: string;
    modelUsed: string;
    lastError: string;
    correlationId: string;
    promptVersionId?: string | null;
    isFallback?: boolean;
    rowVersion: number;
  }
) {
  const now = new Date();
  const briefJson = JSON.stringify({
    ...snapshot,
    submitted_at: snapshot.submitted_at.toISOString(),
  });

  const updated = await db
    .update(kits)
    .set({
      briefJson,
      resultJson: aiContent ? JSON.stringify(aiContent) : null,
      deliveryStatus: meta.deliveryStatus,
      modelUsed: meta.modelUsed,
      lastError: meta.lastError,
      correlationId: meta.correlationId,
      promptVersionId: meta.promptVersionId ?? null,
      isFallback: meta.isFallback ?? false,
      rowVersion: meta.rowVersion,
      updatedAt: now,
    })
    .where(and(eq(kits.id, id), eq(kits.rowVersion, meta.rowVersion - 1)))
    .returning();

  if (!updated.length) {
    return null;
  }
  return updated[0]!;
}

function buildJsonCorrectionPrompt(basePrompt: string, validationErrors: string[]): string {
  return [
    basePrompt,
    "",
    "STRICT CORRECTION:",
    "Your previous output violated the JSON contract.",
    "Return ONLY valid JSON that strictly matches the required schema.",
    "Do not include markdown, code fences, or explanation text.",
    validationErrors.length ? `Fix these errors exactly: ${validationErrors.join(" | ")}` : "Fix structural JSON issues and return valid object JSON.",
  ].join("\n");
}

async function generateWithGuardrails(
  basePrompt: string,
  snapshot: SubmissionSnapshot,
  settings: GeminiSettings,
  referenceImage?: GeminiReferenceImage
): Promise<{ aiContent: Record<string, unknown>; jsonValid: boolean; retryCount: number }> {
  let retryCount = 0;
  let promptText = basePrompt;
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await callGeminiAPI(promptText, settings, undefined, referenceImage);
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

function logGenerationTelemetry(meta: {
  phase: "generate" | "retry";
  promptMode: "meta" | "catalog";
  industrySource: "brief" | "fallback";
  jsonValid: boolean;
  retryCount: number;
  has_reference_image: boolean;
  correlationId: string;
  kitId?: string;
}) {
  console.info("[prompt_telemetry]", JSON.stringify(meta));
}

function estimateBase64ByteLength(base64Text: string): number {
  const clean = String(base64Text ?? "").replace(/\s+/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

function parseReferenceImageFromDataUrl(referenceImageValue: string): GeminiReferenceImage | undefined {
  const raw = String(referenceImageValue ?? "").trim();
  if (!raw) return undefined;
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("reference_image must be a valid base64 data URL.");
  }
  const mimeType = String(match[1] ?? "").trim().toLowerCase();
  const dataBase64 = String(match[2] ?? "").trim();
  if (!ALLOWED_REFERENCE_IMAGE_MIME.has(mimeType)) {
    throw new Error("reference_image mime type is not supported.");
  }
  if (!dataBase64) {
    throw new Error("reference_image payload is empty.");
  }
  const bytes = estimateBase64ByteLength(dataBase64);
  if (bytes <= 0 || bytes > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error(`reference_image is too large. Max allowed is ${MAX_REFERENCE_IMAGE_BYTES} bytes.`);
  }
  return { mimeType, dataBase64 };
}

export function createKitsRouter(mw: (c: import("hono").Context, next: Next) => Promise<void | Response>) {
  const app = new Hono();

  app.use("/api/kits/*", mw);

  app.post("/api/kits/generate", async (c) => {
    const idemHeader = c.req.header("Idempotency-Key")?.trim();
    if (!idemHeader) {
      return c.json({ error: "Idempotency-Key header is required." }, 400);
    }

    let body: z.infer<typeof generateBodySchema>;
    try {
      body = generateBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid JSON body." }, 400);
    }

    const snapshot = buildSubmissionSnapshot(body as Record<string, unknown>);
    let referenceImage: GeminiReferenceImage | undefined;
    try {
      referenceImage = parseReferenceImageFromDataUrl(snapshot.reference_image);
    } catch (e) {
      return c.json({ error: String(e) }, 400);
    }
    const fp = briefFingerprint(snapshot);
    const keyHash = hashIdempotencyKey(idemHeader);

    pruneExpiredIdempotency();

    const existingKey = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.keyHash, keyHash)).get();
    if (existingKey) {
      if (existingKey.briefHash !== fp) {
        return c.json({ error: "Idempotency-Key already used with a different brief." }, 409);
      }
      const kit = await db.select().from(kits).where(eq(kits.id, existingKey.kitId)).get();
      if (kit) return c.json(serializeKit(kit));
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.keyHash, keyHash)).run();
    }

    const demoMode = String(process.env.DEMO_MODE ?? "").toLowerCase() === "true";
    const settings = loadGeminiSettingsFromEnv();
    const correlationId = nanoid();
    const resolved = await resolvePrompt(snapshot.industry, snapshot);

    if (demoMode) {
      const aiContent = buildDemoKitContent(snapshot) as Record<string, unknown>;
      const emailResult = await sendKitEmail(snapshot, aiContent);
      const delivery = resolveDeliveryStatus(emailResult);
      const row = await persistKit(snapshot, aiContent, {
        deliveryStatus: delivery,
        modelUsed: "demo-mode",
        lastError: emailResult.error || "",
        correlationId,
        promptVersionId: resolved.promptVersionId,
        isFallback: resolved.isFallback,
      });
      recordKitNotification(row);
      await db
        .insert(idempotencyKeys)
        .values({ keyHash, briefHash: fp, kitId: row.id, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS })
        .run();
      return c.json(serializeKit(row));
    }

    if (!settings.apiKey) {
      const row = await persistKit(snapshot, null, {
        deliveryStatus: "failed_generation",
        modelUsed: settings.model,
        lastError: "Missing GEMINI_API_KEY.",
        correlationId,
        promptVersionId: resolved.promptVersionId,
        isFallback: resolved.isFallback,
      });
      recordKitNotification(row);
      await db
        .insert(idempotencyKeys)
        .values({ keyHash, briefHash: fp, kitId: row.id, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS })
        .run();
      return c.json(serializeKit(row), 201);
    }

    try {
      const promptText = resolved.renderedPrompt;
      const { aiContent, jsonValid, retryCount } = await generateWithGuardrails(promptText, snapshot, settings, referenceImage);
      const emailResult = await sendKitEmail(snapshot, aiContent);
      const delivery = resolveDeliveryStatus(emailResult);
      const row = await persistKit(snapshot, aiContent, {
        deliveryStatus: delivery,
        modelUsed: settings.model,
        lastError: emailResult.error || "",
        correlationId,
        promptVersionId: resolved.promptVersionId,
        isFallback: resolved.isFallback,
      });
      logGenerationTelemetry({
        phase: "generate",
        promptMode: resolved.promptMode,
        industrySource: resolved.industrySource,
        jsonValid,
        retryCount,
        has_reference_image: Boolean(referenceImage),
        correlationId,
        kitId: row.id,
      });
      recordKitNotification(row);
      await db
        .insert(idempotencyKeys)
        .values({ keyHash, briefHash: fp, kitId: row.id, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS })
        .run();
      return c.json(serializeKit(row), 201);
    } catch (err) {
      const reason = String(err);
      const row = await persistKit(snapshot, null, {
        deliveryStatus: "failed_generation",
        modelUsed: settings.model,
        lastError: reason,
        correlationId,
        promptVersionId: resolved.promptVersionId,
        isFallback: resolved.isFallback,
      });
      logGenerationTelemetry({
        phase: "generate",
        promptMode: resolved.promptMode,
        industrySource: resolved.industrySource,
        jsonValid: false,
        retryCount: 1,
        has_reference_image: Boolean(referenceImage),
        correlationId,
        kitId: row.id,
      });
      recordKitNotification(row);
      const clientDelay = await sendClientDelayEmail(snapshot, correlationId);
      await sendAdminFailureAlert(snapshot, reason, correlationId, row.id, settings.model, clientDelay);
      await db
        .insert(idempotencyKeys)
        .values({ keyHash, briefHash: fp, kitId: row.id, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS })
        .run();
      return c.json(serializeKit(row), 201);
    }
  });

  app.get("/api/kits", async (c) => {
    const rows = await db.select().from(kits).orderBy(desc(kits.createdAt)).limit(200).all();
    return c.json(rows.map(serializeKit));
  });

  app.get("/api/kits/:id", async (c) => {
    const id = c.req.param("id");
    const row = await db.select().from(kits).where(eq(kits.id, id)).get();
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json(serializeKit(row));
  });

  app.post("/api/kits/:id/retry", async (c) => {
    const id = c.req.param("id");
    let body: z.infer<typeof retryBodySchema>;
    try {
      body = retryBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body: brief_json and row_version required." }, 400);
    }

    const row = await db.select().from(kits).where(eq(kits.id, id)).get();
    if (!row) return c.json({ error: "Not found" }, 404);

    const currentStatus = normalizeDeliveryStatus(row.deliveryStatus);
    if (currentStatus !== "failed_generation") {
      return c.json({ error: "Only failed_generation kits can be retried." }, 400);
    }

    if (row.rowVersion !== body.row_version) {
      return c.json({ error: "row_version mismatch; refresh and try again." }, 409);
    }

    let snapshot;
    try {
      snapshot = parseSubmissionSnapshotJson(body.brief_json);
    } catch (e) {
      return c.json({ error: String(e) }, 400);
    }

    const settings = loadGeminiSettingsFromEnv();
    const correlationId = nanoid();
    const nextVersion = row.rowVersion + 1;
    const resolved = await resolvePrompt(snapshot.industry, snapshot);
    let referenceImage: GeminiReferenceImage | undefined;
    try {
      referenceImage = parseReferenceImageFromDataUrl(snapshot.reference_image);
    } catch (e) {
      return c.json({ error: String(e) }, 400);
    }

    const demoMode = String(process.env.DEMO_MODE ?? "").toLowerCase() === "true";

    const setRetry = await updateKit(
      id,
      snapshot,
      null,
      {
        deliveryStatus: "retry_in_progress",
        modelUsed: settings.model,
        lastError: "",
        correlationId,
        promptVersionId: resolved.promptVersionId,
        isFallback: resolved.isFallback,
        rowVersion: nextVersion,
      }
    );
    if (!setRetry) {
      return c.json({ error: "Concurrent update; refresh and try again." }, 409);
    }

    if (demoMode) {
      const aiContent = buildDemoKitContent(snapshot) as Record<string, unknown>;
      const emailResult = await sendKitEmail(snapshot, aiContent);
      const delivery = resolveDeliveryStatus(emailResult);
      const finalRow = await db
        .update(kits)
        .set({
          resultJson: JSON.stringify(aiContent),
          deliveryStatus: delivery,
          lastError: emailResult.error || "",
          correlationId,
          promptVersionId: resolved.promptVersionId,
          isFallback: resolved.isFallback,
          rowVersion: nextVersion + 1,
          updatedAt: new Date(),
        })
        .where(eq(kits.id, id))
        .returning();
      const done = finalRow[0]!;
      recordKitNotification(done);
      return c.json(serializeKit(done));
    }

    if (!settings.apiKey) {
      const fail = await db
        .update(kits)
        .set({
          deliveryStatus: "failed_generation",
          lastError: "Missing GEMINI_API_KEY.",
          correlationId,
          promptVersionId: resolved.promptVersionId,
          isFallback: resolved.isFallback,
          rowVersion: nextVersion + 1,
          updatedAt: new Date(),
        })
        .where(eq(kits.id, id))
        .returning();
      const fr = fail[0]!;
      recordKitNotification(fr);
      return c.json(serializeKit(fr));
    }

    try {
      const promptText = resolved.renderedPrompt;
      const { aiContent, jsonValid, retryCount } = await generateWithGuardrails(promptText, snapshot, settings, referenceImage);
      const emailResult = await sendKitEmail(snapshot, aiContent);
      const delivery = resolveDeliveryStatus(emailResult);
      const finalRow = await db
        .update(kits)
        .set({
          briefJson: JSON.stringify({ ...snapshot, submitted_at: snapshot.submitted_at.toISOString() }),
          resultJson: JSON.stringify(aiContent),
          deliveryStatus: delivery,
          lastError: emailResult.error || "",
          correlationId,
          promptVersionId: resolved.promptVersionId,
          isFallback: resolved.isFallback,
          rowVersion: nextVersion + 1,
          updatedAt: new Date(),
        })
        .where(eq(kits.id, id))
        .returning();
      const ok = finalRow[0]!;
      logGenerationTelemetry({
        phase: "retry",
        promptMode: resolved.promptMode,
        industrySource: resolved.industrySource,
        jsonValid,
        retryCount,
        has_reference_image: Boolean(referenceImage),
        correlationId,
        kitId: ok.id,
      });
      recordKitNotification(ok);
      return c.json(serializeKit(ok));
    } catch (err) {
      const reason = String(err);
      const clientDelay = await sendClientDelayEmail(snapshot, correlationId);
      await sendAdminFailureAlert(snapshot, reason, correlationId, id, settings.model, clientDelay);
      const fail = await db
        .update(kits)
        .set({
          deliveryStatus: "failed_generation",
          lastError: reason,
          correlationId,
          promptVersionId: resolved.promptVersionId,
          isFallback: resolved.isFallback,
          rowVersion: nextVersion + 1,
          updatedAt: new Date(),
        })
        .where(eq(kits.id, id))
        .returning();
      const fr = fail[0]!;
      logGenerationTelemetry({
        phase: "retry",
        promptMode: resolved.promptMode,
        industrySource: resolved.industrySource,
        jsonValid: false,
        retryCount: 1,
        has_reference_image: Boolean(referenceImage),
        correlationId,
        kitId: fr.id,
      });
      recordKitNotification(fr);
      return c.json(serializeKit(fr));
    }
  });

  app.post("/api/kits/:id/regenerate-item", async (c) => {
    const id = c.req.param("id");
    let body: z.infer<typeof regenerateItemBodySchema>;
    try {
      body = regenerateItemBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body: item_type, index, row_version required." }, 400);
    }

    const row = await db.select().from(kits).where(eq(kits.id, id)).get();
    if (!row) return c.json({ error: "Not found" }, 404);
    if (row.rowVersion !== body.row_version) {
      return c.json({ error: "row_version mismatch; refresh and try again." }, 409);
    }
    if (!row.resultJson) {
      return c.json({ error: "Kit has no generated content to regenerate." }, 422);
    }

    let snapshot;
    try {
      snapshot = parseSubmissionSnapshotJson(row.briefJson);
    } catch (e) {
      return c.json({ error: String(e) }, 400);
    }
    let referenceImage: GeminiReferenceImage | undefined;
    try {
      referenceImage = parseReferenceImageFromDataUrl(snapshot.reference_image);
    } catch (e) {
      return c.json({ error: String(e) }, 400);
    }

    let resultObj: Record<string, unknown>;
    try {
      const parsed = JSON.parse(row.resultJson);
      if (!isPlainObject(parsed)) {
        return c.json({ error: "Existing result_json is invalid." }, 422);
      }
      resultObj = parsed as Record<string, unknown>;
    } catch {
      return c.json({ error: "Existing result_json is invalid JSON." }, 422);
    }

    const section = getSectionArray(resultObj, body.item_type);
    if (!section) {
      return c.json({ error: `No ${body.item_type} section found in kit.` }, 422);
    }
    if (body.index >= section.items.length) {
      return c.json({ error: `Index out of range. max=${section.items.length - 1}` }, 422);
    }

    const currentItem = section.items[body.index];
    const settings = loadGeminiSettingsFromEnv();
    if (!settings.apiKey) {
      return c.json({ error: "Missing GEMINI_API_KEY." }, 500);
    }
    const correlationId = nanoid();
    const resolved = await resolvePrompt(snapshot.industry, snapshot);
    const schema = getRegenerateItemSchema(body.item_type);
    const feedbackLine = body.feedback?.trim()
      ? `User feedback (must be applied): ${body.feedback.trim()}`
      : "User feedback: none provided.";
    const promptText = [
      "You are regenerating exactly ONE item inside an existing content kit.",
      "Return JSON with shape: {\"item\": { ... }} matching the provided schema exactly.",
      "Do not return arrays, wrappers, markdown, or extra keys.",
      `Target item type: ${body.item_type}`,
      `Target section key: ${section.key}`,
      `Target index: ${body.index}`,
      feedbackLine,
      "",
      "Original full creative context:",
      resolved.renderedPrompt,
      referenceImage
        ? "A visual reference image is attached for this request. Preserve its visual style and color direction in the regenerated item."
        : "No visual reference image is attached for this request.",
      "",
      "Current item to replace:",
      JSON.stringify(currentItem, null, 2),
    ].join("\n");

    let generated: unknown;
    try {
      generated = await callGeminiAPI(promptText, settings, schema, referenceImage);
    } catch (e) {
      return c.json({ error: `Regenerate failed: ${String(e)}` }, 502);
    }

    if (!isPlainObject(generated) || !("item" in generated) || !isPlainObject(generated.item)) {
      return c.json({ error: "Model returned invalid regenerate payload." }, 502);
    }

    const merged = { ...resultObj } as Record<string, unknown>;
    const updatedItems = [...section.items];
    updatedItems[body.index] = generated.item as Record<string, unknown>;
    merged[section.key] = updatedItems;

    const nextVersion = row.rowVersion + 1;
    const updated = await db
      .update(kits)
      .set({
        resultJson: JSON.stringify(merged),
        correlationId,
        modelUsed: settings.model,
        lastError: "",
        rowVersion: nextVersion,
        updatedAt: new Date(),
      })
      .where(and(eq(kits.id, id), eq(kits.rowVersion, body.row_version)))
      .returning();

    if (!updated.length) {
      return c.json({ error: "Concurrent update; refresh and try again." }, 409);
    }
    return c.json(serializeKit(updated[0]!));
  });

  return app;
}
