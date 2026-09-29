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

Compact layout / freshness update: chart height is bounded at 240px on mobile and 290px on desktop, with slimmer bars, compact axis labels, exact hover amounts, and a category summary on the right (stacked below on mobile). PO saves now invalidate `/purchasing-dashboard`; a Refresh button reloads the server data. Read-only live verification after retrospective edits gives 7,940,730.15 THB across 94 payments; shipping 869,232.67 and VAT 680,616.70 match the user's updated screenshots. Local browser verified the actual client component at mobile and desktop breakpoints, no horizontal document overflow or console errors, and Refresh behavior. Temporary preview source was removed before production build.

VAT / transport review: independent SQL confirms September VAT 234,395.32 = explicit tax/import VAT payments 225,769.55 + included merchandise VAT 8,625.77. September transport is 613,456.56 = freight 341,091.26 + shipping/customs 272,365.30. The latter already includes the 1,350 shipping row. Added source disclosures in monthly comparison, filtered ledger summaries and ledger/export source labels so these totals can be checked without conflating standalone import tax with included VAT. Four month columns have distinct pastel colors; total columns are red. Source financial records and allocation rules were preserved.

## Manual PO classification

Actual payment details now offers Auto / New order / Existing order once per PO on the visible ledger page. A manual choice applies to all merchandise in that PO, including every SKU and merchandise payment. It moves cash between new and existing categories, and updates new-order quantity/raw-value groups and Excel. VAT, shipping/customs, other expenses and total paid cash are unchanged. Auto restores first-SKU-PO logic; overriding the earliest PO does not silently shift the SKU's first purchase to a later PO. Incomplete raw costs remain disclosed, while a manual New choice still classifies the unallocated merchandise cash as new.

Migration `20260929091100_purchasing_order_classification.sql` adds the constrained persisted classification (default Auto), last actor and last changed time. All existing POs remain Auto. No real PO classification was selected during verification. Updates require an active authenticated user with both purchasing-dashboard access and existing PO edit permission; readonly viewers see labels only. The action targets one PO, reports save errors/not-found, and revalidates the dashboard. Excel records the selected classification and documents its scope.

Verification: 33 model/payment/timeline/migration/action tests passed, including classification restoration, cash conservation, missing raw costs, authorization, persistence constraints, and export classification. Production build and targeted lint passed. Read-only live loader/export gave 7,940,730.15 THB and all classifications Auto. Subsequent user payment-date edits moved transport and tax between months (September transport 370,196.55, VAT 129,300.77); four-month category totals stayed unchanged. Actual client markup verified eight unique editable PO controls on the first New-order page and no edit controls for readonly viewers. Authenticated production saving is covered by action/database tests, not a claimed production browser login.
