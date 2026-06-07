-- Keep Cost Price Monitor group-level override metadata aligned with Main Name + Color grouping.

alter table if exists public.cost_price_monitor_overrides
  add column if not exists color text;

grant select, insert, update, delete on table public.cost_price_monitor_overrides to service_role;
revoke all on table public.cost_price_monitor_overrides from anon;
