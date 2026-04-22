import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import puppeteer from "puppeteer";

type KitPayload = {
  id: string;
  brief_json: string;
  result_json: unknown;
  created_at: string;
};

type BrandingConfig = {
  agencyName: string;
  contactLine?: string;
  logoUrl?: string;
};

type PdfPost = {
  platform: string;
  format: string;
  goal: string;
  caption: string;
  hashtags: string[];
  cta: string;
};

type PdfImageDesign = {
  platformFormat: string;
  designType: string;
  goal: string;
  caption: string;
  supportingCopy: string;
};

type KitPdfViewModel = {
  title: string;
  branding: BrandingConfig;
  kit: {
    id: string;
    brandName: string;
    createdAt: string;
    narrativeSummary: string;
    diagnosisPlan: Array<{ label: string; value: string }>;
    posts: PdfPost[];
    imageDesigns: PdfImageDesign[];
  };
};

const PROMPT_EXCLUDED_KEYS = new Set([
  "image_prompts",
  "video_prompts",
  "full_ai_image_prompt",
  "ai_tool_instructions",
  "why_this_converts",
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePathCandidates = [
  path.resolve(__dirname, "pdf", "kit-template.hbs"),
  path.resolve(process.cwd(), "server", "src", "services", "pdf", "kit-template.hbs"),
];
const cssPathCandidates = [
  path.resolve(__dirname, "pdf", "kit-template.css"),
  path.resolve(process.cwd(), "server", "src", "services", "pdf", "kit-template.css"),
];

type CompiledTemplate = ReturnType<typeof Handlebars.compile>;

let cachedTemplate: CompiledTemplate | null = null;
let cachedCss = "";

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

function safeLocalizedDate(value: unknown): string {
  const raw = readString(value);
  if (!raw) return new Date().toLocaleString("ar-EG");
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toLocaleString("ar-EG");
  return parsed.toLocaleString("ar-EG");
}

function pickFirst(...values: unknown[]): string {
  for (const value of values) {
    const parsed = readString(value);
    if (parsed) return parsed;
  }
  return "";
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

export function sanitizeKitForPdf(kit: KitPayload): KitPayload {
  const safeResult = sanitizeDeep(kit.result_json);
  return {
    ...kit,
    result_json: safeResult,
  };
}

function normalizeHashtags(value: unknown): string[] {
  const src = toArray(value);
  return src
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^#/, ""));
}

function normalizePosts(resultJson: Record<string, unknown>): PdfPost[] {
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

function normalizeImageDesigns(resultJson: Record<string, unknown>): PdfImageDesign[] {
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

function resolveBranding(): BrandingConfig {
  return {
    agencyName: String(process.env.PDF_AGENCY_NAME ?? "Agency Export").trim() || "Agency Export",
    contactLine: String(process.env.PDF_AGENCY_CONTACT ?? "").trim(),
    logoUrl: String(process.env.PDF_AGENCY_LOGO_URL ?? "").trim(),
  };
}

function parseBriefBrandName(briefJson: string): string {
  try {
    const parsed = JSON.parse(briefJson) as Record<string, unknown>;
    return readString(parsed.brand_name);
  } catch {
    return "";
  }
}

function createViewModel(kit: KitPayload): KitPdfViewModel {
  const resultJson = toRecord(kit.result_json);
  const brandName = parseBriefBrandName(kit.brief_json) || "Unknown Brand";
  return {
    title: `${brandName} - Kit Export`,
    branding: resolveBranding(),
    kit: {
      id: kit.id,
      brandName,
      createdAt: safeLocalizedDate(kit.created_at),
      narrativeSummary: readString(resultJson.narrative_summary),
      diagnosisPlan: normalizeDiagnosisPlan(resultJson),
      posts: normalizePosts(resultJson),
      imageDesigns: normalizeImageDesigns(resultJson),
    },
  };
}

async function getCompiledTemplate(): Promise<CompiledTemplate> {
  if (cachedTemplate) return cachedTemplate;
  let templateSource = "";
  let cssSource = "";
  for (const candidate of templatePathCandidates) {
    try {
      templateSource = await fs.readFile(candidate, "utf-8");
      break;
    } catch {
      continue;
    }
  }
  for (const candidate of cssPathCandidates) {
    try {
      cssSource = await fs.readFile(candidate, "utf-8");
      break;
    } catch {
      continue;
    }
  }
  if (!templateSource || !cssSource) {
    throw new Error("PDF template assets not found in dist or src paths.");
  }
  cachedCss = cssSource;
  cachedTemplate = Handlebars.compile(templateSource, { noEscape: true });
  return cachedTemplate;
}

export async function buildKitPdfHtml(kit: KitPayload): Promise<string> {
  const template = await getCompiledTemplate();
  const viewModel = createViewModel(kit);
  return template({ ...viewModel, css: cachedCss });
}

export async function generateKitPdf(kitData: KitPayload): Promise<Buffer> {
  const sanitized = sanitizeKitForPdf(kitData);
  const html = await buildKitPdfHtml(sanitized);
  const launchArgs =
    String(process.env.PDF_PUPPETEER_ARGS ?? "").trim() ||
    "--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage";

  const browser = await puppeteer.launch({
    headless: true,
    args: launchArgs
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  });

  try {
    const page = await browser.newPage();
    await page.emulateMediaType("screen");
    await page.setContent(html, { waitUntil: ["domcontentloaded", "load"], timeout: 120000 });
    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1,
      timeout: 120000,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });
    await page.close();
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}
