-- Phase 1.2 read model for incremental Shopify order line sync.
-- This stores sales lines needed for demand/reorder calculations.

create table if not exists sales_lines (
  id uuid primary key default uuid_generate_v4(),
  shopify_order_id text not null,
  shopify_order_gid text not null,
  shopify_line_item_id text not null unique,
  shopify_line_item_gid text not null unique,
  order_name text,
  order_date date not null,
  created_at_shopify timestamptz not null,
  processed_at_shopify timestamptz,
  cancelled_at_shopify timestamptz,
  financial_status text,
  fulfillment_status text,
  currency text,
  sku text,
  product_name text,
  variant_title text,
  product_id text,
  variant_id text,
  quantity numeric(14, 4) not null default 0,
  unit_price numeric(14, 4),
  line_total numeric(14, 4),
  synced_at timestamptz not null default now()
);

create index if not exists idx_sales_lines_order_date on sales_lines (order_date);
create index if not exists idx_sales_lines_sku_date on sales_lines (sku, order_date);
create index if not exists idx_sales_lines_created_at_shopify on sales_lines (created_at_shopify);

alter table sync_runs
  add column if not exists sales_lines_seen integer not null default 0,
  add column if not exists since_at timestamptz,
  add column if not exists until_at timestamptz;
