create table if not exists public.payment_requests (
  id uuid primary key default uuid_generate_v4(),
  po_id text not null,
  payment_line_id uuid references public.po_payments(id) on delete set null,
  request_status text not null default 'pending_review',
  payment_type text,
  requested_amount numeric,
  requested_currency text,
  requested_fx_rate numeric,
  requested_thb_amount numeric,
  due_date date,
  request_note text,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_requests_status_check check (
    request_status in (
      'draft',
      'pending_review',
      'pending_approval',
      'approved',
      'rejected',
      'cancelled'
    )
  )
);

create table if not exists public.payment_approval_steps (
  id uuid primary key default uuid_generate_v4(),
  payment_request_id uuid not null references public.payment_requests(id) on delete cascade,
  step_order integer not null,
  step_type text not null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  assigned_role text,
  is_required boolean not null default true,
  status text not null default 'pending',
  active_at timestamptz,
  action_by uuid references auth.users(id) on delete set null,
  action_at timestamptz,
  note text,
  evidence_url text,
  evidence_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_approval_steps_step_type_check check (
    step_type in (
      'retail_review',
      'reviewer',
      'preliminary_approval',
      'final_approval'
    )
  ),
  constraint payment_approval_steps_status_check check (
    status in (
      'pending',
      'active',
      'approved',
      'rejected',
      'skipped',
      'cancelled'
    )
  ),
  constraint payment_approval_steps_order_unique unique (
    payment_request_id,
    step_order
  )
);

create index if not exists idx_payment_requests_po_id
  on public.payment_requests(po_id);

create index if not exists idx_payment_requests_payment_line_id
  on public.payment_requests(payment_line_id);

create index if not exists idx_payment_requests_status
  on public.payment_requests(request_status);

create index if not exists idx_payment_requests_requested_by
  on public.payment_requests(requested_by);

create index if not exists idx_payment_approval_steps_request_id
  on public.payment_approval_steps(payment_request_id);

create index if not exists idx_payment_approval_steps_assigned_user
  on public.payment_approval_steps(assigned_user_id);

create index if not exists idx_payment_approval_steps_status
  on public.payment_approval_steps(status);

create or replace function public.set_payment_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_payment_requests_updated_at on public.payment_requests;
create trigger set_payment_requests_updated_at
before update on public.payment_requests
for each row
execute function public.set_payment_requests_updated_at();

create or replace function public.set_payment_approval_steps_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_payment_approval_steps_updated_at on public.payment_approval_steps;
create trigger set_payment_approval_steps_updated_at
before update on public.payment_approval_steps
for each row
execute function public.set_payment_approval_steps_updated_at();
