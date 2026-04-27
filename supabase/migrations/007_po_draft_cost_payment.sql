-- Phase 2.3 PO draft detail, landed cost, and payment log.
-- A PO can stay open across multiple shipments, receipts, landed-cost updates,
-- and payment events without splitting into multiple PO records.

alter table po_orders
  add column if not exists freight_total numeric(14, 4) not null default 0,
  add column if not exists other_landed_cost_total numeric(14, 4) not null default 0,
  add column if not exists landed_cost_note text;

create table if not exists po_payments (
  id uuid primary key default uuid_generate_v4(),
  po_id text not null references po_orders(po_id) on delete cascade,
  payment_date date not null default current_date,
  payment_type text not null default 'deposit',
  amount numeric(14, 4) not null default 0,
  currency text not null default 'THB',
  paid_by text,
  reference text,
  note text,
  created_at timestamptz not null default now(),
  constraint po_payments_amount_non_negative check (amount >= 0)
);

create index if not exists idx_po_payments_po_date
  on po_payments (po_id, payment_date desc);
