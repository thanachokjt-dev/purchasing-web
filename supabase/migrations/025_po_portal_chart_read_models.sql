-- PO Portal chart read models.
-- These views are data sources for future timeline charts only; no UI depends on
-- them yet. Keep payment timing separate from physical incoming-stock timing.

create or replace function po_portal_status_key(status_value text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(status_value, ''), '[[:space:]-]+', '_', 'g'));
$$;

create or replace function is_po_order_active_for_portal(
  work_status text,
  closed_at timestamptz,
  cancelled_at timestamptz
)
returns boolean
language sql
stable
as $$
  select
    closed_at is null
    and cancelled_at is null
    and po_portal_status_key(work_status) not in ('closed', 'cancelled', 'canceled');
$$;

create or replace function is_po_line_physically_expected_for_portal(line_status text)
returns boolean
language sql
immutable
as $$
  -- final_payment is a payment follow-up state, not a physical incoming state.
  select po_portal_status_key(line_status) in ('inpro', 'delivery');
$$;

create or replace function po_portal_date_spine(start_date date, end_date date)
returns table(calendar_date date)
language sql
stable
as $$
  select generate_series(start_date, end_date, interval '1 day')::date as calendar_date
  where start_date is not null
    and end_date is not null
    and start_date <= end_date;
$$;

create or replace view po_payment_timeline_events as
with active_orders as (
  select
    order_header.po_id,
    order_header.rqq_id,
    order_header.po_title,
    order_header.quotation_reference,
    order_header.supplier_invoice_no,
    order_header.supplier_code,
    order_header.supplier_name_snapshot,
    order_header.supplier_discussion_note,
    order_header.updated_at
  from po_orders order_header
  where is_po_order_active_for_portal(
    order_header.work_status,
    order_header.closed_at,
    order_header.cancelled_at
  )
),
normalized_payments as (
  select
    case
      when po_portal_status_key(payment.payment_status) = 'planned' then payment.due_date
      else payment.payment_date
    end as event_date,
    active_orders.po_id,
    active_orders.po_id as po_number,
    coalesce(
      nullif(active_orders.quotation_reference, ''),
      nullif(active_orders.supplier_invoice_no, ''),
      nullif(active_orders.rqq_id, ''),
      nullif(active_orders.po_title, ''),
      active_orders.po_id
    ) as po_reference,
    active_orders.supplier_code,
    coalesce(
      nullif(active_orders.supplier_name_snapshot, ''),
      nullif(active_orders.supplier_code, ''),
      'Unknown supplier'
    ) as supplier_name,
    payment.id as payment_id,
    coalesce(
      nullif(payment.reference, ''),
      nullif(payment.payment_type, ''),
      payment.id::text
    ) as payment_label,
    payment.payment_type,
    coalesce(nullif(payment.payment_status, ''), 'paid') as payment_status,
    case
      when po_portal_status_key(payment.payment_status) = 'planned' then 'planned'
      else 'paid'
    end as series,
    payment.amount as amount_original,
    payment.currency,
    coalesce(nullif(payment.exchange_rate, 0), 1) as exchange_rate,
    case
      when coalesce(payment.amount_thb, 0) > 0 then payment.amount_thb
      else coalesce(payment.amount, 0) * coalesce(nullif(payment.exchange_rate, 0), 1)
    end as amount_thb,
    nullif(btrim(active_orders.supplier_discussion_note), '') as latest_supplier_comment,
    '/po/' || active_orders.po_id as po_detail_href,
    greatest(active_orders.updated_at, payment.created_at) as updated_at
  from po_payments payment
  join active_orders on active_orders.po_id = payment.po_id
  where po_portal_status_key(payment.payment_status) in ('paid', 'planned')
)
select
  event_date,
  po_id,
  po_number,
  po_reference,
  supplier_code,
  supplier_name,
  payment_id,
  payment_label,
  payment_type,
  payment_status,
  series,
  amount_original,
  currency,
  exchange_rate,
  amount_thb,
  latest_supplier_comment,
  po_detail_href,
  updated_at
from normalized_payments
where event_date is not null
  and amount_thb > 0;

create or replace view po_payment_timeline_daily as
select
  event_date,
  series,
  supplier_code,
  supplier_name,
  sum(amount_thb) as total_amount_thb,
  count(payment_id)::integer as payment_count,
  count(distinct po_id)::integer as po_count,
  array_agg(distinct po_id order by po_id) as po_ids,
  jsonb_agg(
    jsonb_build_object(
      'po_id', po_id,
      'po_number', po_number,
      'po_reference', po_reference,
      'payment_id', payment_id,
      'payment_label', payment_label,
      'payment_type', payment_type,
      'payment_status', payment_status,
      'amount_thb', amount_thb,
      'po_detail_href', po_detail_href
    )
    order by po_number, payment_label
  ) as detail_payload,
  max(updated_at) as updated_at
