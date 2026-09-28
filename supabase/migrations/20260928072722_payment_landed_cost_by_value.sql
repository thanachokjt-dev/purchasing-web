-- Payment freight is allocated in THB by merchandise value, then converted
-- back to each line's currency. Exact line allocations are retained separately
-- from the existing four-decimal per-unit display/storage fields.
alter table public.po_items
  add column if not exists payment_freight_amount_thb numeric(14,4) not null default 0;

create or replace function public.allocate_po_payment_freight(p_po_id text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  pool numeric;
  total_value numeric;
  cumulative_value numeric := 0;
  allocated_so_far numeric := 0;
  allocation numeric;
  unit_cost numeric;
  item record;
begin
  perform 1 from public.po_orders where po_id = p_po_id for update;
  if not found then raise exception 'PO does not exist'; end if;

  if exists (select 1 from public.po_payments where po_id = p_po_id
    and lower(trim(payment_type)) in ('shipping', 'freight') and amount > 0
    and upper(trim(currency)) <> 'THB' and (exchange_rate is null or exchange_rate <= 0)) then
    raise exception 'Shipping/Freight needs an exchange rate before allocation';
  end if;

  -- Include known planned expenses, as well as paid expenses, exactly once.
  select coalesce(sum(round(amount * case when upper(trim(currency)) = 'THB'
    then 1 else exchange_rate end, 4)), 0)
  into pool from public.po_payments
  where po_id = p_po_id and lower(trim(payment_type)) in ('shipping', 'freight');

  if pool = 0 then
    -- Do not touch manually entered freight on POs without payment allocation.
    update public.po_items set freight_unit_cost = 0, landed_unit_cost = unit_price,
      payment_freight_amount_thb = 0,
      source_payload = coalesce(source_payload, '{}'::jsonb) - 'paymentFreightAllocation',
      updated_at = clock_timestamp()
    where po_id = p_po_id and source_payload ? 'paymentFreightAllocation';
    return;
  end if;

  -- Prefer merchandise FX. A cost payment in the same currency can supply FX
  -- when merchandise payments have not yet been entered. Never assume FX 1.
  for item in
    select i.*, case when upper(trim(coalesce(i.currency, 'THB'))) = 'THB' then 1
      else (select p.exchange_rate from public.po_payments p
        where p.po_id = p_po_id and upper(trim(p.currency)) = upper(trim(i.currency))
          and p.exchange_rate > 0
        order by (lower(trim(p.payment_type)) not in
          ('shipping','freight','fine','penalty','other','other_cost')) desc,
          p.payment_date desc nulls last, p.created_at desc, p.id desc limit 1)
      end fx
    from public.po_items i where i.po_id = p_po_id order by i.id
  loop
    if item.ordered_qty > 0 and item.unit_price > 0 and item.fx is null then
      raise exception 'Missing exchange rate for SKU % (%) before Shipping/Freight allocation', item.sku, item.currency;
    end if;
    total_value := coalesce(total_value, 0) + item.ordered_qty * item.unit_price * coalesce(item.fx, 1);
  end loop;
  if coalesce(total_value, 0) <= 0 then
    raise exception 'PO merchandise value must be greater than 0 before Shipping/Freight allocation';
  end if;

  for item in
    select i.*, case when upper(trim(coalesce(i.currency, 'THB'))) = 'THB' then 1
      else (select p.exchange_rate from public.po_payments p
        where p.po_id = p_po_id and upper(trim(p.currency)) = upper(trim(i.currency))
          and p.exchange_rate > 0
        order by (lower(trim(p.payment_type)) not in
          ('shipping','freight','fine','penalty','other','other_cost')) desc,
          p.payment_date desc nulls last, p.created_at desc, p.id desc limit 1)
      end fx
    from public.po_items i where i.po_id = p_po_id order by i.id
  loop
    cumulative_value := cumulative_value + item.ordered_qty * item.unit_price * coalesce(item.fx, 1);
    -- Cumulative rounding reconciles the monetary allocations to the input total.
    allocation := round(pool * cumulative_value / total_value, 4) - allocated_so_far;
    allocated_so_far := allocated_so_far + allocation;
    unit_cost := case when item.ordered_qty > 0 and allocation > 0 then allocation / item.fx / item.ordered_qty else 0 end;
    update public.po_items set
      freight_unit_cost = round(unit_cost, 4),
      landed_unit_cost = round(unit_price + unit_cost, 4),
      payment_freight_amount_thb = allocation,
      source_payload = coalesce(source_payload, '{}'::jsonb) || jsonb_build_object(
        'paymentFreightAllocation', jsonb_build_object(
          'amountThb', allocation, 'unitCost', unit_cost, 'exchangeRate', item.fx,
          'basis', 'merchandise_value', 'totalThb', pool)),
      updated_at = clock_timestamp()
    where id = item.id;
  end loop;
end;
$$;
revoke all on function public.allocate_po_payment_freight(text) from public, anon, authenticated;
grant execute on function public.allocate_po_payment_freight(text) to service_role;

-- Allocate inside both existing transactions, before merchandise totals.
create or replace function public.save_po_payments(
  p_po_id text, p_rows jsonb, p_delete_ids uuid[], p_expected jsonb default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  current_rows jsonb;
  expected_rows jsonb;
  entry jsonb;
  payment public.po_payments;
begin
  perform 1 from public.po_orders where po_id = p_po_id for update;
  if not found then raise exception 'PO does not exist'; end if;

  select coalesce(jsonb_agg(to_jsonb(p) - 'updated_at' order by p.id), '[]'::jsonb)
  into current_rows from public.po_payments p where po_id = p_po_id;
  if p_expected is not null then
    select coalesce(jsonb_agg(e - 'updated_at' order by e->>'id'), '[]'::jsonb)
    into expected_rows from jsonb_array_elements(p_expected) e;
    if current_rows <> expected_rows then
      raise exception 'Payments changed in another session. Your edits are still here. Reload this PO and review the latest payments before saving again.';
    end if;
  end if;

  if exists (select 1 from unnest(p_delete_ids) i where not exists (
    select 1 from public.po_payments p where p.id = i and p.po_id = p_po_id
  )) then raise exception 'Payment to delete no longer exists in this PO'; end if;
  delete from public.po_payments where po_id = p_po_id and id = any(p_delete_ids);

  for entry in select value from jsonb_array_elements(p_rows) loop
    payment := jsonb_populate_record(null::public.po_payments, entry);
    if payment.po_id is distinct from p_po_id then raise exception 'Invalid payment PO'; end if;
    if payment.payment_status not in ('paid', 'planned') or payment.xero_status not in ('pending','draft','uploaded')
      or payment.amount < 0 or payment.exchange_rate <= 0 then raise exception 'Invalid payment values'; end if;
    if payment.payment_status = 'paid' and payment.payment_date is null then
      raise exception 'Paid payments need a paid date';
    end if;
    if payment.id is not null then
      update public.po_payments set
        payment_date = payment.payment_date, payment_type = payment.payment_type,
        payment_status = payment.payment_status, xero_status = payment.xero_status,
        due_date = payment.due_date, amount = payment.amount, exchange_rate = payment.exchange_rate,
        amount_thb = payment.amount_thb, currency = payment.currency,
        paid_by = payment.paid_by, reference = payment.reference, note = payment.note
      where id = payment.id and po_id = p_po_id;
      if not found then raise exception 'Payment no longer exists in this PO'; end if;
    else
      insert into public.po_payments (po_id,payment_date,payment_type,payment_status,xero_status,
        due_date,amount,exchange_rate,amount_thb,currency,paid_by,reference,note)
      values (p_po_id,payment.payment_date,payment.payment_type,payment.payment_status,payment.xero_status,
        payment.due_date,payment.amount,payment.exchange_rate,payment.amount_thb,payment.currency,
        payment.paid_by,payment.reference,payment.note);
    end if;
  end loop;
  perform public.allocate_po_payment_freight(p_po_id);
  -- Keep the existing PO total/FX calculation in the same transaction as payments.
  with rates as (
    select distinct on (upper(trim(currency))) upper(trim(currency)) currency, exchange_rate
    from public.po_payments
    where po_id = p_po_id and exchange_rate > 0
      and lower(trim(payment_type)) not in ('freight','shipping','fine','penalty','other','other_cost')
    order by upper(trim(currency)), payment_date desc nulls last, created_at desc
  ), lines as (
    select i.ordered_qty * (i.unit_price + case when i.source_payload ? 'paymentFreightAllocation' then 0 else coalesce(i.freight_unit_cost,0) end) amount,
      upper(trim(coalesce(i.currency,'THB'))) currency,
      upper(trim(coalesce(o.currency,'THB'))) order_currency
    from public.po_items i join public.po_orders o on o.po_id=i.po_id
    where i.po_id=p_po_id
  ), totals as (
    select coalesce(sum(case when l.currency='THB' then l.amount else l.amount*coalesce(r.exchange_rate,0) end),0) thb,
      coalesce(sum(case when l.currency=l.order_currency then l.amount
        when l.currency='THB' and l.order_currency<>'THB' and ro.exchange_rate>0 then l.amount/ro.exchange_rate
        else l.amount end),0) foreign_amount
    from lines l left join rates r on r.currency=l.currency left join rates ro on ro.currency=l.order_currency
  )
  update public.po_orders o set po_amount_thb=t.thb, po_amount_foreign=t.foreign_amount, updated_at=clock_timestamp()
  from totals t where o.po_id=p_po_id;
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]'::jsonb)
  into current_rows from public.po_payments p where po_id = p_po_id;
  return current_rows;
end;
$$;
revoke all on function public.save_po_payments(text,jsonb,uuid[],jsonb) from public, anon, authenticated;
grant execute on function public.save_po_payments(text,jsonb,uuid[],jsonb) to service_role;
revoke all on function public.touch_po_payment() from public, anon, authenticated;
grant execute on function public.touch_po_payment() to service_role;

-- Save every PO draft line in one short transaction. The server action validates
-- user input first; this function owns row locking, set consistency and totals.
create or replace function public.save_po_draft_lines(
  p_po_id text,
  p_rows jsonb,
  p_delete_ids uuid[] default '{}'::uuid[]
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  entry jsonb;
  line public.po_items;
  current_line public.po_items;
  saved_rows jsonb;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'PO draft rows must be a JSON array';
  end if;

  perform 1
  from public.po_orders
  where po_id = p_po_id
  for update;
  if not found then
    raise exception 'PO does not exist';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_delete_ids, '{}'::uuid[])) item_id
    where not exists (
      select 1
      from public.po_items item
      where item.id = item_id and item.po_id = p_po_id
    )
  ) then
    raise exception 'PO line to delete no longer exists in this PO';
  end if;

  delete from public.po_items
  where po_id = p_po_id
    and id = any(coalesce(p_delete_ids, '{}'::uuid[]));

  if exists (
    select 1
    from jsonb_array_elements(p_rows) row_value
    group by lower(trim(row_value->>'sku'))
    having count(*) > 1
  ) then
    raise exception 'A SKU appears more than once in this PO draft';
  end if;

  for entry in
    select value
    from jsonb_array_elements(p_rows) with ordinality rows(value, position)
    order by position
  loop
    line := jsonb_populate_record(null::public.po_items, entry);

    if line.po_id is distinct from p_po_id then
      raise exception 'Invalid PO line owner';
    end if;
    if nullif(trim(line.sku), '') is null then
      raise exception 'PO line SKU is required';
    end if;
    if line.ordered_qty < 0 or line.unit_price < 0 or coalesce(line.freight_unit_cost, 0) < 0 then
      raise exception 'PO line quantities and costs must be non-negative';
    end if;

    if line.id is null then
      insert into public.po_items (
        po_item_id, po_id, line_no, sort_position, sku,
        product_title_snapshot, variant_title_snapshot, ordered_qty,
        unit_price, freight_unit_cost, landed_unit_cost, line_amount,
        currency, remark, full_name, line_status, source, source_payload,
        updated_at
      ) values (
        p_po_id || '-' || pg_catalog.gen_random_uuid()::text,
        p_po_id,
        line.line_no,
        line.sort_position,
        trim(line.sku),
        coalesce(nullif(trim(line.product_title_snapshot), ''), trim(line.sku)),
        nullif(trim(line.variant_title_snapshot), ''),
        line.ordered_qty,
        line.unit_price,
        coalesce(line.freight_unit_cost, 0),
        line.unit_price + coalesce(line.freight_unit_cost, 0),
        line.ordered_qty * line.unit_price,
        coalesce(nullif(trim(line.currency), ''), 'THB'),
        nullif(trim(line.remark), ''),
        coalesce(nullif(trim(line.full_name), ''), nullif(trim(line.product_title_snapshot), ''), trim(line.sku)),
        'draft',
        'web_app',
        jsonb_build_object(
          'unitPriceSource', 'manual',
          'unitPriceSourceDate', null,
          'unitPriceSourcePoId', null,
          'unitPriceSourcePoReference', null
        ),
        clock_timestamp()
      );
    else
      select *
      into current_line
      from public.po_items
      where id = line.id and po_id = p_po_id
      for update;
      if not found then
        raise exception 'PO line no longer exists in this PO';
      end if;

      update public.po_items
      set
        line_no = line.line_no,
        sort_position = line.sort_position,
        sku = trim(line.sku),
        product_title_snapshot = coalesce(nullif(trim(line.product_title_snapshot), ''), trim(line.sku)),
        variant_title_snapshot = nullif(trim(line.variant_title_snapshot), ''),
        ordered_qty = line.ordered_qty,
        unit_price = line.unit_price,
        freight_unit_cost = coalesce(line.freight_unit_cost, 0),
        landed_unit_cost = line.unit_price + coalesce(line.freight_unit_cost, 0),
        line_amount = line.ordered_qty * line.unit_price,
        currency = coalesce(nullif(trim(line.currency), ''), 'THB'),
        remark = nullif(trim(line.remark), ''),
        full_name = coalesce(nullif(trim(line.full_name), ''), nullif(trim(line.product_title_snapshot), ''), trim(line.sku)),
        source_payload = case
          when current_line.unit_price is distinct from line.unit_price then
            coalesce(current_line.source_payload, '{}'::jsonb) || jsonb_build_object(
              'unitPriceSource', 'manual',
              'unitPriceSourceDate', null,
              'unitPriceSourcePoId', null,
              'unitPriceSourcePoReference', null
            )
          else current_line.source_payload
        end,
        updated_at = clock_timestamp()
      where id = line.id and po_id = p_po_id;
    end if;
  end loop;

  perform public.allocate_po_payment_freight(p_po_id);

  with rates as (
    select distinct on (upper(trim(currency)))
      upper(trim(currency)) as currency,
      exchange_rate
    from public.po_payments
    where po_id = p_po_id
      and exchange_rate > 0
      and lower(trim(payment_type)) not in ('freight', 'shipping', 'fine', 'penalty', 'other', 'other_cost')
    order by upper(trim(currency)), payment_date desc nulls last, created_at desc
  ), lines as (
    select
      item.ordered_qty * (item.unit_price + case when item.source_payload ? 'paymentFreightAllocation' then 0 else coalesce(item.freight_unit_cost, 0) end) as amount,
      upper(trim(coalesce(item.currency, 'THB'))) as currency,
      upper(trim(coalesce(po.currency, 'THB'))) as order_currency
    from public.po_items item
    join public.po_orders po on po.po_id = item.po_id
    where item.po_id = p_po_id
  ), totals as (
    select
      coalesce(sum(case when lines.currency = 'THB' then lines.amount else lines.amount * coalesce(rate.exchange_rate, 0) end), 0) as thb,
      coalesce(sum(case
        when lines.currency = lines.order_currency then lines.amount
        when lines.currency = 'THB' and lines.order_currency <> 'THB' and order_rate.exchange_rate > 0
          then lines.amount / order_rate.exchange_rate
        else lines.amount
      end), 0) as foreign_amount
    from lines
    left join rates rate on rate.currency = lines.currency
    left join rates order_rate on order_rate.currency = lines.order_currency
  )
  update public.po_orders po
  set
    po_amount_thb = totals.thb,
    po_amount_foreign = totals.foreign_amount,
    updated_at = clock_timestamp()
  from totals
  where po.po_id = p_po_id;

  select coalesce(
    jsonb_agg(to_jsonb(item) order by item.sort_position nulls last, item.line_no, item.id),
    '[]'::jsonb
  )
  into saved_rows
  from public.po_items item
  where item.po_id = p_po_id;

  return saved_rows;
end;
$$;

revoke all on function public.save_po_draft_lines(text, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.save_po_draft_lines(text, jsonb, uuid[]) to service_role;
