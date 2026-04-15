import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { AuthUserClaims } from "../middleware/userAuth.js";
import {
  kits,
  monthlyUsageCounters,
  planSubscriptions,
  userDevices,
  users,
} from "../db/schema.js";
import { HttpError } from "./serviceErrors.js";
import type { db as dbType } from "../db/index.js";
import type { CampaignMode } from "../logic/campaignMode.js";

export type PlanCode = "starter" | "early_adopter" | "admin_unlimited";
export type UsageKind = "retry" | "regenerate";

type PlanSpec = {
  code: PlanCode;
  monthlyVideoPrompts: number | null;
  monthlyImagePrompts: number | null;
  monthlyRetry: number | null;
  monthlyRegenerate: number | null;
  allowReferenceImage: boolean;
  allowedCampaignModes: CampaignMode[];
};

export const PLAN_SPECS: Record<PlanCode, PlanSpec> = {
  starter: {
    code: "starter",
    monthlyVideoPrompts: 1,
    monthlyImagePrompts: 2,
    monthlyRetry: 0,
    monthlyRegenerate: 0,
    allowReferenceImage: false,
    allowedCampaignModes: ["social"],
  },
  early_adopter: {
    code: "early_adopter",
    monthlyVideoPrompts: 5,
    monthlyImagePrompts: 15,
    monthlyRetry: null,
    monthlyRegenerate: null,
    allowReferenceImage: true,
    allowedCampaignModes: ["social", "offer", "deep"],
  },
  admin_unlimited: {
    code: "admin_unlimited",
    monthlyVideoPrompts: null,
    monthlyImagePrompts: null,
    monthlyRetry: null,
    monthlyRegenerate: null,
    allowReferenceImage: true,
    allowedCampaignModes: ["social", "offer", "deep"],
  },
};

export type AccessContext = {
  userId: string | null;
  deviceId: string;
  planCode: PlanCode;
  usage: {
    periodKey: string;
    videoPromptsUsed: number;
    imagePromptsUsed: number;
    retryUsed: number;
    regenerateUsed: number;
  };
};

export function normalizePlanCode(value: string): PlanCode {
  const v = value.trim().toLowerCase();
  if (v === "admin_unlimited" || v === "admin") return "admin_unlimited";
  if (v === "early_adopter" || v === "early-adopter" || v === "paid_beta" || v === "pro" || v === "creator" || v === "creator_pro" || v === "agency") return "early_adopter";
  return "starter";
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function shouldBootstrapAdmin(userEmail: string): boolean {
  const bootstrapEmail = normalizeEmail(String(process.env.SUPER_ADMIN_EMAIL ?? ""));
  return Boolean(bootstrapEmail) && normalizeEmail(userEmail) === bootstrapEmail;
}

function periodKeyOf(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function getPlanSpec(planCode: PlanCode): PlanSpec {
  return PLAN_SPECS[planCode];
}

export async function ensureUserFromSupabase(
  db: typeof dbType,
  authUser: AuthUserClaims
): Promise<{ id: string; email: string; displayName: string }> {
  const existing = (
    await db
      .select()
      .from(users)
      .where(eq(users.supabaseUserId, authUser.supabaseUserId))
      .limit(1)
  )[0];
  const now = new Date();
  if (existing) {
    const nextEmail = authUser.email || existing.email;
    const nextName = authUser.displayName || existing.displayName || "User";
    const nextIsAdmin = existing.isAdmin || shouldBootstrapAdmin(nextEmail);
    if (nextEmail !== existing.email || nextName !== existing.displayName || nextIsAdmin !== existing.isAdmin) {
      await db
        .update(users)
        .set({ email: nextEmail, displayName: nextName, isAdmin: nextIsAdmin, updatedAt: now })
        .where(eq(users.id, existing.id));
      return { id: existing.id, email: nextEmail, displayName: nextName };
    }
    return { id: existing.id, email: existing.email, displayName: existing.displayName };
  }
  const id = nanoid();
  await db.insert(users).values({
    id,
    supabaseUserId: authUser.supabaseUserId,
    email: authUser.email || "",
    displayName: authUser.displayName || "User",
    isAdmin: shouldBootstrapAdmin(authUser.email || ""),
    createdAt: now,
    updatedAt: now,
  });
  return { id, email: authUser.email || "", displayName: authUser.displayName || "User" };
}

export async function linkDeviceToUserAndClaimKits(
  db: typeof dbType,
  userId: string,
  deviceId: string
) {
  const now = new Date();
  const existing = (
    await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.deviceId, deviceId))
      .limit(1)
  )[0];
  if (existing) {
    if (existing.userId !== userId) {
      await db
        .update(userDevices)
        .set({ userId, updatedAt: now })
        .where(eq(userDevices.id, existing.id));
    }
  } else {
    await db.insert(userDevices).values({
      id: nanoid(),
      userId,
      deviceId,
      createdAt: now,
      updatedAt: now,
    });
  }
  await db
    .update(kits)
    .set({ userId, updatedAt: now })
    .where(and(eq(kits.deviceId, deviceId), isNull(kits.userId)));
}

