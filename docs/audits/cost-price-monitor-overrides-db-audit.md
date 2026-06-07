# Cost Price Monitor Overrides DB Audit

Date: 2026-06-07

## Executive summary

Cost Price Monitor currently prefers `public.cost_price_monitor_overrides` for manual override reads and writes, but also contains a fallback path to legacy `public.cost_price_overrides`.

The live read-only check from this workspace found:

- `public.cost_price_monitor_overrides` is not readable through PostgREST: `PGRST205`, "Could not find the table ... in the schema cache".
- `public.cost_price_overrides` is readable and contains 34 rows.
- All 34 legacy rows have `group_key`.
- 5 legacy rows have `manual_purchase_price`.
- 0 legacy rows have `manual_landed_cost`.
- 29 legacy rows have `manual_selling_price`.
- 0 legacy rows have notes.

The `42P10` error means the SQL reached an `ON CONFLICT (group_key)` statement against `public.cost_price_monitor_overrides`, but Postgres could not find a unique or exclusion constraint/index on exactly `group_key` for that table.

The most likely migration-level root cause is that the intended unique index name, `cost_price_monitor_overrides_group_key_uidx`, may already exist on the legacy table from an earlier migration/version. In Postgres, index names are schema-level relation names. If an index with that name already exists on `public.cost_price_overrides`, then:

```sql
create unique index if not exists cost_price_monitor_overrides_group_key_uidx
  on public.cost_price_monitor_overrides (group_key);
```

can skip index creation for the new table, leaving `public.cost_price_monitor_overrides` without the unique index required by:

```sql
on conflict (group_key)
```

## Root cause

The failure is not caused by manual override payload shape. It is caused by database shape:

1. The app upserts into `public.cost_price_monitor_overrides` with `onConflict: "group_key"`.
2. The target table must have a unique or exclusion constraint/index on `group_key`.
3. The failing SQL indicates that target table does not currently have that matching unique/exclusion constraint.
4. There is historical table-name drift between `public.cost_price_overrides` and `public.cost_price_monitor_overrides`.
5. Existing DB-saved manual values are in the old table, `public.cost_price_overrides`.

## Files inspected

- `src/app/cost-price-monitor/page.tsx`
- `src/app/cost-price-monitor/actions.ts`
- `src/app/cost-price-monitor/manual-override-form.tsx`
- `src/app/cost-price-monitor/selection-controls.tsx`
- `src/lib/cost-price-monitor.ts`
- `src/app/cost-price-monitor/print/page.tsx`
- `src/app/api/cost-price-monitor/export/route.ts`
- `src/lib/purchasing-decision-data.ts`
- `src/app/purchasing-decision/actions.ts`

## Migrations inspected

- `supabase/migrations/054_cost_price_monitor_overrides.sql`
- `supabase/migrations/055_cost_price_monitor_group_overrides.sql`
- `supabase/migrations/056_fix_cost_price_monitor_override_group_key_unique.sql`
- `supabase/migrations/057_cost_price_monitor_override_color.sql`
- `supabase/migrations/058_create_cost_price_monitor_overrides_table.sql`
- `supabase/migrations/005_purchasing_decision_controls.sql`

## Current code table name

### Preferred read table

`src/lib/cost-price-monitor.ts` reads preferred overrides from:

```ts
.from("cost_price_monitor_overrides")
.select("id,group_key,main_name,color,supplier,category,product_group,manual_purchase_price,manual_landed_cost,manual_selling_price,note,updated_by,updated_at,created_at")
```

### Legacy fallback read table

The same file also reads legacy overrides from:

```ts
.from("cost_price_overrides")
.select("*")
```

Legacy rows are appended only when their `group_key` is not already present in preferred rows. SKU-only legacy rows are also accepted as fallback.

### Preferred upsert table

`src/app/cost-price-monitor/actions.ts` writes first to:

```ts
.from("cost_price_monitor_overrides")
.upsert(payload, { onConflict: "group_key" })
```

### Legacy fallback upsert table

If the preferred table is missing from the PostgREST schema cache, the action falls back to:

