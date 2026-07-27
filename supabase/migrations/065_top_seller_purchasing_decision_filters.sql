alter table public.top_seller_product_design_snapshot
  add column if not exists item_statuses text[] not null default '{}'::text[],
  add column if not exists visibilities text[] not null default '{}'::text[];

comment on column public.top_seller_product_design_snapshot.item_statuses is
  'Effective Status values from the saved Reorder Planning / Purchasing Decision rows in this design-color group.';

comment on column public.top_seller_product_design_snapshot.visibilities is
  'Visibility values derived from Purchasing Decision hide_from_purchasing for SKUs in this design-color group.';
