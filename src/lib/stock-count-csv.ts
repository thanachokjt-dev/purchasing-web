import {
  matrixItemFamily,
  matrixSectionLabel,
  sizeSortRank,
  sortMatrixSizes,
  type MatrixFamily,
} from "@/lib/po-size-matrix";

export type StockCountCsvLine = {
  id: string;
  family: MatrixFamily;
  productGroupKey: string;
  productName: string;
  sectionName: string;
  size: string;
  sku: string;
  tags: string[];
  countedQty: number | null;
};

const META_HEADERS = ["Section", "Family", "Product", "Tags", "Group Key"] as const;
const MATRIX_PRODUCT_HEADER = "PRODUCT";
const MATRIX_TOTAL_HEADER = "TOTAL";
const MATRIX_GROUP_HEADER = "GROUP KEY";

type CsvFormula = { formula: string };

function safeSpreadsheetText(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number | null | CsvFormula) {
  if (typeof value === "object" && value !== null) {
    return `"${value.formula.replace(/"/g, '""')}"`;
  }
  const text = value === null ? "" : safeSpreadsheetText(String(value));
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: Array<string | number | null | CsvFormula>) {
  return values.map(csvCell).join(",");
}

function formula(expression: string): CsvFormula {
  return { formula: `=${expression}` };
}

function spreadsheetColumn(index: number) {
  let column = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    column = String.fromCharCode(65 + ((value - 1) % 26)) + column;
  }
  return column;
}

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function familyRank(family: MatrixFamily) {
  return ["glove", "protective", "apparel", "child-code", "child-numeric", "one-size", "unknown"].indexOf(family);
}

export function stockCountSizeColumns(lines: StockCountCsvLine[]) {
  const representative = new Map<string, MatrixFamily>();
  for (const line of lines) {
    const current = representative.get(line.size);
    if (!current || familyRank(line.family) < familyRank(current)) {
      representative.set(line.size, line.family);
    }
  }
  return Array.from(representative.keys()).sort((a, b) => {
    const familyA = representative.get(a) ?? matrixItemFamily({ variantTitle: a });
    const familyB = representative.get(b) ?? matrixItemFamily({ variantTitle: b });
    return familyRank(familyA) - familyRank(familyB)
      || sizeSortRank(a, familyA) - sizeSortRank(b, familyB)
      || a.localeCompare(b);
  });
}

