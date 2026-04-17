import { Hono } from "hono";
import { z } from "zod";
import type { Next } from "hono";
import {
  generateKitService,
  getKitByIdService,
  listKitsService,
  regenerateKitItemService,
  retryKitService,
} from "../services/kitGenerationService.js";
import { respondHttpError } from "./httpErrorMapping.js";
import { getAuthUser } from "../middleware/userAuth.js";
import { ensureUserFromSupabase } from "../services/subscriptionService.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const deviceIdSchema = z.string().uuid();

const generateBodySchema = z
  .object({
    submitted_at: z.union([z.string(), z.number()]).optional(),
    email: z.string().optional(),
    brand_name: z.string().optional().default(""),
    industry: z.string().optional().default(""),
    target_audience: z.union([z.string(), z.array(z.string())]).optional().default([]),
    diagnostic_role: z.string().optional().default(""),
    diagnostic_account_stage: z.string().optional().default(""),
    diagnostic_followers_band: z.string().optional().default(""),
    diagnostic_primary_blocker: z.string().optional().default(""),
    diagnostic_revenue_goal: z.string().optional().default(""),
    main_goal: z.string().optional().default(""),
    platforms: z.union([z.string(), z.array(z.string())]).optional().default([]),
    brand_tone: z.string().optional().default(""),
    brand_colors: z.string().optional().default(""),
    offer: z.string().optional().default(""),
    competitors: z.string().optional().default(""),
    visual_notes: z.string().optional().default(""),
    reference_image: z.string().optional().default(""),
    campaign_duration: z.string().optional().default(""),
    budget_level: z.string().optional().default(""),
    best_content_types: z.union([z.string(), z.array(z.string())]).optional().default([]),
    num_posts: z.number().optional(),
    num_image_designs: z.number().optional(),
    num_video_prompts: z.number().optional(),
    campaign_mode: z.enum(["social", "offer", "deep"]).optional(),
    include_content_package: z.boolean().optional(),
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

function requireDeviceId(c: import("hono").Context): { ok: true; deviceId: string } | { ok: false; response: Response } {
  const raw = c.req.header("X-Device-ID")?.trim() ?? "";
  const parsed = deviceIdSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: c.json({ error: "Missing or invalid X-Device-ID header." }, 400),
    };
  }
  return { ok: true, deviceId: parsed.data };
}

async function resolveOwner(c: import("hono").Context) {
  const device = requireDeviceId(c);
  if (!device.ok) return device;
  const authUser = getAuthUser(c);
  if (!authUser) return { ok: true as const, owner: { deviceId: device.deviceId, userId: null as string | null } };
  const user = await ensureUserFromSupabase(db, authUser);
  return { ok: true as const, owner: { deviceId: device.deviceId, userId: user.id } };
}

async function requireAdminAccess(c: import("hono").Context): Promise<Response | null> {
  const authUser = getAuthUser(c);
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const current = (
    await db
      .select({
        id: users.id,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.supabaseUserId, authUser.supabaseUserId))
      .limit(1)
  )[0];
  if (!current?.isAdmin) return c.json({ error: "Admin access required." }, 403);
  return null;
}

export function createKitsRouter(mw: (c: import("hono").Context, next: Next) => Promise<void | Response>) {
  const app = new Hono();

  app.use("/api/kits/*", mw);

  app.post("/api/kits/generate", async (c) => {
    const ownerRes = await resolveOwner(c);
    if (!ownerRes.ok) return ownerRes.response;

    let body: z.infer<typeof generateBodySchema>;
    try {
      body = generateBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid JSON body." }, 400);
    }

    try {
      const result = await generateKitService({
        idempotencyKey: c.req.header("Idempotency-Key")?.trim() || "",
        body: body as Record<string, unknown>,
        deviceId: ownerRes.owner.deviceId,
        userId: ownerRes.owner.userId,
      });
      return c.json(result.body, result.status as 200 | 201);
    } catch (err) {
      return respondHttpError(c, err, "Unexpected error while generating kit.");
    }
  });

  app.get("/api/kits", async (c) => {
    const scopeAll = c.req.query("scope") === "all";
    if (scopeAll) {
      const blocked = await requireAdminAccess(c);
      if (blocked) return blocked;
      return c.json(await listKitsService(undefined, { includeUsage: true }));
    }
    const ownerRes = await resolveOwner(c);
    if (!ownerRes.ok) return ownerRes.response;
    return c.json(await listKitsService(ownerRes.owner, { includeUsage: false }));
  });

  app.get("/api/kits/:id", async (c) => {
    const scopeAll = c.req.query("scope") === "all";
    let owner: { deviceId: string; userId?: string | null } | undefined;
    if (!scopeAll) {
      const ownerRes = await resolveOwner(c);
      if (!ownerRes.ok) return ownerRes.response;
      owner = ownerRes.owner;
    } else {
      const blocked = await requireAdminAccess(c);
      if (blocked) return blocked;
    }
    try {
      return c.json(await getKitByIdService(c.req.param("id"), owner, { includeUsage: scopeAll }));
    } catch (err) {
      return respondHttpError(c, err, "Unexpected error while loading kit.");
    }
  });

  app.post("/api/kits/:id/retry", async (c) => {
    const ownerRes = await resolveOwner(c);
    if (!ownerRes.ok) return ownerRes.response;
    let body: z.infer<typeof retryBodySchema>;
    try {
      body = retryBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body: brief_json and row_version required." }, 400);
    }

    try {
      const result = await retryKitService({
        id: c.req.param("id"),
        brief_json: body.brief_json,
        row_version: body.row_version,
        owner: ownerRes.owner,
      });
      return c.json(result.body, result.status as 200);
    } catch (err) {
      return respondHttpError(c, err, "Unexpected error while retrying kit.");
    }
  });

  app.post("/api/kits/:id/regenerate-item", async (c) => {
    const ownerRes = await resolveOwner(c);
    if (!ownerRes.ok) return ownerRes.response;
    const id = c.req.param("id");
    let body: z.infer<typeof regenerateItemBodySchema>;
    try {
      body = regenerateItemBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body: item_type, index, row_version required." }, 400);
    }

    try {
      const result = await regenerateKitItemService({
        id,
        item_type: body.item_type as RegenerateItemType,
        index: body.index,
        row_version: body.row_version,
        feedback: body.feedback,
        owner: ownerRes.owner,
      });
      return c.json(result.body, result.status as 200);
    } catch (err) {
      return respondHttpError(c, err, "Unexpected error while regenerating item.");
    }
  });

  return app;
}