```ts
.from("cost_price_overrides")
.upsert(legacyPayload, { onConflict: "group_key" })
```

This fallback only runs for missing-table/schema-cache errors. Other preferred-table errors are reported back to the user.

## Current SQL table name

Current related migrations mostly target `public.cost_price_monitor_overrides`.

However, `058_create_cost_price_monitor_overrides_table.sql` also references the old table `public.cost_price_overrides` as a legacy data source and copies its rows into `public.cost_price_monitor_overrides`.

## Canonical table recommendation

Canonical table should be:

```sql
public.cost_price_monitor_overrides
```

Rationale:

- The current app uses `cost_price_monitor_overrides` as the preferred table.
- The table name is specific to the Cost Price Monitor feature.
- Legacy `cost_price_overrides` can be kept as a data source/fallback, but should not be the long-term write target.

The old table `public.cost_price_overrides` should be optional after migration. It can be left alone for audit/history and safe rollback, but new saves should go to `public.cost_price_monitor_overrides`.

## Required schema from code

The app requires these fields on `public.cost_price_monitor_overrides`:

```sql
id
group_key
main_name
color
supplier
category
product_group
manual_purchase_price
manual_landed_cost
manual_selling_price
note
updated_by
created_at
updated_at
```

Write payload from `actions.ts` includes:

```ts
group_key
main_name
color
supplier
category
product_group
manual_purchase_price
manual_landed_cost
manual_selling_price
note
updated_by
updated_at
```

The preferred read select includes all required read fields except `sku`; `sku` is only used for legacy fallback support in the shared `OverrideRow` type.

## Required unique constraint

The current write path requires a unique or exclusion constraint/index matching:

```sql
on conflict (group_key)
```

Minimum required target-table index:

```sql
create unique index if not exists cost_price_monitor_overrides_group_key_uidx
  on public.cost_price_monitor_overrides (group_key);
```

Important: because index names are schema-level relation names, this exact index name must not already belong to `public.cost_price_overrides`. If it does, `IF NOT EXISTS` can skip creation on the canonical table and `ON CONFLICT (group_key)` will still fail.

Safer final-state verification SQL:

```sql
select
  indexname,
  tablename,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname = 'cost_price_monitor_overrides_group_key_uidx';
```

Expected result: `tablename = 'cost_price_monitor_overrides'`.

## Why `ON CONFLICT` failed

Postgres error:

