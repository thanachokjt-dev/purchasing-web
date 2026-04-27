-- Phase 3.2 Purchasing Decision PO creation helpers.
-- Demand HM starts from calculated sales history, but buyers can override it
-- for planning and PO creation without changing Shopify or sales history.

alter table purchasing_decision_controls
  add column if not exists demand_index_override numeric(14, 6);
