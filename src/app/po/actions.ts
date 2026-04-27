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

function refreshPoViews(poId?: string | null) {
  revalidatePath("/po");
  revalidatePath("/");
  if (poId) {
    revalidatePath(`/po/${encodeURIComponent(poId)}`);
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

    refreshPoViews(poId);
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

    refreshPoViews(poId);
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
    const supabase = actionClient();
    const poId = requiredText(formData, "poId");
    const itemUuids = formData.getAll("batchItemUuid").map((value) => String(value).trim());
    const qtyValues = formData.getAll("batchReceivedQty").map((value) => String(value).trim());

    if (itemUuids.length !== qtyValues.length) {
      throw new Error("Receive lines are mismatched. Reload the page and try again.");
    }

    const requestedReceipts = itemUuids.flatMap((itemUuid, index) => {
      const qtyText = qtyValues[index] ?? "";
      if (!qtyText || Number(qtyText) === 0) {
        return [];
      }

      const receivedQty = Number(qtyText);
      if (!itemUuid) {
        throw new Error(`Line ${index + 1} is missing an item id`);
      }
      if (!Number.isFinite(receivedQty) || receivedQty < 0) {
        throw new Error(`Line ${index + 1} receive quantity must be 0 or greater`);
      }

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
      .select("closed_at,cancelled_at")
      .eq("po_id", poId)
      .maybeSingle();
    if (orderError) {
      throw new Error(orderError.message);
    }
    if (!order) {
      throw new Error(`PO ${poId} does not exist`);
    }
    if (order.closed_at || order.cancelled_at) {
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
      .select("po_item_uuid,outstanding_qty")
      .in("po_item_uuid", uniqueItemUuids);
    if (totalError) {
      throw new Error(totalError.message);
    }

    const outstandingByItemId = new Map(
      ((totals ?? []) as Array<{
        po_item_uuid: string | null;
        outstanding_qty: number | string | null;
      }>)
        .filter((row) => row.po_item_uuid)
        .map((row) => [row.po_item_uuid, Number(row.outstanding_qty ?? 0)]),
    );

    for (const receipt of requestedReceipts) {
      const item = itemById.get(receipt.itemUuid);
      if (!item) {
        throw new Error(`PO item ${receipt.itemUuid} does not exist`);
      }
      if (item.po_id !== poId) {
        throw new Error(`Line ${item.line_no ?? item.sku ?? receipt.itemUuid} does not belong to ${poId}`);
      }

      const status = normalizeStatus(item.line_status ?? "");
      if (BLOCKED_RECEIVING_STATUSES.has(status)) {
        throw new Error(`Line ${item.line_no ?? item.sku} is closed or cancelled`);
      }
      if (!ACTIVE_RECEIVING_STATUSES.has(status)) {
        throw new Error(
          `Line ${item.line_no ?? item.sku} must be inpro, delivery, or final_payment before receiving`,
        );
      }

      const outstandingQty = outstandingByItemId.get(receipt.itemUuid) ?? 0;
      if (!Number.isFinite(outstandingQty) || outstandingQty <= 0) {
        throw new Error(`Line ${item.line_no ?? item.sku} has no outstanding quantity left`);
      }
      if (receipt.receivedQty > outstandingQty) {
        throw new Error(
          `Line ${item.line_no ?? item.sku} receive quantity exceeds outstanding quantity (${outstandingQty})`,
        );
      }
    }

    const receivedBy = optionalText(formData, "receivedBy");
    const note = optionalText(formData, "note");
    const { error: receiptError } = await supabase.from("po_receipts").insert(
      requestedReceipts.map((receipt) => ({
        po_item_id: receipt.itemUuid,
        received_qty: receipt.receivedQty,
        received_by: receivedBy,
        note,
        source: "web_app",
      })),
    );
    if (receiptError) {
      throw new Error(receiptError.message);
    }

    const totalQty = requestedReceipts.reduce((sum, receipt) => sum + receipt.receivedQty, 0);
    refreshPoViews(poId);
    return success(
      `Received ${totalQty} units across ${requestedReceipts.length} lines`,
    );
  } catch (error) {
    return initialError(error instanceof Error ? error.message : "Batch receive failed");
  }
}
