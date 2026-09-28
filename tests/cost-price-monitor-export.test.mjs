import assert from "node:assert/strict";
import test from "node:test";
import { poCosts } from "../src/lib/cost-price-po-costs.ts";
import { costPriceMonitorDashboardRows, costPriceMonitorExportRows, costPriceMonitorXlsx } from "../src/lib/cost-price-monitor-export.ts";

const entry = (id, qty, unit, freight, currency = "THB", extra = {}) => ({
  line: { po_id: id, ordered_qty: qty, unit_price: unit, freight_unit_cost: freight, currency, ...extra },
  qty, timestamp: id === "new" ? 2 : 1,
  order: { po_id: id, po_date: "2026-09-28", currency, work_status: "closed" },
});

test("PO costs stay paired and duplicate SKU lines are quantity weighted", () => {
  const costs = poCosts([entry("old", 10, 500, 80), entry("new", 10, 100, 0), entry("new", 30, 200, 0)]);
  assert.equal(costs[0].poId, "new");
  assert.equal(costs[0].qty, 40);
  assert.equal(costs[0].unitThb, 175);
  assert.equal(costs[0].landThb, 0);
  assert.equal(costs[0].totalThb, 175); // Never reuse the older PO's freight.
  assert.equal(costs[1].totalThb, 580);
  // The allocation column defaults to zero on legacy manual freight rows.
  const [legacy] = poCosts([entry("old", 10, 500, 80, "THB", { payment_freight_amount_thb: 0 })]);
  assert.equal(legacy.landThb, 80);
  const [landedOnly] = poCosts([entry("old", 10, 500, 0, "THB", { landed_unit_cost: 580, payment_freight_amount_thb: 0 })]);
  assert.equal(landedOnly.landThb, 80);
});

test("USD costs use this PO's merchandise average FX, excluding expenses", () => {
  const usd = entry("new", 10, 15, 2, "USD");
  usd.order.po_payments = [
    { currency: "USD", amount: 100, payment_type: "deposit30%", exchange_rate: 32.83 },
    { currency: "USD", amount: 200, payment_type: "beforeshipments70%", exchange_rate: 33.37 },
    { currency: "USD", amount: 100, payment_type: "shipping", exchange_rate: 45 },
    { currency: "THB", amount: 100, payment_type: "freight", exchange_rate: 1 },
  ];
  const [cost] = poCosts([usd]);
  assert.equal(cost.fx, 33.1);
  assert.equal(cost.unitUsd, 15);
  assert.ok(Math.abs(cost.unitThb - 496.5) < 1e-9);
  assert.ok(Math.abs(cost.totalThb - 562.7) < 1e-9);
  const [missing] = poCosts([entry("old", 1, 15, 2, "USD")]);
  assert.equal(missing.unitThb, null);
  assert.equal(missing.landThb, null);
  assert.equal(missing.totalThb, null);
});

test("THB lines keep their saved cost and precise allocated freight, including partial cancellations", () => {
  const line = entry("new", 30, 478.469, 128.4348, "THB", {
    payment_freight_amount_thb: 3853.044,
    source_payload: { unitPriceUsd: 14.4552568, appliedFxRate: 33.1 },
  });
  line.qty = 20;
  const [cost] = poCosts([line]);
  assert.ok(Math.abs(cost.unitThb - 478.469) < 1e-9);
  assert.ok(Math.abs(cost.landThb - 128.4348) < 1e-9);
  assert.ok(Math.abs(cost.totalThb - 606.9038) < 1e-9);
  assert.equal(cost.unitUsd, 14.4552568);
  assert.equal(cost.fx, 33.1);
});

const group = () => ({ mainName: "Gloves & gear", color: "Black", skuCount: 2, stockQty: 5, supplier: "Supplier", note: "",
  skuDetails: [
    { sku: "SKU-1", variantTitle: "12 oz", currentQty: 5, effectiveSellingPrice: 1000, poCosts: poCosts([entry("new", 30, 478.469, 128.4348)]) },
    { sku: "=HYPERLINK(test)", variantTitle: "14 oz", currentQty: 0, effectiveSellingPrice: 1000, poCosts: [] },
  ],
});

test("export contains group, SKU and PO rows; missing costs never use estimate 120", () => {
  const rows = costPriceMonitorExportRows([group()]);
  assert.deepEqual(rows.slice(3).map(r => [r.values[0], r.level ?? 0]), [["GROUP", 0], ["SKU", 1], ["PO", 2], ["SKU", 1]]);
  assert.equal(rows[4].values[8], 478.469);
  assert.equal(rows[4].values[9], 128.4348);
  assert.equal(rows[4].values[10], 606.9038);
  assert.deepEqual(rows[6].values.slice(8, 11), [0, 0, 0]);
  assert.equal(rows[6].values[19], "No PO cost");
});

