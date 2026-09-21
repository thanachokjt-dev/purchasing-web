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
