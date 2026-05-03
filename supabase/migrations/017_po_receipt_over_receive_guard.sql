-- Guard PO receiving at the database boundary so concurrent receipts cannot
-- collectively exceed the current outstanding quantity for a PO line.
create or replace function guard_po_receipt_over_receive()
returns trigger
language plpgsql
as $$
declare
  item_row record;
  order_row record;
  existing_received_qty numeric(14, 4);
  outstanding_qty numeric(14, 4);
  normalized_line_status text;
  normalized_order_status text;
begin
  if new.received_qty is null or new.received_qty <= 0 then
    raise exception 'Receive quantity must be greater than 0';
  end if;

  select
    id,
    po_id,
    ordered_qty,
    legacy_received_qty,
    cancelled_qty,
    line_status
  into item_row
  from po_items
  where id = new.po_item_id
  for update;

  if not found then
    raise exception 'PO item does not exist';
  end if;

  select work_status, closed_at, cancelled_at
  into order_row
  from po_orders
  where po_id = item_row.po_id
  for update;

  if not found then
    raise exception 'PO does not exist';
  end if;

  normalized_order_status :=
    lower(regexp_replace(coalesce(order_row.work_status, ''), '[\s-]+', '_', 'g'));

  if order_row.closed_at is not null
    or order_row.cancelled_at is not null
    or normalized_order_status in ('closed', 'cancelled', 'canceled')
  then
    raise exception 'Closed or cancelled POs cannot be received';
  end if;

  normalized_line_status :=
    lower(regexp_replace(coalesce(item_row.line_status, ''), '[\s-]+', '_', 'g'));

  if normalized_line_status in ('closed', 'cancelled', 'canceled', 'fully_received') then
    raise exception 'This PO line is closed, cancelled, or fully received and cannot be received';
  end if;

  if normalized_line_status not in ('inpro', 'delivery', 'final_payment') then
    raise exception 'This PO line must be in progress, delivery, or final payment before receiving';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(sum(received_qty), 0)
    into existing_received_qty
    from po_receipts
    where po_item_id = new.po_item_id
      and id <> old.id;
  else
    select coalesce(sum(received_qty), 0)
    into existing_received_qty
    from po_receipts
    where po_item_id = new.po_item_id;
  end if;

  outstanding_qty := greatest(
    coalesce(item_row.ordered_qty, 0)
      - coalesce(item_row.cancelled_qty, 0)
      - coalesce(item_row.legacy_received_qty, 0)
      - existing_received_qty,
    0
  );

  if new.received_qty > outstanding_qty then
    raise exception 'Receive quantity exceeds outstanding quantity (%)', outstanding_qty;
  end if;

  if new.received_at is null then
    new.received_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists po_receipts_over_receive_guard on po_receipts;

create trigger po_receipts_over_receive_guard
before insert or update of po_item_id, received_qty on po_receipts
for each row
execute function guard_po_receipt_over_receive();
