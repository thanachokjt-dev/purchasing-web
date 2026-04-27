-- Phase 1.3 manual supplier overrides.
-- Use this when Excel and Shopify do not have a reliable supplier for a SKU.

create table if not exists manual_supplier_mappings (
  sku text primary key,
  supplier text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_manual_supplier_mappings_supplier
  on manual_supplier_mappings (supplier);
