# Supabase Setup

Phase 1 uses Supabase as the read model for Shopify products, inventory snapshots, sales lines, reorder runs, and read-only dashboard data.
Phase 2 adds purchase order tables so incoming stock can come from real PO workflow data instead of only the AppSheet/Excel export.

## Local steps

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SHOPIFY_SHOP_DOMAIN`
   - `SHOPIFY_ADMIN_ACCESS_TOKEN`
   - `SYNC_SECRET`
4. Apply the migrations in order:

```sql
-- paste into Supabase SQL editor
-- supabase/migrations/001_phase1_shopify_read_model.sql
-- supabase/migrations/002_phase1_sales_lines.sql
-- supabase/migrations/003_manual_supplier_mappings.sql
-- supabase/migrations/004_phase2_po_portal.sql
```

5. Run the app and open `/api/health`.
6. Trigger a one-page test sync:

```bash
curl -X POST "http://localhost:3000/api/sync/shopify?maxPages=1" -H "x-sync-secret: change-me-before-enabling-cron"
```

7. If the one-page test succeeds, run the full sync:

```bash
curl -X POST http://localhost:3000/api/sync/shopify -H "x-sync-secret: change-me-before-enabling-cron"
```

## Tables created in Phase 1

- `shopify_locations`
- `products`
- `product_variants`
- `inventory_snapshots`
- `sales_lines`
- `manual_supplier_mappings`
- `sync_runs`

The product sync endpoint persists products, variants, locations, and inventory snapshots. Sales history sync is intentionally separate so the initial backfill range can be controlled before routine daily imports begin.

## Tables created in Phase 2

- `po_suppliers`
- `po_orders`
- `po_items`
- `po_receipts`
- `po_status_events`

Phase 2 also creates:

- `po_item_receipt_totals`
- `po_incoming_by_sku`

The `po_incoming_by_sku` view is the future source for dashboard incoming
quantity. It counts outstanding quantities from active PO item statuses
(`inpro`, `delivery`, `final_payment`) and keeps pending approval quantities
separate (`waiting_for_approve`).

## PO Portal import

After applying `004_phase2_po_portal.sql`, run:

```bash
npm run import:po-portal -- --dry-run
npm run import:po-portal
```

The importer reads the generated `src/lib/po-portal-data.ts` snapshot from
`Po-Portals.xlsx` and upserts suppliers, PO headers, and PO lines. Legacy
AppSheet received quantities are kept in `legacy_received_qty`; new receiving
events should be inserted into `po_receipts`.

## Cron

Daily 05:00 ICT is 22:00 UTC on the previous date. `vercel.json` is configured to call the daily incremental endpoint at `0 22 * * *` UTC.

Recommended cron request:

```text
GET https://your-domain.com/api/sync/daily
Authorization: Bearer <CRON_SECRET>
```

The daily endpoint always syncs the previous one-day window. It does not re-import all historical order lines.

## Sales line backfill

Use this once after applying `002_phase1_sales_lines.sql` to seed order history from 2025 onward:

```bash
curl -X POST "http://localhost:3000/api/sync/sales-lines?since=2025-01-01&until=now&maxPages=10" -H "x-sync-secret: change-me-before-enabling-cron"
```

Increase or remove `maxPages` only after the first small backfill succeeds.
If the response returns `"capped": true`, continue the same date window by
passing `cursor=<lastCursor>` from the response.

## Daily incremental behavior

`POST /api/sync/daily`

Syncs:

- products/variants updated in the previous 24 hours
- orders/sales lines created in the previous 24 hours

Important inventory note:

Shopify inventory quantity changes do not always behave like product updates. For absolute inventory accuracy, keep the first full inventory sync available and consider a weekly full inventory refresh or inventory webhooks in a later phase.
