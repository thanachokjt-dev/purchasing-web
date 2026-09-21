begin;

do $$
declare
  v_session_id uuid;
  v_first_line uuid;
  v_second_line uuid;
  v_failed_as_expected boolean := false;
begin
  select public.create_weekly_stock_count_session(
    date '2099-01-05',
    'warehouse',
    null,
    jsonb_build_array(
      jsonb_build_object(
        'variant_id', null,
        'sku', 'TEST-STOCK-S',
        'product_group_key', 'test::apparel::stock',
        'section_name', 'TEST',
        'family', 'apparel',
        'product_name', 'Test Stock',
        'size', 'S',
        'tags', jsonb_build_array('test'),
        'sort_order', 1
      ),
      jsonb_build_object(
        'variant_id', null,
        'sku', 'TEST-STOCK-M',
        'product_group_key', 'test::apparel::stock',
        'section_name', 'TEST',
        'family', 'apparel',
        'product_name', 'Test Stock',
        'size', 'M',
        'tags', jsonb_build_array('test'),
        'sort_order', 2
      )
    )
  ) into v_session_id;

  if (select total_lines from public.weekly_stock_count_sessions where id = v_session_id) <> 2 then
    raise exception 'Expected two snapshot lines';
  end if;

  select id into v_first_line from public.weekly_stock_count_lines where session_id = v_session_id and size = 'S';
  select id into v_second_line from public.weekly_stock_count_lines where session_id = v_session_id and size = 'M';

  perform public.save_weekly_stock_count_values(
    v_session_id,
    null,
    jsonb_build_array(jsonb_build_object('line_id', v_first_line, 'counted_qty', 0))
  );

  if (select counted_lines from public.weekly_stock_count_sessions where id = v_session_id) <> 1 then
    raise exception 'Zero must count as completed, not blank';
  end if;

  begin
    perform public.complete_weekly_stock_count_session(v_session_id, null);
  exception when others then
    v_failed_as_expected := true;
  end;
  if not v_failed_as_expected then
    raise exception 'Incomplete session should not complete';
  end if;

  perform public.save_weekly_stock_count_values(
    v_session_id,
    null,
    jsonb_build_array(jsonb_build_object('line_id', v_second_line, 'counted_qty', 7))
  );
  perform public.complete_weekly_stock_count_session(v_session_id, null);

  if (select status from public.weekly_stock_count_sessions where id = v_session_id) <> 'completed' then
    raise exception 'Session should be completed';
  end if;
end;
$$;

rollback;
