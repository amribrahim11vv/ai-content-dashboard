import type { GeminiReferenceImage } from "../logic/geminiClient.js";
import { HttpError } from "./serviceErrors.js";

const MAX_REFERENCE_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_REFERENCE_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

export function estimateBase64ByteLength(base64Text: string): number {
  const clean = String(base64Text ?? "").replace(/\s+/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

export function parseReferenceImageFromDataUrl(referenceImageValue: string): GeminiReferenceImage | undefined {
  const raw = String(referenceImageValue ?? "").trim();
  if (!raw) return undefined;
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new HttpError(400, "reference_image must be a valid base64 data URL.");
  }
  const mimeType = String(match[1] ?? "").trim().toLowerCase();
  const dataBase64 = String(match[2] ?? "").trim();
  if (!ALLOWED_REFERENCE_IMAGE_MIME.has(mimeType)) {
    throw new HttpError(400, "reference_image mime type is not supported.");
  }
  if (!dataBase64) {
    throw new HttpError(400, "reference_image payload is empty.");
  }
  const bytes = estimateBase64ByteLength(dataBase64);
  if (bytes <= 0 || bytes > MAX_REFERENCE_IMAGE_BYTES) {
    throw new HttpError(400, `reference_image is too large. Max allowed is ${MAX_REFERENCE_IMAGE_BYTES} bytes.`);
  }
  return { mimeType, dataBase64 };
}
