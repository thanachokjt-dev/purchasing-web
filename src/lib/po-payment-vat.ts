export function paymentVatRate(type: string | null | undefined, supplierName = "", supplierCode = "") {
  const name = supplierName.trim().toLowerCase().replace(/\s+/g, " ");
  const code = supplierCode.trim().toUpperCase();
  if (["CSD001", "ENGAGE001"].includes(code) || /^csd fashion\b/.test(name) || /^engage(?:\s|$)/.test(name)) return null;
  const paymentType = String(type ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!paymentType || ["shipping", "freight", "vat", "importvat", "vatimportvat"].includes(paymentType)) return null;
  return 7;
}

export function includedPaymentVat(amountThb: number, rate: number | null) {
  if (rate == null || !Number.isFinite(amountThb)) return null;
  // Match numeric(14,4) storage and PostgreSQL's positive half-up cent rounding.
  const grossUnits = Math.round(amountThb * 10000);
  return Math.round(grossUnits * rate / ((100 + rate) * 100)) / 100;
}
