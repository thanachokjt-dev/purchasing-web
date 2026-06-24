-- Scoped Cost Price Monitor overrides.
-- Keeps the existing group-level table intact, while allowing SKU-level
-- overrides and explicit group defaults for weighted family rollups.

create extension if not exists "pgcrypto";

create table if not exists public.cost_price_monitor_variant_overrides (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  sku text,
  group_key text,
  manual_purchase_price numeric,
  manual_landed_cost numeric,
  manual_selling_price numeric,
  note text,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint cost_price_monitor_variant_overrides_scope_check check (
    scope in ('sku', 'group_default')
  ),
  constraint cost_price_monitor_variant_overrides_scope_target_check check (
    (scope = 'sku' and sku is not null and btrim(sku) <> '')
    or
    (scope = 'group_default' and group_key is not null and btrim(group_key) <> '')
  ),
  constraint cost_price_monitor_variant_overrides_manual_purchase_non_negative check (
    manual_purchase_price is null or manual_purchase_price >= 0
  ),
  constraint cost_price_monitor_variant_overrides_manual_landed_non_negative check (
    manual_landed_cost is null or manual_landed_cost >= 0
  ),
  constraint cost_price_monitor_variant_overrides_manual_selling_non_negative check (
    manual_selling_price is null or manual_selling_price >= 0
  )
);

create unique index if not exists cost_price_monitor_variant_overrides_sku_uidx
  on public.cost_price_monitor_variant_overrides (sku)
  where scope = 'sku';

create unique index if not exists cost_price_monitor_variant_overrides_group_default_uidx
  on public.cost_price_monitor_variant_overrides (group_key)
  where scope = 'group_default';

create unique index if not exists cost_price_monitor_variant_overrides_scope_sku_uidx
  on public.cost_price_monitor_variant_overrides (scope, sku);

create unique index if not exists cost_price_monitor_variant_overrides_scope_group_uidx
  on public.cost_price_monitor_variant_overrides (scope, group_key);

create index if not exists cost_price_monitor_variant_overrides_updated_at_idx
  on public.cost_price_monitor_variant_overrides (updated_at desc);

insert into public.cost_price_monitor_variant_overrides (
  scope,
  group_key,
  manual_purchase_price,
  manual_landed_cost,
  manual_selling_price,
  note,
  updated_by,
  created_at,
  updated_at
)
select
  'group_default',
  legacy.group_key,
  legacy.manual_purchase_price,
  legacy.manual_landed_cost,
  legacy.manual_selling_price,
  legacy.note,
  legacy.updated_by,
  coalesce(legacy.created_at, now()),
  coalesce(legacy.updated_at, now())
from public.cost_price_monitor_overrides legacy
where legacy.group_key is not null
  and btrim(legacy.group_key) <> ''
on conflict (scope, group_key)
do update set
  manual_purchase_price = excluded.manual_purchase_price,
  manual_landed_cost = excluded.manual_landed_cost,
  manual_selling_price = excluded.manual_selling_price,
  note = excluded.note,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at
where public.cost_price_monitor_variant_overrides.updated_at is null
   or excluded.updated_at >= public.cost_price_monitor_variant_overrides.updated_at;

grant select, insert, update, delete on table public.cost_price_monitor_variant_overrides to service_role;
revoke all on table public.cost_price_monitor_variant_overrides from anon;

comment on table public.cost_price_monitor_variant_overrides is
  'Scoped Cost Price Monitor overrides. SKU rows override group_default rows; legacy group overrides remain untouched.';
