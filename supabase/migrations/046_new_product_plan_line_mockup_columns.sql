alter table public.po_new_product_plan_lines
  add column if not exists mockup_image_storage_path text;

alter table public.po_new_product_plan_lines
  add column if not exists mockup_image_original_filename text;

alter table public.po_new_product_plan_lines
  add column if not exists mockup_image_uploaded_at timestamptz;
