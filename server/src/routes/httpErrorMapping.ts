import type { Context } from "hono";
import { HttpError } from "../services/kitGenerationService.js";

export function respondHttpError(c: Context, err: unknown, fallbackMessage: string) {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status as 400 | 401 | 404 | 409 | 422 | 500 | 502);
  }
  return c.json({ error: fallbackMessage }, 500);
}
