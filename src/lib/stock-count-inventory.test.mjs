import assert from "node:assert/strict";
import test from "node:test";
import { stockCountLocationIds, summarizeStockCountInventory } from "./stock-count-inventory.ts";

test("warehouse and retail use distinct verified Shopify location IDs", () => {
  assert.equal(stockCountLocationIds.warehouse, "108167495977");
  assert.equal(stockCountLocationIds.retail, "90925007145");
  assert.notEqual(stockCountLocationIds.warehouse, stockCountLocationIds.retail);
});

test("inventory sums duplicate SKU variants, preserving zero, negatives, and unknown quantities", () => {
  const qty = summarizeStockCountInventory([
    { sku: "A", on_hand: "3" }, { sku: "A", on_hand: 2 },
    { sku: "B", on_hand: 0 }, { sku: "C", on_hand: -2 },
    { sku: "D", on_hand: null }, { sku: "D", on_hand: 7 },
    { sku: "E", on_hand: "invalid" }, { sku: "__proto__", on_hand: 4 },
    { sku: null, on_hand: 99 },
  ]);
  assert.equal(qty.A, 5);
  assert.equal(qty.B, 0);
  assert.equal(qty.C, -2);
  assert.equal(qty.D, null);
  assert.equal(qty.E, null);
  assert.equal(qty.__proto__, 4);
  assert.equal(qty.missing, undefined);
});
