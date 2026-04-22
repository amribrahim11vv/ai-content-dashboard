import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import puppeteer from "puppeteer";
import {
  createExportViewModel,
  normalizeKitForExport,
  type ExportSafeKit,
} from "./exportModel.js";

type KitPayload = {
  id: string;
  brief_json: unknown;
  result_json: unknown;
  created_at: unknown;
};

type BrandingConfig = {
  agencyName: string;
  contactLine?: string;
  logoUrl?: string;
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
    posts: ReturnType<typeof createExportViewModel>["posts"];
    imageDesigns: ReturnType<typeof createExportViewModel>["imageDesigns"];
  };
};

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
const FALLBACK_TEMPLATE = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{title}}</title>
    <style>{{{css}}}</style>
  </head>
  <body>
    <main class="pdf-fallback">
      <h1>{{kit.brandName}}</h1>
      <p>ID: {{kit.id}}</p>
      <p>{{kit.createdAt}}</p>
      {{#if kit.narrativeSummary}}<p>{{kit.narrativeSummary}}</p>{{/if}}
    </main>
  </body>
</html>`;
const FALLBACK_CSS = `
body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
.pdf-fallback h1 { margin: 0 0 8px; font-size: 24px; }
.pdf-fallback p { margin: 0 0 8px; font-size: 14px; line-height: 1.6; }
`;


function resolveBranding(): BrandingConfig {
  return {
    agencyName: String(process.env.PDF_AGENCY_NAME ?? "Agency Export").trim() || "Agency Export",
    contactLine: String(process.env.PDF_AGENCY_CONTACT ?? "").trim(),
    logoUrl: String(process.env.PDF_AGENCY_LOGO_URL ?? "").trim(),
  };
}

export function sanitizeKitForPdf(kit: KitPayload): ExportSafeKit {
  return normalizeKitForExport(kit);
}

function createViewModel(kit: ExportSafeKit): KitPdfViewModel {
  const model = createExportViewModel(kit);
  return {
    title: `${model.brandName} - Kit Export`,
    branding: resolveBranding(),
    kit: {
      id: model.id,
      brandName: model.brandName,
      createdAt: model.createdAt,
      narrativeSummary: model.narrativeSummary,
      diagnosisPlan: model.diagnosisPlan,
      posts: model.posts,
      imageDesigns: model.imageDesigns,
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
  if (!templateSource) templateSource = FALLBACK_TEMPLATE;
  if (!cssSource) cssSource = FALLBACK_CSS;
  cachedCss = cssSource;
  cachedTemplate = Handlebars.compile(templateSource, { noEscape: true });
  return cachedTemplate;
}

export async function buildKitPdfHtml(kit: KitPayload): Promise<string> {
  const template = await getCompiledTemplate();
  const viewModel = createViewModel(sanitizeKitForPdf(kit));
  return template({ ...viewModel, css: cachedCss });
}

export async function generateKitPdf(kitData: KitPayload): Promise<Buffer> {
  const html = await buildKitPdfHtml(kitData);
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
