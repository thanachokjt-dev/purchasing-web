# Purchasing Control Room

Phase 1 web app for Shopify sync and read-only purchasing dashboard.

## Current Scope

- Read-only dashboard using the Excel baseline from `shopify inventory.xlsx` and `PURCHASE DECISION SUPPORT.xlsx`
- Environment readiness panel for Supabase and Shopify credentials
- Health API at `/api/health`
- Protected Shopify sync endpoint at `/api/sync/shopify`
- Protected Shopify sales line backfill endpoint at `/api/sync/sales-lines`
- Protected daily incremental sync endpoint at `/api/sync/daily`
- Supplier split and Thai T-shirt matrix validation views
- Buyer review queue that merges reorder and OOS comeback signals
- Excel-derived SKU supplier mapping from `PURCHASE DECISION SUPPORT.xlsx`
- AppSheet `Po-Portals.xlsx` incoming PO reconciliation and supplier terms for net suggestions
- Read-only PO Portal preview at `/po` using `Po-Portals.xlsx`
- Phase 2 Supabase PO Portal schema for suppliers, PO headers, PO lines, receipts, and status history

The app intentionally falls back to Excel baseline data when Supabase/Shopify credentials are not configured.

## Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/api/health
```

## Environment

Copy `.env.example` to `.env.local` and fill the values when ready:

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_or_custom_app_token
SYNC_SECRET=change-me-before-enabling-cron
CRON_SECRET=change-me-before-deploying-vercel-cron
```

## Supabase Migration

Apply migrations before running sync and PO Portal work:

```text
supabase/migrations/001_phase1_shopify_read_model.sql
supabase/migrations/002_phase1_sales_lines.sql
supabase/migrations/003_manual_supplier_mappings.sql
supabase/migrations/004_phase2_po_portal.sql
```

They create:

- `shopify_locations`
- `products`
- `product_variants`
- `inventory_snapshots`
- `sales_lines`
- `manual_supplier_mappings`
- `sync_runs`
- `po_suppliers`
- `po_orders`
- `po_items`
- `po_receipts`
- `po_status_events`

Phase 2 also creates views for PO receiving and incoming-stock calculations:

- `po_item_receipt_totals`
- `po_incoming_by_sku`

This is the foundation for replacing AppSheet incoming numbers with a real PO
workflow in the web app.

## Sync Endpoint

After setting env values, trigger a one-page Shopify sync test:

```bash
curl -X POST "http://localhost:3000/api/sync/shopify?maxPages=1" ^
  -H "x-sync-secret: change-me-before-enabling-cron"
```

Remove `?maxPages=1` after the test page succeeds.

## Daily Incremental Sync

After the first full product/inventory sync, use the daily endpoint for routine jobs. It always pulls the previous 24 hours only:

- Shopify products/items updated in the last 1 day
- Shopify orders/sales lines created in the last 1 day

Manual test:

```bash
curl -X POST "http://localhost:3000/api/sync/daily?maxPages=1" ^
  -H "x-sync-secret: change-me-before-enabling-cron"
```

Daily 05:00 ICT equals 22:00 UTC on the previous day for cron configuration. `vercel.json` is already configured with:

```json
{
  "path": "/api/sync/daily",
  "schedule": "0 22 * * *"
}
```

On Vercel, set `CRON_SECRET`; Vercel Cron calls the endpoint with `Authorization: Bearer <CRON_SECRET>`.

## Sales Line Backfill

Use this once to seed sales history from the start of 2025. Routine jobs should continue using `/api/sync/daily` only.

```bash
curl -X POST "http://localhost:3000/api/sync/sales-lines?since=2025-01-01&until=now&maxPages=10" ^
  -H "x-sync-secret: change-me-before-enabling-cron"
```

When the response has `"capped": true`, pass the returned `lastCursor` as
`cursor` to continue the same date window without repeating the first page.
Remove or increase `maxPages` only after the small page-by-page run succeeds.

For local month-by-month backfill, keep the dev server running and use:

```bash
npm run backfill:sales-lines -- --since=2025-02-01 --until=2025-03-01 --max-pages=10
```

## PO Portal Import

After applying `004_phase2_po_portal.sql`, import the current AppSheet PO export
snapshot into Supabase:

```bash
npm run import:po-portal -- --dry-run
npm run import:po-portal
```

The importer upserts suppliers, PO headers, and PO lines. Existing AppSheet
received quantities are stored as `legacy_received_qty`; new web-app receiving
events will be stored in `po_receipts`.

PO Portal implementation planning is tracked in
[`docs/po-portal-phase-plan.md`](docs/po-portal-phase-plan.md).

## Development Workflow

Use this sequence for each change set:

1. Ask
2. Plan
3. Implement
4. Review diff
5. Run/test
6. Commit

Keep each change scoped to one clear workflow or feature. Review the diff before
testing so unrelated file churn is caught early, then commit only after the
relevant checks pass.

## Verification

Commands used during Phase 1 setup:

```bash
npm run lint
npm run build
```

Browser verification checked:

- Dashboard content renders
- No Next.js error overlay
- No console errors
- `/api/health` returns `ok: true`