from po_payment_timeline_events
group by event_date, series, supplier_code, supplier_name;

create or replace view po_incoming_eta_events as
with active_lines as (
  select
    coalesce(item.expected_at, order_header.estimated_arrived_date, order_header.expected_at) as eta_date,
    order_header.po_id,
    order_header.po_id as po_number,
    coalesce(
      nullif(order_header.quotation_reference, ''),
      nullif(order_header.supplier_invoice_no, ''),
      nullif(order_header.rqq_id, ''),
      nullif(order_header.po_title, ''),
      order_header.po_id
    ) as po_reference,
    order_header.supplier_code,
    coalesce(
      nullif(order_header.supplier_name_snapshot, ''),
      nullif(order_header.supplier_code, ''),
      'Unknown supplier'
    ) as supplier_name,
    item.id as po_item_id,
    item.sku,
    coalesce(
      nullif(item.full_name, ''),
      nullif(item.product_title_snapshot, ''),
      nullif(item.variant_title_snapshot, ''),
      item.sku
    ) as product_name,
    item.ordered_qty,
    total.total_received_qty as received_qty,
    total.outstanding_qty as incoming_qty,
    item.line_status,
    order_header.work_status as po_status,
    nullif(btrim(order_header.supplier_discussion_note), '') as latest_supplier_comment,
    '/po/' || order_header.po_id as po_detail_href,
    greatest(order_header.updated_at, item.updated_at) as updated_at
  from po_items item
  join po_orders order_header on order_header.po_id = item.po_id
  join po_item_receipt_totals total on total.po_item_uuid = item.id
  where is_po_order_active_for_portal(
      order_header.work_status,
      order_header.closed_at,
      order_header.cancelled_at
    )
    and is_po_line_physically_expected_for_portal(item.line_status)
)
select
  eta_date,
  po_id,
  po_number,
  po_reference,
  supplier_code,
  supplier_name,
  po_item_id,
  sku,
  product_name,
  ordered_qty,
  received_qty,
  incoming_qty,
  line_status,
  po_status,
  latest_supplier_comment,
  po_detail_href,
  updated_at
from active_lines
where eta_date is not null
  and incoming_qty > 0;

create or replace view po_incoming_eta_daily as
select
  eta_date,
  supplier_code,
  supplier_name,
  sum(incoming_qty) as total_incoming_qty,
  count(po_item_id)::integer as item_count,
  count(distinct po_id)::integer as po_count,
  array_agg(distinct po_id order by po_id) as po_ids,
  jsonb_agg(
    jsonb_build_object(
      'po_id', po_id,
      'po_number', po_number,
      'po_reference', po_reference,
      'po_item_id', po_item_id,
      'sku', sku,
      'product_name', product_name,
      'incoming_qty', incoming_qty,
      'line_status', line_status,
      'po_status', po_status,
      'po_detail_href', po_detail_href
    )
    order by po_number, sku
  ) as detail_payload,
  max(updated_at) as updated_at
from po_incoming_eta_events
group by eta_date, supplier_code, supplier_name;

comment on view po_payment_timeline_events is
  'Event-level active-PO payment timeline source. Paid rows use payment_date; planned rows use due_date.';
comment on view po_payment_timeline_daily is
  'Daily payment timeline aggregate by date, series, and supplier. Sum across suppliers for total chart mode.';
comment on view po_incoming_eta_events is
  'Event-level active-PO incoming ETA source. Uses outstanding physical incoming qty only; final_payment does not create incoming stock.';
comment on view po_incoming_eta_daily is
  'Daily incoming ETA aggregate by date and supplier. Sum across suppliers for total chart mode.';
comment on function po_portal_date_spine(date, date) is
  'Generate chart date ranges so the UI can fill missing aggregate dates with zero values without storing zero rows.';

create index if not exists idx_po_orders_work_status
  on po_orders (work_status);

create index if not exists idx_po_orders_estimated_arrived_date
  on po_orders (estimated_arrived_date);

create index if not exists idx_po_orders_expected_at
  on po_orders (expected_at);

create index if not exists idx_po_orders_supplier_code
  on po_orders (supplier_code);

create index if not exists idx_po_orders_updated_at
  on po_orders (updated_at);

create index if not exists idx_po_items_sku
  on po_items (sku);

create index if not exists idx_po_items_line_status
  on po_items (line_status);

create index if not exists idx_po_items_expected_at
  on po_items (expected_at);

create index if not exists idx_po_payments_payment_status
  on po_payments (payment_status);

create index if not exists idx_po_payments_payment_date
  on po_payments (payment_date);

create index if not exists idx_po_payments_due_date
  on po_payments (due_date);
