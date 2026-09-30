alter table public.top_seller_product_design_snapshot
  add column sku_details jsonb not null default '[]'::jsonb
  check (jsonb_typeof(sku_details) = 'array');

comment on column public.top_seller_product_design_snapshot.sku_details is
  'Per-SKU sales and demand metrics for the dashboard expand view; rebuilt with the design snapshot.';
