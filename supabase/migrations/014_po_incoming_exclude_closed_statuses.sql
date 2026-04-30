create or replace view po_incoming_by_sku as
with excluded_statuses as (
  select unnest(array['final_payment', 'draft', 'closed', 'cancelled', 'canceled']) as status
)
select
  item.sku,
  coalesce(sum(total.outstanding_qty) filter (
    where lower(coalesce(item.line_status, '')) not in (select status from excluded_statuses)
      and lower(coalesce(order_header.work_status, '')) not in (select status from excluded_statuses)
      and order_header.cancelled_at is null
      and order_header.closed_at is null
  ), 0) as active_incoming_qty,
  coalesce(sum(total.outstanding_qty) filter (
    where lower(coalesce(item.line_status, '')) = 'waiting_for_approve'
      and lower(coalesce(order_header.work_status, '')) not in (select status from excluded_statuses)
      and order_header.cancelled_at is null
      and order_header.closed_at is null
  ), 0) as pending_approval_qty,
  max(order_header.expected_at) filter (
    where lower(coalesce(item.line_status, '')) not in (select status from excluded_statuses)
      and lower(coalesce(order_header.work_status, '')) not in (select status from excluded_statuses)
      and order_header.cancelled_at is null
      and order_header.closed_at is null
  ) as latest_expected_at
from po_items item
join po_orders order_header on order_header.po_id = item.po_id
join po_item_receipt_totals total on total.po_item_uuid = item.id
group by item.sku;
