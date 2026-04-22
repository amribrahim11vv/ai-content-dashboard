import type { BriefForm, KitSummary } from "../types";
import { apiUrl, ApiError, buildHeaders, parseErrorMessage } from "./httpClient";

export type KitGenerationStreamStatus =
  | "starting"
  | "generating"
  | "hydrating"
  | "persisting"
  | "completed";

export type KitGenerationStreamEvent =
  | { type: "status"; status: KitGenerationStreamStatus; message?: string }
  | { type: "partial"; progress: number; section?: string; snapshot: Record<string, unknown> }
  | { type: "reasoning"; index: number; section?: string; line: string }
  | { type: "complete"; kit: KitSummary }
  | { type: "error"; message: string };

export type KitInteractionPayload = {
  kit_id: string;
  interaction_type: string;
  meta?: Record<string, unknown>;
};

export type KitUiPreferencesPayload = {
  lang?: "ar" | "en";
  open_map?: Record<string, boolean>;
  open_platforms?: Record<string, boolean>;
  open_days?: Record<string, boolean>;
};

export async function generateKit(brief: BriefForm, idempotencyKey: string): Promise<KitSummary> {
  const res = await fetch(apiUrl("/api/kits/generate"), {
    method: "POST",
    headers: buildHeaders({ "Idempotency-Key": idempotencyKey }),
    body: JSON.stringify({ ...brief, submitted_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, res.statusText), res.status);
  return res.json() as Promise<KitSummary>;
}

export async function generateKitAsync(brief: BriefForm, idempotencyKey: string): Promise<KitSummary> {
  const res = await fetch(apiUrl("/api/kits/generate?async=1"), {
    method: "POST",
    headers: buildHeaders({ "Idempotency-Key": idempotencyKey }),
    body: JSON.stringify({ ...brief, submitted_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, res.statusText), res.status);
  return res.json() as Promise<KitSummary>;
}

function parseSseFrames(buffer: string): { frames: string[]; rest: string } {
  const frames: string[] = [];
  let start = 0;
  while (true) {
    const idx = buffer.indexOf("\n\n", start);
    if (idx === -1) break;
    frames.push(buffer.slice(start, idx));
    start = idx + 2;
  }
  return { frames, rest: buffer.slice(start) };
}

function decodeSseFrame(frame: string): { event: string; data: string } | null {
  const lines = frame.split("\n");
  let event = "message";
  const dataParts: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataParts.push(line.slice(5).trim());
  }
  if (!dataParts.length) return null;
  return { event, data: dataParts.join("\n") };
}

export async function generateKitStream(
  brief: BriefForm,
  idempotencyKey: string,
  onEvent: (event: KitGenerationStreamEvent) => void
): Promise<KitSummary> {
  const res = await fetch(apiUrl("/api/kits/generate?stream=1"), {
    method: "POST",
    headers: buildHeaders({ "Idempotency-Key": idempotencyKey }),
    body: JSON.stringify({ ...brief, submitted_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, res.statusText), res.status);
  if (!res.body) throw new ApiError("Streaming response body is missing.", 502);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalKit: KitSummary | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { frames, rest } = parseSseFrames(buffer);
    buffer = rest;
    for (const frame of frames) {
      const parsed = decodeSseFrame(frame);
      if (!parsed) continue;
      try {
        const payload = JSON.parse(parsed.data) as Record<string, unknown>;
        if (parsed.event === "status") {
          onEvent({
            type: "status",
            status: String(payload.status ?? "generating") as KitGenerationStreamStatus,
            message: typeof payload.message === "string" ? payload.message : undefined,
          });
        } else if (parsed.event === "partial") {
          onEvent({
            type: "partial",
            progress: Number(payload.progress ?? 0),
            section: typeof payload.section === "string" ? payload.section : undefined,
            snapshot:
              payload.snapshot && typeof payload.snapshot === "object" && !Array.isArray(payload.snapshot)
                ? (payload.snapshot as Record<string, unknown>)
                : {},
          });
        } else if (parsed.event === "complete") {
          const kit = payload.kit as KitSummary;
          finalKit = kit;
          onEvent({ type: "complete", kit });
        } else if (parsed.event === "reasoning") {
          const rawLine = typeof payload.line === "string" ? payload.line : "";
          const line = rawLine.replace(/\s+/g, " ").trim();
          if (!line) continue;
          const rawIndex = Number(payload.index ?? 0);
          onEvent({
            type: "reasoning",
            index: Number.isFinite(rawIndex) && rawIndex > 0 ? rawIndex : 0,
            section: typeof payload.section === "string" ? payload.section : undefined,
            line: line.length > 260 ? line.slice(0, 259).trimEnd() + "…" : line,
          });
        } else if (parsed.event === "error") {
          const message = typeof payload.message === "string" ? payload.message : "Streaming generation failed.";
          onEvent({ type: "error", message });
          throw new ApiError(message, 500);
        }
      } catch (err) {
        if (err instanceof ApiError) throw err;
      }
    }
  }

  if (!finalKit) throw new ApiError("Streaming completed without final kit payload.", 502);
  return finalKit;
}

export async function listKits(adminMode = false): Promise<KitSummary[]> {
  const qs = adminMode ? "?scope=all" : "";
  const res = await fetch(apiUrl(`/api/kits${qs}`), { headers: buildHeaders() });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Failed to list kits"), res.status);
  return res.json() as Promise<KitSummary[]>;
}

export async function listMyKits(): Promise<KitSummary[]> {
  const res = await fetch(apiUrl("/api/kits/mine"), { headers: buildHeaders() });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Failed to list your kits"), res.status);
  return res.json() as Promise<KitSummary[]>;
}

export async function getKit(id: string, adminMode = false): Promise<KitSummary> {
  const qs = adminMode ? "?scope=all" : "";
  const res = await fetch(apiUrl(`/api/kits/${id}${qs}`), { headers: buildHeaders() });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Not found"), res.status);
  return res.json() as Promise<KitSummary>;
}

export async function retryKit(id: string, briefJson: string, rowVersion: number): Promise<KitSummary> {
  const res = await fetch(apiUrl(`/api/kits/${id}/retry`), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ brief_json: briefJson, row_version: rowVersion }),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, res.statusText), res.status);
  return res.json() as Promise<KitSummary>;
}

export async function regenerateKitItem(
  id: string,
  item_type: "post" | "image" | "video",
  index: number,
  row_version: number,
  feedback?: string
): Promise<KitSummary> {
  const res = await fetch(apiUrl(`/api/kits/${id}/regenerate-item`), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ item_type, index, row_version, feedback }),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, res.statusText), res.status);
  return res.json() as Promise<KitSummary>;
}

