insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.payment_requests
  add column if not exists payment_slip_storage_path text,
  add column if not exists payment_slip_file_name text,
  add column if not exists payment_slip_content_type text,
  add column if not exists payment_slip_uploaded_at timestamptz,
  add column if not exists payment_slip_uploaded_by uuid references auth.users(id) on delete set null;

create index if not exists idx_payment_requests_slip_uploaded_by
  on public.payment_requests(payment_slip_uploaded_by);
