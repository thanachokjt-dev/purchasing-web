-- Final canonical Cost Price Monitor override table repair.
-- Keeps public.cost_price_overrides as a legacy source, but makes
-- public.cost_price_monitor_overrides the canonical table used by the app.

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
  updated_at timestamptz default now()
);

alter table public.cost_price_monitor_overrides
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists group_key text,
  add column if not exists main_name text,
  add column if not exists color text,
  add column if not exists supplier text,
  add column if not exists category text,
  add column if not exists product_group text,
  add column if not exists manual_purchase_price numeric,
  add column if not exists manual_landed_cost numeric,
  add column if not exists manual_selling_price numeric,
  add column if not exists note text,
  add column if not exists updated_by text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.cost_price_monitor_overrides
  alter column id set default gen_random_uuid(),
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.cost_price_monitor_overrides
set id = gen_random_uuid()
where id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cost_price_monitor_overrides'::regclass
      and contype = 'p'
  ) then
    alter table public.cost_price_monitor_overrides
      add constraint cost_price_monitor_overrides_pkey primary key (id);
  end if;
end $$;

update public.cost_price_monitor_overrides
set group_key = btrim(group_key)
where group_key is not null
  and group_key <> btrim(group_key);

delete from public.cost_price_monitor_overrides
where group_key is null
   or btrim(group_key) = '';

with ranked as (
  select
    id,
    row_number() over (
      partition by group_key
      order by updated_at desc nulls last, created_at desc nulls last, id
    ) as row_number
  from public.cost_price_monitor_overrides
)
delete from public.cost_price_monitor_overrides target
using ranked
where target.id = ranked.id
  and ranked.row_number > 1;

alter table public.cost_price_monitor_overrides
  alter column group_key set not null;

-- Use a new index name because older migrations may have created
-- cost_price_monitor_overrides_group_key_uidx on the legacy table.
create unique index if not exists cost_price_monitor_overrides_group_key_unique
  on public.cost_price_monitor_overrides (group_key);

do $$
declare
  main_name_expr text := 'null::text';
  color_expr text := 'null::text';
  supplier_expr text := 'null::text';
  category_expr text := 'null::text';
  product_group_expr text := 'null::text';
  manual_purchase_expr text := 'null::numeric';
  manual_landed_expr text := 'null::numeric';
  manual_selling_expr text := 'null::numeric';
  note_expr text := 'null::text';
  updated_by_expr text := 'null::text';
  created_at_expr text := 'now()';
  updated_at_expr text := 'now()';
begin
  if to_regclass('public.cost_price_overrides') is null then
    return;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'group_key') then
    return;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'main_name') then
    main_name_expr := 'main_name';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'color') then
    color_expr := 'color';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'supplier') then
    supplier_expr := 'supplier';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'category') then
    category_expr := 'category';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'product_group') then
    product_group_expr := 'product_group';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'manual_purchase_price') then
    manual_purchase_expr := 'manual_purchase_price';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'manual_landed_cost') then
    manual_landed_expr := 'manual_landed_cost';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'manual_selling_price') then
    manual_selling_expr := 'manual_selling_price';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'note') then
    note_expr := 'note';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'updated_by') then
    updated_by_expr := 'updated_by';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'created_at') then
    created_at_expr := 'created_at';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'updated_at') then
    updated_at_expr := 'updated_at';
  end if;

  execute format($copy$
    insert into public.cost_price_monitor_overrides (
      group_key,
      main_name,
      color,
      supplier,
      category,
      product_group,
      manual_purchase_price,
      manual_landed_cost,
      manual_selling_price,
      note,
      updated_by,
      created_at,
      updated_at
    )
    select distinct on (btrim(group_key))
      btrim(group_key),
      %1$s,
      %2$s,
      %3$s,
      %4$s,
      %5$s,
      %6$s,
      %7$s,
      %8$s,
      %9$s,
      %10$s,
      %11$s,
      %12$s
    from public.cost_price_overrides
    where group_key is not null
      and btrim(group_key) <> ''
    order by btrim(group_key), %12$s desc nulls last
    on conflict (group_key) do update set
      main_name = coalesce(excluded.main_name, public.cost_price_monitor_overrides.main_name),
      color = coalesce(excluded.color, public.cost_price_monitor_overrides.color),
      supplier = coalesce(excluded.supplier, public.cost_price_monitor_overrides.supplier),
      category = coalesce(excluded.category, public.cost_price_monitor_overrides.category),
      product_group = coalesce(excluded.product_group, public.cost_price_monitor_overrides.product_group),
      manual_purchase_price = coalesce(excluded.manual_purchase_price, public.cost_price_monitor_overrides.manual_purchase_price),
      manual_landed_cost = coalesce(excluded.manual_landed_cost, public.cost_price_monitor_overrides.manual_landed_cost),
      manual_selling_price = coalesce(excluded.manual_selling_price, public.cost_price_monitor_overrides.manual_selling_price),
      note = coalesce(excluded.note, public.cost_price_monitor_overrides.note),
      updated_by = coalesce(excluded.updated_by, public.cost_price_monitor_overrides.updated_by),
      created_at = least(
        coalesce(public.cost_price_monitor_overrides.created_at, excluded.created_at),
        coalesce(excluded.created_at, public.cost_price_monitor_overrides.created_at)
      ),
      updated_at = excluded.updated_at
    where public.cost_price_monitor_overrides.updated_at is null
       or excluded.updated_at >= public.cost_price_monitor_overrides.updated_at
  $copy$,
    main_name_expr,
    color_expr,
    supplier_expr,
    category_expr,
    product_group_expr,
    manual_purchase_expr,
    manual_landed_expr,
    manual_selling_expr,
    note_expr,
    updated_by_expr,
    created_at_expr,
    updated_at_expr
  );
end $$;

create index if not exists cost_price_monitor_overrides_updated_at_idx
  on public.cost_price_monitor_overrides (updated_at desc);

grant select, insert, update, delete on table public.cost_price_monitor_overrides to service_role;
revoke all on table public.cost_price_monitor_overrides from anon;
