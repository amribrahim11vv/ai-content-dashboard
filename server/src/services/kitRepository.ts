import { and, desc, eq } from "drizzle-orm";
import { kits, type KitRow } from "../db/schema.js";
import { getStatusBadgeLabel, getStatusBadgePalette } from "../logic/status.js";

export function serializeKit(row: KitRow) {
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

export async function persistKit(
  db: any,
  snapshot: any,
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
  const { nanoid } = await import("nanoid");
  const id = nanoid();
  const now = new Date();
  const briefJson = JSON.stringify({ ...snapshot, submitted_at: snapshot.submitted_at.toISOString() });
  const inserted = await db
    .insert(kits)
    .values({
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
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new Error("Failed to read inserted kit");
  return row;
}

export async function updateKit(
  db: any,
  id: string,
  snapshot: any,
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
  const briefJson = JSON.stringify({ ...snapshot, submitted_at: snapshot.submitted_at.toISOString() });
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
  return updated[0] ?? null;
}

export async function listKits(db: any) {
  const rows = await db.select().from(kits).orderBy(desc(kits.createdAt)).limit(200);
  return rows.map(serializeKit);
}

export async function getKitById(db: any, id: string) {
  const row = (await db.select().from(kits).where(eq(kits.id, id)).limit(1))[0];
  if (!row) return null;
  return row;
}
