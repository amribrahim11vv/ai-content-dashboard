import { Hono } from "hono";
import { z } from "zod";
import type { Next } from "hono";
import {
  generateKitService,
  getKitByIdService,
  listKitsService,
  regenerateKitItemService,
  retryKitService,
} from "../services/kitGenerationService.js";
import { respondHttpError } from "./httpErrorMapping.js";
import { getAuthUser } from "../middleware/userAuth.js";
import { ensureUserFromSupabase } from "../services/subscriptionService.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const deviceIdSchema = z.string().uuid();
const REASONING_TRACE_MAX_LINES = 24;
const REASONING_TRACE_MAX_CHARS = 240;

const generateBodySchema = z
  .object({
    submitted_at: z.union([z.string(), z.number()]).optional(),
    email: z.string().optional(),
    brand_name: z.string().optional().default(""),
    industry: z.string().optional().default(""),
    target_audience: z.union([z.string(), z.array(z.string())]).optional().default([]),
    diagnostic_role: z.string().optional().default(""),
    diagnostic_account_stage: z.string().optional().default(""),
    diagnostic_followers_band: z.string().optional().default(""),
    diagnostic_primary_blocker: z.string().optional().default(""),
    diagnostic_revenue_goal: z.string().optional().default(""),
    main_goal: z.string().optional().default(""),
    platforms: z.union([z.string(), z.array(z.string())]).optional().default([]),
    brand_tone: z.string().optional().default(""),
    brand_colors: z.string().optional().default(""),
    offer: z.string().optional().default(""),
    competitors: z.string().optional().default(""),
    visual_notes: z.string().optional().default(""),
    reference_image: z.string().optional().default(""),
    campaign_duration: z.string().optional().default(""),
    budget_level: z.string().optional().default(""),
    best_content_types: z.union([z.string(), z.array(z.string())]).optional().default([]),
    num_posts: z.number().optional(),
    num_image_designs: z.number().optional(),
    num_video_prompts: z.number().optional(),
    campaign_mode: z.enum(["social", "offer", "deep"]).optional(),
    include_content_package: z.boolean().optional(),
  })
  .passthrough();

const retryBodySchema = z.object({
  brief_json: z.string().min(1),
  row_version: z.number().int().nonnegative(),
});

const regenerateItemBodySchema = z.object({
  item_type: z.enum(["post", "image", "video"]),
  index: z.number().int().nonnegative(),
  row_version: z.number().int().nonnegative(),
  feedback: z.string().trim().max(1200).optional(),
});

type RegenerateItemType = z.infer<typeof regenerateItemBodySchema>["item_type"];

function requireDeviceId(c: import("hono").Context): { ok: true; deviceId: string } | { ok: false; response: Response } {
  const raw = c.req.header("X-Device-ID")?.trim() ?? "";
  const parsed = deviceIdSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: c.json({ error: "Missing or invalid X-Device-ID header." }, 400),
    };
  }
  return { ok: true, deviceId: parsed.data };
}

function buildHydrationSnapshots(resultJson: unknown): Array<{ section: string; progress: number; snapshot: Record<string, unknown> }> {
  const source = resultJson && typeof resultJson === "object" && !Array.isArray(resultJson)
    ? (resultJson as Record<string, unknown>)
    : {};
  const orderedKeys = [
    "narrative_summary",
    "diagnosis_plan",
    "posts",
    "image_designs",
    "video_prompts",
    "marketing_strategy",
    "sales_system",
    "offer_optimization",
    "kpi_tracking",
  ];
  const snapshots: Array<{ section: string; progress: number; snapshot: Record<string, unknown> }> = [];
  const current: Record<string, unknown> = {};
  let emitted = 0;
  for (const key of orderedKeys) {
    if (!(key in source)) continue;
    current[key] = source[key];
    emitted += 1;
    snapshots.push({
      section: key,
      progress: Math.min(1, emitted / orderedKeys.length),
      snapshot: { ...current },
    });
  }
  if (!snapshots.length) {
    snapshots.push({ section: "result_json", progress: 1, snapshot: source });
  }
  return snapshots;
}

function normalizeReasoningLine(input: string): string {
  const compact = input.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= REASONING_TRACE_MAX_CHARS) return compact;
  return compact.slice(0, REASONING_TRACE_MAX_CHARS - 1).trimEnd() + "…";
}

