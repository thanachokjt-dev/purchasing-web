-- Purchasing setup master data.
-- Supplier profiles and tag catalog are the controlled lists used by
-- Purchasing Decision Sheet.

create extension if not exists "uuid-ossp";

alter table po_suppliers
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_no text,
  add column if not exists contact_email text,
  add column if not exists profile_score numeric(5, 2) not null default 0,
  add column if not exists profile_note text;

create table if not exists po_supplier_contacts (
  id uuid primary key default uuid_generate_v4(),
  supplier_code text not null references po_suppliers(supplier_code) on delete cascade,
  contact_name text not null,
  department text,
  email text,
  phone text,
  line_id text,
  note text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists purchasing_tag_catalog (
  tag text primary key,
  label text not null,
  category text not null default 'general',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_po_supplier_contacts_supplier
  on po_supplier_contacts (supplier_code, is_primary desc, contact_name);

create index if not exists idx_purchasing_tag_catalog_category
  on purchasing_tag_catalog (category, tag);

insert into purchasing_tag_catalog (tag, label, category, description)
select distinct
  btrim(tag_value) as tag,
  btrim(tag_value) as label,
  'shopify' as category,
  'Seeded from Shopify product tags' as description
from products
cross join lateral unnest(tags) as tag_value
where btrim(tag_value) <> ''
on conflict (tag) do nothing;

insert into purchasing_tag_catalog (tag, label, category, description)
values
  ('core', 'Core', 'planning', 'Always-on product that should stay visible in purchase planning'),
  ('event', 'Event', 'planning', 'Event or limited-run item; can be hidden from regular reorder flow'),
  ('seasonal', 'Seasonal', 'planning', 'Seasonal demand item'),
  ('new_drop', 'New Drop', 'planning', 'New product drop or launch item'),
  ('slow_mover', 'Slow Mover', 'planning', 'Low movement item that needs cautious replenishment'),
  ('markdown_list', 'Markdown List', 'planning', 'Item intentionally hidden from standard reorder planning'),
  ('one_time_event', 'One-Time Event', 'planning', 'Strong seller from a one-off event or campaign; exclude from normal PO demand'),
  ('restock_candidate', 'Restock Candidate', 'planning', 'Candidate for reorder review after buyer confirmation'),
  ('oos_comeback', 'OOS Comeback', 'planning', 'Stockout item with enough demand history to consider bringing back'),
  ('high_margin', 'High Margin', 'commercial', 'Product with strong margin profile'),
  ('cash_sensitive', 'Cash Sensitive', 'commercial', 'Reorder should consider cash flow or deposit timing before PO'),
  ('supplier_risk', 'Supplier Risk', 'supplier', 'Item needs attention due to supplier reliability or lead-time risk'),
  ('long_lead_time', 'Long Lead Time', 'supplier', 'Supplier or item usually needs longer production or delivery planning'),
  ('size_run', 'Size Run', 'merchandising', 'Item should be reviewed as a size run rather than standalone SKU')
on conflict (tag) do nothing;