```text
ERROR: 42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

This happens when the target table in the `INSERT` does not have a unique/exclusion constraint matching the conflict target.

For the failing statement:

```sql
insert into public.cost_price_monitor_overrides (...)
...
on conflict (group_key) do update ...
```

the target table must have a unique constraint or unique index on `public.cost_price_monitor_overrides(group_key)`.

Likely causes:

- The unique index was never created on `public.cost_price_monitor_overrides`.
- The index creation was skipped because an index with the same name already exists on the legacy `public.cost_price_overrides`.
- The migration was partially run manually, with the `INSERT ... ON CONFLICT` executed before the unique index statement.
- The canonical table was created outside the migration without the unique index.

## Migration-by-migration audit

### 054_cost_price_monitor_overrides.sql

- Creates: `public.cost_price_monitor_overrides`
- Columns:
  - `id uuid primary key default gen_random_uuid()`
  - `group_key text not null`
  - `main_name text`
  - `color text`
  - `supplier text`
  - `category text`
  - `product_group text`
  - `manual_purchase_price numeric`
  - `manual_landed_cost numeric`
  - `manual_selling_price numeric`
  - `note text`
  - `updated_by text`
  - `created_at timestamptz default now()`
  - `updated_at timestamptz default now()`
- Constraints:
  - nonblank `group_key`
  - nonnegative manual numeric checks
- Indexes:
  - unique `cost_price_monitor_overrides_group_key_uidx` on `(group_key)`
  - `cost_price_monitor_overrides_updated_at_idx` on `(updated_at desc)`
- Grants/revokes:
  - grants select/insert/update/delete to `service_role`
  - revokes all from `anon`
- Idempotency:
  - Mostly idempotent.
  - Potential issue if index name already exists on another table; `IF NOT EXISTS` can skip creating the needed index on this table.
- References table before creating it:
  - No.
- `ON CONFLICT` before unique index:
  - No `ON CONFLICT` in this migration.

### 055_cost_price_monitor_group_overrides.sql

- Alters: `public.cost_price_monitor_overrides`
- Columns added if missing:
  - `group_key`
  - `main_name`
  - `color`
  - `supplier`
  - `category`
  - `product_group`
- Indexes:
  - unique `cost_price_monitor_overrides_group_key_uidx` on `(group_key)`
- Grants/revokes:
  - grants select/insert/update/delete to `service_role`
  - revokes all from `anon`
- Idempotency:
  - Not fully safe if the table does not exist.
  - `alter table if exists` is safe, but the later `update public.cost_price_monitor_overrides` is not guarded by `to_regclass` or dynamic SQL.
  - `alter column group_key set not null` can fail if null `group_key` rows exist.
  - unique index creation can fail if duplicates exist, or skip if the index name exists on a different table.
- References table before creating it:
  - Yes, if 054 did not create the table successfully.
- `ON CONFLICT` before unique index:
  - No `ON CONFLICT` in this migration.

### 056_fix_cost_price_monitor_override_group_key_unique.sql

- Alters/updates: `public.cost_price_monitor_overrides`
- Indexes:
  - unique `cost_price_monitor_overrides_group_key_uidx` on `(group_key)`
- Grants/revokes:
  - grants select/insert/update/delete to `service_role`
  - revokes all from `anon`
- Idempotency:
  - Not fully safe if table does not exist, because it starts with an unguarded `update public.cost_price_monitor_overrides`.
  - Does not deduplicate duplicate `group_key` rows before creating unique index.
  - Does not remove or handle blank/null group keys before `alter column group_key set not null`.
  - Index-name collision remains possible.
- References table before creating it:
  - Yes, if prior migrations did not create it.
- `ON CONFLICT` before unique index:
  - No `ON CONFLICT` in this migration.

### 057_cost_price_monitor_override_color.sql

- Alters: `public.cost_price_monitor_overrides`
- Columns:
  - adds `color text` if missing
- Grants/revokes:
  - grants select/insert/update/delete to `service_role`
  - revokes all from `anon`
- Idempotency:
  - Safe if table exists.
  - `alter table if exists` is safe if table is missing.
  - Grants/revokes on the table are not guarded by `if exists`; they can fail if table is missing.
- References table before creating it:
  - It does not create the table.
- `ON CONFLICT` before unique index:
  - No `ON CONFLICT`.

### 058_create_cost_price_monitor_overrides_table.sql

- Creates: `public.cost_price_monitor_overrides`
- Columns:
  - full canonical schema listed above
- Indexes:
  - unique `cost_price_monitor_overrides_group_key_uidx` on `(group_key)`
  - `cost_price_monitor_overrides_updated_at_idx` on `(updated_at desc)`
- Data migration:
  - If `public.cost_price_overrides` exists, copies group-keyed rows into `public.cost_price_monitor_overrides`.
  - Uses `distinct on (btrim(group_key))` to dedupe legacy rows before insert.
  - Uses `on conflict (group_key) do update`.
- Grants/revokes:
  - grants select/insert/update/delete to `service_role`
  - revokes all from `anon`
- Idempotency:
  - Intended to be idempotent.
  - Actual risk: unique index creation can be skipped if `cost_price_monitor_overrides_group_key_uidx` already exists on legacy `public.cost_price_overrides`.
  - If the unique index is skipped, the later `ON CONFLICT (group_key)` fails with `42P10`.
- References table before creating it:
  - Creates canonical table before using it.
  - Checks legacy table with `to_regclass` before copying.
- `ON CONFLICT` before unique index:
  - In file order, no. The unique-index statement appears before the copy block.
  - In actual DB behavior, the unique index may still not exist on the target if the index name collided and `IF NOT EXISTS` skipped it.

## Table-name mismatch

### Does code use `cost_price_monitor_overrides`?

Yes. Preferred read and write paths use `cost_price_monitor_overrides`.

### Does code still reference `cost_price_overrides`?

Yes. It is used as a legacy fallback for reads and for writes only if the canonical table is missing from the schema cache.

### Does SQL/migration use `cost_price_overrides`?

Yes, only as a legacy source in migration 058.

### Is there a migration that copies old table data to new table?

Yes. Migration 058 copies from `public.cost_price_overrides` to `public.cost_price_monitor_overrides`.

### Is the old table optional or required?

The old table should be optional after canonical migration succeeds. Today, the live read-only check shows it is still the only readable override table in this environment, so it is currently required for recovering existing saved values until canonical migration completes.

## Group key audit

`group_key` is generated in `src/lib/cost-price-monitor.ts`:

```ts
function groupKey(mainName: string, color: string) {
  return `${normalizeGroupKeyPart(mainName)}::${normalizeGroupKeyPart(color)}`;
}
```

This means it includes:

- Main Name / Product Family
- Color

The normalizer lowercases, strips size suffixes, removes non-alphanumeric separators, trims, and hyphenates whitespace. This should be stable across reloads as long as the source `mainName` and `color` resolve the same way.

Manual override forms submit the same row `groupKey` rendered in the table:

```tsx
<input name="groupKey" type="hidden" value={row.groupKey} />
```

The save action maps it to:

```ts
group_key: groupKey
```

Old main-name-only overrides:

- The current reader can still read legacy rows if their `group_key` matches the current row group key.
- If older rows used a main-name-only key that no longer matches `main-name::color`, they will not attach to current grouped rows.
- The current migration 058 only copies rows; it does not translate main-name-only keys into new color-specific keys.
- A fallback mapping would require a separate, careful data-mapping plan using SKU or product metadata.

## Manual override display audit

Current table row calculation:

- `manual_purchase_price` overrides `Latest purchase / unit` through `displayCost(latestPurchase.actual, manual.manualPurchasePrice)`.
- `manual_landed_cost` is treated as add-on through `displayLandedCost(latestLanded.actual, latestPurchasePrice, manual.manualLandedCost)`.
- `manual_selling_price` overrides selling price through `displayCost(sellingAverage, manual.manualSellingPrice)`.
- Margin uses effective values:
  - `costBasis` prefers effective latest landed, then effective latest purchase, then averages.
  - `marginPct = (sellingPrice - costBasis) / sellingPrice * 100`.
- Inputs use `defaultValue={row.manualPurchasePrice ?? ""}`, `defaultValue={row.manualLandedCost ?? ""}`, `defaultValue={row.manualSellingPrice ?? ""}`, and `defaultValue={row.note}`. If saved rows load from DB, inputs remain filled after refresh.

The display logic is consistent with the user requirement. The persistence failure is DB/migration state, not display formula.

## Save All Overrides audit

`Save All Overrides` lives in `manual-override-form.tsx` and submits one server action:

```ts
saveCostPriceOverridesAction(formData)
```

Payload behavior:

- Tracks dirty rows via hidden `dirtyGroupKey` inputs.
- Per-row buttons submit `saveGroupKey`.
- Server action targets either `saveGroupKey` or dirty `groupKey` rows.
- Payload includes:
  - `group_key`
  - `main_name`
  - `color`
  - `supplier`
  - `category`
  - `product_group`
  - `manual_purchase_price`
  - `manual_landed_cost`
  - `manual_selling_price`
  - `note`
  - `updated_by`
  - `updated_at`
- Preferred upsert uses `cost_price_monitor_overrides` and `onConflict: "group_key"`.
- Fallback upsert uses `cost_price_overrides` and `onConflict: "group_key"` if preferred table is missing.

Errors:

- Validation errors redirect back with `overrideError`.
- Preferred-table non-missing errors are logged and shown as `Confirm migration 058 has created cost_price_monitor_overrides`.
- Preferred missing-table errors attempt legacy fallback.
- Legacy fallback errors are logged and shown.

Why it shows Migration required:

- `overrideReady` comes from the preferred table query or legacy table query.
- If both canonical and legacy override queries fail, warning is added: `Manual overrides table is not available yet. Apply migration 058 for Cost Price Monitor overrides.`
- The page disables Save All/per-row buttons when `data.overrideReady` is false.

In the live read-only check, legacy table is readable, so current code should mark `overrideReady = true` unless the deployed app does not yet include the fallback code or the legacy query fails in the deployed environment.

## Print/export audit

### Print Wholesale Catalog

Print uses `getCostPriceMonitorData({ exportAll: true, ...params })`, so it receives the same effective row values as the table.

Print cost behavior:

- Latest purchase uses `row.latestPurchasePrice`, which already includes manual purchase override.
- Estimated landed add-on uses `row.manualLandedCost` if present; otherwise print-level `estimatedLandCost`.
- Estimated cost is `latest purchase + landed add-on`.
- Sales price uses `row.sellingPrice`, which includes manual selling override.
- Margin uses estimated cost and effective sales price.

### Export Excel

Export uses `getCostPriceMonitorData({ exportAll: true, ...filters })`.

Export columns include:

- `Latest purchase / unit` as `row.latestPurchasePrice`
- `Latest landed / unit` as `row.latestLandedCost`
- `Manual purchase override`
- `Manual landed add-on`
- `Manual selling override`
- `Selling price`
- `Margin %`

Export uses effective values from the shared row model, not stale raw system values.

## Reorder Planning visibility/status audit

Existing Reorder Planning Active/Hidden column:

```sql
purchasing_decision_controls.hide_from_purchasing
```

Evidence:

- Migration 005 creates `hide_from_purchasing boolean not null default false`.
- `src/app/purchasing-decision/actions.ts` saves `hide_from_purchasing: hiddenSkus.has(sku)`.
- `src/lib/purchasing-decision-data.ts` reads it and computes `hidden = Boolean(control?.hide_from_purchasing)`.

Cost Price Monitor currently reads:

```ts
"sku,product_name_override,main_name_override,supplier_override,tags_override,hide_from_purchasing"
```

Cost Price Monitor currently uses Reorder Planning metadata for:

- `main_name_override`
- `product_name_override`
- `supplier_override`
- `tags_override`
- `hide_from_purchasing`

Supplier/category/product group behavior:

- Supplier uses Reorder Planning `supplier_override` when present.
- Category/Product Group are derived from Reorder Planning `tags_override` when present; otherwise Shopify product tags filtered through Purchasing Setup active tags.
- Main Name uses Reorder Planning `main_name_override` when present.
- Color is still computed from variant/options/SKU/title, not directly from Reorder Planning.

Visibility behavior currently implemented in code:

- Missing control rows are treated as active.
- Group is active if at least one SKU in Main Name + Color group is active.
- Group is hidden only when all SKUs in the group are hidden.
- Default Cost Price Monitor visibility filter is active only.
- Print/export receive the same visibility filter through `getCostPriceMonitorData`.

## Old manual values recovery

The live read-only check confirms existing old manual override values are DB-saved, not browser-only:

```json
{
  "table": "cost_price_overrides",
  "readable": true,
  "count": 34,
  "rowsWithGroupKey": 34,
  "rowsWithSkuOnly": 0,
  "rowsWithManualPurchase": 5,
  "rowsWithManualLanded": 0,
  "rowsWithManualSelling": 29,
  "rowsWithNote": 0
}
```

The canonical table was not readable:

```json
{
  "table": "cost_price_monitor_overrides",
  "readable": false,
  "errorCode": "PGRST205"
}
```

Because all legacy rows have `group_key`, they should be recoverable into the canonical table if their keys match current Main Name + Color group keys. Values that were only typed into browser inputs and never saved to either table cannot be recovered.

## Recommended safe SQL plan

Do not apply this blindly without reviewing in Supabase SQL editor. This is the recommended order.

### 1. Inspect index/table state

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and (
    tablename in ('cost_price_overrides', 'cost_price_monitor_overrides')
    or indexname = 'cost_price_monitor_overrides_group_key_uidx'
  )
order by tablename, indexname;
```

