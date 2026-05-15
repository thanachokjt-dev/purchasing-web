-- Current demand snapshot built from sales_by_sku_day, not raw sales_lines.
-- The formula mirrors the existing HM Demand logic in purchasing-decision-data.ts:
-- default weights 35% lifetime average, 65% selling-day average, 75% 30d floor,
-- capped at selling-day average for active sellers.

create table if not exists demand_index_current (
  sku text primary key,
  total_sale numeric(14, 4) not null default 0,
  sold_7 numeric(14, 4) not null default 0,
  sold_30 numeric(14, 4) not null default 0,
  sold_60 numeric(14, 4) not null default 0,
  sold_90 numeric(14, 4) not null default 0,
  avg_daily_7 numeric(14, 6) not null default 0,
  avg_daily_30 numeric(14, 6) not null default 0,
  avg_daily_60 numeric(14, 6) not null default 0,
  avg_daily_90 numeric(14, 6) not null default 0,
  first_sale_date date,
  last_sale_date date,
  selling_days integer not null default 0,
  lifetime_daily_average numeric(14, 6) not null default 0,
  selling_day_average numeric(14, 6) not null default 0,
  slow_mover_reliability numeric(14, 6) not null default 0,
  effective_lifetime_weight numeric(14, 6) not null default 100,
  effective_selling_day_weight numeric(14, 6) not null default 0,
  recent_floor_daily numeric(14, 6) not null default 0,
  demand_index_hm numeric(14, 6) not null default 0,
  formula_lifetime_weight numeric(6, 2) not null default 35,
  formula_selling_day_weight numeric(6, 2) not null default 65,
  formula_recent_floor_percent numeric(6, 2) not null default 75,
  formula_cap_at_selling_day_average boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists idx_demand_index_current_sku
  on demand_index_current (sku);

create index if not exists idx_demand_index_current_updated_at
  on demand_index_current (updated_at);

create or replace function refresh_demand_index_current_for_skus(target_skus text[])
returns integer
language plpgsql
as $$
declare
  clean_skus text[];
  inserted_rows integer := 0;
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

  delete from demand_index_current
  where sku = any(clean_skus);

  insert into demand_index_current (
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
    updated_at
  )
  with target as (
    select unnest(clean_skus) as sku
  ),
  stats as (
    select
      sales_by_sku_day.sku,
      coalesce(sum(sales_by_sku_day.qty_sold), 0) as total_sale,
      coalesce(sum(sales_by_sku_day.qty_sold) filter (
        where sales_by_sku_day.sales_date >= current_date - interval '7 days'
      ), 0) as sold_7,
      coalesce(sum(sales_by_sku_day.qty_sold) filter (
        where sales_by_sku_day.sales_date >= current_date - interval '30 days'
      ), 0) as sold_30,
      coalesce(sum(sales_by_sku_day.qty_sold) filter (
        where sales_by_sku_day.sales_date >= current_date - interval '60 days'
      ), 0) as sold_60,
      coalesce(sum(sales_by_sku_day.qty_sold) filter (
        where sales_by_sku_day.sales_date >= current_date - interval '90 days'
      ), 0) as sold_90,
      min(sales_by_sku_day.sales_date) as first_sale_date,
      max(sales_by_sku_day.sales_date) as last_sale_date,
      count(*)::integer as selling_days
    from sales_by_sku_day
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
        when stats.first_sale_date is not null and stats.last_sale_date is not null
          then greatest(1, (stats.last_sale_date - stats.first_sale_date) + 1)
        else 0
      end as span_days
    from target
    left join stats on stats.sku = target.sku
  ),
  averages as (
    select
      base.*,
      base.sold_7 / 7 as avg_daily_7,
      base.sold_30 / 30 as avg_daily_30,
      base.sold_60 / 60 as avg_daily_60,
      base.sold_90 / 90 as avg_daily_90,
      case
        when base.span_days > 0 then base.total_sale / base.span_days
        else 0
      end as lifetime_daily_average,
      case
        when base.selling_days > 0 then base.total_sale / base.selling_days
        else 0
      end as selling_day_average,
      case
        when base.span_days > 0 then base.selling_days::numeric / base.span_days
        else 0
      end as sale_density
    from base
  ),
  reliability as (
    select
      averages.*,
      least(
        1,
        averages.sale_density * 1.2,
        case when averages.selling_days > 0 then averages.selling_days::numeric / 180 else 0 end,
        case when averages.total_sale > 0 then averages.total_sale / 320 else 0 end
      ) as slow_mover_reliability
    from averages
  ),
  weighted as (
    select
      reliability.*,
      65 * reliability.slow_mover_reliability as effective_selling_day_weight,
      case
        when reliability.slow_mover_reliability < 1
          then 100 - (65 * reliability.slow_mover_reliability)
        else 35
      end as effective_lifetime_weight,
      (reliability.sold_30 / 30) * 0.75 as recent_floor_daily
    from reliability
  ),
  demand as (
    select
      weighted.*,
      case
        when (weighted.effective_lifetime_weight + weighted.effective_selling_day_weight) > 0 then
          (
            weighted.lifetime_daily_average * weighted.effective_lifetime_weight +
            weighted.selling_day_average * weighted.effective_selling_day_weight
          ) / (weighted.effective_lifetime_weight + weighted.effective_selling_day_weight)
        else greatest(weighted.lifetime_daily_average, weighted.selling_day_average)
      end as weighted_base
    from weighted
  ),
  final as (
    select
      demand.*,
      greatest(demand.weighted_base, demand.recent_floor_daily) as uncapped_demand
    from demand
  )
  select
    final.sku,
    final.total_sale,
    final.sold_7,
    final.sold_30,
    final.sold_60,
    final.sold_90,
    final.avg_daily_7,
    final.avg_daily_30,
    final.avg_daily_60,
    final.avg_daily_90,
    final.first_sale_date,
    final.last_sale_date,
    final.selling_days,
    final.lifetime_daily_average,
    final.selling_day_average,
    final.slow_mover_reliability,
    final.effective_lifetime_weight,
    final.effective_selling_day_weight,
    final.recent_floor_daily,
    case
      when final.selling_day_average > 0 then least(final.uncapped_demand, final.selling_day_average)
      else final.uncapped_demand
    end as demand_index_hm,
    now() as updated_at
  from final;

  get diagnostics inserted_rows = row_count;
  return inserted_rows;
end;
$$;

create or replace function refresh_demand_index_current()
returns integer
language plpgsql
as $$
declare
  target_skus text[];
begin
  select coalesce(array_agg(distinct sku), array[]::text[])
    into target_skus
  from (
    select btrim(sku) as sku
    from product_variants
    where sku is not null and btrim(sku) <> ''
    union
    select btrim(sku) as sku
    from sales_by_sku_day
    where sku is not null and btrim(sku) <> ''
  ) all_skus;

  delete from demand_index_current
  where not (sku = any(target_skus));

  return refresh_demand_index_current_for_skus(target_skus);
end;
$$;

create or replace function refresh_sales_by_sku_day_for_dates(target_dates date[])
returns integer
language plpgsql
as $$
declare
  clean_dates date[];
  affected_skus text[];
  inserted_rows integer := 0;
begin
  select coalesce(array_agg(distinct target_date), array[]::date[])
    into clean_dates
  from unnest(target_dates) as input(target_date)
  where target_date is not null;

  if cardinality(clean_dates) = 0 then
    return 0;
  end if;

  select coalesce(array_agg(distinct sku), array[]::text[])
    into affected_skus
  from (
    select btrim(sku) as sku
    from sales_by_sku_day
    where sales_date = any(clean_dates)
      and sku is not null
      and btrim(sku) <> ''
    union
    select btrim(sku) as sku
    from sales_lines
    where order_date = any(clean_dates)
      and sku is not null
      and btrim(sku) <> ''
  ) affected;

  -- Delete and rebuild whole affected dates so cancellations, refunds, edits,
  -- and lines that move to zero quantity cannot leave stale summary rows behind.
  delete from sales_by_sku_day
  where sales_date = any(clean_dates);

  insert into sales_by_sku_day (
    sales_date,
    sku,
    qty_sold,
    gross_sales,
    net_sales,
    order_count,
    updated_at
  )
  select
    sales_lines.order_date as sales_date,
    btrim(sales_lines.sku) as sku,
    coalesce(sum(sales_lines.quantity), 0) as qty_sold,
    coalesce(sum(coalesce(sales_lines.unit_price, 0) * sales_lines.quantity), 0) as gross_sales,
    coalesce(sum(coalesce(
      sales_lines.line_total,
      coalesce(sales_lines.unit_price, 0) * sales_lines.quantity
    )), 0) as net_sales,
    count(distinct sales_lines.shopify_order_id)::integer as order_count,
    now() as updated_at
  from sales_lines
  where sales_lines.order_date = any(clean_dates)
    and sales_lines.sku is not null
    and btrim(sales_lines.sku) <> ''
    and sales_lines.cancelled_at_shopify is null
    and coalesce(sales_lines.financial_status, '') not in ('REFUNDED', 'VOIDED')
  group by sales_lines.order_date, btrim(sales_lines.sku)
  having coalesce(sum(sales_lines.quantity), 0) <> 0
      or coalesce(sum(coalesce(sales_lines.line_total, 0)), 0) <> 0;

  get diagnostics inserted_rows = row_count;
  perform refresh_demand_index_current_for_skus(affected_skus);
  return inserted_rows;
end;
$$;
