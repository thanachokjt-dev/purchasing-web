"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type PoActionState = {
  ok: boolean;
  message: string;
};

const ACTIVE_RECEIVING_STATUSES = new Set(["inpro", "delivery", "final_payment"]);
const BLOCKED_RECEIVING_STATUSES = new Set(["closed", "cancelled", "canceled"]);
const VALID_STATUSES = new Set([
  "draft",
  "waiting_for_approve",
  "inpro",
  "delivery",
  "final_payment",
  "closed",
  "cancelled",
]);

const initialError = (message: string): PoActionState => ({ ok: false, message });
const success = (message: string): PoActionState => ({ ok: true, message });

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

function positiveNumber(formData: FormData, name: string) {
  const value = Number(formData.get(name));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be greater than 0`);
  }
  return value;
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

function normalizeStatus(value: string) {
  return value.trim().toLowerCase();
}

function generatedPoId() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `PO-${stamp}`;
}

function actionClient() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase service credentials are required for PO writes");
  }
  return supabase;
}

function refreshPoViews() {
  revalidatePath("/po");
  revalidatePath("/");
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
  try {
    const supabase = actionClient();
    const supplierCode = requiredText(formData, "supplierCode");
    const supplier = await supplierSnapshot(supplierCode);
    const poId = optionalText(formData, "poId") ?? generatedPoId();
    const poDate = optionalText(formData, "poDate") ?? new Date().toISOString().slice(0, 10);
    const sku = requiredText(formData, "sku");
    const orderedQty = positiveNumber(formData, "orderedQty");
    const unitPrice = nonNegativeNumber(formData, "unitPrice");
    const currency = optionalText(formData, "currency") ?? supplier.currency ?? "THB";
    const lineAmount = orderedQty * unitPrice;

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
      po_amount_foreign: lineAmount,
      po_amount_thb: currency === "THB" ? lineAmount : 0,
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
      sku,
      product_title_snapshot: optionalText(formData, "productTitle") ?? sku,
      variant_title_snapshot: optionalText(formData, "variantTitle"),
      ordered_qty: orderedQty,
      unit_price: unitPrice,
      line_amount: lineAmount,
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

    refreshPoViews();
    return success(`Created ${poId}`);
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Create PO failed");
  }
}

export async function addPoItemAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  try {
    const supabase = actionClient();
    const poId = requiredText(formData, "poId");
    const sku = requiredText(formData, "sku");
    const orderedQty = positiveNumber(formData, "orderedQty");
    const unitPrice = nonNegativeNumber(formData, "unitPrice");

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
    const lineAmount = orderedQty * unitPrice;

    const { error: itemError } = await supabase.from("po_items").insert({
      po_item_id: `${poId}-${lineNo}`,
      po_id: poId,
      line_no: lineNo,
      sku,
      product_title_snapshot: optionalText(formData, "productTitle") ?? sku,
      variant_title_snapshot: optionalText(formData, "variantTitle"),
      ordered_qty: orderedQty,
      unit_price: unitPrice,
      line_amount: lineAmount,
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

    const currentForeignAmount = Number(order.po_amount_foreign ?? 0);
    const currentThbAmount = Number(order.po_amount_thb ?? 0);
    await supabase
      .from("po_orders")
      .update({
        po_amount_foreign: currentForeignAmount + lineAmount,
        po_amount_thb: currency === "THB" ? currentThbAmount + lineAmount : currentThbAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("po_id", poId);

    refreshPoViews();
    return success(`Added ${sku} to ${poId}`);
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Add PO item failed");
  }
}

export async function changePoStatusAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  try {
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

      const timestampFields: Record<string, string | null> = {};
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

      await supabase.from("po_status_events").insert({
        po_id: poId,
        from_status: order.work_status ?? null,
        to_status: toStatus,
        actor,
        note: optionalText(formData, "note"),
      });
    }

    refreshPoViews();
    return success(`Updated ${poId} to ${toStatus}`);
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Change status failed");
  }
}

export async function receivePoItemAction(
  _previousState: PoActionState,
  formData: FormData,
): Promise<PoActionState> {
  try {
    const supabase = actionClient();
    const itemUuid = requiredText(formData, "itemUuid");
    const receivedQty = positiveNumber(formData, "receivedQty");

    const { data: item, error: itemError } = await supabase
      .from("po_items")
      .select("id,po_id,line_status")
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
      .select("closed_at,cancelled_at")
      .eq("po_id", item.po_id)
      .maybeSingle();
    if (orderError) {
      throw new Error(orderError.message);
    }
    if (order?.closed_at || order?.cancelled_at) {
      throw new Error("Closed or cancelled POs cannot be received");
    }

    const status = normalizeStatus(item.line_status ?? "");
    if (BLOCKED_RECEIVING_STATUSES.has(status)) {
      throw new Error("Closed or cancelled lines cannot be received");
    }
    if (!ACTIVE_RECEIVING_STATUSES.has(status)) {
      throw new Error("Only inpro, delivery, or final_payment lines can be received");
    }

    const { data: receiptTotal, error: totalError } = await supabase
      .from("po_item_receipt_totals")
      .select("outstanding_qty")
      .eq("po_item_uuid", itemUuid)
      .maybeSingle();
    if (totalError) {
      throw new Error(totalError.message);
    }

    const outstandingQty = Number(receiptTotal?.outstanding_qty ?? 0);
    if (!Number.isFinite(outstandingQty) || outstandingQty <= 0) {
      throw new Error("This line has no outstanding quantity left");
    }
    if (receivedQty > outstandingQty) {
      throw new Error(`Receive quantity exceeds outstanding quantity (${outstandingQty})`);
    }

    const { error: receiptError } = await supabase.from("po_receipts").insert({
      po_item_id: itemUuid,
      received_qty: receivedQty,
      received_by: optionalText(formData, "receivedBy"),
      note: optionalText(formData, "note"),
      source: "web_app",
    });
    if (receiptError) {
      throw new Error(receiptError.message);
    }

    refreshPoViews();
    return success(`Received ${receivedQty} units`);
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Receive item failed");
  }
}
