import { Hono } from "hono";
import { z } from "zod";
import type { Next } from "hono";
import { db } from "../db/index.js";
import { getAuthUser } from "../middleware/userAuth.js";
import {
  authSyncRateLimit,
  authSyncUserRateLimit,
  authSyncDeviceRateLimit,
} from "../middleware/rateLimit.js";
import {
  ensureUserFromSupabase,
  linkDeviceToUserAndClaimKits,
  resolveAccessContext,
} from "../services/subscriptionService.js";

const deviceSchema = z.string().uuid();

function requireDeviceId(c: import("hono").Context): { ok: true; deviceId: string } | { ok: false; response: Response } {
  const raw = c.req.header("X-Device-ID")?.trim() ?? "";
  const parsed = deviceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: c.json({ error: "Missing or invalid X-Device-ID header." }, 400),
    };
  }
  return { ok: true, deviceId: parsed.data };
}

const syncBodySchema = z.object({
  device_id: z.string().uuid(),
});

export function createAuthRouter(mw: (c: import("hono").Context, next: Next) => Promise<void | Response>) {
  const app = new Hono();
  app.use("/api/auth/*", mw);

  app.get("/api/auth/me", async (c) => {
    const device = requireDeviceId(c);
    if (!device.ok) return device.response;
    const authUser = getAuthUser(c);
    let userId: string | null = null;
    let email = "";
    let displayName = "";
    if (authUser) {
      const user = await ensureUserFromSupabase(db, authUser);
      userId = user.id;
      email = user.email;
      displayName = user.displayName;
    }
    const access = await resolveAccessContext(db, {
      userId,
      deviceId: device.deviceId,
    });
    return c.json({
      authenticated: Boolean(authUser),
      user_id: access.userId,
      email,
      display_name: displayName,
      plan_code: access.planCode,
      usage: {
        period_key: access.usage.periodKey,
        video_prompts_used: access.usage.videoPromptsUsed,
        image_prompts_used: access.usage.imagePromptsUsed,
        retry_used: access.usage.retryUsed,
        regenerate_used: access.usage.regenerateUsed,
      },
    });
  });

  /* ── POST /api/auth/sync ──────────────────────────────────────────
   * Triple-layer rate-limit applied *in addition to* the global
   * guard (mw) so that spam on this endpoint doesn't burn the
   * global budget:
   *   Layer 1 – IP-based        (stops basic flooding)
   *   Layer 2 – User ID-based   (stops IP-rotation attacks)
   *   Layer 3 – Device ID-based (stops multi-account attacks)
   * ---------------------------------------------------------------- */
  app.post(
    "/api/auth/sync",
    async (c, next) => await authSyncRateLimit(c, next),
    async (c, next) => await authSyncUserRateLimit(c, next),
    async (c, next) => await authSyncDeviceRateLimit(c, next),
    async (c) => {
    const authUser = getAuthUser(c);
    if (!authUser) return c.json({ error: "Login required." }, 401);
    let body: z.infer<typeof syncBodySchema>;
    try {
      body = syncBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body: device_id required." }, 400);
    }
    const user = await ensureUserFromSupabase(db, authUser);
    await linkDeviceToUserAndClaimKits(db, user.id, body.device_id);
    const access = await resolveAccessContext(db, {
      userId: user.id,
      deviceId: body.device_id,
    });
    return c.json({
      ok: true,
      user_id: user.id,
      plan_code: access.planCode,
      usage: {
        period_key: access.usage.periodKey,
        video_prompts_used: access.usage.videoPromptsUsed,
        image_prompts_used: access.usage.imagePromptsUsed,
        retry_used: access.usage.retryUsed,
        regenerate_used: access.usage.regenerateUsed,
      },
    });
  });

  return app;
}