async function resolvePlanCode(db: typeof dbType, userId: string | null): Promise<PlanCode> {
  if (!userId) return "starter";
  const now = new Date();
  const row = (
    await db
      .select()
      .from(planSubscriptions)
      .where(
        and(
          eq(planSubscriptions.userId, userId),
          or(eq(planSubscriptions.status, "active"), eq(planSubscriptions.status, "trialing")),
          or(isNull(planSubscriptions.periodEnd), gte(planSubscriptions.periodEnd, now))
        )
      )
      .orderBy(desc(planSubscriptions.updatedAt))
      .limit(1)
  )[0];
  if (!row) return "starter";
  return normalizePlanCode(row.planCode);
}

async function getOrCreateUsage(
  db: typeof dbType,
  owner: { userId: string | null; deviceId: string },
  periodKey: string
) {
  const now = new Date();
  const where = owner.userId
    ? and(eq(monthlyUsageCounters.userId, owner.userId), eq(monthlyUsageCounters.periodKey, periodKey))
    : and(eq(monthlyUsageCounters.deviceId, owner.deviceId), eq(monthlyUsageCounters.periodKey, periodKey));
  let row = (await db.select().from(monthlyUsageCounters).where(where).limit(1))[0];
  if (!row) {
    const id = nanoid();
    await db.insert(monthlyUsageCounters).values({
      id,
      userId: owner.userId,
      deviceId: owner.userId ? null : owner.deviceId,
      periodKey,
      videoPromptsUsed: 0,
      imagePromptsUsed: 0,
      retryUsed: 0,
      regenerateUsed: 0,
      createdAt: now,
      updatedAt: now,
    });
    row = (await db.select().from(monthlyUsageCounters).where(eq(monthlyUsageCounters.id, id)).limit(1))[0];
  }
  if (!row) throw new HttpError(500, "Failed to load usage counter.");
  return row;
}

export async function resolveAccessContext(
  db: typeof dbType,
  owner: { userId: string | null; deviceId: string }
): Promise<AccessContext> {
  const periodKey = periodKeyOf(new Date());
  const planCode = await resolvePlanCode(db, owner.userId);
  const usage = await getOrCreateUsage(db, owner, periodKey);
  return {
    userId: owner.userId,
    deviceId: owner.deviceId,
    planCode,
    usage: {
      periodKey,
      videoPromptsUsed: usage.videoPromptsUsed,
      imagePromptsUsed: usage.imagePromptsUsed,
      retryUsed: usage.retryUsed,
      regenerateUsed: usage.regenerateUsed,
    },
  };
}

function deny(message: string, code: string): never {
  throw new HttpError(402, `${message} [${code}]`);
}

