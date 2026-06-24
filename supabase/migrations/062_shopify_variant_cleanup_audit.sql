-- Durable audit history for explicit, admin-approved stale Shopify variant cleanup.
-- Cleanup remains script-triggered; normal Shopify sync never invokes it.

create extension if not exists "pgcrypto";

create table if not exists public.shopify_variant_cleanup_logs (
  id uuid primary key default gen_random_uuid(),
  cleanup_run_id uuid not null,
  product_variant_id uuid not null,
  original_sku text not null,
  archived_sku text not null,
  old_shopify_variant_id text not null,
  new_shopify_variant_id text not null,
  old_product_title text,
  old_variant_title text,
  new_product_title text,
  new_variant_title text,
  reference_counts jsonb not null default '{}'::jsonb,
  risk_level text not null check (risk_level in ('low', 'medium')),
  applied_by text,
  applied_at timestamptz not null default now(),
  unique (cleanup_run_id, product_variant_id)
);

create index if not exists shopify_variant_cleanup_logs_original_sku_idx
  on public.shopify_variant_cleanup_logs (original_sku, applied_at desc);

create index if not exists shopify_variant_cleanup_logs_old_variant_idx
  on public.shopify_variant_cleanup_logs (old_shopify_variant_id, applied_at desc);

grant select, insert on table public.shopify_variant_cleanup_logs to service_role;
revoke all on table public.shopify_variant_cleanup_logs from anon, authenticated;

comment on table public.shopify_variant_cleanup_logs is
  'Audit records for admin-approved stale Shopify variant SKU archival. Historical business rows are not rewritten or deleted.';

create or replace function public.cleanup_stale_shopify_variants(
  p_cleanup_run_id uuid,
  p_rows jsonb,
  p_applied_by text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  target public.product_variants%rowtype;
  updated_count integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Cleanup requires at least one confirmed stale variant row.';
  end if;

  -- Lock and validate the complete set before changing any SKU.
  for item in select value from jsonb_array_elements(p_rows)
  loop
    select *
      into target
      from public.product_variants
      where id = (item->>'productVariantId')::uuid
      for update;

    if not found then
      raise exception 'Cleanup target no longer exists: %', item->>'productVariantId';
    end if;
    if target.sku <> item->>'originalSku'
      or target.shopify_variant_id <> item->>'oldShopifyVariantId' then
      raise exception 'Cleanup target changed since dry-run: %', item->>'originalSku';
    end if;
    if exists (
      select 1 from public.product_variants
      where sku = item->>'archivedSku' and id <> target.id
    ) then
      raise exception 'Proposed archive SKU already exists: %', item->>'archivedSku';
    end if;
  end loop;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    update public.product_variants
      set sku = item->>'archivedSku', updated_at = now()
      where id = (item->>'productVariantId')::uuid;

    insert into public.shopify_variant_cleanup_logs (
      cleanup_run_id,
      product_variant_id,
      original_sku,
      archived_sku,
      old_shopify_variant_id,
      new_shopify_variant_id,
      old_product_title,
      old_variant_title,
      new_product_title,
      new_variant_title,
      reference_counts,
      risk_level,
      applied_by
    ) values (
      p_cleanup_run_id,
      (item->>'productVariantId')::uuid,
      item->>'originalSku',
      item->>'archivedSku',
      item->>'oldShopifyVariantId',
      item->>'newShopifyVariantId',
      item->>'oldProductTitle',
      item->>'oldVariantTitle',
      item->>'newProductTitle',
      item->>'newVariantTitle',
      coalesce(item->'referenceCounts', '{}'::jsonb),
      item->>'riskLevel',
      p_applied_by
    );
    updated_count := updated_count + 1;
  end loop;

  return updated_count;
end;
$$;

revoke all on function public.cleanup_stale_shopify_variants(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.cleanup_stale_shopify_variants(uuid, jsonb, text) to service_role;

comment on function public.cleanup_stale_shopify_variants(uuid, jsonb, text) is
  'Atomically validates, archives, and audits an explicit set of stale Shopify catalog variants.';