export async function submitKitInteractionTelemetry(payload: KitInteractionPayload): Promise<void> {
  const res = await fetch(apiUrl("/api/telemetry/interaction"), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, res.statusText), res.status);
}

export async function updateKitUiPreferences(id: string, uiPreferences: KitUiPreferencesPayload): Promise<KitSummary> {
  const res = await fetch(apiUrl(`/api/kits/${id}/ui-preferences`), {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify({ ui_preferences: uiPreferences }),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, res.statusText), res.status);
  return res.json() as Promise<KitSummary>;
}

export async function deleteKit(id: string): Promise<void> {
  const reason = encodeURIComponent("manual_admin_cleanup");
  const res = await fetch(apiUrl(`/api/kits/${id}?reason=${reason}`), {
    method: "DELETE",
    headers: buildHeaders(),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, res.statusText), res.status);
}

export async function exportKitPdf(id: string): Promise<Blob> {
  const res = await fetch(apiUrl(`/api/kits/${id}/export-pdf?scope=all`), {
    headers: buildHeaders(),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, res.statusText), res.status);
  return res.blob();
}

export async function exportKitExcel(id: string): Promise<Blob> {
  const res = await fetch(apiUrl(`/api/kits/${id}/export-excel?scope=all`), {
    headers: buildHeaders(),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, res.statusText), res.status);
  return res.blob();
}
