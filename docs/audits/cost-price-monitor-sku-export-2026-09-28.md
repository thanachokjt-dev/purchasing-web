# Cost Price Monitor SKU / PO export

The cost monitor Excel export now contains product group rows, SKU rows showing the latest PO, and expandable PO history rows. The catalog export and its estimate controls retain their existing behavior.

Actual export columns show purchase cost per unit THB, shipping / freight per unit THB, and their sum from the same PO. Missing land cost is zero. The `estimatedLandCost` query parameter and manual cost overrides do not replace actual PO costs. Saved source USD prices remain available in a separate column.

Duplicate SKU lines within one PO are quantity weighted using uncancelled quantities. Payment freight allocations are divided by the original ordered quantity, matching the allocation RPC, before weighting the remaining quantities. Cancelled lines and cancelled POs remain excluded by the monitor's existing validity checks.

THB item prices are already converted and are not multiplied again. Foreign item prices use the saved applied FX or the arithmetic average of that PO's saved merchandise payment FX rates, rounded to six decimal places. Shipping, freight, VAT and other expense payments do not enter the merchandise FX average. Missing FX leaves THB cost cells blank with an explicit note; it never treats a USD value as THB or borrows FX from another PO.

The workbook freezes its title / note / headings and identity columns, includes filters, outline levels and four-decimal unit costs. All user text is stored as literal cells. Existing access checks, selection and filters are retained. PO history and nested payment records are loaded only for exports.

Validation: five regression tests cover PO pairing, repeated SKU lines, missing freight, USD FX, partial cancellations, hierarchy and XLSX structure. Existing FX tests, typecheck, lint and production build pass. A read-only query of PO `PO-20260528012110353` returned 30 lines and 5 saved payments. Exported freight reconciled to exactly 361,688.66 THB before display rounding; sample SKU `BTSS-MTG-BLK-6` shows 478.4690 + 128.4348 = 606.9038 THB/unit. The generated XLSX ZIP entries all parse as XML. Authenticated production download requires the user's existing login and was not exercised from an unauthenticated browser.

No migration or business data mutation is needed for this change.

## SKU Dashboard sheet

The workbook now opens on an additional `SKU Dashboard` sheet, with exactly one row per SKU. The original `Cost Price Monitor` detail sheet and web page retain their behavior. The dashboard averages purchase and freight unit costs across all eligible PO history, weighted by remaining PO quantity. A PO without freight contributes zero freight and its full quantity to the denominator. Both THB averages use the same set of POs with complete THB costs, so their sum remains comparable.

Dashboard columns include stock quantity, PO count, purchased quantity, average merchandise / freight / combined THB unit costs, known USD unit cost average, coverage percentage, current selling price, margin based on the combined average, covered quantity and PO date range. Missing FX is reported with coverage and a note, rather than silently treating unknown THB costs as zero. Source USD averages use only POs that have a saved USD price. Current stock does not weight historical cost averages.

Seven export regression tests pass, including unequal PO quantities, zero freight, partial FX coverage, all missing FX, dashboard sheet relationships and preservation of the original detail sheet.

### Exclude unpriced merchandise

Dashboard averages now exclude zero merchandise prices and their quantities before weighting, including unpriced lines within an otherwise priced PO. Zero freight on a positively priced merchandise line remains valid and contributes to the freight average. Dashboard USD averages also include only positive saved USD prices. The detail sheet preserves original prices and quantities; dashboard coverage reports the excluded quantities.

Eight regression tests pass. Read-only verification for `100CREA-5000-SMIC-500` found 7 PO lines, 92 total units, and 77 units with positive prices. The corrected average is 459.8726 THB/unit with zero freight; the 15 units in two unpriced POs no longer dilute the average.
