"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  canCreatePo,
  canEditPo,
  canManagePayments,
  canReceivePo,
} from "@/lib/access-control";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type PoActionState = {
  ok: boolean;
  message: string;
  poId?: string;
  headerPurpose?: string;
  supplierDiscussionNote?: string;
};

const ACTIVE_RECEIVING_STATUSES = new Set(["inpro", "delivery", "final_payment"]);
const BLOCKED_RECEIVING_STATUSES = new Set([
  "closed",
  "cancelled",
  "canceled",
  "fully_received",
]);
const VALID_STATUSES = new Set([
  "draft",
  "waiting_for_approve",
  "follow_up",
  "inpro",
  "delivery",
  "final_payment",
  "closed",
  "cancelled",
]);

const initialError = (message: string): PoActionState => ({ ok: false, message });
const success = (message: string): PoActionState => ({ ok: true, message });

async function requirePoPermission(
  nextPath: string,
  allowed: (email: string) => boolean,
  message: string,
) {
  const profile = await requireUser(nextPath);
  if (profile.role !== "super_admin" || !allowed(profile.email)) {
    throw new Error(message);
  }
  return profile;
}

async function requireCreatePoPermission(nextPath = "/po") {
  return requirePoPermission(nextPath, canCreatePo, "You do not have permission to create purchase orders.");
}

async function requireEditPoPermission(nextPath = "/po") {
  return requirePoPermission(nextPath, canEditPo, "You do not have permission to edit purchase orders.");
}

async function requireReceivePoPermission(nextPath = "/po") {
  return requirePoPermission(nextPath, canReceivePo, "You do not have permission to receive purchase orders.");
}

async function requireManagePaymentPermission(nextPath = "/po") {
  return requirePoPermission(nextPath, canManagePayments, "You do not have permission to manage PO payments.");
}

function numericValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requiredText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function optionalDateText(formData: FormData, name: string) {
  const value = optionalText(formData, name);
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must be a date`);
  }

  return value;
}

function todayDateText() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function insertPoReceiptRows(
  supabase: ReturnType<typeof actionClient>,
  rows: Array<{
    actual_received_date: string;
    note: string | null;
    po_item_id: string;
    received_at: string;
    received_by: string | null;
    received_qty: number;
    source: string;
  }>,
) {
  const { error } = await supabase.from("po_receipts").insert(rows);
  if (!error) {
    return;
  }

  if (!schemaColumnMiss(error.message)) {
    throw new Error(error.message);
  }

  const fallbackRows = rows.map((row) => ({
    note: row.note,
    po_item_id: row.po_item_id,
    received_at: row.received_at,
    received_by: row.received_by,
    received_qty: row.received_qty,
    source: row.source,
  }));
  const { error: fallbackError } = await supabase.from("po_receipts").insert(fallbackRows);
  if (fallbackError) {
    throw new Error(fallbackError.message);
  }
}

function positiveNumber(formData: FormData, name: string) {
  const value = Number(formData.get(name));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be greater than 0`);
  }
  return value;
}

function receiveQuantity(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? "").trim();
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
  return parsed;
}

function nonNegativeNumber(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) {
    return 0;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be 0 or greater`);
  }
  return value;
}

function positiveRate(formData: FormData, name: string, fallback = 1) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be greater than 0`);
  }
  return value;
}