function extractReasoningForSection(section: unknown): string[] {
  if (!section || typeof section !== "object") return [];
  const list = Array.isArray(section) ? section : [section];
  const lines: string[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.algorithmic_advantage === "string" && rec.algorithmic_advantage.trim()) {
      lines.push(`Advantage: ${rec.algorithmic_advantage}`);
    }
    const rationale = rec.strategic_rationale;
    if (rationale && typeof rationale === "object" && !Array.isArray(rationale)) {
      const rationaleRec = rationale as Record<string, unknown>;
      const trigger = typeof rationaleRec.trigger_used === "string" ? rationaleRec.trigger_used : "";
      const contrast = typeof rationaleRec.contrast_note === "string" ? rationaleRec.contrast_note : "";
      const vector = typeof rationaleRec.engagement_vector === "string" ? rationaleRec.engagement_vector : "";
      if (trigger) lines.push(`Trigger: ${trigger}`);
      if (contrast) lines.push(`Contrast: ${contrast}`);
      if (vector) lines.push(`Engagement vector: ${vector}`);
    }
    if (lines.length >= REASONING_TRACE_MAX_LINES) break;
  }
  return lines;
}

function buildReasoningTraceBySection(resultJson: unknown): Record<string, string[]> {
  if (!resultJson || typeof resultJson !== "object" || Array.isArray(resultJson)) return {};
  const root = resultJson as Record<string, unknown>;
  const sections = ["posts", "image_designs", "video_prompts"];
  const mapped: Record<string, string[]> = {};
  for (const section of sections) {
    const normalized = extractReasoningForSection(root[section])
      .map(normalizeReasoningLine)
      .filter(Boolean);
    if (normalized.length > 0) {
      mapped[section] = normalized.slice(0, REASONING_TRACE_MAX_LINES);
    }
  }
  return mapped;
}

async function resolveOwner(c: import("hono").Context) {
  const device = requireDeviceId(c);
  if (!device.ok) return device;
  const authUser = getAuthUser(c);
  if (!authUser) return { ok: true as const, owner: { deviceId: device.deviceId, userId: null as string | null } };
  const user = await ensureUserFromSupabase(db, authUser);
  return { ok: true as const, owner: { deviceId: device.deviceId, userId: user.id } };
}

async function requireAdminAccess(c: import("hono").Context): Promise<Response | null> {
  const authUser = getAuthUser(c);
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const current = (
    await db
      .select({
        id: users.id,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.supabaseUserId, authUser.supabaseUserId))
      .limit(1)
  )[0];
  if (!current?.isAdmin) return c.json({ error: "Admin access required." }, 403);
  return null;
}

