# PO Payment Date Save Audit

Date: 2026-06-01

## Executive Summary

The reported "dates jump out / values are not saved" behavior is most likely a combination of FX validation blocking success, non-transactional partial writes, and a UX gap after validation failure. It is not primarily a DD/MM/YYYY parsing bug in the current payment edit form.

The payment edit form uses native `type="date"` inputs. The submitted value is `YYYY-MM-DD`, the server stores that string directly into `payment_date` and `due_date`, and the Supabase reload returns the same date-column format. Read-only display uses `en-GB`, so users see date labels in a UK/Thai-style order, but the form submission path is ISO date based.

The confirmed high-risk issue is that `updatePoPaymentsAction` deletes first and then updates/inserts rows one by one. FX validation happens inside that same loop. If an earlier row is valid and a later AUD row is missing FX, earlier writes can already be committed before the action throws an error. The client then receives an error state with no canonical rows and does not call `router.refresh()`, so the UI can appear not saved while the database may actually contain a partial save.

## Files Inspected

| File | Purpose |
| --- | --- |
| `src/app/po/[poId]/page.tsx` | PO Detail page render, payment summaries, payment history display. |
| `src/app/po/po-forms.tsx` | `PaymentScheduleForm`, payment inputs, FX inline validation, action state handling. |
| `src/app/po/actions.ts` | `updatePoPaymentsAction`, payment row parsing, validation, DB write path, revalidation. |
| `src/lib/po-portal.ts` | PO detail payment row query and reload shape. |
| `src/lib/po-payments.ts` | Shared payment sorting helper. |

## Current Date Save Flow

1. `src/app/po/[poId]/page.tsx:941` sorts `data.payments` with `sortPoPayments(data.payments)`.
2. `src/app/po/[poId]/page.tsx:1189` renders `PaymentScheduleForm` with those `sortedPayments`.
3. `src/app/po/po-forms.tsx:2370` initializes local state once with `sortPoPayments(payments)`.
4. `src/app/po/po-forms.tsx:2513-2526` renders both date fields as `SyncedPaymentInput type="date"`.
5. `src/app/po/po-forms.tsx:2275-2281` renders `SyncedPaymentInput` as an uncontrolled input using `defaultValue`.
6. Browser `type="date"` FormData submits `YYYY-MM-DD` values.
7. `src/app/po/actions.ts:1869-1874` reads `dueDate:${rowKey}` and `paymentDate:${rowKey}`.
8. `src/app/po/actions.ts:1923-1924` stores `paymentDate = rowInput.paymentDate || (status === "paid" ? today : null)` and `dueDate = rowInput.dueDate || null`.
9. `src/app/po/actions.ts:1933-1951` writes those values to `po_payments.payment_date` and `po_payments.due_date`.
10. `src/app/po/actions.ts:1959-1961` reloads canonical payment rows and returns them on success.
11. `src/app/po/po-forms.tsx:2375-2379` replaces `localPayments` with returned rows and calls `router.refresh()` only when `nextState.ok && nextState.payments`.

## Date Format Findings

| Layer | Current behavior |
| --- | --- |
| Edit UI display | Native date input. The visual date order is browser/locale dependent, but the control value is ISO. |
| Submitted FormData | `YYYY-MM-DD` from `type="date"`. |
| Server expectation | No date parser/normalizer. It expects a directly storable date string and treats blank as null or today for paid rows. |
| DB storage | `po_payments.payment_date` and `po_payments.due_date` receive the submitted string directly. For date columns, Supabase/Postgres returns `YYYY-MM-DD`. |
| Page reload | `src/lib/po-portal.ts:2979-2983` selects both date columns; `src/lib/po-portal.ts:3010` sorts and returns them. |
| Read-only display | `src/app/po/[poId]/page.tsx:76-84` formats date strings with `Intl.DateTimeFormat("en-GB")`, showing a DD/MM-style user-facing date. |

