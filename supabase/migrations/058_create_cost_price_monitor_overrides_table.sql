-- Forward repair for Cost Price Monitor manual overrides.
-- Creates the required table name and copies readable group-level legacy rows
-- from cost_price_overrides without deleting or modifying the legacy table.

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

do $$
declare
  category_expr text := 'null::text';
  color_expr text := 'null::text';
  created_at_expr text := 'now()';
  main_name_expr text := 'null::text';
  product_group_expr text := 'null::text';
  supplier_expr text := 'null::text';
  updated_at_expr text := 'now()';
  updated_by_expr text := 'null::text';
begin
  if to_regclass('public.cost_price_overrides') is null then
    return;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'category') then
    category_expr := 'category';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'color') then
    color_expr := 'color';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'created_at') then
    created_at_expr := 'coalesce(created_at, now())';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'main_name') then
    main_name_expr := 'main_name';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'product_group') then
    product_group_expr := 'product_group';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'supplier') then
    supplier_expr := 'supplier';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'updated_at') then
    updated_at_expr := 'coalesce(updated_at, now())';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cost_price_overrides' and column_name = 'updated_by') then
    updated_by_expr := 'updated_by::text';
  end if;

  execute format(
    $copy$
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
        manual_purchase_price,
        manual_landed_cost,
        manual_selling_price,
        note,
        %6$s,
        %7$s,
        %8$s
      from public.cost_price_overrides
      where group_key is not null and btrim(group_key) <> ''
      order by btrim(group_key), %8$s desc nulls last
      on conflict (group_key) do update set
        main_name = excluded.main_name,
        color = excluded.color,
        supplier = excluded.supplier,
        category = excluded.category,
        product_group = excluded.product_group,
        manual_purchase_price = excluded.manual_purchase_price,
        manual_landed_cost = excluded.manual_landed_cost,
        manual_selling_price = excluded.manual_selling_price,
        note = excluded.note,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
      where public.cost_price_monitor_overrides.updated_at is null
         or excluded.updated_at >= public.cost_price_monitor_overrides.updated_at
    $copy$,
    main_name_expr,
    color_expr,
    supplier_expr,
    category_expr,
    product_group_expr,
    updated_by_expr,
    created_at_expr,
    updated_at_expr
  );
end $$;

grant select, insert, update, delete on table public.cost_price_monitor_overrides to service_role;
revoke all on table public.cost_price_monitor_overrides from anon;
