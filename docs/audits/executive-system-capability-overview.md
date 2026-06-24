# Executive System Capability Overview

Date: 2026-06-08  
Application audited: `purchasing-web`  
Scope: Codebase audit and executive capability report only. No code changes, refactors, or commits were made.

## 1. Executive Summary

This system is a purchasing and inventory control portal for managing product planning, purchase orders, supplier follow-up, incoming shipments, payment tracking, cost monitoring, and catalog preparation.

The website brings several purchasing workflows into one place:

- Management can see the health of open purchasing activity, payments, incoming goods, and Shopify syncs.
- Purchasing can create and track purchase orders from supplier planning through receiving.
- Accounting and approvers can manage payment requests and payment evidence.
- Warehouse users can view incoming goods and record receiving without accessing sensitive cost or payment controls.
- Management and accounting can monitor product cost, margin, stock, incoming quantity, and wholesale catalog outputs.
- Planning users can maintain reorder controls and prepare opening-buy plans for new products.

The system is more advanced than a simple PO tracker. It combines live Shopify read-model data, Supabase purchasing tables, payment approvals, receiving history, cost overrides, CSV exports, and print-ready documents. Several areas are production-ready, while some depend on completed Supabase migrations, clean product metadata, and manual CSV handoff rather than direct external-system upload.

## 2. What The System Can Do Now

### Dashboard / Control Room

- What it does: Gives management a high-level control room for purchase orders, payments, receiving, Shopify sync health, incoming ETA, and product size-mix cleanup.
- Who uses it: Management, super admins, executive read-only users.
- Example use case: A manager checks how many POs are open, which payments are overdue, and whether any incoming receiving is pending.
- Business benefit: Reduces time spent asking different teams for status updates and highlights urgent exceptions.

### PO Portal / Purchase Order Management

- What it does: Supports creating, viewing, managing, receiving, and tracking purchase orders, including line items, supplier references, payment schedules, and status history.
- Who uses it: Purchasing, management, accounting, warehouse for receiving-limited workflows.
- Example use case: Purchasing opens a PO, checks ordered quantities, supplier quotation, expected delivery, payment terms, receiving status, and related payment rows.
- Business benefit: Centralizes PO execution and reduces manual spreadsheet tracking.

### Payment Tracking And Approval Requests

- What it does: Tracks planned and paid PO payment rows, due dates, FX rates, THB paid amounts, Xero status, approval requests, approval packs, and accounting payment proof.
- Who uses it: Accounting, approvers, reviewers, retail review users, management.
- Example use case: Accounting checks which payments are due this week, submits a payment approval request, then records proof after payment.
- Business benefit: Improves payment control, approval traceability, and audit readiness.

### Incoming ETA / Receiving Monitoring

- What it does: Shows incoming PO quantities, ETA timing, supplier breakdowns, product summaries, outstanding receiving balances, and receiving workflows.
- Who uses it: Purchasing, warehouse, management.
- Example use case: Warehouse sees what is arriving in the next 7 days and records received quantities against PO lines.
- Business benefit: Improves coordination between purchasing and warehouse and reduces missed receiving follow-up.

### Reorder Planning

- What it does: Maintains SKU-level purchasing controls such as supplier, tags, safety stock, lead time, reorder point, target order quantity, hidden status, and order suggestions.
- Who uses it: Purchasing planners and management.
- Example use case: Purchasing filters active SKUs, reviews stock on hand and demand indicators, selects items, and creates a draft PO from selected reorder suggestions.
- Business benefit: Moves reorder decisions away from scattered spreadsheets and into a consistent planning view.

### Cost Price Monitor

- What it does: Compares product-family purchase cost, landed cost, selling price, stock, incoming goods, margin, latest PO status, and manual overrides.
- Who uses it: Management, accounting, selected admin users.
- Example use case: Management reviews cost and margin before setting wholesale prices, then saves manual overrides where historical cost is missing.
- Business benefit: Improves margin visibility and reduces pricing decisions based on incomplete cost data.

### Wholesale Catalog Print / Export

- What it does: Generates a print-ready wholesale catalog and catalog Excel export from selected or filtered cost-monitor products.
- Who uses it: Management and sales/catalog preparation users with cost-monitor access.
- Example use case: Lewis or Will selects supplier products and prints a catalog showing product images, stock, incoming ETA, cost, selling price, and margin.
- Business benefit: Speeds up catalog preparation while keeping product selection tied to current cost and stock information.

### New Product Planner

- What it does: Supports draft opening-buy planning for new products, comparable product search, quantity matrix planning, budget/coverage planning, and print output.
- Who uses it: Purchasing planners and management.
- Example use case: A planner creates a new product opening plan, selects comparable products, estimates demand, and prints the plan for review.
- Business benefit: Gives new product buying a structured planning workflow before PO creation.

### Purchasing Setup

