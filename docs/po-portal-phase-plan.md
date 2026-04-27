# PO Portal Phase Plan

This phase turns the read-only PO preview into an operational purchasing portal.
The core rule is simple: dashboard `coming` quantities must come from open PO
lines and receiving events, not from manually edited summary numbers.

## Operating Rules

- A PO starts as `draft`.
- A submitted PO becomes `waiting_for_approve`.
- Approved/working PO lines can become `inpro`, `delivery`, or `final_payment`.
- Only active line statuses count as incoming stock:
  - `inpro`
  - `delivery`
  - `final_payment`
- `waiting_for_approve` is shown separately as pending, not counted as confirmed incoming.
- `closed` and `cancelled` lines do not count as incoming.
- Receiving stock creates rows in `po_receipts`; it does not directly overwrite ordered quantity.
- Outstanding quantity is calculated:

```text
ordered_qty - cancelled_qty - legacy_received_qty - sum(po_receipts.received_qty)
```

- Receiving must not allow total received quantity to exceed available outstanding quantity unless a later explicit override workflow is added.
- AppSheet import history stays in `legacy_received_qty`. New web-app receiving events go into `po_receipts`.
- Every status change should create a `po_status_events` row.

## Phase 2A - Data Foundation

Status: in progress

Goal: make Supabase the source for PO Portal data while keeping Excel/AppSheet as fallback.

Deliverables:

- Done: apply `004_phase2_po_portal.sql`.
- Done: import current `Po-Portals.xlsx` snapshot with `npm run import:po-portal`.
- Done: add a Supabase PO query layer for:
  - metrics
  - active PO workbench
  - open receiving lines
- Done: update `/po` to read Supabase first and fall back to generated AppSheet data if tables are empty or env is missing.
- Remaining: add a Supabase PO query layer for:
  - supplier list for create/edit forms
  - SKU/product lookup

Done when:

- `/po` shows the imported Supabase data.
- The same page still works locally without Supabase credentials.

## Phase 2B - Mutation Layer

Status: next

Goal: create safe write operations before building rich UI controls.

Deliverables:

- Server actions for:
  - create PO header
  - update PO header
  - add/update PO item
  - change PO/line status
  - receive item quantity
- Validation rules:
  - supplier exists before PO is submitted
  - PO item SKU is required
  - ordered quantity must be positive
  - received quantity must be positive
  - received quantity cannot exceed outstanding quantity
  - closed/cancelled lines cannot be received
- Revalidate `/po` and dashboard after successful writes.

Done when:

- Mutations work from simple forms or API-level tests.
- Invalid receiving attempts are rejected with clear messages.

## Phase 2C - Operational UI

Status: planned

Goal: make the PO Portal usable for daily work.

Deliverables:

- PO list with filters for status, supplier, SKU, and date.
- Create PO screen:
  - supplier
  - requester/owner
  - PO date
  - currency/payment terms
  - line items with SKU, title snapshot, qty, unit price, remark
- PO detail screen:
  - editable draft/header fields
  - line item table
  - status transition controls
  - receive stock form per line
  - receipt history
  - status history
- Clear empty/error/loading states.

Done when:

- A user can open a new PO, add lines, submit/approve, mark delivery/final payment, and receive stock.

## Phase 2D - Dashboard Integration

Status: planned

Goal: make purchasing suggestions use real PO workflow numbers.

Deliverables:

- Replace Excel incoming lookup with `po_incoming_by_sku` when Supabase has PO data.
- Keep pending approval separate from confirmed incoming.
- Show source labels:
  - `PO Portal`
  - `AppSheet import`
  - `Excel fallback`
- Add dashboard warnings when PO tables are missing or import has not run.

Done when:

- Buyer Review Queue net suggestion uses PO Portal incoming quantities.
- Pending PO approvals are visible but do not reduce suggested purchase quantities.

## Phase 2E - Production Readiness

Status: planned

Goal: prepare for Vercel deployment and multi-user use.

Deliverables:

- Authentication/authorization decision.
- Role model:
  - viewer
  - buyer
  - approver
  - receiver
  - admin
- Audit fields for who changed status and who received stock.
- Optional PDF/export later, after data workflow is stable.
- Backup/rollback plan before enabling live receiving.

Done when:

- The app can run on Vercel with protected write actions.
- Live PO receiving can be trusted as the source for incoming stock.

## Recommended Build Order

1. Data read layer from Supabase with fallback.
2. Simple server actions and validation.
3. PO detail page with receiving.
4. Create PO flow.
5. Dashboard incoming integration.
6. Authentication and role controls.

This order keeps the riskiest part, stock-impacting receiving, behind a clear
data model and validation layer before it affects reorder suggestions.