There is no shared payment-date normalization helper in the inspected payment save path. Inputs such as `2026-02-03`, `03/02/2026`, `3/2/2026`, `15/04/2026`, and `30/04/2026` are not explicitly normalized by the action.

Because the editable fields are native date inputs, users should normally submit `2026-02-03`, not `03/02/2026`. If a browser, test, legacy form, or script submits `03/02/2026`, the action does not convert DD/MM/YYYY to ISO and may either fail at the DB layer or store an unintended value if the column accepts text. Ambiguous dates are not interpreted as MM/DD/YYYY by app code because app code does not parse them at all.

## Current FX Validation Flow

The UI visibly flags foreign-currency rows with no usable FX:

```tsx
// src/app/po/po-forms.tsx:2187-2227
const hasInvalidForeignFx = shouldValidateFx && normalizedCurrency !== "THB" && rateNumber <= 1;
...
FX rate missing or invalid for {normalizedCurrency}
...
<span className="text-[#b42318]">FX required</span>
```

The server also blocks foreign-currency rows whose FX is blank, zero, or `<= 1`:

```ts
// src/app/po/actions.ts:1912-1921
const exchangeRate = exchangeRateInput
  ? nonNegativeTextNumber(exchangeRateInput, `Payment ${index + 1} exchange rate`)
  : existingPayment?.exchangeRate && existingPayment.exchangeRate > 0
    ? existingPayment.exchangeRate
    : currencyCode === "THB"
      ? 1
      : 0;
if (currencyCode !== "THB" && exchangeRate <= 1) {
  throw new Error(`Payment ${index + 1} needs a real FX rate for ${currencyCode}`);
}
```

Answering the FX questions:

| Question | Finding |
| --- | --- |
| Does a paid AUD row with missing FX block save? | Yes. Any non-THB row with effective FX `<= 1` throws. This applies to paid and planned rows that are not blank draft rows. |
| Does it reject the entire save? | It returns an error for the whole action, but writes before the failing row may already have happened. |
| Can one invalid row prevent all other rows from saving? | It prevents a successful action response and rows after the invalid row do not save. Rows before the invalid row may already be saved. |
| Does it preserve edited date values on error? | Usually in the live DOM, yes, because the client does not replace `localPayments` or refresh on error and the input keys should remain stable. But no error payload preserves edits if the component remounts for another reason. |
| Does the UI reset to server values after validation failure? | Not intentionally. It does not call `router.refresh()` on error. A reset can happen if the page/component remounts or navigation/refresh occurs after the failed action. |
| Is the error clear enough? | Partly. Inline FX text appears per row, and the action message appears below a wide table at `src/app/po/po-forms.tsx:2591`. On a horizontally scrolled table or tall section, the row-level issue may still feel disconnected from the Save failure. |

## Controlled Input And State Findings

`PaymentScheduleForm` owns `localPayments`:

```tsx
// src/app/po/po-forms.tsx:2368-2379
const router = useRouter();
const [localPayments, setLocalPayments] = useState(() => sortPoPayments(payments));
...
if (nextState.ok && nextState.payments) {
  setLocalPayments(sortPoPayments(nextState.payments));
  ...
  router.refresh();
}
```

Date/reference/note/currency fields are uncontrolled:

```tsx
// src/app/po/po-forms.tsx:2275-2281
<input
  className={className}
  defaultValue={value}
  name={name}
  type={type}
/>
```

Amount and FX fields are controlled locally inside `PaymentAmountFields`, but they initialize from props once:

```tsx
// src/app/po/po-forms.tsx:2180-2181
const [amountValue, setAmountValue] = useState(nextAmountValue);
const [rateValue, setRateValue] = useState(nextRateValue);
```

The code compensates for that with keys based on saved/canonical values:

```tsx
// src/app/po/po-forms.tsx:2514-2525
key={`${rowKey}:payment-date:${payment?.payment_date ?? ""}`}
...
key={`${rowKey}:due-date:${payment?.due_date ?? ""}`}
```

