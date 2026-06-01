-- Fix glove oz bucket capture so SQL never emits a bare "oz" bucket.

create or replace function po_extract_glove_oz(preferred_text text, fallback_text text)
returns text
language sql
immutable
as $$
  with source as (
    select po_size_mix_normalized_text(concat_ws(' ', preferred_text, fallback_text)) as text_value
  ),
  matches as (
    select
      regexp_match(text_value, '(^| )(6|8|10|12|14|16) ?oz( |$)') as explicit_match,
      regexp_match(text_value, '(^| )(bg|boxing glove|sparring glove|muay thai glove|glove|gloves) (6|8|10|12|14|16)( |$)') as after_context_match,
      regexp_match(text_value, '(^| )(6|8|10|12|14|16) (bg|boxing glove|sparring glove|muay thai glove|glove|gloves)( |$)') as before_context_match
    from source
  )
  select case
    when explicit_match is not null then explicit_match[2] || ' oz'
    when after_context_match is not null then after_context_match[3] || ' oz'
    when before_context_match is not null then before_context_match[2] || ' oz'
    else 'Unknown'
  end
  from matches;
$$;

create or replace view po_size_mix_summary as
with eligible_lines as (
  select
    item.sku,
    concat_ws(
      ' ',
      item.sku,
      item.product_title_snapshot,
      catalog_product.product_title,
      item.full_name,
      item.variant_title_snapshot,
      catalog_variant.variant_title,
      catalog_variant.option_pick,
      catalog_variant.option1_value,
      catalog_variant.option2_value,
      catalog_variant.option3_value,
      catalog_product.product_type,
      array_to_string(catalog_product.tags, ' '),
      item.remark,
      item.source_payload ->> 'product_name',
      item.source_payload ->> 'productName',
      item.source_payload ->> 'product_title',
      item.source_payload ->> 'title',
      item.source_payload ->> 'item_name',
      item.source_payload ->> 'itemName',
      item.source_payload ->> 'variant_name',
      item.source_payload ->> 'variantName',
      item.source_payload ->> 'variant_title',
      item.source_payload ->> 'description',
      item.source_payload ->> 'option1',
      item.source_payload ->> 'option2',
      item.source_payload ->> 'option3',
      item.source_payload ->> 'option1_value',
      item.source_payload ->> 'option2_value',
      item.source_payload ->> 'option3_value',
      item.source_payload ->> 'size',
      item.source_payload ->> 'Size',
      item.source_payload ->> 'color_size',
      item.source_payload ->> 'supplier_sku',
      item.source_payload ->> 'supplierSku',
      item.source_payload ->> 'product_type',
      item.source_payload ->> 'category',
      item.source_payload ->> 'submittedSku'
    ) as search_text,
    concat_ws(
      ' ',
      item.sku,
      item.product_title_snapshot,
      catalog_product.product_title,
      item.full_name,
      item.variant_title_snapshot,
      catalog_variant.variant_title,
      catalog_variant.option_pick,
      catalog_variant.option1_value,
      catalog_variant.option2_value,
      catalog_variant.option3_value,
      item.source_payload ->> 'product_name',
      item.source_payload ->> 'productName',
      item.source_payload ->> 'product_title',
      item.source_payload ->> 'title',
      item.source_payload ->> 'item_name',
      item.source_payload ->> 'itemName',
      item.source_payload ->> 'variant_name',
      item.source_payload ->> 'variantName',
      item.source_payload ->> 'variant_title',
      item.source_payload ->> 'description',
      item.source_payload ->> 'option1',
      item.source_payload ->> 'option2',
      item.source_payload ->> 'option3',
      item.source_payload ->> 'option1_value',
      item.source_payload ->> 'option2_value',
      item.source_payload ->> 'option3_value',
      item.source_payload ->> 'size',
      item.source_payload ->> 'Size',
      item.source_payload ->> 'color_size',
      item.source_payload ->> 'supplier_sku',
      item.source_payload ->> 'supplierSku',
      item.source_payload ->> 'submittedSku'
    ) as group_text,
    concat_ws(
      ' ',
      item.variant_title_snapshot,
      catalog_variant.variant_title,
      catalog_variant.option_pick,
      catalog_variant.option1_value,
      catalog_variant.option2_value,
      catalog_variant.option3_value,
      item.source_payload ->> 'size',
      item.source_payload ->> 'Size'
    ) as preferred_text,
    greatest(coalesce(item.ordered_qty, 0) - coalesce(item.cancelled_qty, 0), 0) as ordered_qty
  from po_items item
  join po_orders order_header on order_header.po_id = item.po_id
  left join product_variants catalog_variant on catalog_variant.sku = item.sku
  left join products catalog_product on catalog_product.id = catalog_variant.product_id
  where order_header.cancelled_at is null
    and po_portal_status_key(order_header.work_status) not in ('cancelled', 'canceled', 'void', 'voided', 'deleted')
    and po_portal_status_key(item.line_status) not in ('cancelled', 'canceled', 'void', 'voided', 'deleted')
    and greatest(coalesce(item.ordered_qty, 0) - coalesce(item.cancelled_qty, 0), 0) > 0
),
classified_lines as (
  select
    po_size_mix_group(group_text) as mix_group,
    case
      when po_size_mix_group(group_text) = 'gloves_oz' then po_extract_glove_oz(preferred_text, search_text)
      when po_size_mix_group(group_text) in ('shin_guards_size', 'shirts_tops_size', 'shorts_size', 'singlets_size')
        then po_extract_apparel_size(preferred_text, search_text)
      else 'Unknown'
    end as bucket,
    ordered_qty
  from eligible_lines
  where po_size_mix_group(group_text) is not null
  union all
  select
    'adult_apparel_curve' as mix_group,
    po_extract_apparel_size(preferred_text, search_text) as bucket,
    ordered_qty
  from eligible_lines
  where po_size_mix_group(group_text) in ('shirts_tops_size', 'shorts_size', 'singlets_size')
),
bucketed as (
  select
    mix_group,
    case
      when mix_group = 'gloves_oz' and bucket not in ('6 oz', '8 oz', '10 oz', '12 oz', '14 oz', '16 oz') then 'Unknown'
      else bucket
    end as bucket,
    sum(ordered_qty) as qty
  from classified_lines
  group by
    mix_group,
    case
      when mix_group = 'gloves_oz' and bucket not in ('6 oz', '8 oz', '10 oz', '12 oz', '14 oz', '16 oz') then 'Unknown'
      else bucket
    end
),
ranked as (
  select
    mix_group,
    bucket,
    qty,
    round(qty / nullif(sum(qty) over (partition by mix_group), 0) * 100, 1) as pct,
    dense_rank() over (partition by mix_group order by qty desc, bucket asc)::integer as rank
  from bucketed
)
select
  mix_group,
  bucket,
  qty,
  pct,
  rank
from ranked
where qty > 0;

grant select on table po_size_mix_summary to service_role;
revoke all on function po_extract_glove_oz(text, text) from public, anon, authenticated;
grant execute on function po_extract_glove_oz(text, text) to service_role;
