import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { generateKitPdf } from "../src/services/pdfService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverDir = join(__dirname, "..");
const rootDir = join(serverDir, "..");

dotenv.config({ path: join(serverDir, ".env") });

const { Pool } = pg;

type KitRow = {
  id: string;
  brief_json: string | null;
  result_json: string | null;
  created_at: string;
  delivery_status: string | null;
};

function databaseUrlForPgPool(raw: string) {
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

function parseJsonSafe(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function fileSafeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function main() {
  const rawDatabaseUrl = process.env.DATABASE_URL?.trim();
  if (!rawDatabaseUrl) {
    throw new Error("DATABASE_URL missing in server/.env");
  }

  const useSsl =
    !/localhost|127\.0\.0\.1/.test(rawDatabaseUrl) &&
    !rawDatabaseUrl.includes("sslmode=disable");

  const pool = new Pool({
    connectionString: databaseUrlForPgPool(rawDatabaseUrl),
    max: 2,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });

  const outputDir = path.resolve(rootDir, "test-fixtures/kits/admin-latest-3");
  await fs.mkdir(outputDir, { recursive: true });

  try {
    const query = `
      SELECT id, brief_json, result_json, created_at, delivery_status
      FROM social_geni.kits
      ORDER BY created_at DESC
      LIMIT 3
    `;
    const result = await pool.query<KitRow>(query);

    if (!result.rows.length) {
      throw new Error("No kits found in social_geni.kits.");
    }

    const manifest: Array<Record<string, unknown>> = [];

    for (let i = 0; i < result.rows.length; i += 1) {
      const row = result.rows[i]!;
      const brief = parseJsonSafe(row.brief_json);
      const resultJson = parseJsonSafe(row.result_json);
      const ordinal = String(i + 1).padStart(2, "0");
      const safeId = fileSafeId(row.id);
      const baseName = `${ordinal}-${safeId}`;

      const jsonPath = path.resolve(outputDir, `${baseName}.json`);
      const pdfPath = path.resolve(outputDir, `${baseName}.preview.pdf`);

      const snapshot = {
        fixture_name: "latest-admin-kit",
        fixture_version: 1,
        source: {
          rank: i + 1,
          kit_id: row.id,
          created_at: row.created_at,
          delivery_status: row.delivery_status ?? "",
        },
        brief,
        result_json: resultJson,
      };

      await fs.writeFile(jsonPath, JSON.stringify(snapshot, null, 2), "utf-8");

      const pdfBuffer = await generateKitPdf({
        id: row.id,
        brief_json: JSON.stringify(brief),
        result_json: resultJson,
        created_at: row.created_at,
      });
      await fs.writeFile(pdfPath, pdfBuffer);

      manifest.push({
        rank: i + 1,
        kit_id: row.id,
        created_at: row.created_at,
        delivery_status: row.delivery_status ?? "",
        json_file: path.basename(jsonPath),
        pdf_file: path.basename(pdfPath),
      });
    }

    const manifestPath = path.resolve(outputDir, "manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify({ generated_at: new Date().toISOString(), kits: manifest }, null, 2), "utf-8");

    console.log("Latest 3 admin kits exported successfully.");
    console.log("Output directory:", outputDir);
    for (const item of manifest) {
      console.log(
        `#${item.rank} ${item.kit_id} -> ${item.pdf_file} (+ ${item.json_file})`
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[export-latest-admin-kits-pdfs] failed:", err.message);
  process.exit(1);
});

