# Control Room Dashboard Audit

Audit date: 2026-05-26, Asia/Bangkok  
Scope: audit/report only. No dashboard implementation changes were made.

## Executive Summary

The Control Room Dashboard is the Next.js App Router page at `/dashboard`. It is a server-rendered, force-dynamic page backed by Supabase service-role queries against local read-model tables/views.

The PO Overview numbers currently reconcile to the database query logic:

| Metric | Displayed | Reconciled source result | Status |
| --- | ---: | ---: | --- |
| Open POs | 239 | 239 open `po_order_summary` rows | Reconciles |
| In Production | 23 | 23 `work_status = inpro` rows | Reconciles |
| Ready to Ship | 3 | 3 `work_status = final_payment` rows | Reconciles |
| In Transit | 1 | 1 `work_status = delivery` row | Reconciles |
| Receiving Pending | 33 | 33 open rows with `total_outstanding_qty > 0` | Reconciles, but broad |
| Outstanding Qty | 17,335 | `active_incoming_total 17,335 + pending_approval_total 0` | Reconciles |
| Open PO Value | THB 32,206,986 | Sum of 239 open `po_amount_thb` rows = 32,206,986.055 | Reconciles |

The biggest correctness issue is the Shopify Sync Status block. It labels the block "Last Shopify Sync", but it reads the newest `sync_runs` row across all sources, not the paired daily sync or a specific source. In the current data, the newest row is `shopify_orders_sales_lines`, so product, variant, and inventory counts show `0` even though the paired `shopify_products_inventory` job completed seconds later with `255` products, `1,348` variants, and `2,650` inventory rows. The "Orders / sales lines" value is also misleading: it displays `orders_seen` first (`412`) and only falls back to `sales_lines_seen` (`906`) if orders are null.

Risk highlights:

| Risk | Level | Summary |
| --- | --- | --- |
| Sync status mixes independent job sources | Critical | Product/inventory counts can display as zero after a successful catalog sync. |
| "Last Shopify Sync" can report an incomplete partial source | Critical | A failed or stale catalog sync can be hidden by a successful sales-line sync. |
| Dashboard uses service-role data for executive/dashboard-only users | High | Non-super-admin dashboard users can see financial values. |
| Header buttons are not role-tailored | High | Dashboard-only users see links to `/po` and `/dashboard/legacy` even if those routes reject them. |
| Action-list links are too generic | Medium | Alerts link to `/po`, not filtered destinations. |
| Error fallback can show misleading zero values | Medium | Query errors become `0` plus a warning section lower on the page. |

## Files Inspected

| File | Purpose |
| --- | --- |
| `src/app/dashboard/page.tsx` | `/dashboard` route, server component, UI layout, card definitions. |
| `src/lib/po-dashboard.ts` | All Dashboard data queries, calculations, warnings, action-list construction. |
| `src/app/po/sidebar-nav.tsx` | Child server component for the left navigation. |
| `src/app/account-menu.tsx` | Global account role display through app layout. |
| `src/lib/auth.ts` | Cookie auth, user profile lookup, active-user gating. |
| `src/lib/role-nav.ts` | Dashboard/legacy/PO access rules and nav items. |
| `src/lib/access-control.ts` | Email-based access roles and operation gating. |
| `src/lib/supabase/server.ts` | Supabase service-role client factory. |
| `src/lib/sync/shopify-orders.ts` | Sales-line sync source and `sync_runs` stats writes. |
| `src/lib/sync/shopify-products.ts` | Product/inventory sync source and `sync_runs` stats writes. |
| `src/app/api/sync/daily/route.ts` | Daily sync runs product/inventory and sales-line jobs in parallel. |
| `supabase/migrations/001_phase1_shopify_read_model.sql` | `products`, `product_variants`, `inventory_snapshots`, `sync_runs`. |
| `supabase/migrations/002_phase1_sales_lines.sql` | `sales_lines` and sales-line sync columns. |
| `supabase/migrations/019_shopify_sales_sync_reliability.sql` | Additional sales sync counters/locks. |
| `supabase/migrations/023_po_page_optimization.sql` | `po_order_summary`, `po_portal_metrics`, payment summary logic. |
| `supabase/migrations/042_po_incoming_eta_active_filter.sql` | Active ETA views and missing ETA logic. |

