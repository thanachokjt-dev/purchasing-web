drop index if exists public.idx_po_new_product_plan_lines_unique_size_color;

create unique index if not exists idx_po_new_product_plan_lines_unique_product_size_color
on public.po_new_product_plan_lines (
  plan_id,
  coalesce(lower(trim(product_name)), ''),
  coalesce(lower(trim(size_value)), ''),
  coalesce(lower(trim(color_value)), '')
);
