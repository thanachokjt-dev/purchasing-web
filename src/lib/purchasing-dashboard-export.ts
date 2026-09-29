import {
  expenseCategories,
  type PurchasingDashboardData,
} from "./purchasing-dashboard-model";
import { zipStore } from "./cost-price-monitor-export";

type Cell = number | string | null;
const xml = (value: unknown) =>
  String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .slice(0, 32767)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const col = (index: number): string =>
  index < 26
    ? String.fromCharCode(65 + index)
    : col(Math.floor(index / 26) - 1) + col(index % 26);
const total = (values: number[]) => values.reduce((a, b) => a + b, 0);
type Sheet = {
  name: string;
  rows: Cell[][];
  levels?: number[];
  spark?: { first: number; last: number; target: number; rows: number[] };
  chart?: boolean;
};

export function purchasingExportSheets(data: PurchasingDashboardData): Sheet[] {
  const monthLabels = data.period.months.map((month) => month.label);
  const summary: Sheet = {
    name: "Overview",
    chart: true,
    rows: [
      ["ภาพรวมจัดซื้อ (THB)"],
      [
        `${data.period.start} ถึง ${data.period.end} · Paid เท่านั้น · เดือนล่าสุดยังไม่ครบ · VAT รวมแยกออกแล้ว`,
      ],
      ["ประเภทค่าใช้จ่าย", "รวม THB", "สัดส่วน %", ...monthLabels, "Sparkline"],
      ...data.categories.map((category) => [
        category.label,
        category.total,
        data.grossPaid ? (category.total / data.grossPaid) * 100 : 0,
        ...category.monthly,
        "",
      ]),
      [
        "รวมยอดจ่ายจริง",
        data.grossPaid,
        data.grossPaid ? 100 : 0,
        ...data.monthly,
        "",
      ],
    ],
    spark: { first: 3, last: 6, target: 7, rows: [4, 5, 6, 7, 8, 9] },
  };
  const products: Sheet = {
    name: "New products",
    rows: [
      ["สินค้าใหม่ / ออเดอร์ครั้งแรก"],
      [
        "SKU ใน PO ครั้งแรกจากประวัติทั้งหมด · Qty / ต้นทุนดิบตามวันที่ PO · จ่ายจริงตามวันที่ Payment ไม่รวม VAT · ไม่รวม Landed cost · กด + เพื่อเปิด SKU · แถวกลุ่มเป็นผลรวม ห้ามรวมซ้ำกับแถว SKU",
      ],
      [
        "หมวดสินค้า",
        "กลุ่มสินค้า",
        "SKU",
        "Qty รวม",
        "มูลค่าต้นทุนดิบ THB",
        "จ่ายจริง THB",
        "Qty ไม่มีต้นทุน",
        ...monthLabels.map((label) => `จ่าย ${label}`),
        "Sparkline",
        ...monthLabels.map((label) => `Qty ${label}`),
        ...monthLabels.map((label) => `มูลค่าดิบ ${label}`),
        "PO",
        "วันที่ PO",
        "ต้นทุนดิบ / หน่วย THB",
      ],
    ],
    levels: [0, 0, 0],
    spark: { first: 7, last: 10, target: 11, rows: [] },
  };
  for (const group of data.newGroups) {
    products.rows.push([
      group.category,
      group.name,
      `${group.skus.length} SKUs`,
      total(group.quantities),
      total(group.costs),
      total(group.paid),
      group.missingCostQty,
      ...group.paid,
      "",
      ...group.quantities,
      ...group.costs,
      "",
      "",
      null,
    ]);
    products.levels!.push(0);
    products.spark!.rows.push(products.rows.length);
    for (const sku of group.skus) {
      const lines = group.lines.filter((line) => line.sku === sku);
      const records = data.records.filter(
        (record) =>
          record.category === "new" &&
          record.groupKey === group.key &&
          record.sku === sku,
      );
      const paid = data.period.months.map((month) =>
        records
          .filter((record) => record.date.startsWith(month.key))
          .reduce((sum, record) => sum + record.amountThb, 0),
      );
      const quantities = data.period.months.map((month) =>
        lines
          .filter((line) => line.date.startsWith(month.key))
          .reduce((sum, line) => sum + line.qty, 0),
      );
      const costs = data.period.months.map((month) =>
        lines
          .filter((line) => line.date.startsWith(month.key))
          .reduce((sum, line) => sum + (line.costThb ?? 0), 0),
      );
      products.rows.push([
        group.category,
        group.name,
        sku,
        total(quantities),
        total(costs),
        total(paid),
        lines
          .filter((line) => line.costThb == null)
          .reduce((sum, line) => sum + line.qty, 0),
        ...paid,
        "",
        ...quantities,
        ...costs,
        [
          ...new Set([
            ...lines.map((line) => line.poId),
            ...records.map((record) => record.poId),
          ]),
        ].join(", "),
        lines.map((line) => line.date).join(", "),
        lines.length === 1 ? lines[0].unitThb : null,
      ]);
      products.levels!.push(1);
      products.spark!.rows.push(products.rows.length);
    }
  }
  const payments: Sheet = {
    name: "Payments",
    rows: [
      ["รายละเอียดเงินจ่ายจริง (THB)"],
      [
        "Amount allocated THB คือยอดแต่ละส่วน รวมแล้วเท่ากับยอดจ่ายจริง · Gross payment THB ซ้ำเมื่อ Payment เดียวถูกแบ่งหลายส่วน ห้ามรวมคอลัมน์ Gross",
      ],
      [
        "วันที่จ่าย",
        "PO",
        "ซัพพลายเออร์",
        "ประเภท Payment",
        "หมวดค่าใช้จ่าย",
        "กลุ่มสินค้า",
        "SKU",
        "Amount allocated THB",
        "Gross payment THB (reference only)",
        "Payment ID",
        "Reference",
        "Note",
      ],
      ...data.records.map((record) => [
        record.date,
        record.poId,
        record.supplier,
        record.type,
        expenseCategories.find((category) => category.key === record.category)!
          .label,
        record.groupName,
        record.sku,
        record.amountThb,
        record.grossThb,
        record.paymentId,
        record.reference,
        record.note,
      ]),
    ],
  };
  const sources: Sheet = {
    name: "Definitions",
    rows: [
      ["นิยามและข้อมูลที่ต้องตรวจสอบ"],
      [
        "แหล่งข้อมูล: PO / PO items / Payments / Product catalog / Purchasing controls",
      ],
      ["หัวข้อ", "รายละเอียด"],
      [
        "ช่วงเวลา",
        `${data.period.start} – ${data.period.end} (Asia/Bangkok) · 4 เดือนปฏิทินรวมเดือนปัจจุบัน`,
      ],
      [
        "ยอดจ่ายจริง",
        "Paid ตาม payment_date · ไม่รวม Planned · ไม่คาดเดา FX ที่หายไป",
      ],
      [
        "สินค้าใหม่",
        "SKU ใน PO ครั้งแรกจากประวัติทั้งหมด ไม่รวม Draft / Cancelled และ Qty ที่ยกเลิก · รวม SKU ชื่อกลุ่มเดียวกัน",
      ],
      [
        "ต้นทุนสินค้า",
        "Qty × Unit price THB จากแต่ละ PO ไม่รวม Freight / Landed cost และไม่ใช้ราคาประเมินหรือ Manual cost override",
      ],
      [
        "FX สินค้า",
        "THB ใช้ 1 · สกุลอื่นใช้ FX ที่ Apply ไว้ใน PO หรือค่าเฉลี่ย FX ของ Product payment ใน PO นั้น",
      ],
      [
        "ใหม่ / เดิม",
        "Payment สินค้าใน PO ผสมแบ่งตามสัดส่วนต้นทุนดิบของแต่ละ SKU ปัดเศษในระดับสตางค์ให้ตรงยอดเดิม",
      ],
      [
        "VAT",
        "VAT ที่แยกไว้ใน Payment ย้ายจากหมวดเดิมมารวมกับ VAT / IMPORT VAT จึงไม่ถูกนับซ้ำ",
      ],
      [
        "ค่าขนส่ง",
        "Shipping / Freight / Customs / Duty / Clearance / Brokerage หรือประเภทภาษาไทยที่ระบุขนส่ง ศุลกากร หรือพิธีการ",
      ],
      [
        "Other รุ่นเก่า",
        "Other ที่ Reference / Note ระบุ VAT หรือค่าศุลกากรชัดเจน จัดเข้าหมวดนั้น โดยไม่แก้ข้อมูลต้นฉบับ",
      ],
      [
        "รายการยกเลิก",
        "ยอด Paid ของ PO ที่ยกเลิกยังคงรวมเป็นเงินจริง แต่ไม่ปันส่วนเข้ากลุ่มสินค้าใหม่",
      ],
      ["อัปเดตข้อมูล", data.generatedAt],
      ...data.warnings.map((warning) => ["ข้อควรตรวจสอบ", warning]),
    ],
  };
  return [summary, products, payments, sources];
}

