import type { Context, Next } from "hono";

export async function bearerAuth(c: Context, next: Next) {
  const secret = String(process.env.API_SECRET ?? "").trim();
  const isProd = String(process.env.NODE_ENV ?? "").toLowerCase() === "production";
  if (!secret) {
    if (isProd) {
      console.error("[SECURITY] API_SECRET is missing in production.");
      return c.json({ error: "Server misconfiguration: API auth is not configured." }, 503);
    }
    return await next();
  }
  const auth = c.req.header("authorization") ?? "";
  if (!auth) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const expected = "Bearer " + secret;
  if (auth !== expected) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return await next();
}