- What it does: Maintains supplier master data, supplier contacts, supplier terms, lead/safety defaults, product scope, and purchasing tags.
- Who uses it: Purchasing admins and management.
- Example use case: Purchasing adds a supplier contact and updates lead time or payment term information used by planning workflows.
- Business benefit: Keeps supplier and planning metadata reusable across purchasing tools.

### Shopify Sync And CSV Outputs

- What it does: Reads Shopify product, inventory, order, and sales-line data into the system. Exports selected CSV files for manual use with Shopify or Xero.
- Who uses it: Admins, purchasing, accounting.
- Example use case: Admin syncs Shopify sales lines into the demand read model; accounting downloads a Xero CSV for manual import.
- Business benefit: Connects purchasing decisions to current product, inventory, and sales information while keeping external accounting/catalog handoff controlled.

## 3. Module-By-Module Capability Breakdown

### A. Dashboard / Control Room

The dashboard acts as a management control room. It summarizes open PO activity, Shopify sync health, payment risk, receiving risk, incoming ETA risk, and historical size-mix quality.

Current capabilities:

- Overall PO overview: open POs, in production, ready to ship, in transit, receiving pending, outstanding quantity, and open PO value.
- Shopify sync health: separate health cards for product/inventory sync and order/sales sync.
- Action list / needs attention: exception list for overdue payments, missing FX, pending Xero status, receiving delays, late ETA, missing ETA, and sync problems.
- PO status summary: active PO status groups across the purchasing flow.
- Payment alerts: overdue, due this week, due in the next 30 days, planned total, paid total, missing FX, and Xero status groups.
- Receiving alerts: POs waiting for receiving, outstanding quantity, outstanding lines, last goods receipt, and recent receiving.
- Incoming ETA alerts: arriving soon, late ETA, no ETA, and next expected arrival.
- Historical PO size mix overview: summarizes size distribution patterns for products such as glove oz, apparel sizes, shin guards, shorts, singlets, and related product families.
- Unknown cleanup queue: highlights PO lines where size mix parsing cannot classify the line confidently.

Example:

Management can quickly see how many POs are open, how many are in production, what payments are overdue, whether receiving is pending, and whether Shopify syncs are healthy.

Maturity: Ready, with data-quality cleanup needed for unknown size-mix rows.

### B. PO Portal / Purchase Order Management

The PO Portal is the operational purchasing workspace. It covers PO creation, active PO tracking, incoming ETA, payments, receiving, and detailed PO management.

Current capabilities:

- Create new purchase orders for authorized users.
- View active POs with supplier, status, amounts, comments, payment status, and incoming quantities.
- View and manage PO detail pages.
- Manage PO line items for draft/editable POs.
- Track PO status from draft through production, ready to ship, in transit, received, closed, or cancelled.
- Store supplier quotation/reference fields, supplier invoice/reference fields, estimated delivery, arrived date, actual received date, purpose/tag, and notes.
- Track receiving status by line item and record goods receipts.
- Show payment schedule rows related to a PO.
- Show payment approval request cards linked to PO payments.
- Record quick PO comments.
- Print supplier quote and goods receipt documents.
- Download Xero CSV and Shopify CSV from PO detail where available.
- Use a limited warehouse receiving view when the user should not see full PO financial detail.

Example:

Purchasing can open a PO, see ordered quantities, payment terms, supplier reference, expected delivery, receiving progress, payment rows, and related approval activity.

Maturity: Ready for core PO operations; some payment saving is still handled through application-side multi-step updates rather than a single database transaction.

### C. Payment Tracking

Payment tracking is embedded in PO detail pages, PO portal action lists, the dashboard, and the payment approval workflow.

Current capabilities:

- Payment schedule rows for PO payments.
- Planned and paid status.
- Due dates and payment timing alerts.
- Payment terms such as deposit, before shipment, after received, or after sale can be represented in payment rows.
- FX rate handling.
- THB paid calculation.
- Paid by, paid date, reference, and note fields.
- Xero status tracking: pending, draft, or uploaded.
- Payment approval request workflow for submitted payment rows.
- Accounting confirmation with proof upload or proof URL.
- Approval pack page for internal review and print.

Example:

The team can track deposit, before-shipment, after-received, and after-sale payments with due dates, FX conversion, paid proof, and approval status.

Maturity: Ready for structured tracking and approvals; Xero support is CSV/status tracking only, not direct Xero API upload.

### D. Incoming ETA / Receiving Monitoring

Incoming ETA and receiving monitoring are available through the PO Portal, PO detail pages, the dashboard, and catalog outputs.

Current capabilities:

- Incoming schedule by PO and supplier.
- ETA date and timing labels such as overdue, due today, in a number of days, or no ETA.
- Supplier breakdown.
- Product summary.
- Open balance quantities.
- Outstanding receiving quantity by PO line.
- Batch receiving workflow.
- Receipt history.
- Goods receipt print output.
- Database guard to prevent over-receiving against PO quantities.
- Incoming quantity and ETA visibility inside cost catalog outputs.

