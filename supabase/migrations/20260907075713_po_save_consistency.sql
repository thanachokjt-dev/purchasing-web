-- Planned costs are valid before the date or amount of payment is known.
alter table public.po_payments alter column payment_date drop not null;
alter table public.po_payments add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_po_payment() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP <> 'DELETE' then NEW.updated_at := clock_timestamp(); end if;
  update public.po_orders set updated_at = clock_timestamp()
  where po_id = case when TG_OP = 'DELETE' then OLD.po_id else NEW.po_id end;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;
drop trigger if exists touch_po_payment on public.po_payments;
create trigger touch_po_payment before insert or update or delete on public.po_payments
for each row execute function public.touch_po_payment();

-- Called only by authenticated/authorized server actions using the service role.
-- Lock, compare, delete and write in one transaction; a failed row rolls everything back.
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
  -- Keep the existing PO total/FX calculation in the same transaction as payments.
  with rates as (
    select distinct on (upper(trim(currency))) upper(trim(currency)) currency, exchange_rate
    from public.po_payments
    where po_id = p_po_id and exchange_rate > 0
      and lower(trim(payment_type)) not in ('freight','shipping','fine','penalty','other','other_cost')
    order by upper(trim(currency)), payment_date desc nulls last, created_at desc
  ), lines as (
    select i.ordered_qty * (i.unit_price + coalesce(i.freight_unit_cost,0)) amount,
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
