-- Manual override table for Cost Price Monitor.
-- Overrides are separate from PO history and are used only for Cost Price Monitor effective display/export values.

create extension if not exists "pgcrypto";

create table if not exists public.cost_price_monitor_overrides (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  main_name text,
  color text,
  supplier text,
  category text,
  product_group text,
  manual_purchase_price numeric,
  manual_landed_cost numeric,
  manual_selling_price numeric,
  note text,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint cost_price_monitor_overrides_group_key_not_blank check (btrim(group_key) <> ''),
  constraint cost_price_monitor_overrides_manual_purchase_non_negative check (
    manual_purchase_price is null or manual_purchase_price >= 0
  ),
  constraint cost_price_monitor_overrides_manual_landed_non_negative check (
    manual_landed_cost is null or manual_landed_cost >= 0
  ),
  constraint cost_price_monitor_overrides_manual_selling_non_negative check (
    manual_selling_price is null or manual_selling_price >= 0
  )
);

create unique index if not exists cost_price_monitor_overrides_group_key_uidx
  on public.cost_price_monitor_overrides (group_key);

create index if not exists cost_price_monitor_overrides_updated_at_idx
  on public.cost_price_monitor_overrides (updated_at desc);

grant select, insert, update, delete on table public.cost_price_monitor_overrides to service_role;
revoke all on table public.cost_price_monitor_overrides from anon;

comment on table public.cost_price_monitor_overrides is
  'Manual Cost Price Monitor overrides. Does not overwrite PO cost history.';
