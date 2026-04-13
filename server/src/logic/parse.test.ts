import { describe, expect, it } from "vitest";
import { briefFingerprint, buildSubmissionSnapshot, sanitizeCount } from "./parse.js";

describe("parse helpers", () => {
  it("briefFingerprint is stable for same semantic payload", () => {
    const a = buildSubmissionSnapshot({
      brand_name: "ACME",
      industry: "Retail",
      submitted_at: "2024-01-01T00:00:00.000Z",
      num_posts: 5,
      num_image_designs: 3,
      num_video_prompts: 2,
    });
    const b = buildSubmissionSnapshot({
      brand_name: "ACME",
      industry: "Retail",
      submitted_at: "2024-01-01T00:00:00.000Z",
      num_posts: 5,
      num_image_designs: 3,
      num_video_prompts: 2,
    });
    expect(briefFingerprint(a)).toBe(briefFingerprint(b));
  });

  it("sanitizeCount clamps values into accepted range", () => {
    expect(sanitizeCount(0, 1, 10, 5)).toBe(1);
    expect(sanitizeCount(999, 1, 10, 5)).toBe(10);
    expect(sanitizeCount("3", 1, 10, 5)).toBe(3);
    expect(sanitizeCount("bad", 1, 10, 5)).toBe(5);
  });
});
