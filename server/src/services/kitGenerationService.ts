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
import { resolvePrompt } from "../logic/promptResolver.js";
import { normalizeDeliveryStatus } from "../logic/status.js";
import { generateWithGuardrails } from "./aiGenerationProvider.js";
import { runContentPackageChain } from "./contentPackageOrchestrator.js";
import { parseReferenceImageFromDataUrl } from "./imageProcessor.js";
import {
  consumeGeneratedAssets,
  consumeUsage,
  enforceGenerateEntitlements,
  enforceRegenerateEntitlements,
  enforceRetryEntitlements,
  resolveAccessContext,
} from "./subscriptionService.js";
import {
  finalizeIdempotencyKey,
  hashIdempotencyKey,
  IDEMPOTENCY_PENDING_KIT,
  pruneExpiredIdempotency,
  reserveIdempotencyKey,
} from "./idempotencyService.js";
import { getKitById, getKitByIdAny, listAllKits, listKits, persistKit, serializeKit, updateKit } from "./kitRepository.js";
import {
  getRegenerateItemSchema,
  getSectionArray,
  type RegenerateItemType,
} from "./kitGenerationDomain.js";
import { logKitFailure } from "./kitFailureLogRepository.js";
import { HttpError, safeClientError } from "./serviceErrors.js";
export { getRegenerateItemSchema, getSectionArray } from "./kitGenerationDomain.js";
export { HttpError } from "./serviceErrors.js";

export type KitGenerationDependencies = {
  db?: typeof db;
  callGemini?: typeof callGeminiAPI;
  sendKit?: typeof sendKitEmail;
  sendClientDelay?: typeof sendClientDelayEmail;
  sendAdminAlert?: typeof sendAdminFailureAlert;
  notify?: typeof recordKitNotification;
};

function withDeps(deps?: KitGenerationDependencies) {
  return {
    db: deps?.db ?? db,
    callGemini: deps?.callGemini ?? callGeminiAPI,
    sendKit: deps?.sendKit ?? sendKitEmail,
    sendClientDelay: deps?.sendClientDelay ?? sendClientDelayEmail,
    sendAdminAlert: deps?.sendAdminAlert ?? sendAdminFailureAlert,
    notify: deps?.notify ?? recordKitNotification,
  };
}

