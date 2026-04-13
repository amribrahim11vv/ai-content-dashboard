import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSubmissionSnapshot } from "./parse.js";
import { shouldRunContentPackageChain } from "./packageEnv.js";

describe("shouldRunContentPackageChain", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when env disabled", () => {
    vi.stubEnv("CONTENT_PACKAGE_CHAIN_ENABLED", "false");
    const s = buildSubmissionSnapshot({ include_content_package: true });
    expect(shouldRunContentPackageChain(s)).toBe(false);
  });

  it("is false when flag off", () => {
    vi.stubEnv("CONTENT_PACKAGE_CHAIN_ENABLED", "true");
    const s = buildSubmissionSnapshot({});
    expect(shouldRunContentPackageChain(s)).toBe(false);
  });

  it("is true when env true and body flag true", () => {
    vi.stubEnv("CONTENT_PACKAGE_CHAIN_ENABLED", "true");
    const s = buildSubmissionSnapshot({ include_content_package: true });
    expect(shouldRunContentPackageChain(s)).toBe(true);
  });
});
