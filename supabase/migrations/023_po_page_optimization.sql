-- PO page read optimization.
-- These views keep /po lightweight: one row per PO for the list page and a
-- flattened catalog search source for lazy SKU lookup.

create extension if not exists pg_trgm;

create or replace view po_order_summary as
with item_summary as (
  select
    item.po_id,
    count(item.id)::integer as total_items,
    coalesce(sum(item.ordered_qty), 0) as total_qty,
    coalesce(sum(total.total_received_qty), 0) as total_received_qty,
    coalesce(sum(total.outstanding_qty), 0) as total_outstanding_qty,
    coalesce(sum(total.outstanding_qty) filter (
      where is_po_line_active_incoming(
        item.line_status,
        order_header.work_status,
        order_header.closed_at,
        order_header.cancelled_at,
        total.outstanding_qty
      )
    ), 0) as active_incoming_qty,
    coalesce(sum(total.outstanding_qty) filter (
      where total.outstanding_qty > 0
        and lower(regexp_replace(coalesce(item.line_status, ''), '[[:space:]-]+', '_', 'g')) = 'waiting_for_approve'
        and lower(regexp_replace(coalesce(order_header.work_status, ''), '[[:space:]-]+', '_', 'g')) = 'waiting_for_approve'
        and order_header.cancelled_at is null
        and order_header.closed_at is null
    ), 0) as pending_approval_qty,
    count(item.id) filter (
      where is_po_line_active_incoming(
        item.line_status,
        order_header.work_status,
        order_header.closed_at,
        order_header.cancelled_at,
        total.outstanding_qty
      )
    )::integer as active_line_count,
    count(item.id) filter (
      where total.outstanding_qty > 0
        and lower(regexp_replace(coalesce(item.line_status, ''), '[[:space:]-]+', '_', 'g')) = 'waiting_for_approve'
        and lower(regexp_replace(coalesce(order_header.work_status, ''), '[[:space:]-]+', '_', 'g')) = 'waiting_for_approve'
        and order_header.cancelled_at is null
        and order_header.closed_at is null
    )::integer as pending_line_count,
    array_remove(array_agg(distinct item.line_status), null) as statuses
  from po_orders order_header
  left join po_items item on item.po_id = order_header.po_id
  left join po_item_receipt_totals total on total.po_item_uuid = item.id
  group by item.po_id
),
payment_summary as (
  select
    po_id,
    coalesce(sum(
      case
        when lower(coalesce(payment_status, 'paid')) = 'planned' then 0
        else coalesce(amount_thb, amount * coalesce(exchange_rate, 1), 0)
      end
    ), 0) as paid_amount_thb,
    coalesce(sum(
      case
        when lower(coalesce(payment_status, 'paid')) = 'planned'
          then coalesce(amount_thb, amount * coalesce(exchange_rate, 1), 0)
        else 0
      end
    ), 0) as planned_amount_thb
  from po_payments
  group by po_id
)
select
  order_header.po_id,
  order_header.rqq_id,
  order_header.po_title,
  order_header.po_date,
  order_header.actual_received_date,
  order_header.cancelled_at,
  order_header.closed_at,
  order_header.estimated_arrived_date,
  order_header.estimated_delivery_date,
  order_header.work_status,
  order_header.requester,
  order_header.owner,
  order_header.supplier_code,
  order_header.supplier_name_snapshot,
  order_header.currency,
  order_header.po_amount_foreign,
  order_header.po_amount_thb,
  order_header.freight_total,
  order_header.other_landed_cost_total,
  order_header.landed_cost_note,
  order_header.quotation_reference,
  order_header.supplier_invoice_no,
  order_header.supplier_discussion_note,
  order_header.vat_mode,
  order_header.payment_terms_snapshot,
  order_header.source_payload,
  order_header.updated_at,
  coalesce(item_summary.total_items, 0) as total_items,
  coalesce(item_summary.total_qty, 0) as total_qty,
  coalesce(item_summary.total_received_qty, 0) as total_received_qty,
  coalesce(item_summary.total_outstanding_qty, 0) as total_outstanding_qty,
  coalesce(item_summary.active_incoming_qty, 0) as active_incoming_qty,
  coalesce(item_summary.pending_approval_qty, 0) as pending_approval_qty,
  coalesce(item_summary.active_line_count, 0) as active_line_count,
  coalesce(item_summary.pending_line_count, 0) as pending_line_count,
  case
    when coalesce(array_length(item_summary.statuses, 1), 0) > 0
      then item_summary.statuses
    else array[order_header.work_status]
  end as statuses,
  coalesce(payment_summary.paid_amount_thb, 0) as paid_amount_thb,
  coalesce(payment_summary.planned_amount_thb, 0) as planned_amount_thb