function nonNegativeTextNumber(value: string, label: string) {
  if (!value.trim()) {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be 0 or greater`);
  }
  return parsed;
}

function formText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function normalizeStatus(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function orderIsClosedOrCancelled(order: {
  work_status?: string | null;
  closed_at?: string | null;
  cancelled_at?: string | null;
}) {
  const status = normalizeStatus(order.work_status ?? "");
  return Boolean(
    order.closed_at ||
      order.cancelled_at ||
      status === "closed" ||
      status === "cancelled" ||
      status === "canceled",
  );
}

function assertReceivableLineStatus(statusValue: string | null | undefined, lineLabel: string) {
  const status = normalizeStatus(statusValue ?? "");
  if (BLOCKED_RECEIVING_STATUSES.has(status)) {
    throw new Error(`${lineLabel} is closed, cancelled, or fully received and cannot be received`);
  }
  if (!ACTIVE_RECEIVING_STATUSES.has(status)) {
    throw new Error(`${lineLabel} must be in progress, delivery, or final payment before receiving`);
  }
}

function receiptOutstandingQty(total: {
  ordered_qty?: number | string | null;
  total_received_qty?: number | string | null;
  outstanding_qty?: number | string | null;
}) {
  const orderedQty = numericValue(total.ordered_qty);
  const totalReceivedQty = numericValue(total.total_received_qty);
  const calculatedOutstandingQty = Math.max(0, orderedQty - totalReceivedQty);
  const viewOutstandingQty = numericValue(total.outstanding_qty);

  // The hard cap is ordered qty minus all received qty. The receipt-total view
  // can be stricter when a line has cancelled qty, so use the smaller value.
  return Math.min(calculatedOutstandingQty, viewOutstandingQty);
}

function generatedPoId() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 17);
  return `PO-${stamp}`;
}

function actionClient() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase service credentials are required for PO writes");
  }
  return supabase;
}

function refreshPoViews(poId?: string | null) {
  revalidatePath("/po");
  revalidatePath("/");
  if (poId) {
    revalidatePath(`/po/${encodeURIComponent(poId)}`);
  }
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function schemaColumnMiss(errorMessage: string) {
  const message = errorMessage.toLowerCase();
  return message.includes("schema cache") || message.includes("column");
}

function appendStampedNote(existingNote: string | null | undefined, nextNote: string | null) {
  if (!nextNote) {
    return existingNote?.trim() || null;
  }

  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const entry = `[${stamp}] ${nextNote}`;
  const existing = existingNote?.trim();
  return existing ? `${existing}\n\n${entry}` : entry;
}

const NON_PRODUCT_PAYMENT_TYPES = new Set([
  "freight",
  "shipping",
  "fine",
  "penalty",
  "other",
  "other_cost",
]);

function isProductPaymentType(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return !NON_PRODUCT_PAYMENT_TYPES.has(normalized);
}

async function exchangeRateByCurrency(poId: string) {
  const supabase = actionClient();
  const rates = new Map<string, number>([["THB", 1]]);

  const { data, error } = await supabase
    .from("po_payments")
    .select("currency,payment_type,exchange_rate,payment_date,created_at")
    .eq("po_id", poId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.toLowerCase().includes("exchange_rate")) {
      return rates;
    }
    throw new Error(error.message);
  }

  for (const payment of (data ?? []) as Array<{
    currency: string | null;
    payment_type: string | null;
    exchange_rate: number | string | null;
  }>) {
    const currency = String(payment.currency ?? "THB").trim().toUpperCase();
    const rate = Number(payment.exchange_rate ?? 0);
    if (!currency || rates.has(currency) || !isProductPaymentType(payment.payment_type)) {
      continue;
    }
    if (Number.isFinite(rate) && rate > 0) {
      rates.set(currency, rate);
    }
  }

  return rates;
}

async function recalculatePoAmount(poId: string) {
  const supabase = actionClient();
  const rates = await exchangeRateByCurrency(poId);
  const { data: order, error: orderReadError } = await supabase
    .from("po_orders")
    .select("currency")
    .eq("po_id", poId)
    .maybeSingle();

  if (orderReadError) {
    throw new Error(orderReadError.message);
  }

  const orderCurrency = String(order?.currency ?? "THB").trim().toUpperCase();
  const { data: items, error: itemError } = await supabase
    .from("po_items")
    .select("ordered_qty,unit_price,freight_unit_cost,currency")
    .eq("po_id", poId);

  if (itemError) {
    throw new Error(itemError.message);
  }

  const totals = ((items ?? []) as Array<{
    ordered_qty: number | string | null;
    unit_price: number | string | null;
    freight_unit_cost?: number | string | null;
    currency: string | null;
  }>).reduce(
    (sum, item) => {
      const qty = Number(item.ordered_qty ?? 0);
      const unitPrice = Number(item.unit_price ?? 0);
      const freightUnitCost = Number(item.freight_unit_cost ?? 0);
      const currency = String(item.currency ?? "THB").trim().toUpperCase();
      const landedAmount = qty * (unitPrice + freightUnitCost);
      const exchangeRate = rates.get(currency) ?? 0;
      const orderExchangeRate = rates.get(orderCurrency) ?? 0;
      const amountThb = currency === "THB" ? landedAmount : landedAmount * exchangeRate;
      const amountForeign =
        currency === orderCurrency
          ? landedAmount
          : currency === "THB" && orderCurrency !== "THB" && orderExchangeRate > 0
            ? landedAmount / orderExchangeRate
            : landedAmount;

      return {
        amountForeign: sum.amountForeign + amountForeign,
        amountThb: sum.amountThb + amountThb,
      };
    },
    { amountForeign: 0, amountThb: 0 },
  );

  const { error: orderUpdateError } = await supabase
    .from("po_orders")
    .update({
      po_amount_foreign: totals.amountForeign,
      po_amount_thb: totals.amountThb,
      updated_at: new Date().toISOString(),
    })
    .eq("po_id", poId);

  if (orderUpdateError) {
    throw new Error(orderUpdateError.message);
  }
}

async function supplierSnapshot(supplierCode: string) {
  const supabase = actionClient();
  const { data, error } = await supabase
    .from("po_suppliers")
    .select("supplier_code,supplier_name,currency,payment_terms")
    .eq("supplier_code", supplierCode)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(`Supplier ${supplierCode} does not exist`);
  }

  return data as {
    supplier_code: string;
    supplier_name: string;
    currency: string | null;
    payment_terms: string | null;
  };
}

export async function createPoAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  let createdPoId: string | null = null;

  try {
    await requireCreatePoPermission("/po");
    const supabase = actionClient();
    const supplierCode = requiredText(formData, "supplierCode");
    const supplier = await supplierSnapshot(supplierCode);
    const poId = optionalText(formData, "poId") ?? generatedPoId();
    const poDate = optionalText(formData, "poDate") ?? new Date().toISOString().slice(0, 10);
    const sku = requiredText(formData, "sku");
    const orderedQty = positiveNumber(formData, "orderedQty");
    const unitPrice = nonNegativeNumber(formData, "unitPrice");
    const freightUnitCost = nonNegativeNumber(formData, "freightUnitCost");
    const currency = optionalText(formData, "currency") ?? supplier.currency ?? "THB";
    const landedUnitCost = unitPrice + freightUnitCost;
    const lineAmount = orderedQty * unitPrice;
    const landedAmount = orderedQty * landedUnitCost;

    const { error: orderError } = await supabase.from("po_orders").insert({
      po_id: poId,
      po_title: optionalText(formData, "poTitle") ?? poId,
      po_date: poDate,
      work_status: "draft",
      requester: optionalText(formData, "requester"),
      owner: optionalText(formData, "owner"),
      supplier_code: supplier.supplier_code,
      supplier_name_snapshot: supplier.supplier_name,
      currency,
      po_amount_foreign: landedAmount,
      po_amount_thb: currency === "THB" ? landedAmount : 0,
      payment_terms_snapshot: supplier.payment_terms,
      source: "web_app",
      updated_at: new Date().toISOString(),
    });
    if (orderError) {
      throw new Error(orderError.message);
    }

    const { error: itemError } = await supabase.from("po_items").insert({
      po_item_id: `${poId}-1`,
      po_id: poId,
      line_no: "1",
      sort_position: 1,
      sku,
      product_title_snapshot: optionalText(formData, "productTitle") ?? sku,
      variant_title_snapshot: optionalText(formData, "variantTitle"),
      ordered_qty: orderedQty,
      unit_price: unitPrice,
      line_amount: lineAmount,
      freight_unit_cost: freightUnitCost,
      landed_unit_cost: landedUnitCost,
      currency,
      remark: optionalText(formData, "remark"),
      full_name: optionalText(formData, "productTitle") ?? sku,
      line_status: "draft",
      source: "web_app",
      updated_at: new Date().toISOString(),
    });
    if (itemError) {
      await supabase.from("po_orders").delete().eq("po_id", poId);
      throw new Error(itemError.message);
    }

    await supabase.from("po_status_events").insert({
      po_id: poId,
      to_status: "draft",
      actor: optionalText(formData, "actor") ?? optionalText(formData, "owner"),
      note: "PO created in web app",
    });

    createdPoId = poId;
    refreshPoViews(poId);
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Create PO failed");
  }

  if (createdPoId) {
    redirect(`/po/${encodeURIComponent(createdPoId)}`);
  }

  return success("Created PO");
}

export async function addPoItemAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  let redirectPoId: string | null = null;

  try {
    await requireEditPoPermission("/po");
    const supabase = actionClient();
    const poId = requiredText(formData, "poId");
    const sku = requiredText(formData, "sku");
    const orderedQty = positiveNumber(formData, "orderedQty");
    const unitPrice = nonNegativeNumber(formData, "unitPrice");
    const freightUnitCost = nonNegativeNumber(formData, "freightUnitCost");

    const { data: order, error: orderError } = await supabase
      .from("po_orders")
      .select("po_id,currency,po_amount_foreign,po_amount_thb,closed_at,cancelled_at")
      .eq("po_id", poId)
      .maybeSingle();
    if (orderError) {
      throw new Error(orderError.message);
    }
    if (!order) {
      throw new Error(`PO ${poId} does not exist`);
    }
    if (order.closed_at || order.cancelled_at) {
      throw new Error(`PO ${poId} is closed or cancelled`);
    }

    const { count, error: countError } = await supabase
      .from("po_items")
      .select("id", { count: "exact", head: true })
      .eq("po_id", poId);
    if (countError) {
      throw new Error(countError.message);
    }

    const lineNo = String((count ?? 0) + 1);
    const currency = optionalText(formData, "currency") ?? order.currency ?? "THB";
    const landedUnitCost = unitPrice + freightUnitCost;
    const lineAmount = orderedQty * unitPrice;

    const { error: itemError } = await supabase.from("po_items").insert({
      po_item_id: `${poId}-${lineNo}`,
      po_id: poId,
      line_no: lineNo,
      sort_position: Number(lineNo),
      sku,
      product_title_snapshot: optionalText(formData, "productTitle") ?? sku,
      variant_title_snapshot: optionalText(formData, "variantTitle"),
      ordered_qty: orderedQty,
      unit_price: unitPrice,
      line_amount: lineAmount,
      freight_unit_cost: freightUnitCost,
      landed_unit_cost: landedUnitCost,
      currency,
      remark: optionalText(formData, "remark"),
      full_name: optionalText(formData, "productTitle") ?? sku,
      line_status: "draft",
      source: "web_app",
      updated_at: new Date().toISOString(),
    });
    if (itemError) {
      throw new Error(itemError.message);
    }

    await recalculatePoAmount(poId);
    refreshPoViews(poId);
    redirectPoId = poId;
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Add PO item failed");
  }

  if (redirectPoId) {
    redirect(`/po/${encodeURIComponent(redirectPoId)}#draft-lines`);
  }

  return success("Added PO item");
}

