import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Context, Next } from "hono";

export type AuthUserClaims = {
  supabaseUserId: string;
  email: string;
  displayName: string;
};

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getSupabaseJwks(url: string) {
  const normalized = url.trim().replace(/\/+$/, "");
  const key = `${normalized}/auth/v1/.well-known/jwks.json`;
  const cached = jwksCache.get(key);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(new URL(key));
  jwksCache.set(key, jwks);
  return jwks;
}

function parseBearerToken(c: Context): string {
  const raw = c.req.header("authorization") ?? "";
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}

function isApiSecretToken(token: string): boolean {
  const secret = String(process.env.API_SECRET ?? "").trim();
  return Boolean(secret) && token === secret;
}

function pickDisplayName(payload: Record<string, unknown>): string {
  const userMeta =
    typeof payload.user_metadata === "object" && payload.user_metadata !== null
      ? (payload.user_metadata as Record<string, unknown>)
      : {};
  const candidates = [
    payload.name,
    userMeta.full_name,
    userMeta.name,
    userMeta.display_name,
    payload.email,
  ];
  for (const v of candidates) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "User";
}

export function getAuthUser(c: Context): AuthUserClaims | null {
  return (c.get("authUser") as AuthUserClaims | null | undefined) ?? null;
}

export async function optionalSupabaseUser(c: Context, next: Next) {
  const token = parseBearerToken(c);
  if (!token || isApiSecretToken(token)) {
    c.set("authUser", null);
    return await next();
  }

  const supabaseUrl = String(process.env.SUPABASE_URL ?? "").trim();
  if (!supabaseUrl) {
    return c.json({ error: "SUPABASE_URL is required for user authentication." }, 503);
  }
  const audience = String(process.env.SUPABASE_JWT_AUDIENCE ?? "authenticated").trim();

  try {
    const { payload } = await jwtVerify(token, getSupabaseJwks(supabaseUrl), {
      issuer: `${supabaseUrl.replace(/\/+$/, "")}/auth/v1`,
      audience,
    });
    const sub = String(payload.sub ?? "").trim();
    if (!sub) return c.json({ error: "Invalid auth token payload." }, 401);
    const email = typeof payload.email === "string" ? payload.email : "";
    c.set("authUser", {
      supabaseUserId: sub,
      email,
      displayName: pickDisplayName(payload as Record<string, unknown>),
    } satisfies AuthUserClaims);
    return await next();
  } catch {
    return c.json({ error: "Invalid or expired auth token." }, 401);
  }
}
