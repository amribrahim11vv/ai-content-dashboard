import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { runMigrations, db } from "./db/index.js";
import { createKitsRouter } from "./routes/kits.js";
import { createFeaturesRouter } from "./routes/features.js";
import { createAnalyticsRouter } from "./routes/analytics.js";
import { createAuthRouter } from "./routes/auth.js";
import { createAdminPlansRouter } from "./routes/adminPlans.js";
import { bearerAuth } from "./middleware/auth.js";
import { optionalSupabaseUser } from "./middleware/userAuth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { startIdempotencyCleanupJob } from "./services/kitGenerationService.js";
import type { Context, Next } from "hono";

async function main() {
  await runMigrations();
  const cleanupTimer = startIdempotencyCleanupJob();
  cleanupTimer.unref();

  const app = new Hono();

  app.use("*", secureHeaders());

  const origin = String(process.env.CORS_ORIGIN ?? "*").trim() || "*";
  const isProd = String(process.env.NODE_ENV ?? "").toLowerCase() === "production";
  if (isProd && origin === "*") {
    console.warn("[SECURITY] CORS_ORIGIN is '*' in production. Restrict it to trusted domains.");
  }
  app.use(
    "*",
    cors({
      origin: origin === "*" ? "*" : origin.split(",").map((o) => o.trim()),
      allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Device-ID"],
      exposeHeaders: ["Content-Type"],
    })
  );

  app.get("/", (c) =>
    c.json({
      service: "ai-content-dashboard-api",
      ok: true,
      endpoints: {
        health: "/health",
        kits: "/api/kits",
        features: "/api/profile",
        wizardAnalytics: "/api/analytics/wizard-events",
      },
    })
  );

  app.get("/health", (c) => c.json({ ok: true, db: Boolean(db) }));

  async function kitsGuard(c: Context, next: Next) {
    return await rateLimit(c, async () => {
      const authResult = await bearerAuth(c, async () => undefined);
      if (authResult) return authResult;
      return await optionalSupabaseUser(c, next);
    });
  }

  async function adminGuard(c: Context, next: Next) {
    return await optionalSupabaseUser(c, next);
  }

  const kitsApp = createKitsRouter(kitsGuard);
  const featuresApp = createFeaturesRouter(kitsGuard);
  const analyticsApp = createAnalyticsRouter();
  const authApp = createAuthRouter(kitsGuard);
  const adminPlansApp = createAdminPlansRouter(adminGuard);

  app.route("/", kitsApp);
  app.route("/api", featuresApp);
  app.route("/api", analyticsApp);
  app.route("/", authApp);
  app.route("/", adminPlansApp);

  const port = parseInt(process.env.PORT ?? "8787", 10);
  const server = serve({ fetch: app.fetch, port }, () => {
    console.log(`BFF listening on http://localhost:${port}`);
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\n[FATAL] Port ${port} is already in use.\n` +
          `  • From repo root:  npm run dev:clean-ports\n` +
          `  • Then start again: npm run dev\n` +
          `  • Or free this port: npx kill-port ${port}\n`
      );
      process.exit(1);
    }
    console.error(err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