Example:

Warehouse and purchasing can see what is arriving soon and which POs still have outstanding receiving quantities.

Maturity: Ready, assuming incoming ETA views and receiving migrations are applied.

### E. Reorder Planning

The Reorder Planning route is named Purchasing Decision in the codebase. It is a SKU-level planning workbench that combines Shopify stock/sales read data with purchasing control fields.

Current capabilities:

- SKU/product planning table.
- Supplier, category, product group, and tag metadata.
- Active/hidden visibility controls for planning and catalog hygiene.
- Stock on hand and incoming quantity visibility.
- Sales and demand summary fields.
- Safety stock, lead time, order cycle, manual reorder point, target quantity, and order quantity controls.
- Stock alert and planning alert indicators.
- Bulk save for visible planning rows.
- Create PO from selected planning SKUs.
- Export filtered or all planning data to CSV.
- Overstock report print page.

Example:

Purchasing can maintain which products are active or hidden, assign suppliers and categories, review demand/stock signals, and use this data in other purchasing tools.

Maturity: Partial to Ready. The table and workflow exist, but reorder intelligence is rule/formula based and depends on clean Shopify data, supplier mappings, and applied planning-control migrations.

### F. Cost Price Monitor

The Cost Price Monitor is a management and accounting tool for product-family cost and margin review.

Current capabilities:

- Product family cost table grouped by main product name and color.
- Supplier filter.
- Category filter.
- Product group filter.
- PO status filter.
- Active/hidden visibility filter.
- Missing cost and low margin filters.
- Average purchase price.
- Latest purchase price.
- Average landed cost.
- Latest landed cost.
- Manual purchase cost override.
- Manual landed cost override.
- Manual selling price override.
- Notes against overrides.
- Margin percentage.
- Current stock quantity.
- Latest invoice/quote/PO status reference.
- Save one override or Save All Overrides.
- Print Wholesale Catalog.
- Export Excel.
- Export Catalog Excel.

Example:

Management can compare purchase cost, estimated landed cost, selling price, and margin for each product family before preparing wholesale pricing.

Maturity: Ready, with known dependency on the canonical override table migration and manual overrides for missing cost rows.

### G. Wholesale Catalog Print / Export

Wholesale catalog output is generated from the Cost Price Monitor and can use selected products or the current filtered product set.

Current capabilities:

- Print-ready catalog page.
- Product name/group.
- Product picture.
- Current stock quantity.
- Incoming PO quantity.
- Total available quantity including incoming.
- Latest purchase cost.
- Estimated land cost input.
- Estimated cost.
- Sales price.
- Margin.
- Incoming ETA and timing from open PO records.
- Selected products or filtered products.
- Export Catalog Excel matching the print-oriented catalog version.

Example:

Lewis/Will can generate a simple wholesale catalog based on selected suppliers or product groups, including product images, costs, selling prices, margin, and expected incoming dates.

Maturity: Ready for internal catalog preparation. Estimated landed cost is an input/default estimate unless actual landed cost allocation is available.

### H. New Product Planner

The New Product Opening Buy Planner supports structured opening-buy planning for products that are not yet part of regular reorder planning.

Current capabilities:

- New plan creation.
- Plan detail page.
- Plan print page.
- Supplier, category, budget, coverage, status, and planning notes.
- Comparable product search.
- Comparable demand estimates.
- Quantity matrix planning by size/color.
- Mockup image support through signed storage URLs.
- Audit log history.
- Draft planning workflow.

Important limitation:

The current planner is for opening quantity planning only. The interface states that it does not create a PO in this phase, and the PO creation action is disabled/stubbed.

Maturity: Partial. Useful for planning and review, but not yet a full new-product-to-PO workflow.

### I. Approval Requests

Payment Approval Requests provide a structured internal approval workflow around PO payment rows.

Current capabilities:

- Payment approval request overview.
- Workbench views by role.
- Active assigned requests.
- Requests created by the user.
- Actioned/history views.
- Accounting desk view.
- Approval control room.
- Retail review support.
- Optional reviewer and preliminary approver steps.
- Final approver support.
- Approve/reject actions.
- Manual external approval evidence for admin users.
- Supporting document upload, update, remove, and audit history.
- Payment proof upload or proof URL.
- Accounting confirmation updates linked PO payment rows.
- Approval pack print page with payment request, PO summary, approval trail, supporting documents, payment history, and accounting checklist.

Example:

Accounting can prepare a payment approval request, approvers can review it in sequence, and the final pack can be printed as evidence for internal control.

Maturity: Ready for structured approvals, with current submission access intentionally limited to super admin in this phase.

### J. Suppliers / Settings / Reports

Supplier and setup capability is available through Purchasing Setup. Some navigation items exist for broader supplier, settings, and reports areas, but the audited codebase currently exposes the implemented setup route rather than separate full supplier/settings/report pages.

Current Purchasing Setup capabilities:

