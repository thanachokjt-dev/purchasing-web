"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseDecisionTags } from "@/lib/purchasing-decision-data";
import { getPurchasingSetupData } from "@/lib/purchasing-setup";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

function textAt(values: FormDataEntryValue[], index: number) {
  return String(values[index] ?? "").trim();
}

function nullableText(value: string) {
  return value || null;
}

function nullableNumber(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function autoNumber(value: string, calculatedValue: string) {
  const parsed = nullableNumber(value);
  const calculated = nullableNumber(calculatedValue);
  if (parsed === null) {
    return null;
  }
  if (calculated !== null && Math.abs(parsed - calculated) < 0.0001) {
    return null;
  }

  return parsed;
}

function plannedNumber(
  value: string,
  source: string,
  supplierDefault: string,
  originalValue: string,
) {
  const parsed = nullableNumber(value);
  const defaultValue = nullableNumber(supplierDefault);
  const original = nullableNumber(originalValue);
  if (source !== "sku" && defaultValue !== null && parsed === original) {
    return null;
  }

  if (
    parsed !== null &&
    defaultValue !== null &&
    parsed === defaultValue &&
    (source === "supplier" || source === "default")
  ) {
    return null;
  }

  return parsed;
}

export async function savePurchasingDecisionAction(formData: FormData) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return;
  }

  const setupData = await getPurchasingSetupData();
  const allowedSuppliers = new Set(
    setupData.suppliers
      .filter((supplier) => supplier.isActive)
      .map((supplier) => supplier.supplierName.toLowerCase()),
  );
  const supplierDefaultByName = new Map(
    setupData.suppliers
      .filter((supplier) => supplier.isActive)
      .map((supplier) => [supplier.supplierName.toLowerCase(), supplier]),
  );
  const allowedTags = new Set(
    setupData.tags
      .filter((tag) => tag.isActive)
      .map((tag) => tag.tag.toLowerCase()),
  );

  const skus = formData.getAll("sku");
  const hiddenSkus = new Set(
    formData.getAll("hiddenSku").map((value) => String(value).trim()),
  );
  const productNames = formData.getAll("productName");
  const mainNames = formData.getAll("mainName");
  const suppliers = formData.getAll("supplier");
  const tags = formData.getAll("tags");
  const demandIndexes = formData.getAll("demandIndexHm");
  const calculatedDemandIndexes = formData.getAll("calculatedDemandIndexHm");
  const safetyDays = formData.getAll("safetyDays");
  const safetySources = formData.getAll("safetySource");
  const originalSafetyDays = formData.getAll("originalSafetyDays");
  const supplierSafetyDays = formData.getAll("supplierSafetyDays");
  const leadTimeDays = formData.getAll("leadTimeDays");
  const leadTimeSources = formData.getAll("leadTimeSource");
  const originalLeadTimeDays = formData.getAll("originalLeadTimeDays");
  const supplierLeadTimeDays = formData.getAll("supplierLeadTimeDays");
  const orderCycleDays = formData.getAll("orderCycleDays");
  const manualRopUnits = formData.getAll("manualRopUnits");
  const targetCoverageDays = formData.getAll("targetCoverageDays");
  const hideReasons = formData.getAll("hideReason");
  const notes = formData.getAll("note");
  const now = new Date().toISOString();

  const rows = skus.flatMap((skuValue, index) => {
    const sku = String(skuValue ?? "").trim();
    if (!sku) {
      return [];
    }

    const supplierValue = textAt(suppliers, index);
    const nextSupplier = allowedSuppliers.has(supplierValue.toLowerCase())
      ? supplierValue
      : "";
    const supplierDefault = supplierDefaultByName.get(nextSupplier.toLowerCase());
    const supplierSafetyDefault =
      supplierDefault && supplierDefault.safetyDays > 0
        ? String(supplierDefault.safetyDays)
        : textAt(supplierSafetyDays, index);
    const supplierLeadDefault =
      supplierDefault && supplierDefault.leadTimeDays > 0
        ? String(supplierDefault.leadTimeDays)
        : textAt(supplierLeadTimeDays, index);
    const nextTags = parseDecisionTags(textAt(tags, index)).filter((tag) =>
      allowedTags.has(tag.toLowerCase()),
    );

    return [
      {
        sku,
        product_name_override: nullableText(textAt(productNames, index)),
        main_name_override: nullableText(textAt(mainNames, index)),
        supplier_override: nullableText(nextSupplier),
        tags_override: nextTags,
        demand_index_override: autoNumber(
          textAt(demandIndexes, index),
          textAt(calculatedDemandIndexes, index),
        ),
        safety_days: plannedNumber(
          textAt(safetyDays, index),
          textAt(safetySources, index),
          supplierSafetyDefault,
          textAt(originalSafetyDays, index),
        ),
        lead_time_days: plannedNumber(
          textAt(leadTimeDays, index),
          textAt(leadTimeSources, index),
          supplierLeadDefault,
          textAt(originalLeadTimeDays, index),
        ),
        order_cycle_days: nullableNumber(textAt(orderCycleDays, index)),
        manual_rop_units: nullableNumber(textAt(manualRopUnits, index)),
        target_coverage_days: nullableNumber(textAt(targetCoverageDays, index)),
        hide_from_purchasing: hiddenSkus.has(sku),
        hide_reason: nullableText(textAt(hideReasons, index)),
        note: nullableText(textAt(notes, index)),
        updated_at: now,
      },
    ];
  });

  if (!rows.length) {
    return;
  }

  const { error } = await supabase
    .from("purchasing_decision_controls")
    .upsert(rows, { onConflict: "sku" });
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/purchasing-decision");
  revalidatePath("/");
  revalidatePath("/po");
}

