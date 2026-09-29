alter table public.po_orders
  add column purchasing_order_classification text not null default 'auto'
    check (purchasing_order_classification in ('auto','new','existing')),
  add column purchasing_classified_by uuid,
  add column purchasing_classified_at timestamptz;
comment on column public.po_orders.purchasing_order_classification is
  'Dashboard merchandise classification override. Auto uses first SKU PO; new/existing applies to this PO only, never to VAT or transport.';
