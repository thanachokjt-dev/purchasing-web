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
];

test("CSV round-trip preserves blank as null and zero as counted", () => {
  const csv = serializeStockCountCsv(lines);
  const values = stockCountValuesFromCsv(csv, lines);
  assert.deepEqual(values, [
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
  const csv = serializeStockCountCsv(lines).replace(',"","0"', ',"-1","1.5"');
  assert.throws(() => stockCountValuesFromCsv(csv, lines), /whole number 0 or greater/);
});
