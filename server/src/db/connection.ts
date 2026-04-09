import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

/** pg pool must strip sslmode query for node-postgres and apply TLS options explicitly. */
export function databaseUrlForPgPool(raw: string): string {
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
const allowInsecureSsl = String(process.env.DB_SSL_INSECURE ?? "").toLowerCase() === "true";

export const pool = new Pool({
  connectionString: databaseUrlForPgPool(rawDatabaseUrl),
  max: 10,
  ssl: useSsl ? { rejectUnauthorized: !allowInsecureSsl } : undefined,
});

export const db = drizzle({ client: pool, schema });