export async function addPoItemsBatchAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  let redirectPoId: string | null = null;

  try {
    await requireEditPoPermission("/po");
    const supabase = actionClient();
    const poId = requiredText(formData, "poId");
    const selectedSkus = new Set(
      formData.getAll("selectedSku").map((value) => String(value).trim()).filter(Boolean),
    );
    const skus = formData.getAll("sku").map((value) => String(value).trim());
    const productTitles = formData.getAll("productTitle").map((value) => String(value).trim());
    const variantTitles = formData.getAll("variantTitle").map((value) => String(value).trim());
    const qtyValues = formData.getAll("orderedQty").map((value) => String(value).trim());
    const priceValues = formData.getAll("unitPrice").map((value) => String(value).trim());
    const freightValues = formData.getAll("freightUnitCost").map((value) => String(value).trim());
    const currencyValues = formData.getAll("currency").map((value) => String(value).trim());
    const remark = optionalText(formData, "remark");

    if (!selectedSkus.size) {
      throw new Error("Select at least one SKU to add");
    }

    const { data: order, error: orderError } = await supabase
      .from("po_orders")
      .select("po_id,currency,closed_at,cancelled_at")
      .eq("po_id", poId)
      .maybeSingle();
    if (orderError) {
      throw new Error(orderError.message);
    }
    if (!order || order.closed_at || order.cancelled_at) {
      throw new Error(`PO ${poId} is closed, cancelled, or missing`);
    }

    const { count, error: countError } = await supabase
      .from("po_items")
      .select("id", { count: "exact", head: true })
      .eq("po_id", poId);
    if (countError) {
      throw new Error(countError.message);
    }

    const batchStamp = new Date().toISOString().replace(/\D/g, "").slice(0, 17);
    let addedLineIndex = 0;
    const rows = skus.flatMap((sku, index) => {
      if (!sku || !selectedSkus.has(sku)) {
        return [];
      }
      const orderedQty = nonNegativeTextNumber(qtyValues[index] ?? "", `${sku} qty`);
      if (orderedQty <= 0) {
        return [];
      }
      const unitPrice = nonNegativeTextNumber(priceValues[index] ?? "", `${sku} price`);
      const freightUnitCost = nonNegativeTextNumber(freightValues[index] ?? "", `${sku} freight`);
      const currency = currencyValues[index] || order.currency || "THB";
      addedLineIndex += 1;
      const lineNo = String((count ?? 0) + addedLineIndex);
      return [
        {
          po_item_id: `${poId}-${batchStamp}-${addedLineIndex}`,
          po_id: poId,
          line_no: lineNo,
          sort_position: Number(lineNo),
          sku,
          product_title_snapshot: productTitles[index] || sku,
          variant_title_snapshot: variantTitles[index] || null,
          ordered_qty: orderedQty,
          unit_price: unitPrice,
          freight_unit_cost: freightUnitCost,
          landed_unit_cost: unitPrice + freightUnitCost,
          line_amount: orderedQty * unitPrice,
          currency,
          remark,
          full_name: productTitles[index] || sku,
          line_status: "draft",
          source: "web_app",
          updated_at: new Date().toISOString(),
        },
      ];
    });

    if (!rows.length) {
      throw new Error("Selected SKUs need quantity greater than 0");
    }

    const { error: itemError } = await supabase.from("po_items").insert(rows);
    if (itemError) {
      throw new Error(itemError.message);
    }

    await recalculatePoAmount(poId);
    refreshPoViews(poId);
    redirectPoId = poId;
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Add selected lines failed");
  }

  if (redirectPoId) {
    redirect(`/po/${encodeURIComponent(redirectPoId)}#draft-lines`);
  }

  return success("Added selected lines");
}