### 2. Create canonical table if missing

```sql
create extension if not exists "pgcrypto";

create table if not exists public.cost_price_monitor_overrides (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  main_name text,
  color text,
  supplier text,
  category text,
  product_group text,
  manual_purchase_price numeric,
  manual_landed_cost numeric,
  manual_selling_price numeric,
  note text,
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 3. Add missing columns safely

```sql
alter table public.cost_price_monitor_overrides
  add column if not exists group_key text,
  add column if not exists main_name text,
  add column if not exists color text,
  add column if not exists supplier text,
  add column if not exists category text,
  add column if not exists product_group text,
  add column if not exists manual_purchase_price numeric,
  add column if not exists manual_landed_cost numeric,
  add column if not exists manual_selling_price numeric,
  add column if not exists note text,
  add column if not exists updated_by text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
```

### 4. Normalize and inspect duplicate canonical keys

```sql
update public.cost_price_monitor_overrides
set group_key = btrim(group_key)
where group_key is not null and group_key <> btrim(group_key);

select group_key, count(*)
from public.cost_price_monitor_overrides
group by group_key
having count(*) > 1;
```

### 5. Dedupe canonical table before adding unique index

Recommended dedupe policy: keep newest `updated_at`, then newest `created_at`, then arbitrary `id`.

```sql
with ranked as (
  select
    id,
    row_number() over (
      partition by group_key
      order by updated_at desc nulls last, created_at desc nulls last, id
    ) as rn
  from public.cost_price_monitor_overrides
  where group_key is not null and btrim(group_key) <> ''
)
delete from public.cost_price_monitor_overrides target
using ranked
where target.id = ranked.id
  and ranked.rn > 1;
