import { describe, expect, it, vi, beforeEach } from "vitest";

const generateKitService = vi.fn();
const listKitsService = vi.fn();
const getKitByIdService = vi.fn();
const regenerateKitItemService = vi.fn();
const retryKitService = vi.fn();
const patchKitUiPreferencesService = vi.fn();
const deleteKitService = vi.fn();
const generateKitPdf = vi.fn();
const generateKitExcel = vi.fn();
const isAgencyAdminRequest = vi.fn();

vi.mock("../services/kitGenerationService.js", () => ({
  generateKitService,
  listKitsService,
  getKitByIdService,
  regenerateKitItemService,
  retryKitService,
  patchKitUiPreferencesService,
  deleteKitService,
}));

vi.mock("../services/pdfService.js", () => ({
  generateKitPdf,
}));

vi.mock("../services/excelService.js", () => ({
  generateKitExcel,
}));

vi.mock("../middleware/agencyAdminAuth.js", () => ({
  isAgencyAdminRequest,
}));

async function appRequest(path: string, init?: RequestInit) {
  const { createKitsRouter } = await import("./kits.js");
  const app = createKitsRouter(async (_c, next) => next());
  return app.request(path, init);
}

describe("kits routes device header enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAgencyAdminRequest.mockResolvedValue(false);
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

  it("sanitizes SSE error message in production mode", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const deviceId = "8e46f65c-c7d7-4b5e-a860-f48e183f3a24";
      generateKitService.mockRejectedValueOnce(new Error("raw internal error details"));
      const res = await appRequest("/api/kits/generate?stream=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "idem-stream-error",
          "X-Device-ID": deviceId,
        },
        body: JSON.stringify({ brand_name: "Stream", industry: "SaaS" }),
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("event: error");
      expect(text).toContain("\"message\":\"Unexpected error while generating kit.\"");
      expect(text).not.toContain("raw internal error details");
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
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
      business_links: "https://example.com https://instagram.com/example",
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
        body: expect.objectContaining({
          business_links: "https://example.com https://instagram.com/example",
        }),
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

  it("exports pdf for admin sessions only", async () => {
    isAgencyAdminRequest.mockImplementation(async (c: { set: (k: string, v: unknown) => void }) => {
      c.set("agencyAdminSession", { username: "ops-admin" });
      return true;
    });
    getKitByIdService.mockResolvedValueOnce({
      id: "k-pdf",
      brief_json: "{\"brand_name\":\"Florenza\"}",
      result_json: { posts: [] },
      created_at: "2026-04-22T10:00:00.000Z",
    });
    generateKitPdf.mockResolvedValueOnce(Buffer.from("%PDF-test"));

    const res = await appRequest("/api/kits/k-pdf/export-pdf?scope=all", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("kit-k-pdf.pdf");
    expect(getKitByIdService).toHaveBeenCalledWith("k-pdf", undefined, { includeUsage: true });
    expect(generateKitPdf).toHaveBeenCalledWith({
      id: "k-pdf",
      brief_json: "{\"brand_name\":\"Florenza\"}",
      result_json: { posts: [] },
      created_at: "2026-04-22T10:00:00.000Z",
    });
  });

  it("blocks pdf export when requester is not admin", async () => {
    isAgencyAdminRequest.mockResolvedValue(false);
    const res = await appRequest("/api/kits/k-pdf/export-pdf?scope=all", {
      method: "GET",
      headers: { "X-Device-ID": "a4be40b8-2ac6-4f59-9e14-a5cf6f39b4bd" },
    });
    expect([401, 403]).toContain(res.status);
    expect(generateKitPdf).not.toHaveBeenCalled();
  });

  it("exports excel for admin sessions only", async () => {
    isAgencyAdminRequest.mockImplementation(async (c: { set: (k: string, v: unknown) => void }) => {
      c.set("agencyAdminSession", { username: "ops-admin" });
      return true;
    });
    getKitByIdService.mockResolvedValueOnce({
      id: "k-xlsx",
      brief_json: "{\"brand_name\":\"Florenza\"}",
      result_json: { posts: [] },
      created_at: "2026-04-22T10:00:00.000Z",
    });
    generateKitExcel.mockResolvedValueOnce(Buffer.from("xlsx-bytes"));

    const res = await appRequest("/api/kits/k-xlsx/export-excel?scope=all", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(res.headers.get("content-disposition")).toContain("kit-k-xlsx.xlsx");
    expect(getKitByIdService).toHaveBeenCalledWith("k-xlsx", undefined, { includeUsage: true });
    expect(generateKitExcel).toHaveBeenCalledWith({
      id: "k-xlsx",
      brief_json: "{\"brand_name\":\"Florenza\"}",
      result_json: { posts: [] },
      created_at: "2026-04-22T10:00:00.000Z",
    });
  });

  it("blocks excel export when requester is not admin", async () => {
    isAgencyAdminRequest.mockResolvedValue(false);
    const res = await appRequest("/api/kits/k-xlsx/export-excel?scope=all", {
      method: "GET",
      headers: { "X-Device-ID": "a4be40b8-2ac6-4f59-9e14-a5cf6f39b4bd" },
    });
    expect([401, 403]).toContain(res.status);
    expect(generateKitExcel).not.toHaveBeenCalled();
  });

  it("normalizes malformed export payload fields before PDF generation", async () => {
    isAgencyAdminRequest.mockImplementation(async (c: { set: (k: string, v: unknown) => void }) => {
      c.set("agencyAdminSession", { username: "ops-admin" });
      return true;
    });
    getKitByIdService.mockResolvedValueOnce({
      id: "k-malformed",
      brief_json: { brand_name: "Malformed Brief" },
      result_json: null,
      created_at: "not-a-date",
    });
    generateKitPdf.mockResolvedValueOnce(Buffer.from("%PDF-test"));

    const res = await appRequest("/api/kits/k-malformed/export-pdf?scope=all", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    expect(generateKitPdf).toHaveBeenCalledWith({
      id: "k-malformed",
      brief_json: "{\"brand_name\":\"Malformed Brief\"}",
      result_json: {},
      created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("patches ui preferences with ownership context", async () => {
    const deviceId = "43cef6f6-6085-4f41-b244-5b1a91c3b4af";
    patchKitUiPreferencesService.mockResolvedValueOnce({
      status: 200,
      body: { id: "k-pref", ui_preferences: { lang: "en" } },
    });

    const res = await appRequest("/api/kits/k-pref/ui-preferences", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Device-ID": deviceId,
      },
      body: JSON.stringify({
        ui_preferences: { lang: "en", open_map: { "kit-section-posts": true } },
      }),
    });

    expect(res.status).toBe(200);
    expect(patchKitUiPreferencesService).toHaveBeenCalledWith({
      id: "k-pref",
      owner: { deviceId, userId: null },
      uiPreferences: { lang: "en", open_map: { "kit-section-posts": true } },
    });
  });

  it("uses fallback delete reason when query reason is missing", async () => {
    isAgencyAdminRequest.mockImplementation(async (c: { set: (k: string, v: unknown) => void }) => {
      c.set("agencyAdminSession", { username: "ops-admin" });
      return true;
    });
    deleteKitService.mockResolvedValueOnce({ status: 200, body: { ok: true, id: "k-del" } });

    const res = await appRequest("/api/kits/k-del", {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    expect(deleteKitService).toHaveBeenCalledWith({
      id: "k-del",
      actorType: "admin_session",
      actorId: "ops-admin",
      reason: "manual_admin_cleanup",
      metadata: { source: "admin_api" },
    });
  });

  it("passes audit actor and reason into delete service", async () => {
    isAgencyAdminRequest.mockImplementation(async (c: { set: (k: string, v: unknown) => void }) => {
      c.set("agencyAdminSession", { username: "ops-admin" });
      return true;
    });
    deleteKitService.mockResolvedValueOnce({ status: 200, body: { ok: true, id: "k-del" } });

    const res = await appRequest("/api/kits/k-del?reason=duplicate+cleanup", {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    expect(deleteKitService).toHaveBeenCalledWith({
      id: "k-del",
      actorType: "admin_session",
      actorId: "ops-admin",
      reason: "duplicate cleanup",
      metadata: { source: "admin_api" },
    });
  });
});

