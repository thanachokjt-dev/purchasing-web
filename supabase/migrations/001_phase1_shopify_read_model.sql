-- Phase 1 read model for Shopify product, variant, inventory, and sync logging.
-- Apply this in Supabase SQL editor before running POST /api/sync/shopify.

create extension if not exists "uuid-ossp";

create table if not exists shopify_locations (
  id text primary key,
  shopify_gid text not null unique,
  name text not null,
  is_active boolean not null default true,
  synced_at timestamptz
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  shopify_product_id text not null unique,
  shopify_gid text not null unique,
  product_title text not null,
  product_type text,
  vendor text,
  tags text[] not null default '{}',
  status text,
  product_image_url text,
  created_at_shopify timestamptz,
  updated_at_shopify timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_variants (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id),
  shopify_variant_id text not null unique,
  shopify_gid text not null unique,
  shopify_inventory_item_id text,
  shopify_inventory_item_gid text,
  sku text not null unique,
  barcode text,
  variant_title text,
  option1_name text,
  option1_value text,
  option2_name text,
  option2_value text,
  option3_name text,
  option3_value text,
  option_pick text,
  price numeric(14, 4),
  compare_at_price numeric(14, 4),
  tracked boolean not null default true,
  variant_image_url text,
  item_status text,
  effective_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_snapshots (
  id uuid primary key default uuid_generate_v4(),
  snapshot_date date not null,
  variant_id uuid references product_variants(id),
  shopify_variant_id text not null,
  sku text not null,
  location_id text references shopify_locations(id),
  available numeric(14, 4) not null default 0,
  on_hand numeric(14, 4) not null default 0,
  committed numeric(14, 4) not null default 0,
  incoming numeric(14, 4) not null default 0,
  reserved numeric(14, 4) not null default 0,
  safety_stock numeric(14, 4) not null default 0,
  synced_at timestamptz not null default now(),
  unique (snapshot_date, shopify_variant_id, location_id)
);

create table if not exists sync_runs (
  id uuid primary key default uuid_generate_v4(),
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  mode text not null default 'manual',
  products_seen integer not null default 0,
  variants_seen integer not null default 0,
  inventory_rows_seen integer not null default 0,
  pages_seen integer not null default 0,
  throttle jsonb,
  error_message text
);

create index if not exists idx_products_title on products (product_title);
create index if not exists idx_product_variants_sku on product_variants (sku);
create index if not exists idx_inventory_snapshots_sku_date on inventory_snapshots (sku, snapshot_date);
create index if not exists idx_inventory_snapshots_variant_date on inventory_snapshots (shopify_variant_id, snapshot_date);
create index if not exists idx_sync_runs_source_started on sync_runs (source, started_at desc);