## Page Location

Route: `/dashboard`  
Page file: `src/app/dashboard/page.tsx`

The page is an async server component. It has no `"use client"` directive and exports `dynamic = "force-dynamic"`, so each request renders dynamically and bypasses static caching.

Child components/functions used directly:

| Component/function | File | Notes |
| --- | --- | --- |
| `PoSidebarNav` | `src/app/po/sidebar-nav.tsx` | Async server component. Reads current user again and builds role-aware nav. |
| `SummaryCard` | `src/app/dashboard/page.tsx` | Local presentational component. |
| `SummaryPill` | `src/app/dashboard/page.tsx` | Local presentational component for sync counters. |
| `DashboardSection` | `src/app/dashboard/page.tsx` | Local section wrapper. |
| `AccountMenu` | `src/app/account-menu.tsx` | Global layout component, displays `Account: <role>`. |

Data access shape:

| Type | Used? | Evidence |
| --- | --- | --- |
| Server components | Yes | `DashboardPage` and `PoSidebarNav` are async server components. |
| Client components | No direct dashboard client component | Dashboard has no client directive or browser-side fetching. |
| API routes for dashboard render | No | Page calls `getPoDashboardData()` directly. |
| RPC calls for dashboard render | No | Dashboard queries tables/views directly. Sync code uses lock RPCs, but render does not. |
| Supabase queries | Yes | `getPoDashboardData()` uses service-role Supabase client. |
| Local read-model views/tables | Yes | `po_order_summary`, `po_portal_metrics`, `po_incoming_eta_events`, `sync_runs`, etc. |
| Mock/hardcoded metric data | No for displayed metrics | Fallback zeros exist when Supabase is unavailable or queries error. |

## Data Sources Inspected

| Source | Type | Used for |
| --- | --- | --- |
| `sync_runs` | Table | Sync status, last run, last success, counts, error message. |
| `po_portal_metrics` | View | Outstanding quantity and payment totals. |
| `po_order_summary` | View | PO status counts, receiving pending, open value, line counts. |
| `po_payments` | Table | Overdue/due payment counts, missing FX, Xero status counts. |
| `po_receipts` | Table | Recent receipts and last goods receipt. |
| `po_incoming_eta_events` | View | Arriving soon, late ETA, next expected arrival. |
| `po_incoming_eta_unscheduled_events` | View | Missing ETA/no ETA alert. |

## Metric-by-Metric Findings

### Shopify Sync Status

Current live latest `sync_runs` rows:

| Source | Started UTC | Finished UTC | Status | Products | Variants | Inventory rows | Orders | Sales lines |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| `shopify_orders_sales_lines` | 2026-05-25 22:17:36 | 2026-05-25 22:17:47 | completed | 0 | 0 | 0 | 412 | 906 |
| `shopify_products_inventory` | 2026-05-25 22:17:36 | 2026-05-25 22:18:10 | completed | 255 | 1,348 | 2,650 | 0 | 0 |

| UI field | Source/query | Current value explanation | Finding |
| --- | --- | --- | --- |
| Source | `sync_runs.order(started_at desc).limit(1)` | `shopify_orders_sales_lines` because its `started_at` is 6 microseconds later than product sync | Misleading for whole Shopify sync. |
| Status | Latest row status mapped `completed -> success` | `success` | Correct for selected row only. |
| Last Run | `latestRun.finished_at ?? latestRun.started_at` | Sales-line finish time | Does not represent paired product/inventory job. |
| Last Success | Latest completed row by `finished_at desc` | Usually product/inventory row, because it finished later | Can come from a different source than Status/Source. |
| Duration | `duration_seconds` if present, else `finished_at - started_at` | The SELECT does not include `duration_seconds`, so computed from timestamps | Reliable only for selected latest row. |
| Products Synced | `latestRun.products_seen` | `0` because selected row is sales sync | Misleading; product job has `255`. |
| Variants Synced | `latestRun.variants_seen` | `0` because selected row is sales sync | Misleading; product job has `1,348`. |
| Inventory Rows | `latestRun.inventory_rows_seen` | `0` because selected row is sales sync | Misleading; product job has `2,650`. |
| Orders / Sales Lines | `orders_seen ?? sales_lines_seen` | `412`, not `906`, because `orders_seen` is non-null | Label combines two concepts but chooses orders first. |

