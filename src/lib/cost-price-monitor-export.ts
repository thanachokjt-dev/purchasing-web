import type { CostPriceMonitorRow } from "./cost-price-monitor";
type CellValue = number | string | null | undefined;
function xmlEscape(value: CellValue) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .slice(0, 32767)
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

function sheetCell(value: CellValue, rowIndex: number, columnIndex: number, style: number) {
  const ref = `${columnName(columnIndex)}${rowIndex}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

type ExportRow = { values: CellValue[]; level?: number; kind?: "title" | "note" | "header" | "group" };
function sheetRow(row: ExportRow, rowIndex: number) {
  const base = row.kind === "header" || row.kind === "title" ? 1 : row.kind === "group" ? 2 : row.kind === "note" ? 5 : 0;
  return `<row r="${rowIndex}" outlineLevel="${row.level ?? 0}" ht="${row.kind === "header" ? 34 : row.kind === "note" ? 42 : 23}" customHeight="1">${row.values.map((value, index) => sheetCell(value, rowIndex, index, base || (index === 14 ? 4 : [8,9,10,11,12,13].includes(index) ? 3 : 0))).join("")}</row>`;
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

function worksheetXml(rows: ExportRow[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><outlinePr summaryBelow="0"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="4" ySplit="3" topLeftCell="E4" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="23" outlineLevelRow="2"/><cols>${[12,36,18,26,24,14,26,14,20,20,24,18,14,18,14,25,16,18,28,36].map((width,index) => `<col min="${index+1}" max="${index+1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData>${rows
    .map((row, index) => sheetRow(row, index + 1))
    .join("")}</sheetData><autoFilter ref="A3:T${Math.max(rows.length,3)}"/><mergeCells count="2"><mergeCell ref="A1:T1"/><mergeCell ref="A2:T2"/></mergeCells><pageSetup orientation="landscape" paperSize="9"/></worksheet>`;
}

function xlsx(rows: ExportRow[]) {
  return zipStore([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/workbook.xml", content: workbookXml() },
    { name: "xl/styles.xml", content: stylesXml },
    { name: "xl/worksheets/sheet1.xml", content: worksheetXml(rows) },
  ]);
}


const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.0000"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/><color rgb="FF243746"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF243746"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF203A52"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function costPriceMonitorExportRows(groups: CostPriceMonitorRow[], warnings: string[] = []): ExportRow[] {
  const rows: ExportRow[] = [
    { kind: "title", values: ["Cost Price Monitor — SKU / PO costs (THB)"] },
    { kind: "note", values: ["SKU rows show the latest PO. PO rows show purchase history (quantity-weighted within each PO). Land cost is actual shipping / freight; missing land cost = 0. Blank THB cost = missing FX. Estimates and manual cost overrides are excluded." + (warnings.length ? " Data warnings: " + warnings.join("; ") : "")] },
    { kind: "header", values: ["Row type", "Product family", "Color", "SKU", "Variant", "Stock qty", "PO", "PO qty", "Cost / unit THB", "Land cost / unit THB", "Cost + land / unit THB", "Saved cost / unit USD", "Recorded FX", "Selling / unit THB", "Margin incl. land %", "Supplier", "PO status", "PO date", "Invoice / quote", "Note"] },
  ];
  for (const group of groups) {
    rows.push({ kind: "group", values: ["GROUP", group.mainName, group.color, "", `${group.skuCount} SKUs`, group.stockQty, "", "", null, null, null, null, null, null, null, group.supplier, "", "", "", group.note] });
    for (const sku of group.skuDetails) {
      const history = sku.poCosts ?? [];
      const costRow = (cost: typeof history[number] | undefined, type: string): CellValue[] => {
        const base = cost ? cost.unitThb : 0, land = cost ? cost.landThb : 0, total = cost ? cost.totalThb : 0;
        const selling = sku.effectiveSellingPrice;
        return [type, group.mainName, group.color, sku.sku, sku.variantTitle, type === "SKU" ? sku.currentQty : null, cost?.poId ?? "", cost?.qty ?? 0, base, land, total,
          cost?.unitUsd ?? null, cost?.fx ?? null, selling, total != null && total > 0 && selling > 0 ? (selling - total) / selling : null, group.supplier,
          cost?.status ?? "", cost?.date ?? "", cost?.reference ?? "", !cost ? "No PO cost" : base == null ? `Missing ${cost.currency} exchange rate in this PO` : "Actual PO cost"];
      };
      rows.push({ level: 1, values: costRow(history[0], "SKU") });
      for (const cost of history) rows.push({ level: 2, values: costRow(cost, "PO") });
    }
  }
  return rows;
}

export function costPriceMonitorXlsx(groups: CostPriceMonitorRow[], warnings: string[] = []) {
  return xlsx(costPriceMonitorExportRows(groups, warnings));
}
