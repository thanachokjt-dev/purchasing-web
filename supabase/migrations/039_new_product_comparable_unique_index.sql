do $$
declare
  duplicate_group_count integer;
begin
  select count(*) into duplicate_group_count
  from (
    select
      plan_id,
      comparable_product_id,
      coalesce(comparable_sku, '') as comparable_sku_key,
      count(*) as row_count
    from public.po_new_product_plan_comparables
    group by plan_id, comparable_product_id, coalesce(comparable_sku, '')
    having count(*) > 1
  ) duplicate_groups;

  if duplicate_group_count > 0 then
    raise exception
      'Cannot create unique comparable reference index: % duplicate comparable reference group(s) exist. Review public.po_new_product_plan_comparables before applying this migration.',
      duplicate_group_count;
  end if;
end $$;

create unique index if not exists idx_po_new_product_plan_comparables_unique_reference
on public.po_new_product_plan_comparables (
  plan_id,
  comparable_product_id,
  coalesce(comparable_sku, '')
);
