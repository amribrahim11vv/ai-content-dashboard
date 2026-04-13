import { describe, expect, it } from "vitest";
import {
  enforceGenerateEntitlements,
  enforceRegenerateEntitlements,
  enforceRetryEntitlements,
  type AccessContext,
} from "./subscriptionService.js";

function accessOf(planCode: "free" | "creator_pro" | "agency", usage?: Partial<AccessContext["usage"]>): AccessContext {
  return {
    userId: null,
    deviceId: "test-device",
    planCode,
    usage: {
      periodKey: "2026-04",
      kitsUsed: usage?.kitsUsed ?? 0,
      retryUsed: usage?.retryUsed ?? 0,
      regenerateUsed: usage?.regenerateUsed ?? 0,
    },
  };
}

describe("subscription plan policy", () => {
  it("blocks free users from non-social mode and reference image", () => {
    expect(() =>
      enforceGenerateEntitlements(accessOf("free"), { campaignMode: "offer", hasReferenceImage: false })
    ).toThrow(/PLAN_MODE_LOCKED/);
    expect(() =>
      enforceGenerateEntitlements(accessOf("free"), { campaignMode: "social", hasReferenceImage: true })
    ).toThrow(/PLAN_REFERENCE_IMAGE_LOCKED/);
  });

  it("blocks free users when monthly kits are exhausted", () => {
    expect(() =>
      enforceGenerateEntitlements(accessOf("free", { kitsUsed: 2 }), {
        campaignMode: "social",
        hasReferenceImage: false,
      })
    ).toThrow(/PLAN_MONTHLY_KITS_EXCEEDED/);
  });

  it("allows pro users on offer/deep with reference image", () => {
    expect(() =>
      enforceGenerateEntitlements(accessOf("creator_pro", { kitsUsed: 10 }), {
        campaignMode: "deep",
        hasReferenceImage: true,
      })
    ).not.toThrow();
  });

  it("applies retry/regenerate limits for free and skips for agency", () => {
    expect(() => enforceRetryEntitlements(accessOf("free"))).toThrow(/PLAN_MONTHLY_RETRY_EXCEEDED/);
    expect(() => enforceRegenerateEntitlements(accessOf("free"))).toThrow(/PLAN_MONTHLY_REGENERATE_EXCEEDED/);
    expect(() => enforceRetryEntitlements(accessOf("agency", { retryUsed: 999 }))).not.toThrow();
    expect(() => enforceRegenerateEntitlements(accessOf("agency", { regenerateUsed: 999 }))).not.toThrow();
  });
});
