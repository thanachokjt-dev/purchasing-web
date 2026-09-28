import type { PoPaymentDisplayRow } from "./po-payments";

export function usdPaymentFxRates(payments: PoPaymentDisplayRow[]) {
  return payments.filter((payment) =>
    String(payment.currency).trim().toUpperCase() === "USD" &&
    !["shipping", "freight", "fine", "penalty", "other", "other_cost", "vat_import_vat", "vat"]
      .includes(String(payment.payment_type ?? "").trim().toLowerCase()) && Number(payment.amount) > 0 &&
    Number(payment.exchange_rate) > 0,
  ).map((payment) => String(payment.exchange_rate));
}

export function usdUnitToThb(usd: number | null | undefined, fx: number) {
  if (usd == null || !Number.isFinite(usd) || usd < 0 || !Number.isFinite(fx) || fx <= 0) return null;
  return Number((usd * fx).toFixed(4));
}
