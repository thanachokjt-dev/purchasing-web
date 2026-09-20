# PO save consistency and upload workbench

Header saves retain submitted inputs on failure and apply saved values after success. Quick comments preserve the current database header and no longer submit stale hidden header fields. Header snapshots and conditional updates reject concurrent overwrites.

Payment saves retain dirty inputs during unrelated page refreshes. Successful saves remount rows from returned database values, including stable IDs. Validation errors leave drafts intact. The database now accepts undated planned payments, and clearing a reminder date persists. Zero-amount typed costs can be tracked before the invoice amount is known.

`save_po_payments` locks the PO, compares the original payment snapshot, and performs deletes, updates, inserts and PO FX totals in one transaction. It is SECURITY INVOKER and executable only by service_role; the server action retains the existing user/role permission check.

The main PO page receives same-browser save notifications, refreshes on return to the tab, and checks a private authenticated version endpoint every 15 seconds. Payment changes update the parent PO timestamp. Quick-comment drafts defer refreshes.

The upload workbench lists each non-uploaded payment as a task, independently of active PO filters and pagination. It includes closed POs, excludes cancelled POs, separates shipping/other expenses from product instalments, and links directly to each payment row. No Xero upload is performed automatically; the existing saved Xero status controls task completion.

## Verification

- TypeScript and targeted ESLint passed; local and Vercel preview production builds passed.
- `supabase/tests/po_save_consistency.sql`: planned blank dates, zero-amount tasks, uploaded state, stale snapshot rejection, rollback after a delete plus invalid second row, cleared reminders, and RPC access permissions.
- Browser with an isolated disposable PO: Header save preserved a dirty Shipping draft; failed USD FX validation retained the entered amount; correction saved both rows; a repeated save did not duplicate rows.
- Reload retained Header values, payment amounts and uploaded status.
- Another already-open main-page tab showed the new task automatically, then removed Shipping after its uploaded status was saved.
- Quick comment submitted after a newer Header save preserved the newer quotation.
- Existing pending/draft tasks, including closed POs, loaded from the live database.

Test POs have no inventory lines or real transactions and are removed after verification.
