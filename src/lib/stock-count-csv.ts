import {
  matrixItemFamily,
  sizeSortRank,
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

function safeSpreadsheetText(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : safeSpreadsheetText(String(value));
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: Array<string | number | null>) {
  return values.map(csvCell).join(",");
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
  const sizes = stockCountSizeColumns(lines);
  const groups = new Map<string, StockCountCsvLine[]>();
  for (const line of lines) {
    const group = groups.get(line.productGroupKey) ?? [];
    group.push(line);
    groups.set(line.productGroupKey, group);
  }
  const rows = Array.from(groups.values())
    .sort((a, b) =>
      a[0].sectionName.localeCompare(b[0].sectionName)
      || familyRank(a[0].family) - familyRank(b[0].family)
      || a[0].productName.localeCompare(b[0].productName),
    )
    .map((group) => {
      const first = group[0];
      const bySize = new Map(group.map((line) => [line.size, line.countedQty]));
      return csvRow([
        first.sectionName,
        first.family,
        first.productName,
        first.tags.join("; "),
        first.productGroupKey,
        ...sizes.map((size) => bySize.has(size) ? (bySize.get(size) ?? null) : null),
      ]);
    });
  return `\uFEFF${[csvRow([...META_HEADERS, ...sizes]), ...rows].join("\r\n")}`;
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

export function stockCountValuesFromCsv(text: string, lines: StockCountCsvLine[]) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV is empty.");
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
      if (!raw) {
        values.set(line.id, null);
        return;
      }
      const quantity = Number(raw);
      if (!Number.isInteger(quantity) || quantity < 0) {
        errors.push(`Row ${rowOffset + 2}, ${size}: use a whole number 0 or greater.`);
        return;
      }
      if (values.has(line.id)) errors.push(`Row ${rowOffset + 2}, ${size}: duplicate product/size.`);
      values.set(line.id, quantity);
    });
  });

  if (errors.length) throw new Error(errors.slice(0, 8).join("\n"));
  if (!values.size) throw new Error("No matching count cells were found in this CSV.");
  return Array.from(values, ([lineId, countedQty]) => ({ lineId, countedQty }));
}