export function enforceGenerateEntitlements(
  access: AccessContext,
  input: { campaignMode: CampaignMode; hasReferenceImage: boolean; requestedVideoPrompts: number; requestedImagePrompts: number }
) {
  const spec = getPlanSpec(access.planCode);
  if (!spec.allowedCampaignModes.includes(input.campaignMode)) {
    deny("This campaign mode requires plan upgrade.", "PLAN_MODE_LOCKED");
  }
  if (input.hasReferenceImage && !spec.allowReferenceImage) {
    deny("Reference image upload is not available on this plan.", "PLAN_REFERENCE_IMAGE_LOCKED");
  }
  if (
    spec.monthlyVideoPrompts !== null &&
    access.usage.videoPromptsUsed + Math.max(0, input.requestedVideoPrompts) > spec.monthlyVideoPrompts
  ) {
    deny("Monthly video prompts limit reached for your plan.", "PLAN_MONTHLY_VIDEO_PROMPTS_EXCEEDED");
  }
  if (
    spec.monthlyImagePrompts !== null &&
    access.usage.imagePromptsUsed + Math.max(0, input.requestedImagePrompts) > spec.monthlyImagePrompts
  ) {
    deny("Monthly image prompts limit reached for your plan.", "PLAN_MONTHLY_IMAGE_PROMPTS_EXCEEDED");
  }
}

export function enforceRetryEntitlements(access: AccessContext) {
  const spec = getPlanSpec(access.planCode);
  if (spec.monthlyRetry !== null && access.usage.retryUsed >= spec.monthlyRetry) {
    deny("Monthly retry limit reached for your plan.", "PLAN_MONTHLY_RETRY_EXCEEDED");
  }
}

export function enforceRegenerateEntitlements(access: AccessContext) {
  const spec = getPlanSpec(access.planCode);
  if (spec.monthlyRegenerate !== null && access.usage.regenerateUsed >= spec.monthlyRegenerate) {
    deny("Monthly regenerate limit reached for your plan.", "PLAN_MONTHLY_REGENERATE_EXCEEDED");
  }
}

export async function consumeUsage(
  db: typeof dbType,
  owner: { userId: string | null; deviceId: string },
  kind: UsageKind
): Promise<void> {
  const periodKey = periodKeyOf(new Date());
  const row = await getOrCreateUsage(db, owner, periodKey);
  const next = {
    videoPromptsUsed: row.videoPromptsUsed,
    imagePromptsUsed: row.imagePromptsUsed,
    retryUsed: row.retryUsed,
    regenerateUsed: row.regenerateUsed,
  };
  if (kind === "retry") next.retryUsed += 1;
  if (kind === "regenerate") next.regenerateUsed += 1;
  await db
    .update(monthlyUsageCounters)
    .set({
      videoPromptsUsed: next.videoPromptsUsed,
      imagePromptsUsed: next.imagePromptsUsed,
      retryUsed: next.retryUsed,
      regenerateUsed: next.regenerateUsed,
      updatedAt: new Date(),
    })
    .where(eq(monthlyUsageCounters.id, row.id));
}

export async function consumeGeneratedAssets(
  db: typeof dbType,
  owner: { userId: string | null; deviceId: string },
  usage: { videoPromptsUsed: number; imagePromptsUsed: number }
): Promise<void> {
  const periodKey = periodKeyOf(new Date());
  const row = await getOrCreateUsage(db, owner, periodKey);
  const nextVideo = row.videoPromptsUsed + Math.max(0, usage.videoPromptsUsed);
  const nextImage = row.imagePromptsUsed + Math.max(0, usage.imagePromptsUsed);
  await db
    .update(monthlyUsageCounters)
    .set({
      videoPromptsUsed: nextVideo,
      imagePromptsUsed: nextImage,
      updatedAt: new Date(),
    })
    .where(eq(monthlyUsageCounters.id, row.id));
}
