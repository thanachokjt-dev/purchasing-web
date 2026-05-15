alter table public.payment_request_documents
  add column if not exists is_active boolean default true,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz,
  add column if not exists removed_by uuid references auth.users(id) on delete set null,
  add column if not exists removed_at timestamptz,
  add column if not exists remove_reason text;

update public.payment_request_documents
set is_active = true
where is_active is null;

create table if not exists public.payment_proof_audit_logs (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid references public.payment_requests(id) on delete cascade,
  action_type text not null check (
    action_type in (
      'slip_uploaded',
      'slip_replaced',
      'slip_url_updated',
      'slip_removed'
    )
  ),
  old_storage_path text,
  old_file_name text,
  old_content_type text,
  old_external_url text,
  new_storage_path text,
  new_file_name text,
  new_content_type text,
  new_external_url text,
  reason text not null,
  changed_by uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz default now()
);

create table if not exists public.payment_request_document_audit_logs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.payment_request_documents(id) on delete cascade,
  payment_request_id uuid references public.payment_requests(id) on delete cascade,
  action_type text not null check (
    action_type in (
      'created',
      'updated',
      'url_replaced',
      'removed',
      'restored'
    )
  ),
  old_document_type text,
  old_title text,
  old_url text,
  old_note text,
  new_document_type text,
  new_title text,
  new_url text,
  new_note text,
  reason text,
  changed_by uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz default now()
);

create index if not exists idx_payment_request_documents_active
  on public.payment_request_documents(payment_request_id, is_active);

create index if not exists idx_payment_request_documents_updated_by
  on public.payment_request_documents(updated_by);

create index if not exists idx_payment_request_documents_removed_by
  on public.payment_request_documents(removed_by);

create index if not exists idx_payment_proof_audit_request
  on public.payment_proof_audit_logs(payment_request_id, changed_at desc);

create index if not exists idx_payment_proof_audit_changed_by
  on public.payment_proof_audit_logs(changed_by);

create index if not exists idx_payment_document_audit_document
  on public.payment_request_document_audit_logs(document_id, changed_at desc);

create index if not exists idx_payment_document_audit_request
  on public.payment_request_document_audit_logs(payment_request_id, changed_at desc);

create index if not exists idx_payment_document_audit_changed_by
  on public.payment_request_document_audit_logs(changed_by);