Why source is `shopify_orders_sales_lines`: `src/lib/sync/shopify-orders.ts` defines `SALES_SYNC_SOURCE = "shopify_orders_sales_lines"` and writes that into `sync_runs.source`. The dashboard does not filter source; it picks the latest `started_at` row.

Why Products/Variants/Inventory are zero: the latest selected sales-line sync does not update `products_seen`, `variants_seen`, or `inventory_rows_seen`; those counters belong to `shopify_products_inventory`.

Why Orders / Sales Lines is `412`: the latest selected row has `orders_seen = 412` and `sales_lines_seen = 906`; dashboard code uses `orders_seen` first.

Reliability findings:

| Question | Answer |
| --- | --- |
| Is the sync status reporting the correct sync job? | It reports one latest row, not the daily Shopify sync as a combined operation. |
| Is it only one partial sync source? | Yes, currently the selected source is the sales-line half of daily sync. |
| Are Last Run/Last Success reliable? | Individually yes for row timestamps, but inconsistent because Last Run and Last Success can refer to different sources. |
| Are failed/partial syncs represented correctly? | Not across the combined daily sync. A failed product sync can be masked by a successful sales sync, or vice versa. |
| Is "Last Shopify Sync" accurate? | No. Better label would be "Latest Shopify Sync Run" if keeping this logic, or better split into "Catalog/Inventory Sync" and "Orders/Sales Sync". |

### PO Overview

| Metric | Formula/query | Included statuses | Excluded statuses | Pending approval included? | Current reconciliation |
| --- | --- | --- | --- | --- | ---: |
| Open POs | Count `po_order_summary` where `closed_at is null`, `cancelled_at is null`, `work_status not in (closed,cancelled,canceled)` | `unknown`, `inpro`, `final_payment`, `delivery`, any non-closed/cancelled status | `closed`, `cancelled`, `canceled`, any row with close/cancel timestamp | Count includes waiting approval if present | 239 |
| In Production | Count open rows where `work_status = inpro` | `inpro` | Closed/cancelled rows | No separate pending logic | 23 |
| Ready to Ship | Count open rows where `work_status = final_payment` | `final_payment` | Closed/cancelled rows | No separate pending logic | 3 |
| In Transit | Count open rows where `work_status = delivery` | `delivery` | Closed/cancelled rows | No separate pending logic | 1 |
| Receiving Pending | Count rows where `total_outstanding_qty > 0`, `closed_at is null`, `cancelled_at is null` | Any open status, including `unknown` | Only close/cancel timestamps; does not exclude closed work_status text | Not specifically; total outstanding includes all line statuses | 33 |
| Outstanding Qty | `po_portal_metrics.active_incoming_total + pending_approval_total` | Active incoming and pending approval lines from read model | Depends on view logic | Yes | 17,335 |
| Open PO Value | Fetch up to 2,000 open `po_order_summary` rows and sum `po_amount_thb` in JS | Same as Open POs | Same as Open POs | Not a quantity metric | 32,206,986.055 -> THB 32,206,986 |

Status reconciliation from live data:

| `work_status` | Total rows | Open rows | Outstanding rows | Open value THB | Active incoming qty |
| --- | ---: | ---: | ---: | ---: | ---: |
| `unknown` | 212 | 212 | 11 | 24,061,113.86 | 0 |
| `inpro` | 23 | 23 | 21 | 6,363,097.453 | 16,915 |
| `final_payment` | 3 | 3 | 0 | 1,595,434.876 | 0 |
| `delivery` | 1 | 1 | 1 | 187,339.866 | 420 |
| `cancelled` | 10 | 0 | 0 | 0 | 0 |
| `closed` | 12 | 0 | 0 | 0 | 0 |

Formula notes:

