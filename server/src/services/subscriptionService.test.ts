import { describe, expect, it } from "vitest";
import {
  enforceGenerateEntitlements,
  enforceRegenerateEntitlements,
  enforceRetryEntitlements,
  normalizePlanCode,
  shouldBootstrapAdmin,
  type AccessContext,
} from "./subscriptionService.js";

function accessOf(
  planCode: "starter" | "early_adopter" | "admin_unlimited",
  usage?: Partial<AccessContext["usage"]>
): AccessContext {
  return {
    userId: null,
    deviceId: "test-device",
    planCode,
    usage: {
      periodKey: "2026-04",
      videoPromptsUsed: usage?.videoPromptsUsed ?? 0,
      imagePromptsUsed: usage?.imagePromptsUsed ?? 0,
      retryUsed: usage?.retryUsed ?? 0,
      regenerateUsed: usage?.regenerateUsed ?? 0,
    },
  };
}

describe("subscription plan policy", () => {
  it("blocks free users from non-social mode and reference image", () => {
    expect(() =>
      enforceGenerateEntitlements(accessOf("starter"), {
        campaignMode: "offer",
        hasReferenceImage: false,
        requestedVideoPrompts: 1,
        requestedImagePrompts: 1,
      })
    ).toThrow(/PLAN_MODE_LOCKED/);
    expect(() =>
      enforceGenerateEntitlements(accessOf("starter"), {
        campaignMode: "social",
        hasReferenceImage: true,
        requestedVideoPrompts: 1,
        requestedImagePrompts: 1,
      })
    ).toThrow(/PLAN_REFERENCE_IMAGE_LOCKED/);
  });

  it("blocks starter users when monthly video or image quota is exhausted", () => {
    expect(() =>
      enforceGenerateEntitlements(accessOf("starter", { videoPromptsUsed: 1 }), {
        campaignMode: "social",
        hasReferenceImage: false,
        requestedVideoPrompts: 1,
        requestedImagePrompts: 0,
      })
    ).toThrow(/PLAN_MONTHLY_VIDEO_PROMPTS_EXCEEDED/);
    expect(() =>
      enforceGenerateEntitlements(accessOf("starter", { imagePromptsUsed: 2 }), {
        campaignMode: "social",
        hasReferenceImage: false,
        requestedVideoPrompts: 0,
        requestedImagePrompts: 1,
      })
    ).toThrow(/PLAN_MONTHLY_IMAGE_PROMPTS_EXCEEDED/);
  });

  it("allows early adopter users on offer/deep with reference image", () => {
    expect(() =>
      enforceGenerateEntitlements(accessOf("early_adopter"), {
        campaignMode: "deep",
        hasReferenceImage: true,
        requestedVideoPrompts: 2,
        requestedImagePrompts: 3,
      })
    ).not.toThrow();
  });

  it("applies retry/regenerate limits for starter and skips for early adopter", () => {
    expect(() => enforceRetryEntitlements(accessOf("starter"))).toThrow(/PLAN_MONTHLY_RETRY_EXCEEDED/);
    expect(() => enforceRegenerateEntitlements(accessOf("starter"))).toThrow(/PLAN_MONTHLY_REGENERATE_EXCEEDED/);
    expect(() => enforceRetryEntitlements(accessOf("early_adopter", { retryUsed: 999 }))).not.toThrow();
    expect(() => enforceRegenerateEntitlements(accessOf("early_adopter", { regenerateUsed: 999 }))).not.toThrow();
  });

  it("treats admin_unlimited as unlimited plan", () => {
    expect(() =>
      enforceGenerateEntitlements(accessOf("admin_unlimited", { videoPromptsUsed: 99999, imagePromptsUsed: 99999 }), {
        campaignMode: "deep",
        hasReferenceImage: true,
        requestedVideoPrompts: 99999,
        requestedImagePrompts: 99999,
      })
    ).not.toThrow();
    expect(() => enforceRetryEntitlements(accessOf("admin_unlimited", { retryUsed: 99999 }))).not.toThrow();
    expect(() =>
      enforceRegenerateEntitlements(accessOf("admin_unlimited", { regenerateUsed: 99999 }))
    ).not.toThrow();
  });

  it("normalizes admin plan aliases", () => {
    expect(normalizePlanCode("admin")).toBe("admin_unlimited");
    expect(normalizePlanCode("admin_unlimited")).toBe("admin_unlimited");
    expect(normalizePlanCode("free")).toBe("starter");
    expect(normalizePlanCode("creator_pro")).toBe("early_adopter");
    expect(normalizePlanCode("agency")).toBe("early_adopter");
  });

  it("bootstraps admin only for SUPER_ADMIN_EMAIL", () => {
    process.env.SUPER_ADMIN_EMAIL = "owner@example.com";
    expect(shouldBootstrapAdmin("owner@example.com")).toBe(true);
    expect(shouldBootstrapAdmin("OWNER@example.com")).toBe(true);
    expect(shouldBootstrapAdmin("other@example.com")).toBe(false);
  });
});
