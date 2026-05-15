-- Shopify sales sync reliability:
-- - track updated-at windows for rolling order refreshes
-- - record richer row counts on sync_runs
-- - provide a small DB-backed lock so overlapping order syncs do not compete

alter table sales_lines
  add column if not exists updated_at_shopify timestamptz;

create index if not exists idx_sales_lines_updated_at_shopify
  on sales_lines (updated_at_shopify);

create index if not exists idx_sales_lines_shopify_order_id
  on sales_lines (shopify_order_id);

alter table sync_runs
  add column if not exists window_start timestamptz,
  add column if not exists window_end timestamptz,
  add column if not exists window_field text,
  add column if not exists rows_fetched integer not null default 0,
  add column if not exists rows_upserted integer not null default 0,
  add column if not exists rows_failed integer not null default 0,
  add column if not exists orders_seen integer not null default 0,
  add column if not exists has_next_page boolean,
  add column if not exists last_cursor text,
  add column if not exists lock_key text,
  add column if not exists lock_acquired_at timestamptz;

create table if not exists sync_locks (
  source text primary key,
  run_id uuid not null,
  locked_at timestamptz not null default now(),
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create or replace function try_acquire_sync_lock(
  lock_source text,
  lock_run_id uuid,
  lock_ttl_seconds integer default 1800
)
returns boolean
language plpgsql
as $$
declare
  acquired integer;
begin
  insert into sync_locks (source, run_id, locked_at, locked_until, updated_at)
  values (
    lock_source,
    lock_run_id,
    now(),
    now() + make_interval(secs => greatest(lock_ttl_seconds, 60)),
    now()
  )
  on conflict (source) do update
    set run_id = excluded.run_id,
        locked_at = excluded.locked_at,
        locked_until = excluded.locked_until,
        updated_at = excluded.updated_at
    where sync_locks.locked_until <= now()
       or sync_locks.run_id = excluded.run_id
  returning 1 into acquired;

  return coalesce(acquired = 1, false);
end;
$$;

create or replace function release_sync_lock(
  lock_source text,
  lock_run_id uuid
)
returns void
language sql
as $$
  delete from sync_locks
  where source = lock_source
    and run_id = lock_run_id;
$$;
