# Included VAT disclosure on PO payments

The user confirmed that existing THB paid amounts already include VAT. VAT disclosure uses gross THB paid × 7 / 107, rounded to two decimals. Gross amounts, FX, dates, payment statuses, balances and landed-cost allocation remain unchanged. The UI adds `VAT 7% (included)` alongside THB paid and updates its preview when amount, FX or payment type changes.

Shipping, Freight and VAT / Import VAT payment types receive empty tax fields. All payment types for CSD FASHION / Weyes (supplier code CSD001) and Engage / Engage Global (ENGAGE001) receive empty tax fields. Other nonblank payment types, including Other and Fine, receive the 7% included VAT disclosure, as requested. Matching is case-insensitive and supports payment type display labels.

Migration `20260929093000_po_payment_included_vat.sql` adds nullable `vat_rate` and `vat_amount_thb`, backfills saved payments, derives tax fields on insert / update, and refreshes them if a PO supplier changes. Client-supplied VAT fields cannot override the derived rule. Functions use invoker privileges with a fixed empty search path and the calculation helper is restricted to the service role. Payment detail queries include the new fields to keep optimistic save snapshots complete.

Production migration succeeded. There are 183 saved payments: 88 taxable and 95 with empty tax. Total included VAT is 273,278.07 THB. Before and after, gross THB paid totals remain 14,808,210.3638 THB; the fingerprint of all existing payment fields other than updated_at is identical (`b7d2522a612a88af787945b4f3bea1f8`). Every row matches the tax policy and formula, with zero mismatches. Updated timestamps advance normally through the existing payment touch trigger.

Twelve real PostgreSQL integration tests pass, including SQL / UI policy parity, rounding, RPC saves with optimistic snapshots, supplier changes and attempted VAT tampering, plus existing landed-cost regressions. Typecheck, targeted lint and production build pass.
