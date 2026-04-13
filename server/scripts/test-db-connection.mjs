import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const serverDir = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(serverDir, ".env") });

const { Pool } = pg;

function databaseUrlForPgPool(raw) {
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

const rawDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!rawDatabaseUrl) {
  console.error("FAIL: DATABASE_URL missing");
  process.exit(1);
}

const useSsl =
  !/localhost|127\.0\.0\.1/.test(rawDatabaseUrl) &&
  !rawDatabaseUrl.includes("sslmode=disable");

const pool = new Pool({
  connectionString: databaseUrlForPgPool(rawDatabaseUrl),
  max: 2,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  try {
    const ping = await pool.query("SELECT 1 AS ok");
    console.log("Ping:", ping.rows[0]);

    const schema = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS exists",
      ["social_geni"]
    );
    console.log("Schema social_geni:", schema.rows[0]);

    const industries = await pool.query(
      "SELECT COUNT(*)::int AS n FROM social_geni.industries"
    );
    console.log("industries rows:", industries.rows[0]);

    console.log("OK: connection and queries succeeded");
  } catch (e) {
    console.error("FAIL:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

await main();
