# Separate USD source costs from THB costing

The reported PO's unit prices were already THB, but 1,614 of 2,984 units were
labelled USD. The allocation treated those prices as USD and multiplied them
by 33.37, causing THB lines to receive unusually small shares. The exact expense
pool reconciled, but its weights represented the wrong currency semantics.

The user confirmed every current unit price in PO-20260528012110353 is THB.
Correct this PO's line currency labels without changing its prices, quantities,
or payments, preserve the previous currency label in source_payload, then
recalculate Shipping + Freight from the saved payments (361,688.66 THB).
No other PO is relabelled without confirmation.

Draft Line Details now retains source USD/unit in source_payload.unitPriceUsd,
separately from the existing unit_price/currency fields consumed by costing.
appliedFxRate records an explicit conversion. Apply avg FX takes USD/unit ×
arithmetic mean of saved USD merchandise payment rates, rounded to four decimals,
and writes THB/unit. It never multiplies a previously converted THB price.
Missing USD prices leave existing costs untouched. Manual THB edits clear the
applied-FX marker while preserving the original USD value. Payment records keep
their own amount, currency and FX unchanged. Expense/tax FX and THB FX 1 are
excluded from the purchase-FX average.

On initial load, missing USD/unit is populated from the latest closed/received
PO for that SKU (excluding the current PO), using saved source USD/unit first
and otherwise a historical line explicitly recorded in USD. The Load previous
USD costs button fills blank source prices for newly added SKUs, preserving
existing manually entered USD values. Conversion remains an explicit Apply step.

The existing draft-save RPC validates the source USD and FX, computes conversion
on the server, saves both fields and allocates freight in the same transaction.
Its signature and service-role-only permissions remain unchanged. Older callers
without dual-price keys retain the stored metadata. Repricing uses the line's
costing currency rather than the payment/header currency.
When a source USD price exists, the PO's USD merchandise total uses that price
directly; it is not reconstructed from THB using a different payment FX.

Validation: real PostgreSQL save/conversion/allocation regression tests, including
repeat Apply/save, missing USD, manual THB override and reconstruction of the
combined 361,688.66 THB pool across 2,984 units. The source-cost helper test checks
32.83 and 33.37 average to 33.10 and excludes expense/tax FX.
