import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

const migration = "20260929081733_payment_timeline_paid_history.sql";
const sql = (name) =>
  fs.readFileSync(
    new URL(`../supabase/migrations/${name}`, import.meta.url),
    "utf8",
  );
test("paid history survives closed/cancelled POs; only active plans stay actionable", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table po_orders(po_id text primary key,rqq_id text,po_title text,quotation_reference text,supplier_invoice_no text,supplier_code text,supplier_name_snapshot text,supplier_discussion_note text,updated_at timestamptz,work_status text,closed_at timestamptz,cancelled_at timestamptz,currency text);
      create table po_payments(id text primary key,po_id text,payment_status text,payment_date date,due_date date,reference text,payment_type text,amount numeric,currency text,exchange_rate numeric,amount_thb numeric,created_at timestamptz);
      insert into po_orders(po_id,work_status) values ('open','inpro'),('done','closed'),('cancel','cancelled');
      insert into po_payments(id,po_id,payment_status,payment_date,due_date,amount,currency,exchange_rate,amount_thb) values
      ('a','open','paid','2026-08-31',null,100,'THB',1,100),
      ('b','done','paid','2026-09-01',null,200,'THB',1,200),
      ('c','cancel','paid','2026-09-02',null,300,'THB',1,300),
      ('d','open','planned',null,'2026-09-30',400,'THB',1,400),
      ('e','done','planned',null,'2026-09-30',500,'THB',1,500),
      ('f','cancel','planned',null,'2026-09-30',600,'THB',1,600);`);
    await db.exec(
      sql("025_po_portal_chart_read_models.sql").split(
        "create or replace view po_incoming_eta_events",
      )[0],
    );
    await db.exec(sql(migration));
    const events = (
      await db.query(
        "select payment_id from po_payment_timeline_events order by payment_id",
      )
    ).rows.map((r) => r.payment_id);
    assert.deepEqual(events, ["a", "b", "c", "d"]);
    // Real payment amounts, including FX < 1, zero, missing FX and satang rounding.
    await db.exec(`insert into po_payments(id,po_id,payment_status,payment_date,amount,currency,exchange_rate,amount_thb) values
      ('fx','done','paid','2026-09-03',100,'JPY',0.25,25),
      ('missing','done','paid','2026-09-03',100,'USD',null,100),
      ('zero','done','paid','2026-09-03',100,'THB',1,0),
      ('round','done','paid','2026-09-03',1.004,'THB',1,1.004);`);
    const rows = (
      await db.query(
        "select payment_id,amount_thb,exchange_rate from po_payment_timeline_events where payment_id in ('fx','missing','zero','round') order by payment_id",
      )
    ).rows;
    assert.deepEqual(
      rows.map((r) => [
        r.payment_id,
        r.amount_thb == null ? null : Number(r.amount_thb),
      ]),
      [
        ["fx", 25],
        ["missing", null],
        ["round", 1],
        ["zero", 0],
      ],
    );
    assert.equal(rows[1].exchange_rate, null);
  } finally {
    await db.close();
  }
});

// Exercise the actual page's bucket/cashflow helpers without requiring a login or rendering Next.js.
const page = fs.readFileSync(
  new URL("../src/app/po/page.tsx", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "page.tsx",
  page,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const names = [
  "currencyCode",
  "isThbCurrency",
  "hasValidFxRate",
  "cashflowAmountThb",
  "addUtcDays",
  "startOfUtcWeek",
  "endOfUtcWeek",
  "startOfUtcMonth",
  "endOfUtcMonth",
  "paymentBucketRange",
];
const helpers = ast.statements
  .filter((s) => ts.isFunctionDeclaration(s) && names.includes(s.name?.text))
  .map((s) => s.getText(ast))
  .join("\n");
const code = ts.transpileModule(helpers, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const functions = new Function(
  "formatDate",
  `${code};return {paymentBucketRange,cashflowAmountThb};`,
)((v) => v);
test("weekly buckets keep August 31 and September 1 in their payment months", () => {
  const august = functions.paymentBucketRange("2026-08-31", "weekly");
  const september = functions.paymentBucketRange("2026-09-01", "weekly");
  assert.equal(august.key.slice(0, 7), "2026-08");
  assert.equal(august.end, "2026-08-31");
  assert.equal(september.key, "2026-09-01");
  assert.equal(september.end, "2026-09-06");
});
test("valid fractional FX contributes to cashflow; missing FX never becomes THB at rate 1", () => {
  assert.equal(
    functions.cashflowAmountThb({
      currency: "JPY",
      exchangeRate: 0.25,
      amountThb: 25,
    }),
    25,
  );
  assert.equal(
    functions.cashflowAmountThb({
      currency: "USD",
      exchangeRate: 0,
      amountThb: 100,
    }),
    0,
  );
});

test("portal history query reads beyond 500 events and the database page limit", async () => {
  const portal = fs.readFileSync(
    new URL("../src/lib/po-portal.ts", import.meta.url),
    "utf8",
  );
  const source = ts.createSourceFile(
    "portal.ts",
    portal,
    ts.ScriptTarget.Latest,
    true,
  );
  const fetch = source.statements
    .find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "fetchAllRows")
    .getText(source);
  const size = source.statements
    .find(
      (s) =>
        ts.isVariableStatement(s) &&
        s.declarationList.declarations.some(
          (d) => d.name.getText(source) === "PAGE_SIZE",
        ),
    )
    .getText(source);
  const fixture = Array.from({ length: 2101 }, (_, i) => ({
    payment_id: String(i).padStart(5, "0"),
  }));
  const mock = {
    from: () => ({
      select() {
        return this;
      },
      order() {
        return this;
      },
      range(start, end) {
        return {
          ...this,
          then(resolve) {
            return Promise.resolve(
              resolve({ data: fixture.slice(start, end + 1), error: null }),
            );
          },
        };
      },
    }),
  };
  const compiled = ts.transpileModule(`${size}\n${fetch}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const load = new Function(
    "getSupabaseServiceClient",
    `${compiled};return fetchAllRows;`,
  )(() => mock);
  const events = await load(
    "po_payment_timeline_events",
    "payment_id",
    "payment_id",
  );
  assert.equal(events.length, 2101);
  assert.equal(new Set(events.map((e) => e.payment_id)).size, 2101);
  // The portal's actual call must use this paginated seam, rather than a single limited query.
  assert.match(
    portal,
    /fetchAllRows<PoPaymentTimelineEventRow>\(\s*"po_payment_timeline_events"/,
  );
});
