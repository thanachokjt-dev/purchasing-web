-- PO detail draft controls.
-- Header supplier references and editable line ordering for draft quote work.

alter table po_orders
  add column if not exists quotation_reference text,
  add column if not exists supplier_invoice_no text,
  add column if not exists vat_mode text;

alter table po_items
  add column if not exists sort_position integer;

update po_items
set sort_position = nullif(regexp_replace(coalesce(line_no, ''), '\D', '', 'g'), '')::integer
where sort_position is null
  and coalesce(line_no, '') ~ '\d';

create index if not exists idx_po_items_po_sort
  on po_items (po_id, sort_position, line_no);
