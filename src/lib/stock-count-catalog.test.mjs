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

test("explicit coded and package sizes stay in columns instead of becoming duplicate one-size rows", () => {
  const belt = { product_title: "BT - BJJ Belt", product_type: "", tags: ["Training Tops"], status: "active" };
  const supplement = { product_title: "Fruiting Body", product_type: "", tags: ["Supplement"], status: "active" };
  const protein = { product_title: "ISO - PRO Banana", product_type: "Supplement", tags: ["Supplement"], status: "active" };
  const lines = buildStockCountCatalogSnapshot([
    row({ sku: "BT-BELT-BLK-A0", variant_title: "Black / A0", option1_name: "Color", option1_value: "Black", option2_name: "Size", option2_value: "A0", products: belt }),
    row({ sku: "BT-BELT-BLK-A1", variant_title: "Black / A1", option1_name: "Color", option1_value: "Black", option2_name: "Size", option2_value: "A1", products: belt }),
    row({ sku: "FB-CHAG-60", variant_title: "Chaga / 60 Caps", option1_name: "Type", option1_value: "Chaga", option2_name: "Size", option2_value: "60 Caps", products: supplement }),
    row({ sku: "FB-CHAG-90", variant_title: "Chaga / 90 Caps", option1_name: "Type", option1_value: "Chaga", option2_name: "Size", option2_value: "90 Caps", products: supplement }),
    row({ sku: "FB-CHAG-120", variant_title: "Chaga / 120 Caps", option1_name: "Type", option1_value: "Chaga", option2_name: "Size", option2_value: "120 Caps", products: supplement }),
    row({ sku: "ISOP-BANANA-2LB", variant_title: "2LB", option1_name: "Size", option1_value: "2LB", products: protein }),
    row({ sku: "ISOP-BANANA-5LB", variant_title: "5LB", option1_name: "Size", option1_value: "5LB", products: protein }),
  ]);

  assert.deepEqual(lines.map((line) => [line.product_name, line.size, line.family]), [
    ["Fruiting Body - Chaga", "60 CAPS", "unknown"],
    ["Fruiting Body - Chaga", "90 CAPS", "unknown"],
    ["Fruiting Body - Chaga", "120 CAPS", "unknown"],
    ["ISO - PRO Banana", "2 LB", "unknown"],
    ["ISO - PRO Banana", "5 LB", "unknown"],
    ["BT - BJJ Belt - Black", "A0", "unknown"],
    ["BT - BJJ Belt - Black", "A1", "unknown"],
  ]);
  assert.equal(new Set(lines.slice(0, 3).map((line) => line.product_group_key)).size, 1);
  assert.ok(lines.slice(0, 5).every((line) => line.section_name === "Supplement"));
  assert.equal(new Set(lines.slice(3, 5).map((line) => line.product_group_key)).size, 1);
  assert.equal(new Set(lines.slice(5).map((line) => line.product_group_key)).size, 1);
  assert.ok(lines.every((line) => !line.product_name.includes("[")));
});