`po_order_summary` is built from `po_orders`, `po_items`, `po_item_receipt_totals`, and payment summaries. Its `active_incoming_qty` uses `is_po_line_active_incoming(...)`; `pending_approval_qty` requires both line and order statuses normalized to `waiting_for_approve`.

Currency/FX handling:

Open PO Value does not do live conversion. It sums stored `po_order_summary.po_amount_thb`, which is sourced from `po_orders.po_amount_thb`. If imported/stored THB values are stale, missing, or calculated with old FX, the dashboard inherits that. No missing-FX guard is applied to PO header value.

Suspicious PO logic:

| Issue | Risk | Detail |
| --- | --- | --- |
| `Receiving Pending` does not exclude `work_status` values `closed/cancelled/canceled` by text | Medium | It excludes only `closed_at`/`cancelled_at`. If status text is closed but timestamp missing, it can count. |
| `Open POs` includes `unknown` status | Medium | 212 of 239 open POs are `unknown`; that may be expected from imported legacy data, but it makes "Open POs" less operationally precise. |
| `Open PO Value` has a 2,000 row client-side cap | Medium | If exactly 2,000 rows are fetched, value becomes `N/A`; currently only 239 rows, so it is safe now. |
| `planned_amount_thb` in `po_portal_metrics` is not filtered to open POs | Medium | Payment Overview planned total may include closed/cancelled POs, unlike paid total. |

### Action List

| Alert | Source | Rule/condition | Current count | Link | Wording/edge cases |
| --- | --- | --- | ---: | --- | --- |
| Overdue payments | `po_payments` | `payment_status ilike planned` and `due_date < today` | 3 | `/po` | Accurate if `due_date` is populated. Does not exclude closed/cancelled PO parents. |
| Missing FX | `po_payments` | `currency != THB` and `exchange_rate <= 1` | 1 | `/po` | Misses null exchange rates because SQL `lte` does not match null. Case-sensitive currency compare can count `thb` as foreign. |
| Xero tracking open | `po_payments` | `xero_status = pending` plus `xero_status = draft` | 87 pending, 0 draft | `/po` | Accurate for row statuses. Does not exclude void/closed/cancelled parent POs. |
| Missing ETA | `po_incoming_eta_unscheduled_events` | Active incoming pipeline line with null ETA | 11 | `/po` | View only includes `inpro`/`delivery` line and PO status, so waiting/final-payment rows are excluded. |
| Receiving pending | `po_order_summary` | `total_outstanding_qty > 0`, open timestamps | 33 | `/po` | Count is PO-level. Can include `unknown` open POs and potentially status-text closed rows with missing timestamps. |
| Payments due this week | `po_payments` | `planned`, `due_date >= today`, `due_date <= today + 7` | 4 | `/po` | Inclusive 8 local dates counting today through day 7. Does not exclude closed/cancelled parent POs. |

All action-list links are clickable when an `href` exists, but they all point to the unfiltered PO Portal. Users must manually find the issue. Each alert should ideally link to a filtered tab/anchor/query such as payments overdue, missing FX, Xero pending/draft, missing ETA, or receiving pending.

## Permissions / Role Behavior

Dashboard access:

| Role/path | Access to `/dashboard` |
| --- | --- |
| `super_admin` profile role | Yes |
| Email-based `executive_readonly` | Yes |
| Email-based `dashboard_only` | Yes, but the configured set is currently empty |
| `accounting`, `final_approver`, `preliminary_approver`, `reviewer`, `retail_manager`, `viewer` | No unless their email maps to executive/dashboard-only |
| `incoming_eta_viewer` email role | No |

Sensitive data exposure:

The dashboard uses a Supabase service-role client, so database RLS is bypassed server-side. Access depends entirely on app-level gating in `canAccessDashboard`. Executive read-only and future dashboard-only users can see Open PO Value, planned/paid payment totals, overdue payment counts, missing FX, and Xero counts.

Button gating:

| Button/link | Current behavior |
| --- | --- |
| Header `PO Portal` | Always shown to anyone who can access Dashboard. `/po` itself allows super admin/executive read-only and incoming ETA viewers, but not dashboard-only. |
| Header `Legacy Dashboard` | Always shown to anyone who can access Dashboard. `/dashboard/legacy` allows super admin/executive read-only only. Dashboard-only users would hit access denied. |
| Sidebar nav | Role-aware through `navItemsForUser`; dashboard-only would only see Dashboard in sidebar. |

