-- Demand must include calendar days with zero sales.
--
-- Historical products start at their first recorded sale because inventory
-- history only begins on 2026-04-26. Products introduced after inventory
-- tracking began start at the earlier of first positive inventory or first
-- sale. Every rate ends at current_date, never at the last sale date.
--
-- The legacy selling_day_* and recent_floor_* columns remain populated for
-- compatibility with existing readers. They now carry the 30-day calendar
-- average and its 65% weight; selling-day-only demand no longer affects HM.

create or replace function public.refresh_demand_index_current_for_skus(target_skus text[])
returns integer
language plpgsql
as $$
declare
  clean_skus text[];
  affected_rows integer := 0;
begin
  select coalesce(array_agg(distinct sku), array[]::text[])
    into clean_skus
  from (
    select btrim(input_sku) as sku
    from unnest(target_skus) as input(input_sku)
    where input_sku is not null
  ) cleaned
  where sku <> '';

  if cardinality(clean_skus) = 0 then
    return 0;
  end if;

  insert into public.demand_index_current (
    sku,
    total_sale,
    sold_7,
    sold_30,
    sold_60,
    sold_90,
    avg_daily_7,
    avg_daily_30,
    avg_daily_60,
    avg_daily_90,
    first_sale_date,
    last_sale_date,
    selling_days,
    lifetime_daily_average,
    selling_day_average,
    slow_mover_reliability,
    effective_lifetime_weight,
    effective_selling_day_weight,
    recent_floor_daily,
    demand_index_hm,
    formula_lifetime_weight,
    formula_selling_day_weight,
    formula_recent_floor_percent,
    formula_cap_at_selling_day_average,
    updated_at
  )
  with target as (
    select unnest(clean_skus) as sku
  ),
  inventory_history as (
    select min(snapshot_date) as first_snapshot_date
    from public.inventory_snapshots
  ),
  first_stock as (
    select
      inventory_snapshots.sku,
      min(inventory_snapshots.snapshot_date) filter (
        where coalesce(inventory_snapshots.on_hand, 0) > 0
           or coalesce(inventory_snapshots.available, 0) > 0
      ) as first_stock_date
    from public.inventory_snapshots
    where inventory_snapshots.sku = any(clean_skus)
    group by inventory_snapshots.sku
  ),
  stats as (
    select
      sales_by_sku_day.sku,
      coalesce(sum(sales_by_sku_day.qty_sold), 0) as total_sale,
      coalesce(sum(sales_by_sku_day.qty_sold) filter (
        where sales_by_sku_day.sales_date >= current_date - 6
      ), 0) as sold_7,
      coalesce(sum(sales_by_sku_day.qty_sold) filter (
        where sales_by_sku_day.sales_date >= current_date - 29
      ), 0) as sold_30,
      coalesce(sum(sales_by_sku_day.qty_sold) filter (
        where sales_by_sku_day.sales_date >= current_date - 59
      ), 0) as sold_60,
      coalesce(sum(sales_by_sku_day.qty_sold) filter (
        where sales_by_sku_day.sales_date >= current_date - 89
      ), 0) as sold_90,
      min(sales_by_sku_day.sales_date) as first_sale_date,
      max(sales_by_sku_day.sales_date) as last_sale_date,
      count(*)::integer as selling_days
    from public.sales_by_sku_day
    where sales_by_sku_day.sku = any(clean_skus)
    group by sales_by_sku_day.sku
  ),
  base as (
    select
      target.sku,
      coalesce(stats.total_sale, 0) as total_sale,
      coalesce(stats.sold_7, 0) as sold_7,
      coalesce(stats.sold_30, 0) as sold_30,
      coalesce(stats.sold_60, 0) as sold_60,
      coalesce(stats.sold_90, 0) as sold_90,
      stats.first_sale_date,
      stats.last_sale_date,
      coalesce(stats.selling_days, 0) as selling_days,
      case
        when stats.first_sale_date is not null
          and inventory_history.first_snapshot_date is not null
          and stats.first_sale_date < inventory_history.first_snapshot_date
          then stats.first_sale_date
        when stats.first_sale_date is null
          then first_stock.first_stock_date
        when first_stock.first_stock_date is null
          then stats.first_sale_date
        else least(stats.first_sale_date, first_stock.first_stock_date)
      end as availability_start_date
    from target
    cross join inventory_history
    left join stats on stats.sku = target.sku
    left join first_stock on first_stock.sku = target.sku
  ),
  periods as (
    select
      base.*,
      case
        when base.availability_start_date is not null
          then greatest(1, (current_date - base.availability_start_date) + 1)
        else 0
      end as calendar_days
    from base
  ),
  averages as (
    select
      periods.*,
      case when periods.calendar_days > 0
        then periods.sold_7 / least(7, periods.calendar_days)
        else 0
      end as avg_daily_7,
      case when periods.calendar_days > 0
        then periods.sold_30 / least(30, periods.calendar_days)
        else 0
      end as avg_daily_30,
      case when periods.calendar_days > 0
        then periods.sold_60 / least(60, periods.calendar_days)
        else 0
      end as avg_daily_60,
      case when periods.calendar_days > 0
        then periods.sold_90 / least(90, periods.calendar_days)
        else 0
      end as avg_daily_90,
      case when periods.calendar_days > 0
        then periods.total_sale / periods.calendar_days
        else 0
      end as lifetime_daily_average
    from periods
  )
  select
    averages.sku,
    averages.total_sale,
    averages.sold_7,
    averages.sold_30,
    averages.sold_60,
    averages.sold_90,
    averages.avg_daily_7,
    averages.avg_daily_30,
    averages.avg_daily_60,
    averages.avg_daily_90,
    averages.first_sale_date,
    averages.last_sale_date,
    averages.selling_days,
    averages.lifetime_daily_average,
    averages.avg_daily_30 as selling_day_average,
    case when averages.calendar_days > 0
      then least(1, averages.selling_days::numeric / averages.calendar_days)
      else 0
    end as slow_mover_reliability,
    35 as effective_lifetime_weight,
    65 as effective_selling_day_weight,
    averages.avg_daily_30 as recent_floor_daily,
    (averages.lifetime_daily_average * 0.35)
      + (averages.avg_daily_30 * 0.65) as demand_index_hm,
    35 as formula_lifetime_weight,
    65 as formula_selling_day_weight,
    100 as formula_recent_floor_percent,
    false as formula_cap_at_selling_day_average,
    now() as updated_at
  from averages
  on conflict (sku) do update set
    total_sale = excluded.total_sale,
    sold_7 = excluded.sold_7,
    sold_30 = excluded.sold_30,
    sold_60 = excluded.sold_60,
    sold_90 = excluded.sold_90,
    avg_daily_7 = excluded.avg_daily_7,
    avg_daily_30 = excluded.avg_daily_30,
    avg_daily_60 = excluded.avg_daily_60,
    avg_daily_90 = excluded.avg_daily_90,
    first_sale_date = excluded.first_sale_date,
    last_sale_date = excluded.last_sale_date,
    selling_days = excluded.selling_days,
    lifetime_daily_average = excluded.lifetime_daily_average,
    selling_day_average = excluded.selling_day_average,
    slow_mover_reliability = excluded.slow_mover_reliability,
    effective_lifetime_weight = excluded.effective_lifetime_weight,
    effective_selling_day_weight = excluded.effective_selling_day_weight,
    recent_floor_daily = excluded.recent_floor_daily,
    demand_index_hm = excluded.demand_index_hm,
    formula_lifetime_weight = excluded.formula_lifetime_weight,
    formula_selling_day_weight = excluded.formula_selling_day_weight,
    formula_recent_floor_percent = excluded.formula_recent_floor_percent,
    formula_cap_at_selling_day_average = excluded.formula_cap_at_selling_day_average,
    updated_at = excluded.updated_at;

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

comment on function public.refresh_demand_index_current_for_skus(text[]) is
  'Refreshes SKU demand using every calendar day through today, including zero-sale days. Historical SKUs start at first sale; newer SKUs start at first positive inventory or first sale.';