- Supplier master records.
- Supplier contacts.
- Supplier codes and active status.
- Currency, payment terms, MOQ, lead time, and safety stock defaults.
- Product scope and supplier notes.
- Contact email, phone, department, Line ID, and primary-contact flag.
- Tag catalog for purchasing classification.
- Fallback tag options from Shopify product tags/defaults if the setup table is not available.

Reports:

- Dashboard reports and summaries.
- Purchasing Decision export.
- Overstock report print page.
- Cost Price Monitor export.
- Wholesale Catalog print/export.
- Approval pack print page.

Maturity: Partial. Supplier setup is implemented; separate full Reports, Suppliers, and Settings pages are not present as standalone routes in the current route list.

### K. Shopify / Xero Integration Or Export

Shopify:

- The system includes API routes to sync Shopify product, variant, location, inventory, order, and sales-line data into Supabase read-model tables.
- Sync health is tracked in the dashboard through sync run records.
- Daily sync can run product/inventory and sales-line sync together.
- Sync routes require secrets and are intended for server-side or scheduled use.

Xero:

- The system tracks Xero status on payment rows.
- The PO detail page can download a Xero CSV for manual import.
- The code and UI wording indicate that this does not upload directly to Xero.

Shopify CSV export:

- The PO detail page can download a staff-safe Shopify CSV with SKU and quantity.
- The code and UI wording indicate that barcode and supplier SKU are blank and cost/tax are exported as zero.
- This is a CSV download, not a direct Shopify upload.

Maturity: Partial to Ready. Shopify read sync is implemented; Xero and Shopify outbound workflows are CSV handoffs rather than direct uploads.

## 4. Example Business Workflows

1. Creating and tracking a PO from supplier quotation to receiving  
Purchasing creates a PO, adds line items, records supplier quotation/reference details, updates status as the order progresses, tracks expected delivery, and records receiving when goods arrive.

2. Checking which payments are overdue this week  
Management or accounting opens the dashboard or PO Portal payment action list to see overdue payments, payments due this week, missing FX rates, and Xero status.

3. Submitting and reviewing a payment approval request  
Accounting or an authorized admin submits a request from a PO payment row, approvers review in sequence, supporting documents are attached, and accounting later records payment proof.

4. Checking incoming items arriving in the next 7 days  
Purchasing or warehouse reviews the Incoming ETA section to see suppliers, POs, product summaries, ETA timing, and outstanding receiving quantities.

5. Reviewing cost and margin before setting wholesale price  
Management uses Cost Price Monitor to compare latest purchase price, average cost, landed cost, selling price, stock, incoming quantity, and margin.

6. Generating a wholesale catalog for selected supplier products  
A user with cost-monitor access filters by supplier or product group, selects products, enters estimated land cost if needed, and prints or exports the catalog.

7. Hiding inactive products from planning and catalog output  
Purchasing uses Reorder Planning controls to hide inactive, event, markdown, or irrelevant items so they do not pollute planning views or catalog outputs.

8. Exporting a staff-safe Shopify CSV without exposing cost data  
From PO detail, a user downloads a Shopify CSV that includes SKU and quantity but does not expose cost values.

## 5. Permissions / Roles

The application uses two related permission concepts:

- User role: broad business role such as super admin, accounting, approver, reviewer, retail manager, or viewer.
- Access role: email-based operational access such as admin, incoming ETA viewer, warehouse staff, executive read-only, or dashboard-only.

Roles found in the codebase:

- `super_admin`: broadest role and effectively full access to management, PO, payment, planning, setup, and cost-monitor areas when paired with admin-level access.
- `accounting`: access to accounting desk, Cost Price Monitor when admin access is present, payments, approval requests, payment packs, and reports.
- `final_approver`: approval-focused access for final approval work.
- `preliminary_approver`: approval-focused access for preliminary approval work.
- `reviewer`: payment review and approval request visibility.
- `retail_manager`: retail review and approval request visibility.
- `viewer`: limited read role, depending on access-role checks.

Access groups found in the codebase:

- `admin`: allowed to create/edit POs, manage payments, receive POs, and approve payment requests where role checks also allow it.
- `incoming_eta_viewer`: limited to incoming ETA/PO Portal visibility. PO detail access is blocked.
- `warehouse_staff`: limited operational receiving access. Can use receiving workflow but is blocked from full PO detail, cost, margin, and payment management controls.
- `executive_readonly`: can access executive dashboard/control-tower style views and broad navigation, but is blocked from Cost Price Monitor by the current cost-monitor access check.
- `dashboard_only`: supported in code, currently empty in the configured email list.

Sensitive area restrictions:

- Cost Price Monitor is restricted to super admin or accounting user roles with admin/super-admin access role.
- Warehouse staff and incoming-only viewers are blocked from cost/margin/payment controls and full PO detail.
- Payment management actions are restricted to admin-level access.
- Receiving workflow allows admin or warehouse staff.
- New Product Planner and Reorder Planning require control-tower access.
- Payment request actions also apply role-specific checks; in the current phase, payment request submission is limited to super admin.

