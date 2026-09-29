import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
import {
  buildPurchasingDashboard,
  purchasingPeriod,
  allocateMoney,
  classifyExpense,
  classifyPaymentExpense,
} from "../src/lib/purchasing-dashboard-model.ts";

function compile(path, imports = {}) {
  const code = ts.transpileModule(
    fs.readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {};
  new Function("require", "exports", code)((name) => {
    if (!(name in imports)) throw Error(`Unmocked import ${name}`);
    return imports[name];
  }, exports);
  return exports;
}
const model = {
  expenseCategories: (await import("../src/lib/purchasing-dashboard-model.ts"))
    .expenseCategories,
};
const zip = compile("../src/lib/cost-price-monitor-export.ts");
const exporter = compile("../src/lib/purchasing-dashboard-export.ts", {
  "./purchasing-dashboard-model": model,
  "./cost-price-monitor-export": zip,
});
const now = new Date("2026-09-29T08:00:00Z");
const order = (id, date, overrides = {}) => ({
  po_id: id,
  po_date: date,
  created_at: `${date}T00:00:00Z`,
  work_status: "closed",
  cancelled_at: null,
  currency: "THB",
  supplier_name_snapshot: "Local",
  supplier_code: "DOM",
  ...overrides,
});
const line = (id, po, sku, qty = 1, unit = 100, overrides = {}) => ({
  id,
  po_id: po,
  sku,
  ordered_qty: qty,
  cancelled_qty: 0,
  unit_price: unit,
  currency: "THB",
  product_title_snapshot: "Group",
  variant_title_snapshot: sku,
  line_status: "open",
  source_payload: null,
  ...overrides,
});
const payment = (
  id,
  po,
  date,
  amount = 107,
  type = "deposit50%",
  overrides = {},
) => ({
  id,
  po_id: po,
  payment_date: date,
  amount,
  amount_thb: amount,
  currency: "THB",
  exchange_rate: 1,
  payment_type: type,
  payment_status: "paid",
  vat_amount_thb: type === "deposit50%" ? 7 : null,
  reference: null,
  note: null,
  ...overrides,
});
const meta = (sku) => ({
  sku,
  name: "Same family",
  category: "Apparel",
  groupKey: "apparel|family",
});
const categoryTotal = (data, category) =>
  data.categories.find((row) => row.key === category).total;

test("four calendar months include Bangkok today and cross year boundaries", () => {
  const period = purchasingPeriod(now);
  assert.equal(period.start, "2026-06-01");
  assert.equal(period.end, "2026-09-29");
  assert.deepEqual(
    purchasingPeriod(new Date("2025-12-31T18:00:00Z")).months.map(
      (month) => month.key,
    ),
    ["2025-10", "2025-11", "2025-12", "2026-01"],
  );
});
test("five first-order SKUs collapse into one family; raw costs and actual paid are separate", () => {
  const items = [1, 2, 3, 4, 5].map((i) =>
    line(String(i), "new", `S${i}`, 2, 100),
  );
  const data = buildPurchasingDashboard(
    [order("new", "2026-06-01")],
    items,
    [payment("p", "new", "2026-07-10")],
    items.map((item) => meta(item.sku)),
    now,
  );
  assert.equal(data.newGroups.length, 1);
  assert.equal(data.newGroups[0].skus.length, 5);
  assert.deepEqual(data.newGroups[0].quantities, [10, 0, 0, 0]);
  assert.deepEqual(data.newGroups[0].costs, [1000, 0, 0, 0]);
  assert.deepEqual(data.newGroups[0].paid, [0, 100, 0, 0]);
  assert.equal(categoryTotal(data, "vat"), 7);
  assert.equal(data.grossPaid, 107);
});
test("mixed PO allocates new/existing by raw merchandise value and splits included VAT once", () => {
  const data = buildPurchasingDashboard(
    [order("old", "2023-01-01"), order("mixed", "2026-06-01")],
    [
      line("a", "old", "A"),
      line("b", "mixed", "A", 1, 100),
      line("c", "mixed", "B", 1, 300),
    ],
    [
      payment("p", "mixed", "2026-06-20"),
      payment("s", "mixed", "2026-07-01", 50, "shipping"),
      payment("v", "mixed", "2026-08-01", 30, "vat_import_vat"),
      payment("f", "mixed", "2026-09-01", 20, "freight"),
      payment("o", "mixed", "2026-09-01", 10.7, "other", {
        vat_amount_thb: 0.7,
      }),
    ],
    [meta("A"), meta("B")],
    now,
  );
  assert.equal(categoryTotal(data, "new"), 75);
  assert.equal(categoryTotal(data, "existing"), 25);
  assert.equal(categoryTotal(data, "shipping"), 70);
  assert.equal(categoryTotal(data, "vat"), 37.7);
  assert.equal(categoryTotal(data, "other"), 10);
  assert.equal(
    Math.round(data.categories.reduce((sum, row) => sum + row.total, 0) * 100),
    Math.round(data.grossPaid * 100),
  );
  assert.equal(data.grossPaid, 217.7);
});
test("Planned and future paid excluded; cancelled/draft orders never define the first purchase", () => {
  const orders = [
    order("draft", "2020-01-01", { work_status: "draft" }),
    order("cancel", "2021-01-01", { cancelled_at: "2021-01-01" }),
    order("first", "2026-06-01"),
  ];
  const data = buildPurchasingDashboard(
    orders,
    orders.map((o, index) => line(String(index), o.po_id, "A")),
    [
      payment("p", "first", "2026-06-10"),
      payment("planned", "first", "2026-07-01", 500, "balance", {
        payment_status: "planned",
      }),
      payment("future", "first", "2026-09-30", 500),
    ],
    [meta("A")],
    now,
  );
  assert.equal(categoryTotal(data, "new"), 100);
  assert.equal(data.newGroups[0].quantities[0], 1);
  assert.equal(data.grossPaid, 107);
});
test("missing raw cost does not erase actual cash; missing FX is visibly excluded", () => {
  const data = buildPurchasingDashboard(
    [order("a", "2026-06-01")],
    [line("a", "a", "A", 5, 0)],
    [
      payment("paid", "a", "2026-06-10"),
      payment("noFx", "a", "2026-07-01", 20, "balance", {
        currency: "USD",
        exchange_rate: null,
        amount_thb: 999,
      }),
    ],
    [meta("A")],
    now,
  );
  assert.equal(data.grossPaid, 107);
  assert.equal(categoryTotal(data, "existing"), 100);
  assert.equal(data.newGroups[0].missingCostQty, 5);
  assert.equal(data.warnings.length, 3);
});
test("USD cost uses that PO FX, cancellations reduce qty, and freight never enters raw cost", () => {
  const data = buildPurchasingDashboard(
    [order("usd", "2026-06-01", { currency: "USD" })],
    [
      line("u", "usd", "U", 5, 10, {
        currency: "USD",
        cancelled_qty: 2,
        source_payload: { appliedFxRate: 33, unitPriceUsd: 10 },
      }),
    ],
    [
      payment("u", "usd", "2026-06-10", 20, "balance", {
        amount_thb: 660,
        currency: "USD",
        exchange_rate: 33,
        vat_amount_thb: null,
      }),
      payment("f", "usd", "2026-07-01", 200, "freight"),
    ],
    [meta("U")],
    now,
  );
  assert.equal(data.newGroups[0].costs[0], 990);
  assert.equal(data.newGroups[0].quantities[0], 3);
  assert.equal(categoryTotal(data, "shipping"), 200);
});
test("first PO outside period has current payments but no duplicated ordered qty", () => {
  const data = buildPurchasingDashboard(
    [order("a", "2026-05-01")],
    [line("a", "a", "A", 10)],
    [payment("a", "a", "2026-07-01")],
    [meta("A")],
    now,
  );
  assert.equal(categoryTotal(data, "new"), 100);
  assert.deepEqual(data.newGroups[0].quantities, [0, 0, 0, 0]);
});
test("allocation conserves satang even for tiny amounts and many SKUs", () => {
  assert.deepEqual(allocateMoney(0.01, [1, 1, 1]), [0.01, 0, 0]);
  for (const amount of [0.01, 0.02, 100, 361688.66]) {
    const result = allocateMoney(amount, [1, 3, 9, 17, 500]);
    assert.equal(
      Math.round(result.reduce((sum, value) => sum + value, 0) * 100),
      Math.round(amount * 100),
    );
  }
});
test("customs, duty, clearance included in transport; VAT and other remain distinct", () => {
  for (const type of [
    "customs",
    "customs_clearance",
    "duty",
    "brokerage",
    "ค่าดำเนินพิธีการ",
    "ศุลกากร",
    "Shipping",
    "Freight",
  ])
    assert.equal(classifyExpense(type), "shipping");
  assert.equal(classifyExpense("VAT / IMPORT VAT"), "vat");
  assert.equal(classifyExpense("fine"), "other");
  assert.equal(
    classifyPaymentExpense({
      payment_type: "other",
      reference: "vat",
      note: null,
    }),
    "vat",
  );
  assert.equal(
    classifyPaymentExpense({
      payment_type: "other",
      reference: null,
      note: "customs clearance",
    }),
    "shipping",
  );
  const data = buildPurchasingDashboard(
    [order("a", "2026-06-01")],
    [],
    [
      payment("vat", "a", "2026-07-01", 107, "other", {
        reference: "vat",
        vat_amount_thb: 7,
      }),
    ],
    [],
    now,
  );
  assert.equal(categoryTotal(data, "vat"), 107);
  assert.equal(data.grossPaid, 107);
});

function unzip(buffer) {
  const files = new Map();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const length = buffer.readUInt32LE(offset + 18),
      nameLength = buffer.readUInt16LE(offset + 26),
      extraLength = buffer.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    files.set(
      buffer.subarray(offset + 30, offset + 30 + nameLength).toString(),
      buffer.subarray(start, start + length).toString(),
    );
    offset = start + length;
  }
  return files;
}
test("Excel includes 4 sheets, native chart and sparkline references over exactly four months", () => {
  const data = buildPurchasingDashboard(
    [order("a", "2026-06-01")],
    [line("a", "a", "A")],
    [payment("a", "a", "2026-06-02")],
    [meta("A")],
    now,
  );
  const files = unzip(exporter.purchasingDashboardXlsx(data));
  assert.equal(
    (files.get("xl/workbook.xml").match(/<sheet /g) || []).length,
    4,
  );
  assert.ok(files.get("xl/worksheets/sheet1.xml").includes("'Overview'!D4:G4"));
  assert.ok(
    files.get("xl/worksheets/sheet2.xml").includes("'New products'!H4:K4"),
  );
  assert.equal(
    (files.get("xl/charts/chart1.xml").match(/<c:ser>/g) || []).length,
    5,
  );
  const sheets = exporter.purchasingExportSheets(data);
  assert.equal(
    sheets[2].rows.slice(3).reduce((sum, row) => sum + row[7], 0),
    data.grossPaid,
  );
  assert.equal(sheets[1].levels.filter((level) => level === 1).length, 1);
});
test("Excel endpoint requires active authorized user before loading financial data", async () => {
  const { NextResponse } = await import("next/server.js");
  let profile = null,
    allowed = false,
    loads = 0;
  const endpoint = compile(
    "../src/app/api/purchasing-dashboard/export/route.ts",
    {
      "next/server": { NextResponse },
      "@/lib/auth": { getCurrentUserProfile: async () => profile },
      "@/lib/role-nav": { canAccessPurchasingDashboard: () => allowed },
      "@/lib/purchasing-dashboard": {
        getPurchasingDashboardData: async () => {
          loads++;
          return { period: { end: "2026-09-29" } };
        },
      },
      "@/lib/purchasing-dashboard-export": {
        purchasingDashboardXlsx: () => Buffer.from("PK"),
      },
    },
  );
  assert.equal((await endpoint.GET()).status, 401);
  profile = { isActive: true };
  assert.equal((await endpoint.GET()).status, 403);
  assert.equal(loads, 0);
  allowed = true;
  const response = await endpoint.GET();
  assert.equal(response.status, 200);
  assert.equal(loads, 1);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

test("menu and access keep financial dashboards within existing authorized roles", () => {
  const roleNav = compile("../src/lib/role-nav.ts", {
    "server-only": {},
    "@/lib/access-control": {
      getUserAccessRole: () => "admin",
      canViewIncomingEtaOnly: (email) => email === "warehouse@example.com",
      getProfileAccessRole: (profile) =>
        profile.accessRole ||
        (profile.role === "super_admin" ? "super_admin" : "admin"),
    },
  });
  for (const role of ["super_admin", "accounting"]) {
    const profile = { role, email: "allowed@example.com" };
    assert.equal(roleNav.canAccessPurchasingDashboard(profile), true);
    assert.ok(
      roleNav
        .navItemsForUser(profile)
        .some((item) => item.key === "purchasing-dashboard"),
    );
  }
  assert.equal(
    roleNav.canAccessPurchasingDashboard({
      role: "reviewer",
      email: "review@example.com",
    }),
    false,
  );
  assert.equal(
    roleNav.canAccessPurchasingDashboard({
      role: "super_admin",
      email: "warehouse@example.com",
    }),
    false,
  );
  assert.equal(
    roleNav.canAccessPurchasingDashboard({
      role: "viewer",
      email: "dashboard@example.com",
      accessRole: "dashboard_only",
    }),
    true,
  );
  assert.equal(
    roleNav.navigationGroup("purchasing-dashboard"),
    "Overview & Analytics",
  );
});
