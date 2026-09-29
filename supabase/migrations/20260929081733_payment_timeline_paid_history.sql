-- Actual cash remains history after a PO closes or is cancelled.
-- Planned cash is actionable only while its PO is active.
create or replace view public.po_payment_timeline_events
with (security_invoker = true) as
with normalized_payments as (
  select
    case when po_portal_status_key(payment.payment_status) = 'planned'
      then payment.due_date else payment.payment_date end as event_date,
    orders.po_id,
    orders.po_id as po_number,
    coalesce(nullif(orders.quotation_reference, ''), nullif(orders.supplier_invoice_no, ''),
      nullif(orders.rqq_id, ''), nullif(orders.po_title, ''), orders.po_id) as po_reference,
    orders.supplier_code,
    coalesce(nullif(orders.supplier_name_snapshot, ''), nullif(orders.supplier_code, ''), 'Unknown supplier') as supplier_name,
    payment.id as payment_id,
    coalesce(nullif(payment.reference, ''), nullif(payment.payment_type, ''), payment.id::text) as payment_label,
    payment.payment_type,
    coalesce(nullif(payment.payment_status, ''), 'paid') as payment_status,
    case when po_portal_status_key(payment.payment_status) = 'planned' then 'planned' else 'paid' end as series,
    payment.amount as amount_original,
    coalesce(nullif(upper(btrim(payment.currency)), ''), nullif(upper(btrim(orders.currency)), ''), '') as currency,
    case when upper(btrim(coalesce(nullif(payment.currency, ''), orders.currency))) = 'THB' then 1::numeric
      when payment.exchange_rate > 0 then payment.exchange_rate else null end as exchange_rate,
    case
      when upper(btrim(coalesce(nullif(payment.currency, ''), orders.currency))) = 'THB'
        then round(coalesce(payment.amount_thb, payment.amount, 0)::numeric, 2)
      when payment.exchange_rate > 0
        then round(coalesce(payment.amount_thb, payment.amount * payment.exchange_rate, 0)::numeric, 2)
      else null
    end as amount_thb,
    nullif(btrim(orders.supplier_discussion_note), '') as latest_supplier_comment,
    '/po/' || orders.po_id as po_detail_href,
    greatest(orders.updated_at, payment.created_at) as updated_at
  from public.po_payments payment
  join public.po_orders orders on orders.po_id = payment.po_id
  where coalesce(nullif(po_portal_status_key(payment.payment_status), ''), 'paid') = 'paid'
    or (po_portal_status_key(payment.payment_status) = 'planned'
      and is_po_order_active_for_portal(orders.work_status, orders.closed_at, orders.cancelled_at))
)
select event_date, po_id, po_number, po_reference, supplier_code, supplier_name,
  payment_id, payment_label, payment_type, payment_status, series, amount_original,
  currency, exchange_rate, amount_thb, latest_supplier_comment, po_detail_href, updated_at
from normalized_payments
where event_date is not null and (amount_thb is null or amount_thb >= 0);

-- Financial read model remains server-only; adding history does not expose it publicly.
revoke all on public.po_payment_timeline_events from public, anon, authenticated;
grant select on public.po_payment_timeline_events to service_role;
alter view public.po_payment_timeline_daily set (security_invoker = true);
revoke all on public.po_payment_timeline_daily from public, anon, authenticated;
grant select on public.po_payment_timeline_daily to service_role;
comment on view public.po_payment_timeline_events is
  'Server-only payment history: all actual Paid rows, active PO plans only. Recorded FX and gross THB including VAT; no estimated rate 1 for foreign cash.';