Recommendation: if dashboard-only or executive roles are intended, the dashboard should either hide sensitive financial cards by role or use a dedicated sanitized summary. Header buttons should follow the same role-aware logic as the sidebar.

## UI/UX Audit

Strengths:

- The page has a clear operational hierarchy: sync/action summary first, then PO, payment, receiving, and ETA cards.
- Color tones are generally meaningful: red for overdue/failure, yellow for attention, green for healthy, blue for informational.
- The responsive card grid is simple and likely stable across common desktop widths.

Issues:

| Issue | Risk | Notes |
| --- | --- | --- |
| Sync block has misleading labels | High | "Last Shopify Sync" reads as whole-system status but reports one source row. |
| Sync counters mix unrelated jobs | High | Products/variants/inventory and orders/sales lines should not share one selected row. |
| Action List click affordance is weak | Medium | Cards are clickable links but look like static status blocks. |
| Action links are not filtered | Medium | Users land on `/po` without the relevant alert context. |
| Large empty space risk | Low | The left sync card spans more width than its content needs on wide screens. |
| Mobile sidebar is hidden | Medium | No replacement mobile nav is visible in this component; global account menu may be the only navigation. |
| Long currency/card values | Low | `THB 32,206,986` fits now, but cards with larger numbers may crowd icon/detail text. |
| Technical source label | Low | `shopify_orders_sales_lines` is useful for developers but unclear for non-technical users. |

## Performance Audit

Render query count:

`getPoDashboardData()` issues 22 Supabase operations inside one `Promise.all`, so the dashboard data queries run in parallel rather than as a waterfall. `DashboardPage` also calls `requireUser()`, and `PoSidebarNav` calls `getCurrentUserProfile()` again, causing duplicated auth/profile reads.

Query categories:

| Query group | Count |
| --- | ---: |
| Sync latest/latest success | 2 |
| PO metrics/read-model value/counts | 7 |
| Payment counts | 6 |
| Receipt queries | 2 |
| ETA queries | 4 |
| Metrics singleton | 1 |
| Total dashboard data queries | 22 |

Performance findings:

| Finding | Risk | Detail |
| --- | --- | --- |
| Queries are parallelized | Low | Good; no major waterfall inside dashboard data. |
| Many separate count queries | Medium | Supabase/PostgREST overhead is higher than a consolidated SQL view/RPC. |
| Client-side sum of open PO values | Medium | Currently only 239 rows, but this should be aggregated in SQL. |
| Force dynamic means no Next cache | Medium | Correct for live dashboard, but every request hits Supabase. |
| No heavy client-side calculation | Low | All work is server-side; browser only renders HTML. |
| Duplicate user/profile lookup | Low | Page and sidebar both read current user. |

Recommended performance direction: create one dashboard read-model view or RPC that returns PO/payment/ETA aggregates in a single database round trip, plus separate sync status rows by source.

## Reliability / Empty State Audit

| Condition | Current behavior | Risk |
| --- | --- | --- |
| Supabase service client missing | Returns all zeros/nulls plus "Database connection missing" action item | Acceptable, but many zeros could still be scanned as real. |
| Individual Supabase query error | Count helper returns `0` and pushes warning | Medium: top cards show zero before user notices warning at bottom. |
| `po_portal_metrics` empty/error | `toNumber(undefined)` becomes `0` | Medium: missing read model looks like no activity. |
| `sync_runs` empty | Shows unknown/N/A plus unavailable action item | Good. |
| FX missing as null | `exchange_rate <= 1` does not count null | High for Missing FX accuracy. |
| Open PO Value query error | Shows `N/A` and warning | Good. |
| 2,000 open PO rows | Shows `N/A` because cap reached | Safe, but arbitrary and should be SQL aggregate. |
| Null formatted dates | Shows `N/A` | Safe. |
| Null currency metric | `formatCurrency` handles null, but most missing numeric metrics are coerced to `0` | Medium. |

## Bugs or Suspicious Logic

