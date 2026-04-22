type ExportInputKit = {
  id: string;
  brief_json: unknown;
  result_json: unknown;
  created_at: unknown;
};

export type ExportPost = {
  platform: string;
  format: string;
  goal: string;
  caption: string;
  hashtags: string[];
  cta: string;
};

export type ExportImageDesign = {
  platformFormat: string;
  designType: string;
  goal: string;
  caption: string;
  supportingCopy: string;
};

export type ExportSafeKit = {
  id: string;
  brief_json: string;
  result_json: Record<string, unknown>;
  created_at: string;
};

export type ExportViewModel = {
  id: string;
  brandName: string;
  createdAt: string;
  narrativeSummary: string;
  diagnosisPlan: Array<{ label: string; value: string }>;
  posts: ExportPost[];
  imageDesigns: ExportImageDesign[];
};

const PROMPT_EXCLUDED_KEYS = new Set([
  "image_prompts",
  "video_prompts",
  "full_ai_image_prompt",
  "ai_tool_instructions",
  "why_this_converts",
]);

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pickFirst(...values: unknown[]): string {
  for (const value of values) {
    const parsed = readString(value);
    if (parsed) return parsed;
  }
  return "";
}

function parseBriefBrandName(briefJson: string): string {
  try {
    const parsed = JSON.parse(briefJson) as Record<string, unknown>;
    return readString(parsed.brand_name);
  } catch {
    return "";
  }
}

function sanitizeDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (PROMPT_EXCLUDED_KEYS.has(key)) continue;
    output[key] = sanitizeDeep(raw);
  }
  return output;
}

function normalizeHashtags(value: unknown): string[] {
  return toArray(value)
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^#/, ""));
}

function normalizePosts(resultJson: Record<string, unknown>): ExportPost[] {
  return toArray(resultJson.posts).map((entry) => {
    const item = toRecord(entry);
    return {
      platform: readString(item.platform),
      format: readString(item.format),
      goal: readString(item.goal),
      caption: pickFirst(item.post_ar, item.post_en, item.post, item.caption),
      hashtags: normalizeHashtags(item.hashtags),
      cta: readString(item.cta),
    };
  });
}

function normalizeImageDesigns(resultJson: Record<string, unknown>): ExportImageDesign[] {
  return toArray(resultJson.image_designs).map((entry) => {
    const item = toRecord(entry);
    return {
      platformFormat: readString(item.platform_format),
      designType: readString(item.design_type),
      goal: readString(item.goal),
      caption: pickFirst(item.caption_ar, item.caption_en, item.caption),
      supportingCopy: readString(item.supporting_copy),
    };
  });
}

function normalizeDiagnosisPlan(resultJson: Record<string, unknown>): Array<{ label: string; value: string }> {
  const plan = toRecord(resultJson.diagnosis_plan);
  return [
    { label: "Quick Win 24h", value: pickFirst(plan.quickWin24h, plan.quick_win_24h) },
    { label: "Focus 7d", value: pickFirst(plan.focus7d, plan.focus_7d) },
    { label: "Scale 30d", value: pickFirst(plan.scale30d, plan.scale_30d) },
  ].filter((entry) => entry.value);
}

function safeLocalizedDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toLocaleString("ar-EG");
  return parsed.toLocaleString("ar-EG");
}

export function normalizeBriefJson(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify((value as Record<string, unknown>) ?? {});
  } catch {
    return "{}";
  }
}

export function normalizeResultJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function normalizeCreatedAt(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return value;
  }
  return new Date().toISOString();
}

export function normalizeKitForExport(kit: ExportInputKit): ExportSafeKit {
  return {
    id: String(kit.id),
    brief_json: normalizeBriefJson(kit.brief_json),
    result_json: normalizeResultJson(sanitizeDeep(kit.result_json)) as Record<string, unknown>,
    created_at: normalizeCreatedAt(kit.created_at),
  };
}

export function createExportViewModel(kit: ExportSafeKit): ExportViewModel {
  const resultJson = normalizeResultJson(kit.result_json);
  const brandName = parseBriefBrandName(kit.brief_json) || "Unknown Brand";
  return {
    id: kit.id,
    brandName,
    createdAt: safeLocalizedDate(kit.created_at),
    narrativeSummary: readString(resultJson.narrative_summary),
    diagnosisPlan: normalizeDiagnosisPlan(resultJson),
    posts: normalizePosts(resultJson),
    imageDesigns: normalizeImageDesigns(resultJson),
  };
}
