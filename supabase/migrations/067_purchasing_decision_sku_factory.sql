alter table public.purchasing_decision_controls
  add column if not exists sku_factory text;

comment on column public.purchasing_decision_controls.sku_factory is
  'Factory-assigned SKU maintained manually from Reorder Planning.';
