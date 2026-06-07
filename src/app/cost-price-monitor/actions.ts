"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canAccessCostPriceMonitor } from "@/lib/role-nav";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function textAt(formData: FormData, name: string, index: number) {
  return String(formData.getAll(name)[index] ?? "").trim();
}

function nullableNonNegativeNumber(raw: string, label: string) {
  if (!raw) {
    return { value: null };
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return { error: `${label} must be 0 or greater.` };
  }
  return { value };
}

function safeReturnTo(value: string) {
  return value.startsWith("/cost-price-monitor") ? value : "/cost-price-monitor";
}

function returnToWithStatus(returnTo: string, status: "error" | "saved", message?: string) {
  const url = new URL(safeReturnTo(returnTo), "http://local");
  url.searchParams.delete("overrideError");
  url.searchParams.delete("overrideSaved");
  if (status === "saved") {
    url.searchParams.set("overrideSaved", "1");
  } else {
    url.searchParams.set("overrideError", message || "Manual override could not be saved.");
  }
  return `${url.pathname}${url.search}`;
}

function isMissingOverrideTableError(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "PGRST205" ||
    /cost_price_monitor_overrides/i.test(error?.message ?? "") ||
    /schema cache/i.test(error?.message ?? "")
  );
}

export async function saveCostPriceOverrideAction(formData: FormData) {
  return saveCostPriceOverridesAction(formData);
}

export async function saveCostPriceOverridesAction(formData: FormData) {
  const returnTo = text(formData, "returnTo");
  const profile = await requireUser("/cost-price-monitor");
  if (!canAccessCostPriceMonitor(profile)) {
    throw new Error("You do not have permission to update cost price overrides.");
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    redirect(returnToWithStatus(returnTo, "error", "Supabase service client is not configured."));
  }

  const now = new Date().toISOString();
  const groupKeys = formData.getAll("groupKey").map((value) => String(value ?? "").trim());
  const saveGroupKey = text(formData, "saveGroupKey");
  const dirtyGroupKeys = new Set(
    formData
      .getAll("dirtyGroupKey")
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
  const targetGroupKeys = saveGroupKey ? new Set([saveGroupKey]) : dirtyGroupKeys;

  if (targetGroupKeys.size === 0) {
    redirect(returnToWithStatus(returnTo, "error", "No changed manual overrides to save."));
  }

  let validationMessage = "";
  const payload = groupKeys.flatMap((groupKey, index) => {
    if (!groupKey || !targetGroupKeys.has(groupKey)) {
      return [];
    }

    const mainName = textAt(formData, "mainName", index);
    if (!mainName) {
      validationMessage = "Product group is required.";
      return [];
    }

    const manualPurchasePrice = nullableNonNegativeNumber(
      textAt(formData, "manualPurchasePrice", index),
      "Manual purchase override",
    );
    const manualLandedCost = nullableNonNegativeNumber(
      textAt(formData, "manualLandedCost", index),
      "Manual landed override",
    );
    const manualSellingPrice = nullableNonNegativeNumber(
      textAt(formData, "manualSellingPrice", index),
      "Manual selling override",
    );
    const validationError = manualPurchasePrice.error || manualLandedCost.error || manualSellingPrice.error;
    if (validationError) {
      validationMessage = validationError;
      return [];
    }

    return [
      {
        group_key: groupKey,
        main_name: mainName,
        color: textAt(formData, "color", index) || null,
        supplier: textAt(formData, "supplier", index) || null,
        category: textAt(formData, "category", index) || null,
        product_group: textAt(formData, "productGroup", index) || null,
        manual_purchase_price: manualPurchasePrice.value,
        manual_landed_cost: manualLandedCost.value,
        manual_selling_price: manualSellingPrice.value,
        note: textAt(formData, "note", index) || null,
        updated_by: profile.authUserId,
        updated_at: now,
      },
    ];
  });

  if (validationMessage) {
    redirect(returnToWithStatus(returnTo, "error", validationMessage));
  }

  if (payload.length === 0) {
    redirect(returnToWithStatus(returnTo, "error", "No matching manual override rows were found to save."));
  }

  let errorMessage = "";
  const { error } = await supabase
    .from("cost_price_monitor_overrides")
    .upsert(payload, { onConflict: "group_key" });

  if (error) {
    if (isMissingOverrideTableError(error)) {
      const legacyPayload = payload.map((row) => ({ ...row, sku: null }));
      const legacyResult = await supabase
        .from("cost_price_overrides")
        .upsert(legacyPayload, { onConflict: "group_key" });
      if (legacyResult.error) {
        console.error("Cost Price Monitor legacy override save failed", legacyResult.error);
        errorMessage =
          "Manual override could not be saved. Apply migration 058 or confirm the legacy override table is available.";
      }
    } else {
      console.error("Cost Price Monitor override save failed", error);
      errorMessage =
        "Manual override could not be saved. Confirm migration 058 has created cost_price_monitor_overrides.";
    }
  }

  if (errorMessage) {
    redirect(returnToWithStatus(returnTo, "error", errorMessage));
  }

  revalidatePath("/cost-price-monitor");
  revalidatePath("/cost-price-monitor/print");
  redirect(returnToWithStatus(returnTo, "saved"));
}