```

### 6. Enforce not-null/nonblank group key

```sql
delete from public.cost_price_monitor_overrides
where group_key is null or btrim(group_key) = '';

alter table public.cost_price_monitor_overrides
  alter column group_key set not null;
```

### 7. Fix index-name collision safely

First inspect whether the desired index name is attached to the wrong table.

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname = 'cost_price_monitor_overrides_group_key_uidx';
```

If it is on `cost_price_overrides`, do not rely on `IF NOT EXISTS` with the same name. Prefer creating a differently named unique index on the canonical table:

```sql
create unique index if not exists cost_price_monitor_overrides_group_key_unique
  on public.cost_price_monitor_overrides (group_key);
```

Alternatively, after confirming no app/migration depends on the old index name on the legacy table, drop the wrong-table index and recreate the expected one:

```sql
drop index if exists public.cost_price_monitor_overrides_group_key_uidx;

create unique index cost_price_monitor_overrides_group_key_uidx
  on public.cost_price_monitor_overrides (group_key);
```

The differently named index is lower risk because `ON CONFLICT (group_key)` does not care about the index name; it only needs any matching unique index/constraint on the target table.

### 8. Migrate old table data after the canonical unique index exists

```sql
insert into public.cost_price_monitor_overrides (
  group_key,
  main_name,
  color,
  supplier,
  category,
  product_group,
  manual_purchase_price,
  manual_landed_cost,
  manual_selling_price,
  note,
  updated_by,
  created_at,
  updated_at
)
select distinct on (btrim(group_key))
  btrim(group_key),
  main_name,
  color,
  supplier,
  category,
  product_group,
  manual_purchase_price,
  manual_landed_cost,
  manual_selling_price,
  note,
  updated_by::text,
  coalesce(created_at, now()),
  coalesce(updated_at, now())
from public.cost_price_overrides
where group_key is not null and btrim(group_key) <> ''
order by btrim(group_key), updated_at desc nulls last
on conflict (group_key) do update set
  main_name = excluded.main_name,
  color = excluded.color,
  supplier = excluded.supplier,
  category = excluded.category,
  product_group = excluded.product_group,
  manual_purchase_price = excluded.manual_purchase_price,
  manual_landed_cost = excluded.manual_landed_cost,
  manual_selling_price = excluded.manual_selling_price,
  note = excluded.note,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at
where public.cost_price_monitor_overrides.updated_at is null
   or excluded.updated_at >= public.cost_price_monitor_overrides.updated_at;
```

