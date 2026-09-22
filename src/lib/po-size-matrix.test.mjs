import assert from "node:assert/strict";
import test from "node:test";

import {
  matrixItemFamily,
  matrixItemSize,
  sortMatrixSizes,
} from "./po-size-matrix.ts";

test("numeric glove variants share the same ounce column as explicit Oz variants", () => {
  const numericGlove = {
    productTitle: "Origin Series Muay Thai Gloves 2.0 - Black",
    sku: "BTOS2.0-MTG-BLK-6",
    variantTitle: "6",
  };
  const explicitGlove = {
    productTitle: "Origin Series Muay Thai Gloves 2.0 - Black",
    sku: "BTOS2.0-MTG-BLK-6-OZ",
    variantTitle: "6 Oz",
  };

  assert.equal(matrixItemSize(numericGlove), "6 Oz");
  assert.equal(matrixItemSize(explicitGlove), "6 Oz");
  assert.equal(matrixItemFamily(numericGlove), "glove");
  assert.deepEqual(
    sortMatrixSizes(
      [matrixItemSize(numericGlove), matrixItemSize(explicitGlove)],
      "glove",
    ),
    ["6 Oz"],
  );
});

test("numeric non-glove variants remain numeric child sizes", () => {
  const childItem = {
    productTitle: "Kids Training Shorts",
    sku: "KID-SHORT-6",
    variantTitle: "6",
  };

  assert.equal(matrixItemSize(childItem), "6");
  assert.equal(matrixItemFamily(childItem), "child-numeric");
});

test("4XL is recognized as an apparel size", () => {
  const item = {
    productTitle: "Training Shirt",
    variantTitle: "Black / 4XL",
    sku: "SHIRT-BLK-4XL",
    tags: ["T-Shirts"],
  };

  assert.equal(matrixItemSize(item), "4XL");
  assert.equal(matrixItemFamily(item), "apparel");
});

test("coded and package option sizes are preserved and naturally sorted", () => {
  const belt = { productTitle: "BT - BJJ Belt - Black", variantTitle: "A0", sku: "BT-BELT-BLK-A0" };
  const capsules = { productTitle: "Fruiting Body - Chaga", variantTitle: "120 Caps", sku: "FB-CHAG-120" };
  const protein = { productTitle: "ISO - PRO Banana", variantTitle: "2LB", sku: "ISOP-BANANA-2LB" };

  assert.equal(matrixItemSize(belt), "A0");
  assert.equal(matrixItemSize(capsules), "120 CAPS");
  assert.equal(matrixItemSize(protein), "2 LB");
  assert.equal(matrixItemFamily(belt), "unknown");
  assert.equal(matrixItemFamily(capsules), "unknown");
  assert.deepEqual(sortMatrixSizes(["120 CAPS", "60 CAPS", "90 CAPS"], "unknown"), ["60 CAPS", "90 CAPS", "120 CAPS"]);
  assert.deepEqual(sortMatrixSizes(["A3", "A0", "A1"], "unknown"), ["A0", "A1", "A3"]);
});
