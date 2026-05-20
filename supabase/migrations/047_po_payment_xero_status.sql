-- Track whether a PO payment row has been uploaded to Xero.
-- This is an internal reminder flag only; it does not integrate with Xero.

alter table po_payments
  add column if not exists xero_status text not null default 'pending';

update po_payments
set xero_status = 'pending'
where xero_status is null or xero_status not in ('pending', 'uploaded');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'po_payments_xero_status_check'
  ) then
    alter table po_payments
      add constraint po_payments_xero_status_check
      check (xero_status in ('pending', 'uploaded'));
  end if;
end $$;
