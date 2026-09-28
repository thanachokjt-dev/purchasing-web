# Shipping/Freight payment allocation

## Behavior and plan

Saving Payments sums the saved `shipping` and `freight` rows, including planned
and paid rows. Amounts are converted to THB using the row's FX (THB always uses 1).
Other payment types do not contribute to this allocation.

1. Merchandise value = ordered quantity × unit price, converted to THB.
2. Weight = merchandise line value / total merchandise value.
3. Allocated line expense = total Shipping/Freight in THB × weight.
4. Freight/unit = allocated line expense / line FX / ordered quantity.
5. Landed/unit = unit price + Freight/unit, in that SKU line's currency.

Example: two units at 100 and one unit at 300 have values 200 and 300.
For expenses of 100, their weights are 40% and 60%, line expenses are 40 and 60,
Freight/unit is 20 and 60, and Landed/unit is 120 and 360.

The database saves allocation and payments in the same transaction and locks the
PO header. Saving draft lines also recalculates from the current payment rows,
so changing quantity, price, adding/removing lines, or saving again cannot add
the expense twice. Missing FX or zero total merchandise value rejects the whole
transaction. Free items and zero-quantity lines receive zero allocation.

Merchandise payment FX takes priority; otherwise the latest same-currency
payment can provide FX. Missing FX is never treated as THB. Shipping/Freight
does not increase the merchandise payment balance or count as merchandise paid.

## Precision and compatibility

`payment_freight_amount_thb` retains each line's exact monetary allocation at
four decimals. Cumulative rounding makes the sum equal the total converted
Shipping/Freight payments. `source_payload.paymentFreightAllocation` records
the basis, FX, unrounded per-unit expense and total pool for audit.

Existing `freight_unit_cost` and `landed_unit_cost` remain four-decimal fields.
Multiplying these rounded unit figures by quantity can differ from the exact
line allocation; use `payment_freight_amount_thb` for expense reconciliation.
Unit costs retain the existing precision consumed by SKU cost reports.

POs with no nonzero Shipping/Freight and no previous automatic allocation are
unchanged, including existing manual freight. Changing/removing the last
Shipping/Freight expense clears previously automatic freight to zero and resets
Landed/unit to unit price. Automatic payment allocation replaces the freight
component instead of adding it to manual freight. The separate manual allocation
action rejects use while nonzero Shipping/Freight payments exist.

After Payment save, the detail view refreshes and the Draft Line Details key
includes freight and landed costs. The existing dirty-form refresh guard
preserves unsaved draft edits; saving those edits recalculates freight in the DB.

## Validation and rollout

Run `npm run test:po-landed-cost`. It runs the real table migrations and both RPCs
in isolated PGlite PostgreSQL, including the existing transaction regression SQL.
Coverage includes weighted allocation, planned/paid expenses, repeat saves,
edits/deletions, draft changes, mixed currency, rounding, free/zero quantities,
missing FX, rollback, no-expense compatibility and server-only function access.

Apply `20260928072722_payment_landed_cost_by_value.sql` before deploying the
updated application. It introduces a restricted SECURITY INVOKER helper and
replaces the two existing restricted save RPCs without changing signatures.
Existing production records are not backfilled by this migration. Saving their
Payments or Draft Lines performs the allocation using current saved costs.
No production PO payments were altered during development.

Validation completed: all eight PostgreSQL integration tests, targeted ESLint,
TypeScript typecheck and production build passed.
