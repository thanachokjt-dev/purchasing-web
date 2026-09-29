-- THB paid remains VAT-inclusive. These fields disclose its included VAT only.
alter table public.po_payments
  add column vat_rate numeric(5,2),
  add column vat_amount_thb numeric(14,2);

create function public.po_payment_vat_rate(p_type text, p_name text, p_code text)
returns numeric language sql immutable set search_path = '' as $$
  select case
    when upper(trim(coalesce(p_code,''))) in ('CSD001','ENGAGE001')
      or lower(trim(coalesce(p_name,''))) ~ '^csd fashion\y'
      or lower(trim(coalesce(p_name,''))) ~ '^engage(\s|$)' then null
    when regexp_replace(lower(coalesce(p_type,'')), '[^a-z0-9]', '', 'g')
      in ('','shipping','freight','vat','importvat','vatimportvat') then null
    else 7 end;
$$;

create function public.set_po_payment_included_vat()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare supplier record;
begin
  select supplier_name_snapshot, supplier_code into supplier from public.po_orders where po_id = new.po_id;
  new.vat_rate := public.po_payment_vat_rate(new.payment_type, supplier.supplier_name_snapshot, supplier.supplier_code);
  new.vat_amount_thb := case when new.vat_rate is null then null
    else round(coalesce(new.amount_thb, new.amount * coalesce(new.exchange_rate,1), 0) * 7 / 107, 2) end;
  return new;
end;
$$;
create trigger set_po_payment_included_vat before insert or update on public.po_payments
for each row execute function public.set_po_payment_included_vat();

create function public.refresh_po_supplier_payment_vat()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.supplier_name_snapshot is distinct from old.supplier_name_snapshot or new.supplier_code is distinct from old.supplier_code then
    update public.po_payments set vat_rate = vat_rate where po_id = new.po_id;
  end if;
  return new;
end;
$$;
create trigger refresh_po_supplier_payment_vat after update of supplier_name_snapshot,supplier_code on public.po_orders
for each row execute function public.refresh_po_supplier_payment_vat();

-- Backfill only tax disclosure fields; existing amount/FX/status/history values stay intact.
update public.po_payments set vat_rate = vat_rate;

revoke all on function public.po_payment_vat_rate(text,text,text) from public,anon,authenticated;
revoke all on function public.set_po_payment_included_vat() from public,anon,authenticated;
revoke all on function public.refresh_po_supplier_payment_vat() from public,anon,authenticated;
grant execute on function public.po_payment_vat_rate(text,text,text) to service_role;
