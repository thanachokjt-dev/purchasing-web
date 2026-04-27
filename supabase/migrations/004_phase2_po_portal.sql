-- Phase 2 PO Portal tables.
-- These tables move incoming-stock calculations from AppSheet/Excel preview data
-- into a real purchase order workflow: open PO -> approve/process -> receive stock.

create extension if not exists "uuid-ossp";

create table if not exists po_suppliers (
  supplier_code text primary key,
  supplier_name text not null,
  currency text,
  payment_terms text,
  moq text,
  safety_days integer not null default 0,
  lead_time_days integer not null default 0,
  product_scope text,
  is_active boolean not null default true,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists po_orders (
  id uuid primary key default uuid_generate_v4(),
  po_id text not null unique,
  rqq_id text,
  po_title text,
  po_date date,
  expected_at date,
  work_status text not null default 'draft',
  requester text,
  owner text,
  supplier_code text references po_suppliers(supplier_code),
  supplier_name_snapshot text,
  currency text,
  po_amount_foreign numeric(14, 4) not null default 0,
  po_amount_thb numeric(14, 4) not null default 0,
  payment_terms_snapshot text,
  approved_at timestamptz,
  submitted_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  source text not null default 'manual',
  source_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists po_items (
  id uuid primary key default uuid_generate_v4(),
  po_item_id text unique,
  po_id text not null references po_orders(po_id) on delete cascade,
  line_no text,
  sku text not null,
  product_title_snapshot text,
  variant_title_snapshot text,
  ordered_qty numeric(14, 4) not null default 0,
  legacy_received_qty numeric(14, 4) not null default 0,
  backorder_qty numeric(14, 4) not null default 0,
  cancelled_qty numeric(14, 4) not null default 0,
  unit_price numeric(14, 4) not null default 0,
  line_amount numeric(14, 4) not null default 0,
  currency text,
  remark text,
  full_name text,
  line_status text not null default 'draft',
  expected_at date,
  source text not null default 'manual',
  source_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint po_items_qty_non_negative check (
    ordered_qty >= 0
    and legacy_received_qty >= 0
    and backorder_qty >= 0
    and cancelled_qty >= 0
  )
);

create table if not exists po_receipts (
  id uuid primary key default uuid_generate_v4(),
  po_item_id uuid not null references po_items(id) on delete cascade,
  received_at timestamptz not null default now(),
  received_qty numeric(14, 4) not null,
  received_by text,
  note text,
  source text not null default 'manual',
  source_payload jsonb,
  created_at timestamptz not null default now(),
  constraint po_receipts_qty_positive check (received_qty > 0)
);

create table if not exists po_status_events (
  id uuid primary key default uuid_generate_v4(),
  po_id text not null references po_orders(po_id) on delete cascade,
  po_item_id uuid references po_items(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_po_suppliers_name on po_suppliers (supplier_name);
create index if not exists idx_po_orders_status_date on po_orders (work_status, po_date desc);
create index if not exists idx_po_orders_supplier on po_orders (supplier_code, po_date desc);
create index if not exists idx_po_items_sku_status on po_items (sku, line_status);
create index if not exists idx_po_items_po_id on po_items (po_id);
create index if not exists idx_po_receipts_item_date on po_receipts (po_item_id, received_at desc);
create index if not exists idx_po_status_events_po_date on po_status_events (po_id, created_at desc);

create or replace view po_item_receipt_totals as
select
  item.id as po_item_uuid,
  item.po_item_id,
  item.po_id,
  item.sku,
  item.ordered_qty,
  item.legacy_received_qty,
  coalesce(sum(receipt.received_qty), 0) as workflow_received_qty,
  item.legacy_received_qty + coalesce(sum(receipt.received_qty), 0) as total_received_qty,
  greatest(
    item.ordered_qty - item.cancelled_qty - item.legacy_received_qty - coalesce(sum(receipt.received_qty), 0),
    0
  ) as outstanding_qty,
  item.backorder_qty,
  item.cancelled_qty,
  item.line_status
from po_items item
left join po_receipts receipt on receipt.po_item_id = item.id
group by item.id;

create or replace view po_incoming_by_sku as
select
  item.sku,
  coalesce(sum(total.outstanding_qty) filter (
    where lower(coalesce(item.line_status, '')) in ('inpro', 'delivery', 'final_payment')
      and order_header.cancelled_at is null
      and order_header.closed_at is null
  ), 0) as active_incoming_qty,
  coalesce(sum(total.outstanding_qty) filter (
    where lower(coalesce(item.line_status, '')) = 'waiting_for_approve'
      and order_header.cancelled_at is null
      and order_header.closed_at is null
  ), 0) as pending_approval_qty,
  max(order_header.expected_at) as latest_expected_at
from po_items item
join po_orders order_header on order_header.po_id = item.po_id
join po_item_receipt_totals total on total.po_item_uuid = item.id
group by item.sku;
