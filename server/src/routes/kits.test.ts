import { describe, expect, it, vi, beforeEach } from "vitest";

const generateKitService = vi.fn();
const listKitsService = vi.fn();
const getKitByIdService = vi.fn();
const regenerateKitItemService = vi.fn();
const retryKitService = vi.fn();

vi.mock("../services/kitGenerationService.js", () => ({
  generateKitService,
  listKitsService,
  getKitByIdService,
  regenerateKitItemService,
  retryKitService,
}));

async function appRequest(path: string, init?: RequestInit) {
  const { createKitsRouter } = await import("./kits.js");
  const app = createKitsRouter(async (_c, next) => next());
  return app.request(path, init);
}

describe("kits routes device header enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects list endpoint without X-Device-ID", async () => {
    const res = await appRequest("/api/kits");
    expect(res.status).toBe(400);
    expect(listKitsService).not.toHaveBeenCalled();
  });

  it("rejects invalid X-Device-ID format", async () => {
    const res = await appRequest("/api/kits", {
      headers: { "X-Device-ID": "not-a-uuid" },
    });
    expect(res.status).toBe(400);
    expect(listKitsService).not.toHaveBeenCalled();
  });

  it("passes valid device id into list service", async () => {
    const deviceId = "a4be40b8-2ac6-4f59-9e14-a5cf6f39b4bd";
    listKitsService.mockResolvedValueOnce([]);

    const res = await appRequest("/api/kits", {
      headers: { "X-Device-ID": deviceId },
    });

    expect(res.status).toBe(200);
    expect(listKitsService).toHaveBeenCalledWith({ deviceId, userId: null }, { includeUsage: false });
  });

  it("passes valid device id into generate service", async () => {
    const deviceId = "c89b07be-57f9-4865-b4f8-cd64f2ff7af3";
    generateKitService.mockResolvedValueOnce({ status: 201, body: { id: "k1" } });
    const body = JSON.stringify({ brand_name: "Test", industry: "SaaS" });

    const res = await appRequest("/api/kits/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idem-1",
        "X-Device-ID": deviceId,
      },
      body,
    });

    expect(res.status).toBe(201);
    expect(generateKitService).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "idem-1",
        deviceId,
      })
    );
  });

  it("streams progress events when stream=1", async () => {
    const deviceId = "8e46f65c-c7d7-4b5e-a860-f48e183f3a24";
    generateKitService.mockResolvedValueOnce({
      status: 201,
      body: {
        id: "k-stream",
        result_json: {
          narrative_summary: "summary",
          diagnosis_plan: { quickWin24h: "win" },
          posts: [
            {
              platform: "ig",
              strategic_rationale: {
                trigger_used: "urgency",
                contrast_note: "before vs after",
                engagement_vector: "save intent",
              },
              algorithmic_advantage: "Boosts saves and completion for feed ranking.",
            },
          ],
        },
      },
    });
    const res = await appRequest("/api/kits/generate?stream=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idem-stream",
        "X-Device-ID": deviceId,
      },
      body: JSON.stringify({ brand_name: "Stream", industry: "SaaS" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: status");
    expect(text).toContain("event: partial");
    expect(text).toContain("event: reasoning");
    expect(text).toContain("event: complete");
    expect(text).toContain("\"id\":\"k-stream\"");
    const narrativeIdx = text.indexOf("\"section\":\"narrative_summary\"");
    const postsIdx = text.indexOf("\"section\":\"posts\"");
    expect(narrativeIdx).toBeGreaterThan(-1);
    expect(postsIdx).toBeGreaterThan(-1);
    expect(narrativeIdx).toBeLessThan(postsIdx);
  });

  it("accepts array payload fields for generate route", async () => {
    const deviceId = "6b813b44-522f-4a53-9522-4a43ceadb523";
    generateKitService.mockResolvedValueOnce({ status: 201, body: { id: "k2" } });
    const body = JSON.stringify({
      brand_name: "Test",
      industry: "SaaS",
      target_audience: ["youth", "entrepreneurs"],
      platforms: ["instagram", "tiktok"],
      best_content_types: ["educational", "testimonials"],
    });

    const res = await appRequest("/api/kits/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "idem-2",
        "X-Device-ID": deviceId,
      },
      body,
    });

    expect(res.status).toBe(201);
    expect(generateKitService).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "idem-2",
        deviceId,
      })
    );
  });

  it("passes valid device id into get-by-id service", async () => {
    const deviceId = "da84fbef-f991-46d8-8f95-4c1e4edca53b";
    getKitByIdService.mockResolvedValueOnce({ id: "k1" });

    const res = await appRequest("/api/kits/k1", {
      headers: { "X-Device-ID": deviceId },
    });

    expect(res.status).toBe(200);
    expect(getKitByIdService).toHaveBeenCalledWith("k1", { deviceId, userId: null }, { includeUsage: false });
  });
});

