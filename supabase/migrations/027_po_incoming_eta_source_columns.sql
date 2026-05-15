-- Make Incoming ETA source selection explicit and debuggable.
-- Actual ETA columns:
-- - line-level ETA: po_items.expected_at
-- - PO header Estimated Arrived: po_orders.estimated_arrived_date

drop view if exists po_incoming_eta_supplier_reconciliation;
drop view if exists po_incoming_eta_reconciliation;
drop view if exists po_incoming_eta_daily;
drop view if exists po_incoming_eta_unscheduled_events;
drop view if exists po_incoming_eta_events;
drop view if exists po_incoming_pipeline_events;

create or replace view po_incoming_pipeline_events as
select
  coalesce(item.expected_at, order_header.estimated_arrived_date) as eta_date,
  case
    when item.expected_at is not null then 'line'
    when order_header.estimated_arrived_date is not null then 'po_header'
    else 'missing'
  end as eta_source,
  case
    when coalesce(item.expected_at, order_header.estimated_arrived_date) is null
      then 'unscheduled'
    else 'scheduled'
  end as eta_status,
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
where is_po_pipeline_incoming_for_portal(
  item.line_status,
  order_header.work_status,
  order_header.closed_at,
  order_header.cancelled_at,
  total.outstanding_qty
);

create or replace view po_incoming_eta_events as
select
  eta_date,
  eta_source,
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
from po_incoming_pipeline_events
where eta_date is not null;

create or replace view po_incoming_eta_unscheduled_events as
select
  eta_date,
  eta_source,
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
from po_incoming_pipeline_events
where eta_date is null;

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
      'eta_date', eta_date,
      'eta_source', eta_source,
      'po_id', po_id,
      'po_number', po_number,
      'po_reference', po_reference,
      'po_item_id', po_item_id,
      'sku', sku,
      'product_name', product_name,
      'incoming_qty', incoming_qty,
      'line_status', line_status,
      'po_status', po_status,
      'latest_supplier_comment', latest_supplier_comment,
      'po_detail_href', po_detail_href
    )
    order by po_number, sku
  ) as detail_payload,
  max(updated_at) as updated_at
from po_incoming_eta_events
group by eta_date, supplier_code, supplier_name;

create or replace view po_incoming_eta_reconciliation as
select
  coalesce(sum(incoming_qty), 0) as total_incoming_pipeline_qty,
  coalesce(sum(incoming_qty) filter (where eta_status = 'scheduled'), 0) as scheduled_eta_qty,
  coalesce(sum(incoming_qty) filter (where eta_status = 'unscheduled'), 0) as unscheduled_eta_qty,
  count(po_item_id)::integer as pipeline_item_count,
  count(po_item_id) filter (where eta_status = 'scheduled')::integer as scheduled_item_count,
  count(po_item_id) filter (where eta_status = 'unscheduled')::integer as unscheduled_item_count,
  count(distinct po_id)::integer as pipeline_po_count,
  count(distinct po_id) filter (where eta_status = 'scheduled')::integer as scheduled_po_count,
  count(distinct po_id) filter (where eta_status = 'unscheduled')::integer as unscheduled_po_count,
  max(updated_at) as updated_at
from po_incoming_pipeline_events;

create or replace view po_incoming_eta_supplier_reconciliation as
select
  supplier_code,
  supplier_name,
  coalesce(sum(incoming_qty), 0) as total_incoming_pipeline_qty,
  coalesce(sum(incoming_qty) filter (where eta_status = 'scheduled'), 0) as scheduled_eta_qty,
  coalesce(sum(incoming_qty) filter (where eta_status = 'unscheduled'), 0) as unscheduled_eta_qty,
  count(po_item_id)::integer as pipeline_item_count,
  count(po_item_id) filter (where eta_status = 'scheduled')::integer as scheduled_item_count,
  count(po_item_id) filter (where eta_status = 'unscheduled')::integer as unscheduled_item_count,
  count(distinct po_id)::integer as pipeline_po_count,
  count(distinct po_id) filter (where eta_status = 'scheduled')::integer as scheduled_po_count,
  count(distinct po_id) filter (where eta_status = 'unscheduled')::integer as unscheduled_po_count,
  max(updated_at) as updated_at
from po_incoming_pipeline_events
group by supplier_code, supplier_name;

comment on view po_incoming_pipeline_events is
  'Active physical incoming pipeline rows with explicit eta_date and eta_source. ETA uses po_items.expected_at, then po_orders.estimated_arrived_date.';
comment on view po_incoming_eta_events is
  'Scheduled ETA timeline rows only: active physical incoming rows where eta_date is not null. Exposes eta_source for debugging.';
comment on view po_incoming_eta_unscheduled_events is
  'No-ETA active physical incoming rows where eta_date is null after line/header fallback. eta_source is missing.';
comment on view po_incoming_eta_daily is
  'Daily scheduled ETA aggregate by date and supplier. detail_payload includes eta_source.';
comment on view po_incoming_eta_reconciliation is
  'One-row reconciliation of total pipeline incoming, scheduled ETA qty, and unscheduled/no-ETA qty.';
comment on view po_incoming_eta_supplier_reconciliation is
  'Supplier-level reconciliation of pipeline incoming versus scheduled and unscheduled ETA qty.';