export async function updatePoHeaderRefsAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  try {
    await requireEditPoPermission("/po");
    const supabase = actionClient();
    const poId = requiredText(formData, "poId");
    const updateScope = optionalText(formData, "updateScope");
    const quickCommentOnly = updateScope === "quickComment";
    const supplierDiscussionNote = optionalText(formData, "supplierDiscussionNote");
    const estimatedDeliveryDate = optionalDateText(formData, "estimatedDeliveryDate");
    const estimatedArrivedDate = optionalDateText(formData, "estimatedArrivedDate");
    const actualReceivedDate = optionalDateText(formData, "actualReceivedDate");
    let { data: currentOrder, error: currentOrderError } = await supabase
      .from("po_orders")
      .select(
        [
          "work_status",
          "source_payload",
          "header_purpose",
          "quotation_reference",
          "supplier_invoice_no",
          "estimated_delivery_date",
          "estimated_arrived_date",
          "actual_received_date",
          "supplier_discussion_note",
        ].join(","),
      )
      .eq("po_id", poId)
      .maybeSingle();

    if (currentOrderError && schemaColumnMiss(currentOrderError.message)) {
      const fallback = await supabase
        .from("po_orders")
        .select(
          [
            "work_status",
            "source_payload",
            "quotation_reference",
            "supplier_invoice_no",
            "estimated_delivery_date",
            "estimated_arrived_date",
            "actual_received_date",
            "supplier_discussion_note",
          ].join(","),
        )
        .eq("po_id", poId)
        .maybeSingle();
      currentOrder = fallback.data;
      currentOrderError = fallback.error;
    }

    if (currentOrderError) {
      throw new Error(currentOrderError.message);
    }
    if (!currentOrder) {
      throw new Error(`PO ${poId} does not exist`);
    }
    const currentOrderRow = currentOrder as {
      actual_received_date?: string | null;
      estimated_arrived_date?: string | null;
      estimated_delivery_date?: string | null;
      header_purpose?: string | null;
      quotation_reference?: string | null;
      source_payload?: unknown;
      supplier_discussion_note?: string | null;
      supplier_invoice_no?: string | null;
      work_status?: string | null;
    };

    const sourcePayload = objectValue(currentOrderRow.source_payload);
    const currentHeader = objectValue(sourcePayload.po_detail_header);
    const currentSupplierNote =
      typeof currentOrderRow.supplier_discussion_note === "string" &&
      currentOrderRow.supplier_discussion_note.trim()
        ? currentOrderRow.supplier_discussion_note
        : typeof currentHeader.supplierDiscussionNote === "string"
        ? currentHeader.supplierDiscussionNote
        : "";
    const appendedSupplierNote = appendStampedNote(currentSupplierNote, supplierDiscussionNote);
    const supplierUpdateHistory = Array.isArray(currentHeader.supplierDiscussionUpdates)
      ? currentHeader.supplierDiscussionUpdates
      : [];
    const headerText = (key: string) => {
      const value = currentHeader[key];
      return typeof value === "string" ? value.trim() : "";
    };
    const preservedHeaderPurpose =
      String(currentOrderRow.header_purpose ?? "").trim() ||
      headerText("headerPurpose");
    const preservedQuotationReference =
      String(currentOrderRow.quotation_reference ?? "").trim() ||
      headerText("quotationReference");
    const preservedSupplierInvoiceNo =
      String(currentOrderRow.supplier_invoice_no ?? "").trim() ||
      headerText("supplierInvoiceNo");
    const preservedEstimatedDeliveryDate =
      String(currentOrderRow.estimated_delivery_date ?? "").trim() ||
      headerText("estimatedDeliveryDate");
    const preservedEstimatedArrivedDate =
      String(currentOrderRow.estimated_arrived_date ?? "").trim() ||
      headerText("estimatedArrivedDate");
    const preservedActualReceivedDate =
      String(currentOrderRow.actual_received_date ?? "").trim() ||
      headerText("actualReceivedDate");
    const submittedHeaderPurpose = optionalText(formData, "headerPurpose");
    const submittedQuotationReference = optionalText(formData, "quotationReference");
    const submittedSupplierInvoiceNo = optionalText(formData, "supplierInvoiceNo");
    const updatePayload: Record<string, string | null> = {
      header_purpose:
        quickCommentOnly && !submittedHeaderPurpose
          ? preservedHeaderPurpose || null
          : submittedHeaderPurpose,
      quotation_reference:
        quickCommentOnly && !submittedQuotationReference
          ? preservedQuotationReference || null
          : submittedQuotationReference,
      supplier_invoice_no:
        quickCommentOnly && !submittedSupplierInvoiceNo
          ? preservedSupplierInvoiceNo || null
          : submittedSupplierInvoiceNo,
      estimated_delivery_date:
        quickCommentOnly && !estimatedDeliveryDate
          ? preservedEstimatedDeliveryDate || null
          : estimatedDeliveryDate,
      estimated_arrived_date:
        quickCommentOnly && !estimatedArrivedDate
          ? preservedEstimatedArrivedDate || null
          : estimatedArrivedDate,
      actual_received_date:
        quickCommentOnly && !actualReceivedDate
          ? preservedActualReceivedDate || null
          : actualReceivedDate,
      updated_at: new Date().toISOString(),
    };
    if (supplierDiscussionNote) {
      updatePayload.supplier_discussion_note = appendedSupplierNote;
    }

    const { error } = await supabase
      .from("po_orders")
      .update(updatePayload)
      .eq("po_id", poId);
    if (error) {
      if (!schemaColumnMiss(error.message)) {
        throw new Error(error.message);
      }

      const fallbackHeader = {
        ...currentHeader,
        headerPurpose: updatePayload.header_purpose,
        quotationReference: updatePayload.quotation_reference,
        supplierInvoiceNo: updatePayload.supplier_invoice_no,
        estimatedDeliveryDate: updatePayload.estimated_delivery_date,
        estimatedArrivedDate: updatePayload.estimated_arrived_date,
        actualReceivedDate: updatePayload.actual_received_date,
        supplierDiscussionNote: appendedSupplierNote,
        supplierDiscussionUpdates: supplierDiscussionNote
          ? [
              ...supplierUpdateHistory,
              {
                note: supplierDiscussionNote,
                createdAt: new Date().toISOString(),
              },
            ]
          : supplierUpdateHistory,
      };
      const fallbackUpdate = await supabase
        .from("po_orders")
        .update({
          quotation_reference: updatePayload.quotation_reference,
          supplier_invoice_no: updatePayload.supplier_invoice_no,
          source_payload: {
            ...sourcePayload,
            po_detail_header: fallbackHeader,
          },
          updated_at: updatePayload.updated_at,
        })
        .eq("po_id", poId);
      if (fallbackUpdate.error) {
        throw new Error(fallbackUpdate.error.message);
      }
    }

    if (supplierDiscussionNote) {
      await supabase.from("po_status_events").insert({
        po_id: poId,
        from_status: currentOrderRow.work_status ?? null,
        to_status: currentOrderRow.work_status ?? "update",
        note: `Supplier update: ${supplierDiscussionNote}`,
      });
    }

    refreshPoViews(poId);
    return {
      ...success("Saved PO header"),
      headerPurpose: updatePayload.header_purpose ?? "",
      supplierDiscussionNote: appendedSupplierNote ?? "",
    };
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Save PO header failed");
  }
}

