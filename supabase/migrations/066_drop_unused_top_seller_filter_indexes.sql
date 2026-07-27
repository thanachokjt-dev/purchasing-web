-- Top Seller filter choices are applied to the small in-memory dashboard
-- snapshot, so database indexes on these arrays add write cost without helping
-- the current read path.
drop index if exists public.top_seller_product_design_snapshot_item_statuses_idx;
drop index if exists public.top_seller_product_design_snapshot_visibilities_idx;
