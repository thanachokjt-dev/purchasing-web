-- Fix scoped SKU overrides so multiple SKUs in the same product family can
-- coexist. PostgREST upsert needs the composite unique indexes, so keep them;
-- SKU-scoped rows must not store group_key because (scope, group_key) is unique.

create unique index if not exists cost_price_monitor_variant_overrides_scope_sku_uidx
  on public.cost_price_monitor_variant_overrides (scope, sku);

create unique index if not exists cost_price_monitor_variant_overrides_scope_group_uidx
  on public.cost_price_monitor_variant_overrides (scope, group_key);

update public.cost_price_monitor_variant_overrides
set group_key = null
where scope = 'sku'
  and group_key is not null;