Executive summary:

The system has meaningful role separation. Warehouse users can receive goods without cost/payment visibility, accounting can focus on payments, approvers can focus on approvals, and super admin has the broadest access.

## 6. Data Sources

The system primarily uses Supabase tables, views, and RPCs, with Shopify data synced into local read-model tables.

Major data sources:

- PO data: PO orders, PO line items, PO status history, supplier references, comments, and PO summary views.
- PO payments: planned/paid rows, due dates, FX rates, THB paid amounts, payment references, and Xero status.
- Receiving data: PO receipts, receipt quantities, receipt history, and over-receiving guard logic.
- Product/item metadata: Shopify product and variant read-model data, product images, SKU, barcode, product status, vendor, tags, and inventory.
- Reorder Planning metadata: supplier mappings, purchasing decision controls, hidden flags, lead time, safety stock, reorder point, target quantity, and tags.
- Shopify sync/read model: products, variants, locations, inventory snapshots, sales lines, daily sales summaries, demand index, sync runs, and sync locks.
- Cost override data: cost price monitor overrides and legacy cost price override compatibility.
- Incoming ETA / receiving data: incoming ETA event views, unscheduled incoming views, incoming-by-SKU view, open PO quantity, and ETA dates.
- Payment approval data: payment approval requests, steps, supporting documents, proof records, audit logs, and user profiles.
- New Product Planner data: opening-buy plans, comparable products, quantity matrix, mockup references, and audit logs.
- Purchasing setup data: supplier master records, supplier contacts, purchasing tag catalog, and fallback tag/product metadata.

Plain English interpretation:

Supabase is the system database. Shopify is read into Supabase so purchasing screens can use product, inventory, and demand information without working directly inside Shopify. Xero is not directly connected for upload; the system prepares CSV output and tracks payment/Xero status.

## 7. Outputs / Exports / Print Documents

### Supplier Quote Print

- Purpose: Print a supplier-facing or internal quote/reference document from PO detail.
- Data included: PO header, supplier information, line items, quantities, and related PO references.
- Who uses it: Purchasing and management.

### Goods Receipt Print

- Purpose: Print receiving evidence for warehouse or internal records.
- Data included: PO line receiving information and receipt context.
- Who uses it: Warehouse, purchasing, accounting.

### Xero CSV

- Purpose: Prepare payment/PO data for manual Xero import.
- Data included: Xero-style bill/payment fields from PO payment data.
- Who uses it: Accounting.
- Important accuracy note: This downloads a CSV only. It does not upload directly to Xero.

### Shopify CSV

- Purpose: Prepare a staff-safe Shopify import file from PO detail.
- Data included: SKU and quantity. Barcode and supplier SKU are blank; cost and tax are exported as zero.
- Who uses it: Purchasing or operations staff preparing Shopify inventory/import work.
- Important accuracy note: This downloads a CSV only. It does not upload directly to Shopify.

### Cost Price Monitor Export Excel

- Purpose: Export the cost-monitor table for analysis or management review.
- Data included: product family, supplier/category/group, stock, purchase cost, landed cost, selling price, margin, latest PO/invoice context, overrides, and notes.
- Who uses it: Management, accounting.

### Wholesale Catalog Print

- Purpose: Produce a print-ready wholesale catalog.
- Data included: product image, name, current quantity, incoming quantity, incoming ETA, cost, selling price, margin, and estimated landed cost.
- Who uses it: Management, sales/catalog preparation users.

### Wholesale Catalog Excel

- Purpose: Export the catalog-ready data in spreadsheet format.
- Data included: metadata sheet and catalog sheet aligned to the print version.
- Who uses it: Management, sales/catalog preparation users.

### Purchasing Decision CSV Export

- Purpose: Export reorder planning data for review or offline analysis.
- Data included: SKU, product, supplier, tags, stock, sales/demand fields, planning controls, order quantity suggestions, incoming quantities, and notes.
- Who uses it: Purchasing planners and management.

### Overstock Report Print

- Purpose: Review overstock risk from the purchasing decision workbench.
- Data included: stock and planning signals for items with overstock indicators.
- Who uses it: Purchasing planners and management.

### New Product Planner Print

- Purpose: Print a new product opening-buy plan.
- Data included: plan header, comparable products, demand estimate, quantity matrix, budget/coverage planning, and notes.
- Who uses it: Purchasing planners and management.

### Payment Approval Pack

- Purpose: Produce a complete approval record for payment requests.
- Data included: PO summary, request details, approval trail, approved amount, supporting documents, previous payment history, document history, payment recording status, and accounting checklist.
- Who uses it: Accounting, approvers, management.

## 8. Current Limitations / Known Issues

