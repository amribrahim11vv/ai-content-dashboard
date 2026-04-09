import type { KitPostItem } from "../../../types";

export const TOC_ID = "kit-plan-toc";
export const SCROLL_MARGIN = "6rem";

export type ViewerLang = "ar" | "en";

export type MediaRecord = Record<string, unknown>;

export const IMAGE_DESIGN_FIELD_DEFS: { key: string; label: string }[] = [
  { key: "platform_format", label: "Format" },
  { key: "design_type", label: "Design type" },
  { key: "goal", label: "Goal" },
  { key: "visual_scene", label: "Visual scene" },
  { key: "headline_text_overlay", label: "Headline overlay" },
  { key: "supporting_copy", label: "Supporting copy" },
  { key: "full_ai_image_prompt", label: "Full AI image prompt" },
  { key: "caption", label: "Caption" },
  { key: "text_policy", label: "Text policy" },
  { key: "conversion_trigger", label: "Conversion trigger" },
];

export function isRecord(v: unknown): v is MediaRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function pickByLang(
  item: MediaRecord | KitPostItem,
  lang: ViewerLang,
  keyAr: string,
  keyEn: string,
  legacyKey?: string
): string {
  const ar = (item as MediaRecord)[keyAr];
  const en = (item as MediaRecord)[keyEn];
  const legacy = legacyKey ? (item as MediaRecord)[legacyKey] : undefined;
  if (lang === "ar" && typeof ar === "string" && ar.trim()) return ar.trim();
  if (lang === "en" && typeof en === "string" && en.trim()) return en.trim();
  if (typeof ar === "string" && ar.trim()) return ar.trim();
  if (typeof en === "string" && en.trim()) return en.trim();
  if (typeof legacy === "string" && legacy.trim()) return legacy.trim();
  return "";
}

export function isVideoBlueprint(rec: MediaRecord): boolean {
  const s = rec.scenes;
  return Array.isArray(s) && s.length > 0 && s.some((x) => isRecord(x));
}

export function isRichImageDesign(rec: MediaRecord): boolean {
  if (isVideoBlueprint(rec)) return false;
  return IMAGE_DESIGN_FIELD_DEFS.some(({ key }) => {
    const v = rec[key];
    return typeof v === "string" && v.trim().length > 0;
  });
}

export function videoBlueprintFormattedCopy(rec: MediaRecord): string {
  const lines: string[] = [];
  for (const key of ["platform", "duration", "style", "hook_type"] as const) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) lines.push(`${key}: ${v}`);
  }
  const scenes = Array.isArray(rec.scenes) ? rec.scenes.filter((x): x is MediaRecord => isRecord(x)) : [];
  scenes.forEach((sc, i) => {
    lines.push("");
    const head = [
      `Scene ${i + 1}`,
      typeof sc.time === "string" ? sc.time : "",
      typeof sc.label === "string" ? sc.label : "",
    ]
      .filter(Boolean)
      .join(" — ");
    lines.push(head);
    for (const k of ["visual", "text", "audio"] as const) {
      const v = sc[k];
      if (typeof v === "string" && v.trim()) lines.push(`${k}: ${v}`);
    }
  });
  for (const key of ["ai_tool_instructions", "why_this_converts"] as const) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) {
      lines.push("");
      lines.push(`${key}: ${v}`);
    }
  }
  return lines.join("\n");
}

export function imageDesignFormattedCopy(rec: MediaRecord): string {
  const parts: string[] = [];
  for (const { key, label } of IMAGE_DESIGN_FIELD_DEFS) {
    if (key === "caption") continue;
    const v = rec[key];
    if (typeof v === "string" && v.trim()) parts.push(`${label}: ${v}`);
  }
  return parts.join("\n\n");
}

export function getKitMediaItemTitle(rec: MediaRecord, index: number, fallback: "image" | "video"): string {
  const fromTitle =
    (typeof rec.title === "string" && rec.title) ||
    (typeof rec.name === "string" && rec.name) ||
    (typeof rec.scene === "string" && rec.scene) ||
    (typeof rec.design_type === "string" && rec.design_type) ||
    (typeof rec.platform === "string" && rec.platform);
  if (fromTitle) return fromTitle;
  return `${fallback === "image" ? "Image" : "Video"} ${index + 1}`;
}

export function getKitMediaPlainBody(rec: MediaRecord, kind: "image" | "video"): string {
  const tryKeys =
    kind === "image"
      ? [
          "full_ai_image_prompt",
          "visual_scene",
          "headline_text_overlay",
          "supporting_copy",
          "prompt",
          "description",
          "visual",
        ]
      : ["prompt", "description", "script", "visual"];
  const chunks: string[] = [];
  for (const k of tryKeys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) chunks.push(v.trim());
  }
  if (chunks.length) return chunks.join("\n\n");
  return JSON.stringify(rec, null, 2);
}

export function kitArticleShellClass(expanded: boolean): string {
  return (
    "relative isolate min-h-0 min-w-0 max-w-full overflow-x-clip overflow-y-visible rounded-2xl border border-brand-sand/30 bg-earth-card/90 p-3 sm:p-4 dark:border-outline/25 dark:bg-surface-container-lowest/60 " +
    (expanded ? "z-20 shadow-lg shadow-surface/30" : "z-0")
  );
}

export type TocItem = { id: string; label: string };
