# Stock count PDF Show Qty

The PDF export link now sends `showQty=1` while Show Qty is enabled. The endpoint loads current inventory using the same location-specific helper and permission checks as the screen. Hidden Qty retains the original blank counting PDF.

The PDF displays current system quantities in red above each SKU label, with 0 retained and an em dash for unavailable inventory. The printed legend identifies these as current system quantities rather than counted quantities. The screen's help text now describes the PDF behavior accurately. Inventory load failure returns 503 instead of silently generating a blank PDF.

Three regression tests exercise actual PDF generation and the endpoint: red quantities / zero / missing inventory, the hidden-quantity default, and request propagation / location permissions. The Show Qty regression failed against the previous PDF generator and passes with this change. Typecheck, targeted lint and production build pass. No schema or stock count data changes are required.
