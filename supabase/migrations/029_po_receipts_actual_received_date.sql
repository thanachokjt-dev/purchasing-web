alter table po_receipts
  add column if not exists actual_received_date date;

create index if not exists idx_po_receipts_actual_received_date
  on po_receipts (po_item_id, actual_received_date desc);

comment on column po_receipts.actual_received_date is
  'Business receipt date selected by the user. received_at/created_at remain system save timestamps for audit.';
