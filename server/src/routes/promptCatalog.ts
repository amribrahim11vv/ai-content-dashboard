import { and, desc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db/index.js";
import { industries, industryPrompts, kits } from "../db/schema.js";
import { normalizeIndustrySlug } from "../logic/promptResolver.js";
import { isStrictPromptTemplates } from "../logic/promptStrictEnv.js";
import { requiredPromptVariables, validatePromptTemplateContract } from "../logic/promptTemplateValidation.js";
import type { Next } from "hono";

const createIndustrySchema = z.object({
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  is_active: z.boolean().optional().default(true),
});

const createPromptSchema = z.object({
  industry_slug: z.string().optional().nullable(),
  prompt_template: z.string().min(1),
  notes: z.string().optional().default(""),
  status: z.enum(["draft", "active"]).optional().default("draft"),
});

const validatePromptSchema = z.object({
  prompt_template: z.string().min(1),
});

function toPromptDto(row: typeof industryPrompts.$inferSelect) {
  return {
    id: row.id,
    industry_id: row.industryId,
    version: row.version,
    status: row.status,
    prompt_template: row.promptTemplate,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function createPromptCatalogRouter(mw: (c: import("hono").Context, next: Next) => Promise<void | Response>) {
  const app = new Hono();
  app.use("*", mw);

  app.get("/prompt-catalog/industries", async (c) => {
    const rows = await db.select().from(industries).orderBy(industries.name);
    const items = await Promise.all(
      rows.map(async (r) => {
        const activeRows = await db
          .select()
          .from(industryPrompts)
          .where(and(eq(industryPrompts.industryId, r.id), eq(industryPrompts.status, "active")))
          .limit(1);
        const active = activeRows[0];
        return {
          id: r.id,
          slug: r.slug,
          name: r.name,
          is_active: r.isActive,
          active_prompt_version_id: active?.id ?? null,
          active_prompt_version: active?.version ?? null,
        };
      })
    );
    return c.json({ items });
  });

  app.post("/prompt-catalog/industries", async (c) => {
    let body: z.infer<typeof createIndustrySchema>;
    try {
      body = createIndustrySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body" }, 400);
    }
    const slug = normalizeIndustrySlug(body.slug);
    const normalizedName = body.name.trim().toLowerCase();
    const existingRows = await db.select().from(industries).where(eq(industries.slug, slug)).limit(1);
    if (existingRows[0]) return c.json({ error: "Industry slug already exists." }, 409);
    const allIndustries = await db.select().from(industries);
    const byName = allIndustries.find((i) => i.name.trim().toLowerCase() === normalizedName);
    if (byName) {
      return c.json({ error: "Industry name already exists. Please choose a different name." }, 409);
    }
    const now = new Date();
    const id = nanoid();
    await db.insert(industries).values({
      id,
      slug,
      name: body.name.trim(),
      isActive: body.is_active,
      createdAt: now,
      updatedAt: now,
    });
    return c.json({ id, slug, name: body.name.trim(), is_active: body.is_active }, 201);
  });

  app.get("/prompt-catalog/prompts", async (c) => {
    const industrySlugRaw = c.req.query("industry_slug");
    const industrySlug = industrySlugRaw ? normalizeIndustrySlug(industrySlugRaw) : null;
    let industryId: string | null = null;
    if (industrySlug) {
      const indPromptListRows = await db.select().from(industries).where(eq(industries.slug, industrySlug)).limit(1);
      const industry = indPromptListRows[0];
      if (!industry) return c.json({ error: "Unknown industry_slug" }, 404);
      industryId = industry.id;
    }
    const rows =
      industryId === null
        ? await db
            .select()
            .from(industryPrompts)
            .where(isNull(industryPrompts.industryId))
            .orderBy(desc(industryPrompts.version))
        : await db
            .select()
            .from(industryPrompts)
            .where(eq(industryPrompts.industryId, industryId))
            .orderBy(desc(industryPrompts.version));
    return c.json({ items: rows.map(toPromptDto), required_variables: requiredPromptVariables() });
  });

  app.post("/prompt-catalog/prompts/validate", async (c) => {
    let body: z.infer<typeof validatePromptSchema>;
    try {
      body = validatePromptSchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body" }, 400);
    }
    const result = validatePromptTemplateContract(body.prompt_template);
    return c.json({
      ok: result.ok,
      missing_variables: result.missingVariables,
      found_variables: result.foundVariables,
      mode: result.mode,
      required_variables: requiredPromptVariables(),
      strict_mode: isStrictPromptTemplates(),
    });
  });

  app.post("/prompt-catalog/prompts", async (c) => {
    let body: z.infer<typeof createPromptSchema>;
    try {
      body = createPromptSchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body" }, 400);
    }

    const validation = validatePromptTemplateContract(body.prompt_template);
    if (!validation.ok && isStrictPromptTemplates()) {
      return c.json({ error: "Prompt template missing required variables.", missing_variables: validation.missingVariables }, 400);
    }

    const now = new Date();
    const industrySlug = body.industry_slug ? normalizeIndustrySlug(body.industry_slug) : null;
    let industryId: string | null = null;
    if (industrySlug) {
      const indRows2 = await db.select().from(industries).where(eq(industries.slug, industrySlug)).limit(1);
      const industry = indRows2[0];
      if (!industry) return c.json({ error: "Unknown industry_slug" }, 404);
      industryId = industry.id;
    }

    const latestRows =
      industryId === null
        ? await db
            .select()
            .from(industryPrompts)
            .where(isNull(industryPrompts.industryId))
            .orderBy(desc(industryPrompts.version))
            .limit(1)
        : await db
            .select()
            .from(industryPrompts)
            .where(eq(industryPrompts.industryId, industryId))
            .orderBy(desc(industryPrompts.version))
            .limit(1);
    const latest = latestRows[0];

    const version = (latest?.version ?? 0) + 1;
    const id = nanoid();
    await db.insert(industryPrompts).values({
      id,
      industryId,
      version,
      status: body.status,
      promptTemplate: body.prompt_template,
      notes: body.notes,
      createdAt: now,
      updatedAt: now,
    });

    if (body.status === "active") {
      if (industryId === null) {
        await db
          .update(industryPrompts)
          .set({ status: "draft", updatedAt: now })
          .where(and(isNull(industryPrompts.industryId), eq(industryPrompts.status, "active")));
      } else {
        await db
          .update(industryPrompts)
          .set({ status: "draft", updatedAt: now })
          .where(and(eq(industryPrompts.industryId, industryId), eq(industryPrompts.status, "active")));
      }
      await db.update(industryPrompts).set({ status: "active", updatedAt: now }).where(eq(industryPrompts.id, id));
    }

    const createdRows = await db.select().from(industryPrompts).where(eq(industryPrompts.id, id)).limit(1);
    const created = createdRows[0];
    const payload: {
      item: ReturnType<typeof toPromptDto>;
      template_warnings?: { missing_variables: string[] };
    } = { item: toPromptDto(created!) };
    if (!validation.ok && !isStrictPromptTemplates()) {
      payload.template_warnings = { missing_variables: validation.missingVariables };
    }
    return c.json(payload, 201);
  });

  app.post("/prompt-catalog/prompts/:id/activate", async (c) => {
    const id = c.req.param("id");
    const now = new Date();
    const targetRows = await db.select().from(industryPrompts).where(eq(industryPrompts.id, id)).limit(1);
    const target = targetRows[0];
    if (!target) return c.json({ error: "Prompt version not found" }, 404);

    if (target.industryId === null) {
      await db
        .update(industryPrompts)
        .set({ status: "draft", updatedAt: now })
        .where(and(isNull(industryPrompts.industryId), eq(industryPrompts.status, "active")));
    } else {
      await db
        .update(industryPrompts)
        .set({ status: "draft", updatedAt: now })
        .where(and(eq(industryPrompts.industryId, target.industryId), eq(industryPrompts.status, "active")));
    }
    await db.update(industryPrompts).set({ status: "active", updatedAt: now }).where(eq(industryPrompts.id, id));
    const updatedRows = await db.select().from(industryPrompts).where(eq(industryPrompts.id, id)).limit(1);
    const updated = updatedRows[0]!;
    return c.json({ item: toPromptDto(updated) });
  });

  app.delete("/prompt-catalog/prompts/:id", async (c) => {
    const id = c.req.param("id");
    const delTargetRows = await db.select().from(industryPrompts).where(eq(industryPrompts.id, id)).limit(1);
    const target = delTargetRows[0];
    if (!target) return c.json({ error: "Prompt version not found" }, 404);

    if (target.status === "active") {
      return c.json({ error: "Cannot delete active prompt version. Activate another version first." }, 400);
    }

    const usedRows = await db.select().from(kits).where(eq(kits.promptVersionId, id)).limit(1);
    if (usedRows[0]) {
      return c.json({ error: "Cannot delete prompt version already referenced by generated kits." }, 400);
    }

    await db.delete(industryPrompts).where(eq(industryPrompts.id, id));
    return c.json({ ok: true });
  });

  app.get("/prompt-catalog/fallback", async (c) => {
    const fbRows = await db
      .select()
      .from(industryPrompts)
      .where(and(isNull(industryPrompts.industryId), eq(industryPrompts.status, "active")))
      .limit(1);
    const activeFallback = fbRows[0];
    if (!activeFallback) return c.json({ error: "No active global fallback prompt found." }, 404);
    return c.json({ item: toPromptDto(activeFallback) });
  });

  return app;
}
