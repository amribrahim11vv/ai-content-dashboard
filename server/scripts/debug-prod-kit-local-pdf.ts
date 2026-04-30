import { generateKitPdf } from "../src/services/pdfService.js";

type LoginResponse = { token?: string; error?: string };

async function main() {
  const kitId = process.argv[2]?.trim();
  if (!kitId) throw new Error("Usage: tsx server/scripts/debug-prod-kit-local-pdf.ts <kitId>");

  const base = String(process.env.ADMIN_BASE_URL ?? "https://ai-content-dashboard-api-v2.onrender.com")
    .trim()
    .replace(/\/+$/, "");
  const username = String(process.env.ADMIN_USERNAME ?? "admin").trim() || "admin";
  const password = String(process.env.ADMIN_PASSWORD ?? "").trim();
  if (!password) throw new Error("ADMIN_PASSWORD missing");

  const loginRes = await fetch(`${base}/api/auth/agency-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const loginBody = (await loginRes.json()) as LoginResponse;
  if (!loginRes.ok || !loginBody.token) {
    throw new Error(`Login failed (${loginRes.status}): ${loginBody.error ?? "unknown"}`);
  }

  const kitRes = await fetch(`${base}/api/kits/${kitId}?scope=all`, {
    headers: { "X-Agency-Admin-Session": loginBody.token },
  });
  if (!kitRes.ok) {
    const text = await kitRes.text();
    throw new Error(`Fetch kit failed (${kitRes.status}): ${text}`);
  }
  const kit = (await kitRes.json()) as {
    id: string;
    brief_json: string;
    result_json: unknown;
    created_at: string;
    delivery_status?: string;
  };

  console.log("kit_meta", {
    id: kit.id,
    delivery_status: kit.delivery_status ?? null,
    brief_type: typeof kit.brief_json,
    result_type: kit.result_json === null ? "null" : typeof kit.result_json,
    created_at: kit.created_at,
  });

  const pdf = await generateKitPdf({
    id: kit.id,
    brief_json: kit.brief_json,
    result_json: kit.result_json,
    created_at: kit.created_at,
  });
  console.log("pdf_ok_bytes", pdf.length);
}

main().catch((err) => {
  console.error("[debug-prod-kit-local-pdf] failed", err);
  process.exit(1);
});