If old table columns differ, use the dynamic-column strategy from migration 058 or manually adapt column references after inspecting `information_schema.columns`.

### 9. Grants

```sql
grant select, insert, update, delete on table public.cost_price_monitor_overrides to service_role;
revoke all on table public.cost_price_monitor_overrides from anon;
```

### 10. Refresh/check PostgREST schema cache

After SQL succeeds, verify from the app/API or Supabase table editor that `public.cost_price_monitor_overrides` is visible. If PostgREST still returns schema-cache errors, trigger a schema cache reload or wait for Supabase to refresh it.

## Recommended code changes, not implemented in this audit

No code changes were made in this audit.

Recommended future changes:

1. Remove legacy write fallback after canonical table is confirmed deployed and data copied.
2. Keep legacy read fallback temporarily for recovery, then remove after a deprecation period.
3. Add a clearer admin warning distinguishing:
   - canonical table missing,
   - canonical unique index missing,
   - legacy fallback active.
4. Consider a one-time report that lists legacy `group_key` rows that do not match current Main Name + Color group keys.
5. In migration 058, avoid using an index name that may have been used on the old table, or explicitly validate the index belongs to the canonical table before the `ON CONFLICT` copy step.

## Risk level

Risk level: High for save/persistence until the canonical table and unique index are fixed.

