alter table public.payment_requests
  add column if not exists accounting_paid_amount numeric,
  add column if not exists accounting_currency text,
  add column if not exists accounting_fx_rate numeric,
  add column if not exists accounting_thb_amount numeric,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by uuid references auth.users(id) on delete set null,
  add column if not exists payment_reference text,
  add column if not exists payment_slip_url text,
  add column if not exists accounting_note text,
  add column if not exists accounting_recorded_at timestamptz,
  add column if not exists accounting_recorded_by uuid references auth.users(id) on delete set null;

alter table public.payment_requests
  drop constraint if exists payment_requests_status_check;

alter table public.payment_requests
  add constraint payment_requests_status_check check (
    request_status in (
      'draft',
      'pending_review',
      'pending_approval',
      'approved',
      'paid',
      'rejected',
      'cancelled'
    )
  );

create index if not exists idx_payment_requests_paid_by
  on public.payment_requests(paid_by);

create index if not exists idx_payment_requests_accounting_recorded_by
  on public.payment_requests(accounting_recorded_by);
