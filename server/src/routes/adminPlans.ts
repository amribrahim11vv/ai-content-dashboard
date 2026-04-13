import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { planSubscriptions, users } from "../db/schema.js";

const bodySchema = z.object({
  plan_code: z.enum(["free", "creator_pro", "agency"]),
  status: z.enum(["active", "trialing", "cancelled", "expired"]).default("active"),
  period_start: z.string().optional(),
  period_end: z.string().nullable().optional(),
});

function requireApiSecret(c: import("hono").Context): Response | null {
  const auth = c.req.header("authorization") ?? "";
  const secret = String(process.env.API_SECRET ?? "").trim();
  if (!secret) return c.json({ error: "API_SECRET is not configured." }, 503);
  if (auth !== `Bearer ${secret}`) return c.json({ error: "Unauthorized" }, 401);
  return null;
}

export function createAdminPlansRouter() {
  const app = new Hono();

  app.get("/api/admin/plans/:userId", async (c) => {
    const blocked = requireApiSecret(c);
    if (blocked) return blocked;
    const userId = c.req.param("userId");
    const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!user) return c.json({ error: "User not found." }, 404);
    const rows = await db
      .select()
      .from(planSubscriptions)
      .where(eq(planSubscriptions.userId, userId))
      .orderBy(desc(planSubscriptions.updatedAt))
      .limit(20);
    return c.json({
      user: {
        id: user.id,
        supabase_user_id: user.supabaseUserId,
        email: user.email,
        display_name: user.displayName,
      },
      subscriptions: rows.map((r) => ({
        id: r.id,
        plan_code: r.planCode,
        status: r.status,
        period_start: r.periodStart.toISOString(),
        period_end: r.periodEnd ? r.periodEnd.toISOString() : null,
        updated_at: r.updatedAt.toISOString(),
      })),
    });
  });

  app.put("/api/admin/plans/:userId", async (c) => {
    const blocked = requireApiSecret(c);
    if (blocked) return blocked;
    const userId = c.req.param("userId");
    const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!user) return c.json({ error: "User not found." }, 404);
    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body." }, 400);
    }
    const now = new Date();
    const periodStart = body.period_start ? new Date(body.period_start) : now;
    const periodEnd = body.period_end ? new Date(body.period_end) : null;
    const existing = (
      await db
        .select()
        .from(planSubscriptions)
        .where(
          and(
            eq(planSubscriptions.userId, userId),
            eq(planSubscriptions.status, "active")
          )
        )
        .limit(1)
    )[0];
    if (existing && existing.id) {
      await db
        .update(planSubscriptions)
        .set({
          status: "expired",
          periodEnd: now,
          updatedAt: now,
        })
        .where(eq(planSubscriptions.id, existing.id));
    }
    await db.insert(planSubscriptions).values({
      id: nanoid(),
      userId,
      planCode: body.plan_code,
      status: body.status,
      periodStart,
      periodEnd,
      createdAt: now,
      updatedAt: now,
    });
    return c.json({ ok: true });
  });

  return app;
}
