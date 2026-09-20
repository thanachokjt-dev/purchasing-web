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
      item.ordered_qty * (item.unit_price + coalesce(item.freight_unit_cost, 0)) as amount,
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