- Several features depend on Supabase migrations being applied in the target database. If migrations are missing, some pages show fallback data, partial data, or migration-required messages.
- The PO Portal includes fallback AppSheet export data support when Supabase data is not available. That is useful for continuity but should not be treated as the full production data model.
- Cost Price Monitor requires the canonical override table migration for full override reliability. Missing cost rows may require manual purchase/landed/selling overrides.
- Some cost rows can be missing because historical PO cost, supplier mappings, or product metadata are incomplete.
- Product metadata quality matters. Supplier/category/product group filters and catalog output depend on clean product mappings and purchasing setup data.
- Unknown historical size-mix rows require cleanup before the dashboard can fully classify historical PO size patterns.
- Xero support is CSV export and status tracking only. There is no direct Xero API upload in the audited code.
- Shopify outbound support from PO detail is CSV download only. There is no direct upload to Shopify from the PO detail export button.
- Shopify sync requires the correct secrets and credentials. Sync health depends on scheduled/manual syncs completing successfully.
- Reorder Planning uses rules, controls, sales summaries, and demand indicators. It is not yet a full forecasting or AI demand-planning engine.
- New Product Planner is currently a planning and print workflow only. It does not create POs in this phase.
- Landed cost in the wholesale catalog can rely on estimated/default input when actual landed allocation is unavailable.
- Some payment update behavior is handled by application-side multi-step operations. A database transaction/RPC would reduce risk for all-or-nothing payment schedule saves.
- Separate standalone Suppliers, Reports, and Settings pages are not present in the current route list, even though navigation labels and reporting-style outputs exist.

## 9. Business Value Summary

The system creates business value by:

- Saving time previously spent in spreadsheets and manual status follow-up.
- Reducing duplicate purchasing, payment, and receiving records.
- Improving visibility into open PO status, supplier progress, payment timing, and receiving needs.
- Improving payment control with due-date alerts, FX tracking, approval steps, proof records, and approval packs.
- Improving cost and margin visibility before wholesale pricing or catalog preparation.
- Making supplier/catalog preparation faster and more consistent.
- Reducing the risk of hidden, inactive, old, or incomplete products entering catalog outputs.
- Helping purchasing, warehouse, accounting, and management coordinate from one shared operational view.

## 10. Recommended Next Phases

1. Stabilize migrations and production database setup  
Confirm all required Supabase migrations are applied and documented for production.

2. Add more dashboard management summaries  
Add supplier-level risk, payment forecast by month, open PO value by supplier, and aging summaries.

3. Improve reorder intelligence  
Enhance reorder logic with stronger demand smoothing, seasonality, supplier minimums, and configurable order policies.

4. Add cost change alerts  
Notify management when latest purchase cost or landed cost changes materially versus historical averages.

5. Add landed cost allocation logic  
Improve real landed-cost allocation by shipment/PO rather than relying on estimated/default landed cost in catalog views.

6. Improve approval workflow flexibility  
Allow configurable approver chains, delegation, thresholds, and clearer submit permissions by role.

7. Add supplier performance tracking  
Track supplier lead-time accuracy, receiving delays, payment terms, defect/issue notes, and historical order value.

8. Add role-based management reports  
Create targeted reports for executives, accounting, purchasing, and warehouse rather than one-size-fits-all outputs.

9. Add automated sync monitoring  
Create clearer failure notifications for Shopify sync jobs, stale data, and sync lock issues.

10. Improve data cleanup tools  
Add user-friendly cleanup queues for unknown size mixes, unmapped suppliers, inactive products, and missing cost metadata.

## 11. Executive One-Page Summary

| Module | What it does | Example | Business value | Current maturity |
| --- | --- | --- | --- | --- |
| Dashboard / Control Room | Shows PO, payment, receiving, ETA, sync, and cleanup health | Manager checks overdue payments and receiving risk | Faster executive visibility | Ready |
| PO Portal | Creates and manages purchase orders | Purchasing tracks a PO from quotation to receiving | Centralized PO execution | Ready |
| PO Detail | Shows full PO lines, status, references, payments, receiving, and prints | Team reviews supplier invoice, payment rows, and received quantities | Stronger PO traceability | Ready |
| Payment Tracking | Tracks planned/paid payments, due dates, FX, THB, and Xero status | Accounting reviews payments due this week | Better cash control | Ready |
| Approval Requests | Routes payment requests through review and approval | Approver reviews supporting documents and approves payment | Better internal control | Ready |
| Incoming ETA / Receiving | Shows incoming goods and records receiving | Warehouse receives quantities against PO lines | Better warehouse coordination | Ready |
| Reorder Planning | Maintains SKU planning controls and reorder suggestions | Planner selects SKUs and creates a draft PO | Less spreadsheet work | Partial |
| Cost Price Monitor | Reviews product-family cost, landed cost, selling price, margin, stock, and overrides | Management checks margin before wholesale pricing | Better pricing decisions | Ready |
| Wholesale Catalog | Prints/exports product catalog with images, cost, price, margin, stock, and ETA | User exports selected supplier products for wholesale review | Faster catalog preparation | Ready |
| New Product Planner | Plans opening buys using comparable products and quantity matrix | Planner prints a proposed new-product buy plan | More structured launch buying | Partial |
| Purchasing Setup | Maintains suppliers, contacts, terms, defaults, and tags | Admin updates supplier lead time and payment terms | Cleaner shared metadata | Partial |
| Shopify Sync | Reads Shopify products, inventory, orders, and sales lines into Supabase | Admin refreshes product and demand data | Purchasing decisions use current data | Ready |
| Xero CSV | Downloads CSV for manual Xero import and tracks Xero status | Accounting downloads a bill/payment CSV | Faster accounting handoff | Partial |
| Shopify CSV | Downloads staff-safe SKU/quantity CSV | Staff exports SKU quantity without cost data | Safer operations handoff | Partial |

