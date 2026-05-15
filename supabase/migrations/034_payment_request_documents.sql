create table if not exists public.payment_request_documents (
  id uuid primary key default uuid_generate_v4(),
  payment_request_id uuid not null references public.payment_requests(id) on delete cascade,
  po_id text,
  payment_line_id uuid references public.po_payments(id) on delete set null,
  document_type text not null,
  document_title text not null,
  document_url text not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint payment_request_documents_type_check check (
    document_type in (
      'internal_system_po',
      'supplier_quote',
      'supplier_invoice',
      'supplier_po',
      'freight_invoice',
      'shipping_invoice',
      'tax_invoice',
      'duty_tax_receipt',
      'import_docs',
      'form_e',
      'payment_approval_evidence',
      'whatsapp_approval',
      'google_drive',
      'onedrive',
      'other'
    )
  )
);

create index if not exists idx_payment_request_documents_request_id
  on public.payment_request_documents(payment_request_id);

create index if not exists idx_payment_request_documents_po_id
  on public.payment_request_documents(po_id);

create index if not exists idx_payment_request_documents_payment_line_id
  on public.payment_request_documents(payment_line_id);

create index if not exists idx_payment_request_documents_created_by
  on public.payment_request_documents(created_by);