export function serializeStockCountCsv(lines: StockCountCsvLine[]) {
  const sections = new Map<string, StockCountCsvLine[]>();
  for (const line of lines) {
    const key = `${line.sectionName}\u0000${line.family}`;
    const section = sections.get(key) ?? [];
    section.push(line);
    sections.set(key, section);
  }

  const rows: string[] = [];
  let spreadsheetRow = 1;
  const orderedSections = Array.from(sections.values()).sort((a, b) =>
    compareText(a[0].sectionName, b[0].sectionName)
    || familyRank(a[0].family) - familyRank(b[0].family),
  );

  orderedSections.forEach((sectionLines, sectionIndex) => {
    const first = sectionLines[0];
    const label = matrixSectionLabel(first.sectionName, first.family).toUpperCase();
    const sizes = sortMatrixSizes(sectionLines.map((line) => line.size), first.family);
    const productGroups = new Map<string, StockCountCsvLine[]>();
    for (const line of sectionLines) {
      const group = productGroups.get(line.productGroupKey) ?? [];
      group.push(line);
      productGroups.set(line.productGroupKey, group);
    }
    const products = Array.from(productGroups.values()).sort((a, b) =>
      compareText(a[0].productName, b[0].productName)
      || compareText(a[0].productGroupKey, b[0].productGroupKey),
    );

    rows.push(csvRow([label]));
    spreadsheetRow += 1;
    rows.push(csvRow([MATRIX_PRODUCT_HEADER, ...sizes, MATRIX_TOTAL_HEADER, MATRIX_GROUP_HEADER]));
    spreadsheetRow += 1;
    const firstProductRow = spreadsheetRow;
    const firstSizeColumn = spreadsheetColumn(1);
    const lastSizeColumn = spreadsheetColumn(sizes.length);
    const totalColumn = spreadsheetColumn(sizes.length + 1);

    for (const product of products) {
      const productFirst = product[0];
      const bySize = new Map(product.map((line) => [line.size, line.countedQty]));
      rows.push(csvRow([
        productFirst.productName,
        ...sizes.map((size) => bySize.has(size) ? (bySize.get(size) ?? null) : null),
        formula(`SUM(${firstSizeColumn}${spreadsheetRow}:${lastSizeColumn}${spreadsheetRow})`),
        productFirst.productGroupKey,
      ]));
      spreadsheetRow += 1;
    }

    rows.push(csvRow([
      `${label} TOTAL`,
      ...sizes.map((_, sizeIndex) => {
        const column = spreadsheetColumn(sizeIndex + 1);
        return formula(`SUM(${column}${firstProductRow}:${column}${spreadsheetRow - 1})`);
      }),
      formula(`SUM(${totalColumn}${firstProductRow}:${totalColumn}${spreadsheetRow - 1})`),
      null,
    ]));
    spreadsheetRow += 1;
    if (sectionIndex < orderedSections.length - 1) {
      rows.push("");
      spreadsheetRow += 1;
    }
  });

  return `\uFEFF${rows.join("\r\n")}`;
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function parseCount(raw: string, row: number, size: string, errors: string[]) {
  if (!raw) return null;
  const quantity = Number(raw);
  if (!Number.isInteger(quantity) || quantity < 0) {
    errors.push(`Row ${row}, ${size}: use a whole number 0 or greater.`);
    return undefined;
  }
  return quantity;
}

function legacyStockCountValues(rows: string[][], lines: StockCountCsvLine[]) {
  const headers = rows[0].map((value) => value.trim());
  for (const [index, required] of META_HEADERS.entries()) {
    if (headers[index] !== required) throw new Error(`Column ${index + 1} must be ${required}.`);
  }

  const groupIndex = headers.indexOf("Group Key");
  const sizeHeaders = headers.slice(META_HEADERS.length);
  const lineByKey = new Map(lines.map((line) => [`${line.productGroupKey}\u0000${line.size}`, line]));
  const values = new Map<string, number | null>();
  const errors: string[] = [];

  rows.slice(1).forEach((cells, rowOffset) => {
    const groupKey = (cells[groupIndex] ?? "").trim().replace(/^'/, "");
    if (!groupKey) return;
    sizeHeaders.forEach((size, sizeOffset) => {
      const line = lineByKey.get(`${groupKey}\u0000${size}`);
      if (!line) return;
      const raw = (cells[META_HEADERS.length + sizeOffset] ?? "").trim();
      const quantity = parseCount(raw, rowOffset + 2, size, errors);
      if (quantity === undefined) return;
      if (values.has(line.id)) errors.push(`Row ${rowOffset + 2}, ${size}: duplicate product/size.`);
      values.set(line.id, quantity);
    });
  });

  if (errors.length) throw new Error(errors.slice(0, 8).join("\n"));
  if (!values.size) throw new Error("No matching count cells were found in this CSV.");
  return Array.from(values, ([lineId, countedQty]) => ({ lineId, countedQty }));
}

function matrixStockCountValues(rows: string[][], lines: StockCountCsvLine[]) {
  const lineByKey = new Map(lines.map((line) => [`${line.productGroupKey}\u0000${line.size}`, line]));
  const values = new Map<string, number | null>();
  const errors: string[] = [];
  let header: { sizes: Array<{ name: string; index: number }>; groupIndex: number } | null = null;

  rows.forEach((cells, rowIndex) => {
    const normalized = cells.map((value) => value.trim());
    if (normalized[0] === MATRIX_PRODUCT_HEADER) {
      const totalIndex = normalized.indexOf(MATRIX_TOTAL_HEADER);
      const groupIndex = normalized.indexOf(MATRIX_GROUP_HEADER);
      if (totalIndex < 2 || groupIndex <= totalIndex) {
        errors.push(`Row ${rowIndex + 1}: PRODUCT header must include size columns, TOTAL, and GROUP KEY.`);
        header = null;
        return;
      }
      header = {
        sizes: normalized.slice(1, totalIndex).map((name, index) => ({ name, index: index + 1 })),
        groupIndex,
      };
      return;
    }
    if (!header) return;

    const groupKey = (cells[header.groupIndex] ?? "").trim().replace(/^'/, "");
    if (!groupKey) return;
    for (const size of header.sizes) {
      const line = lineByKey.get(`${groupKey}\u0000${size.name}`);
      if (!line) continue;
      const quantity = parseCount((cells[size.index] ?? "").trim(), rowIndex + 1, size.name, errors);
      if (quantity === undefined) continue;
      if (values.has(line.id)) errors.push(`Row ${rowIndex + 1}, ${size.name}: duplicate product/size.`);
      values.set(line.id, quantity);
    }
  });

  if (errors.length) throw new Error(errors.slice(0, 8).join("\n"));
  if (!values.size) throw new Error("No matching count cells were found in this CSV.");
  return Array.from(values, ([lineId, countedQty]) => ({ lineId, countedQty }));
}

export function stockCountValuesFromCsv(text: string, lines: StockCountCsvLine[]) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV is empty.");
  const isMatrixFormat = rows.some((row) => row[0]?.trim() === MATRIX_PRODUCT_HEADER);
  return isMatrixFormat
    ? matrixStockCountValues(rows, lines)
    : legacyStockCountValues(rows, lines);
}
