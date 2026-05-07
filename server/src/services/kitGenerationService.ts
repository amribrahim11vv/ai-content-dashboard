import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { idempotencyKeys, kits } from "../db/schema.js";
import { resolveDeliveryStatus, sendAdminFailureAlert, sendClientDelayEmail, sendKitEmail } from "../email/send.js";
import { buildDemoContentIdeasPackage, buildDemoKitContent } from "../logic/demoKit.js";
import { callGeminiAPI, loadGeminiSettingsFromEnv } from "../logic/geminiClient.js";
import { recordKitNotification } from "../logic/notifyKit.js";
import { CONTENT_IDEAS_PACKAGE_KEY } from "../logic/packageConstants.js";
import { shouldRunContentPackageChain } from "../logic/packageEnv.js";
import { buildSubmissionSnapshot, briefFingerprint, isPlainObject, parseSubmissionSnapshotJson } from "../logic/parse.js";
import { REFERENCE_IMAGE_PROMPT_PREFIX } from "../logic/promptComposer.js";
import { resolvePrompt } from "../logic/promptResolver.js";
import { normalizeDeliveryStatus } from "../logic/status.js";
import { generateWithGuardrails } from "./aiGenerationProvider.js";
import { addUsageTotals, type GenerationUsageTotals } from "./aiGenerationProvider.js";
import { runContentPackageChain } from "./contentPackageOrchestrator.js";
import { parseReferenceImageFromDataUrl } from "./imageProcessor.js";
import { notifyTelegramNewLead } from "./telegramNotifier.js";
import {
  consumeGeneratedAssetsOnceForKit,
  consumeUsage,
  enforceGenerateEntitlements,
  enforceRegenerateEntitlements,
  enforceRetryEntitlements,
  resolveAccessContext,
} from "./subscriptionService.js";
import {
  finalizeIdempotencyKey,
  hashIdempotencyKey,
  hasPendingIdempotencyForBriefHash,
  IDEMPOTENCY_PENDING_KIT,
  pruneExpiredIdempotency,
  reserveIdempotencyKey,
} from "./idempotencyService.js";
import {
  deleteKitByIdWithAudit,
  getKitById,
  getKitByIdAny,
  getLatestSuccessfulKitForOwner,
  getPendingKitByBriefHash,
  listAllKits,
  listKits,
  patchKitUiPreferences,
  persistKit,
  serializeKit,
  updateKit,
} from "./kitRepository.js";
import {
  getRegenerateItemSchema,
  getSectionArray,
  type RegenerateItemType,
} from "./kitGenerationDomain.js";
import { logKitFailure } from "./kitFailureLogRepository.js";
import { getLatestFailureForKit, getLatestFailuresForKits } from "./kitFailureLogRepository.js";
import { FailureCode, HttpError, failureHintForCode, safeClientError, toFailureCode } from "./serviceErrors.js";
import { brandVoice } from "../db/schema.js";
import { type BrandVoiceContext } from "../logic/promptComposer.js";
import type { SafeFailureReason } from "./kitRepository.js";

async function fetchBrandVoiceContext(db: any, userId?: string | null): Promise<BrandVoiceContext | undefined> {
  if (!userId) return undefined;
  const rows = await db.select().from(brandVoice).where(eq(brandVoice.userId, userId)).limit(1);
  const row = rows[0];
  if (!row) return undefined;
  try {
    return {
      pillars: JSON.parse(row.pillarsJson),
      avoidWords: JSON.parse(row.avoidWordsJson),
      sampleSnippet: row.sampleSnippet,
    };
  } catch {
    return undefined;
  }
}
export { getRegenerateItemSchema, getSectionArray } from "./kitGenerationDomain.js";
export { HttpError } from "./serviceErrors.js";

function toSafeFailureReason(input: {
  errorCode: string;
  phase: string;
  createdAt: Date;
}): SafeFailureReason {
  return {
    code: input.errorCode,
    hint: failureHintForCode(input.errorCode as FailureCode),
    phase: input.phase,
    timestamp: input.createdAt.toISOString(),
  };
}

export type KitGenerationDependencies = {
  db?: typeof db;
  callGemini?: typeof callGeminiAPI;
  sendKit?: typeof sendKitEmail;
  sendClientDelay?: typeof sendClientDelayEmail;
  sendAdminAlert?: typeof sendAdminFailureAlert;
  notify?: typeof recordKitNotification;
  notifyTelegram?: typeof notifyTelegramNewLead;
};

function withDeps(deps?: KitGenerationDependencies) {
  return {
    db: deps?.db ?? db,
    callGemini: deps?.callGemini ?? callGeminiAPI,
    sendKit: deps?.sendKit ?? sendKitEmail,
    sendClientDelay: deps?.sendClientDelay ?? sendClientDelayEmail,
    sendAdminAlert: deps?.sendAdminAlert ?? sendAdminFailureAlert,
    notify: deps?.notify ?? recordKitNotification,
    notifyTelegram: deps?.notifyTelegram ?? notifyTelegramNewLead,
  };
}

