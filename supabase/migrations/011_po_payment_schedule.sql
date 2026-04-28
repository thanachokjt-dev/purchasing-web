-- PO payment schedule.
-- Payments can be paid records or planned reminders before payment is made.

alter table po_payments
  add column if not exists payment_status text not null default 'paid',
  add column if not exists due_date date;

create index if not exists idx_po_payments_po_status_due
  on po_payments (po_id, payment_status, due_date);
