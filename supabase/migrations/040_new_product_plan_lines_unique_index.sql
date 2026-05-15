do $$
declare
  duplicate_group_count integer;
begin
  select count(*) into duplicate_group_count
  from (
    select
      plan_id,
      coalesce(lower(trim(size_value)), '') as size_value_key,
      coalesce(lower(trim(color_value)), '') as color_value_key,
      count(*) as row_count
    from public.po_new_product_plan_lines
    group by
      plan_id,
      coalesce(lower(trim(size_value)), ''),
      coalesce(lower(trim(color_value)), '')
    having count(*) > 1
  ) duplicate_groups;

  if duplicate_group_count > 0 then
    raise exception
      'Cannot create unique quantity matrix line index: % duplicate plan line group(s) exist. Review public.po_new_product_plan_lines manually before applying this migration.',
      duplicate_group_count;
  end if;
end $$;

create unique index if not exists idx_po_new_product_plan_lines_unique_size_color
on public.po_new_product_plan_lines (
  plan_id,
  coalesce(lower(trim(size_value)), ''),
  coalesce(lower(trim(color_value)), '')
);
