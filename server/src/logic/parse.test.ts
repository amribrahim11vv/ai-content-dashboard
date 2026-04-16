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

  it("normalizes legacy string and array payloads to string arrays", () => {
    const fromString = buildSubmissionSnapshot({
      target_audience: "youth, entrepreneurs",
      platforms: "instagram، tiktok",
      best_content_types: "educational, testimonials",
    });
    expect(fromString.target_audience).toEqual(["youth", "entrepreneurs"]);
    expect(fromString.platforms).toEqual(["instagram", "tiktok"]);
    expect(fromString.best_content_types).toEqual(["educational", "testimonials"]);

    const fromArray = buildSubmissionSnapshot({
      target_audience: ["youth", "youth", "students"],
      platforms: ["instagram", "tiktok", "instagram"],
      best_content_types: ["educational", "testimonials", "educational"],
    });
    expect(fromArray.target_audience).toEqual(["youth", "students"]);
    expect(fromArray.platforms).toEqual(["instagram", "tiktok"]);
    expect(fromArray.best_content_types).toEqual(["educational", "testimonials"]);
  });
});
