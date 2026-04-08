import {
  pgSchema,
  text,
  integer,
  boolean,
  bigint,
  timestamp,
} from "drizzle-orm/pg-core";

/** Isolated schema on shared Supabase — avoids colliding with other apps in `public`. */
export const socialGeni = pgSchema("social_geni");

export const kits = socialGeni.table("kits", {
  id: text("id").primaryKey(),
  briefJson: text("brief_json").notNull(),
  resultJson: text("result_json"),
  deliveryStatus: text("delivery_status").notNull(),
  modelUsed: text("model_used").notNull(),
  lastError: text("last_error").notNull().default(""),
  correlationId: text("correlation_id").notNull(),
  promptVersionId: text("prompt_version_id"),
  isFallback: boolean("is_fallback").notNull().default(false),
  rowVersion: integer("row_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const idempotencyKeys = socialGeni.table("idempotency_keys", {
  keyHash: text("key_hash").primaryKey(),
  briefHash: text("brief_hash").notNull(),
  kitId: text("kit_id").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
});

export type KitRow = typeof kits.$inferSelect;

export const notifications = socialGeni.table("notifications", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull(),
  kitId: text("kit_id"),
  readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const userProfile = socialGeni.table("user_profile", {
  id: integer("id").primaryKey(),
  displayName: text("display_name").notNull().default(""),
  email: text("email").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const appPreferences = socialGeni.table("app_preferences", {
  id: integer("id").primaryKey(),
  compactTable: boolean("compact_table").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const brandVoice = socialGeni.table("brand_voice", {
  id: integer("id").primaryKey(),
  pillarsJson: text("pillars_json").notNull(),
  avoidWordsJson: text("avoid_words_json").notNull(),
  sampleSnippet: text("sample_snippet").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const extrasWaitlist = socialGeni.table("extras_waitlist", {
  id: text("id").primaryKey(),
  toolId: text("tool_id").notNull(),
  email: text("email").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const industries = socialGeni.table("industries", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const industryPrompts = socialGeni.table("industry_prompts", {
  id: text("id").primaryKey(),
  industryId: text("industry_id"),
  version: integer("version").notNull(),
  status: text("status").notNull(),
  promptTemplate: text("prompt_template").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});