function isContentPackageChainFailureMessage(message: string): boolean {
  return message.includes("content_package_chain");
}

function generatedAssetsUsageFromContent(aiContent: Record<string, unknown>): { videoPromptsUsed: number; imagePromptsUsed: number } {
  return {
    videoPromptsUsed: Array.isArray(aiContent.video_prompts) ? (aiContent.video_prompts as unknown[]).length : 0,
    imagePromptsUsed: Array.isArray(aiContent.image_designs) ? (aiContent.image_designs as unknown[]).length : 0,
  };
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

const HISTORY_MAX_LINE_LEN = 220;
const HISTORY_MAX_LINES = 10;
const HISTORY_MAX_TOTAL = 1600;

function pickStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function truncateLine(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= HISTORY_MAX_LINE_LEN) return compact;
  return compact.slice(0, HISTORY_MAX_LINE_LEN - 1).trimEnd() + "…";
}

function buildHistoricalContextFromResultJson(resultJsonRaw: string | null): string {
  if (!resultJsonRaw) return "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(resultJsonRaw);
  } catch {
    return "";
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
  const result = parsed as Record<string, unknown>;

  const lines: string[] = [];
  const push = (label: string, value: unknown) => {
    const text = truncateLine(String(value ?? ""));
    if (text) lines.push(`- ${label}: ${text}`);
  };

  const marketingStrategy =
    result.marketing_strategy && typeof result.marketing_strategy === "object" && !Array.isArray(result.marketing_strategy)
      ? (result.marketing_strategy as Record<string, unknown>)
      : null;
  const salesSystem =
    result.sales_system && typeof result.sales_system === "object" && !Array.isArray(result.sales_system)
      ? (result.sales_system as Record<string, unknown>)
      : null;
  const offerOptimization =
    result.offer_optimization && typeof result.offer_optimization === "object" && !Array.isArray(result.offer_optimization)
      ? (result.offer_optimization as Record<string, unknown>)
      : null;

  push("Previous narrative summary", result.narrative_summary);
  push("Previous positioning", marketingStrategy?.brand_positioning_statement);
  push("Previous content mix", marketingStrategy?.content_mix_plan);
  push("Previous funnel plan", salesSystem?.funnel_plan);
  push("Previous offer direction", offerOptimization?.rewritten_offer);

  const painPoints = pickStringArray(salesSystem?.pain_points);
  if (painPoints.length) {
    lines.push(`- Previous key pain points: ${truncateLine(painPoints.join(" | "))}`);
  }
  const keyAngles = pickStringArray(marketingStrategy?.key_messaging_angles);
  if (keyAngles.length) {
    lines.push(`- Previous key messaging angles: ${truncateLine(keyAngles.join(" | "))}`);
  }

  if (!lines.length) return "";
  const capped = lines.slice(0, HISTORY_MAX_LINES);
  let block = capped.join("\n");
  if (block.length > HISTORY_MAX_TOTAL) {
    block = block.slice(0, HISTORY_MAX_TOTAL - 1).trimEnd() + "…";
  }
  return block;
}

export function startIdempotencyCleanupJob(intervalMs = 10 * 60 * 1000, deps?: KitGenerationDependencies): NodeJS.Timeout {
  const d = withDeps(deps);
  return setInterval(() => {
    void pruneExpiredIdempotency(d.db).catch((err) => {
      console.warn("[idempotency_cleanup_failed]", String(err));
    });
  }, intervalMs);
}

async function persistGenerationFailure(params: {
  db: typeof db;
  snapshot: ReturnType<typeof buildSubmissionSnapshot>;
  owner: { deviceId: string; userId?: string | null };
  settingsModel: string;
  reason: string;
  correlationId: string;
  promptVersionId?: string | null;
  isFallback?: boolean;
  tokenUsage?: GenerationUsageTotals;
  briefHash?: string;
}) {
  return persistKit(params.db, params.snapshot, null, params.owner, {
    deliveryStatus: "failed_generation",
    modelUsed: params.settingsModel,
    lastError: params.reason,
    correlationId: params.correlationId,
    promptVersionId: params.promptVersionId,
    isFallback: params.isFallback,
    briefHash: params.briefHash,
    tokenUsage: params.tokenUsage,
  });
}

