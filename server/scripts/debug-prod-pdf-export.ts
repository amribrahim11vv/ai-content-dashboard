import dotenv from "dotenv";
import { join } from "node:path";

dotenv.config({ path: join(process.cwd(), "server/.env") });

async function main() {
  const kitId = process.argv[2]?.trim();
  if (!kitId) throw new Error("Usage: tsx server/scripts/debug-prod-pdf-export.ts <kitId>");

  const baseUrl = String(process.env.ADMIN_BASE_URL ?? "https://ai-content-dashboard-app-v2.onrender.com")
    .trim()
    .replace(/\/+$/, "");
  console.log("baseUrl", baseUrl);
  const username = String(process.env.ADMIN_USERNAME ?? "admin").trim() || "admin";
  const password = String(process.env.ADMIN_PASSWORD ?? "").trim();
  if (!password) throw new Error("ADMIN_PASSWORD missing in env");

  const loginRes = await fetch(`${baseUrl}/api/auth/agency-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const loginRaw = await loginRes.text();
  let loginBody = {} as { token?: string; error?: string; ok?: boolean };
  try {
    loginBody = JSON.parse(loginRaw) as { token?: string; error?: string; ok?: boolean };
  } catch {
    loginBody = {};
  }
  console.log("login", {
    status: loginRes.status,
    ok: loginBody.ok ?? false,
    error: loginBody.error ?? null,
    hasToken: Boolean(loginBody.token),
    rawPreview: loginRaw.slice(0, 200),
    body: loginBody,
  });
  if (!loginRes.ok || !loginBody.token) return;

  const exportRes = await fetch(`${baseUrl}/api/kits/${kitId}/export-pdf?scope=all`, {
    headers: { "X-Agency-Admin-Session": loginBody.token },
  });
  const contentType = exportRes.headers.get("content-type");
  console.log("export", { status: exportRes.status, contentType });
  if (!exportRes.ok) {
    const text = await exportRes.text().catch(() => "");
    console.log("exportBody", text.slice(0, 500));
    return;
  }
  const arr = new Uint8Array(await exportRes.arrayBuffer());
  console.log("exportBytes", arr.length);
}

main().catch((err) => {
  console.error("[debug-prod-pdf-export] failed", err);
  process.exit(1);
});

