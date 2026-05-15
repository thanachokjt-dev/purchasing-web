-- Daily SKU sales summary.
-- Raw sales_lines stays the source of truth; this table is a rebuildable cache
-- for demand/reporting reads that should not scan every Shopify line item.

create table if not exists sales_by_sku_day (
  sales_date date not null,
  sku text not null,
  qty_sold numeric(14, 4) not null default 0,
  gross_sales numeric(14, 4) not null default 0,
  net_sales numeric(14, 4) not null default 0,
  order_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (sales_date, sku)
);

create index if not exists idx_sales_by_sku_day_sku
  on sales_by_sku_day (sku);

create index if not exists idx_sales_by_sku_day_date
  on sales_by_sku_day (sales_date);

create index if not exists idx_sales_by_sku_day_sku_date
  on sales_by_sku_day (sku, sales_date desc);

create or replace function refresh_sales_by_sku_day_for_dates(target_dates date[])
returns integer
language plpgsql
as $$
declare
  clean_dates date[];
  inserted_rows integer := 0;
begin
  select coalesce(array_agg(distinct target_date), array[]::date[])
    into clean_dates
  from unnest(target_dates) as input(target_date)
  where target_date is not null;

  if cardinality(clean_dates) = 0 then
    return 0;
  end if;

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
  return inserted_rows;
end;
$$;

create or replace function refresh_sales_by_sku_day_between(start_date date, end_date date)
returns integer
language plpgsql
as $$
declare
  target_dates date[];
begin
  if start_date is null or end_date is null then
    return 0;
  end if;

  select coalesce(array_agg(day::date), array[]::date[])
    into target_dates
  from generate_series(
    least(start_date, end_date),
    greatest(start_date, end_date),
    interval '1 day'
  ) as days(day);

  return refresh_sales_by_sku_day_for_dates(target_dates);
end;
$$;