This works after successful save because returned canonical rows update `localPayments`, changing keys when saved values change. On validation failure, no canonical rows are returned, so the component relies on the existing DOM and component instances to keep unsaved edits.

Confirmed state risk: `localPayments` is initialized from props once and has no `useEffect` to resync when refreshed server props arrive. In this specific success path, `setLocalPayments(nextState.payments)` handles the update before `router.refresh()`. But if server props change due to another action, external refresh, or concurrent edit, the form can ignore those new props until remounted.

## Returned Rows And Refresh Findings

Success now returns canonical rows:

```ts
// src/app/po/actions.ts:1958-1961
await recalculatePoAmount(poId);
const payments = await paymentRowsForPo(supabase, poId);
refreshPoViews(poId);
return { ...success(`Saved ${savedCount} payment rows`), payments };
```

`paymentRowsForPo` selects the needed date and FX fields:

```ts
// src/app/po/actions.ts:337-345
"id,po_id,payment_date,payment_type,payment_status,xero_status,due_date,amount,exchange_rate,amount_thb,currency,paid_by,reference,note,created_at,updated_at"
...
return sortPoPayments((query.data ?? []) as PoPaymentDisplayRow[]);
```

The page reload query also includes those fields:

```ts
// src/lib/po-portal.ts:2979-2983
.select("id,po_id,payment_date,payment_type,payment_status,xero_status,due_date,amount,exchange_rate,amount_thb,currency,paid_by,reference,note,created_at,updated_at")
.eq("po_id", poId)
.order("payment_date", { ascending: true });
```

`router.refresh()` is used only after success. It should not overwrite success with stale rows unless `refreshPoViews(poId)` revalidation lags behind the client refresh. Since canonical rows are already merged into local state before the refresh, the form itself should show fresh successful values even if the server refresh briefly returns older props.

## Confirmed Issues

### 1. Non-transactional partial save on validation failure

Severity: High.

`updatePoPaymentsAction` performs deletes before validation and writes rows inside the same loop where FX validation can throw:

```ts
// src/app/po/actions.ts:1827-1836
if (deleteIds.size > 0) {
  await supabase.from("po_payments").delete()...
}

// src/app/po/actions.ts:1897-1955
for (const rowInput of rows) {
  ...
  if (currencyCode !== "THB" && exchangeRate <= 1) {
    throw new Error(`Payment ${index + 1} needs a real FX rate for ${currencyCode}`);
  }
  ...
  const { error } = rawId
    ? await supabase.from("po_payments").update(row).eq("id", rawId).eq("po_id", poId)
    : await supabase.from("po_payments").insert(row);
}
```

This means "save failed" can coexist with some DB changes having already been committed. That is a direct explanation for user confusion after refresh.

### 2. Error response does not return edited rows

Severity: Medium.

On catch, the action returns only an error message:

```ts
// src/app/po/actions.ts:1962-1964
} catch (error) {
  return initialError(error instanceof Error ? error.message : "Save payments failed");
}
```

The client only updates local canonical rows on success. If the component remounts after an error, unsaved date edits are not reconstructed from the failed FormData.

### 3. No explicit date normalization for non-native submissions

Severity: Medium.

The form path is ISO-safe, but the server action accepts raw strings and does not normalize or reject non-ISO dates before DB write. If anything submits `03/02/2026`, the app does not enforce the business assumption that this means 3 February 2026.

### 4. Payment form local state can ignore fresh props

Severity: Low to Medium.

`localPayments` is initialized from `payments` only once. Successful saves are handled manually, but unrelated revalidation or a concurrent update can leave the edit form showing stale local rows.

### 5. Summary cards are local-form derived

Severity: Low.

The cards inside `PaymentScheduleForm` use `localPayments` at `src/app/po/po-forms.tsx:2399-2419`, not live DB state. They update after successful returned rows but not while users type. Top-level PO page payment totals use `data.payments` at `src/app/po/[poId]/page.tsx:942-967` and update only on server refresh.

## Root Cause Candidates

