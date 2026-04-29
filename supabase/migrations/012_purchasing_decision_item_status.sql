-- Allow Purchasing Decision to keep a planning-only item status override.
-- Shopify remains read-only; this column stores a local status only when it
-- differs from the Shopify status.

alter table purchasing_decision_controls
  add column if not exists item_status_override text;

create index if not exists idx_purchasing_decision_controls_item_status
  on purchasing_decision_controls (item_status_override);
