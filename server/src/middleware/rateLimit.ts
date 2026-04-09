import type { Context } from "hono";

const buckets = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(c: Context, next: () => Promise<Response | void>) {
  const limit = Math.max(10, Math.min(500, parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? "60", 10) || 60));
  const windowMs = 60_000;
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(ip, b);
  }
  b.count += 1;
  if (b.count > limit) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }
  return await next();
}