function unzipStored(buffer) {
  const files = new Map();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18), nameLength = buffer.readUInt16LE(offset + 26), extraLength = buffer.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    files.set(buffer.subarray(offset + 30, offset + 30 + nameLength).toString(), buffer.subarray(start, start + size).toString());
    offset = start + size;
  }
  return files;
}

test("XLSX has styles, frozen headings, filter and expandable SKU / PO rows; cells are literal", () => {
  const files = unzipStored(costPriceMonitorXlsx([group()]));
  const sheet = files.get("xl/worksheets/sheet2.xml");
  assert.match(sheet, /ySplit="3"/);
  assert.match(sheet, /autoFilter ref="A3:T7"/);
  assert.match(sheet, /outlineLevel="2"/);
  assert.match(sheet, /Gloves &amp; gear/);
  assert.match(sheet, /=HYPERLINK\(test\)/);
  assert.doesNotMatch(sheet, /<f[ >]/);
  assert.match(files.get("xl/styles.xml"), /#,##0.0000/);
  assert.match(files.get("xl/_rels/workbook.xml.rels"), /Target="styles.xml"/);
  assert.match(files.get("[Content_Types].xml"), /PartName="\/xl\/styles.xml"/);
  assert.match(unzipStored(costPriceMonitorXlsx([])).get("xl/worksheets/sheet1.xml"), /autoFilter ref="A3:T3"/);
  assert.match(files.get("xl/workbook.xml"), /sheet name="SKU Dashboard" sheetId="1"/);
  assert.match(files.get("xl/workbook.xml"), /sheet name="Cost Price Monitor" sheetId="2"/);
  assert.match(files.get("xl/_rels/workbook.xml.rels"), /Target="worksheets\/sheet2.xml"/);
  assert.match(files.get("[Content_Types].xml"), /PartName="\/xl\/worksheets\/sheet2.xml"/);
  const dashboard = files.get("xl/worksheets/sheet1.xml");
  assert.match(dashboard, /autoFilter ref="A3:T5"/);
  assert.doesNotMatch(dashboard, /outlineLevel="[12]"/);
});

test("SKU dashboard quantity-weights PO costs and zero freight together into one SKU", () => {
  const data = group();
  data.skuDetails[0].poCosts = poCosts([entry("old", 10, 100, 20), entry("new", 30, 200, 0)]);
  const rows = costPriceMonitorDashboardRows([data]);
  assert.equal(rows.length, 5); // Headers plus exactly two SKUs; no group or PO rows.
  const sku = rows[3].values;
  assert.equal(sku[3], "SKU-1");
  assert.equal(sku[5], 5); // Stock does not weight historical unit costs.
  assert.equal(sku[6], 2);
  assert.equal(sku[7], 40);
  assert.equal(sku[8], 175);
  assert.equal(sku[9], 5); // (10 × 20 + 30 × 0) / 40.
  assert.equal(sku[10], 180);
  assert.equal(sku[12], 1);
  assert.equal(sku[14], 0.82);
  assert.equal(sku[16], 40);
  assert.deepEqual(rows[4].values.slice(8, 11), [0, 0, 0]);
  // Detail sheet still shows the latest PO cost, rather than this dashboard average.
  assert.equal(costPriceMonitorExportRows([data])[4].values[8], 200);
});

test("dashboard excludes missing-FX POs from both THB averages and reports coverage", () => {
  const data = group();
  data.skuDetails[0].poCosts = poCosts([entry("old", 10, 100, 20), entry("new", 30, 15, 0, "USD")]);
  let values = costPriceMonitorDashboardRows([data])[3].values;
  assert.equal(values[8], 100);
  assert.equal(values[9], 20);
  assert.equal(values[10], 120);
  assert.equal(values[11], 15);
  assert.equal(values[12], 0.25);
  assert.equal(values[16], 10);
  assert.match(values[19], /1 PO\(s\) excluded/);
  data.skuDetails[0].poCosts = poCosts([entry("new", 30, 15, 0, "USD")]);
  values = costPriceMonitorDashboardRows([data])[3].values;
  assert.deepEqual(values.slice(8, 11), [null, null, null]);
  assert.equal(values[12], 0);
});