Reasons:

- Manual override saves depend on `ON CONFLICT (group_key)`.
- Missing unique index prevents canonical migration copy and app upserts.
- The app page can disable saving when neither canonical nor legacy table is readable.
- Existing DB-saved values are recoverable, but only if the old table is preserved until migration is completed.

Risk level after safe migration: Low to Medium.

- The override table is separate from PO history.
- Manual override logic does not overwrite PO items or historical costs.
- Main remaining risk is old key compatibility if legacy keys do not match current Main Name + Color grouping.

## Exact next-step checklist

1. In Supabase SQL editor, inspect indexes for both override tables.
2. Confirm whether `cost_price_monitor_overrides_group_key_uidx` exists on the old table.
3. Create/repair `public.cost_price_monitor_overrides`.
4. Add all required columns.
5. Normalize and dedupe canonical `group_key` values.
6. Create a unique index on `public.cost_price_monitor_overrides(group_key)`. Use a new safe index name if the old expected name is already attached elsewhere.
7. Copy group-keyed rows from `public.cost_price_overrides` into `public.cost_price_monitor_overrides`.
8. Grant service-role permissions and revoke anon access.
9. Confirm `public.cost_price_monitor_overrides` is visible through Supabase/PostgREST.
10. Confirm Cost Price Monitor no longer shows "Manual overrides table is not available yet".
11. Confirm Save All Overrides is enabled.
12. Save a manual purchase override and refresh.
13. Save a manual landed add-on and refresh.
14. Save a manual selling override and refresh.
15. Confirm table, print, and export use effective values.

## Verification commands run

Reference searches:

```powershell
rg -n "cost_price_overrides|cost_price_monitor_overrides|group_key|onConflict|manual_purchase_price|manual_landed_cost|manual_selling_price|hide_from_purchasing" src\app\cost-price-monitor src\app\api\cost-price-monitor src\lib\cost-price-monitor.ts supabase\migrations
rg -n "cost_price_overrides|cost_price_monitor_overrides" supabase\migrations src
rg -n "group_key|onConflict" src\app\cost-price-monitor src\app\api\cost-price-monitor src\lib\cost-price-monitor.ts supabase\migrations
```

Read-only live table check:

```text
cost_price_monitor_overrides: PGRST205, not found in schema cache
cost_price_overrides: readable, 34 rows, all group-keyed
```

Build/check commands:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Results are recorded in the assistant turn that created this report.
