/**
 * Run from repo root: node scripts/test-db-connection.mjs
 * (Delegates to server/scripts; loads server/.env from there.)
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(rootDir, "server", "scripts", "test-db-connection.mjs");
const r = spawnSync(process.execPath, [target], { stdio: "inherit", cwd: rootDir });
process.exit(r.status ?? 1);
