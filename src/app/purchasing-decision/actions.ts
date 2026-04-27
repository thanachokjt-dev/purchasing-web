"use server";

import { revalidatePath } from "next/cache";
import { parseDecisionTags } from "@/lib/purchasing-decision-data";
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

export async function savePurchasingDecisionAction(formData: FormData) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return;
  }

  const skus = formData.getAll("sku");
  const hiddenSkus = new Set(
    formData.getAll("hiddenSku").map((value) => String(value).trim()),
  );
  const productNames = formData.getAll("productName");
  const mainNames = formData.getAll("mainName");
  const suppliers = formData.getAll("supplier");
  const tags = formData.getAll("tags");
  const safetyDays = formData.getAll("safetyDays");
  const leadTimeDays = formData.getAll("leadTimeDays");
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

    return [
      {
        sku,
        product_name_override: nullableText(textAt(productNames, index)),
        main_name_override: nullableText(textAt(mainNames, index)),
        supplier_override: nullableText(textAt(suppliers, index)),
        tags_override: parseDecisionTags(textAt(tags, index)),
        safety_days: nullableNumber(textAt(safetyDays, index)),
        lead_time_days: nullableNumber(textAt(leadTimeDays, index)),
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

  await supabase
    .from("purchasing_decision_controls")
    .upsert(rows, { onConflict: "sku" });

  revalidatePath("/purchasing-decision");
  revalidatePath("/");
  revalidatePath("/po");
}
