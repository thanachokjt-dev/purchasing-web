alter table po_orders
  add column if not exists estimated_delivery_date date,
  add column if not exists estimated_arrived_date date,
  add column if not exists actual_received_date date,
  add column if not exists supplier_discussion_note text;
