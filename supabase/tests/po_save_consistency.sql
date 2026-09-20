-- Run after po_save_consistency. Every fixture and mutation is rolled back.
begin;
do $$
declare
  snap jsonb;
  saved jsonb;
  new_id uuid;
  did_fail boolean := false;
  test_po text := 'CODEX-PO-SAVE-ROLLBACK-TEST';
  draft jsonb;
begin
  insert into public.po_orders(po_id) values(test_po);
  draft := jsonb_build_object('po_id',test_po,'payment_type','shipping',
    'payment_status','planned','xero_status','pending','amount',0,'currency','THB',
    'exchange_rate',1,'amount_thb',0);
  saved := public.save_po_payments(test_po,jsonb_build_array(draft),'{}'::uuid[],'[]');
  if jsonb_array_length(saved) <> 1 or saved->0->>'payment_date' is not null then
    raise exception 'Planned/date/zero-amount regression';
  end if;
  new_id := (saved->0->>'id')::uuid;
  snap := saved;
  saved := public.save_po_payments(test_po,
    jsonb_build_array(saved->0 || '{"xero_status":"uploaded","due_date":"2026-09-10"}'::jsonb),
    '{}'::uuid[],snap);
  if saved->0->>'xero_status' <> 'uploaded' then raise exception 'Upload save regression'; end if;
  begin
    perform public.save_po_payments(test_po,jsonb_build_array(draft),'{}'::uuid[],snap);
  exception when others then did_fail := SQLERRM like 'Payments changed%'; end;
  if not did_fail then raise exception 'Stale save was not rejected'; end if;
  snap := saved;
  did_fail := false;
  begin
    perform public.save_po_payments(test_po,
      jsonb_build_array(draft, draft || '{"payment_status":"invalid"}'::jsonb),array[new_id],snap);
  exception when others then did_fail := true; end;
  if not did_fail then raise exception 'Invalid row was not rejected'; end if;
  select jsonb_agg(to_jsonb(p) order by id) into saved from public.po_payments p where po_id=test_po;
  if saved <> snap then raise exception 'Partial save occurred'; end if;
  saved := public.save_po_payments(test_po,
    jsonb_build_array(snap->0 || '{"due_date":null}'::jsonb),'{}'::uuid[],snap);
  if saved->0->>'due_date' is not null then raise exception 'Date clearing regression'; end if;
  if has_function_privilege('anon','public.save_po_payments(text,jsonb,uuid[],jsonb)','execute')
    or has_function_privilege('authenticated','public.save_po_payments(text,jsonb,uuid[],jsonb)','execute') then
    raise exception 'RPC must be restricted to the authorized server';
  end if;
end;
$$;
select 'PASS: planned blank date, zero amount task, upload, stale conflict, atomic rollback, date clearing, server-only RPC' as result;
rollback;
