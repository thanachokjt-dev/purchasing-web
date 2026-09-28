import assert from "node:assert/strict";
import test from "node:test";
import { usdPaymentFxRates, usdUnitToThb } from "../src/lib/po-unit-costs.ts";

test("average FX uses USD merchandise records, excluding THB and expenses", () => {
  const row = (currency, type, rate) => ({ currency, payment_type: type, exchange_rate: rate, amount: 100 });
  const rates = usdPaymentFxRates([
    row("USD", "deposit30%", 32.83), row("USD", "beforeshipments70%", 33.37),
    row("THB", "shipping", 1), row("USD", "shipping", 35), row("USD", "vat_import_vat", 40),
  ]);
  assert.deepEqual(rates, ["32.83", "33.37"]);
  const avg = rates.reduce((sum, rate) => sum + Number(rate), 0) / rates.length;
  assert.equal(Number(avg.toFixed(6)), 33.1);
  assert.equal(usdUnitToThb(10, avg), 331);
  assert.equal(usdUnitToThb(null, avg), null); // Keep an existing THB cost when USD is unknown.
  assert.equal(usdUnitToThb(0, avg), 0);
});
