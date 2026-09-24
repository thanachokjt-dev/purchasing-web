-- Aggregate the existing daily sales read model before returning dashboard data.
-- The service role is the only API caller; the web route enforces app access.
create or replace function public.sku_dashboard_monthly_rollup(
  p_current_start date,
  p_current_end date,
  p_previous_start date,
  p_previous_end date,
  p_skus text[] default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with scoped as (
    select 'current'::text as period, sales_date, sku, qty_sold, net_sales
    from public.sales_by_sku_day
    where sales_date between p_current_start and p_current_end
      and (p_skus is null or sku = any(p_skus))
    union all
    select 'previous'::text as period, sales_date, sku, qty_sold, net_sales
    from public.sales_by_sku_day
    where sales_date between p_previous_start and p_previous_end
      and (p_skus is null or sku = any(p_skus))
  ), monthly as (
    select
      period,
      sku,
      date_trunc('month', sales_date)::date as month_start,
      sum(qty_sold) as units,
      sum(net_sales) as revenue
    from scoped
    group by period, sku, date_trunc('month', sales_date)::date
  )
  select coalesce(
    jsonb_agg(to_jsonb(monthly) order by period, sku, month_start),
    '[]'::jsonb
  )
  from monthly;
$$;

revoke all on function public.sku_dashboard_monthly_rollup(date, date, date, date, text[])
  from public, anon, authenticated;
grant execute on function public.sku_dashboard_monthly_rollup(date, date, date, date, text[])
  to service_role;
