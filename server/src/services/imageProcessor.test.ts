import { describe, expect, it } from "vitest";
import { estimateBase64ByteLength, parseReferenceImageFromDataUrl } from "./imageProcessor.js";

describe("imageProcessor", () => {
  it("estimates base64 payload size", () => {
    expect(estimateBase64ByteLength("aGVsbG8=")).toBeGreaterThan(0);
  });

  it("parses valid data URL and returns mime+payload", () => {
    const dataUrl = "data:image/png;base64,aGVsbG8=";
    const parsed = parseReferenceImageFromDataUrl(dataUrl);
    expect(parsed?.mimeType).toBe("image/png");
    expect(parsed?.dataBase64).toBe("aGVsbG8=");
  });
});
