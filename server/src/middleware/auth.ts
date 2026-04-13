import type { Context, Next } from "hono";

function parseAllowedOrigins(raw: string): string[] {
  const value = raw.trim();
  if (!value || value === "*") return [];
  return value
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function isTrustedOriginRequest(c: Context, allowedOrigins: string[]): boolean {
  if (allowedOrigins.length === 0) return false;
  const origin = (c.req.header("origin") ?? "").trim();
  const referer = (c.req.header("referer") ?? "").trim();
  return allowedOrigins.some((allowed) => origin === allowed || referer.startsWith(`${allowed}/`) || referer === allowed);
}

export async function bearerAuth(c: Context, next: Next) {
  const secret = String(process.env.API_SECRET ?? "").trim();
  const isProd = String(process.env.NODE_ENV ?? "").toLowerCase() === "production";
  const allowedOrigins = parseAllowedOrigins(String(process.env.CORS_ORIGIN ?? "*"));
  const auth = c.req.header("authorization") ?? "";

  // Path A: explicit bearer auth (supports service-to-service and scripted usage).
  if (auth) {
    if (!secret) {
      if (isProd) {
        console.error("[SECURITY] Authorization header provided but API_SECRET is missing in production.");
      }
      return c.json({ error: "Server misconfiguration: API auth is not configured." }, 503);
    }
    const expected = "Bearer " + secret;
    if (auth !== expected) {
      // Allow browser-issued JWTs to continue through trusted origin path; user token verification
      // happens in optionalSupabaseUser middleware.
      if (!isTrustedOriginRequest(c, allowedOrigins)) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      return await next();
    }
    return await next();
  }

  // Path B: browser requests from trusted frontend origins (no shared client secret).
  if (isTrustedOriginRequest(c, allowedOrigins)) {
    return await next();
  }

  return c.json({ error: "Unauthorized" }, 401);
}