function generatedPoId() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 17);
  return `PO-${stamp}`;
}

function numberFromMap(
  map: Map<string, string>,
  sku: string,
  label: string,
  fallback = 0,
) {
  const raw = map.get(sku)?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} for ${sku} must be 0 or greater`);
  }
  return parsed;
}

function textMap(skus: string[], values: FormDataEntryValue[]) {
  const map = new Map<string, string>();
  skus.forEach((sku, index) => map.set(sku, textAt(values, index)));
  return map;
}

export async function createPoFromDecisionAction(formData: FormData) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return;
  }

  const selectedSkus = Array.from(
    new Set(formData.getAll("selectedSku").map((value) => String(value).trim()).filter(Boolean)),
  );
  if (!selectedSkus.length) {
    return;
  }

  const allSkus = formData.getAll("poSku").map((value) => String(value).trim());
  const productBySku = textMap(allSkus, formData.getAll("poProductName"));
  const supplierBySku = textMap(allSkus, formData.getAll("poSupplier"));
  const unitPriceBySku = textMap(allSkus, formData.getAll("poUnitPrice"));
  const rawQtyBySku = textMap(allSkus, formData.getAll("poRawQty"));
  const roundedQtyBySku = textMap(allSkus, formData.getAll("poRoundedQty"));

  const selectedSuppliers = new Set(
    selectedSkus.map((sku) => supplierBySku.get(sku)).filter(Boolean),
  );
  if (selectedSuppliers.size !== 1) {
    throw new Error("Select SKUs from one supplier before creating a PO");
  }

  const supplierName = Array.from(selectedSuppliers)[0] ?? "";
  const { data: supplier, error: supplierError } = await supabase
    .from("po_suppliers")
    .select("supplier_code,supplier_name,currency,payment_terms")
    .ilike("supplier_name", supplierName)
    .limit(1)
    .maybeSingle();

  if (supplierError) {
    throw new Error(supplierError.message);
  }
  if (!supplier) {
    throw new Error(`Supplier ${supplierName} is not mapped in PO suppliers`);
  }

  const poId = generatedPoId();
  const today = new Date().toISOString().slice(0, 10);
  const currency = supplier.currency ?? "THB";
  const items = selectedSkus.map((sku, index) => {
    const qtyChoice = String(formData.get(`qtyChoice:${sku}`) ?? "rounded");
    const orderedQty =
      qtyChoice === "raw"
        ? numberFromMap(rawQtyBySku, sku, "Raw qty")
        : numberFromMap(roundedQtyBySku, sku, "Rounded qty");
    const unitPrice = numberFromMap(unitPriceBySku, sku, "Unit price");
    const productTitle = productBySku.get(sku) || sku;

    return {
      po_item_id: `${poId}-${index + 1}`,
      po_id: poId,
      line_no: String(index + 1),
      sku,
      product_title_snapshot: productTitle,
      variant_title_snapshot: null,
      ordered_qty: orderedQty,
      unit_price: unitPrice,
      freight_unit_cost: 0,
      landed_unit_cost: unitPrice,
      line_amount: orderedQty * unitPrice,
      currency,
      remark: qtyChoice === "raw" ? "Created from Purchasing Decision raw qty" : "Created from Purchasing Decision rounded qty",
      full_name: productTitle,
      line_status: "draft",
      source: "purchasing_decision",
      updated_at: new Date().toISOString(),
    };
  });

  const poAmount = items.reduce((sum, item) => sum + item.line_amount, 0);
  const { error: orderError } = await supabase.from("po_orders").insert({
    po_id: poId,
    po_title: `${supplierName} reorder ${today}`,
    po_date: today,
    work_status: "draft",
    supplier_code: supplier.supplier_code,
    supplier_name_snapshot: supplier.supplier_name,
    currency,
    po_amount_foreign: poAmount,
    po_amount_thb: currency === "THB" ? poAmount : 0,
    payment_terms_snapshot: supplier.payment_terms,
    source: "purchasing_decision",
    updated_at: new Date().toISOString(),
  });
  if (orderError) {
    throw new Error(orderError.message);
  }

  const { error: itemError } = await supabase.from("po_items").insert(items);
  if (itemError) {
    await supabase.from("po_orders").delete().eq("po_id", poId);
    throw new Error(itemError.message);
  }

  await supabase.from("po_status_events").insert({
    po_id: poId,
    to_status: "draft",
    note: `Created from Purchasing Decision (${selectedSkus.length} SKUs)`,
  });

  revalidatePath("/purchasing-decision");
  revalidatePath("/po");
  redirect(`/po/${encodeURIComponent(poId)}`);
}
