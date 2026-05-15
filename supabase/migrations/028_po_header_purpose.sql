alter table po_orders
  add column if not exists header_purpose text;
