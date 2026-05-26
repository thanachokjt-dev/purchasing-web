export type PoPaymentDisplayRow = {
  amount: number | string | null;
  amount_thb?: number | string | null;
  created_at?: string | null;
  currency: string | null;
  due_date?: string | null;
  exchange_rate?: number | string | null;
  id: string;
  note: string | null;
  paid_by: string | null;
  payment_date: string | null;
  payment_status?: string | null;
  payment_type: string | null;
  po_id?: string | null;
  reference: string | null;
  updated_at?: string | null;
  xero_status?: string | null;
};

function paymentSortDate(payment: PoPaymentDisplayRow) {
  const status = String(payment.payment_status ?? "paid").trim().toLowerCase();
  return status === "planned"
    ? payment.due_date || payment.payment_date || ""
    : payment.payment_date || payment.due_date || "";
}

export function comparePoPayments(a: PoPaymentDisplayRow, b: PoPaymentDisplayRow) {
  const aDate = paymentSortDate(a);
  const bDate = paymentSortDate(b);

  if (aDate && bDate && aDate !== bDate) {
    return aDate.localeCompare(bDate);
  }
  if (aDate && !bDate) {
    return -1;
  }
  if (!aDate && bDate) {
    return 1;
  }

  const createdCompare = String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  if (createdCompare !== 0) {
    return createdCompare;
  }

  return a.id.localeCompare(b.id);
}

export function sortPoPayments<T extends PoPaymentDisplayRow>(payments: T[]) {
  // Planned rows sort by due date; paid rows sort by paid date. Undated rows stay at the bottom.
  return [...payments].sort(comparePoPayments);
}