export async function generateKitService(input: {
  idempotencyKey: string;
  body: Record<string, unknown>;
  deviceId: string;
  userId?: string | null;
}, deps?: KitGenerationDependencies) {
  const d = withDeps(deps);
  const idemHeader = input.idempotencyKey?.trim();
  if (!idemHeader) throw new HttpError(400, "Idempotency-Key header is required.");

  const snapshot = buildSubmissionSnapshot(input.body);
  const referenceImage = parseReferenceImageFromDataUrl(snapshot.reference_image);
  const owner = { deviceId: input.deviceId, userId: input.userId ?? null };
  const access = await resolveAccessContext(d.db, owner);
  enforceGenerateEntitlements(access, {
    campaignMode: snapshot.campaign_mode,
    hasReferenceImage: Boolean(referenceImage),
    requestedVideoPrompts: snapshot.num_video_prompts,
    requestedImagePrompts: snapshot.num_image_designs,
  });
  const fp = briefFingerprint(snapshot);
  const keyHash = hashIdempotencyKey(idemHeader);
  if (await hasPendingIdempotencyForBriefHash(d.db, fp)) {
    throw new HttpError(409, "An identical request is already in progress.");
  }
  const reserved = await reserveIdempotencyKey(d.db, { keyHash, briefHash: fp });
  if (!reserved) {
    const existingKey = (await d.db.select().from(idempotencyKeys).where(eq(idempotencyKeys.keyHash, keyHash)).limit(1))[0];
    if (existingKey) {
      if (existingKey.briefHash !== fp) throw new HttpError(409, "Idempotency-Key already used with a different brief.");
      if (existingKey.kitId !== IDEMPOTENCY_PENDING_KIT) {
        const kit = (await d.db.select().from(kits).where(eq(kits.id, existingKey.kitId)).limit(1))[0];
        if (kit) return { status: 200, body: serializeKit(kit) };
      }
      throw new HttpError(409, "A request with the same Idempotency-Key is already in progress.");
    }
  }

  const demoMode = String(process.env.DEMO_MODE ?? "").toLowerCase() === "true";
  const settings = loadGeminiSettingsFromEnv();
  const correlationId = nanoid();
  const bv = await fetchBrandVoiceContext(d.db, input.userId);
  const latestSuccessfulKit = await getLatestSuccessfulKitForOwner(d.db, owner);
  const historicalContext = buildHistoricalContextFromResultJson(latestSuccessfulKit?.resultJson ?? null);
  const resolved = await resolvePrompt(snapshot.industry, snapshot, bv, {
    historicalContext,
  });

  if (demoMode) {
    const aiContent = buildDemoKitContent(snapshot) as Record<string, unknown>;
    if (shouldRunContentPackageChain(snapshot)) {
      aiContent[CONTENT_IDEAS_PACKAGE_KEY] = buildDemoContentIdeasPackage(snapshot.content_package_idea_count);
    }
    const emailResult = await d.sendKit(snapshot, aiContent);
    const row = await persistKit(d.db, snapshot, aiContent, owner, {
      deliveryStatus: resolveDeliveryStatus(emailResult),
      modelUsed: "demo-mode",
      lastError: emailResult.error || "",
      correlationId,
      promptVersionId: resolved.promptVersionId,
      isFallback: resolved.isFallback,
      briefHash: fp,
    });
    await d.notify(row);
    await d.notifyTelegram({ snapshot, kitId: row.id, correlationId });
    await d.db.transaction(async (tx) => {
      await finalizeIdempotencyKey(tx, { keyHash, briefHash: fp, kitId: row.id });
      await consumeGeneratedAssetsOnceForKit(tx, row.id, owner, generatedAssetsUsageFromContent(aiContent));
    });
    return { status: 200, body: serializeKit(row) };
  }

  if (!settings.apiKey) {
    const errorCode = "API_KEY_MISSING" as const;
    const row = await persistGenerationFailure({
      db: d.db,
      snapshot,
      owner,
      settingsModel: settings.model,
      reason: "Missing GEMINI_API_KEY.",
      correlationId,
      promptVersionId: resolved.promptVersionId,
      isFallback: resolved.isFallback,
      briefHash: fp,
    });
    await logKitFailure(d.db, {
      kitId: row.id,
      phase: "generate",
      errorCode,
      errorMessage: "Missing GEMINI_API_KEY.",
      correlationId,
      modelUsed: settings.model,
      meta: { promptMode: resolved.promptMode, industrySource: resolved.industrySource },
    });
    await d.notify(row);
    await d.notifyTelegram({ snapshot, kitId: row.id, correlationId });
    await finalizeIdempotencyKey(d.db, { keyHash, briefHash: fp, kitId: row.id });
    return { status: 201, body: serializeKit(row) };
  }

  try {
    const { aiContent, jsonValid, retryCount, usage: primaryUsage } = await generateWithGuardrails(
      resolved.renderedPrompt,
      snapshot,
      settings,
      referenceImage,
      { callAPI: d.callGemini }
    );
    let usage = primaryUsage;
    if (shouldRunContentPackageChain(snapshot)) {
      const pkgResult = await runContentPackageChain(snapshot, settings, referenceImage, { callAPI: d.callGemini });
      (aiContent as Record<string, unknown>)[CONTENT_IDEAS_PACKAGE_KEY] =
        pkgResult.data as unknown as Record<string, unknown>;
      usage = addUsageTotals(usage, pkgResult.usage);
    }
    const emailResult = await d.sendKit(snapshot, aiContent);
    const row = await persistKit(d.db, snapshot, aiContent, owner, {
      deliveryStatus: resolveDeliveryStatus(emailResult),
      modelUsed: settings.model,
      lastError: emailResult.error || "",
      correlationId,
      promptVersionId: resolved.promptVersionId,
      isFallback: resolved.isFallback,
      briefHash: fp,
      tokenUsage: usage,
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
    await d.notify(row);
    await d.db.transaction(async (tx) => {
      await finalizeIdempotencyKey(tx, { keyHash, briefHash: fp, kitId: row.id });
      await consumeGeneratedAssetsOnceForKit(tx, row.id, owner, generatedAssetsUsageFromContent(aiContent));
    });
    return { status: 201, body: serializeKit(row) };
  } catch (err) {
    const reason = safeClientError(err);
    const errorCode = toFailureCode(
      err,
      isContentPackageChainFailureMessage(reason) ? "CONTENT_PACKAGE_CHAIN_FAILED" : "GENERATION_FAILED"
    );
    const row = await persistGenerationFailure({
      db: d.db,
      snapshot,
      owner,
      settingsModel: settings.model,
      reason,
      correlationId,
      promptVersionId: resolved.promptVersionId,
      isFallback: resolved.isFallback,
      briefHash: fp,
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    });
    await logKitFailure(d.db, {
      kitId: row.id,
      phase: isContentPackageChainFailureMessage(reason) ? "content_package_chain" : "generate",
      errorCode,
      errorMessage: reason,
      correlationId,
      modelUsed: settings.model,
      meta: { promptMode: resolved.promptMode, industrySource: resolved.industrySource },
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
    await d.notify(row);
    const clientDelay = await d.sendClientDelay(snapshot, correlationId);
    await d.sendAdminAlert(snapshot, reason, correlationId, row.id, settings.model, clientDelay);
    await finalizeIdempotencyKey(d.db, { keyHash, briefHash: fp, kitId: row.id });
    return { status: 201, body: serializeKit(row) };
  }
}

export async function enqueueAgencyKitGenerationService(input: {
  idempotencyKey: string;
  body: Record<string, unknown>;
  deviceId: string;
  userId?: string | null;
}, deps?: KitGenerationDependencies) {
  const d = withDeps(deps);
  const idemHeader = input.idempotencyKey?.trim();
  if (!idemHeader) throw new HttpError(400, "Idempotency-Key header is required.");
  const snapshot = buildSubmissionSnapshot(input.body);
  const owner = { deviceId: input.deviceId, userId: input.userId ?? null };
  const access = await resolveAccessContext(d.db, owner);
  enforceGenerateEntitlements(access, {
    campaignMode: snapshot.campaign_mode,
    hasReferenceImage: Boolean(parseReferenceImageFromDataUrl(snapshot.reference_image)),
    requestedVideoPrompts: snapshot.num_video_prompts,
    requestedImagePrompts: snapshot.num_image_designs,
  });

  const settings = loadGeminiSettingsFromEnv();
  const correlationId = nanoid();
  const fp = briefFingerprint(snapshot);
  const keyHash = hashIdempotencyKey(idemHeader);
  const existingPending = await getPendingKitByBriefHash(d.db, owner, fp);
  if (existingPending) {
    return { status: 202 as const, body: serializeKit(existingPending) };
  }
  if (await hasPendingIdempotencyForBriefHash(d.db, fp)) {
    throw new HttpError(409, "An identical request is already in progress.");
  }
  const reserved = await reserveIdempotencyKey(d.db, { keyHash, briefHash: fp });
  if (!reserved) {
    const existingKey = (await d.db.select().from(idempotencyKeys).where(eq(idempotencyKeys.keyHash, keyHash)).limit(1))[0];
    if (existingKey) {
      if (existingKey.briefHash !== fp) throw new HttpError(409, "Idempotency-Key already used with a different brief.");
      if (existingKey.kitId !== IDEMPOTENCY_PENDING_KIT) {
        const existingKit = (await d.db.select().from(kits).where(eq(kits.id, existingKey.kitId)).limit(1))[0];
        if (existingKit) return { status: 200 as const, body: serializeKit(existingKit) };
      }
      throw new HttpError(409, "A request with the same Idempotency-Key is already in progress.");
    }
  }
  const bv = await fetchBrandVoiceContext(d.db, input.userId);
  const latestSuccessfulKit = await getLatestSuccessfulKitForOwner(d.db, owner);
  const historicalContext = buildHistoricalContextFromResultJson(latestSuccessfulKit?.resultJson ?? null);
  const resolved = await resolvePrompt(snapshot.industry, snapshot, bv, {
    historicalContext,
  });
  const referenceImage = parseReferenceImageFromDataUrl(snapshot.reference_image);

  const pending = await persistKit(d.db, snapshot, null, owner, {
    deliveryStatus: "retry_in_progress",
    modelUsed: settings.model,
    lastError: "",
    correlationId,
    promptVersionId: resolved.promptVersionId,
    isFallback: resolved.isFallback,
    briefHash: fp,
    rowVersion: 0,
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  });

  await d.notifyTelegram({ snapshot, kitId: pending.id, correlationId });
  await d.notify(pending);

  void (async () => {
    try {
      const demoMode = String(process.env.DEMO_MODE ?? "").toLowerCase() === "true";
      if (demoMode) {
        const aiContent = buildDemoKitContent(snapshot) as Record<string, unknown>;
        if (shouldRunContentPackageChain(snapshot)) {
          aiContent[CONTENT_IDEAS_PACKAGE_KEY] = buildDemoContentIdeasPackage(snapshot.content_package_idea_count);
        }
        const emailResult = await d.sendKit(snapshot, aiContent);
        const done = await updateKit(d.db, pending.id, snapshot, aiContent, {
          deliveryStatus: resolveDeliveryStatus(emailResult),
          modelUsed: "demo-mode",
          lastError: emailResult.error || "",
          correlationId,
          promptVersionId: resolved.promptVersionId,
          isFallback: resolved.isFallback,
          briefHash: fp,
          rowVersion: 1,
        });
        if (done) {
          await d.notify(done);
          await consumeGeneratedAssetsOnceForKit(d.db, done.id, owner, generatedAssetsUsageFromContent(aiContent));
        }
        await finalizeIdempotencyKey(d.db, { keyHash, briefHash: fp, kitId: pending.id });
        return;
      }

      if (!settings.apiKey) {
        const errorCode = "API_KEY_MISSING" as const;
        const failed = await updateKit(d.db, pending.id, snapshot, null, {
          deliveryStatus: "failed_generation",
          modelUsed: settings.model,
          lastError: "Missing GEMINI_API_KEY.",
          correlationId,
          promptVersionId: resolved.promptVersionId,
          isFallback: resolved.isFallback,
          briefHash: fp,
          rowVersion: 1,
        });
        if (failed) await d.notify(failed);
        await logKitFailure(d.db, {
          kitId: pending.id,
          phase: "generate",
          errorCode,
          errorMessage: "Missing GEMINI_API_KEY.",
          correlationId,
          modelUsed: settings.model,
          meta: { promptMode: resolved.promptMode, industrySource: resolved.industrySource, parentPhase: "enqueue" },
        });
        await finalizeIdempotencyKey(d.db, { keyHash, briefHash: fp, kitId: pending.id });
        return;
      }

      const { aiContent, usage: primaryUsage } = await generateWithGuardrails(
        resolved.renderedPrompt,
        snapshot,
        settings,
        referenceImage,
        { callAPI: d.callGemini }
      );
      let usage = primaryUsage;
      if (shouldRunContentPackageChain(snapshot)) {
        const pkgResult = await runContentPackageChain(snapshot, settings, referenceImage, { callAPI: d.callGemini });
        (aiContent as Record<string, unknown>)[CONTENT_IDEAS_PACKAGE_KEY] =
          pkgResult.data as unknown as Record<string, unknown>;
        usage = addUsageTotals(usage, pkgResult.usage);
      }

      const emailResult = await d.sendKit(snapshot, aiContent);
      const done = await updateKit(d.db, pending.id, snapshot, aiContent, {
        deliveryStatus: resolveDeliveryStatus(emailResult),
        modelUsed: settings.model,
        lastError: emailResult.error || "",
        correlationId,
        promptVersionId: resolved.promptVersionId,
        isFallback: resolved.isFallback,
        briefHash: fp,
        rowVersion: 1,
        tokenUsage: usage,
      });
      if (done) {
        await d.notify(done);
        await consumeGeneratedAssetsOnceForKit(d.db, done.id, owner, generatedAssetsUsageFromContent(aiContent));
      }
      await finalizeIdempotencyKey(d.db, { keyHash, briefHash: fp, kitId: pending.id });
    } catch (error) {
      const reason = safeClientError(error);
      const errorCode = toFailureCode(error, "GENERATION_FAILED");
      const failed = await updateKit(d.db, pending.id, snapshot, null, {
        deliveryStatus: "failed_generation",
        modelUsed: settings.model,
        lastError: reason,
        correlationId,
        promptVersionId: resolved.promptVersionId,
        isFallback: resolved.isFallback,
        briefHash: fp,
        rowVersion: 1,
      });
      if (failed) await d.notify(failed);
      await logKitFailure(d.db, {
        kitId: pending.id,
        phase: "generate",
        errorCode,
        errorMessage: reason,
        correlationId,
        modelUsed: settings.model,
      });
      await finalizeIdempotencyKey(d.db, { keyHash, briefHash: fp, kitId: pending.id });
    }
  })().catch((error) => {
    console.warn("[agency_background_generation_unhandled]", String(error));
  });

  return {
    status: 202 as const,
    body: serializeKit(pending),
  };
}

export async function retryKitService(input: {
  id: string;
  brief_json: string;
  row_version: number;
  owner: { deviceId: string; userId?: string | null };
}, deps?: KitGenerationDependencies) {
  const d = withDeps(deps);
  const id = input.id;
  const row = (await d.db.select().from(kits).where(eq(kits.id, id)).limit(1))[0];
  if (!row) throw new HttpError(404, "Not found");
  const rowOwnerMatches = input.owner.userId
    ? row.userId === input.owner.userId
    : row.deviceId === input.owner.deviceId;
  if (!rowOwnerMatches) throw new HttpError(404, "Not found");
  const owner = { deviceId: row.deviceId, userId: row.userId ?? null };
  const access = await resolveAccessContext(d.db, owner);
  enforceRetryEntitlements(access);
  if (normalizeDeliveryStatus(row.deliveryStatus) !== "failed_generation") throw new HttpError(400, "Only failed_generation kits can be retried.");
  if (row.rowVersion !== input.row_version) throw new HttpError(409, "row_version mismatch; refresh and try again.");

  let snapshot: ReturnType<typeof buildSubmissionSnapshot>;
  try {
    snapshot = parseSubmissionSnapshotJson(input.brief_json);
  } catch (e) {
    throw new HttpError(400, String(e));
  }
  const settings = loadGeminiSettingsFromEnv();
  const correlationId = nanoid();
  const nextVersion = row.rowVersion + 1;
  const bv = await fetchBrandVoiceContext(d.db, row.userId);
  const latestSuccessfulKit = await getLatestSuccessfulKitForOwner(d.db, owner);
  const historicalContext = buildHistoricalContextFromResultJson(latestSuccessfulKit?.resultJson ?? null);
  const resolved = await resolvePrompt(snapshot.industry, snapshot, bv, {
    historicalContext,
  });
  const referenceImage = parseReferenceImageFromDataUrl(snapshot.reference_image);
  const demoMode = String(process.env.DEMO_MODE ?? "").toLowerCase() === "true";

  const setRetry = await updateKit(d.db, id, snapshot, null, {
    deliveryStatus: "retry_in_progress",
    modelUsed: settings.model,
    lastError: "",
    correlationId,
    promptVersionId: resolved.promptVersionId,
    isFallback: resolved.isFallback,
    rowVersion: nextVersion,
  });
  if (!setRetry) throw new HttpError(409, "Concurrent update; refresh and try again.");

  if (demoMode) {
    const aiContent = buildDemoKitContent(snapshot) as Record<string, unknown>;
    if (shouldRunContentPackageChain(snapshot)) {
      aiContent[CONTENT_IDEAS_PACKAGE_KEY] = buildDemoContentIdeasPackage(snapshot.content_package_idea_count);
    }
    const emailResult = await d.sendKit(snapshot, aiContent);
    const done = (await d.db.update(kits).set({
      resultJson: JSON.stringify(aiContent),
      deliveryStatus: resolveDeliveryStatus(emailResult),
      lastError: emailResult.error || "",
      correlationId,
      promptVersionId: resolved.promptVersionId,
      isFallback: resolved.isFallback,
      rowVersion: nextVersion + 1,
      updatedAt: new Date(),
    }).where(and(eq(kits.id, id), eq(kits.rowVersion, nextVersion))).returning())[0];
    if (!done) throw new HttpError(409, "Concurrent update; refresh and try again.");
    await d.notify(done);
    await consumeUsage(d.db, owner, "retry");
    return { status: 200, body: serializeKit(done) };
  }

  if (!settings.apiKey) {
    const errorCode = "API_KEY_MISSING" as const;
    const fr = (await d.db.update(kits).set({
      deliveryStatus: "failed_generation",
      lastError: "Missing GEMINI_API_KEY.",
      correlationId,
      promptVersionId: resolved.promptVersionId,
      isFallback: resolved.isFallback,
      rowVersion: nextVersion + 1,
      updatedAt: new Date(),
    }).where(and(eq(kits.id, id), eq(kits.rowVersion, nextVersion))).returning())[0];
    if (!fr) throw new HttpError(409, "Concurrent update; refresh and try again.");
    await logKitFailure(d.db, {
      kitId: id,
      phase: "retry",
      errorCode,
      errorMessage: "Missing GEMINI_API_KEY.",
      correlationId,
      modelUsed: settings.model,
      meta: { promptMode: resolved.promptMode, industrySource: resolved.industrySource, parentPhase: "retry" },
    });
    await d.notify(fr);
    return { status: 200, body: serializeKit(fr) };
  }

  try {
    const { aiContent, jsonValid, retryCount, usage: primaryUsage } = await generateWithGuardrails(
      resolved.renderedPrompt,
      snapshot,
      settings,
      referenceImage,
      { callAPI: d.callGemini }
    );
    let usage = primaryUsage;
    if (shouldRunContentPackageChain(snapshot)) {
      const pkgResult = await runContentPackageChain(snapshot, settings, referenceImage, { callAPI: d.callGemini });
      (aiContent as Record<string, unknown>)[CONTENT_IDEAS_PACKAGE_KEY] =
        pkgResult.data as unknown as Record<string, unknown>;
      usage = addUsageTotals(usage, pkgResult.usage);
    }
    const emailResult = await d.sendKit(snapshot, aiContent);
    const ok = (await d.db.update(kits).set({
      briefJson: JSON.stringify({ ...snapshot, submitted_at: snapshot.submitted_at.toISOString() }),
      resultJson: JSON.stringify(aiContent),
      deliveryStatus: resolveDeliveryStatus(emailResult),
      lastError: emailResult.error || "",
      correlationId,
      promptVersionId: resolved.promptVersionId,
      isFallback: resolved.isFallback,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      rowVersion: nextVersion + 1,
      updatedAt: new Date(),
    }).where(and(eq(kits.id, id), eq(kits.rowVersion, nextVersion))).returning())[0];
    if (!ok) throw new HttpError(409, "Concurrent update; refresh and try again.");
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
    await d.notify(ok);
    await consumeUsage(d.db, owner, "retry");
    return { status: 200, body: serializeKit(ok) };
  } catch (err) {
    const reason = safeClientError(err, "Retry generation failed. Please retry.");
    const errorCode = toFailureCode(
      err,
      isContentPackageChainFailureMessage(reason) ? "CONTENT_PACKAGE_CHAIN_FAILED" : "RETRY_FAILED"
    );
    const clientDelay = await d.sendClientDelay(snapshot, correlationId);
    await d.sendAdminAlert(snapshot, reason, correlationId, id, settings.model, clientDelay);
    const fr = (await d.db.update(kits).set({
      deliveryStatus: "failed_generation",
      lastError: reason,
      correlationId,
      promptVersionId: resolved.promptVersionId,
      isFallback: resolved.isFallback,
      rowVersion: nextVersion + 1,
      updatedAt: new Date(),
    }).where(and(eq(kits.id, id), eq(kits.rowVersion, nextVersion))).returning())[0];
    if (!fr) throw new HttpError(409, "Concurrent update; refresh and try again.");
    await logKitFailure(d.db, {
      kitId: id,
      phase: isContentPackageChainFailureMessage(reason) ? "content_package_chain" : "retry",
      errorCode,
      errorMessage: reason,
      correlationId,
      modelUsed: settings.model,
      meta: { promptMode: resolved.promptMode, industrySource: resolved.industrySource, parentPhase: "retry" },
    });
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
    await d.notify(fr);
    return { status: 200, body: serializeKit(fr) };
  }
}

export async function regenerateKitItemService(input: {
  id: string;
  item_type: RegenerateItemType;
  index: number;
  row_version: number;
  feedback?: string;
  owner: { deviceId: string; userId?: string | null };
}, deps?: KitGenerationDependencies) {
  const d = withDeps(deps);
  const row = (await d.db.select().from(kits).where(eq(kits.id, input.id)).limit(1))[0];
  if (!row) throw new HttpError(404, "Not found");
  const rowOwnerMatches = input.owner.userId
    ? row.userId === input.owner.userId
    : row.deviceId === input.owner.deviceId;
  if (!rowOwnerMatches) throw new HttpError(404, "Not found");
  const owner = { deviceId: row.deviceId, userId: row.userId ?? null };
  const access = await resolveAccessContext(d.db, owner);
  enforceRegenerateEntitlements(access);
  if (row.rowVersion !== input.row_version) throw new HttpError(409, "row_version mismatch; refresh and try again.");
  if (!row.resultJson) throw new HttpError(422, "Kit has no generated content to regenerate.");

  let snapshot: ReturnType<typeof buildSubmissionSnapshot>;
  try {
    snapshot = parseSubmissionSnapshotJson(row.briefJson);
  } catch (e) {
    throw new HttpError(400, String(e));
  }
  const referenceImage = parseReferenceImageFromDataUrl(snapshot.reference_image);

  let resultObj: Record<string, unknown>;
  try {
    const parsed = JSON.parse(row.resultJson);
    if (!isPlainObject(parsed)) throw new Error("invalid");
    resultObj = parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(422, "Existing result_json is invalid JSON.");
  }
  const section = getSectionArray(resultObj, input.item_type);
  if (!section) throw new HttpError(422, `No ${input.item_type} section found in kit.`);
  if (input.index >= section.items.length) throw new HttpError(422, `Index out of range. max=${section.items.length - 1}`);

  const settings = loadGeminiSettingsFromEnv();
  if (!settings.apiKey) throw new HttpError(500, "Missing GEMINI_API_KEY.");
  const correlationId = nanoid();
  const bv = await fetchBrandVoiceContext(d.db, row.userId);
  const resolved = await resolvePrompt(snapshot.industry, snapshot, bv);
  const schema = getRegenerateItemSchema(input.item_type);
  const feedbackLine = input.feedback?.trim()
    ? `User feedback (must be applied): ${input.feedback.trim()}`
    : "User feedback: none provided.";
  const promptText = [
    "You are regenerating exactly ONE item inside an existing content kit.",
    "Return JSON with shape: {\"item\": { ... }} matching the provided schema exactly.",
    "Do not return arrays, wrappers, markdown, or extra keys.",
    `Target item type: ${input.item_type}`,
    `Target section key: ${section.key}`,
    `Target index: ${input.index}`,
    feedbackLine,
    "",
    "Original full creative context:",
    resolved.renderedPrompt,
    referenceImage && input.item_type === "image"
      ? `CRITICAL: A reference image is attached. The regenerated item's \`full_ai_image_prompt\` MUST begin with exactly: ${REFERENCE_IMAGE_PROMPT_PREFIX} After that prefix, describe only environment, lighting, camera, composition, and interaction—do not verbally redescribe the product or logo that appears in the attachment.`
      : referenceImage
        ? "A visual reference image is attached for this request. Use brief and product facts for copy; do not invent product attributes beyond the brief."
        : "No visual reference image is attached for this request.",
    "",
    "Current item to replace:",
    JSON.stringify(section.items[input.index], null, 2),
  ].join("\n");

  let generated: unknown;
  let regenerateUsage: GenerationUsageTotals = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  try {
    const response = await d.callGemini(promptText, settings, schema, referenceImage);
    generated = response.json;
    regenerateUsage = {
      promptTokens: response.usage?.promptTokenCount ?? 0,
      completionTokens: response.usage?.candidatesTokenCount ?? 0,
      totalTokens: response.usage?.totalTokenCount ?? 0,
    };
  } catch (e) {
    const errorCode = toFailureCode(e, "REGENERATE_CALL_FAILED");
    await logKitFailure(d.db, {
      kitId: input.id,
      phase: "regenerate",
      errorCode,
      errorMessage: String(e),
      correlationId,
      modelUsed: settings.model,
      meta: { item_type: input.item_type, index: input.index },
    });
    throw new HttpError(502, `Regenerate failed: ${String(e)}`);
  }
  if (!isPlainObject(generated) || !("item" in generated) || !isPlainObject(generated.item)) {
    throw new HttpError(502, "Model returned invalid regenerate payload.");
  }

  const merged = { ...resultObj } as Record<string, unknown>;
  const updatedItems = [...section.items];
  updatedItems[input.index] = generated.item as Record<string, unknown>;
  merged[section.key] = updatedItems;
  const updated = await d.db
    .update(kits)
    .set({
      resultJson: JSON.stringify(merged),
      correlationId,
      modelUsed: settings.model,
      lastError: "",
      promptTokens: regenerateUsage.promptTokens,
      completionTokens: regenerateUsage.completionTokens,
      totalTokens: regenerateUsage.totalTokens,
      rowVersion: row.rowVersion + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(kits.id, input.id), eq(kits.rowVersion, input.row_version)))
    .returning();
  if (!updated.length) throw new HttpError(409, "Concurrent update; refresh and try again.");
  await consumeUsage(d.db, owner, "regenerate");
  return { status: 200, body: serializeKit(updated[0]!) };
}

export async function listKitsService(
  owner?: { deviceId: string; userId?: string | null },
  opts?: { includeUsage?: boolean }
) {
  if (!owner) {
    const d = withDeps();
    const rows = await listAllKits(d.db, opts);
    if (!opts?.includeUsage || !rows.length) return rows;
    const failureMap = await getLatestFailuresForKits(
      d.db,
      rows.map((row: { id: string }) => row.id)
    );
    return rows.map((row: any) => ({
      ...row,
      ...(row.delivery_status === "failed_generation" && failureMap[row.id]
        ? { failure_reason: toSafeFailureReason(failureMap[row.id]!) }
        : {}),
    }));
  }
  return listKits(withDeps().db, owner, opts);
}

export async function getKitByIdService(
  id: string,
  owner?: { deviceId: string; userId?: string | null },
  opts?: { includeUsage?: boolean }
) {
  const d = withDeps();
  const row = owner ? await getKitById(d.db, id, owner) : await getKitByIdAny(d.db, id);
  if (!row) throw new HttpError(404, "Not found");
  if (!owner && opts?.includeUsage) {
    const failure = await getLatestFailureForKit(d.db, id);
    return serializeKit(row, {
      ...opts,
      failureReason: row.deliveryStatus === "failed_generation" && failure ? toSafeFailureReason(failure) : null,
    });
  }
  return serializeKit(row, opts);
}

export async function patchKitUiPreferencesService(input: {
  id: string;
  owner: { deviceId: string; userId?: string | null };
  uiPreferences: Record<string, unknown>;
}) {
  const updated = await patchKitUiPreferences(withDeps().db, input.id, input.owner, input.uiPreferences);
  if (!updated) throw new HttpError(404, "Not found");
  return { status: 200 as const, body: serializeKit(updated) };
}

export async function deleteKitService(input: {
  id: string;
  actorType: "admin_session" | "admin_user";
  actorId: string;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  const d = withDeps();
  const deletedId = await d.db.transaction(async (tx) =>
    deleteKitByIdWithAudit(tx, {
      id: input.id,
      actorType: input.actorType,
      actorId: input.actorId,
      reason: input.reason,
      metadata: input.metadata,
    })
  );
  if (!deletedId) throw new HttpError(404, "Not found");
  return { status: 200 as const, body: { ok: true, id: deletedId } };
}
