import type { Context } from "hono";

/* ------------------------------------------------------------------ */
/*  Configurable per-route rate limiter (in-memory, sliding-window)   */
/* ------------------------------------------------------------------ */

type RateLimitOpts = {
  /** Max requests allowed inside the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Namespace to isolate buckets between different limiters. */
  namespace: string;
  /**
   * Optional custom key extractor. Receives the Hono Context and returns
   * the string key to rate-limit by, or `null` to skip limiting for this
   * request.  May be async (e.g. to read the request body).
   *
   * When omitted the limiter defaults to the client IP address.
   */
  keyExtractor?: (c: Context) => string | null | Promise<string | null>;
  /**
   * Human-readable label for the key dimension, used in log lines.
   * Defaults to "IP".
   */
  keyLabel?: string;
};

/**
 * Each namespace gets its own bucket map so that a "global" limiter and
 * a stricter "auth-sync" limiter never share counters.
 */
const namespaces = new Map<string, Map<string, { count: number; resetAt: number }>>();

// Periodically clean up expired rate-limit buckets to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const buckets of namespaces.values()) {
    for (const [key, b] of buckets.entries()) {
      if (now > b.resetAt) {
        buckets.delete(key);
      }
    }
  }
}, 5 * 60 * 1000).unref(); // Run every 5 minutes. unref() prevents it from blocking process exit.

function getBucketMap(ns: string) {
  let map = namespaces.get(ns);
  if (!map) {
    map = new Map();
    namespaces.set(ns, map);
  }
  return map;
}

/**
 * Factory: creates a Hono-compatible rate-limit middleware with the
 * given options.  Returns 429 with a clear JSON body and standard
 * `Retry-After` header when the limit is exceeded.
 *
 * Supports three keying strategies:
 *   1. IP (default) — no `keyExtractor` needed.
 *   2. User ID      — pass a `keyExtractor` that reads auth context.
 *   3. Device ID    — pass a `keyExtractor` that reads the request body.
 *
 * If `keyExtractor` returns `null` the request is allowed through
 * without counting (e.g. unauthenticated requests skip the user limiter).
 */
export function createRateLimit(opts: RateLimitOpts) {
  const label = opts.keyLabel ?? "IP";

  return async function rateLimitMiddleware(
    c: Context,
    next: () => Promise<Response | void>,
  ) {
    /* ---- Resolve the bucket key ---------------------------------- */
    let key: string | null;
    try {
      key = opts.keyExtractor
        ? await opts.keyExtractor(c)
        : c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    } catch {
      // If the extractor throws (e.g. malformed body), skip this limiter
      // gracefully — the handler's own validation will reject the request.
      return await next();
    }

    // null means "nothing to key on" — let the request through.
    if (!key) return await next();

    /* ---- Bucket logic -------------------------------------------- */
    const buckets = getBucketMap(opts.namespace);
    const now = Date.now();

    let b = buckets.get(key);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, b);
    }
    b.count += 1;

    if (b.count > opts.limit) {
      const retryAfterSec = Math.ceil((b.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfterSec));
      console.warn(
        `[RATE-LIMIT] ${opts.namespace} — blocked ${label}=${key} ` +
          `(${b.count}/${opts.limit} in ${opts.windowMs / 1000}s window)`,
      );
      return c.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          retry_after_seconds: retryAfterSec,
        },
        429,
      );
    }
    return await next();
  };
}

/* ---- Pre-built instances ----------------------------------------- */

/** General-purpose limiter used by kitsGuard and other broad routes. */
export const rateLimit = createRateLimit({
  limit: Math.max(
    10,
    Math.min(
      500,
      parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? "60", 10) || 60,
    ),
  ),
  windowMs: 60_000,
  namespace: "global",
});

/* ── /api/auth/sync — triple-layer defence ────────────────────────── */

const AUTH_SYNC_LIMIT = Math.max(
  2,
  Math.min(
    // Keep default conservative (5), but allow higher production tuning
    // for login/sync bursts via AUTH_SYNC_RATE_LIMIT (recommended 60-90).
    120,
    parseInt(process.env.AUTH_SYNC_RATE_LIMIT ?? "5", 10) || 5,
  ),
);

/**
 * Layer 1 — IP-based.
 * Stops basic flooding from a single origin.
 */
export const authSyncRateLimit = createRateLimit({
  limit: AUTH_SYNC_LIMIT,
  windowMs: 60_000,
  namespace: "auth-sync-ip",
  keyLabel: "IP",
});

/**
 * Layer 2 — User ID-based.
 * Even if the attacker rotates IPs, they are still bound to their
 * authenticated Supabase user.  Skipped when the user is not
 * authenticated (keyExtractor returns null).
 */
export const authSyncUserRateLimit = createRateLimit({
  limit: AUTH_SYNC_LIMIT,
  windowMs: 60_000,
  namespace: "auth-sync-user",
  keyLabel: "UserID",
  keyExtractor: (c) => {
    const authUser = c.get("authUser") as
      | { supabaseUserId: string }
      | null
      | undefined;
    return authUser?.supabaseUserId ?? null;
  },
});

/**
 * Layer 3 — Device ID-based.
 * Even if the attacker creates multiple accounts, they are still bound
 * to the device_id they send in the body.  Skipped when the body
 * cannot be parsed or doesn't contain a valid device_id.
 *
 * NOTE: Hono caches the parsed JSON body internally, so calling
 * `c.req.json()` here does NOT consume the body for later handlers.
 */
export const authSyncDeviceRateLimit = createRateLimit({
  limit: AUTH_SYNC_LIMIT,
  windowMs: 60_000,
  namespace: "auth-sync-device",
  keyLabel: "DeviceID",
  keyExtractor: async (c) => {
    try {
      const body = await c.req.json();
      const id =
        typeof body === "object" && body !== null && typeof body.device_id === "string"
          ? (body.device_id as string).trim()
          : null;
      // Only accept valid UUIDs to avoid bucket pollution with junk keys.
      if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return id;
      }
      return null;
    } catch {
      return null;
    }
  },
});
