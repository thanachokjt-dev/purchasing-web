-- Phase 3 Purchasing Decision controls.
-- This keeps planning metadata that Shopify is not a good home for.
-- Shopify remains the source of truth for SKU, stock, and sales; this table is
-- the purchasing override layer used by dashboard, reorder decisions, and PO suggestions.

create table if not exists purchasing_decision_controls (
  sku text primary key,
  product_name_override text,
  main_name_override text,
  supplier_override text,
  tags_override text[] not null default '{}',
  safety_days integer,
  lead_time_days integer,
  order_cycle_days integer,
  manual_rop_units numeric(14, 4),
  target_coverage_days integer,
  hide_from_purchasing boolean not null default false,
  hide_reason text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_purchasing_decision_controls_supplier
  on purchasing_decision_controls (supplier_override);

create index if not exists idx_purchasing_decision_controls_hidden
  on purchasing_decision_controls (hide_from_purchasing);

create or replace view purchasing_sales_by_sku as
select
  sku,
  sum(quantity) as total_sale,
  sum(quantity) filter (where order_date >= current_date - interval '7 days') as sold_7,
  sum(quantity) filter (where order_date >= current_date - interval '30 days') as sold_30,
  sum(quantity) filter (where order_date >= current_date - interval '90 days') as sold_90
from sales_lines
where sku is not null
  and btrim(sku) <> ''
  and cancelled_at_shopify is null
  and coalesce(financial_status, '') not in ('REFUNDED', 'VOIDED')
group by sku;
