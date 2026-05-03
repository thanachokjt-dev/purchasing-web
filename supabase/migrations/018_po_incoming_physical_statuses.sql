-- final_payment is a payment follow-up state, not a physical inbound-stock
-- state. Incoming stock must come from unreceived outstanding qty on lines
-- that are still expected to physically arrive.
create or replace function is_po_line_active_incoming(
  line_status text,
  order_status text,
  closed_at timestamptz,
  cancelled_at timestamptz,
  outstanding_qty numeric
)
returns boolean
language sql
stable
as $$
  select
    coalesce(outstanding_qty, 0) > 0
    and closed_at is null
    and cancelled_at is null
    and lower(regexp_replace(coalesce(line_status, ''), '[[:space:]-]+', '_', 'g'))
      in ('inpro', 'delivery')
    and lower(regexp_replace(coalesce(order_status, ''), '[[:space:]-]+', '_', 'g'))
      in ('inpro', 'delivery');
$$;

create or replace view po_incoming_by_sku as
with normalized_lines as (
  select
    item.sku,
    total.outstanding_qty,
    lower(regexp_replace(coalesce(item.line_status, ''), '[[:space:]-]+', '_', 'g')) as line_status,
    lower(regexp_replace(coalesce(order_header.work_status, ''), '[[:space:]-]+', '_', 'g')) as order_status,
    order_header.closed_at,
    order_header.cancelled_at,
    order_header.expected_at
  from po_items item
  join po_orders order_header on order_header.po_id = item.po_id
  join po_item_receipt_totals total on total.po_item_uuid = item.id
)
select
  sku,
  coalesce(sum(outstanding_qty) filter (
    where is_po_line_active_incoming(
      line_status,
      order_status,
      closed_at,
      cancelled_at,
      outstanding_qty
    )
  ), 0) as active_incoming_qty,
  coalesce(sum(outstanding_qty) filter (
    where outstanding_qty > 0
      and line_status = 'waiting_for_approve'
      and order_status = 'waiting_for_approve'
      and cancelled_at is null
      and closed_at is null
  ), 0) as pending_approval_qty,
  max(expected_at) filter (
    where is_po_line_active_incoming(
      line_status,
      order_status,
      closed_at,
      cancelled_at,
      outstanding_qty
    )
  ) as latest_expected_at
from normalized_lines
group by sku;