export async function changePoStatusAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  try {
    await requireEditPoPermission("/po");
    const supabase = actionClient();
    const poId = requiredText(formData, "poId");
    const itemUuid = optionalText(formData, "itemUuid");
    const toStatus = normalizeStatus(requiredText(formData, "toStatus"));
    const actor = optionalText(formData, "actor");

    if (!VALID_STATUSES.has(toStatus)) {
      throw new Error(`Unsupported status: ${toStatus}`);
    }

    if (itemUuid) {
      const { data: item, error: itemReadError } = await supabase
        .from("po_items")
        .select("id,po_id,line_status")
        .eq("id", itemUuid)
        .maybeSingle();
      if (itemReadError) {
        throw new Error(itemReadError.message);
      }
      if (!item || item.po_id !== poId) {
        throw new Error("PO item does not match the selected PO");
      }

      const fromStatus = item.line_status ?? null;
      const { error: itemUpdateError } = await supabase
        .from("po_items")
        .update({ line_status: toStatus, updated_at: new Date().toISOString() })
        .eq("id", itemUuid);
      if (itemUpdateError) {
        throw new Error(itemUpdateError.message);
      }

      await supabase.from("po_status_events").insert({
        po_id: poId,
        po_item_id: itemUuid,
        from_status: fromStatus,
        to_status: toStatus,
        actor,
        note: optionalText(formData, "note"),
      });
    } else {
      const { data: order, error: orderReadError } = await supabase
        .from("po_orders")
        .select("work_status")
        .eq("po_id", poId)
        .maybeSingle();
      if (orderReadError) {
        throw new Error(orderReadError.message);
      }
      if (!order) {
        throw new Error(`PO ${poId} does not exist`);
      }

      if (toStatus === "closed") {
        const { data: receivedRows, error: receivedRowsError } = await supabase
          .from("po_item_receipt_totals")
          .select("total_received_qty")
          .eq("po_id", poId)
          .gt("total_received_qty", 0)
          .limit(1);

        if (receivedRowsError) {
          throw new Error(receivedRowsError.message);
        }
        if (!receivedRows?.length) {
          throw new Error("Receive stock before closing this PO");
        }
      }

      const timestampFields: Record<string, string | null> = {};
      if (!["closed", "cancelled"].includes(toStatus)) {
        timestampFields.closed_at = null;
        timestampFields.cancelled_at = null;
      }
      if (toStatus === "waiting_for_approve") {
        timestampFields.submitted_at = new Date().toISOString();
      }
      if (["inpro", "delivery", "final_payment"].includes(toStatus)) {
        timestampFields.approved_at = new Date().toISOString();
      }
      if (toStatus === "closed") {
        timestampFields.closed_at = new Date().toISOString();
      }
      if (toStatus === "cancelled") {
        timestampFields.cancelled_at = new Date().toISOString();
      }

      const { error: orderUpdateError } = await supabase
        .from("po_orders")
        .update({
          work_status: toStatus,
          updated_at: new Date().toISOString(),
          ...timestampFields,
        })
        .eq("po_id", poId);
      if (orderUpdateError) {
        throw new Error(orderUpdateError.message);
      }

      const { error: lineUpdateError } = await supabase
        .from("po_items")
        .update({ line_status: toStatus, updated_at: new Date().toISOString() })
        .eq("po_id", poId);
      if (lineUpdateError) {
        throw new Error(lineUpdateError.message);
      }

      await supabase.from("po_status_events").insert({
        po_id: poId,
        from_status: order.work_status ?? null,
        to_status: toStatus,
        actor,
        note: optionalText(formData, "note"),
      });
    }

    refreshPoViews(poId);
    return success(`Updated ${poId} to ${toStatus}`);
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Change status failed");
  }
}

export async function deleteDraftPoAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  try {
    await requireEditPoPermission("/po");
    const supabase = actionClient();
    const poId = requiredText(formData, "poId");

    const { data: order, error: orderError } = await supabase
      .from("po_orders")
      .select("po_id,work_status,closed_at,cancelled_at")
      .eq("po_id", poId)
      .maybeSingle();

    if (orderError) {
      throw new Error(orderError.message);
    }
    if (!order) {
      throw new Error(`PO ${poId} does not exist`);
    }

    const status = normalizeStatus(order.work_status ?? "");
    if (status !== "draft" || order.closed_at || order.cancelled_at) {
      throw new Error("Only draft POs can be deleted");
    }

    const { data: itemRows, error: itemError } = await supabase
      .from("po_items")
      .select("id")
      .eq("po_id", poId);

    if (itemError) {
      throw new Error(itemError.message);
    }

    const itemIds = ((itemRows ?? []) as Array<{ id: string }>).map((item) => item.id);
    const receiptQuery =
      itemIds.length > 0
        ? supabase
            .from("po_receipts")
            .select("id", { count: "exact", head: true })
            .in("po_item_id", itemIds)
        : Promise.resolve({ count: 0, error: null });
    const [
      { count: receiptCount, error: receiptError },
      { count: paymentCount, error: paymentError },
    ] = await Promise.all([
      receiptQuery,
      supabase
        .from("po_payments")
        .select("id", { count: "exact", head: true })
        .eq("po_id", poId),
    ]);

    if (receiptError) {
      throw new Error(receiptError.message);
    }
    if (paymentError) {
      throw new Error(paymentError.message);
    }
    if ((receiptCount ?? 0) > 0 || (paymentCount ?? 0) > 0) {
      throw new Error("POs with receipts or payments cannot be deleted");
    }

    const { error: deleteError } = await supabase
      .from("po_orders")
      .delete()
      .eq("po_id", poId)
      .eq("work_status", "draft");

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    refreshPoViews(poId);
    return success(`Deleted draft PO ${poId}`);
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Delete draft PO failed");
  }
}

