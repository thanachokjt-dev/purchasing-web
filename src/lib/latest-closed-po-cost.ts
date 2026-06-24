import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;
const BATCH_SIZE = 100;
const CLOSED_STATUSES = new Set(["closed", "completed", "complete", "received", "fully_received"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "void", "voided", "deleted"]);

type CostItemRow = {
  created_at: string | null;
  currency: string | null;
  id: string;
  legacy_received_qty: number | string | null;
  po_id: string;
  sku: string;
  unit_price: number | string | null;
  updated_at: string | null;
};

type CostOrderRow = {
  actual_received_date: string | null;
  cancelled_at: string | null;
  closed_at: string | null;
  created_at: string | null;
  currency: string | null;
  po_date: string | null;
  po_id: string;
  po_title: string | null;
  quotation_reference: string | null;
  supplier_invoice_no: string | null;
  updated_at: string | null;
  work_status: string | null;
};

type CostReceiptRow = {
  actual_received_date?: string | null;
  po_item_id: string;
  received_at: string | null;
  received_qty: number | string | null;
};

export type LatestClosedPoUnitCost = {
  currency: string;
  latestPurchaseDate: string;
  latestUnitPrice: number;
  sourcePoId: string;
  sourcePoReference: string;
};

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusKey(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function currencyKey(value: string | null | undefined) {
  return String(value || "THB").trim().toUpperCase();
}

function latestText(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort((a, b) => String(b).localeCompare(String(a)))[0] ?? "";
}

export async function getLatestClosedPoUnitCostBySkus(
  supabase: SupabaseClient,
  skus: string[],
  targetCurrency: string | ReadonlyMap<string, string>,
) {
  const cleanSkus = Array.from(new Set(skus.map((sku) => sku.trim()).filter(Boolean)));
  const result = new Map<string, LatestClosedPoUnitCost>();
  if (!cleanSkus.length) return result;

  const items: CostItemRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("po_items")
      .select("id,po_id,sku,unit_price,currency,legacy_received_qty,created_at,updated_at")
      .in("sku", cleanSkus)
      .gt("unit_price", 0)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Latest closed PO item lookup failed: ${error.message}`);
    items.push(...((data ?? []) as CostItemRow[]));
    if ((data ?? []).length < PAGE_SIZE) break;
  }
  if (!items.length) return result;

  const poIds = Array.from(new Set(items.map((item) => item.po_id)));
  const orders: CostOrderRow[] = [];
  for (let index = 0; index < poIds.length; index += BATCH_SIZE) {
    const { data, error } = await supabase
      .from("po_orders")
      .select("po_id,po_title,po_date,work_status,currency,actual_received_date,closed_at,cancelled_at,quotation_reference,supplier_invoice_no,created_at,updated_at")
      .in("po_id", poIds.slice(index, index + BATCH_SIZE));
    if (error) throw new Error(`Latest closed PO header lookup failed: ${error.message}`);
    orders.push(...((data ?? []) as CostOrderRow[]));
  }

  const itemIds = items.map((item) => item.id);
  const receipts: CostReceiptRow[] = [];
  for (let index = 0; index < itemIds.length; index += BATCH_SIZE) {
    const receiptQuery = await supabase
      .from("po_receipts")
      .select("po_item_id,received_qty,actual_received_date,received_at")
      .in("po_item_id", itemIds.slice(index, index + BATCH_SIZE));
    if (receiptQuery.error && /actual_received_date|schema cache|column/i.test(receiptQuery.error.message)) {
      const fallbackReceiptQuery = await supabase
        .from("po_receipts")
        .select("po_item_id,received_qty,received_at")
        .in("po_item_id", itemIds.slice(index, index + BATCH_SIZE));
      if (fallbackReceiptQuery.error) {
        throw new Error(`Latest closed PO receipt lookup failed: ${fallbackReceiptQuery.error.message}`);
      }
      receipts.push(...((fallbackReceiptQuery.data ?? []) as CostReceiptRow[]));
      continue;
    }
    if (receiptQuery.error) {
      throw new Error(`Latest closed PO receipt lookup failed: ${receiptQuery.error.message}`);
    }
    receipts.push(...((receiptQuery.data ?? []) as CostReceiptRow[]));
  }

  const orderById = new Map(orders.map((order) => [order.po_id, order]));
  const receiptsByItem = new Map<string, { date: string; qty: number }>();
  for (const receipt of receipts) {
    const current = receiptsByItem.get(receipt.po_item_id) ?? { date: "", qty: 0 };
    current.qty += numeric(receipt.received_qty);
    current.date = latestText(current.date, receipt.actual_received_date, receipt.received_at);
    receiptsByItem.set(receipt.po_item_id, current);
  }

  const candidates = items.flatMap((item) => {
    const order = orderById.get(item.po_id);
    if (!order) return [];
    const status = statusKey(order.work_status);
    if (order.cancelled_at || CANCELLED_STATUSES.has(status)) return [];
    const receipt = receiptsByItem.get(item.id);
    const receivedQty = numeric(item.legacy_received_qty) + (receipt?.qty ?? 0);
    const received = receivedQty > 0;
    const closed = Boolean(order.closed_at) || CLOSED_STATUSES.has(status);
    const currency = currencyKey(item.currency || order.currency);
    const desiredCurrency = currencyKey(
      typeof targetCurrency === "string"
        ? targetCurrency
        : targetCurrency.get(item.sku),
    );
    if ((!received && !closed) || currency !== desiredCurrency) return [];

    const receivedDate = received
      ? latestText(receipt?.date, order.actual_received_date)
      : "";
    const purchaseDate = latestText(
      receivedDate,
      order.closed_at,
      order.po_date,
      order.updated_at,
      order.created_at,
      item.updated_at,
      item.created_at,
    );
    return [{ item, order, received, purchaseDate, currency }];
  });

  candidates.sort((a, b) =>
    Number(b.received) - Number(a.received) ||
    b.purchaseDate.localeCompare(a.purchaseDate) ||
    b.order.po_id.localeCompare(a.order.po_id),
  );

  for (const candidate of candidates) {
    if (result.has(candidate.item.sku)) continue;
    result.set(candidate.item.sku, {
      currency: candidate.currency,
      latestPurchaseDate: candidate.purchaseDate.slice(0, 10),
      latestUnitPrice: numeric(candidate.item.unit_price),
      sourcePoId: candidate.order.po_id,
      sourcePoReference:
        candidate.order.quotation_reference?.trim() ||
        candidate.order.supplier_invoice_no?.trim() ||
        candidate.order.po_title?.trim() ||
        candidate.order.po_id,
    });
  }

  return result;
}
