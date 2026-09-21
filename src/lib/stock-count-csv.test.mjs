import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function moduleFromTypeScript(path, replacements = []) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of replacements) source = source.replace(from, to);
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
}

const sizeMatrixUrl = await moduleFromTypeScript("./po-size-matrix.ts");
const csvUrl = await moduleFromTypeScript("./stock-count-csv.ts", [
  ["@/lib/po-size-matrix", sizeMatrixUrl],
]);
const { parseCsv, serializeStockCountCsv, stockCountValuesFromCsv } = await import(csvUrl);

const lines = [
  {
    id: "line-s",
    family: "apparel",
    productGroupKey: "tops::apparel::alpha",
    productName: "Alpha, Training Shirt",
    sectionName: "TOPS",
    size: "S",
    sku: "ALPHA-S",
    tags: ["training", "shirt"],
    countedQty: null,
  },
  {
    id: "line-m",
    family: "apparel",
    productGroupKey: "tops::apparel::alpha",
    productName: "Alpha, Training Shirt",
    sectionName: "TOPS",
    size: "M",
    sku: "ALPHA-M",
    tags: ["training", "shirt"],
    countedQty: 0,
  },
  {
    id: "line-glove",
    family: "glove",
    productGroupKey: "muay-thai-gloves::glove::origin",
    productName: "Origin Gloves",
    sectionName: "MUAY THAI GLOVES",
    size: "12 OZ",
    sku: "ORIGIN-12",
    tags: ["muay thai gloves"],
    countedQty: 7,
  },
];

test("CSV uses PO-style section blocks and section-specific size columns", () => {
  const csv = serializeStockCountCsv(lines);
  const rows = parseCsv(csv);
  assert.deepEqual(rows[0], ["MUAY THAI GLOVES · GLOVES"]);
  assert.deepEqual(rows[1], ["PRODUCT", "12 OZ", "TOTAL", "GROUP KEY"]);
  assert.ok(rows.some((row) => row[0] === "MUAY THAI GLOVES · GLOVES TOTAL"));
  assert.ok(rows.some((row) => row[0] === "TOPS · APPAREL"));
  assert.ok(rows.some((row) => row.join("|") === "PRODUCT|S|M|TOTAL|GROUP KEY"));
});

test("CSV round-trip preserves blank, zero, and positive counts", () => {
  const csv = serializeStockCountCsv(lines);
  const values = stockCountValuesFromCsv(csv, lines);
  assert.deepEqual(values, [
    { lineId: "line-glove", countedQty: 7 },
    { lineId: "line-s", countedQty: null },
    { lineId: "line-m", countedQty: 0 },
  ]);
});

test("CSV parser handles quoted commas, quotes, and newlines", () => {
  assert.deepEqual(parseCsv('"A","B"\r\n"hello, world","say ""yes"""\r\n"two\nlines",3'), [
    ["A", "B"],
    ["hello, world", 'say "yes"'],
    ["two\nlines", "3"],
  ]);
});

test("CSV import rejects negative and fractional counts", () => {
  const csv = [
    '"TOPS · APPAREL"',
    '"PRODUCT","S","M","TOTAL","GROUP KEY"',
    '"Alpha, Training Shirt","-1","1.5","","tops::apparel::alpha"',
  ].join("\r\n");
  assert.throws(() => stockCountValuesFromCsv(csv, lines), /whole number 0 or greater/);
});

test("CSV import remains compatible with the original flat export", () => {
  const csv = [
    '"Section","Family","Product","Tags","Group Key","S","M"',
    '"TOPS","apparel","Alpha, Training Shirt","training; shirt","tops::apparel::alpha","3",""',
  ].join("\r\n");
  assert.deepEqual(stockCountValuesFromCsv(csv, lines), [
    { lineId: "line-s", countedQty: 3 },
    { lineId: "line-m", countedQty: null },
  ]);
});
