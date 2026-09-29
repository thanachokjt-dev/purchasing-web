# Purchasing dashboard

New menu: **Purchasing Dashboard**, `/purchasing-dashboard`, in the sidebar's overview/analytics group. A separate detail view at `?view=details` includes expandable product families and a searchable, paginated payment ledger. Existing dashboards remain available.

## Definitions

- Four calendar months including the current month, ending today in Asia/Bangkok. Current month is explicitly partial. On 29 September 2026 this is 1 June–29 September.
- Cash: only Paid payments dated in the reporting window. Planned payments and future payment dates are excluded. Cash on cancelled orders still represents actual money paid and stays in the ledger.
- Categories: first-order merchandise, existing-order merchandise, shipping/freight/customs/clearance/duty/brokerage, VAT/import VAT, and other product expenses.
- Included VAT is moved out of the payment's other expense category into the VAT category, never added on top of gross cash. Explicit VAT payment rows belong entirely to VAT. Legacy Other rows whose reference/note explicitly identifies VAT or customs are classified accordingly without modifying source records.
- First purchase means each SKU's earliest eligible PO across ALL history, sorted by PO date, creation time, then PO ID. Draft/cancelled orders, cancelled lines, and cancelled quantity do not establish first purchase. Missing historical dates prevent claiming that SKU as new.
- SKU families use current catalog/controlled product names; major categories consolidate clothing, training/protective gear, accessories, children, supplements, and body care. No product cost overrides or estimated landed costs enter the model.
- Raw merchandise value is remaining ordered quantity × raw unit price converted to THB within that PO. THB uses FX 1. Foreign items use applied PO FX or the average merchandise-payment FX for that currency within the same PO. Landed cost is excluded.
- Quantity/raw value use PO month; actual paid uses payment month. Consequently they can differ substantially. First-order payments for POs before the reporting window show cash with zero ordered quantity in the window.
- Mixed merchandise payments are allocated by raw merchandise value in satang using largest remainders, preserving the original cash total. Missing cost/FX for any merchandise line prevents partial, overstated allocations: its merchandise payment stays in the existing-order category with a visible warning and unallocated ledger label.
- Foreign payments missing recorded FX are excluded and reported. Missing product prices remain missing; they never become fabricated zero unit costs. Known merchandise subtotal and uncovered quantity are shown separately.

## Export and access

Excel has Overview, New products, Payments, and Definitions sheets, a native monthly stacked chart, native four-month sparklines, frozen headers, filters, and product/SKU outlines. SKU child rows start collapsed. Group totals and child SKU values must not be summed together. The payment ledger's allocated amount is additive; repeated gross-payment reference amounts are explicitly marked non-additive.

Page and export share the same server loader/model. Export always contains the entire four-month population; local detail filters affect inspection only and the UI states the export scope. Existing dashboard/admin/accounting authorization is enforced server-side. Export rejects unauthenticated/inactive users and unauthorized roles before loading financial data. No public financial API or database write/migration was added.

## Verification

- 12 dedicated model/export/authorization tests; 12 existing payment/VAT/landed-cost regressions.
- Read-only live reconciliation: 89 Paid payments, gross **7,283,030.24 THB**, matching an independent SQL sum and the five category totals.
- Initial category totals: new 1,716,256.86; existing 4,674,623.92; transport 499,208.71; VAT 392,940.75; other 0.
- Source coverage alerts: four unallocated merchandise payments and 390 first-order units lacking raw price or FX.
- Excel ZIP/XML parsed; openpyxl read all four sheets, the native chart, and the exact cash reconciliation. Native sparkline references checked directly in XML because openpyxl does not support the extension. No openpyxl save/rewrite occurred.
- Local browser used a temporary, localhost-only development preview of the actual client view with a read-only live data fixture. Verified product search, family expansion, September shipping filter (including 341,091.26 and 20,597.40), and absence of console errors after correcting SVG title hydration. Mobile document width stayed within the viewport. The preview route is removed before production build; authenticated production interaction is not claimed.

English UI update: dashboard labels, sidebar groups, month/date labels, warnings, and Excel content use English. Source-data classification still recognizes existing Thai aliases. Calculation rules are unchanged.
