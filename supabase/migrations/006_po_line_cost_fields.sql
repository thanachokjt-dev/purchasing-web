-- Phase 2.2 PO line cost helpers.
-- Freight / imported landed cost is entered per unit after the total landed cost
-- is known and divided by total received or ordered quantity.

alter table po_items
  add column if not exists freight_unit_cost numeric(14, 4) not null default 0,
  add column if not exists landed_unit_cost numeric(14, 4) not null default 0;
