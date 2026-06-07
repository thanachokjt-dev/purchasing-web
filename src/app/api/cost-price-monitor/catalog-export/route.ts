import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth";
import {
  catalogScopeLine,
  formatEtaDate,
  formatThb,
  generatedCatalogDate,
  resolveCatalogRows,
  safeFilenamePart,
  toNonNegativeNumber,
} from "@/lib/cost-price-catalog";
import {
  FIXED_LANDCOST_ESTIMATE,
  getCostPriceMonitorData,
} from "@/lib/cost-price-monitor";
import { canAccessCostPriceMonitor } from "@/lib/role-nav";

export const dynamic = "force-dynamic";

type CellValue = number | string | null | undefined;

const catalogHeaders = [
  "Product Group",
  "Product Name",
  "Image URL",
  "Current Qty",
  "Incoming Qty",
  "Total Qty",
  "Latest Purchase / Unit",
  "Max Estimated Land Cost / Unit",
  "Max Estimated Cost",
  "Sales Price",
  "Margin %",
  "Incoming Expected Arrival",
  "Incoming Timing",
  "Incoming Quarter",
  "Incoming PO Reference",
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

function worksheetXml(rows: CellValue[][]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows
    .map((row, index) => sheetRow(row, index + 1))
    .join("")}</sheetData></worksheet>`;
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

function workbookXml(sheets: string[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
    .map((sheet, index) => `<sheet name="${xmlEscape(sheet)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("")}</sheets></workbook>`;
}

function workbookRelsXml(sheetCount: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("")}</Relationships>`;
}

function contentTypesXml(sheetCount: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("")}</Types>`;
}

function xlsx(sheets: Array<{ name: string; rows: CellValue[][] }>) {
  return zipStore([
    { name: "[Content_Types].xml", content: contentTypesXml(sheets.length) },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRelsXml(sheets.length) },
    { name: "xl/workbook.xml", content: workbookXml(sheets.map((sheet) => sheet.name)) },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: worksheetXml(sheet.rows) })),
  ]);
}

function catalogFilename({
  isSelected,
  stamp,
  suppliers,
}: {
  isSelected: boolean;
  stamp: string;
  suppliers: string[];
}) {
  if (isSelected) {
    return `wholesale_catalog_selected_print_version_${stamp}.xlsx`;
  }
  if (suppliers.length === 1) {
    return `wholesale_catalog_${safeFilenamePart(suppliers[0])}_print_version_${stamp}.xlsx`;
  }
  if (suppliers.length > 1) {
    return `wholesale_catalog_multiple_suppliers_print_version_${stamp}.xlsx`;
  }
  return `wholesale_catalog_print_version_${stamp}.xlsx`;
}

function marginValue(value: number | null) {
  return value === null ? "N/A" : value;
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
    sort: searchParams.get("sort") || "main_name",
    supplier: supplierFilters.length ? supplierFilters : undefined,
    visibility: searchParams.get("visibility") ?? undefined,
  });
  const { catalogRows } = await resolveCatalogRows(data.rows, estimatedLandCost, searchParams.get("group") ?? "");
  const scope = catalogScopeLine({
    category: searchParams.get("category") ?? undefined,
    group: searchParams.get("group") ?? undefined,
    lowMarginOnly: searchParams.get("lowMarginOnly") ?? undefined,
    missingCostOnly: searchParams.get("missingCostOnly") ?? undefined,
    poStatus: searchParams.get("poStatus") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    selected: selectedFilters.length ? selectedFilters : undefined,
    selectedRowCount: data.rows.length,
    suppliers: data.filters.suppliers,
    visibility: searchParams.get("visibility") ?? undefined,
  });
  const metadataRows: CellValue[][] = [
    ["Title", "Wholesale Catalog"],
    ["Generated", generatedCatalogDate()],
    ["Scope", scope],
    ["Visibility", data.filters.visibility === "hidden" ? "Hidden only" : data.filters.visibility === "all" ? "All" : "Active only"],
    ["Max estimated land cost / unit", formatThb(estimatedLandCost)],
  ];
  const catalogRowsForSheet: CellValue[][] = [
    catalogHeaders,
    ...catalogRows.map((catalogRow) => [
      catalogRow.groupLabel,
      catalogRow.productName,
      catalogRow.row.imageUrl,
      catalogRow.currentQty,
      catalogRow.incomingQty,
      catalogRow.totalQty,
      catalogRow.latestPurchaseCost,
      catalogRow.landedAddOn,
      catalogRow.estimatedCost,
      catalogRow.row.sellingPrice > 0 ? catalogRow.row.sellingPrice : "N/A",
      marginValue(catalogRow.marginPct),
      catalogRow.incomingEta ? formatEtaDate(catalogRow.incomingEta.etaDate) : "",
      catalogRow.incomingEta?.timing ?? "",
      catalogRow.incomingEta?.quarter ?? "",
      catalogRow.incomingEta?.poReference ?? "",
    ]),
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = catalogFilename({
    isSelected: data.filters.selectedGroupKeys.length > 0,
    stamp,
    suppliers: data.filters.suppliers,
  });

  return new NextResponse(
    xlsx([
      { name: "Metadata", rows: metadataRows },
      { name: "Catalog", rows: catalogRowsForSheet },
    ]),
    {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    },
  );
}
