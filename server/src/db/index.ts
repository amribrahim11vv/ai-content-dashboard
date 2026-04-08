import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, isNull } from "drizzle-orm";
import { Pool } from "pg";
import { nanoid } from "nanoid";
import * as schema from "./schema.js";
import { industries, industryPrompts } from "./schema.js";

/** pg v8+ treats sslmode=require in the URL like verify-full; Supabase needs rejectUnauthorized:false on the Pool instead. */
function databaseUrlForPgPool(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

const rawDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!rawDatabaseUrl || !/^postgres(ql)?:\/\//i.test(rawDatabaseUrl)) {
  throw new Error(
    "DATABASE_URL must be a PostgreSQL URL (e.g. Supabase pooler: postgresql://...). " +
      "SQLite file: URLs are no longer supported for this server."
  );
}

const useSsl =
  !/localhost|127\.0\.0\.1/.test(rawDatabaseUrl) && !rawDatabaseUrl.includes("sslmode=disable");

const pool = new Pool({
  connectionString: databaseUrlForPgPool(rawDatabaseUrl),
  max: 10,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });

const DDL = `
CREATE SCHEMA IF NOT EXISTS social_geni;

CREATE TABLE IF NOT EXISTS social_geni.kits (
  id TEXT PRIMARY KEY NOT NULL,
  brief_json TEXT NOT NULL,
  result_json TEXT,
  delivery_status TEXT NOT NULL,
  model_used TEXT NOT NULL,
  last_error TEXT NOT NULL DEFAULT '',
  correlation_id TEXT NOT NULL,
  prompt_version_id TEXT,
  is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  row_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS social_geni.idempotency_keys (
  key_hash TEXT PRIMARY KEY NOT NULL,
  brief_hash TEXT NOT NULL,
  kit_id TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kits_created ON social_geni.kits (created_at DESC);

CREATE TABLE IF NOT EXISTS social_geni.notifications (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL,
  kit_id TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON social_geni.notifications (created_at DESC);

CREATE TABLE IF NOT EXISTS social_geni.user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS social_geni.app_preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  compact_table BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS social_geni.brand_voice (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pillars_json TEXT NOT NULL,
  avoid_words_json TEXT NOT NULL,
  sample_snippet TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS social_geni.extras_waitlist (
  id TEXT PRIMARY KEY NOT NULL,
  tool_id TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS social_geni.industries (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_industries_slug ON social_geni.industries (slug);

CREATE TABLE IF NOT EXISTS social_geni.industry_prompts (
  id TEXT PRIMARY KEY NOT NULL,
  industry_id TEXT,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_industry_prompts_industry ON social_geni.industry_prompts (industry_id);
CREATE INDEX IF NOT EXISTS idx_industry_prompts_status ON social_geni.industry_prompts (status);
`;

async function seedPromptCatalog() {
  const now = new Date();
  const industrySeeds = [
    { slug: "ecommerce", name: "E-commerce" },
    { slug: "real-estate", name: "Real Estate" },
    { slug: "restaurants", name: "Restaurants" },
    { slug: "clinics", name: "Clinics" },
    { slug: "education", name: "Education" },
  ];

  for (const item of industrySeeds) {
    await db
      .insert(industries)
      .values({
        id: nanoid(),
        slug: item.slug,
        name: item.name,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: industries.slug });
  }

  const activeFallback = await db
    .select({ id: industryPrompts.id })
    .from(industryPrompts)
    .where(and(isNull(industryPrompts.industryId), eq(industryPrompts.status, "active")))
    .limit(1);

  if (activeFallback.length > 0) return;

  const fallbackTemplate = [
    "You are a world-class AI Creative Director and Growth Strategist.",
    "Return ONLY valid JSON, no markdown, no code fences, no extra text.",
    "Brand Name: {{brand_name}}",
    "Industry: {{industry}}",
    "Target Audience: {{target_audience}}",
    "Main Goal: {{main_goal}}",
    "Platforms: {{platforms}}",
    "Brand Tone: {{brand_tone}}",
    "Brand Colors: {{brand_colors}}",
    "Offer: {{offer}}",
    "Competitors: {{competitors}}",
    "Visual Notes: {{visual_notes}}",
    "Campaign Duration: {{campaign_duration}}",
    "Budget Level: {{budget_level}}",
    "Best Content Types: {{best_content_types}}",
    "Counts: posts={{num_posts}}, images={{num_image_designs}}, videos={{num_video_prompts}}",
    "Now output valid JSON only.",
  ].join("\n");

  await db.insert(industryPrompts).values({
    id: nanoid(),
    industryId: null,
    version: 1,
    status: "active",
    promptTemplate: fallbackTemplate,
    notes: "Global fallback prompt",
    createdAt: now,
    updatedAt: now,
  });
}

function splitDdlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    for (const stmt of splitDdlStatements(DDL)) {
      await client.query(stmt);
    }
  } finally {
    client.release();
  }
  await seedPromptCatalog();
}
