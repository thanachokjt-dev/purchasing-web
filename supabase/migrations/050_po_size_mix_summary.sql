-- Historical PO size mix read model.
-- Aggregates ordered PO quantities by product family and parsed size/oz bucket.

create or replace function po_size_mix_normalized_text(value text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(lower(regexp_replace(coalesce(value, ''), '[_\-/\.\(\)]+', ' ', 'g')), '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function po_size_mix_group(
  search_text text
)
returns text
language sql
immutable
as $$
  with source as (
    select po_size_mix_normalized_text(search_text) as text_value
  )
  select case
    when text_value ~ '(^| )(shinguards?|shin guards?|shin pads?|shin)( |$)' then 'shin_guards_size'
    when text_value ~ '(^| )((boxing|sparring|muay thai|mma) )?gloves?( |$)' then 'gloves_oz'
    when text_value ~ '(^| )singlets?( |$)' or text_value ~ '(^| )tank tops?( |$)' or text_value ~ '(^| )tanks?( |$)' then 'singlets_size'
    when text_value ~ '(^| )(muay thai |mma )?shorts( |$)' then 'shorts_size'
    when text_value ~ '(^| )(t shirts?|tee|tees|training tee|oversized tee|shirts?|tops?)( |$)' then 'shirts_tops_size'
    else null
  end
  from source;
$$;

create or replace function po_extract_glove_oz(preferred_text text, fallback_text text)
returns text
language sql
immutable
as $$
  with source as (
    select po_size_mix_normalized_text(concat_ws(' ', preferred_text, fallback_text)) as text_value
  ),
  matched as (
    select
      substring(text_value from '(^| )(6|8|10|12|14|16) ?oz( |$)') as explicit_match,
      substring(text_value from '(^| )(bg|boxing glove|sparring glove|muay thai glove|glove|gloves) (6|8|10|12|14|16)( |$)') as after_context_match,
      substring(text_value from '(^| )(6|8|10|12|14|16) (bg|boxing glove|sparring glove|muay thai glove|glove|gloves)( |$)') as before_context_match
    from source
  )
  select case
    when explicit_match is not null then regexp_replace(explicit_match, '[^0-9]+', '', 'g') || ' oz'
    when text_value ~ '(^| )(s m|l xl|one size|all size|all sizes|free size)( |$)' then 'Other / Unknown'
    when after_context_match is not null then regexp_replace(after_context_match, '[^0-9]+', '', 'g') || ' oz'
    when before_context_match is not null then regexp_replace(before_context_match, '[^0-9]+', '', 'g') || ' oz'
    else 'Unknown'
  end
  from matched;
$$;

create or replace function po_extract_apparel_size(preferred_text text, fallback_text text)
returns text
language sql
immutable
as $$
  with source as (
    select po_size_mix_normalized_text(concat_ws(' ', preferred_text, fallback_text)) as text_value
  )
  select case
    when text_value ~ '(^| )(one size|all size|all sizes|free size|s m|l xl)( |$)' then 'Other / Unknown'
    when text_value ~ '(^| )(3xl|3 xl|xxxl|triple xl)( |$)' then '3XL'
    when text_value ~ '(^| )(xxl|2xl|2 xl|double xl)( |$)' then '2XL / XXL'
    when text_value ~ '(^| )(xxs|2xs|extra extra small)( |$)' then 'XXS'
    when text_value ~ '(^| )(xs|x small|xsmall|extra small)( |$)' then 'XS'
    when text_value ~ '(^| )(xl|x large|xlarge|extra large)( |$)' then 'XL'
    when text_value ~ '(^| )(s|small)( |$)' then 'S'
    when text_value ~ '(^| )(m|medium)( |$)' then 'M'
    when text_value ~ '(^| )(l|large)( |$)' then 'L'
    when text_value ~ '(^| )([4-9]xl|[4-9] xl|k[1-9]|1[0-9]|[6-9])( |$)' then 'Other / Unknown'
    else 'Unknown'
  end
  from source;
$$;

create or replace view po_size_mix_summary as
with eligible_lines as (
  select
    item.sku,
    item.product_title_snapshot,
    item.variant_title_snapshot,
    item.full_name,
    item.remark,
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
      item.variant_title_snapshot,
      catalog_variant.variant_title,
      catalog_variant.option_pick,
      catalog_variant.option1_value,
      catalog_variant.option2_value,
      catalog_variant.option3_value,
      item.source_payload ->> 'size',
      item.source_payload ->> 'Size'
    ) as preferred_text,
    greatest(coalesce(item.ordered_qty, 0) - coalesce(item.cancelled_qty, 0), 0) as ordered_qty,
    po_size_mix_group(
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
        item.source_payload
      )
    ) as base_group
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
    base_group as mix_group,
    case
      when base_group = 'gloves_oz' then po_extract_glove_oz(
        preferred_text,
        search_text
      )
      when base_group in ('shin_guards_size', 'shirts_tops_size', 'shorts_size', 'singlets_size') then po_extract_apparel_size(
        preferred_text,
        search_text
      )
      else 'Unknown'
    end as bucket,
    ordered_qty
  from eligible_lines
  where base_group is not null
  union all
  select
    'adult_apparel_curve' as mix_group,
    po_extract_apparel_size(
      preferred_text,
      search_text
    ) as bucket,
    ordered_qty
  from eligible_lines
  where base_group in ('shirts_tops_size', 'shorts_size', 'singlets_size')
    and po_extract_apparel_size(preferred_text, search_text) not in ('Unknown', 'Other / Unknown')
),
bucketed as (
  select
    mix_group,
    bucket,
    sum(ordered_qty) as qty
  from classified_lines
  group by mix_group, bucket
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

revoke all on function po_size_mix_normalized_text(text) from public, anon, authenticated;
revoke all on function po_size_mix_group(text) from public, anon, authenticated;
revoke all on function po_extract_glove_oz(text, text) from public, anon, authenticated;
revoke all on function po_extract_apparel_size(text, text) from public, anon, authenticated;

grant execute on function po_size_mix_normalized_text(text) to service_role;
grant execute on function po_size_mix_group(text) to service_role;
grant execute on function po_extract_glove_oz(text, text) to service_role;
grant execute on function po_extract_apparel_size(text, text) to service_role;

comment on view po_size_mix_summary is
  'Server-side PO ordered-quantity size mix summary. Excludes cancelled/void/deleted orders and lines; no cost, tax, FX, margin, payment, or supplier financial fields.';

comment on function po_size_mix_group(text) is
  'Classifies PO line text into adjustable size-mix product groups.';
comment on function po_extract_glove_oz(text, text) is
  'Extracts normalized glove ounce buckets from PO line text.';
comment on function po_extract_apparel_size(text, text) is
  'Extracts normalized apparel size buckets from preferred variant text before fallback product text.';
