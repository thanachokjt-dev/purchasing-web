import assert from "node:assert/strict";
import test from "node:test";
import { groupQuotePrintRows } from "../src/lib/po-quote-print-rows.ts";

test("quote print keeps split size rows adjacent despite dash / slash product names", () => {
  const rows = [
    ["Core Series Muay Thai Shorts - Black", 100],
    ["Core Series Muay Thai Shorts - Black&Pink", 50],
    ["Core Series Muay Thai Shorts - Teal", 150],
    ["Core Series Muay Thai Shorts / Black", 220],
    ["Core Series Muay Thai Shorts / Black&Pink", 260],
    ["Core Series Muay Thai Shorts / Grey", 570],
    ["Core Series Muay Thai Shorts / Teal", 150],
  ].map(([productName, totalQty]) => ({ productName, totalQty, items: new Map() }));
  const original = [...rows];
  const groups = groupQuotePrintRows(rows);
  assert.deepEqual(groups.map(group => group.map(row => row.totalQty)), [[100, 220], [50, 260], [570], [150, 150]]);
  assert.equal(groups.flat().reduce((sum, row) => sum + row.totalQty, 0), 1500);
  assert.equal(groups.flat().length, 7);
  assert.deepEqual(rows, original);
  for (const row of groups.flat()) assert.ok(original.includes(row));
});

test("normalizes spacing and case while keeping distinct colours separate", () => {
  const groups = groupQuotePrintRows([
    { productName: "Shorts / BLACK" }, { productName: " Shorts – Black " },
    { productName: "Shorts - Black&Pink" }, { productName: "Shorts / Teal" },
  ]);
  assert.deepEqual(groups.map(group => group.length), [2, 1, 1]);
  assert.deepEqual(groupQuotePrintRows([]), []);
});
