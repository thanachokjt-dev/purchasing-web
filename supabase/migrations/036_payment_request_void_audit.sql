alter table public.payment_requests
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text;

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
      'cancelled',
      'voided'
    )
  );

create table if not exists public.payment_request_audit_logs (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid references public.payment_requests(id) on delete cascade,
  action_type text not null check (
    action_type in (
      'created',
      'approved',
      'paid',
      'slip_uploaded',
      'slip_replaced',
      'voided',
      'cancelled',
      'linked_payment_reverted'
    )
  ),
  old_status text,
  new_status text,
  old_values jsonb,
  new_values jsonb,
  reason text,
  changed_by uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz default now()
);

create index if not exists idx_payment_requests_voided_by
  on public.payment_requests(voided_by);

create index if not exists idx_payment_requests_voided_at
  on public.payment_requests(voided_at);

create index if not exists idx_payment_request_audit_request
  on public.payment_request_audit_logs(payment_request_id, changed_at desc);

create index if not exists idx_payment_request_audit_changed_by
  on public.payment_request_audit_logs(changed_by);
