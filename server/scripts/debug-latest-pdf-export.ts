import dotenv from "dotenv";
import { join } from "node:path";
import pg from "pg";
import { generateKitPdf } from "../src/services/pdfService.js";

dotenv.config({ path: join(process.cwd(), "server/.env") });

const { Pool } = pg;

function toConn(raw: string) {
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

async function main() {
  const kitIdArg = process.argv[2]?.trim();
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DATABASE_URL missing");

  const pool = new Pool({
    connectionString: toConn(raw),
    ssl:
      !/localhost|127\.0\.0\.1/.test(raw) && !raw.includes("sslmode=disable")
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    const result = await pool.query<{
      id: string;
      brief_json: unknown;
      result_json: unknown;
      created_at: string;
      delivery_status: string;
    }>(
      kitIdArg
        ? "SELECT id, brief_json, result_json, created_at, delivery_status FROM social_geni.kits WHERE id = $1 LIMIT 1"
        : "SELECT id, brief_json, result_json, created_at, delivery_status FROM social_geni.kits ORDER BY created_at DESC LIMIT 1",
      kitIdArg ? [kitIdArg] : undefined
    );

    const row = result.rows[0];
    if (!row) throw new Error("No kit rows found");

    console.log("debug_kit", {
      id: row.id,
      delivery_status: row.delivery_status,
      has_brief_json: row.brief_json != null,
      has_result_json: row.result_json != null,
      created_at: row.created_at,
      brief_type: typeof row.brief_json,
      result_type: typeof row.result_json,
    });

    const briefJson =
      typeof row.brief_json === "string"
        ? row.brief_json
        : JSON.stringify((row.brief_json as Record<string, unknown>) ?? {});

    const resultJson =
      typeof row.result_json === "string"
        ? JSON.parse(row.result_json)
        : ((row.result_json as Record<string, unknown>) ?? {});

    const pdf = await generateKitPdf({
      id: row.id,
      brief_json: briefJson,
      result_json: resultJson,
      created_at: row.created_at,
    });

    console.log("pdf_ok_bytes", pdf.length);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[debug-latest-pdf-export] failed", err);
  process.exit(1);
});

