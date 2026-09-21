begin;

create table public.weekly_stock_count_sessions (
  id uuid primary key default uuid_generate_v4(),
  week_start date not null,
  location_type text not null,
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  total_lines integer not null default 0,
  counted_lines integer not null default 0,
  constraint weekly_stock_count_sessions_location_check
    check (location_type in ('warehouse', 'retail')),
  constraint weekly_stock_count_sessions_status_check
    check (status in ('draft', 'completed')),
  constraint weekly_stock_count_sessions_progress_check
    check (total_lines >= 0 and counted_lines >= 0 and counted_lines <= total_lines),
  constraint weekly_stock_count_sessions_week_is_monday_check
    check (extract(isodow from week_start) = 1),
  constraint weekly_stock_count_sessions_week_location_key
    unique (week_start, location_type)
);

create table public.weekly_stock_count_lines (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.weekly_stock_count_sessions(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  sku text not null,
  product_group_key text not null,
  section_name text not null,
  family text not null,
  product_name text not null,
  size text not null,
  tags text[] not null default '{}',
  counted_qty integer,
  sort_order integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint weekly_stock_count_lines_qty_check
    check (counted_qty is null or counted_qty >= 0),
  constraint weekly_stock_count_lines_session_sku_key
    unique (session_id, sku),
  constraint weekly_stock_count_lines_session_group_size_key
    unique (session_id, product_group_key, size)
);

create index weekly_stock_count_sessions_week_idx
  on public.weekly_stock_count_sessions (week_start desc, location_type);

create index weekly_stock_count_lines_session_sort_idx
  on public.weekly_stock_count_lines (session_id, section_name, family, sort_order);

create or replace function public.set_weekly_stock_count_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_weekly_stock_count_sessions_updated_at
before update on public.weekly_stock_count_sessions
for each row execute function public.set_weekly_stock_count_updated_at();

create trigger set_weekly_stock_count_lines_updated_at
before update on public.weekly_stock_count_lines
for each row execute function public.set_weekly_stock_count_updated_at();

create or replace function public.create_weekly_stock_count_session(
  p_week_start date,
  p_location_type text,
  p_created_by uuid,
  p_lines jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_session_id uuid;
begin
  if p_location_type not in ('warehouse', 'retail') then
    raise exception 'Invalid stock count location';
  end if;
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'week_start must be a Monday';
  end if;
  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be a JSON array';
  end if;

  insert into public.weekly_stock_count_sessions (
    week_start,
    location_type,
    created_by
  ) values (
    p_week_start,
    p_location_type,
    p_created_by
  )
  on conflict (week_start, location_type) do nothing
  returning id into v_session_id;

  if v_session_id is null then
    select id into strict v_session_id
    from public.weekly_stock_count_sessions
    where week_start = p_week_start
      and location_type = p_location_type;
    return v_session_id;
  end if;

  insert into public.weekly_stock_count_lines (
    session_id,
    variant_id,
    sku,
    product_group_key,
    section_name,
    family,
    product_name,
    size,
    tags,
    sort_order
  )
  select
    v_session_id,
    source.variant_id,
    source.sku,
    source.product_group_key,
    source.section_name,
    source.family,
    source.product_name,
    source.size,
    coalesce(source.tags, '{}'::text[]),
    source.sort_order
  from jsonb_to_recordset(p_lines) as source(
    variant_id uuid,
    sku text,
    product_group_key text,
    section_name text,
    family text,
    product_name text,
    size text,
    tags text[],
    sort_order integer
  );

  update public.weekly_stock_count_sessions
  set total_lines = (select count(*) from public.weekly_stock_count_lines where session_id = v_session_id)
  where id = v_session_id;

  return v_session_id;
end;
$$;

create or replace function public.save_weekly_stock_count_values(
  p_session_id uuid,
  p_updated_by uuid,
  p_values jsonb
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if jsonb_typeof(p_values) <> 'array' then
    raise exception 'p_values must be a JSON array';
  end if;
  if exists (
    select 1
    from public.weekly_stock_count_sessions
    where id = p_session_id and status = 'completed'
  ) then
    raise exception 'Completed stock counts cannot be edited';
  end if;

  update public.weekly_stock_count_lines as target
  set
    counted_qty = source.counted_qty,
    updated_by = p_updated_by,
    updated_at = now()
  from jsonb_to_recordset(p_values) as source(line_id uuid, counted_qty integer)
  where target.id = source.line_id
    and target.session_id = p_session_id
    and (source.counted_qty is null or source.counted_qty >= 0);

  get diagnostics v_updated = row_count;
  update public.weekly_stock_count_sessions
  set counted_lines = (
    select count(*)
    from public.weekly_stock_count_lines
    where session_id = p_session_id and counted_qty is not null
  )
  where id = p_session_id;
  return v_updated;
end;
$$;

create or replace function public.complete_weekly_stock_count_session(
  p_session_id uuid,
  p_completed_by uuid
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.weekly_stock_count_lines
    where session_id = p_session_id and counted_qty is null
  ) then
    raise exception 'Every item must be counted before completion';
  end if;

  update public.weekly_stock_count_sessions
  set
    status = 'completed',
    completed_by = p_completed_by,
    completed_at = now(),
    updated_at = now()
  where id = p_session_id;

  if not found then
    raise exception 'Stock count session not found';
  end if;
end;
$$;

alter table public.weekly_stock_count_sessions enable row level security;
alter table public.weekly_stock_count_lines enable row level security;

revoke all on table public.weekly_stock_count_sessions from public, anon, authenticated;
revoke all on table public.weekly_stock_count_lines from public, anon, authenticated;
grant select, insert, update, delete on table public.weekly_stock_count_sessions to service_role;
grant select, insert, update, delete on table public.weekly_stock_count_lines to service_role;

revoke all on function public.set_weekly_stock_count_updated_at() from public, anon, authenticated;
revoke all on function public.create_weekly_stock_count_session(date, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_weekly_stock_count_values(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.complete_weekly_stock_count_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_weekly_stock_count_updated_at() to service_role;
grant execute on function public.create_weekly_stock_count_session(date, text, uuid, jsonb) to service_role;
grant execute on function public.save_weekly_stock_count_values(uuid, uuid, jsonb) to service_role;
grant execute on function public.complete_weekly_stock_count_session(uuid, uuid) to service_role;

comment on table public.weekly_stock_count_sessions is
  'Weekly warehouse and retail count sessions. No system inventory baseline is stored.';
comment on table public.weekly_stock_count_lines is
  'Catalog snapshots and manually counted quantities only. Null means not counted; zero means counted as none.';

commit;
