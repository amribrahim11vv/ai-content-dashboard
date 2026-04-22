import ExcelJS from "exceljs";
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

const HEADER_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1E3A8A" },
} as const;

const HEADER_FONT = {
  bold: true,
  color: { argb: "FFFFFFFF" },
} as const;

function applyHeaderStyle(row: ExcelJS.Row) {
  row.font = HEADER_FONT;
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
}

function applyDataWrap(worksheet: ExcelJS.Worksheet, startRow = 2) {
  for (let rowNumber = startRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }
}

export function sanitizeKitForExcel(kit: KitPayload): ExportSafeKit {
  return normalizeKitForExport(kit);
}

export async function generateKitExcel(kit: KitPayload): Promise<Buffer> {
  const normalized = sanitizeKitForExcel(kit);
  const model = createExportViewModel(normalized);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ai-content-dashboard";
  workbook.created = new Date();
  workbook.modified = new Date();

  const summary = workbook.addWorksheet("Summary", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  summary.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 110 },
  ];
  applyHeaderStyle(summary.getRow(1));
  summary.addRows([
    { field: "Brand", value: model.brandName },
    { field: "Kit ID", value: model.id },
    { field: "Created At", value: model.createdAt },
    { field: "Narrative Summary", value: model.narrativeSummary || "-" },
    {
      field: "Diagnosis Plan",
      value:
        model.diagnosisPlan.length > 0
          ? model.diagnosisPlan.map((item) => `${item.label}: ${item.value}`).join("\n")
          : "-",
    },
  ]);
  applyDataWrap(summary);

  const postsSheet = workbook.addWorksheet("Posts", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  postsSheet.columns = [
    { header: "Platform", key: "platform", width: 16 },
    { header: "Format", key: "format", width: 14 },
    { header: "Goal", key: "goal", width: 20 },
    { header: "Caption", key: "caption", width: 68 },
    { header: "Hashtags", key: "hashtags", width: 34 },
    { header: "CTA", key: "cta", width: 30 },
  ];
  applyHeaderStyle(postsSheet.getRow(1));
  if (model.posts.length > 0) {
    postsSheet.addRows(
      model.posts.map((item) => ({
        platform: item.platform,
        format: item.format,
        goal: item.goal,
        caption: item.caption,
        hashtags: item.hashtags.map((tag) => `#${tag}`).join(" "),
        cta: item.cta,
      }))
    );
  } else {
    postsSheet.addRow({ platform: "-", format: "-", goal: "-", caption: "No posts", hashtags: "-", cta: "-" });
  }
  applyDataWrap(postsSheet);

  const imageSheet = workbook.addWorksheet("ImageDesigns", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  imageSheet.columns = [
    { header: "Platform Format", key: "platformFormat", width: 24 },
    { header: "Design Type", key: "designType", width: 20 },
    { header: "Goal", key: "goal", width: 20 },
    { header: "Caption", key: "caption", width: 60 },
    { header: "Supporting Copy", key: "supportingCopy", width: 60 },
  ];
  applyHeaderStyle(imageSheet.getRow(1));
  if (model.imageDesigns.length > 0) {
    imageSheet.addRows(model.imageDesigns);
  } else {
    imageSheet.addRow({
      platformFormat: "-",
      designType: "-",
      goal: "-",
      caption: "No image designs",
      supportingCopy: "-",
    });
  }
  applyDataWrap(imageSheet);

  const uint8 = await workbook.xlsx.writeBuffer();
  return Buffer.from(uint8);
}