function worksheet(sheet: Sheet) {
  const count = Math.max(...sheet.rows.map((row) => row.length));
  const sparks = sheet.spark
    ? `<extLst><ext uri="{05C60535-1F16-4fd2-B633-F4F36F0B64E0}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:sparklineGroups xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><x14:sparklineGroup displayEmptyCellsAs="zero" markers="1"><x14:colorSeries rgb="FF2563EB"/><x14:colorNegative rgb="FFDC2626"/><x14:colorAxis rgb="FFCBD5E1"/><x14:colorMarkers rgb="FF2563EB"/><x14:sparklines>${sheet.spark.rows.map((row) => `<x14:sparkline><xm:f>'${xml(sheet.name)}'!${col(sheet.spark!.first)}${row}:${col(sheet.spark!.last)}${row}</xm:f><xm:sqref>${col(sheet.spark!.target)}${row}</xm:sqref></x14:sparkline>`).join("")}</x14:sparklines></x14:sparklineGroup></x14:sparklineGroups></ext></extLst>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><outlinePr summaryBelow="0"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24" outlineLevelRow="1"/><cols>${Array.from({ length: count }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${index < 2 ? 34 : 22}" customWidth="1"/>`).join("")}</cols><sheetData>${sheet.rows
    .map(
      (row, index) =>
        `<row r="${index + 1}" outlineLevel="${sheet.levels?.[index] ?? 0}"${sheet.levels?.[index] === 1 ? ' hidden="1"' : sheet.levels?.[index + 1] === 1 ? ' collapsed="1"' : ""} ht="${index === 1 ? 46 : index === 2 ? 36 : 24}" customHeight="1">${row
          .map((value, column) => {
            const ref = `${col(column)}${index + 1}`,
              style =
                index === 0 || index === 2
                  ? 1
                  : index === 1
                    ? 3
                    : typeof value === "number"
                      ? 2
                      : 0;
            return typeof value === "number" && Number.isFinite(value)
              ? `<c r="${ref}" s="${style}"><v>${value}</v></c>`
              : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join(
      "",
    )}</sheetData><autoFilter ref="A3:${col(count - 1)}${Math.max(3, sheet.rows.length)}"/><mergeCells count="2"><mergeCell ref="A1:${col(count - 1)}1"/><mergeCell ref="A2:${col(count - 1)}2"/></mergeCells><pageSetup orientation="landscape" paperSize="9"/>${sheet.chart ? '<drawing r:id="rId1"/>' : ""}${sparks}</worksheet>`;
}

function chart(data: PurchasingDashboardData) {
  const labels = data.period.months.map((month) => month.label);
  const series = data.categories
    .map(
      (category, index) =>
        `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>${xml(category.label)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${category.color.slice(1)}"/></a:solidFill></c:spPr><c:cat><c:strRef><c:f>'Overview'!$D$3:$G$3</c:f><c:strCache><c:ptCount val="4"/>${labels.map((label, i) => `<c:pt idx="${i}"><c:v>${xml(label)}</c:v></c:pt>`).join("")}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>'Overview'!$D$${index + 4}:$G$${index + 4}</c:f><c:numCache><c:formatCode>#,##0.00</c:formatCode><c:ptCount val="4"/>${category.monthly.map((value, i) => `<c:pt idx="${i}"><c:v>${value}</c:v></c:pt>`).join("")}</c:numCache></c:numRef></c:val></c:ser>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="stacked"/>${series}<c:gapWidth val="70"/><c:overlap val="100"/><c:axId val="10"/><c:axId val="20"/></c:barChart><c:catAx><c:axId val="10"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:crossAx val="20"/><c:tickLblPos val="nextTo"/></c:catAx><c:valAx><c:axId val="20"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="10"/><c:crosses val="autoZero"/></c:valAx></c:plotArea><c:legend><c:legendPos val="b"/><c:layout/></c:legend><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`;
}

export function purchasingDashboardXlsx(data: PurchasingDashboardData) {
  const sheets = purchasingExportSheets(data);
  const rel =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const relationship = (body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
  return zipStore([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.drawing+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: relationship(
        `<Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/>`,
      ),
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${rel}"><sheets>${sheets.map((sheet, index) => `<sheet name="${sheet.name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: relationship(
        sheets
          .map(
            (_, index) =>
              `<Relationship Id="rId${index + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
          )
          .join("") +
          `<Relationship Id="rId5" Type="${rel}/styles" Target="styles.xml"/>`,
      ),
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/><color rgb="FF172026"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0D233F"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: worksheet(sheet),
    })),
    {
      name: "xl/worksheets/_rels/sheet1.xml.rels",
      content: relationship(
        `<Relationship Id="rId1" Type="${rel}/drawing" Target="../drawings/drawing1.xml"/>`,
      ),
    },
    {
      name: "xl/drawings/_rels/drawing1.xml.rels",
      content: relationship(
        `<Relationship Id="rId1" Type="${rel}/chart" Target="../charts/chart1.xml"/>`,
      ),
    },
    {
      name: "xl/drawings/drawing1.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>11</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>28</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Monthly paid THB"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${rel}" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`,
    },
    { name: "xl/charts/chart1.xml", content: chart(data) },
  ]);
}
