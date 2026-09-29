# Stock count PDF Show Qty

The PDF export link now sends `showQty=1` while Show Qty is enabled. The endpoint loads current inventory using the same location-specific helper and permission checks as the screen. Hidden Qty retains the original blank counting PDF.

The PDF displays current system quantities in red above each SKU label, with 0 retained and an em dash for unavailable inventory. The printed legend identifies these as current system quantities rather than counted quantities. The screen's help text now describes the PDF behavior accurately. Inventory load failure returns 503 instead of silently generating a blank PDF.

Three regression tests exercise actual PDF generation and the endpoint: red quantities / zero / missing inventory, the hidden-quantity default, and request propagation / location permissions. The Show Qty regression failed against the previous PDF generator and passes with this change. Typecheck, targeted lint and production build pass. No schema or stock count data changes are required.

## Product photos and total on-hand export

Stock count pages now show Shopify variant / product thumbnails in the same 48px bordered style as Reorder Planning. Existing session lines are enriched from the current catalog, so prior sessions also receive images without a migration. PDFs embed thumbnails next to product names, with a neutral SKU placeholder when unavailable. Only HTTPS Shopify CDN images are fetched, with bounded image size, concurrency and timeout; thumbnail failure does not block printing.

An additional `Export PDF · Total On-hand` button requests `qtyScope=all`. It loads the latest Warehouse and Retail snapshots independently, adds known SKU quantities, and prints the total in red with a `WAREHOUSE + RETAIL` label and a distinct filename. If either SKU quantity is unavailable, the combined value remains unavailable rather than assuming zero. The existing location permission check remains required for the session being exported. Original Show Qty, location-specific PDF, CSV, counting and session behavior remain intact.

Six tests cover the original PDF behaviors, aggregate request propagation, labelled total quantities, zero / unavailable inventory, and actual thumbnail embedding with one image fetch per product. Read-only checks confirmed Shopify image availability in 99 of the first 100 sampled session variants and successful CDN delivery. Typecheck, lint and production build pass.
