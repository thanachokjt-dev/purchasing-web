import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

let db;
const sqlFile = (name) => readFile(new URL(`../supabase/${name}`, import.meta.url), "utf8");
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create function uuid_generate_v4() returns uuid language sql as 'select gen_random_uuid()';`);
  // Use the repository's real table definitions and RPCs in isolated PostgreSQL.
  const schema = await sqlFile("migrations/004_phase2_po_portal.sql");
  await db.exec(schema.replace('create extension if not exists "uuid-ossp";', "")
    .split("create or replace view po_item_receipt_totals")[0]);
  for (const migration of [
    "006_po_line_cost_fields.sql", "007_po_draft_cost_payment.sql",
    "010_po_detail_draft_controls.sql", "011_po_payment_schedule.sql",
    "015_po_payment_fx_amount.sql", "047_po_payment_xero_status.sql",
    "049_po_payment_xero_status_draft.sql", "20260907075713_po_save_consistency.sql",
    "20260920014529_save_po_draft_lines_transaction.sql",
    "20260928072722_payment_landed_cost_by_value.sql",
  ]) await db.exec(await sqlFile(`migrations/${migration}`));
});
after(async () => { await db?.close(); });

async function fixture(id, lines, currency = "THB") {
  await db.query("insert into po_orders(po_id,currency) values ($1,$2)", [id, currency]);
  return saveLines(id, lines.map((line, i) => ({
    po_id: id, sku: `${id}-${i}`, line_no: String(i + 1), sort_position: i + 1,
    currency, ordered_qty: 1, unit_price: 100, freight_unit_cost: 0, ...line,
  })));
}
async function saveLines(id, lines, deleted = []) {
  return (await db.query("select save_po_draft_lines($1,$2::jsonb,$3::uuid[]) saved",
    [id, JSON.stringify(lines), deleted])).rows[0].saved;
}
async function savePayments(id, rows, deleted = [], expected = null) {
  return (await db.query("select save_po_payments($1,$2::jsonb,$3::uuid[],$4::jsonb) saved",
    [id, JSON.stringify(rows), deleted, expected === null ? null : JSON.stringify(expected)])).rows[0].saved;
}
function payment(id, type, amount, extra = {}) {
  return { po_id: id, payment_type: type, amount, currency: "THB", exchange_rate: 1,
    amount_thb: amount, payment_status: "planned", xero_status: "pending", ...extra };
}
async function items(id) {
  return (await db.query("select * from po_items where po_id=$1 order by sort_position", [id])).rows;
}
async function totalAllocated(id) {
  return Number((await db.query("select sum(payment_freight_amount_thb) total from po_items where po_id=$1", [id])).rows[0].total);
}

test("existing payment and draft transaction regressions still pass", async () => {
  await db.exec(await sqlFile("tests/po_save_consistency.sql"));
  await db.exec(await sqlFile("tests/po_draft_save_transaction.sql"));
});

test("value weighting, planned + paid, repeat save, edit/delete, and merchandise balance", async () => {
  const id = "VALUE";
  await fixture(id, [{ ordered_qty: 2, unit_price: 100 }, { ordered_qty: 1, unit_price: 300 }]);
  let payments = await savePayments(id, [payment(id, "shipping", 50), payment(id, "freight", 50,
    { payment_status: "paid", payment_date: "2026-09-28" })]);
  let lines = await items(id);
  assert.deepEqual(lines.map((l) => Number(l.freight_unit_cost)), [20, 60]);
  assert.deepEqual(lines.map((l) => Number(l.landed_unit_cost)), [120, 360]);
  assert.equal(await totalAllocated(id), 100);
  assert.equal(Number((await db.query("select po_amount_foreign from po_orders where po_id=$1", [id])).rows[0].po_amount_foreign), 500);
  payments = await savePayments(id, payments, [], payments);
  assert.equal(await totalAllocated(id), 100); // No accumulation on repeated save.
  payments = await savePayments(id, [{ ...payments[0], amount: 100, amount_thb: 100 }, payments[1]], [], payments);
  assert.equal(await totalAllocated(id), 150);
  lines = await items(id);
  lines = await saveLines(id, [{ ...lines[0], ordered_qty: 4 }, lines[1]]);
  assert.equal(await totalAllocated(id), 150);
  assert.equal(Number(lines[0].payment_freight_amount_thb), 85.7143);
  assert.equal(Number(lines[1].payment_freight_amount_thb), 64.2857);
  await savePayments(id, [{ ...payments[0], payment_type: "other" }], [payments[1].id], payments);
  assert.equal(await totalAllocated(id), 0);
  assert.deepEqual((await items(id)).map((l) => Number(l.freight_unit_cost)), [0, 0]);
  assert.deepEqual((await items(id)).map((l) => Number(l.landed_unit_cost)), [100, 300]);
});

test("no Shipping/Freight leaves manually saved costs unchanged", async () => {
  const id = "NO-FREIGHT";
  await fixture(id, [{ freight_unit_cost: 7 }, { unit_price: 0, ordered_qty: 0 }]);
  await savePayments(id, [payment(id, "deposit", 200), payment(id, "vat_import_vat", 10), payment(id, "shipping", 0)]);
  assert.deepEqual((await items(id)).map((l) => Number(l.freight_unit_cost)), [7, 0]);
  assert.equal(await totalAllocated(id), 0);
});

test("mixed currencies are weighted in THB and allocated back to SKU currency", async () => {
  const id = "FX";
  await fixture(id, [{ currency: "USD", ordered_qty: 2, unit_price: 10 }, { unit_price: 400 }]);
  await savePayments(id, [payment(id, "deposit", 20, { currency: "USD", exchange_rate: 30, amount_thb: 600 }),
    payment(id, "shipping", 100), payment(id, "freight", 10, { currency: "USD", exchange_rate: 30, amount_thb: 300 })]);
  const lines = await items(id);
  assert.equal(await totalAllocated(id), 400);
  assert.deepEqual(lines.map((l) => Number(l.payment_freight_amount_thb)), [240, 160]);
  assert.deepEqual(lines.map((l) => Number(l.freight_unit_cost)), [4, 160]);
  assert.deepEqual(lines.map((l) => Number(l.landed_unit_cost)), [14, 560]);
});

test("same-currency Shipping FX works before merchandise payments", async () => {
  const id = "FREIGHT-FX";
  await fixture(id, [{ ordered_qty: 2, unit_price: 100 }], "USD");
  await savePayments(id, [payment(id, "shipping", 30, { currency: "USD", exchange_rate: 33, amount_thb: 990 })]);
  assert.equal(Number((await items(id))[0].freight_unit_cost), 15);
});

test("rounding reconciles exact line amounts; free and zero-qty lines receive no allocation", async () => {
  const id = "ROUNDING";
  await fixture(id, [{ ordered_qty: 3 }, { ordered_qty: 3 }, { ordered_qty: 3 },
    { unit_price: 0, currency: "USD" }, { ordered_qty: 0 }]);
  await savePayments(id, [payment(id, "shipping", 0.01)]);
  const lines = await items(id);
  assert.equal(await totalAllocated(id), 0.01);
  assert.deepEqual(lines.slice(-2).map((l) => Number(l.payment_freight_amount_thb)), [0, 0]);
  assert.ok(lines.every((l) => Number(l.freight_unit_cost) >= 0));
});

test("missing FX and zero merchandise value roll back payments and draft edits", async () => {
  const id = "MISSING-FX";
  await fixture(id, [{ currency: "USD" }]);
  await assert.rejects(savePayments(id, [payment(id, "shipping", 100)]), /Missing exchange rate/);
  assert.equal((await db.query("select count(*) n from po_payments where po_id=$1", [id])).rows[0].n, 0);
  assert.equal(Number((await items(id))[0].freight_unit_cost), 0);
  const zero = "ZERO";
  let lines = await fixture(zero, [{ unit_price: 0 }]);
  await assert.rejects(savePayments(zero, [payment(zero, "shipping", 10)]), /merchandise value/);
  lines = await saveLines(zero, [{ ...lines[0], unit_price: 100 }]);
  await savePayments(zero, [payment(zero, "shipping", 10)]);
  await assert.rejects(saveLines(zero, [{ ...lines[0], unit_price: 0 }]), /merchandise value/);
  assert.equal(Number((await items(zero))[0].unit_price), 100);
  assert.equal(await totalAllocated(zero), 10);
});

test("allocation helper remains restricted to authorized server actions", async () => {
  const result = await db.query(`select has_function_privilege('anon','allocate_po_payment_freight(text)','execute') a,
    has_function_privilege('authenticated','allocate_po_payment_freight(text)','execute') b,
    has_function_privilege('service_role','allocate_po_payment_freight(text)','execute') c`);
  assert.deepEqual(result.rows[0], { a: false, b: false, c: true });
});