| Issue | Risk | Evidence | Suggested fix |
| --- | --- | --- | --- |
| Sync status picks latest row across all sources | Critical | `sync_runs` query orders by `started_at` only and has no `.eq("source", ...)` | Split status by source or create daily sync summary keyed by run group. |
| Last Run and Last Success can refer to different sources | Critical | Latest run orders by `started_at`; latest success orders by `finished_at` across all sources | Compute per-source latest run/latest success. |
| Product/variant/inventory counts display zero after sales sync | Critical | Latest source is `shopify_orders_sales_lines` with product counters zero | Show catalog sync counters from `shopify_products_inventory`. |
| Orders / sales lines displays orders only | High | Code uses `orders_seen ?? sales_lines_seen` | Show separate "Orders seen" and "Sales lines upserted/seen" fields. |
| Missing FX misses null exchange rates | High | `.lte("exchange_rate", 1)` excludes null | Count `exchange_rate is null OR exchange_rate <= 1` for non-THB currencies. |
| Missing FX is case-sensitive for currency | Medium | `.neq("currency", "THB")` | Normalize currency with `upper(currency) <> 'THB'`. |
| Payment alerts do not join PO status | Medium | Queries count directly from `po_payments` | Exclude closed/cancelled parent POs unless accounting wants all rows. |
| Receiving pending can include status-text closed rows | Medium | Does not apply work_status exclusion used by Open POs | Apply same open work-status filter or rely consistently on timestamps. |
| Planned Total not filtered to open POs | Medium | `po_portal_metrics.planned_amount_thb` sums all payment rows | Align with "open PO" framing or relabel as all planned payments. |
| Header buttons not role-aware | High | Buttons always render for dashboard users | Gate or hide PO Portal/Legacy links by destination access. |
| Query errors display zeros | Medium | `countRows` returns `0` on error | Surface error state in affected card instead of zero. |

## Recommended Improvements

### Critical correctness issues

- Replace the single "Last Shopify Sync" logic with per-source status: Catalog/Inventory Sync and Orders/Sales Sync.
- Add a durable parent daily sync run/group if the UI needs to report `/api/sync/daily` as one combined operation.
- Show separate sync counters: products, variants, inventory rows, orders seen, sales lines seen, rows upserted, rows failed.
- Ensure stale/failed status is evaluated per required source, not across any latest success.

### High priority UX/data clarity improvements

- Rename "Last Shopify Sync" if keeping current logic; otherwise split into two clearly labeled cards.
- Make action-list cards visibly clickable and link to filtered destination states.
- Hide or adjust Dashboard financial metrics for `dashboard_only` or other limited roles.
- Gate header buttons with the same role logic used by the sidebar.
- Fix Missing FX counting for null rates and normalized currency.

### Medium priority performance improvements

- Consolidate dashboard aggregates into one SQL view/RPC, especially PO/payment counts and sums.
- Move Open PO Value aggregation into SQL instead of fetching up to 2,000 rows.
- Avoid duplicate user/profile lookup between `DashboardPage` and `PoSidebarNav`.
- Consider short server-side revalidation or app-level cache if live-to-the-second metrics are not needed.

### Nice-to-have polish

- Replace technical source names with human labels plus a smaller debug/source detail.
- Add count badges or chevrons to action-list items to clarify click behavior.
- Add role-aware explanatory text for read-only users.
- Make sync status denser on wide screens or use a two-column per-source layout.

## Next-Step Checklist

- [ ] Decide whether the dashboard should show one combined daily sync status or two independent Shopify sync statuses.
- [ ] Define the intended audience for financial cards: super admin only, executive read-only, dashboard-only, or all dashboard viewers.
- [ ] Fix Missing FX rule to include null exchange rates and normalized currency.
- [ ] Add filtered destination URLs for each action-list alert.
- [ ] Align Receiving Pending filter with Open PO filter.
- [ ] Decide whether payment alerts should exclude closed/cancelled PO parents.
- [ ] Move Open PO Value and card aggregates into a SQL view/RPC.
- [ ] Add explicit error states for failed metric queries instead of showing zero.
- [ ] Recheck responsive/mobile navigation for dashboard users.