export async function receivePoItemAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  try {
    await requireReceivePoPermission("/po");
    const supabase = actionClient();
    const itemUuid = requiredText(formData, "itemUuid");
    const receivedQty = receiveQuantity(formData.get("receivedQty"), "Receive quantity");

    const { data: item, error: itemError } = await supabase
      .from("po_items")
      .select("id,po_id,line_no,sku,line_status")
      .eq("id", itemUuid)
      .maybeSingle();
    if (itemError) {
      throw new Error(itemError.message);
    }
    if (!item) {
      throw new Error("PO item does not exist");
    }

    const { data: order, error: orderError } = await supabase
      .from("po_orders")
      .select("work_status,closed_at,cancelled_at,actual_received_date")
      .eq("po_id", item.po_id)
      .maybeSingle();
    if (orderError) {
      throw new Error(orderError.message);
    }
    if (!order) {
      throw new Error(`PO ${item.po_id} does not exist`);
    }
    if (orderIsClosedOrCancelled(order)) {
      throw new Error("Closed or cancelled POs cannot be received");
    }

    const lineLabel = `Line ${item.line_no ?? item.sku ?? itemUuid}`;
    assertReceivableLineStatus(item.line_status, lineLabel);

    const { data: receiptTotal, error: totalError } = await supabase
      .from("po_item_receipt_totals")
      .select("ordered_qty,total_received_qty,outstanding_qty")
      .eq("po_item_uuid", itemUuid)
      .maybeSingle();
    if (totalError) {
      throw new Error(totalError.message);
    }

    const outstandingQty = receiptOutstandingQty(receiptTotal ?? {});
    if (!Number.isFinite(outstandingQty) || outstandingQty <= 0) {
      throw new Error(`${lineLabel} is already fully received`);
    }
    if (receivedQty > outstandingQty) {
      throw new Error(`Receive quantity exceeds outstanding quantity (${outstandingQty})`);
    }

    const receivedAt = new Date().toISOString();
    const receiptDate =
      optionalDateText(formData, "receiptDate") ||
      String((order as { actual_received_date?: string | null }).actual_received_date ?? "").trim() ||
      todayDateText();
    await insertPoReceiptRows(supabase, [{
      actual_received_date: receiptDate,
      po_item_id: itemUuid,
      received_at: receivedAt,
      received_qty: receivedQty,
      received_by: optionalText(formData, "receivedBy"),
      note: optionalText(formData, "note"),
      source: "web_app",
    }]);

    refreshPoViews(item.po_id);
    return success(`Received ${receivedQty} units`);
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Receive item failed");
  }
}

export async function batchReceivePoItemsAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  try {
    await requireReceivePoPermission("/po");
    const supabase = actionClient();
    const poId = requiredText(formData, "poId");
    const itemUuids = formData.getAll("batchItemUuid").map((value) => String(value).trim());
    const qtyValues = formData.getAll("batchReceivedQty").map((value) => String(value).trim());

    if (itemUuids.length !== qtyValues.length) {
      throw new Error("Receive lines are mismatched. Reload the page and try again.");
    }

    const requestedReceipts = itemUuids.flatMap((itemUuid, index) => {
      const qtyText = qtyValues[index] ?? "";
      if (!qtyText) {
        return [];
      }

      if (!itemUuid) {
        throw new Error(`Line ${index + 1} is missing an item id`);
      }
      const receivedQty = receiveQuantity(qtyText, `Line ${index + 1} receive quantity`);

      return [{ itemUuid, receivedQty }];
    });

    if (requestedReceipts.length === 0) {
      throw new Error("Enter at least one receive quantity");
    }

    const uniqueItemUuids = Array.from(
      new Set(requestedReceipts.map((receipt) => receipt.itemUuid)),
    );

    const { data: order, error: orderError } = await supabase
      .from("po_orders")
      .select("work_status,closed_at,cancelled_at,actual_received_date")
      .eq("po_id", poId)
      .maybeSingle();
    if (orderError) {
      throw new Error(orderError.message);
    }
    if (!order) {
      throw new Error(`PO ${poId} does not exist`);
    }
    if (orderIsClosedOrCancelled(order)) {
      throw new Error("Closed or cancelled POs cannot be received");
    }

    const { data: items, error: itemError } = await supabase
      .from("po_items")
      .select("id,po_id,line_no,sku,line_status")
      .in("id", uniqueItemUuids);
    if (itemError) {
      throw new Error(itemError.message);
    }

    const itemById = new Map(
      ((items ?? []) as Array<{
        id: string;
        po_id: string | null;
        line_no: string | null;
        sku: string | null;
        line_status: string | null;
      }>).map((item) => [item.id, item]),
    );

    const { data: totals, error: totalError } = await supabase
      .from("po_item_receipt_totals")
      .select("po_item_uuid,ordered_qty,total_received_qty,outstanding_qty")
      .in("po_item_uuid", uniqueItemUuids);
    if (totalError) {
      throw new Error(totalError.message);
    }

    const outstandingByItemId = new Map(
      ((totals ?? []) as Array<{
        po_item_uuid: string | null;
        ordered_qty: number | string | null;
        total_received_qty: number | string | null;
        outstanding_qty: number | string | null;
      }>)
        .filter((row) => row.po_item_uuid)
        .map((row) => [row.po_item_uuid, receiptOutstandingQty(row)]),
    );
    const requestedQtyByItemId = requestedReceipts.reduce((map, receipt) => {
      map.set(receipt.itemUuid, (map.get(receipt.itemUuid) ?? 0) + receipt.receivedQty);
      return map;
    }, new Map<string, number>());

    for (const receipt of requestedReceipts) {
      const item = itemById.get(receipt.itemUuid);
      if (!item) {
        throw new Error(`PO item ${receipt.itemUuid} does not exist`);
      }
      if (item.po_id !== poId) {
        throw new Error(`Line ${item.line_no ?? item.sku ?? receipt.itemUuid} does not belong to ${poId}`);
      }

      const lineLabel = `Line ${item.line_no ?? item.sku ?? receipt.itemUuid}`;
      assertReceivableLineStatus(item.line_status, lineLabel);

      const outstandingQty = outstandingByItemId.get(receipt.itemUuid) ?? 0;
      if (!Number.isFinite(outstandingQty) || outstandingQty <= 0) {
        throw new Error(`${lineLabel} is already fully received`);
      }
      const totalRequestedQty = requestedQtyByItemId.get(receipt.itemUuid) ?? receipt.receivedQty;
      if (totalRequestedQty > outstandingQty) {
        throw new Error(
          `${lineLabel} receive quantity exceeds outstanding quantity (${outstandingQty})`,
        );
      }
    }

    const receivedBy = optionalText(formData, "receivedBy");
    const note = optionalText(formData, "note");
    const receivedAt = new Date().toISOString();
    const receiptDate =
      optionalDateText(formData, "receiptDate") ||
      String((order as { actual_received_date?: string | null }).actual_received_date ?? "").trim() ||
      todayDateText();
    await insertPoReceiptRows(
      supabase,
      requestedReceipts.map((receipt) => ({
        actual_received_date: receiptDate,
        po_item_id: receipt.itemUuid,
        received_at: receivedAt,
        received_qty: receipt.receivedQty,
        received_by: receivedBy,
        note,
        source: "web_app",
      })),
    );

    const totalQty = requestedReceipts.reduce((sum, receipt) => sum + receipt.receivedQty, 0);
    refreshPoViews(poId);
    return success(
      `Received ${totalQty} units across ${requestedReceipts.length} lines`,
    );
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Batch receive failed");
  }
}

