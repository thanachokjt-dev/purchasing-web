-- Allow PO payment Xero tracking to record draft bills.

alter table po_payments
  drop constraint if exists po_payments_xero_status_check;

alter table po_payments
  add constraint po_payments_xero_status_check
  check (xero_status in ('pending', 'draft', 'uploaded'));
