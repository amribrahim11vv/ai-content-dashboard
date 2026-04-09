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

const generateBodySchema = z
  .object({
    submitted_at: z.union([z.string(), z.number()]).optional(),
    email: z.string().optional(),
    brand_name: z.string().optional().default(""),
    industry: z.string().optional().default(""),
    target_audience: z.string().optional().default(""),
    main_goal: z.string().optional().default(""),
    platforms: z.string().optional().default(""),
    brand_tone: z.string().optional().default(""),
    brand_colors: z.string().optional().default(""),
    offer: z.string().optional().default(""),
    competitors: z.string().optional().default(""),
    visual_notes: z.string().optional().default(""),
    reference_image: z.string().optional().default(""),
    campaign_duration: z.string().optional().default(""),
    budget_level: z.string().optional().default(""),
    best_content_types: z.string().optional().default(""),
    num_posts: z.number().optional(),
    num_image_designs: z.number().optional(),
    num_video_prompts: z.number().optional(),
    campaign_mode: z.enum(["social", "offer", "deep"]).optional(),
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

export function createKitsRouter(mw: (c: import("hono").Context, next: Next) => Promise<void | Response>) {
  const app = new Hono();

  app.use("/api/kits/*", mw);

  app.post("/api/kits/generate", async (c) => {
    let body: z.infer<typeof generateBodySchema>;
    try {
      body = generateBodySchema.parse(await c.req.json());
    } catch {
      return c.json({ error: "Invalid JSON body." }, 400);
    }

    try {
      const result = await generateKitService({
        idempotencyKey: c.req.header("Idempotency-Key")?.trim() || "",
        body: body as Record<string, unknown>,
      });
      return c.json(result.body, result.status as 200 | 201);
    } catch (err) {
      return respondHttpError(c, err, "Unexpected error while generating kit.");
    }
  });

  app.get("/api/kits", async (c) => {
    return c.json(await listKitsService());
  });

  app.get("/api/kits/:id", async (c) => {
    try {
      return c.json(await getKitByIdService(c.req.param("id")));
    } catch (err) {
      return respondHttpError(c, err, "Unexpected error while loading kit.");
    }
  });

  app.post("/api/kits/:id/retry", async (c) => {
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
      });
      return c.json(result.body, result.status as 200);
    } catch (err) {
      return respondHttpError(c, err, "Unexpected error while retrying kit.");
    }
  });

  app.post("/api/kits/:id/regenerate-item", async (c) => {
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
      });
      return c.json(result.body, result.status as 200);
    } catch (err) {
      return respondHttpError(c, err, "Unexpected error while regenerating item.");
    }
  });

  return app;
}
