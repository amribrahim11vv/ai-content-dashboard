import { createHash } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { idempotencyKeys } from "../db/schema.js";

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
export const IDEMPOTENCY_PENDING_KIT = "__pending__";

export function hashIdempotencyKey(key: string): string {
  return createHash("sha256").update(String(key).trim(), "utf8").digest("hex");
}

export async function pruneExpiredIdempotency(db: any) {
  const now = Date.now();
  await db.delete(idempotencyKeys).where(lt(idempotencyKeys.expiresAt, now));
}

export async function reserveIdempotencyKey(db: any, params: { keyHash: string; briefHash: string }) {
  const inserted = await db
    .insert(idempotencyKeys)
    .values({
      keyHash: params.keyHash,
      briefHash: params.briefHash,
      kitId: IDEMPOTENCY_PENDING_KIT,
      expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
    })
    .onConflictDoNothing({ target: idempotencyKeys.keyHash })
    .returning();
  return inserted[0] ?? null;
}

export async function finalizeIdempotencyKey(
  db: any,
  params: { keyHash: string; briefHash: string; kitId: string }
) {
  await db
    .update(idempotencyKeys)
    .set({
      kitId: params.kitId,
      expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
    })
    .where(and(eq(idempotencyKeys.keyHash, params.keyHash), eq(idempotencyKeys.briefHash, params.briefHash)));
}
