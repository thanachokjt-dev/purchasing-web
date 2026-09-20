-- Run after save_po_draft_lines_transaction. Every fixture and mutation is rolled back.
begin;

do $$
declare
  test_po text := 'CODEX-PO-DRAFT-TRANSACTION-TEST';
  saved jsonb;
  first_id uuid;
  did_fail boolean := false;
begin
  insert into public.po_orders (po_id, currency) values (test_po, 'THB');

  saved := public.save_po_draft_lines(
    test_po,
    jsonb_build_array(
      jsonb_build_object(
        'po_id', test_po,
        'line_no', '1',
        'sort_position', 1,
        'sku', 'CODEX-SKU-1',
        'product_title_snapshot', 'Codex item',
        'ordered_qty', 2,
        'unit_price', 100,
        'freight_unit_cost', 10,
        'currency', 'THB'
      )
    ),
    '{}'::uuid[]
  );

  if jsonb_array_length(saved) <> 1
    or (saved->0->>'landed_unit_cost')::numeric <> 110
    or (saved->0->>'line_amount')::numeric <> 200 then
    raise exception 'Initial batch save regression';
  end if;

  first_id := (saved->0->>'id')::uuid;
  saved := public.save_po_draft_lines(
    test_po,
    jsonb_build_array(
      (saved->0) || jsonb_build_object('ordered_qty', 3, 'unit_price', 120)
    ),
    '{}'::uuid[]
  );

  if (saved->0->>'id')::uuid <> first_id
    or (saved->0->>'ordered_qty')::numeric <> 3
    or (saved->0->>'line_amount')::numeric <> 360 then
    raise exception 'Update batch save regression';
  end if;

  begin
    perform public.save_po_draft_lines(
      test_po,
      jsonb_build_array(
        (saved->0) || jsonb_build_object('sku', 'CODEX-SKU-2'),
        jsonb_build_object(
          'po_id', test_po,
          'line_no', '2',
          'sort_position', 2,
          'sku', 'CODEX-SKU-2',
          'ordered_qty', 1,
          'unit_price', -1,
          'freight_unit_cost', 0,
          'currency', 'THB'
        )
      ),
      '{}'::uuid[]
    );
  exception when others then
    did_fail := true;
  end;

  if not did_fail then raise exception 'Invalid batch was not rejected'; end if;
  if (select count(*) from public.po_items where po_id = test_po) <> 1 then
    raise exception 'Partial draft save occurred';
  end if;
  if has_function_privilege('anon', 'public.save_po_draft_lines(text,jsonb,uuid[])', 'execute')
    or has_function_privilege('authenticated', 'public.save_po_draft_lines(text,jsonb,uuid[])', 'execute') then
    raise exception 'Draft save RPC must be restricted to the authorized server';
  end if;
end;
$$;

select 'PASS: PO draft batch insert, update, rollback and server-only RPC' as result;
rollback;
