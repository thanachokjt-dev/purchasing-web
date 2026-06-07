-- Ensure Cost Price Monitor overrides are product-family/group-level.

alter table if exists public.cost_price_monitor_overrides
  add column if not exists group_key text,
  add column if not exists main_name text,
  add column if not exists color text,
  add column if not exists supplier text,
  add column if not exists category text,
  add column if not exists product_group text;

update public.cost_price_monitor_overrides
set group_key = btrim(group_key)
where group_key is not null and group_key <> btrim(group_key);

alter table if exists public.cost_price_monitor_overrides
  alter column group_key set not null;

create unique index if not exists cost_price_monitor_overrides_group_key_uidx
  on public.cost_price_monitor_overrides (group_key);

grant select, insert, update, delete on table public.cost_price_monitor_overrides to service_role;
revoke all on table public.cost_price_monitor_overrides from anon;
