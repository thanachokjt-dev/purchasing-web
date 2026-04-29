-- Remember whether each purchasing decision row should create PO qty from raw
-- recommendation or rounded-to-10 recommendation.

alter table purchasing_decision_controls
  add column if not exists order_qty_mode text not null default 'rounded'
  check (order_qty_mode in ('raw', 'rounded'));

create index if not exists idx_purchasing_decision_controls_order_qty_mode
  on purchasing_decision_controls (order_qty_mode);