function isContentPackageChainFailureMessage(message: string): boolean {
  return message.includes("content_package_chain");
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
}) {
  return persistKit(params.db, params.snapshot, null, params.owner, {
    deliveryStatus: "failed_generation",
    modelUsed: params.settingsModel,
    lastError: params.reason,
    correlationId: params.correlationId,
    promptVersionId: params.promptVersionId,
    isFallback: params.isFallback,
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
  const resolved = await resolvePrompt(snapshot.industry, snapshot);

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
    });
    await d.notify(row);
    await consumeGeneratedAssets(d.db, owner, {
      videoPromptsUsed: Array.isArray((aiContent as Record<string, unknown>).video_prompts)
        ? ((aiContent as Record<string, unknown>).video_prompts as unknown[]).length
        : 0,
      imagePromptsUsed: Array.isArray((aiContent as Record<string, unknown>).image_designs)
        ? ((aiContent as Record<string, unknown>).image_designs as unknown[]).length
        : 0,
    });
    await finalizeIdempotencyKey(d.db, { keyHash, briefHash: fp, kitId: row.id });
    return { status: 200, body: serializeKit(row) };
  }

  if (!settings.apiKey) {
    const row = await persistGenerationFailure({
      db: d.db,
      snapshot,
      owner,
      settingsModel: settings.model,
      reason: "Missing GEMINI_API_KEY.",
      correlationId,
      promptVersionId: resolved.promptVersionId,
      isFallback: resolved.isFallback,
    });
    await d.notify(row);
    await finalizeIdempotencyKey(d.db, { keyHash, briefHash: fp, kitId: row.id });
    return { status: 201, body: serializeKit(row) };
  }

  try {
    const { aiContent, jsonValid, retryCount } = await generateWithGuardrails(
      resolved.renderedPrompt,
      snapshot,
      settings,
      referenceImage,
      { callAPI: d.callGemini }
    );
    if (shouldRunContentPackageChain(snapshot)) {
      const pkg = await runContentPackageChain(snapshot, settings, referenceImage, { callAPI: d.callGemini });
      (aiContent as Record<string, unknown>)[CONTENT_IDEAS_PACKAGE_KEY] = pkg as unknown as Record<string, unknown>;
    }
    const emailResult = await d.sendKit(snapshot, aiContent);
    const row = await persistKit(d.db, snapshot, aiContent, owner, {
      deliveryStatus: resolveDeliveryStatus(emailResult),
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
    await d.notify(row);
    await consumeGeneratedAssets(d.db, owner, {
      videoPromptsUsed: Array.isArray((aiContent as Record<string, unknown>).video_prompts)
        ? ((aiContent as Record<string, unknown>).video_prompts as unknown[]).length
        : 0,
      imagePromptsUsed: Array.isArray((aiContent as Record<string, unknown>).image_designs)
        ? ((aiContent as Record<string, unknown>).image_designs as unknown[]).length
        : 0,
    });
    await finalizeIdempotencyKey(d.db, { keyHash, briefHash: fp, kitId: row.id });
    return { status: 201, body: serializeKit(row) };
  } catch (err) {
    const reason = safeClientError(err);
    const row = await persistGenerationFailure({
      db: d.db,
      snapshot,
      owner,
      settingsModel: settings.model,
      reason,
      correlationId,
      promptVersionId: resolved.promptVersionId,
      isFallback: resolved.isFallback,
    });
    await logKitFailure(d.db, {
      kitId: row.id,
      phase: isContentPackageChainFailureMessage(reason) ? "content_package_chain" : "generate",
      errorCode: isContentPackageChainFailureMessage(reason) ? "CONTENT_PACKAGE_CHAIN_FAILED" : "GENERATION_FAILED",
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
  const resolved = await resolvePrompt(snapshot.industry, snapshot);
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
    await d.notify(fr);
    return { status: 200, body: serializeKit(fr) };
  }

  try {
    const { aiContent, jsonValid, retryCount } = await generateWithGuardrails(
      resolved.renderedPrompt,
      snapshot,
      settings,
      referenceImage,
      { callAPI: d.callGemini }
    );
    if (shouldRunContentPackageChain(snapshot)) {
      const pkg = await runContentPackageChain(snapshot, settings, referenceImage, { callAPI: d.callGemini });
      (aiContent as Record<string, unknown>)[CONTENT_IDEAS_PACKAGE_KEY] = pkg as unknown as Record<string, unknown>;
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
      errorCode: isContentPackageChainFailureMessage(reason) ? "CONTENT_PACKAGE_CHAIN_FAILED" : "RETRY_FAILED",
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
  const resolved = await resolvePrompt(snapshot.industry, snapshot);
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
    referenceImage
      ? "A visual reference image is attached for this request. Preserve its visual style and color direction in the regenerated item."
      : "No visual reference image is attached for this request.",
    "",
    "Current item to replace:",
    JSON.stringify(section.items[input.index], null, 2),
  ].join("\n");

  let generated: unknown;
  try {
    generated = await d.callGemini(promptText, settings, schema, referenceImage);
  } catch (e) {
    await logKitFailure(d.db, {
      kitId: input.id,
      phase: "regenerate",
      errorCode: "REGENERATE_CALL_FAILED",
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
      rowVersion: row.rowVersion + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(kits.id, input.id), eq(kits.rowVersion, input.row_version)))
    .returning();
  if (!updated.length) throw new HttpError(409, "Concurrent update; refresh and try again.");
  await consumeUsage(d.db, owner, "regenerate");
  return { status: 200, body: serializeKit(updated[0]!) };
}

export async function listKitsService(owner?: { deviceId: string; userId?: string | null }) {
  if (!owner) return listAllKits(withDeps().db);
  return listKits(withDeps().db, owner);
}

export async function getKitByIdService(id: string, owner?: { deviceId: string; userId?: string | null }) {
  const row = owner ? await getKitById(withDeps().db, id, owner) : await getKitByIdAny(withDeps().db, id);
  if (!row) throw new HttpError(404, "Not found");
  return serializeKit(row);
}