## 12. Evidence

### Dashboard / Control Room

- Route: `/dashboard`
- Main files: `src/app/dashboard/page.tsx`, `src/lib/po-dashboard.ts`
- Data/helpers involved: `po_order_summary`, `po_portal_metrics`, `po_payments`, `po_receipts`, `po_incoming_eta_events`, `po_incoming_eta_unscheduled_events`, `po_size_mix_summary`, `sync_runs`

### PO Portal

- Route: `/po`
- Main files: `src/app/po/page.tsx`, `src/app/po/po-forms.tsx`, `src/app/po/actions.ts`, `src/lib/po-portal.ts`, `src/lib/po-portal-data.ts`
- Data/helpers involved: PO order tables, PO item tables, status history, supplier/contact records, payment rows, incoming ETA views, receipt rows

### PO Detail

- Route: `/po/[poId]`
- Main files: `src/app/po/[poId]/page.tsx`, `src/app/po/po-forms.tsx`, `src/app/po/actions.ts`, `src/lib/po-portal.ts`, `src/lib/po-payments.ts`
- Data/helpers involved: PO header/detail readers, PO payments, PO receipts, print components, payment approval cards

### Payment Tracking

- Routes: `/po`, `/po/[poId]`, `/dashboard`
- Main files: `src/app/po/po-forms.tsx`, `src/app/po/actions.ts`, `src/lib/po-payments.ts`, `src/lib/po-dashboard.ts`
- Database migrations: `007_po_draft_cost_payment.sql`, `011_po_payment_schedule.sql`, `015_po_payment_fx_amount.sql`, `047_po_payments_xero_status.sql`, `049_po_payments_xero_status_safe.sql`

### Incoming ETA / Receiving

- Routes: `/po`, `/po/[poId]`, `/dashboard`
- Main files: `src/app/po/page.tsx`, `src/app/po/[poId]/page.tsx`, `src/app/po/actions.ts`, `src/lib/po-dashboard.ts`, `src/lib/cost-price-catalog.ts`
- Database migrations/views: `017_po_receipt_over_receive_guard.sql`, `025_po_incoming_eta_view.sql`, `026_po_incoming_eta_unscheduled_view.sql`, `027_po_incoming_eta_performance_indexes.sql`, `042_po_incoming_eta_events_dual_date.sql`

### Reorder Planning / Purchasing Decision

- Routes: `/purchasing-decision`, `/purchasing-decision/overstock-report`
- API: `/api/purchasing-decision/export`
- Main files: `src/app/purchasing-decision/page.tsx`, `src/app/purchasing-decision/actions.ts`, `src/app/purchasing-decision/overstock-report/page.tsx`, `src/app/api/purchasing-decision/export/route.ts`, `src/lib/purchasing-decision-data.ts`
- Data/helpers involved: Shopify product/variant read model, inventory snapshots/current inventory, sales summaries, demand index, incoming-by-SKU, supplier mappings, purchasing decision controls, purchasing setup

### Cost Price Monitor

- Routes: `/cost-price-monitor`, `/cost-price-monitor/print`
- APIs: `/api/cost-price-monitor/export`, `/api/cost-price-monitor/catalog-export`
- Main files: `src/app/cost-price-monitor/page.tsx`, `src/app/cost-price-monitor/actions.ts`, `src/app/cost-price-monitor/selection-controls.tsx`, `src/app/cost-price-monitor/print/page.tsx`, `src/app/api/cost-price-monitor/export/route.ts`, `src/app/api/cost-price-monitor/catalog-export/route.ts`, `src/lib/cost-price-monitor.ts`, `src/lib/cost-price-catalog.ts`
- Data/helpers involved: product variants, current inventory, PO items/orders, supplier mappings, purchasing controls, purchasing setup, cost price monitor overrides

### Wholesale Catalog

