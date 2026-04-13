import { nanoid } from "nanoid";
import { db } from "../db/index.js";
import { notifications, type KitRow } from "../db/schema.js";
import { normalizeDeliveryStatus } from "./status.js";

function brandFromBrief(briefJson: string): string {
  try {
    const j = JSON.parse(briefJson) as { brand_name?: string };
    return String(j.brand_name ?? "").trim() || "Kit";
  } catch {
    return "Kit";
  }
}

/** Inserts a notification when a kit reaches a terminal delivery state (not retry_in_progress). */
export async function recordKitNotification(row: KitRow): Promise<void> {
  const s = normalizeDeliveryStatus(row.deliveryStatus);
  if (s === "retry_in_progress") return;

  const brand = brandFromBrief(row.briefJson);
  const isFail = s === "failed_generation";
  const title = isFail ? "Kit failed" : "Kit ready";
  const body = isFail
    ? `${brand}: generation failed — open the kit to retry.`
    : `${brand}: your content kit finished processing.`;

  await db.insert(notifications).values({
    id: nanoid(),
    title,
    body,
    kind: isFail ? "kit_failed" : "kit_success",
    kitId: row.id,
    createdAt: new Date(),
  });
}
