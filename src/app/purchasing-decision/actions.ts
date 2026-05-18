"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseDecisionTags } from "@/lib/purchasing-decision-data";
import { requireUser } from "@/lib/auth";
import { canCreatePo, canEditPo } from "@/lib/access-control";
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

function manualOverrideNumber(value: string, intent: string) {
  // Computed order quantities are display/read-model values. Persist only when
  // the row explicitly marks the submitted quantity as a manual buyer override.
  if (intent !== "manual") {
    return null;
  }

  const parsed = nullableNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

type ExistingDecisionControl = {
  sku: string | null;
  product_name_override: string | null;
  main_name_override: string | null;
  supplier_override: string | null;
  item_status_override: string | null;
  tags_override: string[] | null;
  demand_index_override: number | string | null;
  hide_reason: string | null;
  note: string | null;
};

function autoNumber(value: string, calculatedValue: string, forceOverride = false) {
  const parsed = nullableNumber(value);
  const calculated = nullableNumber(calculatedValue);
  if (parsed === null) {
    return null;
  }
  if (forceOverride) {
    return parsed;
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

function existingText(value: string | null | undefined) {
  return value?.trim() || "";
}

function textOrExisting(value: string, existing: string | null | undefined) {
  return value || existingText(existing);
}

export async function savePurchasingDecisionAction(formData: FormData) {
  const profile = await requireUser("/purchasing-decision");
  if (profile.role !== "super_admin" || !canEditPo(profile.email)) {
    throw new Error("Only super_admin can save purchasing planning controls.");
  }

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
  const supplierSources = formData.getAll("supplierSource");
  const originalSuppliers = formData.getAll("originalSupplier");
  const itemStatuses = formData.getAll("itemStatus");
  const tags = formData.getAll("tags");
  const demandIndexes = formData.getAll("demandIndexHm");
  const demandOverrideAccepted = formData.getAll("demandOverrideAccepted");
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
  const manualRopUnitIntents = formData.getAll("manualRopUnitsIntent");
  const orderQtyModes = formData.getAll("orderQtyMode");
  const targetCoverageDays = formData.getAll("targetCoverageDays");
  const hideReasons = formData.getAll("hideReason");
  const notes = formData.getAll("note");
  const now = new Date().toISOString();
  const submittedSkus = skus
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const existingControls = new Map<string, ExistingDecisionControl>();

  for (let index = 0; index < submittedSkus.length; index += 1000) {
    const chunk = submittedSkus.slice(index, index + 1000);
    const { data } = await supabase
      .from("purchasing_decision_controls")
      .select(
        "sku,product_name_override,main_name_override,supplier_override,item_status_override,tags_override,demand_index_override,hide_reason,note",
      )
      .in("sku", chunk);

    for (const row of (data ?? []) as ExistingDecisionControl[]) {
      const sku = row.sku?.trim();
      if (sku) {
        existingControls.set(sku, row);
      }
    }
  }

  const rows = skus.flatMap((skuValue, index) => {
    const sku = String(skuValue ?? "").trim();
    if (!sku) {
      return [];
    }

    const supplierValue = textAt(suppliers, index);
    const supplierSource = textAt(supplierSources, index);
    const originalSupplier = textAt(originalSuppliers, index);
    const existing = existingControls.get(sku);
    const supplierIsAllowed = allowedSuppliers.has(supplierValue.toLowerCase());
    const nextSupplier =
      supplierIsAllowed &&
      (supplierSource === "decision" ||
        supplierValue.toLowerCase() !== originalSupplier.toLowerCase())
        ? supplierValue
        : supplierSource === "decision"
          ? existingText(existing?.supplier_override)
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
    const existingTags = existing?.tags_override ?? [];
    const tagsToSave =
      textAt(tags, index) || nextTags.length
        ? nextTags
        : existingTags.filter((tag) => allowedTags.has(tag.toLowerCase()));
    const demandIndexValue = textAt(demandIndexes, index);
    const demandToSave = demandIndexValue
      ? autoNumber(
          demandIndexValue,
          textAt(calculatedDemandIndexes, index),
          textAt(demandOverrideAccepted, index) === "true",
        )
      : nullableNumber(String(existing?.demand_index_override ?? ""));

    return [
      {
        sku,
        product_name_override: nullableText(
          textOrExisting(textAt(productNames, index), existing?.product_name_override),
        ),
        main_name_override: nullableText(
          textOrExisting(textAt(mainNames, index), existing?.main_name_override),
        ),
        supplier_override: nullableText(nextSupplier),
        item_status_override: nullableText(
          textOrExisting(textAt(itemStatuses, index), existing?.item_status_override),
        ),
        tags_override: tagsToSave,
        demand_index_override: demandToSave,
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
        manual_rop_units: manualOverrideNumber(
          textAt(manualRopUnits, index),
          textAt(manualRopUnitIntents, index),
        ),
        order_qty_mode: textAt(orderQtyModes, index) === "raw" ? "raw" : "rounded",
        target_coverage_days: nullableNumber(textAt(targetCoverageDays, index)),
        hide_from_purchasing: hiddenSkus.has(sku),
        hide_reason: nullableText(
          textOrExisting(textAt(hideReasons, index), existing?.hide_reason),
        ),
        note: nullableText(textOrExisting(textAt(notes, index), existing?.note)),
        planning_override_note: "Saved from Purchasing Decision visible rows",
        planning_override_source: "manual_visible_rows",
        updated_by: profile.authUserId,
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
    if (
      error.message.includes("updated_by") ||
      error.message.includes("planning_override_source") ||
      error.message.includes("planning_override_note")
    ) {
      const rowsWithoutMetadata = rows.map((row) => {
        const {
          planning_override_note: planningOverrideNote,
          planning_override_source: planningOverrideSource,
          updated_by: updatedBy,
          ...fallbackRow
        } = row;
        void planningOverrideNote;
        void planningOverrideSource;
        void updatedBy;
        return fallbackRow;
      });
      const retry = await supabase
        .from("purchasing_decision_controls")
        .upsert(rowsWithoutMetadata, { onConflict: "sku" });
      if (retry.error) {
        throw new Error(retry.error.message);
      }
    } else if (error.message.includes("order_qty_mode")) {
      const rowsWithoutQtyMode = rows.map((row) => {
        const { order_qty_mode: orderQtyMode, ...fallbackRow } = row;
        void orderQtyMode;
        return fallbackRow;
      });
      const retry = await supabase
        .from("purchasing_decision_controls")
        .upsert(rowsWithoutQtyMode, { onConflict: "sku" });
      if (retry.error) {
        throw new Error(retry.error.message);
      }
    } else {
      throw new Error(error.message);
    }
  }

  revalidatePath("/purchasing-decision");
  revalidatePath("/");
  revalidatePath("/po");
  redirectWithDecisionSaved(formData, rows.length);
}

function generatedPoId() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 17);
  return `PO-${stamp}`;
}

function decisionReturnTo(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  return returnTo.startsWith("/purchasing-decision") ? returnTo : "/purchasing-decision";
}

function redirectWithPoError(formData: FormData, message: string): never {
  const returnTo = decisionReturnTo(formData);
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}poError=${encodeURIComponent(message)}`);
}

function redirectWithDecisionSaved(formData: FormData, savedRows: number): never {
  const returnTo = decisionReturnTo(formData);
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}saved=1&savedRows=${savedRows}`);
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

const SIZE_ORDER = new Map(
  ["xxs", "2xs", "xs", "s", "m", "l", "xl", "2xl", "3xl"].map((size, index) => [
    size,
    index,
  ]),
);

function normalizedSizeToken(value: string) {
  const normalized = value.toLowerCase().replace(/\b2xs\b/g, "xxs");
  const match = normalized.match(/(?:^|[\s/_-])(xxs|xs|s|m|l|xl|2xl|3xl)(?:$|[\s/_-])/);
  return match?.[1] ?? "";
}

function sizeRank(...values: string[]) {
  const size = values.map(normalizedSizeToken).find(Boolean);
  return size ? SIZE_ORDER.get(size) ?? 99 : 99;
}

function productGroupName(value: string) {
  return value
    .replace(/\s*\/\s*(?:2XS|XXS|XS|S|M|L|XL|2XL|3XL)\s*$/i, "")
    .trim();
}

export async function createPoFromDecisionAction(formData: FormData) {
  const profile = await requireUser("/purchasing-decision");
  if (profile.role !== "super_admin" || !canCreatePo(profile.email)) {
    throw new Error("Only super_admin can create POs from purchasing planning controls.");
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    redirectWithPoError(formData, "Supabase is not configured yet.");
  }

  const selectedSkus = Array.from(
    new Set(formData.getAll("selectedSku").map((value) => String(value).trim()).filter(Boolean)),
  );
  if (!selectedSkus.length) {
    redirectWithPoError(formData, "No valid rows selected for PO creation.");
  }

  const allSkus = formData.getAll("poSku").map((value) => String(value).trim());
  const productBySku = textMap(allSkus, formData.getAll("poProductName"));
  const mainNameBySku = textMap(allSkus, formData.getAll("poMainName"));
  const supplierBySku = textMap(allSkus, formData.getAll("poSupplier"));
  const unitPriceBySku = textMap(allSkus, formData.getAll("poUnitPrice"));
  const rawQtyBySku = textMap(allSkus, formData.getAll("poRawQty"));
  const roundedQtyBySku = textMap(allSkus, formData.getAll("poRoundedQty"));
  let selectedSkusWithQty: string[];
  try {
    selectedSkusWithQty = selectedSkus.filter((sku) => {
      const qtyChoice = String(formData.get(`qtyChoice:${sku}`) ?? "rounded");
      const qtyMap = qtyChoice === "raw" ? rawQtyBySku : roundedQtyBySku;
      return numberFromMap(qtyMap, sku, "Order qty") > 0;
    });
  } catch (error) {
    redirectWithPoError(
      formData,
      error instanceof Error ? error.message : "Could not validate PO quantities.",
    );
  }
  if (!selectedSkusWithQty.length) {
    redirectWithPoError(
      formData,
      "No valid rows selected for PO creation.",
    );
  }

  const selectedSuppliers = new Set(
    selectedSkusWithQty.map((sku) => supplierBySku.get(sku)).filter(Boolean),
  );
  if (selectedSuppliers.size !== 1) {
    redirectWithPoError(formData, "Select SKUs from one supplier before creating a PO.");
  }

  const supplierName = Array.from(selectedSuppliers)[0] ?? "";
  const { data: supplier, error: supplierError } = await supabase
    .from("po_suppliers")
    .select("supplier_code,supplier_name,currency,payment_terms")
    .ilike("supplier_name", supplierName)
    .limit(1)
    .maybeSingle();

  if (supplierError) {
    redirectWithPoError(formData, supplierError.message);
  }
  if (!supplier) {
    redirectWithPoError(formData, `Supplier ${supplierName} is not mapped in PO suppliers.`);
  }

  const poId = generatedPoId();
  const today = new Date().toISOString().slice(0, 10);
  const currency = supplier.currency ?? "THB";
  const sortedSelectedSkus = [...selectedSkusWithQty].sort((a, b) => {
    const mainA = mainNameBySku.get(a) || productBySku.get(a) || a;
    const mainB = mainNameBySku.get(b) || productBySku.get(b) || b;
    const productA = productBySku.get(a) || a;
    const productB = productBySku.get(b) || b;

    return (
      mainA.localeCompare(mainB) ||
      productGroupName(productA).localeCompare(productGroupName(productB)) ||
      sizeRank(a, productA) - sizeRank(b, productB) ||
      productA.localeCompare(productB) ||
      a.localeCompare(b)
    );
  });
  const items = (() => {
    try {
      return sortedSelectedSkus.map((sku, index) => {
        const qtyChoice = String(formData.get(`qtyChoice:${sku}`) ?? "rounded");
        const orderedQty =
          qtyChoice === "raw"
            ? numberFromMap(rawQtyBySku, sku, "Order qty")
            : numberFromMap(roundedQtyBySku, sku, "Rounded qty");
        const unitPrice = numberFromMap(unitPriceBySku, sku, "Unit price");
        const productTitle = productBySku.get(sku) || sku;

        return {
          po_item_id: `${poId}-${index + 1}`,
          po_id: poId,
          line_no: String(index + 1),
          sort_position: index + 1,
          sku,
          product_title_snapshot: productTitle,
          variant_title_snapshot: null,
          ordered_qty: orderedQty,
          unit_price: unitPrice,
          freight_unit_cost: 0,
          landed_unit_cost: unitPrice,
          line_amount: orderedQty * unitPrice,
          currency,
          remark: qtyChoice === "raw" ? "Created from Purchasing Decision order qty" : "Created from Purchasing Decision rounded qty",
          full_name: productTitle,
          line_status: "draft",
          source: "purchasing_decision",
          updated_at: new Date().toISOString(),
        };
      });
    } catch (error) {
      redirectWithPoError(
        formData,
        error instanceof Error ? error.message : "Could not prepare PO lines.",
      );
    }
  })();

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
    redirectWithPoError(formData, orderError.message);
  }

  const { error: itemError } = await supabase.from("po_items").insert(items);
  if (itemError) {
    await supabase.from("po_orders").delete().eq("po_id", poId);
    redirectWithPoError(formData, itemError.message);
  }

  const { error: statusEventError } = await supabase.from("po_status_events").insert({
    po_id: poId,
    to_status: "draft",
    note: `Created from Purchasing Decision (${sortedSelectedSkus.length} SKUs)`,
  });
  if (statusEventError) {
    console.error(`Could not record PO status event for ${poId}: ${statusEventError.message}`);
  }

  revalidatePath("/purchasing-decision");
  revalidatePath("/po");
  redirect(`/po/${encodeURIComponent(poId)}`);
}