| Candidate | Audit result |
| --- | --- |
| A. Real save failure | Yes when missing FX triggers validation. Also partial saves can happen before the failure. |
| B. Validation failure due to missing FX | Yes. This is strongly confirmed by both UI and server checks. |
| C. Date format conversion issue | Not for normal `type="date"` usage. Risk remains for non-ISO/manual/legacy submissions because no server normalization exists. |
| D. Controlled input/state reset issue | Possible after remount/error. Normal validation-error re-render should preserve current DOM values, but there is no robust failed-submission state restoration. |
| E. Server action returning stale canonical rows | Not confirmed. Success returns freshly queried rows with date and FX fields. |
| F. `router.refresh`/revalidation issue | Less likely on success because local state is updated before refresh. Could still affect top-level summaries or remount behavior. |
| G. Combination | Yes: missing FX validation plus partial writes plus weak error UX is the most likely combination. |

## Reproduction Scenario Assessment

Static audit result for the requested scenario:

1. Edit paid date and due reminder date.
2. Leave an AUD row FX blank.
3. Click Save Payments.
4. The client submits ISO date values.
5. The server reaches the AUD row and throws `Payment N needs a real FX rate for AUD`.
6. If any earlier row was processed, it may already be saved.
7. The action returns error without canonical rows.
8. The client does not call `router.refresh()` on error and should keep visible DOM edits unless remounted.
9. After adding valid AUD FX and saving again, success should return canonical rows and call `router.refresh()`, so dates should persist.

I did not run a live browser/database reproduction in this audit pass because the request was audit-first and the repository context did not include a specified PO/test record. The code path above is sufficient to confirm the partial-write and validation behavior.

## Recommended Fix Plan

1. Split `updatePoPaymentsAction` into parse/validate/build phases before any delete, update, or insert.
2. Validate all rows first, including FX and date format, then write only if the complete payload is valid.
3. Move the multi-row delete/update/insert flow into a Supabase RPC/database transaction so partial saves cannot persist.
4. Add a date normalizer/validator for payment form dates. Accept only `YYYY-MM-DD` from native inputs, or explicitly convert supported `D/M/YYYY` and `DD/MM/YYYY` as DD/MM/YYYY before DB write.
5. On validation error, return field/row errors and the submitted draft rows, or keep a client-side draft model so remounts do not wipe user-entered dates.
6. Put the save error near the Save button and consider a per-row server error marker matching the row number.
7. Add a `useEffect` reconciliation strategy for `PaymentScheduleForm` props, guarded so it does not overwrite dirty local edits.
8. Decide whether summaries should reflect saved DB rows only or live edited draft rows, then label/update them consistently.
9. Add tests for a multi-row save where row 1 is valid and row 2 is AUD with blank FX. Assert that no row is changed.
10. Add tests for ISO and DD/MM date inputs, including `2026-02-03`, `03/02/2026`, `3/2/2026`, `15/04/2026`, and `30/04/2026`.

## QA Checklist

- [ ] Edit `payment_date` on a paid THB row, save, confirm it persists after refresh.
- [ ] Edit `due_date` on a planned THB row, save, confirm it persists after refresh.
- [ ] Edit multiple rows, leave AUD FX blank, save, confirm the action fails visibly.
- [ ] In the AUD FX failure case, confirm no row, including earlier valid rows or deletes, was written to DB.
- [ ] In the AUD FX failure case, confirm edited dates and amounts remain visible.
- [ ] Add valid AUD FX and save again, confirm returned rows include `payment_date`, `due_date`, `exchange_rate`, and `amount_thb`.
- [ ] Confirm payment summary cards and payment history agree after refresh.
- [ ] Confirm row labels/errors still point to the correct row after sorting, adding, and deleting rows.
- [ ] Confirm `03/02/2026` is either rejected with a clear message or normalized as 3 February 2026, not March 2.
- [ ] Confirm `15/04/2026` and `30/04/2026` do not fail due to accidental MM/DD parsing.
