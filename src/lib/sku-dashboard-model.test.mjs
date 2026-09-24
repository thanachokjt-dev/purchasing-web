import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./sku-dashboard-model.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { aggregateSkuDashboard, normalizeSkuDashboardFilters, shiftYear } = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
);

const catalog = [
  { sku: "SKU-A", itemName: "Test Spray", variantName: "100ml", supplier: "Supplier A", category: "Care", unitCost: 20 },
  { sku: "SKU-B", itemName: "Test Spray", variantName: "200ml", supplier: "Supplier A", category: "Care", unitCost: null },
];
const filters = normalizeSkuDashboardFilters({
  start: "2026-04-18", end: "2026-09-22", supplier: "", category: "", skus: [], compare: true,
}, "2026-09-23");

test("date filters reject impossible, future, and overlong ranges; leap-year comparison clamps", () => {
  assert.equal(shiftYear("2024-02-29", 1), "2025-02-28");
  assert.throws(() => normalizeSkuDashboardFilters({ start: "2026-02-30" }, "2026-09-23"));
  assert.throws(() => normalizeSkuDashboardFilters({ start: "2025-01-01", end: "2026-09-23" }, "2026-09-23"));
  assert.throws(() => normalizeSkuDashboardFilters({ end: "2026-09-24" }, "2026-09-23"));
});

test("cards reconcile to SKU and monthly data, with estimated profit limited to covered revenue", () => {
  const result = aggregateSkuDashboard(filters, [
    { period: "current", sku: "SKU-A", month_start: "2026-04-01", units: "10", revenue: "100" },
    { period: "current", sku: "SKU-A", month_start: "2026-05-01", units: "5", revenue: "80" },
    { period: "current", sku: "SKU-B", month_start: "2026-04-01", units: "2", revenue: "50" },
    { period: "previous", sku: "SKU-A", month_start: "2025-04-01", units: "8", revenue: "120" },
    { period: "previous", sku: "SKU-B", month_start: "2025-05-01", units: "3", revenue: "75" },
  ], catalog, "2026-09-23");
  assert.equal(result.comparisonAvailable, true);
  assert.equal(result.summary.units, 17);
  assert.equal(result.summary.revenue, 230);
  assert.equal(result.summary.previousUnits, 11);
  assert.equal(result.summary.previousRevenue, 195);
  assert.equal(result.summary.activeSkus, 2);
  assert.equal(result.summary.coveredRevenue, 180);
  assert.equal(result.summary.estimatedCogs, 300);
  assert.equal(result.summary.estimatedGrossProfit, -120);
  assert.equal(result.summary.estimatedGrossMarginPercent, -120 / 180 * 100);
  assert.equal(result.monthly[0].month, "2026-04-01");
  assert.equal(result.monthly[0].units, 12);
  assert.equal(result.monthly[0].previousUnits, 8);
  assert.equal(result.monthly[1].previousUnits, 3);
  assert.equal(result.monthly.reduce((sum, month) => sum + month.units, 0), result.summary.units);
  assert.equal(result.skus.find((row) => row.sku === "SKU-B")?.estimatedCogs, null);
});

test("comparison is unavailable before complete 2025 history, and missing costs stay unknown", () => {
  const early = normalizeSkuDashboardFilters({ start: "2025-03-01", end: "2025-03-31" }, "2026-09-23");
  const result = aggregateSkuDashboard(early, [
    { period: "current", sku: "SKU-B", month_start: "2025-03-01", units: 4, revenue: 60 },
    { period: "previous", sku: "SKU-B", month_start: "2024-03-01", units: 20, revenue: 100 },
  ], catalog, "2026-09-23");
  assert.equal(result.comparisonAvailable, false);
  assert.equal(result.summary.previousUnits, 0);
  assert.equal(result.summary.estimatedCogs, null);
  assert.equal(result.summary.estimatedGrossProfit, null);
  assert.equal(result.summary.estimatedGrossMarginPercent, null);
  assert.equal(result.summary.costCoveragePercent, 0);
});