from po_orders order_header
left join item_summary on item_summary.po_id = order_header.po_id
left join payment_summary on payment_summary.po_id = order_header.po_id;

create or replace view po_portal_metrics as
select
  count(*)::integer as po_count,
  count(distinct coalesce(nullif(supplier_code, ''), nullif(supplier_name_snapshot, '')))::integer as supplier_count,
  coalesce(sum(total_items), 0)::integer as item_count,
  coalesce(sum(active_incoming_qty), 0) as active_incoming_total,
  coalesce(sum(pending_approval_qty), 0) as pending_approval_total,
  coalesce(sum(total_qty), 0) as ordered_total,
  coalesce(sum(total_received_qty), 0) as received_total,
  coalesce(sum(paid_amount_thb) filter (
    where closed_at is null
      and cancelled_at is null
      and lower(coalesce(work_status, '')) not in ('closed', 'cancelled', 'canceled')
  ), 0) as open_paid_amount_thb,
  coalesce(sum(planned_amount_thb), 0) as planned_amount_thb
from po_order_summary;

create or replace view po_supplier_pipeline_summary as
select
  coalesce(nullif(supplier_code, ''), 'unknown') as supplier_code,
  coalesce(nullif(supplier_name_snapshot, ''), nullif(supplier_code, ''), 'Unknown supplier') as supplier_name,
  string_agg(distinct nullif(payment_terms_snapshot, ''), ' | ') as payment_terms,
  count(po_id)::integer as po_count,
  coalesce(sum(total_items), 0)::integer as line_count,
  coalesce(sum(active_incoming_qty), 0) as incoming_qty,
  coalesce(sum(active_incoming_qty + pending_approval_qty), 0) as total_qty,
  coalesce(sum(active_incoming_qty + pending_approval_qty), 0) as outstanding_qty,
  coalesce(sum(paid_amount_thb), 0) as paid_amount_thb,
  coalesce(sum(planned_amount_thb), 0) as planned_amount_thb
from po_order_summary
where closed_at is null
  and cancelled_at is null
  and lower(coalesce(work_status, '')) not in ('closed', 'cancelled', 'canceled')
  and (
    active_incoming_qty > 0
    or pending_approval_qty > 0
    or lower(regexp_replace(coalesce(work_status, ''), '[[:space:]-]+', '_', 'g'))
      in ('draft', 'waiting_for_approve', 'follow_up', 'inpro', 'delivery', 'final_payment')
  )
group by
  coalesce(nullif(supplier_code, ''), 'unknown'),
  coalesce(nullif(supplier_name_snapshot, ''), nullif(supplier_code, ''), 'Unknown supplier');

create or replace view po_catalog_search as
select
  variant.id as product_variant_id,
  variant.shopify_variant_id,
  variant.sku,
  variant.variant_title,
  variant.price,
  variant.variant_image_url,
  product.product_title,
  product.product_image_url,
  product.vendor,
  product.tags
from product_variants variant
left join products product on product.id = variant.product_id
where variant.sku is not null
  and btrim(variant.sku) <> '';

create index if not exists idx_po_orders_work_status_po_date_desc
  on po_orders (work_status, po_date desc);

create index if not exists idx_po_orders_updated_at_desc
  on po_orders (updated_at desc);

create index if not exists idx_po_orders_supplier_code_po_date_desc
  on po_orders (supplier_code, po_date desc);

create index if not exists idx_po_orders_po_id_trgm
  on po_orders using gin (po_id gin_trgm_ops);

create index if not exists idx_po_orders_supplier_name_trgm
  on po_orders using gin (supplier_name_snapshot gin_trgm_ops);

create index if not exists idx_po_items_po_id_sku
  on po_items (po_id, sku);

create index if not exists idx_po_receipts_po_item_id
  on po_receipts (po_item_id);

create index if not exists idx_po_payments_po_id
  on po_payments (po_id);

create index if not exists idx_product_variants_sku_trgm
  on product_variants using gin (sku gin_trgm_ops);

create index if not exists idx_product_variants_variant_title_trgm
  on product_variants using gin (variant_title gin_trgm_ops);

create index if not exists idx_products_product_title_trgm
  on products using gin (product_title gin_trgm_ops);
