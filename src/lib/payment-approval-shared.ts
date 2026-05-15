export const PAYMENT_DOCUMENT_TYPES = [
  "internal_system_po",
  "supplier_quote",
  "supplier_invoice",
  "supplier_po",
  "freight_invoice",
  "shipping_invoice",
  "tax_invoice",
  "duty_tax_receipt",
  "import_docs",
  "form_e",
  "payment_approval_evidence",
  "whatsapp_approval",
  "google_drive",
  "onedrive",
  "other",
] as const;

export type PaymentDocumentType = (typeof PAYMENT_DOCUMENT_TYPES)[number];
