-- Fast dashboard read model for Top Seller by product design and color.
-- The application rebuilds this snapshot after sales/catalog sync. Dashboard
-- reads never aggregate raw sales lines.

create table if not exists public.top_seller_product_design_snapshot (
  group_key text primary key,
  category text not null default 'Uncategorized',
  design_name text not null,
  color text not null default 'No color',
  suppliers text[] not null default '{}',
  tags text[] not null default '{}',
  image_url text,
  sku_count integer not null default 0 check (sku_count >= 0),
  sold_30 numeric(14, 4) not null default 0,
  sold_90 numeric(14, 4) not null default 0,
  total_sale numeric(14, 4) not null default 0,
  demand_index_30 numeric(14, 6) not null default 0,
  demand_index_90 numeric(14, 6) not null default 0,
  demand_index_lifetime numeric(14, 6) not null default 0,
  snapshot_token uuid not null,
  refreshed_at timestamptz not null default now()
);

create index if not exists idx_top_seller_snapshot_category
  on public.top_seller_product_design_snapshot (category);

create index if not exists idx_top_seller_snapshot_demand_30
  on public.top_seller_product_design_snapshot (demand_index_30 desc);

create index if not exists idx_top_seller_snapshot_demand_90
  on public.top_seller_product_design_snapshot (demand_index_90 desc);

create index if not exists idx_top_seller_snapshot_demand_lifetime
  on public.top_seller_product_design_snapshot (demand_index_lifetime desc);

create index if not exists idx_top_seller_snapshot_suppliers
  on public.top_seller_product_design_snapshot using gin (suppliers);

create index if not exists idx_top_seller_snapshot_tags
  on public.top_seller_product_design_snapshot using gin (tags);

alter table public.top_seller_product_design_snapshot enable row level security;

revoke all on table public.top_seller_product_design_snapshot
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.top_seller_product_design_snapshot
  to service_role;

comment on table public.top_seller_product_design_snapshot is
  'Rebuildable internal dashboard snapshot. Source metadata follows Reorder Planning overrides; sales metrics follow demand_index_current.';
