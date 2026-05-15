insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'new-product-mockups',
  'new-product-mockups',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can read new product mockups'
  ) then
    create policy "Public can read new product mockups"
    on storage.objects
    for select
    to anon, authenticated
    using (bucket_id = 'new-product-mockups');
  end if;
end $$;