export function createKitsRouter(mw: (c: import("hono").Context, next: Next) => Promise<void | Response>) {
  const app = new Hono();

  app.use("/api/kits/*", mw);

  app.post("/api/kits/generate", async (c) => {
    const ownerRes = await resolveOwner(c);
    if (!ownerRes.ok) return ownerRes.response;

    let body: z.infer<typeof generateBodySchema>;
    try {
      body = generateBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid JSON body." }, 400);
    }

    const streamMode = c.req.query("stream") === "1";
    if (!streamMode) {
      try {
        const result = await generateKitService({
          idempotencyKey: c.req.header("Idempotency-Key")?.trim() || "",
          body: body as Record<string, unknown>,
          deviceId: ownerRes.owner.deviceId,
          userId: ownerRes.owner.userId,
        });
        return c.json(result.body, result.status as 200 | 201);
      } catch (err) {
        return respondHttpError(c, err, "Unexpected error while generating kit.");
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (event: string, payload: Record<string, unknown>) => {
          const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(line));
        };

        let stageTick = 0;
        const stageMessages = [
          "Preparing generation context",
          "Generating structured kit",
          "Hydrating progressive sections",
          "Persisting final kit payload",
        ];
        sendEvent("status", { status: "starting", message: stageMessages[0] });
        console.info("[kits_stream] start");
        const heartbeat = setInterval(() => {
          stageTick = (stageTick + 1) % stageMessages.length;
          sendEvent("status", {
            status: stageTick < 2 ? "generating" : "hydrating",
            message: stageMessages[stageTick],
          });
        }, 1800);
        try {
          const result = await generateKitService({
            idempotencyKey: c.req.header("Idempotency-Key")?.trim() || "",
            body: body as Record<string, unknown>,
            deviceId: ownerRes.owner.deviceId,
            userId: ownerRes.owner.userId,
          });
          clearInterval(heartbeat);
          sendEvent("status", { status: "hydrating", message: "Applying section hydration order" });
          const snapshots = buildHydrationSnapshots(result.body.result_json);
          const reasoningBySection = buildReasoningTraceBySection(result.body.result_json);
          let reasoningIndex = 0;
          for (const snap of snapshots) {
            const reasoningLines = reasoningBySection[snap.section] ?? [];
            for (const line of reasoningLines) {
              try {
                reasoningIndex += 1;
                sendEvent("reasoning", {
                  index: reasoningIndex,
                  section: snap.section,
                  line,
                });
              } catch {
                // Best-effort stream event: reasoning trace must never break generation lifecycle.
              }
            }
            sendEvent("partial", snap);
          }
          sendEvent("status", { status: "persisting", message: "Final persistence complete" });
          sendEvent("status", { status: "completed", message: "Generation completed" });
          sendEvent("complete", { kit: result.body });
          console.info("[kits_stream] complete", JSON.stringify({ kitId: result.body.id }));
          controller.close();
        } catch (err) {
          clearInterval(heartbeat);
          sendEvent("error", {
            message:
              err instanceof Error && err.message.trim()
                ? err.message
                : "Unexpected error while generating kit.",
          });
          console.warn("[kits_stream] error", String(err));
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  });

  app.get("/api/kits", async (c) => {
    const scopeAll = c.req.query("scope") === "all";
    if (scopeAll) {
      const blocked = await requireAdminAccess(c);
      if (blocked) return blocked;
      return c.json(await listKitsService(undefined, { includeUsage: true }));
    }
    const ownerRes = await resolveOwner(c);
    if (!ownerRes.ok) return ownerRes.response;
    return c.json(await listKitsService(ownerRes.owner, { includeUsage: false }));
  });

  app.get("/api/kits/:id", async (c) => {
    const scopeAll = c.req.query("scope") === "all";
    let owner: { deviceId: string; userId?: string | null } | undefined;
    if (!scopeAll) {
      const ownerRes = await resolveOwner(c);
      if (!ownerRes.ok) return ownerRes.response;
      owner = ownerRes.owner;
    } else {
      const blocked = await requireAdminAccess(c);
      if (blocked) return blocked;
    }
    try {
      return c.json(await getKitByIdService(c.req.param("id"), owner, { includeUsage: scopeAll }));
    } catch (err) {
      return respondHttpError(c, err, "Unexpected error while loading kit.");
    }
  });

  app.post("/api/kits/:id/retry", async (c) => {
    const ownerRes = await resolveOwner(c);
    if (!ownerRes.ok) return ownerRes.response;
    let body: z.infer<typeof retryBodySchema>;
    try {
      body = retryBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body: brief_json and row_version required." }, 400);
    }

    try {
      const result = await retryKitService({
        id: c.req.param("id"),
        brief_json: body.brief_json,
        row_version: body.row_version,
        owner: ownerRes.owner,
      });
      return c.json(result.body, result.status as 200);
    } catch (err) {
      return respondHttpError(c, err, "Unexpected error while retrying kit.");
    }
  });

  app.post("/api/kits/:id/regenerate-item", async (c) => {
    const ownerRes = await resolveOwner(c);
    if (!ownerRes.ok) return ownerRes.response;
    const id = c.req.param("id");
    let body: z.infer<typeof regenerateItemBodySchema>;
    try {
      body = regenerateItemBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid body: item_type, index, row_version required." }, 400);
    }

    try {
      const result = await regenerateKitItemService({
        id,
        item_type: body.item_type as RegenerateItemType,
        index: body.index,
        row_version: body.row_version,
        feedback: body.feedback,
        owner: ownerRes.owner,
      });
      return c.json(result.body, result.status as 200);
    } catch (err) {
      return respondHttpError(c, err, "Unexpected error while regenerating item.");
    }
  });

  return app;
}
