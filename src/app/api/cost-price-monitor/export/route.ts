import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth";
import {
  AVG_PURCHASE_COST_CUTOFF_DATE,
  FIXED_LANDCOST_ESTIMATE,
  getCostPriceMonitorData,
} from "@/lib/cost-price-monitor";
import { canAccessCostPriceMonitor } from "@/lib/role-nav";

export const dynamic = "force-dynamic";

type CellValue = number | string | null | undefined;

const headers = [
  "Main Name / Product Family",
  "Color",
  "Visibility",
  "SKU count",
  "SKUs / variants",
  "Total stock qty",
  "Supplier",
  "Category",
  "Product Group",
  "Unit summary mode",
  `Purchase / unit (PO >= ${AVG_PURCHASE_COST_CUTOFF_DATE})`,
  "Purchase / unit source",
  "Latest purchase / unit",
  "Landed / unit",
  "Latest landed / unit",
  "Max estimated land cost / unit",
  "Max estimated cost",
  "Estimated margin %",
  "Selling price",
  "Margin %",
  "Latest invoice / quote",
  "Latest PO status",
  "Latest purchase date",
  "Manual purchase override",
  "Manual landed add-on",
  "Manual selling override",
  "Note / remark",
  "Image URL",
];

function xmlEscape(value: CellValue) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const modulo = (value - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    value = Math.floor((value - modulo) / 26);
  }
  return name;
}

function sheetCell(value: CellValue, rowIndex: number, columnIndex: number) {
  const ref = `${columnName(columnIndex)}${rowIndex}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
}

function sheetRow(values: CellValue[], rowIndex: number) {
  return `<row r="${rowIndex}">${values.map((value, index) => sheetCell(value, rowIndex, index)).join("")}</row>`;
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function zipStore(files: Array<{ name: string; content: string }>) {
  const now = dosDateTime(new Date());
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name);
    const content = Buffer.from(file.content, "utf8");
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(now.dosTime, 10);
    local.writeUInt16LE(now.dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(now.dosTime, 12);
    central.writeUInt16LE(now.dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + content.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, central, end]);
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cost Price Monitor" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

function worksheetXml(rows: CellValue[][]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows
    .map((row, index) => sheetRow(row, index + 1))
    .join("")}</sheetData></worksheet>`;
}

function xlsx(rows: CellValue[][]) {
  return zipStore([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
    { name: "xl/workbook.xml", content: workbookXml() },
    { name: "xl/worksheets/sheet1.xml", content: worksheetXml(rows) },
  ]);
}

function safeFilenamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toNonNegativeNumber(value: string | null, fallback: number) {
  if (!value?.trim()) {
    return fallback;
  }
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function printBaseCost(row: { averagePurchasePrice: number; latestPurchasePrice: number }) {
  return row.averagePurchasePrice > 0 ? row.averagePurchasePrice : row.latestPurchasePrice > 0 ? row.latestPurchasePrice : 0;
}

function averagePurchaseSourceLabel(source: "recent_avg" | "latest_fallback" | "manual" | "missing") {
  if (source === "manual") {
    return "Manual override";
  }
  if (source === "recent_avg") {
    return "Recent avg";
  }
  if (source === "latest_fallback") {
    return "Latest cost fallback";
  }
  return "Missing cost";
}

function printLandedAddOn(row: { manualLandedCost: number | null }, estimatedLandCost: number) {
  return (row.manualLandedCost ?? 0) > 0 ? row.manualLandedCost ?? 0 : estimatedLandCost;
}

function estimatedMarginPct(estimatedCost: number, sellingPrice: number) {
  if (estimatedCost <= 0 || sellingPrice <= 0) {
    return null;
  }
  return ((sellingPrice - estimatedCost) / sellingPrice) * 100;
}

function exportFilename({
  group,
  isSelected,
  stamp,
  suppliers,
}: {
  group: string;
  isSelected: boolean;
  stamp: string;
  suppliers: string[];
}) {
  if (isSelected) {
    return `wholesale_catalog_selected_${stamp}.xlsx`;
  }
  const supplierPart = suppliers.length === 1 ? safeFilenamePart(suppliers[0]) : suppliers.length > 1 ? "multiple_suppliers" : "";
  const groupPart = safeFilenamePart(group);
  if (!supplierPart && !groupPart) {
    return `wholesale_catalog_export_${stamp}.xlsx`;
  }
  return `wholesale_catalog_${supplierPart || "all"}${groupPart ? `_${groupPart}` : ""}_${stamp}.xlsx`;
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile?.isActive) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!canAccessCostPriceMonitor(profile)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const supplierFilters = searchParams.getAll("supplier");
  const selectedFilters = searchParams.getAll("selected");
  const estimatedLandCost = toNonNegativeNumber(searchParams.get("estimatedLandCost"), FIXED_LANDCOST_ESTIMATE);
  const data = await getCostPriceMonitorData({
    category: searchParams.get("category") ?? undefined,
    direction: searchParams.get("direction") ?? undefined,
    exportAll: true,
    group: searchParams.get("group") ?? undefined,
    lowMarginOnly: searchParams.get("lowMarginOnly") ?? undefined,
    missingCostOnly: searchParams.get("missingCostOnly") ?? undefined,
    poStatus: searchParams.get("poStatus") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    selected: selectedFilters.length ? selectedFilters : undefined,
    sort: searchParams.get("sort") ?? undefined,
    supplier: supplierFilters.length ? supplierFilters : undefined,
    visibility: searchParams.get("visibility") ?? undefined,
  });
  const rows: CellValue[][] = [
    headers,
    ...data.rows.map((row) => {
      const baseCost = printBaseCost(row);
      const landedAddOn = printLandedAddOn(row, estimatedLandCost);
      const estimatedCost = baseCost > 0 ? baseCost + landedAddOn : 0;
      return [
        row.mainName,
        row.color,
        row.visibility === "hidden" ? "Hidden" : "Active",
        row.skuCount,
        row.skuSummary,
        row.stockQty,
        row.supplier,
        row.category,
        row.productGroup,
        row.rollupMode === "stock_weighted" ? "Weighted" : "No stock fallback",
        row.averagePurchasePrice,
        averagePurchaseSourceLabel(row.averagePurchasePriceSource),
        row.latestPurchasePrice,
        row.averageLandedCost,
        row.latestLandedCost,
        landedAddOn,
        estimatedCost,
        estimatedMarginPct(estimatedCost, row.sellingPrice),
        row.sellingPrice,
        row.marginPct,
        row.latestInvoiceQuoteReference,
        row.latestPoStatus,
        row.latestPurchaseDate,
        row.manualPurchasePrice,
        row.manualLandedCost,
        row.manualSellingPrice,
        row.note,
        row.imageUrl,
      ];
    }),
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  const group = searchParams.get("group") ?? "";
  const filename = exportFilename({ group, isSelected: data.filters.selectedGroupKeys.length > 0, stamp, suppliers: data.filters.suppliers });

  return new NextResponse(xlsx(rows), {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
