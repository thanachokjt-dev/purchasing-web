-- Fix Cost Price Monitor group-level override upserts.
-- Supabase upsert uses onConflict: "group_key", which requires a matching
-- non-partial unique constraint/index on exactly group_key.

update public.cost_price_monitor_overrides
set group_key = btrim(group_key)
where group_key is not null and group_key <> btrim(group_key);

alter table if exists public.cost_price_monitor_overrides
  alter column group_key set not null;

create unique index if not exists cost_price_monitor_overrides_group_key_uidx
  on public.cost_price_monitor_overrides (group_key);

grant select, insert, update, delete on table public.cost_price_monitor_overrides to service_role;
revoke all on table public.cost_price_monitor_overrides from anon;
