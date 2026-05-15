-- Current inventory summary for planning pages.
-- Shopify inventory_snapshots remains the source of truth; this view exposes
-- one current on-hand row per SKU so page renders do not aggregate location rows.

create or replace view current_inventory_by_sku as
with latest_snapshot as (
  select max(snapshot_date) as snapshot_date
  from inventory_snapshots
)
select
  snapshot.sku,
  latest_snapshot.snapshot_date,
  coalesce(sum(snapshot.on_hand), 0) as on_hand,
  coalesce(sum(snapshot.available), 0) as available,
  max(snapshot.synced_at) as synced_at
from latest_snapshot
join inventory_snapshots snapshot
  on snapshot.snapshot_date = latest_snapshot.snapshot_date
where snapshot.sku is not null
  and btrim(snapshot.sku) <> ''
group by snapshot.sku, latest_snapshot.snapshot_date;