export async function removePoReceiptAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  try {
    await requireReceivePoPermission("/po");
    const supabase = actionClient();
    const poId = requiredText(formData, "poId");
    const receiptId = requiredText(formData, "receiptId");

    const { data: receipt, error: receiptError } = await supabase
      .from("po_receipts")
      .select("id,po_item_id")
      .eq("id", receiptId)
      .maybeSingle();

    if (receiptError) {
      throw new Error(receiptError.message);
    }
    if (!receipt) {
      throw new Error("Receipt does not exist");
    }

    const { data: item, error: itemError } = await supabase
      .from("po_items")
      .select("po_id")
      .eq("id", (receipt as { po_item_id: string | null }).po_item_id)
      .maybeSingle();

    if (itemError) {
      throw new Error(itemError.message);
    }
    if (!item || item.po_id !== poId) {
      throw new Error("Receipt does not belong to this PO");
    }

    const { error: deleteError } = await supabase
      .from("po_receipts")
      .delete()
      .eq("id", receiptId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    refreshPoViews(poId);
    return success("Removed receipt round");
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Remove receipt failed");
  }
}

export async function updatePoDraftLinesAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  try {
    await requireEditPoPermission("/po");
    const supabase = actionClient();
    const poId = requiredText(formData, "poId");
    const itemUuids = formData.getAll("itemUuid").map((value) => String(value).trim());
    const deleteItemUuids = new Set(
      formData.getAll("deleteItemUuid").map((value) => String(value).trim()).filter(Boolean),
    );
    const skus = formData.getAll("sku").map((value) => String(value).trim());
    const productTitles = formData.getAll("productTitle").map((value) => String(value).trim());
    const qtyValues = formData.getAll("orderedQty").map((value) => String(value).trim());
    const priceValues = formData.getAll("unitPrice").map((value) => String(value).trim());
    const freightValues = formData.getAll("freightUnitCost").map((value) => String(value).trim());
    const currencyValues = formData.getAll("currency").map((value) => String(value).trim());
    const remarkValues = formData.getAll("remark").map((value) => String(value).trim());

    if (!itemUuids.length) {
      throw new Error("No PO lines to update");
    }

    if (deleteItemUuids.size > 0) {
      const { error } = await supabase
        .from("po_items")
        .delete()
        .eq("po_id", poId)
        .in("id", Array.from(deleteItemUuids));
      if (error) {
        throw new Error(error.message);
      }
    }

    let nextLineNo = 1;
    for (const [index, itemUuid] of itemUuids.entries()) {
      if (!itemUuid) {
        continue;
      }
      if (deleteItemUuids.has(itemUuid)) {
        continue;
      }

      const sku = skus[index] ?? "";
      if (!sku) {
        throw new Error(`Line ${index + 1} SKU is required`);
      }

      const orderedQty = nonNegativeTextNumber(qtyValues[index] ?? "", `Line ${index + 1} qty`);
      const unitPrice = nonNegativeTextNumber(priceValues[index] ?? "", `Line ${index + 1} price`);
      const freightUnitCost = nonNegativeTextNumber(
        freightValues[index] ?? "",
        `Line ${index + 1} freight`,
      );
      const currency = (currencyValues[index] || "THB").toUpperCase();
      const landedUnitCost = unitPrice + freightUnitCost;

      const { error } = await supabase
        .from("po_items")
        .update({
          sku,
          product_title_snapshot: productTitles[index] || sku,
          full_name: productTitles[index] || sku,
          line_no: String(nextLineNo),
          sort_position: nextLineNo,
          ordered_qty: orderedQty,
          unit_price: unitPrice,
          freight_unit_cost: freightUnitCost,
          landed_unit_cost: landedUnitCost,
          line_amount: orderedQty * unitPrice,
          currency,
          remark: remarkValues[index] || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemUuid)
        .eq("po_id", poId);

      if (error) {
        throw new Error(error.message);
      }
      nextLineNo += 1;
    }

    await recalculatePoAmount(poId);
    refreshPoViews(poId);
    return success(`Saved draft details for ${itemUuids.length} lines`);
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Save draft failed");
  }
}

