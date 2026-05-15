-- Metadata for manual Purchasing Decision planning overrides.
-- Existing safety_days, lead_time_days, and order_cycle_days remain the
-- durable override values keyed by SKU.

alter table purchasing_decision_controls
  add column if not exists updated_by uuid,
  add column if not exists planning_override_source text,
  add column if not exists planning_override_note text;

create index if not exists idx_purchasing_decision_controls_updated_by
  on purchasing_decision_controls (updated_by);
