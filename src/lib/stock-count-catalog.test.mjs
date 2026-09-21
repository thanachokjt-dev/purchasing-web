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
const catalogUrl = await moduleFromTypeScript("./stock-count-catalog.ts", [
  ["@/lib/po-size-matrix", sizeMatrixUrl],
]);
const { buildStockCountCatalogSnapshot } = await import(catalogUrl);

function row(overrides) {
  return {
    id: crypto.randomUUID(),
    sku: "SKU",
    variant_title: null,
    effective_status: "active",
    option1_name: null,
    option1_value: null,
    option2_name: null,
    option2_value: null,
    option3_name: null,
    option3_value: null,
    products: { product_title: "Product", product_type: "", tags: [], status: "active" },
    ...overrides,
  };
}

test("color variants become separate product rows while sizes stay in columns", () => {
  const lines = buildStockCountCatalogSnapshot([
    row({ sku: "SHIRT-BLK-S", option1_name: "Color", option1_value: "Black", option2_name: "Size", option2_value: "S", products: { product_title: "Training Shirt", product_type: "Shirt", tags: ["T-Shirts"], status: "active" } }),
    row({ sku: "SHIRT-BLK-M", option1_name: "Color", option1_value: "Black", option2_name: "Size", option2_value: "M", products: { product_title: "Training Shirt", product_type: "Shirt", tags: ["T-Shirts"], status: "active" } }),
    row({ sku: "SHIRT-BLU-S", option1_name: "Color", option1_value: "Blue", option2_name: "Size", option2_value: "S", products: { product_title: "Training Shirt", product_type: "Shirt", tags: ["T-Shirts"], status: "active" } }),
  ]);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map((line) => [line.product_name, line.size]), [
    ["Training Shirt - Black", "S"],
    ["Training Shirt - Black", "M"],
    ["Training Shirt - Blue", "S"],
  ]);
  assert.notEqual(lines[0].product_group_key, lines[2].product_group_key);
});

test("numbers in packaging names are not treated as sizes", () => {
  const [line] = buildStockCountCatalogSnapshot([
    row({
      sku: "WHEY-10-PACK",
      option1_name: "Packaging",
      option1_value: "10 Pack",
      products: { product_title: "My Whey", product_type: "Supplement", tags: ["Protein"], status: "active" },
    }),
  ]);
  assert.equal(line.product_name, "My Whey - 10 Pack");
  assert.equal(line.size, "OS");
  assert.equal(line.family, "one-size");
});

test("duplicate product and size combinations keep every SKU", () => {
  const product = { product_title: "Training Shirt", product_type: "Shirt", tags: ["T-Shirts"], status: "active" };
  const lines = buildStockCountCatalogSnapshot([
    row({ sku: "SHIRT-S-OLD", option1_name: "Size", option1_value: "S", products: product }),
    row({ sku: "SHIRT-S-NEW", option1_name: "Size", option1_value: "S", products: product }),
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].product_name, "Training Shirt");
  assert.match(lines[1].product_name, /\[SHIRT-S-NEW\]/);
});