- Routes: `/cost-price-monitor`, `/cost-price-monitor/print`
- API: `/api/cost-price-monitor/catalog-export`
- Main files: `src/app/cost-price-monitor/page.tsx`, `src/app/cost-price-monitor/print/page.tsx`, `src/app/api/cost-price-monitor/catalog-export/route.ts`, `src/lib/cost-price-catalog.ts`
- Data/helpers involved: cost monitor rows, product images, stock, incoming quantity, incoming ETA, selected product keys, estimated land cost input

### New Product Planner

- Routes: `/new-product-opening-buy-planner`, `/new-product-opening-buy-planner/new`, `/new-product-opening-buy-planner/[planId]`, `/new-product-opening-buy-planner/[planId]/print`
- API: `/api/new-product-opening-buy-planner/comparable-search`
- Main files: `src/app/new-product-opening-buy-planner/page.tsx`, `src/app/new-product-opening-buy-planner/new/page.tsx`, `src/app/new-product-opening-buy-planner/[planId]/page.tsx`, `src/app/new-product-opening-buy-planner/[planId]/print/page.tsx`, `src/app/new-product-opening-buy-planner/actions.ts`, `src/app/api/new-product-opening-buy-planner/comparable-search/route.ts`, `src/lib/new-product-opening-buy.ts`
- Database migrations: `038_new_product_opening_buy_planner.sql`, `039_new_product_opening_buy_size_matrix.sql`, `040_new_product_plan_storage.sql`, `043_new_product_plan_add_supplier_categories.sql`, `044_new_product_plan_round2_nullable_created_by.sql`, `045_new_product_plan_audit_logs.sql`, `046_new_product_plan_reorder_status.sql`

### Approval Requests

- Routes: `/payment-requests`, `/payment-requests/[requestId]/approval-pack`
- Main files: `src/app/payment-requests/page.tsx`, `src/app/payment-requests/actions.ts`, `src/app/payment-requests/request-card.tsx`, `src/app/payment-requests/[requestId]/approval-pack/page.tsx`, `src/lib/payment-approvals.ts`
- Database migrations: `031_payment_approvals.sql`, `032_payment_supporting_documents.sql`, `033_payment_proof_storage.sql`, `034_payment_proof_correction.sql`, `035_payment_approval_audit_trail.sql`, `036_payment_approval_supporting_docs_rls.sql`

### Purchasing Setup

- Route: `/purchasing-setup`
- Main files: `src/app/purchasing-setup/page.tsx`, `src/app/purchasing-setup/actions.ts`, `src/lib/purchasing-setup.ts`
- Data/helpers involved: `po_suppliers`, `po_supplier_contacts`, `purchasing_tag_catalog`, fallback product tags
- Database migration: `009_purchasing_setup.sql`

### Permissions And Navigation

- Main files: `src/lib/auth.ts`, `src/lib/access-control.ts`, `src/lib/role-nav.ts`
- Key functions: `canAccessCostPriceMonitor`, `canAccessAdminControlTower`, `canAccessPaymentWorkbench`, `canCreatePo`, `canEditPo`, `canManagePayments`, `canReceivePo`, `canOpenPoDetail`, `canUseReceivingWorkflow`

### Shopify Sync

- APIs: `/api/sync/shopify`, `/api/sync/sales-lines`, `/api/sync/daily`
- Main files: `src/app/api/sync/shopify/route.ts`, `src/app/api/sync/sales-lines/route.ts`, `src/app/api/sync/daily/route.ts`, `src/lib/sync/shopify-products.ts`, `src/lib/sync/shopify-sales-lines.ts`
- Data/helpers involved: Shopify Admin API read sync, sync secrets, sync runs, sync locks, product/variant/location/inventory/sales read models

### CSV And Export Features

- Xero CSV: `src/app/po/po-forms.tsx`
- Shopify CSV: `src/app/po/po-forms.tsx`
- Purchasing Decision CSV: `src/app/api/purchasing-decision/export/route.ts`
- Cost Price Monitor export: `src/app/api/cost-price-monitor/export/route.ts`
- Catalog Excel export: `src/app/api/cost-price-monitor/catalog-export/route.ts`

## 13. Accuracy Notes

- This report describes capabilities found in the current codebase and route build output.
- Features marked Partial either depend on migrations/data cleanup, use CSV handoff rather than direct integration, or are intentionally limited in the current phase.
- No direct Xero API upload was found.
- Shopify read sync exists. Shopify outbound PO export found in the PO UI is a CSV download, not a direct upload.
- Where data source behavior depends on Supabase views, migrations, or environment secrets, production availability should be verified against the deployed database.

## 14. Checks Run

The requested checks were run from `purchasing-web` on 2026-06-08.

| Check | Result | Notes |
| --- | --- | --- |
| `npm run build` | Passed | PowerShell blocked `npm.ps1`, so the equivalent Windows command `npm.cmd run build` was used. Next.js production build completed successfully. |
| `npm run lint` | Passed | `npm.cmd run lint` completed successfully with ESLint. |
| `npm run typecheck` | Passed | `npm.cmd run typecheck` completed successfully with `tsc --noEmit`. |