export async function allocatePoLandedCostAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  try {
    await requireEditPoPermission("/po");
    const supabase = actionClient();
    const poId = requiredText(formData, "poId");
    const freightTotal = nonNegativeNumber(formData, "freightTotal");
    const otherLandedCostTotal = nonNegativeNumber(formData, "otherLandedCostTotal");
    const landedCostNote = optionalText(formData, "landedCostNote");
    const totalLandedCost = freightTotal + otherLandedCostTotal;

    const { data: items, error: itemReadError } = await supabase
      .from("po_items")
      .select("id,ordered_qty,unit_price")
      .eq("po_id", poId);

    if (itemReadError) {
      throw new Error(itemReadError.message);
    }

    const lines = (items ?? []) as Array<{
      id: string;
      ordered_qty: number | string | null;
      unit_price: number | string | null;
    }>;
    const totalQty = lines.reduce((sum, item) => sum + Number(item.ordered_qty ?? 0), 0);

    if (totalQty <= 0) {
      throw new Error("PO quantity must be greater than 0 before allocation");
    }

    const freightUnitCost = totalLandedCost / totalQty;

    for (const item of lines) {
      const unitPrice = Number(item.unit_price ?? 0);
      const { error } = await supabase
        .from("po_items")
        .update({
          freight_unit_cost: freightUnitCost,
          landed_unit_cost: unitPrice + freightUnitCost,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (error) {
        throw new Error(error.message);
      }
    }

    const { error: orderUpdateError } = await supabase
      .from("po_orders")
      .update({
        freight_total: freightTotal,
        other_landed_cost_total: otherLandedCostTotal,
        landed_cost_note: landedCostNote,
        updated_at: new Date().toISOString(),
      })
      .eq("po_id", poId);

    if (orderUpdateError) {
      throw new Error(orderUpdateError.message);
    }

    await recalculatePoAmount(poId);
    refreshPoViews(poId);
    return success(`Allocated ${totalLandedCost.toFixed(2)} across ${totalQty} units`);
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Allocate landed cost failed");
  }
}

export async function addPoPaymentAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  try {
    await requireManagePaymentPermission("/po");
    const supabase = actionClient();
    const poId = requiredText(formData, "poId");
    const amount = nonNegativeNumber(formData, "amount");
    const exchangeRate = positiveRate(formData, "exchangeRate");
    const currencyInput = optionalText(formData, "currency");

    const { data: order, error: orderError } = await supabase
      .from("po_orders")
      .select("currency")
      .eq("po_id", poId)
      .maybeSingle();

    if (orderError) {
      throw new Error(orderError.message);
    }
    if (!order) {
      throw new Error(`PO ${poId} does not exist`);
    }

    const { error } = await supabase.from("po_payments").insert({
      po_id: poId,
      payment_date: optionalText(formData, "paymentDate") ?? new Date().toISOString().slice(0, 10),
      payment_type: optionalText(formData, "paymentType") ?? "payment",
      amount,
      currency: currencyInput || order.currency || "THB",
      exchange_rate: exchangeRate,
      amount_thb: amount * exchangeRate,
      paid_by: optionalText(formData, "paidBy"),
      reference: optionalText(formData, "reference"),
      note: optionalText(formData, "note"),
    });

    if (error) {
      throw new Error(error.message);
    }

    await recalculatePoAmount(poId);
    refreshPoViews(poId);
    return success(`Recorded payment ${amount}`);
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Add payment failed");
  }
}

export async function updatePoPaymentsAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  try {
    await requireManagePaymentPermission("/po");
    const supabase = actionClient();
    const poId = requiredText(formData, "poId");
    const rowKeys = formData.getAll("paymentRowKey").map((value) => String(value).trim());
    const legacyIds = formData.getAll("paymentId").map((value) => String(value).trim());
    const legacyStatuses = formData.getAll("paymentStatus").map((value) => String(value).trim());
    const legacyTypes = formData.getAll("paymentType").map((value) => String(value).trim());
    const legacyAmountValues = formData.getAll("amount").map((value) => String(value).trim());
    const legacyExchangeRateValues = formData
      .getAll("exchangeRate")
      .map((value) => String(value).trim());
    const legacyCurrencies = formData.getAll("currency").map((value) => String(value).trim());
    const legacyPaymentDates = formData.getAll("paymentDate").map((value) => String(value).trim());
    const legacyDueDates = formData.getAll("dueDate").map((value) => String(value).trim());
    const legacyPaidByValues = formData.getAll("paidBy").map((value) => String(value).trim());
    const legacyReferences = formData.getAll("reference").map((value) => String(value).trim());
    const legacyNotes = formData.getAll("note").map((value) => String(value).trim());
    const deleteIds = new Set(
      formData.getAll("deletePaymentId").map((value) => String(value).trim()).filter(Boolean),
    );

    if (deleteIds.size > 0) {
      const { error } = await supabase
        .from("po_payments")
        .delete()
        .eq("po_id", poId)
        .in("id", Array.from(deleteIds));
      if (error) {
        throw new Error(error.message);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    let savedCount = 0;
    const rows =
      rowKeys.length > 0
        ? rowKeys.map((rowKey, index) => ({
            amountValue: formText(formData, `amount:${rowKey}`),
            currency: formText(formData, `currency:${rowKey}`),
            dueDate: formText(formData, `dueDate:${rowKey}`),
            exchangeRateValue: formText(formData, `exchangeRate:${rowKey}`),
            index,
            paidBy: formText(formData, `paidBy:${rowKey}`),
            paymentDate: formText(formData, `paymentDate:${rowKey}`),
            rawId: formText(formData, `paymentId:${rowKey}`),
            reference: formText(formData, `reference:${rowKey}`),
            note: formText(formData, `note:${rowKey}`),
            status: formText(formData, `paymentStatus:${rowKey}`),
            type: formText(formData, `paymentType:${rowKey}`),
          }))
        : legacyIds.map((rawId, index) => ({
            amountValue: legacyAmountValues[index] ?? "",
            currency: legacyCurrencies[index] ?? "",
            dueDate: legacyDueDates[index] ?? "",
            exchangeRateValue: legacyExchangeRateValues[index] ?? "",
            index,
            paidBy: legacyPaidByValues[index] ?? "",
            paymentDate: legacyPaymentDates[index] ?? "",
            rawId,
            reference: legacyReferences[index] ?? "",
            note: legacyNotes[index] ?? "",
            status: legacyStatuses[index] ?? "",
            type: legacyTypes[index] ?? "",
          }));

    for (const rowInput of rows) {
      const { index, rawId } = rowInput;
      if (rawId && deleteIds.has(rawId)) {
        continue;
      }

      const status = rowInput.status === "planned" ? "planned" : "paid";
      const amount = nonNegativeTextNumber(rowInput.amountValue, `Payment ${index + 1} amount`);
      const exchangeRate = nonNegativeTextNumber(
        rowInput.exchangeRateValue || "1",
        `Payment ${index + 1} exchange rate`,
      ) || 1;
      const paymentDate = rowInput.paymentDate || (status === "paid" ? today : null);
      const dueDate = rowInput.dueDate || null;
      const hasContent =
        Boolean(rawId) ||
        amount > 0;

      if (!hasContent) {
        continue;
      }

      const row = {
        po_id: poId,
        payment_date: paymentDate,
        payment_type: rowInput.type || `payment_${index + 1}`,
        payment_status: status,
        due_date: dueDate,
        amount,
        currency: rowInput.currency || "THB",
        exchange_rate: exchangeRate,
        amount_thb: amount * exchangeRate,
        paid_by: rowInput.paidBy || null,
        reference: rowInput.reference || null,
        note: rowInput.note || null,
      };

      const { error } = rawId
        ? await supabase.from("po_payments").update(row).eq("id", rawId).eq("po_id", poId)
        : await supabase.from("po_payments").insert(row);
      if (error) {
        throw new Error(error.message);
      }
      savedCount += 1;
    }

    await recalculatePoAmount(poId);
    refreshPoViews(poId);
    return success(`Saved ${savedCount} payment rows`);
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Save payments failed");
  }
}
