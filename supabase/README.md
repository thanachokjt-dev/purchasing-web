# Supabase Setup

Phase 1 uses Supabase as the read model for Shopify products, inventory snapshots, sales lines, reorder runs, and read-only dashboard data.

## Local steps

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SHOPIFY_SHOP_DOMAIN`
   - `SHOPIFY_ADMIN_ACCESS_TOKEN`
   - `SYNC_SECRET`
4. Apply the Phase 1 migrations in order:

```sql
-- paste into Supabase SQL editor
-- supabase/migrations/001_phase1_shopify_read_model.sql
-- supabase/migrations/002_phase1_sales_lines.sql
-- supabase/migrations/003_manual_supplier_mappings.sql
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
