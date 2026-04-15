import { Hono } from "hono";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { planSubscriptions, users } from "../db/schema.js";
import { getAuthUser } from "../middleware/userAuth.js";
import { canApplyAdminRoleChange } from "../services/adminRolePolicy.js";

const bodySchema = z.object({
  plan_code: z.enum(["starter", "early_adopter", "admin_unlimited"]),
  status: z.enum(["active", "trialing", "cancelled", "expired"]).default("active"),
  period_start: z.string().optional(),
  period_end: z.string().nullable().optional(),
});

const roleBodySchema = z.object({
  is_admin: z.boolean(),
});

const roleByEmailBodySchema = z.object({
  email: z.string().email(),
  is_admin: z.boolean(),
});

function parseBearerToken(c: import("hono").Context): string {
  const auth = c.req.header("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

function isApiSecretToken(token: string): boolean {
  const secret = String(process.env.API_SECRET ?? "").trim();
  return Boolean(secret) && token === secret;
}

async function requireAdminAccess(c: import("hono").Context): Promise<Response | null> {
  const token = parseBearerToken(c);
  if (isApiSecretToken(token)) return null;

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
  c.set("adminActorUserId", current.id);
  return null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function addOneMonth(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + 1);
  return copy;
}

async function countAdmins(): Promise<number> {
  const rows = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(users)
    .where(eq(users.isAdmin, true));
  return Number(rows[0]?.count ?? 0);
}

export function createAdminPlansRouter(
  mw?: (c: import("hono").Context, next: import("hono").Next) => Promise<void | Response>
) {
  const app = new Hono();
  if (mw) app.use("/api/admin/*", mw);

  app.get("/api/admin/plans/:userId", async (c) => {
    const blocked = await requireAdminAccess(c);
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
        is_admin: user.isAdmin,
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
    const blocked = await requireAdminAccess(c);
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
    const periodEnd =
      body.period_end
        ? new Date(body.period_end)
        : body.status === "active" || body.status === "trialing"
          ? addOneMonth(periodStart)
          : null;
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

  app.get("/api/admin/users", async (c) => {
    const blocked = await requireAdminAccess(c);
    if (blocked) return blocked;

    const query = String(c.req.query("query") ?? "").trim();
    const rawPage = Number(c.req.query("page") ?? "1");
    const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
    const limit = 25;
    const offset = (page - 1) * limit;

    const where = query ? ilike(users.email, `%${query}%`) : undefined;
    const list = await db
      .select({
        id: users.id,
        supabase_user_id: users.supabaseUserId,
        email: users.email,
        display_name: users.displayName,
        is_admin: users.isAdmin,
        created_at: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const countRows = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(where);
    const total = Number(countRows[0]?.count ?? 0);

    return c.json({
      users: list.map((u) => ({
        ...u,
        created_at: u.created_at.toISOString(),
      })),
      page,
      page_size: limit,
      total,
    });
  });

  app.patch("/api/admin/users/:userId/role", async (c) => {
    const blocked = await requireAdminAccess(c);
    if (blocked) return blocked;
    const targetUserId = c.req.param("userId");
    let body: z.infer<typeof roleBodySchema>;
    try {
      body = roleBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body." }, 400);
    }

    const target = (await db.select().from(users).where(eq(users.id, targetUserId)).limit(1))[0];
    if (!target) return c.json({ error: "User not found." }, 404);
    if (target.isAdmin === body.is_admin) return c.json({ ok: true, unchanged: true });

    const admins = await countAdmins();
    const check = canApplyAdminRoleChange({
      currentAdmins: admins,
      currentIsAdmin: target.isAdmin,
      nextIsAdmin: body.is_admin,
    });
    if (!check.ok) {
      return c.json({ error: check.error }, 409);
    }

    await db
      .update(users)
      .set({
        isAdmin: body.is_admin,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId));

    return c.json({ ok: true });
  });

  app.post("/api/admin/users/promote-by-email", async (c) => {
    const blocked = await requireAdminAccess(c);
    if (blocked) return blocked;

    let body: z.infer<typeof roleByEmailBodySchema>;
    try {
      body = roleByEmailBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body." }, 400);
    }

    const email = normalizeEmail(body.email);
    const target = (
      await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1)
    )[0];
    if (!target) return c.json({ error: "User with this email was not found." }, 404);
    if (target.isAdmin === body.is_admin) return c.json({ ok: true, unchanged: true, user_id: target.id });

    const admins = await countAdmins();
    const check = canApplyAdminRoleChange({
      currentAdmins: admins,
      currentIsAdmin: target.isAdmin,
      nextIsAdmin: body.is_admin,
    });
    if (!check.ok) {
      return c.json({ error: check.error }, 409);
    }

    await db
      .update(users)
      .set({
        isAdmin: body.is_admin,
        updatedAt: new Date(),
      })
      .where(eq(users.id, target.id));

    return c.json({ ok: true, user_id: target.id });
  });

  return app;
}
