import { eq, desc, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import {
  notifications,
  userProfile,
  appPreferences,
  brandVoice,
  extrasWaitlist,
} from "../db/schema.js";
import { filterHelpTopics } from "../data/helpTopics.js";
import type { Next } from "hono";

const DEFAULT_PILLARS = [
  {
    title: "Clarity first",
    body: "Short sentences, concrete verbs, no jargon unless ICP expects it.",
  },
  {
    title: "Warm precision",
    body: "Confident, never arrogant; inclusive defaults.",
  },
  {
    title: "Proof over hype",
    body: "Stats, outcomes, and specific examples.",
  },
];

const DEFAULT_AVOID = ["revolutionary", "synergy", "world-class", "unlock", "game-changer"];
const DEFAULT_SAMPLE =
  "We ship calm, fast tools for teams who outgrew generic AI — fewer adjectives, more receipts.";

const profilePutSchema = z.object({
  display_name: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
});

const preferencesPutSchema = z.object({
  compact_table: z.boolean(),
});

const pillarSchema = z.object({ title: z.string().max(200), body: z.string().max(2000) });

const brandVoicePutSchema = z.object({
  pillars: z.array(pillarSchema).max(20),
  avoid_words: z.array(z.string().max(80)).max(50),
  sample_snippet: z.string().max(4000),
});

const waitlistPostSchema = z.object({
  tool_id: z.string().min(1).max(120),
  email: z.string().max(320).optional().default(""),
});

async function getOrCreateProfile() {
  let rows = await db.select().from(userProfile).where(eq(userProfile.id, 1)).limit(1);
  let row = rows[0];
  if (!row) {
    const now = new Date();
    await db.insert(userProfile).values({ id: 1, displayName: "User", email: "", updatedAt: now });
    rows = await db.select().from(userProfile).where(eq(userProfile.id, 1)).limit(1);
    row = rows[0];
  }
  return row!;
}

async function getOrCreatePreferences() {
  let rows = await db.select().from(appPreferences).where(eq(appPreferences.id, 1)).limit(1);
  let row = rows[0];
  if (!row) {
    const now = new Date();
    await db.insert(appPreferences).values({ id: 1, compactTable: false, updatedAt: now });
    rows = await db.select().from(appPreferences).where(eq(appPreferences.id, 1)).limit(1);
    row = rows[0];
  }
  return row!;
}

async function getOrCreateBrandVoice() {
  let rows = await db.select().from(brandVoice).where(eq(brandVoice.id, 1)).limit(1);
  let row = rows[0];
  if (!row) {
    const now = new Date();
    await db.insert(brandVoice).values({
      id: 1,
      pillarsJson: JSON.stringify(DEFAULT_PILLARS),
      avoidWordsJson: JSON.stringify(DEFAULT_AVOID),
      sampleSnippet: DEFAULT_SAMPLE,
      updatedAt: now,
    });
    rows = await db.select().from(brandVoice).where(eq(brandVoice.id, 1)).limit(1);
    row = rows[0];
  }
  return row!;
}

export function createFeaturesRouter(mw: (c: import("hono").Context, next: Next) => Promise<void | Response>) {
  const app = new Hono();

  app.use("*", mw);

  app.get("/notifications", async (c) => {
    const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100);
    return c.json({
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        kind: r.kind,
        kit_id: r.kitId,
        read: Boolean(r.readAt),
        created_at: r.createdAt.toISOString(),
      })),
    });
  });

  app.patch("/notifications/read-all", async (c) => {
    const now = new Date();
    await db.update(notifications).set({ readAt: now }).where(isNull(notifications.readAt));
    return c.json({ ok: true });
  });

  app.patch("/notifications/:id/read", async (c) => {
    const id = c.req.param("id");
    const now = new Date();
    const updated = await db.update(notifications).set({ readAt: now }).where(eq(notifications.id, id)).returning();
    if (!updated.length) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });

  app.get("/profile", async (c) => {
    const row = await getOrCreateProfile();
    return c.json({
      display_name: row.displayName,
      email: row.email,
      updated_at: row.updatedAt.toISOString(),
    });
  });

  app.put("/profile", async (c) => {
    let body: z.infer<typeof profilePutSchema>;
    try {
      body = profilePutSchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body" }, 400);
    }
    const row = await getOrCreateProfile();
    const now = new Date();
    await db
      .update(userProfile)
      .set({
        displayName: body.display_name !== undefined ? body.display_name : row.displayName,
        email: body.email !== undefined ? body.email : row.email,
        updatedAt: now,
      })
      .where(eq(userProfile.id, 1));
    const next = await getOrCreateProfile();
    return c.json({
      display_name: next.displayName,
      email: next.email,
      updated_at: next.updatedAt.toISOString(),
    });
  });

  app.get("/preferences", async (c) => {
    const row = await getOrCreatePreferences();
    return c.json({
      compact_table: row.compactTable,
      updated_at: row.updatedAt.toISOString(),
    });
  });

  app.put("/preferences", async (c) => {
    let body: z.infer<typeof preferencesPutSchema>;
    try {
      body = preferencesPutSchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body: compact_table boolean required" }, 400);
    }
    const now = new Date();
    await getOrCreatePreferences();
    await db
      .update(appPreferences)
      .set({ compactTable: body.compact_table, updatedAt: now })
      .where(eq(appPreferences.id, 1));
    const row = await getOrCreatePreferences();
    return c.json({
      compact_table: row.compactTable,
      updated_at: row.updatedAt.toISOString(),
    });
  });

  app.get("/brand-voice", async (c) => {
    const row = await getOrCreateBrandVoice();
    let pillars: z.infer<typeof pillarSchema>[] = DEFAULT_PILLARS;
    let avoid: string[] = DEFAULT_AVOID;
    try {
      pillars = JSON.parse(row.pillarsJson) as typeof pillars;
    } catch {
      /* keep default */
    }
    try {
      avoid = JSON.parse(row.avoidWordsJson) as string[];
    } catch {
      /* keep default */
    }
    return c.json({
      pillars,
      avoid_words: avoid,
      sample_snippet: row.sampleSnippet,
      updated_at: row.updatedAt.toISOString(),
    });
  });

  app.put("/brand-voice", async (c) => {
    let body: z.infer<typeof brandVoicePutSchema>;
    try {
      body = brandVoicePutSchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid brand voice payload" }, 400);
    }
    await getOrCreateBrandVoice();
    const now = new Date();
    await db
      .update(brandVoice)
      .set({
        pillarsJson: JSON.stringify(body.pillars),
        avoidWordsJson: JSON.stringify(body.avoid_words),
        sampleSnippet: body.sample_snippet,
        updatedAt: now,
      })
      .where(eq(brandVoice.id, 1));
    const row = await getOrCreateBrandVoice();
    return c.json({
      pillars: JSON.parse(row.pillarsJson),
      avoid_words: JSON.parse(row.avoidWordsJson),
      sample_snippet: row.sampleSnippet,
      updated_at: row.updatedAt.toISOString(),
    });
  });

  app.get("/help/topics", (c) => {
    const q = c.req.query("q") ?? "";
    const { resources, faq } = filterHelpTopics(q);
    return c.json({
      resources,
      faq,
      last_updated: "2026-04-05",
    });
  });

  app.post("/extras/waitlist", async (c) => {
    let body: z.infer<typeof waitlistPostSchema>;
    try {
      body = waitlistPostSchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body: tool_id required" }, 400);
    }
    const id = nanoid();
    const now = new Date();
    await db.insert(extrasWaitlist).values({
      id,
      toolId: body.tool_id,
      email: body.email ?? "",
      createdAt: now,
    });
    return c.json({ ok: true, id });
  });

  return app;
}
