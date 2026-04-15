import { pool } from "./connection.js";

const DDL = `
CREATE SCHEMA IF NOT EXISTS social_geni;

CREATE TABLE IF NOT EXISTS social_geni.kits (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL DEFAULT '',
  user_id TEXT,
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

ALTER TABLE social_geni.kits
ADD COLUMN IF NOT EXISTS device_id TEXT NOT NULL DEFAULT '';

ALTER TABLE social_geni.kits
ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE TABLE IF NOT EXISTS social_geni.idempotency_keys (
  key_hash TEXT PRIMARY KEY NOT NULL,
  brief_hash TEXT NOT NULL,
  kit_id TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_geni.kit_failure_logs (
  id TEXT PRIMARY KEY NOT NULL,
  kit_id TEXT,
  phase TEXT NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  model_used TEXT NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kit_failure_logs_kit ON social_geni.kit_failure_logs (kit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kit_failure_logs_phase ON social_geni.kit_failure_logs (phase, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kits_created ON social_geni.kits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kits_device_created ON social_geni.kits (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kits_user_created ON social_geni.kits (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_geni.users (
  id TEXT PRIMARY KEY NOT NULL,
  supabase_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE social_geni.users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS social_geni.user_devices (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user ON social_geni.user_devices (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS social_geni.plan_subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_subscriptions_user ON social_geni.plan_subscriptions (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_subscriptions_status ON social_geni.plan_subscriptions (status, period_end);

CREATE TABLE IF NOT EXISTS social_geni.monthly_usage_counters (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  device_id TEXT,
  period_key TEXT NOT NULL,
  video_prompts_used INTEGER NOT NULL DEFAULT 0,
  image_prompts_used INTEGER NOT NULL DEFAULT 0,
  kits_used INTEGER NOT NULL DEFAULT 0,
  regenerate_used INTEGER NOT NULL DEFAULT 0,
  retry_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE social_geni.monthly_usage_counters
ADD COLUMN IF NOT EXISTS video_prompts_used INTEGER NOT NULL DEFAULT 0;

ALTER TABLE social_geni.monthly_usage_counters
ADD COLUMN IF NOT EXISTS image_prompts_used INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usage_user_period
  ON social_geni.monthly_usage_counters (user_id, period_key)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_usage_device_period
  ON social_geni.monthly_usage_counters (device_id, period_key)
  WHERE device_id IS NOT NULL;

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
}
