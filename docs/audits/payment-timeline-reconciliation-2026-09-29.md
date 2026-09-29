# Payment Timeline reconciliation

The original SQL view joined payments to active POs only. This erased historical Paid rows as soon as an order closed or was cancelled. Weekly chart buckets also assigned September 1 payments to the week beginning August 31, shifting monthly labels. The portal additionally capped its history at 500 events.

The migrated view includes all actual Paid history and retains active-PO filtering for Planned events. Recorded FX, gross THB including VAT, explicit zero amounts, and rounding per payment now agree with Purchasing Dashboard. Foreign payments without recorded FX remain visible as missing-FX warnings without fabricated THB amounts. Both timeline views are server-only and use security invoker.

The portal paginates history with a stable payment ID order. Future-dated Paid rows are excluded from actual cash through today. Weeks split at calendar month boundaries. The Last 4 months range covers June 1 through September 29, matching the dashboard's current four calendar months. Paid and planned summary totals follow the selected range; actionable due/overdue cards retain their operational scope.

## Verification

- Regression tests reproduced missing closed/cancelled cash, cross-month weekly misattribution, and rejected fractional FX before the fix.
- Four regression tests cover those cases, zero/missing FX, satang rounding, and 2,101 paginated history rows.
- Independent production SQL and both real server loaders reconcile 89 Paid rows to **7,283,030.24 THB**. Daily, weekly, and monthly chart helpers each produce the same monthly amounts:

| Month                       |     Paid THB |
| --------------------------- | -----------: |
| June 2026                   | 3,215,809.02 |
| July 2026                   | 1,147,497.55 |
| August 2026                 | 1,415,070.74 |
| September 2026 through 29th | 1,504,652.93 |

No payment records were rewritten. Only the read models and display calculations changed. Existing unrelated database advisor findings were not changed; the two timeline views are no longer security-definer views. Authenticated production UI interaction is not claimed; source loaders and chart helpers were verified directly against production data.
